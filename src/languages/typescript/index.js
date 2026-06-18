const Parser = require('tree-sitter');
const TypeScript = require('tree-sitter-typescript').typescript;
const JavaScriptAdapter = require('../javascript');

class TypeScriptAdapter extends JavaScriptAdapter {
  constructor() {
    super();
    this.parser = new Parser();
    this.parser.setLanguage(TypeScript);
  }
}

module.exports = TypeScriptAdapter;