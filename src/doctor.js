const path = require('path');
const { execSync } = require('child_process');

// ── Cache for dynamic built-ins ──────────────────────────────────────────
let cachedBuiltins = null;

function getBuiltins() {
  if (cachedBuiltins) return cachedBuiltins;

  const builtins = new Set([
    // Manual additions for common symbols that might not be in dir(builtins)
    // but are effectively standard or very common.
    'Path', 'AsyncMock', 'MagicMock', 'Mock', 'patch', 'PropertyMock',
    'call', 'ANY', 'DEFAULT', 'sentinel',
    'auto', 'Enum', 'IntEnum', 'StrEnum', 'Flag', 'IntFlag',
    'deque', 'defaultdict', 'namedtuple', 'OrderedDict', 'Counter',
    'dataclass', 'field', 'fields', 'asdict', 'astuple', 'make_dataclass',
    'List', 'Dict', 'Set', 'Tuple', 'Optional', 'Union', 'Any', 'Callable', 'Iterable', 'Iterator',
    'TypedDict', 'Literal', 'Protocol', 'runtime_checkable', 'Annotated', 'Final', 'ClassVar',
  ]);

  // Python built-ins and standard library modules
  try {
    const pyCmd = 'python3 -c "import builtins, sys; std = sys.stdlib_module_names if hasattr(sys, \'stdlib_module_names\') else []; print(\',\'.join(dir(builtins) + list(std)))"';
    const pyOutput = execSync(pyCmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    pyOutput.split(',').forEach(b => builtins.add(b.trim()));
  } catch (e) {
    // Graceful fallback if python3 is not available
  }

  // Node.js/JS globals and built-in modules
  try {
    const jsCmd = 'node -e "const builtin = require(\'module\').builtinModules; console.log(Object.getOwnPropertyNames(global).concat(builtin).join(\',\'))"';
    const jsOutput = execSync(jsCmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    jsOutput.split(',').forEach(b => builtins.add(b.trim()));
  } catch (e) {
    // Graceful fallback if node is not available
  }

  cachedBuiltins = builtins;
  return builtins;
}

/**
 * Analyzes a parsed codebase for issues.
 */
function runDoctor(filesData, projectRoot) {
  // ── Build lookup structures ──────────────────────────────────────────────

  const knownFiles = new Set(filesData.map(f => f.file));
  const knownSymbolNames = new Set();
  const builtins = getBuiltins();

  for (const f of filesData) {
    for (const sym of f.symbols || []) {
      if (!sym.name) continue;
      knownSymbolNames.add(sym.name);
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  function resolveImport(importObj, fromFile) {
    const importStr = typeof importObj === 'string' ? importObj : importObj.source;
    if (!importStr) return null;
    const exts = ['.py', '.js', '.ts', '.jsx', '.tsx'];
    const fromDir = path.dirname(fromFile);

    if (importStr.startsWith('.')) {
      const base = path.join(fromDir, importStr).replace(/\\/g, '/');
      for (const ext of exts) {
        if (knownFiles.has(base + ext)) return base + ext;
      }
      if (knownFiles.has(base)) return base;
      for (const ext of exts) {
        const idx = path.join(base, 'index').replace(/\\/g, '/') + ext;
        if (knownFiles.has(idx)) return idx;
      }
      return null;
    }

    const slashed = importStr.replace(/\./g, '/');
    for (const ext of exts) {
      if (knownFiles.has(slashed + ext)) return slashed + ext;
    }
    for (const f of knownFiles) {
      const base = f.replace(/\.[^/.]+$/, '');
      if (base === slashed || base.endsWith('/' + slashed)) return f;
    }
    for (const ext of exts) {
      const idx = slashed + '/index' + ext;
      if (knownFiles.has(idx)) return idx;
    }
    return null;
  }

  function looksLocal(importObj, fromFile) {
    const importStr = typeof importObj === 'string' ? importObj : importObj.source;
    if (!importStr) return false;
    if (importStr.startsWith('.')) return true;

    // Strict check: if it's a single segment, it's local only if we can resolve it.
    if (!importStr.includes('.')) {
      return !!resolveImport(importObj, fromFile);
    }

    const rootSegment = importStr.split('.')[0];
    for (const f of knownFiles) {
      if (f.startsWith(rootSegment + '/') || f.startsWith(rootSegment + '.')) return true;
    }
    return false;
  }

  // ── Main analysis loop ───────────────────────────────────────────────────

  const parseErrors     = [];
  const syntaxErrors    = [];
  const missingImports  = [];
  const unresolvedCalls = [];
  const circularImports = [];

  const depGraph = new Map();
  for (const f of filesData) {
    const deps = new Set();
    for (const imp of f.imports || []) {
      const resolved = resolveImport(imp, f.file);
      if (resolved) deps.add(resolved);
    }
    depGraph.set(f.file, deps);
  }

  const visited = new Set();
  const recStack = new Set();
  const currentPath = [];

  function findCycles(node) {
    visited.add(node);
    recStack.add(node);
    currentPath.push(node);

    const neighbors = depGraph.get(node) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        findCycles(neighbor);
      } else if (recStack.has(neighbor)) {
        const cycleStartIdx = currentPath.indexOf(neighbor);
        const cycle = currentPath.slice(cycleStartIdx);
        circularImports.push({
          cycle: [...cycle, neighbor],
          severity: 'warning',
          message: `Circular dependency detected: ${cycle.map(f => path.basename(f)).join(' -> ')} -> ${path.basename(neighbor)}`,
        });
      }
    }

    recStack.delete(node);
    currentPath.pop();
  }

  for (const file of knownFiles) {
    if (!visited.has(file)) {
      findCycles(file);
    }
  }

  for (const f of filesData) {
    const displayFile = f.file;
    const fileUnresolvedSeen = new Set();

    const importedNames = new Set();
    for (const imp of f.imports || []) {
      if (imp.localName) importedNames.add(imp.localName);
      const source = typeof imp === 'string' ? imp : imp.source;
      if (source) {
        source.split('.').forEach(seg => importedNames.add(seg));
      }
    }

    if (f.parseError) {
      parseErrors.push({ file: displayFile, error: f.parseError, severity: 'error' });
    }

    for (const se of f.syntaxErrors || []) {
      syntaxErrors.push({
        file: displayFile,
        line: se.line,
        column: se.column,
        nodeType: se.nodeType,
        context: se.context || '',
        severity: 'error',
        message: `Syntax error at line ${se.line}:${se.column} — unexpected ${se.nodeType}${se.context ? ` near \`${se.context}\` ` : ''}`,
      });
    }

    for (const imp of f.imports || []) {
      const resolved = resolveImport(imp, displayFile);
      if (!resolved && looksLocal(imp, displayFile)) {
        const importLabel = typeof imp === 'string' ? imp : (imp.source || imp.localName || 'unknown');
        missingImports.push({
          file: displayFile,
          import: importLabel,
          severity: 'warning',
          message: `Cannot resolve import "${importLabel}" — no matching file found in the graph`,
        });
      }
    }

    for (const sym of f.symbols || []) {
      for (const callee of sym.calls || []) {
        if (builtins.has(callee)) continue;

        const rootPart = callee.split('.')[0];
        if (importedNames.has(rootPart) || importedNames.has(callee)) continue;

        const issueKey = `${sym.name}:${callee}`;
        if (fileUnresolvedSeen.has(issueKey)) continue;

        if (callee.includes('.') && !knownSymbolNames.has(rootPart)) {
          continue;
        }

        if (!knownSymbolNames.has(callee)) {
          fileUnresolvedSeen.add(issueKey);
          unresolvedCalls.push({
            file: displayFile,
            caller: sym.name,
            callee,
            severity: 'info',
            message: `"${sym.name}" calls "${callee}" which is not defined in the graph (may be external or dynamic)`,
          });
        }
      }
    }
  }

  const totalIssues =
    parseErrors.length + syntaxErrors.length +
    missingImports.length + unresolvedCalls.length + circularImports.length;

  const summary = {
    filesAnalyzed:   filesData.length,
    symbolsAnalyzed: filesData.reduce((n, f) => n + (f.symbols?.length || 0), 0),
    totalIssues,
    parseErrors:     parseErrors.length,
    syntaxErrors:    syntaxErrors.length,
    missingImports:  missingImports.length,
    unresolvedCalls: unresolvedCalls.length,
    circularImports: circularImports.length,
    healthy: totalIssues === 0,
  };

  return {
    summary,
    issues: { parseErrors, syntaxErrors, missingImports, unresolvedCalls, circularImports },
  };
}

function printReport(report) {
  const { summary, issues } = report;
  const RESET  = '\x1b[0m';
  const BOLD   = '\x1b[1m';
  const RED    = '\x1b[31m';
  const YELLOW = '\x1b[33m';
  const CYAN   = '\x1b[36m';
  const GREEN  = '\x1b[32m';
  const DIM    = '\x1b[2m';
  const ORANGE = '\x1b[33m';

  console.log(`\n${BOLD}🩺  CodeGraphX Doctor Report${RESET}`);
  console.log(`${'─'.repeat(55)}`);
  console.log(`  Files analysed  : ${summary.filesAnalyzed}`);
  console.log(`  Symbols found   : ${summary.symbolsAnalyzed}`);
  console.log(`  Total issues    : ${summary.totalIssues === 0 ? GREEN + '0 ✅' + RESET : BOLD + summary.totalIssues + RESET}`);
  console.log();

  if (issues.parseErrors.length > 0) {
    console.log(`${BOLD}${RED}❌  Parse Errors (${issues.parseErrors.length})${RESET}`);
    for (const e of issues.parseErrors) {
      console.log(`  ${RED}•${RESET} ${BOLD}${e.file}${RESET}`);
      console.log(`    ${DIM}${e.error}${RESET}`);
    }
    console.log();
  }

  if (issues.syntaxErrors.length > 0) {
    const byFile = {};
    for (const se of issues.syntaxErrors) {
      if (!byFile[se.file]) byFile[se.file] = [];
      byFile[se.file].push(se);
    }
    console.log(`${BOLD}${RED}🔴  Syntax Errors (${issues.syntaxErrors.length})${RESET}`);
    for (const [file, items] of Object.entries(byFile)) {
      console.log(`  ${RED}•${RESET} ${BOLD}${file}${RESET}`);
      for (const item of items) {
        console.log(`      ${item.message}`);
      }
    }
    console.log();
  }

  console.log(`${BOLD}${ORANGE}🔄  Circular Dependencies (${issues.circularImports.length})${RESET}`);
  if (issues.circularImports.length > 0) {
    for (const ci of issues.circularImports) {
      console.log(`  ${ORANGE}•${RESET} ${ci.message}`);
    }
  } else {
    console.log(`  ${DIM}None detected.${RESET}`);
  }
  console.log();

  if (issues.missingImports.length > 0) {
    console.log(`${BOLD}${YELLOW}⚠️   Missing / Unresolvable Imports (${issues.missingImports.length})${RESET}`);
    const byFile = {};
    for (const m of issues.missingImports) {
      if (!byFile[m.file]) byFile[m.file] = [];
      byFile[m.file].push(m);
    }
    for (const [file, items] of Object.entries(byFile)) {
      console.log(`  ${YELLOW}•${RESET} ${BOLD}${file}${RESET}`);
      for (const item of items) {
        console.log(`      ${DIM}import "${item.import}"${RESET}`);
      }
    }
    console.log();
  }

  if (issues.unresolvedCalls.length > 0) {
    console.log(`${BOLD}${CYAN}ℹ️   Unresolved Call Targets (${issues.unresolvedCalls.length})${RESET}`);
    const byFile = {};
    for (const c of issues.unresolvedCalls) {
      if (!byFile[c.file]) byFile[c.file] = [];
      byFile[c.file].push(c);
    }
    for (const [file, items] of Object.entries(byFile)) {
      console.log(`  ${CYAN}•${RESET} ${BOLD}${file}${RESET}`);
      for (const item of items) {
        console.log(`      ${DIM}${item.caller}() → "${item.callee}" (not in graph)${RESET}`);
      }
    }
    console.log();
  }

  if (summary.healthy) {
    console.log(`${GREEN}${BOLD}✅  Codebase looks healthy — no issues detected.${RESET}\n`);
  } else {
    const breakdown = [
      summary.parseErrors     > 0 ? `${RED}${summary.parseErrors} parse error(s)${RESET}`         : null,
      summary.syntaxErrors    > 0 ? `${RED}${summary.syntaxErrors} syntax error(s)${RESET}`        : null,
      summary.circularImports > 0 ? `${ORANGE}${summary.circularImports} circular import(s)${RESET}` : null,
      summary.missingImports  > 0 ? `${YELLOW}${summary.missingImports} missing import(s)${RESET}` : null,
      summary.unresolvedCalls > 0 ? `${CYAN}${summary.unresolvedCalls} unresolved call(s)${RESET}` : null,
    ].filter(Boolean).join(', ');
    console.log(`${BOLD}Report: ${breakdown}${RESET}\n`);
  }
}

module.exports = { runDoctor, printReport };