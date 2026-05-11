const PythonAdapter = require('./python');
const JavaScriptAdapter = require('./javascript');
const TypeScriptAdapter = require('./typescript');
const HTMLAdapter = require('./html');
const CSSAdapter = require('./css');

const ADAPTERS = {
  '.py':   { class: PythonAdapter,     type: 'python' },
  '.js':   { class: JavaScriptAdapter, type: 'javascript' },
  '.jsx':  { class: JavaScriptAdapter, type: 'jsx' },
  '.ts':   { class: TypeScriptAdapter, type: 'typescript' },
  '.tsx':  { class: TypeScriptAdapter, type: 'tsx' },
  '.html': { class: HTMLAdapter,       type: 'html' },
  '.css':  { class: CSSAdapter,        type: 'css' },
};

function getAdapterForFile(file) {
  const ext = file.slice(file.lastIndexOf('.')).toLowerCase();
  const entry = ADAPTERS[ext] || ADAPTERS['.py'];
  return {
    adapter: new entry.class(),
    type: entry.type
  };
}

module.exports = { getAdapterForFile, ADAPTERS };