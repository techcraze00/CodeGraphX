const { extractCSS } = require('../../src/graph');
const Parser = require('web-tree-sitter');
const path = require('path');

describe('extractCSS', () => {
  test('extracts class and id selectors', async () => {
    await Parser.init();
    const wasmPath = path.join(path.dirname(require.resolve('tree-sitter-wasms/package.json')), 'out', 'tree-sitter-css.wasm');
    const CSS = await Parser.Language.load(wasmPath);
    
    const parser = new Parser();
    parser.setLanguage(CSS);
    
    const contents = `
      .header-title { font-size: 12px; }
      #main-content { background: red; }
      div.container { padding: 10px; }
    `;
    const tree = parser.parse(contents);
    
    const result = extractCSS(tree, contents);
    
    const symbols = result.symbols.map(s => s.name);
    
    expect(symbols).toContain('.header-title');
    expect(symbols).toContain('#main-content');
    expect(symbols).toContain('.container');
  });
});
