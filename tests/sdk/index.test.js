const { IntelligenceSDK } = require('../../src/sdk/index');
const { PostgresGraphStore } = require('../../src/store/postgres-store');
const { verifyTask } = require('../../src/verifier');
const { scanCommit } = require('../../src/git/commit-scanner');

jest.mock('../../src/store/postgres-store');
jest.mock('../../src/verifier');
jest.mock('../../src/git/commit-scanner');

describe('IntelligenceSDK', () => {
  let sdk;
  const dbUri = 'postgresql://postgres:postgres@localhost:5432/testdb';

  beforeEach(() => {
    jest.clearAllMocks();
    sdk = new IntelligenceSDK({ dbUri });
  });

  afterEach(async () => {
    if (sdk) {
      await sdk.destroy();
    }
  });

  test('verifyTask delegates to verifier.verifyTask', async () => {
    const repositoryId = 1;
    const commitId = 10;
    const taskDescription = 'Fix bug in auth';
    const mockResult = { task_completed: true };

    verifyTask.mockResolvedValue(mockResult);

    const result = await sdk.verifyTask(repositoryId, commitId, taskDescription);

    expect(verifyTask).toHaveBeenCalledWith(
      expect.any(PostgresGraphStore),
      repositoryId,
      commitId,
      taskDescription
    );
    expect(result).toEqual(mockResult);
  });

  test('scanCommit delegates to commit-scanner.scanCommit', async () => {
    const projectRoot = '/path/to/project';
    const repositoryId = 1;
    const branch = 'feat-branch';
    const mockResult = { hash: 'abc' };

    scanCommit.mockResolvedValue(mockResult);

    const result = await sdk.scanCommit(projectRoot, repositoryId, branch);

    expect(scanCommit).toHaveBeenCalledWith(
      projectRoot,
      expect.any(PostgresGraphStore),
      repositoryId,
      branch
    );
    expect(result).toEqual(mockResult);
  });

  test('traceImpact delegates to pgStore.traceImpact', async () => {
    const repositoryId = 1;
    const symbolId = 100;
    const direction = 'upstream';
    const depth = 3;
    const mockResult = [{ id: 200 }];

    sdk.pgStore.traceImpact.mockResolvedValue(mockResult);

    const result = await sdk.traceImpact(repositoryId, symbolId, direction, depth);

    expect(sdk.pgStore.traceImpact).toHaveBeenCalledWith(
      repositoryId,
      symbolId,
      direction,
      depth
    );
    expect(result).toEqual(mockResult);
  });
});
