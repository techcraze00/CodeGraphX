#!/usr/bin/env node
// CodeGraphX accuracy benchmark.
//
// Runs the golden-fixture harness over the labeled corpus, computes
// precision/recall/F1 for symbols, structural edges, cross-language API links,
// endpoint tagging, impact tracing and circular-import detection, checks
// determinism, measures throughput, then writes benchmark-results.json +
// BENCHMARK.md and prints a summary table.
//
//   npm run benchmark

process.env.DATABASE_URL = process.env.DATABASE_URL || ':memory:';
process.env.DB_DIALECT = process.env.DB_DIALECT || 'sqlite';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const H = require(path.join(ROOT, 'tests/golden/harness'));
const { db } = require(path.join(ROOT, 'src/db'));

const STRUCTURAL = ['CALLS', 'IMPORTS', 'INHERITS'];

function pct(x) {
  return (x * 100).toFixed(1) + '%';
}

function gitCommit() {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

async function benchFixture(fixture) {
  const gt = H.loadGroundTruth(fixture);

  // First scan — measured for accuracy + throughput.
  const run1 = await H.scanGolden(fixture, gt.extensions);
  const snap = run1.snapshot;

  const symbols = H.scoreSet(H.symbolKeys(snap), H.expectedSymbolKeys(gt));
  const edges = H.scoreSet(H.edgeKeys(snap, STRUCTURAL), H.expectedEdgeKeys(gt, STRUCTURAL));
  const api = H.scoreApiCalls(snap, gt);
  const endpoints = H.scoreSet(H.endpointKeys(snap), new Set(gt.endpoints || []));
  const impact = await H.scoreImpact(gt);
  const doctor = H.scoreDoctor(snap, gt);
  const sig1 = JSON.stringify([...H.symbolKeys(snap)].sort()) + JSON.stringify([...H.edgeKeys(snap, [...STRUCTURAL, 'API_CALLS'])].sort());
  run1.cleanup();

  // Second scan — determinism check (fresh DB + fresh tmp).
  const run2 = await H.scanGolden(fixture, gt.extensions);
  const sig2 = JSON.stringify([...H.symbolKeys(run2.snapshot)].sort()) + JSON.stringify([...H.edgeKeys(run2.snapshot, [...STRUCTURAL, 'API_CALLS'])].sort());
  run2.cleanup();

  return {
    fixture,
    description: gt.description,
    symbols,
    edges,
    api,
    endpoints,
    impact,
    doctor,
    deterministic: sig1 === sig2,
    durationMs: run1.durationMs,
    fileCount: run1.fileCount,
    symbolCount: run1.symbolCount,
  };
}

async function main() {
  const perFixture = [];
  for (const fixture of H.CORPUS) {
    perFixture.push(await benchFixture(fixture));
  }

  const symbolAgg = H.aggregate(perFixture.map((r) => r.symbols));
  const edgeAgg = H.aggregate(perFixture.map((r) => r.edges));
  const apiAgg = H.aggregate(perFixture.map((r) => r.api));
  const endpointAgg = H.aggregate(perFixture.map((r) => r.endpoints));

  const impactPassed = perFixture.reduce((n, r) => n + r.impact.passed, 0);
  const impactTotal = perFixture.reduce((n, r) => n + r.impact.total, 0);
  const cyclesExpected = perFixture.reduce((n, r) => n + r.doctor.expectedCycles, 0);
  const cyclesDetected = perFixture.reduce((n, r) => n + r.doctor.detectedCycles, 0);
  const cyclesFalsePos = perFixture.reduce((n, r) => n + r.doctor.falsePositives, 0);
  const allDeterministic = perFixture.every((r) => r.deterministic);

  const totalFiles = perFixture.reduce((n, r) => n + r.fileCount, 0);
  const totalSymbols = perFixture.reduce((n, r) => n + r.symbolCount, 0);
  const totalMs = perFixture.reduce((n, r) => n + r.durationMs, 0);
  const filesPerSec = totalMs > 0 ? (totalFiles / (totalMs / 1000)) : 0;
  const symbolsPerSec = totalMs > 0 ? (totalSymbols / (totalMs / 1000)) : 0;

  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

  const results = {
    generatedAt: new Date().toISOString(),
    version: pkg.version,
    node: process.version,
    gitCommit: gitCommit(),
    corpus: {
      fixtures: H.CORPUS.length,
      files: totalFiles,
      symbols: totalSymbols,
    },
    metrics: {
      symbols: symbolAgg,
      structuralEdges: edgeAgg,
      crossLanguageApi: apiAgg,
      endpointTagging: endpointAgg,
      impactTracing: { passed: impactPassed, total: impactTotal, accuracy: impactTotal ? impactPassed / impactTotal : 1 },
      circularImportDetection: { expected: cyclesExpected, detected: cyclesDetected, falsePositives: cyclesFalsePos, recall: cyclesExpected ? cyclesDetected / cyclesExpected : 1 },
      determinism: allDeterministic,
      throughput: { filesPerSec: Number(filesPerSec.toFixed(1)), symbolsPerSec: Number(symbolsPerSec.toFixed(1)), totalMs },
    },
    perFixture: perFixture.map((r) => ({
      fixture: r.fixture,
      symbols: { precision: r.symbols.precision, recall: r.symbols.recall, f1: r.symbols.f1 },
      structuralEdges: { precision: r.edges.precision, recall: r.edges.recall, f1: r.edges.f1 },
      crossLanguageApi: { precision: r.api.precision, recall: r.api.recall, f1: r.api.f1 },
      impact: r.impact,
      deterministic: r.deterministic,
    })),
  };

  // ── benchmark-results.json ──
  fs.writeFileSync(path.join(ROOT, 'benchmark-results.json'), JSON.stringify(results, null, 2) + '\n');

  // ── BENCHMARK.md ──
  const m = results.metrics;
  const row = (label, s) => `| ${label} | ${pct(s.precision)} | ${pct(s.recall)} | ${pct(s.f1)} |`;
  const md = `# CodeGraphX Accuracy Benchmark

> Auto-generated by \`npm run benchmark\` — do not edit by hand.

- **Version:** ${results.version}
- **Commit:** ${results.gitCommit}
- **Node:** ${results.node}
- **Generated:** ${results.generatedAt}
- **Corpus:** ${results.corpus.fixtures} hand-labeled fixtures, ${results.corpus.files} files, ${results.corpus.symbols} symbols (\`tests/golden/\`)

## Extraction accuracy (precision / recall / F1)

| Category | Precision | Recall | F1 |
|---|---|---|---|
${row('Symbols', m.symbols)}
${row('Structural edges (CALLS / IMPORTS / INHERITS)', m.structuralEdges)}
${row('Cross-language API links', m.crossLanguageApi)}
${row('Endpoint tagging', m.endpointTagging)}

## Reasoning accuracy

| Check | Result |
|---|---|
| Impact tracing (exact reachable set) | ${m.impactTracing.passed}/${m.impactTracing.total} (${pct(m.impactTracing.accuracy)}) |
| Circular-import detection (recall) | ${m.circularImportDetection.detected}/${m.circularImportDetection.expected} (${pct(m.circularImportDetection.recall)}) |
| Circular-import false positives | ${m.circularImportDetection.falsePositives} |
| Deterministic across re-scans | ${m.determinism ? 'yes' : 'NO'} |

## Throughput

| Metric | Value |
|---|---|
| Files / sec | ${m.throughput.filesPerSec} |
| Symbols / sec | ${m.throughput.symbolsPerSec} |
| Total scan time | ${m.throughput.totalMs} ms |

## Per-fixture

| Fixture | Symbols F1 | Edges F1 | API F1 | Impact | Deterministic |
|---|---|---|---|---|---|
${results.perFixture.map((r) => `| ${r.fixture} | ${pct(r.symbols.f1)} | ${pct(r.structuralEdges.f1)} | ${pct(r.crossLanguageApi.f1)} | ${r.impact.passed}/${r.impact.total} | ${r.deterministic ? 'yes' : 'NO'} |`).join('\n')}

## Reproduce

\`\`\`bash
npm run benchmark
\`\`\`

Measured on the curated golden corpus under \`tests/golden/\`, where every symbol,
edge, API link and import cycle is hand-labeled in \`ground-truth.json\`. The same
harness gates CI via \`tests/golden/accuracy.test.js\`.
`;
  fs.writeFileSync(path.join(ROOT, 'BENCHMARK.md'), md);

  // ── stdout summary ──
  console.log('\nCodeGraphX Accuracy Benchmark  (v' + results.version + ', ' + results.gitCommit + ')');
  console.log('Corpus: ' + results.corpus.fixtures + ' fixtures, ' + results.corpus.files + ' files, ' + results.corpus.symbols + ' symbols\n');
  const line = (l, s) => console.log('  ' + l.padEnd(34) + 'P ' + pct(s.precision).padStart(7) + '   R ' + pct(s.recall).padStart(7) + '   F1 ' + pct(s.f1).padStart(7));
  line('Symbols', m.symbols);
  line('Structural edges', m.structuralEdges);
  line('Cross-language API links', m.crossLanguageApi);
  line('Endpoint tagging', m.endpointTagging);
  console.log('  ' + 'Impact tracing'.padEnd(34) + m.impactTracing.passed + '/' + m.impactTracing.total + ' exact (' + pct(m.impactTracing.accuracy) + ')');
  console.log('  ' + 'Circular-import detection'.padEnd(34) + m.circularImportDetection.detected + '/' + m.circularImportDetection.expected + ' recall, ' + m.circularImportDetection.falsePositives + ' false pos');
  console.log('  ' + 'Determinism'.padEnd(34) + (m.determinism ? 'stable' : 'UNSTABLE'));
  console.log('  ' + 'Throughput'.padEnd(34) + m.throughput.filesPerSec + ' files/s, ' + m.throughput.symbolsPerSec + ' symbols/s');
  console.log('\nWrote benchmark-results.json + BENCHMARK.md\n');

  await db.destroy();
}

main().catch((e) => { console.error(e); process.exit(1); });
