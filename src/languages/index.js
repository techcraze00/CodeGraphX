const PythonAdapter = require('./python');
const JavaScriptAdapter = require('./javascript');
const TypeScriptAdapter = require('./typescript');
const HTMLAdapter = require('./html');
const CSSAdapter = require('./css');

// Build the adapter set once and cache it on globalThis. Each adapter owns a
// native Tree-sitter Parser; under Jest (which resets the module registry
// between test files) re-creating and GC-ing those parsers repeatedly corrupts
// surviving instances in tree-sitter 0.21 and yields empty parses. Caching on
// globalThis lets every module-registry instance reuse the same parsers.
function buildAdapters() {
  return {
    '.py':   { adapter: new PythonAdapter(),     type: 'python' },
    '.js':   { adapter: new JavaScriptAdapter(), type: 'javascript' },
    '.jsx':  { adapter: new JavaScriptAdapter(), type: 'jsx' },
    '.ts':   { adapter: new TypeScriptAdapter(), type: 'typescript' },
    '.tsx':  { adapter: new TypeScriptAdapter(), type: 'tsx' },
    '.html': { adapter: new HTMLAdapter(),       type: 'html' },
    '.css':  { adapter: new CSSAdapter(),        type: 'css' },
  };
}

const ADAPTERS = globalThis.__CGX_ADAPTERS__ || (globalThis.__CGX_ADAPTERS__ = buildAdapters());

function getAdapterForFile(file) {
  const ext = file.slice(file.lastIndexOf('.')).toLowerCase();
  return ADAPTERS[ext] || ADAPTERS['.py'];
}

module.exports = { getAdapterForFile, ADAPTERS };