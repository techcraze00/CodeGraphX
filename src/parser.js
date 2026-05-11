const { getAdapterForFile } = require('./languages');

function detectLanguage(file) {
  const { type } = getAdapterForFile(file);
  return { type };
}

function parseFile(file, contents) {
  const { adapter, type } = getAdapterForFile(file);
  
  try {
    const tree = adapter.parse(contents);
    const declaredSymbols = adapter.extractSymbols(tree, contents) || [];
    const imports = adapter.extractImports(tree, contents) || [];
    
    // Aggregate calls from declared symbols AND top-level calls
    const callsSet = new Set();
    
    // Capture top-level calls (those not inside any symbol)
    const allCalls = adapter.extractCalls(tree.rootNode, contents) || [];
    allCalls.forEach(c => callsSet.add(c));
    
    declaredSymbols.forEach(sym => {
        if (sym.calls) {
            sym.calls.forEach(c => callsSet.add(c));
        }
    });

    const calls = Array.from(callsSet);

    // Mock exports for now: treat all symbols as exported to unblock MVP phase 1
    const exports = declaredSymbols.map(sym => ({ name: sym.name, symbolId: sym.name }));

    return { 
      tree, 
      type,
      exports,
      imports,
      declaredSymbols,
      calls
    };
  } catch (e) {
    return { tree: null, type, error: e.message, exports: [], imports: [], declaredSymbols: [], calls: [] };
  }
}

module.exports = { parseFile, detectLanguage };