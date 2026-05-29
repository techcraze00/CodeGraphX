const { IntelligenceSDK } = require('../../src/sdk/index');
const { SqlGraphStore } = require('../../src/store/sql-store');
const { getVerificationEvidence } = require('../../src/verifier');
const { scanCommit } = require('../../src/git/commit-scanner');

jest.mock('../../src/store/sql-store');
jest.mock('../../src/verifier');
jest.mock('../../src/git/commit-scanner');

describe('IntelligenceSDK', () => {
  let sdk;
  const dbUri = ':memory:';

  beforeEach(() => {
    jest.clearAllMocks();
    sdk = new IntelligenceSDK({ dbUri });
  });

  afterEach(async () => {
    if (sdk) {
      await sdk.destroy();
    }
  });

  test('getVerificationEvidence delegates to verifier.getVerificationEvidence', async () => {
    const repositoryId = 1;
    const commitId = 10;
    const taskDescription = 'Fix bug in auth';
    const mockResult = { taskDescription };

    getVerificationEvidence.mockResolvedValue(mockResult);

    const result = await sdk.getVerificationEvidence(repositoryId, commitId, taskDescription);

    expect(getVerificationEvidence).toHaveBeenCalledWith(
      expect.any(SqlGraphStore),
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
      expect.any(SqlGraphStore),
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

    sdk.sqlStore.traceImpact.mockResolvedValue(mockResult);

    const result = await sdk.traceImpact(repositoryId, symbolId, direction, depth);

    expect(sdk.sqlStore.traceImpact).toHaveBeenCalledWith(
      repositoryId,
      symbolId,
      direction,
      depth
    );
    expect(result).toEqual(mockResult);
  });
});
