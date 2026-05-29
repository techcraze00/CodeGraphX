// tests/verifier.test.js
const { verifyTask } = require('../src/verifier');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Mock buildContext
jest.mock('../src/context-builder', () => ({
  buildContext: jest.fn().mockResolvedValue({
    changed_nodes: { added: [], modified: [], removed: [] },
    blast_radius: { downstream: [] }
  })
}));

// Mock generateQuestions
jest.mock('../src/interrogator', () => ({
  generateQuestions: jest.fn().mockResolvedValue(["Heuristic question?"])
}));

// Mock GoogleGenerativeAI
jest.mock("@google/generative-ai");

describe('Task Verifier', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv, GEMINI_API_KEY: 'test-key' };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should call Gemini API and return structured results', async () => {
    const mockGenerateContent = jest.fn().mockResolvedValue({
      response: {
        text: () => JSON.stringify({
          task_completed: true,
          confidence: 0.85,
          risks: ["Risk A"],
          missing_requirements: [],
          questions: ["LLM question?"]
        })
      }
    });

    const mockGetGenerativeModel = jest.fn().mockReturnValue({
      generateContent: mockGenerateContent
    });

    GoogleGenerativeAI.prototype.getGenerativeModel = mockGetGenerativeModel;

    const mockPgStore = {};
    const result = await verifyTask(mockPgStore, 100, 200, "Add startServer function");

    expect(mockGetGenerativeModel).toHaveBeenCalledWith(expect.objectContaining({
      model: "gemini-1.5-pro",
      generationConfig: expect.objectContaining({
        responseMimeType: "application/json"
      })
    }));

    expect(result.task_completed).toBe(true);
    expect(result.confidence).toBe(0.85);
    expect(result.risks).toContain("Risk A");
    expect(result.questions).toContain("Heuristic question?");
    expect(result.questions).toContain("LLM question?");
  });

  it('should throw error if GEMINI_API_KEY is missing', async () => {
    delete process.env.GEMINI_API_KEY;
    const mockPgStore = {};
    
    await expect(verifyTask(mockPgStore, 100, 200, "Some task"))
      .rejects.toThrow("GEMINI_API_KEY is not set in environment variables.");
  });
});
