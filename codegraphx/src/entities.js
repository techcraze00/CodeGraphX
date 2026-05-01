const { parseFile } = require('./parser');
const { extractPython, extractJS, extractTS, extractHTML } = require('./graph');
// (CSS stub inline to avoid circular deps)

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
    case 'css': return { symbols: [], imports: [] }; // CSS temporarily disabled for CJS compatibility
    default: return { symbols: [], imports: [], functions: [], classes: [] };
  }
}

module.exports = { extractEntities };
