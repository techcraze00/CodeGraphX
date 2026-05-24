// src/context-builder.js
async function buildContext(pgStore, repositoryId, commitId) {
  const changes = await pgStore.getChangesInCommit(repositoryId, commitId);
  
  const context = {
    changed_nodes: {
      added: changes.added.map(s => `${s.qualified_name} (${s.kind})`),
      modified: changes.modified.map(s => `${s.qualified_name} (${s.kind})`),
      removed: changes.removed.map(s => `${s.qualified_name} (${s.kind})`)
    },
    blast_radius: {
      downstream: []
    }
  };

  const impactSet = new Set();
  const allChangedSymbols = [...changes.added, ...changes.modified];

  for (const sym of allChangedSymbols) {
    const impact = await pgStore.traceImpact(repositoryId, sym.id, 'downstream', 3);
    for (const impactedSym of impact) {
      impactSet.add(`${impactedSym.qualified_name} (${impactedSym.kind})`);
    }
  }

  context.blast_radius.downstream = Array.from(impactSet);

  return context;
}

module.exports = { buildContext };
