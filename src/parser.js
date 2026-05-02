const Parser = require('tree-sitter');
const Python = require('tree-sitter-python');
const JavaScript = require('tree-sitter-javascript');
const TypeScript = require('tree-sitter-typescript').typescript;
const HTML = require('tree-sitter-html');
const CSS = require('tree-sitter-css');

const EXT_LANG = {
  '.py':   { lang: Python,     type: 'python' },
  '.js':   { lang: JavaScript, type: 'javascript' },
  '.jsx':  { lang: JavaScript, type: 'jsx' },
  '.ts':   { lang: TypeScript, type: 'typescript' },
  '.tsx':  { lang: TypeScript, type: 'tsx' },
  '.html': { lang: HTML,       type: 'html' },
  '.css':  { lang: CSS,        type: 'css' },
};

// Singleton parsers — one per language, created once, reused forever
const parsers = new Map();

function getParser(lang) {
  if (!parsers.has(lang)) {
    const p = new Parser();
    p.setLanguage(lang);
    parsers.set(lang, p);
  }
  return parsers.get(lang);
}

function detectLanguage(file) {
  const ext = file.slice(file.lastIndexOf('.')).toLowerCase();
  return EXT_LANG[ext] || EXT_LANG['.py'];
}

function parseFile(file, contents) {
  const { lang, type } = detectLanguage(file);
  
  try {
    const parser = getParser(lang);
    const tree = parser.parse(contents);
    return { tree, type };
  } catch (e) {
    // Return null tree on parse failure so caller can handle gracefully
    return { tree: null, type, error: e.message };
  }
}

module.exports = { parseFile, detectLanguage };