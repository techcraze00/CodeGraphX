const PythonAdapter = require('./python');
const JavaScriptAdapter = require('./javascript');
const TypeScriptAdapter = require('./typescript');
const HTMLAdapter = require('./html');
const CSSAdapter = require('./css');

const ADAPTERS = {
  '.py':   { adapter: new PythonAdapter(),     type: 'python' },
  '.js':   { adapter: new JavaScriptAdapter(), type: 'javascript' },
  '.jsx':  { adapter: new JavaScriptAdapter(), type: 'jsx' },
  '.ts':   { adapter: new TypeScriptAdapter(), type: 'typescript' },
  '.tsx':  { adapter: new TypeScriptAdapter(), type: 'tsx' },
  '.html': { adapter: new HTMLAdapter(),       type: 'html' },
  '.css':  { adapter: new CSSAdapter(),        type: 'css' },
};

function getAdapterForFile(file) {
  const ext = file.slice(file.lastIndexOf('.')).toLowerCase();
  return ADAPTERS[ext] || ADAPTERS['.py'];
}

module.exports = { getAdapterForFile, ADAPTERS };