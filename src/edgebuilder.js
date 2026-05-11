const { EdgeEntity } = require('./entities');

/**
 * buildEdges - Entry point for graph edge construction.
 * Scans all file data and builds normalized edges of various types.
 */
function buildEdges(files) {
  const edges = [];
  
  // Build lookup index for symbols by ID and by name
  const symbolIndex = new Map(); // id -> symbol
  const nameToIndex = new Map(); // name -> symbol array
  
  files.forEach(f => {
    (f.symbols || []).forEach(s => {
      symbolIndex.set(s.id, { file: f.file || f.path, symbol: s });
      if (!nameToIndex.has(s.name)) nameToIndex.set(s.name, []);
      nameToIndex.get(s.name).push({ file: f.file || f.path, symbol: s });
    });
  });

  // 1. Build CALLS edges
  edges.push(...buildCallEdges(files, nameToIndex));

  // 2. Build IMPORTS edges
  edges.push(...buildImportEdges(files));

  // 3. Build INHERITS and IMPLEMENTS edges (from symbol ontology)
  edges.push(...buildOntologyEdges(files, nameToIndex));

  // 4. Build USES and REFERENCES edges (placeholders for now, or rudimentary logic)
  edges.push(...buildReferenceEdges(files, nameToIndex));

  return edges;
}

function buildCallEdges(files, nameToIndex) {
  const edges = [];
  files.forEach(f => {
    (f.symbols || []).forEach(s => {
      if (!s.calls) return;
      s.calls.forEach(calleeName => {
        const targets = nameToIndex.get(calleeName) || [];
        targets.forEach(target => {
          if (target.symbol.id === s.id) return;
          edges.push(new EdgeEntity({
            from: s.id,
            to: target.symbol.id,
            type: 'CALLS'
          }));
        });
      });
    });
  });
  return edges;
}

function buildImportEdges(files) {
  const edges = [];
  // Currently FileEntity has 'imports' as a flat string array.
  // Full resolution to another FileEntity or SymbolEntity belongs in Phase 1.
  // For Phase 0.3, we represent the extraction.
  files.forEach(f => {
    (f.imports || []).forEach(imp => {
      // In a real system, we'd resolve 'imp' to a file path.
      // For now, we record the intent.
      edges.push(new EdgeEntity({
        from: f.file || f.path,
        to: imp,
        type: 'IMPORTS',
        confidence: 0.5 // Unresolved import
      }));
    });
  });
  return edges;
}

function buildOntologyEdges(files, nameToIndex) {
  const edges = [];
  files.forEach(f => {
    (f.symbols || []).forEach(s => {
      if (!s.ontology) return;
      s.ontology.forEach(rel => {
        // Expected format: { type: 'INHERITS', target: 'BaseClassName' }
        if (['INHERITS', 'IMPLEMENTS'].includes(rel.type)) {
          const targets = nameToIndex.get(rel.target) || [];
          targets.forEach(target => {
            edges.push(new EdgeEntity({
              from: s.id,
              to: target.symbol.id,
              type: rel.type
            }));
          });
        }
      });
    });
  });
  return edges;
}

function buildReferenceEdges(files, nameToIndex) {
  // USES and REFERENCES are often for variables or types.
  // ROUTES_TO is for web framework routing.
  // These will be deeply implemented in Phase 1 and 6.
  return [];
}

module.exports = { buildEdges, buildCallEdges };
