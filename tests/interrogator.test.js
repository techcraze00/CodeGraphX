// tests/interrogator.test.js
const { generateQuestions } = require('../src/interrogator');

describe('Interrogation Engine', () => {
  it('should generate follow-up questions based on graph context', async () => {
    const mockContext = {
      changed_nodes: {
        added: ['src/api.js:login (function)'],
        modified: ['src/db.js:query (function)'],
        removed: []
      },
      blast_radius: {
        downstream: ['src/app.js:init (function)', 'src/server.js:start (function)']
      }
    };

    const questions = await generateQuestions("Add login endpoint", mockContext);

    expect(questions).toBeInstanceOf(Array);
    // Mock should return some default questions for now
    expect(questions.length).toBeGreaterThan(0);
    expect(questions[0]).toContain('?');
  });
});
