// src/verifier.js
const { buildContext } = require('./context-builder');
const { generateQuestions } = require('./interrogator');

async function verifyTask(pgStore, repositoryId, commitId, taskDescription) {
  const context = await buildContext(pgStore, repositoryId, commitId);
  const questions = await generateQuestions(taskDescription, context);
  
  // Format the prompt (logging it for debugging/verification purposes)
  const prompt = `
Task: ${taskDescription}

Graph Evidence:
${JSON.stringify(context, null, 2)}

Evaluate if the task was completed based on the changed nodes and their downstream impact.
Return strictly in JSON schema: { "task_completed": boolean, "confidence": number, "risks": string[], "missing_requirements": string[], "questions": string[] }
  `.trim();

  // Mocking the actual LLM call for now
  return {
    task_completed: true,
    confidence: 0.9,
    risks: [],
    missing_requirements: [],
    questions
  };
}

module.exports = { verifyTask };
