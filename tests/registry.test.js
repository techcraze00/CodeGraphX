const SymbolRegistry = require('../src/registry');

test('SymbolRegistry stores and retrieves symbols', () => {
  const registry = new SymbolRegistry();
  
  registry.registerSymbol({
    symbol_id: 'file.js::myFunc',
    name: 'myFunc',
    kind: 'function',
    file: 'file.js',
    exported: true,
    language: 'javascript'
  });

  const sym = registry.getSymbolById('file.js::myFunc');
  expect(sym.name).toBe('myFunc');

  const exports = registry.getExportsByFile('file.js');
  expect(exports[0].name).toBe('myFunc');
});
