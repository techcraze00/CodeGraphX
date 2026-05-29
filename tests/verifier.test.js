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
});
