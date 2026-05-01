// Multi-language parser router for CodeGraphX
const Parser = require('tree-sitter');
const Python = require('tree-sitter-python');
const JavaScript = require('tree-sitter-javascript');
const TypeScript = require('tree-sitter-typescript').typescript;
const HTML = require('tree-sitter-html');
// const CSS = require('tree-sitter-css'); // Temporarily disabled due to ESM-compatibility issues

const EXT_LANG = {
  '.py':   {lang: Python,    type: 'python'},
  '.js':   {lang: JavaScript, type: 'javascript'},
  '.jsx':  {lang: JavaScript, type: 'jsx'},
  '.ts':   {lang: TypeScript, type: 'typescript'},
  '.tsx':  {lang: TypeScript, type: 'tsx'},
  '.html': {lang: HTML,       type: 'html'},
  
};

function detectLanguage(file) {
  const ext = file.slice(file.lastIndexOf('.'));
  return EXT_LANG[ext.toLowerCase()] || EXT_LANG['.py']; // fallback for legacy
}

function parseFile(file, contents) {
  const { lang, type } = detectLanguage(file);
  const parser = new Parser();
  parser.setLanguage(lang);
  const tree = parser.parse(contents);
  return { tree, type };
}

module.exports = { parseFile, detectLanguage };
