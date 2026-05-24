// tests/verifier.test.js
const { verifyTask } = require('../src/verifier');

// Mock buildContext
jest.mock('../src/context-builder', () => ({
  buildContext: jest.fn().mockResolvedValue({
    changed_nodes: { added: [], modified: [], removed: [] },
    blast_radius: { downstream: [] }
  })
}));

// Mock generateQuestions
jest.mock('../src/interrogator', () => ({
  generateQuestions: jest.fn().mockResolvedValue(["Mocked question?"])
}));

describe('Task Verifier', () => {
  it('should format a verification prompt and return mock JSON result including questions', async () => {
    const mockPgStore = {};
    const result = await verifyTask(mockPgStore, 100, 200, "Add startServer function");

    expect(result).toEqual({
      task_completed: true,
      confidence: 0.9,
      risks: [],
      missing_requirements: [],
      questions: ["Mocked question?"]
    });
  });
});
