// Given an array of file records {file, symbols, ...}, produce an edges array, and fill out called_by.
// Only for function nodes (type: function or class)

function buildCallEdges(files) {
  // Build node lookup by function name (optionally include file for namespacing later)
  const nameToNodes = new Map();
  files.forEach(f => {
    (f.symbols || []).forEach(s => {
      if (!s.name) return;
      if (!nameToNodes.has(s.name)) nameToNodes.set(s.name, []);
      nameToNodes.get(s.name).push({ file: f.file, symbol: s });
    });
  });
  const edges = [];
  files.forEach(f => {
    (f.symbols || []).forEach(s => {
      if (!s.calls) return;
      s.called_by = [];
      for (const callee of s.calls) {
        // Find matching nodes (prefer same file if ambiguous)
        const targets = nameToNodes.get(callee) || [];
        if (targets.length === 0) continue;
        // Best effort: link to all matches
        targets.forEach(target => {
          if (target.symbol === s) return; // no self-loop
          edges.push({
            from: `${f.file}::${s.name}`,
            to: `${target.file}::${target.symbol.name}`,
            type: 'CALLS'
          });
          // Mark reverse edge
          if (!target.symbol.called_by) target.symbol.called_by = [];
          target.symbol.called_by.push(`${f.file}::${s.name}`);
        });
      }
    });
  });
  return edges;
}

module.exports = { buildCallEdges };
