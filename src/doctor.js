const path = require('path');

/**
 * Analyzes a parsed codebase for:
 *  1. Hard parse failures  (tree-sitter threw entirely, parseError present)
 *  2. Syntax errors        (partial tree with ERROR / MISSING nodes, syntaxErrors present)
 *  3. Missing imports      (local-looking imports that resolve to no known file)
 *  4. Unresolved calls     (call targets absent from the symbol graph)
 *
 * Requires the companion patches to entities.js and store.js so that
 * syntax-error node locations are collected and persisted into the cache.
 *
 * @param {Array}  filesData   - output of store.getFilesData()
 * @param {string} projectRoot - absolute path to project root (for relative display)
 * @returns {Object} report    - { summary, issues: { parseErrors[], syntaxErrors[], missingImports[], unresolvedCalls[] } }
 */
function runDoctor(filesData, projectRoot) {
  // ── Build lookup structures ──────────────────────────────────────────────

  const knownFiles = new Set(filesData.map(f => f.file));

  const knownSymbolNames = new Set();
  const symbolsByName = new Map();

  for (const f of filesData) {
    for (const sym of f.symbols || []) {
      if (!sym.name) continue;
      knownSymbolNames.add(sym.name);
      if (!symbolsByName.has(sym.name)) symbolsByName.set(sym.name, []);
      symbolsByName.get(sym.name).push({ file: f.file, symbol: sym });
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  function resolveImport(importStr, fromFile) {
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

  function looksLocal(importStr) {
    if (!importStr) return false;
    if (importStr.startsWith('.')) return true;
    if (!importStr.includes('.') && /^[a-zA-Z_]/.test(importStr)) {
      const knownExternal = new Set([
        'os', 'sys', 'path', 're', 'io', 'json', 'math', 'time', 'datetime',
        'collections', 'itertools', 'functools', 'typing', 'abc', 'copy',
        'hashlib', 'random', 'string', 'enum', 'dataclasses', 'contextlib',
        'threading', 'subprocess', 'shutil', 'tempfile', 'glob', 'pathlib',
        'logging', 'unittest', 'argparse', 'struct', 'socket', 'http',
        'urllib', 'email', 'html', 'xml', 'csv', 'sqlite3', 'pickle',
        'fs', 'child_process', 'crypto', 'https', 'net',
        'stream', 'util', 'events', 'buffer', 'url', 'querystring',
        'assert', 'cluster', 'dns', 'readline', 'repl', 'tls', 'zlib',
        'react', 'vue', 'angular', 'express', 'lodash', 'axios', 'moment',
        'jest', 'mocha', 'chai', 'webpack', 'babel', 'typescript',
        'commander', 'chokidar', 'ws', 'dotenv', 'chalk', 'yargs',
        'tree-sitter', 'bloom-filters',
        'numpy', 'pandas', 'scipy', 'sklearn', 'tensorflow', 'torch',
        'flask', 'django', 'fastapi', 'sqlalchemy', 'requests', 'pytest',
        'pydantic', 'click', 'rich', 'aiohttp', 'asyncio', 'boto3',
      ]);
      if (knownExternal.has(importStr)) return false;
      return true;
    }
    const firstSegment = importStr.split('.')[0];
    for (const f of knownFiles) {
      if (f.startsWith(firstSegment + '/') || f.startsWith(firstSegment + '.')) return true;
    }
    return false;
  }

  // ── Main analysis loop ───────────────────────────────────────────────────

  const parseErrors     = [];
  const syntaxErrors    = [];
  const missingImports  = [];
  const unresolvedCalls = [];

  for (const f of filesData) {
    const displayFile = f.file;

    // 1. Hard parse failures (tree-sitter threw, tree is null)
    if (f.parseError) {
      parseErrors.push({
        file: displayFile,
        error: f.parseError,
        severity: 'error',
      });
    }

    // 2. Syntax errors (tree-sitter partial parse with ERROR / MISSING nodes)
    //    Populated by the patched entities.js → collectSyntaxErrors().
    for (const se of f.syntaxErrors || []) {
      syntaxErrors.push({
        file: displayFile,
        line: se.line,        // 1-based
        column: se.column,    // 0-based
        nodeType: se.nodeType,
        context: se.context || '',
        severity: 'error',
        message: `Syntax error at line ${se.line}:${se.column} — unexpected ${se.nodeType}${se.context ? ` near \`${se.context}\`` : ''}`,
      });
    }

    // 3. Missing imports
    for (const imp of f.imports || []) {
      const resolved = resolveImport(imp, displayFile);
      if (!resolved && looksLocal(imp)) {
        missingImports.push({
          file: displayFile,
          import: imp,
          severity: 'warning',
          message: `Cannot resolve import "${imp}" — no matching file found in the graph`,
        });
      }
    }

    // 4. Unresolved call targets
    for (const sym of f.symbols || []) {
      for (const callee of sym.calls || []) {
        if (!knownSymbolNames.has(callee)) {
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

  // ── Summary ──────────────────────────────────────────────────────────────

  const totalIssues =
    parseErrors.length + syntaxErrors.length +
    missingImports.length + unresolvedCalls.length;

  const summary = {
    filesAnalyzed:   filesData.length,
    symbolsAnalyzed: filesData.reduce((n, f) => n + (f.symbols?.length || 0), 0),
    totalIssues,
    parseErrors:     parseErrors.length,
    syntaxErrors:    syntaxErrors.length,
    missingImports:  missingImports.length,
    unresolvedCalls: unresolvedCalls.length,
    healthy: totalIssues === 0,
  };

  return {
    summary,
    issues: { parseErrors, syntaxErrors, missingImports, unresolvedCalls },
  };
}

/**
 * Pretty-print the doctor report to console.
 */
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

  // ── Hard Parse Errors ──
  if (issues.parseErrors.length > 0) {
    console.log(`${BOLD}${RED}❌  Parse Errors (${issues.parseErrors.length})${RESET}`);
    console.log(`${DIM}   File could not be parsed at all — tree-sitter threw an exception.${RESET}`);
    for (const e of issues.parseErrors) {
      console.log(`  ${RED}•${RESET} ${BOLD}${e.file}${RESET}`);
      console.log(`    ${DIM}${e.error}${RESET}`);
    }
    console.log();
  }

  // ── Syntax Errors ──
  if (issues.syntaxErrors.length > 0) {
    const byFile = {};
    for (const se of issues.syntaxErrors) {
      if (!byFile[se.file]) byFile[se.file] = [];
      byFile[se.file].push(se);
    }
    const fileCount = Object.keys(byFile).length;
    console.log(`${BOLD}${RED}🔴  Syntax Errors (${issues.syntaxErrors.length} in ${fileCount} file${fileCount !== 1 ? 's' : ''})${RESET}`);
    console.log(`${DIM}   Tree-sitter parsed the file but found invalid syntax (ERROR / MISSING nodes).${RESET}`);

    for (const [file, items] of Object.entries(byFile)) {
      console.log(`  ${RED}•${RESET} ${BOLD}${file}${RESET}`);
      for (const item of items) {
        const loc     = `line ${item.line}:${item.column}`;
        const snippet = item.context ? `  ${DIM}near \`${item.context}\`${RESET}` : '';
        const kind    = item.nodeType === 'MISSING'
          ? `${ORANGE}MISSING token${RESET}`
          : `${RED}unexpected token${RESET}`;
        console.log(`      ${kind} at ${loc}${snippet}`);
      }
    }
    console.log();
  }

  // ── Missing Imports ──
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

  // ── Unresolved Calls ──
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

  // ── Final verdict ──
  if (summary.healthy) {
    console.log(`${GREEN}${BOLD}✅  Codebase looks healthy — no issues detected.${RESET}\n`);
  } else {
    const breakdown = [
      summary.parseErrors     > 0 ? `${RED}${summary.parseErrors} parse error(s)${RESET}`         : null,
      summary.syntaxErrors    > 0 ? `${RED}${summary.syntaxErrors} syntax error(s)${RESET}`        : null,
      summary.missingImports  > 0 ? `${YELLOW}${summary.missingImports} missing import(s)${RESET}` : null,
      summary.unresolvedCalls > 0 ? `${CYAN}${summary.unresolvedCalls} unresolved call(s)${RESET}` : null,
    ].filter(Boolean).join(', ');
    console.log(`${BOLD}Report: ${breakdown}${RESET}\n`);
  }
}

module.exports = { runDoctor, printReport };