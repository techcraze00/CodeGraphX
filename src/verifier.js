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

module.exports = { getVerificationEvidence };
