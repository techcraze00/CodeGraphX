// Golden-fixture accuracy harness.
//
// Pure helpers shared by the jest gate (accuracy.test.js) and the benchmark
// script (scripts/benchmark.js). No jest dependency. Measures the graph
// CodeGraphX produces for a fixture against a hand-labeled ground-truth.json.
//
// Symbol/edge/API accuracy is read straight from the in-memory Snapshot that
// runScan returns (no DB needed). Impact tracing needs the DB, so each scan
// resets the in-memory DB first: runScan reuses the first repository row, so a
// fresh DB guarantees the lone repo is the fixture we just scanned.

if (!process.env.DATABASE_URL) process.env.DATABASE_URL = ':memory:';
if (!process.env.DB_DIALECT) process.env.DB_DIALECT = 'sqlite';

const fs = require('fs');
const os = require('os');
const path = require('path');

const { runScan } = require('../../src/scanner');
const { runDoctor } = require('../../src/doctor');
const { db } = require('../../src/db');
const { runMigrations } = require('../../src/db/migrator');
const { SqlGraphStore } = require('../../src/store/sql-store');

const GOLDEN_DIR = __dirname;
const CORPUS = ['python-app', 'js-app', 'fullstack'];

// Tables dropped between scans (mirrors tests/store/sql-store.test.js).
const TABLES = [
  'unresolved_symbols', 'dependencies', 'embeddings', 'edges', 'symbols',
  'files', 'file_blobs', 'index_jobs', 'commits', 'repositories',
  'kysely_migration', 'kysely_migration_lock',
];

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else if (entry.name !== 'ground-truth.json') fs.copyFileSync(s, d);
  }
}

async function resetDb() {
  for (const table of TABLES) {
    await db.schema.dropTable(table).ifExists().execute();
  }
  await runMigrations();
}

function loadGroundTruth(fixture) {
  return JSON.parse(fs.readFileSync(path.join(GOLDEN_DIR, fixture, 'ground-truth.json'), 'utf8'));
}

// Scan a fixture into a throwaway tmp copy + a fresh in-memory DB.
// Returns { snapshot, durationMs, fileCount, symbolCount, cleanup }.
async function scanGolden(fixture, extensions) {
  await resetDb();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `cgx-golden-${fixture}-`));
  copyDir(path.join(GOLDEN_DIR, fixture), tmp);
  const config = {
    extensions,
    ignore: ['node_modules', '.git'],
    outputDir: '.cgxout',
    outputFile: 'out.json',
  };
  const t0 = Date.now();
  const snapshot = await runScan(tmp, config, true);
  const durationMs = Date.now() - t0;
  const fileCount = snapshot.files.length;
  const symbolCount = symbolKeys(snapshot).size;
  return {
    snapshot,
    durationMs,
    fileCount,
    symbolCount,
    cleanup: () => fs.rmSync(tmp, { recursive: true, force: true }),
  };
}

// ── Key extraction ─────────────────────────────────────────────────────────

function symbolKeys(snapshot) {
  const set = new Set();
  for (const f of snapshot.files) {
    for (const s of f.symbols) set.add(`${s.id}|${s.type}`);
  }
  return set;
}

function expectedSymbolKeys(gt) {
  return new Set(gt.symbols.map((s) => `${s.id}|${s.kind}`));
}

function edgeKeys(snapshot, types) {
  const set = new Set();
  for (const e of snapshot.edges) {
    if (types.includes(e.type)) set.add(`${e.from}|${e.to}|${e.type}`);
  }
  return set;
}

function expectedEdgeKeys(gt, types) {
  return new Set(
    gt.edges.filter((e) => types.includes(e.type)).map((e) => `${e.from}|${e.to}|${e.type}`)
  );
}

function endpointKeys(snapshot) {
  const set = new Set();
  for (const f of snapshot.files) {
    for (const s of f.symbols) {
      if ((s.ontology || []).includes('endpoint')) set.add(s.id);
    }
  }
  return set;
}

// ── Metric core ──────────────────────────────────────────────────────────────

// Precision / recall / F1 of an actual set against an expected set.
function scoreSet(actual, expected) {
  const missing = [...expected].filter((k) => !actual.has(k)); // false negatives
  const extra = [...actual].filter((k) => !expected.has(k)); // false positives
  const tp = expected.size - missing.length;
  const fp = extra.length;
  const fn = missing.length;
  const precision = tp + fp === 0 ? 1 : tp / (tp + fp);
  const recall = tp + fn === 0 ? 1 : tp / (tp + fn);
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  return { tp, fp, fn, precision, recall, f1, missing, extra };
}

// Combine many scoreSet results into one aggregate (micro-average over tp/fp/fn).
function aggregate(scores) {
  const tp = scores.reduce((n, s) => n + s.tp, 0);
  const fp = scores.reduce((n, s) => n + s.fp, 0);
  const fn = scores.reduce((n, s) => n + s.fn, 0);
  const precision = tp + fp === 0 ? 1 : tp / (tp + fp);
  const recall = tp + fn === 0 ? 1 : tp / (tp + fn);
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  return { tp, fp, fn, precision, recall, f1 };
}

// ── Cross-language API matches ───────────────────────────────────────────────

function apiCallEdges(snapshot) {
  return snapshot.edges.filter((e) => e.type === 'API_CALLS');
}

// Score expected API links: each must exist as an API_CALLS edge at >= its
// minConfidence. Returns scoreSet plus a list of confidence violations.
function scoreApiCalls(snapshot, gt) {
  const actual = apiCallEdges(snapshot);
  const actualSet = new Set(actual.map((e) => `${e.from}|${e.to}`));
  const expectedSet = new Set(gt.apiCalls.map((e) => `${e.from}|${e.to}`));
  const score = scoreSet(actualSet, expectedSet);
  const confidenceViolations = [];
  for (const exp of gt.apiCalls) {
    const found = actual.find((e) => e.from === exp.from && e.to === exp.to);
    if (found && found.confidence < exp.minConfidence) {
      confidenceViolations.push({ link: `${exp.from} -> ${exp.to}`, got: found.confidence, want: exp.minConfidence });
    }
  }
  return { ...score, confidenceViolations };
}

// ── Impact tracing (needs the DB) ────────────────────────────────────────────

async function currentRepoId() {
  const repo = await db.selectFrom('repositories').selectAll().limit(1).executeTakeFirst();
  return repo ? repo.id : null;
}

// Resolve a symbol's qualified_name to its DB uuid, then trace impact.
// Returns the set of symbol names reached.
async function traceNames(repoId, qualifiedName, direction, depth) {
  const sym = await db.selectFrom('symbols')
    .selectAll()
    .where('repository_id', '=', repoId)
    .where('qualified_name', '=', qualifiedName)
    .where('valid_to_commit_id', 'is', null)
    .executeTakeFirst();
  if (!sym) return null;
  const store = new SqlGraphStore(db);
  const rows = await store.traceImpact(repoId, sym.id, direction, depth);
  return new Set(rows.map((r) => r.name));
}

// Score every impact entry in ground-truth: actual reached set must be a
// superset of expected. Returns { passed, total, failures }.
async function scoreImpact(gt) {
  const repoId = await currentRepoId();
  let passed = 0;
  const failures = [];
  for (const entry of gt.impact || []) {
    const got = await traceNames(repoId, entry.symbol, entry.direction, entry.depth || 5);
    const missing = got === null ? entry.expected : entry.expected.filter((n) => !got.has(n));
    if (missing.length === 0) passed += 1;
    else failures.push({ symbol: entry.symbol, direction: entry.direction, missing, got: got ? [...got] : null });
  }
  return { passed, total: (gt.impact || []).length, failures };
}

// ── Doctor diagnostics ───────────────────────────────────────────────────────

function doctorReport(snapshot, projectRoot) {
  return runDoctor(snapshot.files.map((f) => f.toJSON()), projectRoot);
}

// Score circular-import detection: each expected cycle (a set of basenames)
// must be matched by some reported cycle; report false positives too.
function scoreDoctor(snapshot, gt) {
  const report = doctorReport(snapshot, '');
  const reported = report.issues.circularImports.map(
    (ci) => new Set(ci.cycle.map((f) => path.basename(f)))
  );
  const expected = (gt.doctor.circularImports || []).map((c) => new Set(c));

  const matched = expected.filter((exp) =>
    reported.some((rep) => [...exp].every((b) => rep.has(b)))
  );
  // A reported cycle is a false positive if it matches no expected cycle.
  const falsePositives = reported.filter(
    (rep) => !expected.some((exp) => [...exp].every((b) => rep.has(b)))
  ).length;

  return {
    expectedCycles: expected.length,
    detectedCycles: matched.length,
    falsePositives,
    recall: expected.length === 0 ? 1 : matched.length / expected.length,
  };
}

module.exports = {
  CORPUS,
  GOLDEN_DIR,
  scanGolden,
  resetDb,
  loadGroundTruth,
  symbolKeys,
  expectedSymbolKeys,
  edgeKeys,
  expectedEdgeKeys,
  endpointKeys,
  scoreSet,
  aggregate,
  scoreApiCalls,
  scoreImpact,
  scoreDoctor,
  traceNames,
  currentRepoId,
};
