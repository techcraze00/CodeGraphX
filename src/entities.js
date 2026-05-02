const { parseFile } = require('./parser');
const { extractPython, extractJS, extractTS, extractHTML, extractCSS } = require('./graph');

// Top-level extractor that delegates by language
function extractEntities(file, contents) {
  const { tree, type } = parseFile(file, contents);
  switch (type) {
    case 'python': return extractPython(tree, contents);
    case 'javascript':
    case 'jsx': return extractJS(tree, contents);
    case 'typescript':
    case 'tsx': return extractTS(tree, contents);
    case 'html': return extractHTML(tree, contents);
    case 'css': return extractCSS(tree, contents);
    default: return { symbols: [], imports: [], functions: [], classes: [] };
  }
}

module.exports = { extractEntities };
