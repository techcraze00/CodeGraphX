// tests/verifier.test.js
const { verifyTask } = require('../src/verifier');

describe('Task Verifier', () => {
  it('should format a verification prompt and return mock JSON result', async () => {
    const mockPgStore = {
      getChangesInCommit: jest.fn().mockResolvedValue({
        added: [{ id: 1, qualified_name: 'src/app.js:startServer', kind: 'function' }],
        modified: [],
        removed: []
      }),
      traceImpact: jest.fn().mockResolvedValue([])
    };

    const result = await verifyTask(mockPgStore, 100, 200, "Add startServer function");

    expect(result).toEqual({
      task_completed: true,
      confidence: 0.9,
      risks: [],
      missing_requirements: []
    });
  });
});
