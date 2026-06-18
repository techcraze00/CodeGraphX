const { detectDrift } = require('../../src/sdk/drift-detector');

describe('Drift Detector', () => {
  const mockSdk = {
    traceImpact: jest.fn()
  };

  const repositoryId = 'repo-1';
  const symbolId = 'sym-1';
  const symbolName = 'src/ui/Button.js::render';
  const rules = [
    { fromLayer: 'src/ui', forbiddenTarget: 'src/db' }
  ];

  beforeEach(() => {
    mockSdk.traceImpact.mockClear();
  });

  test('detects violation when forbidden target is reached', async () => {
    // Mock traceImpact to return a symbol from src/db
    mockSdk.traceImpact.mockResolvedValue([
      { id: 'sym-2', name: 'executeQuery', path: 'src/db/connection.js' }
    ]);

    const violations = await detectDrift(mockSdk, repositoryId, symbolId, symbolName, rules);

    expect(violations).toHaveLength(1);
    expect(violations[0]).toEqual({
      symbolName,
      impactedSymbol: 'executeQuery',
      impactedPath: 'src/db/connection.js',
      rule: rules[0]
    });
  });

  test('no violation when impact is within allowed layers', async () => {
    mockSdk.traceImpact.mockResolvedValue([
      { id: 'sym-3', name: 'Theme', path: 'src/ui/theme.js' }
    ]);

    const violations = await detectDrift(mockSdk, repositoryId, symbolId, symbolName, rules);

    expect(violations).toHaveLength(0);
  });

  test('no violation if symbolName does not match fromLayer', async () => {
    const otherSymbolName = 'src/utils/logger.js::log';
    const violations = await detectDrift(mockSdk, repositoryId, symbolId, otherSymbolName, rules);

    expect(mockSdk.traceImpact).not.toHaveBeenCalled();
    expect(violations).toHaveLength(0);
  });
});
