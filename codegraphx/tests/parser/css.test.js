const { extractCSS } = require('../../src/graph');
const Parser = require('tree-sitter');
const CSS = require('tree-sitter-css');

describe('extractCSS', () => {
  test('extracts class and id selectors', () => {
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
