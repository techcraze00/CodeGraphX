const { getHtml } = require('../src/dashboard');

describe('Dashboard Generator', () => {
  test('returns html string containing graph data and stats', () => {
    const graphDataStr = JSON.stringify({ 
      nodes: [
        { id: "test.js", type: "file" },
        { id: "test.js::func", type: "function", file: "test.js" }
      ], 
      links: [
        { source: "test.js", target: "test.js::func", type: "DEFINED_IN" }
      ] 
    });
    const filesCount = 10;
    const symbolsCount = 42;
    
    const html = getHtml(graphDataStr, filesCount, symbolsCount);
    
    expect(html).toContain('<title>CodeGraphX');
    expect(html).toContain('<span class="val" id="s-files">10</span>');
    expect(html).toContain('<span class="val" id="s-syms">42</span>');
    expect(html).toContain('let G = {"nodes":[{"id":"test.js","type":"file"},{"id":"test.js::func","type":"function","file":"test.js"}],"links":[{"source":"test.js","target":"test.js::func","type":"DEFINED_IN"}]}');
    expect(html).toContain('d3.forceSimulation(G.nodes)');
    expect(html).toContain("new WebSocket('ws://localhost:6789')");
  });
});
