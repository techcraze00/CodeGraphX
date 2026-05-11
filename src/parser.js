const { getAdapterForFile } = require('./languages');

function detectLanguage(file) {
  const { type } = getAdapterForFile(file);
  return { type };
}

function parseFile(file, contents) {
  const { adapter, type } = getAdapterForFile(file);
  
  try {
    const tree = adapter.parse(contents);
    return { tree, type };
  } catch (e) {
    return { tree: null, type, error: e.message };
  }
}

module.exports = { parseFile, detectLanguage };