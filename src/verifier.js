// src/verifier.js
const { buildContext } = require('./context-builder');
const { generateQuestions } = require('./interrogator');
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function verifyTask(pgStore, repositoryId, commitId, taskDescription) {
  const context = await buildContext(pgStore, repositoryId, commitId);
  const heuristicQuestions = await generateQuestions(taskDescription, context);
  
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set in environment variables.");
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  
  // Use Gemini 1.5 Pro as requested
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-pro",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          task_completed: { type: "boolean" },
          confidence: { type: "number" },
          risks: { 
            type: "array",
            items: { type: "string" }
          },
          missing_requirements: { 
            type: "array",
            items: { type: "string" }
          },
          questions: { 
            type: "array",
            items: { type: "string" }
          }
        },
        required: ["task_completed", "confidence", "risks", "missing_requirements", "questions"]
      },
    },
  });

  const prompt = `
Task Description:
${taskDescription}

Graph Evidence (AST Changes and Blast Radius):
${JSON.stringify(context, null, 2)}

Evaluate if the task was completed based on the changed nodes and their downstream impact.
Identify any risks, missing requirements, or further questions to verify correctness.
`.trim();

  const result = await model.generateContent(prompt);
  const response = result.response;
  const text = response.text();
  const llmResult = JSON.parse(text);

  // Merge heuristic questions with LLM-generated questions
  const allQuestions = [...new Set([...heuristicQuestions, ...(llmResult.questions || [])])];

  return {
    task_completed: llmResult.task_completed,
    confidence: llmResult.confidence,
    risks: llmResult.risks || [],
    missing_requirements: llmResult.missing_requirements || [],
    questions: allQuestions
  };
}

module.exports = { verifyTask };
