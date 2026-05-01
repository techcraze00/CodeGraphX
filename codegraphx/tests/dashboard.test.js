const { getHtml } = require('../src/dashboard');

describe('Dashboard Generator', () => {
  test('returns html string containing graph data and stats', () => {
    const graphDataStr = JSON.stringify({ nodes: [], links: [] });
    const filesCount = 10;
    const symbolsCount = 42;
    
    const html = getHtml(graphDataStr, filesCount, symbolsCount);
    
    expect(html).toContain('<title>CodeGraphX');
    expect(html).toContain('Files: 10');
    expect(html).toContain('Total symbols: 42');
    expect(html).toContain('let graphData = {"nodes":[],"links":[]};');
    expect(html).toContain('d3.forceSimulation()');
    expect(html).toContain("new WebSocket('ws://localhost:6789')");
  });
});
