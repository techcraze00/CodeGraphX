const { EdgeEntity } = require('./entities');
const SymbolRegistry = require('./registry');
const { resolveSourceToFile } = require('./resolver');

function buildEdges(files, projectRoot) {
  const edges = [];
  const registry = new SymbolRegistry();
  const allKnownFiles = files.map(f => f.path || f.file);
  
  // 1. Register all symbols
  files.forEach(f => {
    (f.symbols || []).forEach(s => {
      registry.registerSymbol({
          symbol_id: s.id,
          name: s.name,
          kind: s.type,
          file: f.path || f.file,
          exported: true, // simplified for Phase 1
          language: 'unknown'
      });
    });
  });

  // 2. Build CALLS edges
  files.forEach(f => {
    const currentFilePath = f.path || f.file;
    (f.symbols || []).forEach(s => {
      if (!s.calls) return;
      
      s.calls.forEach(calleeName => {
        let resolvedTargetId = null;
        let confidence = 0.5;

        // Step A: Check Local Scope
        const localMatch = (f.symbols || []).find(sym => sym.name === calleeName);
        if (localMatch) {
            resolvedTargetId = localMatch.id;
            confidence = 1.0;
        }

        // Step B: Check Imports
        if (!resolvedTargetId) {
            const importMatch = (f.imports || []).find(imp => imp.localName === calleeName);
            if (importMatch) {
                const targetFile = resolveSourceToFile(currentFilePath, importMatch.source, allKnownFiles);
                if (targetFile) {
                    const fileExports = registry.getExportsByFile(targetFile);
                    let exportedSymbol = null;
                    if (importMatch.importedName === '*') {
                        // just map to first export or default for simplicity in Phase 1
                        exportedSymbol = fileExports.find(exp => exp.name === 'default') || fileExports[0];
                    } else if (importMatch.importedName === 'default') {
                        exportedSymbol = fileExports.find(exp => exp.name === 'default') || fileExports[0]; 
                    } else {
                        exportedSymbol = fileExports.find(exp => exp.name === importMatch.importedName);
                    }

                    if (exportedSymbol) {
                        resolvedTargetId = exportedSymbol.symbol_id;
                        confidence = 1.0;
                    }
                }
            }
        }

        // Step C: Fallback Heuristic
        if (!resolvedTargetId) {
            const globalMatches = registry.getSymbolsByName(calleeName);
            if (globalMatches.length > 0) {
                resolvedTargetId = globalMatches[0].symbol_id;
                confidence = 0.5;
            }
        }

        if (resolvedTargetId && resolvedTargetId !== s.id) {
            edges.push(new EdgeEntity({
                from: s.id,
                to: resolvedTargetId,
                type: 'CALLS',
                confidence
            }));
        }
      });
    });
  });

  // 3. Build rudimentary IMPORTS edges for UI/Graph compatibility
  files.forEach(f => {
    (f.imports || []).forEach(imp => {
      edges.push(new EdgeEntity({
        from: f.path || f.file,
        to: imp.source,
        type: 'IMPORTS',
        confidence: 1.0
      }));
    });
  });

  return edges;
}

module.exports = { buildEdges };
