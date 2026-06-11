// src/verifier.js
const { buildContext } = require('./context-builder');
const { generateQuestions } = require('./interrogator');

async function getVerificationEvidence(pgStore, repositoryId, commitId, taskDescription) {
  const context = await buildContext(pgStore, repositoryId, commitId);
  const questions = await generateQuestions(taskDescription, context);
  
  return {
    taskDescription,
    graphEvidence: context,
    heuristicQuestions: questions
  };
}

async function buildTaskVerification(taskDesc, commitHash, pgStore, repositoryId) {
  // 1. Get commit ID from hash if needed
  let commitId;
  if (commitHash === 'HEAD') {
    const latest = await pgStore.db.selectFrom('commits')
      .select('id')
      .where('repository_id', '=', repositoryId)
      .orderBy('timestamp', 'desc')
      .limit(1)
      .executeTakeFirst();
    commitId = latest?.id;
  } else {
    const commit = await pgStore.db.selectFrom('commits')
      .select('id')
      .where('hash', '=', commitHash)
      .where('repository_id', '=', repositoryId)
      .executeTakeFirst();
    commitId = commit?.id;
  }
  
  if (!commitId) {
    throw new Error(`Commit not found: ${commitHash}`);
  }

  // 2. Get changes for commit
  const rawChanges = await pgStore.getChangesInCommit(repositoryId, commitId);
  
  // 3. Map to clean, flat JSON
  const changes = [];
  let hasTests = false;

  const processSymbols = (symbols, status) => {
    for (const s of symbols) {
      if (s.path.toLowerCase().includes('test')) hasTests = true;
      changes.push({
        file: s.path,
        symbol: s.name,
        status: status
      });
    }
  };

  processSymbols(rawChanges.added, 'added');
  processSymbols(rawChanges.modified, 'modified');
  processSymbols(rawChanges.removed, 'removed');

  return {
    status: changes.length > 0 ? "complete" : "incomplete",
    changes: changes,
    untested_additions: !hasTests && (rawChanges.added.length > 0 || rawChanges.modified.length > 0)
  };
}

module.exports = { getVerificationEvidence, buildTaskVerification };
