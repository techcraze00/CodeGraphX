// tests/verifier.test.js
const { getVerificationEvidence } = require('../src/verifier');
const { buildContext } = require('../src/context-builder');
const { generateQuestions } = require('../src/interrogator');

jest.mock('../src/context-builder');
jest.mock('../src/interrogator');

describe('Task Verifier Evidence Generator', () => {
  test('getVerificationEvidence returns pure JSON evidence payload without calling LLM', async () => {
    const mockContext = { changed_nodes: {}, blast_radius: {} };
    const mockQuestions = ["Did you test this?"];
    
    buildContext.mockResolvedValue(mockContext);
    generateQuestions.mockResolvedValue(mockQuestions);
    
    const mockStore = {};
    const result = await getVerificationEvidence(mockStore, 'repo-id', 'commit-id', 'Test task');
    
    expect(result.taskDescription).toBe('Test task');
    expect(result.graphEvidence).toEqual(mockContext);
    expect(result.heuristicQuestions).toEqual(mockQuestions);
  });

  test('buildTaskVerification returns status and changes', async () => {
    const { buildTaskVerification } = require('../src/verifier');
    const mockPgStore = {
      db: {
        selectFrom: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        executeTakeFirst: jest.fn().mockResolvedValue({ id: 'c1' })
      },
      getChangesInCommit: jest.fn().mockResolvedValue({
        added: [{ path: 'src/main.js', name: 'start' }],
        modified: [],
        removed: []
      })
    };

    const result = await buildTaskVerification('test task', 'HEAD', mockPgStore, 'repo-id');
    
    expect(result.status).toBe('complete');
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0].file).toBe('src/main.js');
    expect(result.untested_additions).toBe(true); // No test files in mock
  });
});
