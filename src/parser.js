// Multi-language parser router for CodeGraphX using web-tree-sitter (WASM)
const path = require('path');
const Parser = require('web-tree-sitter');

const EXT_LANG = {
  '.py':   {wasm: 'tree-sitter-python.wasm', type: 'python'},
  '.js':   {wasm: 'tree-sitter-javascript.wasm', type: 'javascript'},
  '.jsx':  {wasm: 'tree-sitter-javascript.wasm', type: 'jsx'},
  '.ts':   {wasm: 'tree-sitter-typescript.wasm', type: 'typescript'},
  '.tsx':  {wasm: 'tree-sitter-tsx.wasm', type: 'tsx'},
  '.html': {wasm: 'tree-sitter-html.wasm', type: 'html'},
  '.css':  {wasm: 'tree-sitter-css.wasm', type: 'css'},
};

function detectLanguage(file) {
  const ext = file.slice(file.lastIndexOf('.'));
  return EXT_LANG[ext.toLowerCase()] || EXT_LANG['.py']; // fallback for legacy
}

let isInitialized = false;
const loadedLanguages = {};

async function parseFile(file, contents) {
  if (!isInitialized) {
    await Parser.init();
    isInitialized = true;
  }
  
  const { wasm, type } = detectLanguage(file);
  
  if (!loadedLanguages[wasm]) {
    const wasmPath = path.join(path.dirname(require.resolve('tree-sitter-wasms/package.json')), 'out', wasm);
    loadedLanguages[wasm] = await Parser.Language.load(wasmPath);
  }
  
  const parser = new Parser();
  parser.setLanguage(loadedLanguages[wasm]);
  const tree = parser.parse(contents);
  return { tree, type };
}

module.exports = { parseFile, detectLanguage };
