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