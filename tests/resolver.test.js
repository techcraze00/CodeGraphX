const { resolveImport } = require('../src/resolver');
const path = require('path');

describe('resolveImport', () => {
  const allFiles = [
    'src/main.js',
    'src/utils.js',
    'src/store/index.js',
    'src/store/db.js',
    'src/parser/ts.test.js'
  ];

  test('resolves relative import with extension', () => {
    const importer = 'src/main.js';
    const importStr = './utils.js';
    expect(resolveImport(importer, importStr, allFiles, '/')).toBe('src/utils.js');
  });

  test('resolves relative import without extension', () => {
    const importer = 'src/main.js';
    const importStr = './utils';
    expect(resolveImport(importer, importStr, allFiles, '/')).toBe('src/utils.js');
  });

  test('resolves relative import to index.js', () => {
    const importer = 'src/main.js';
    const importStr = './store';
    expect(resolveImport(importer, importStr, allFiles, '/')).toBe('src/store/index.js');
  });

  test('resolves relative import with parent directory', () => {
    const importer = 'src/store/db.js';
    const importStr = '../utils';
    expect(resolveImport(importer, importStr, allFiles, '/')).toBe('src/utils.js');
  });

  test('resolves package-style import using basename heuristic', () => {
    const importer = 'src/main.js';
    const importStr = 'db'; // matches src/store/db.js
    expect(resolveImport(importer, importStr, allFiles, '/')).toBe('src/store/db.js');
  });

  test('returns null for unresolvable import', () => {
    const importer = 'src/main.js';
    const importStr = './missing';
    expect(resolveImport(importer, importStr, allFiles, '/')).toBeNull();
  });
});

// Doctor import/call analysis. Lives here (not a standalone *.test.js) because
// it is pure-logic and adding another native-parsing-adjacent suite file
// perturbs jest's worker packing and surfaces tree-sitter 0.21's empty-parse
// corruption in sibling suites. We hand-build the FileEntity.toJSON() shape so
// no Tree-sitter parsing happens here.
const { runDoctor } = require('../src/doctor');

const dfile = (f, { imports = [], symbols = [], parseError } = {}) => ({
  file: f, path: f, symbols, imports, syntaxErrors: [], parseError,
});
const dimp = (source, localName = source) => ({ source, localName, importedName: localName });

describe('runDoctor', () => {
  const root = '/proj';

  test('resolves Python package-relative imports (no false missing imports)', () => {
    const files = [
      dfile('accounts/views.py', {
        imports: [dimp('.models', 'Project'), dimp('datetime', 'timedelta'), dimp('django.db.models', 'Q')],
        symbols: [{ name: 'V', calls: ['self.run_query', 'Q'] }],
      }),
      dfile('accounts/models.py', { symbols: [{ name: 'Project', calls: [] }] }),
      dfile('voice_agent/consumers.py', {
        imports: [dimp('.', 'gemini_service'), dimp('.gemini_service', 'G')],
      }),
      dfile('voice_agent/gemini_service.py', { symbols: [{ name: 'G', calls: [] }] }),
    ];
    expect(runDoctor(files, root).issues.missingImports).toEqual([]);
  });

  test('resolves a parent-package relative import (..pkg.mod)', () => {
    const files = [
      dfile('voice_agent/consumers.py', { imports: [dimp('..accounts.models', 'Project')] }),
      dfile('accounts/models.py', { symbols: [{ name: 'Project', calls: [] }] }),
    ];
    expect(runDoctor(files, root).issues.missingImports).toEqual([]);
  });

  test('flags a genuinely missing relative import', () => {
    const files = [dfile('pkg/a.py', { imports: [dimp('.nonexistent', 'Thing')] })];
    const missing = runDoctor(files, root).issues.missingImports.map(m => m.import);
    expect(missing).toContain('.nonexistent');
  });

  test('does not flag builtins, imports, self/super, or parser noise as unresolved calls', () => {
    const files = [
      dfile('m.py', {
        imports: [dimp('datetime', 'timedelta')],
        symbols: [{
          name: 'f',
          calls: ['super', 'print', 'len', 'self.helper', 'timedelta', "comment['author']", "input(\"x\")"],
        }],
      }),
    ];
    const callees = runDoctor(files, root).issues.unresolvedCalls.map(c => c.callee);
    for (const noise of ['super', 'print', 'len', 'self.helper', 'timedelta', "comment['author']", "input(\"x\")"]) {
      expect(callees).not.toContain(noise);
    }
  });
});