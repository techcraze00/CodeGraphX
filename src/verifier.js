// src/verifier.js
const { buildContext } = require('./context-builder');

async function verifyTask(pgStore, repositoryId, commitId, taskDescription) {
  const context = await buildContext(pgStore, repositoryId, commitId);
  
  // Format the prompt (logging it for debugging/verification purposes)
  const prompt = `
Task: ${taskDescription}

Graph Evidence:
${JSON.stringify(context, null, 2)}

Evaluate if the task was completed based on the changed nodes and their downstream impact.
Return strictly in JSON schema: { "task_completed": boolean, "confidence": number, "risks": string[], "missing_requirements": string[] }
  `.trim();

  // Mocking the actual LLM call for now
  return {
    task_completed: true,
    confidence: 0.9,
    risks: [],
    missing_requirements: []
  };
}

module.exports = { verifyTask };
