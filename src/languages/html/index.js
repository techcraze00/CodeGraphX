const Parser = require('tree-sitter');
const HTML = require('tree-sitter-html');
const BaseAdapter = require('../base-adapter');

class HTMLAdapter extends BaseAdapter {
  constructor() {
    super();
    this.parser = new Parser();
    this.parser.setLanguage(HTML);
  }

  parse(contents) {
    return this.safeParse(this.parser, contents);
  }

  extractSymbols(tree, contents) {
    let symbols = [];
    let stack = [tree.rootNode];
    while (stack.length) {
      const node = stack.pop();
      if (!node) continue;
      if (node.type === "element") {
        symbols.push({ 
          type: "element", 
          tag: node.childForFieldName("name")?.text, 
          startPosition: node.startPosition 
        });
      }
      for (let i = node.childCount - 1; i >= 0; i--) stack.push(node.child(i));
    }
    return symbols;
  }

  extractImports(tree, contents) {
    return [];
  }

  extractCalls(tree, contents) {
    return [];
  }
}

module.exports = HTMLAdapter;