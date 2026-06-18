// src/interrogator.js
async function generateQuestions(taskDescription, context) {
  const { changed_nodes, blast_radius } = context;
  
  // Logic to identify risks and generate questions
  const questions = [];

  if (blast_radius.downstream.length > 5) {
    questions.push("This change has a large blast radius. Have you verified that all downstream consumers are still compatible?");
  }

  if (changed_nodes.modified.some(n => n.includes('db.js') || n.includes('store.js'))) {
    questions.push("You modified a core data-access module. Did you consider the impact on database performance or transaction integrity?");
  }

  if (changed_nodes.added.length > 0 && !taskDescription.toLowerCase().includes('test')) {
    questions.push("New symbols were added but the task description doesn't mention testing. Are there accompanying unit tests for these additions?");
  }

  // Fallback generic question if none generated
  if (questions.length === 0) {
    questions.push(`Can you explain how the changes to ${changed_nodes.modified[0] || 'the codebase'} fulfill the requirement: "${taskDescription}"?`);
  }

  return questions;
}

module.exports = { generateQuestions };
