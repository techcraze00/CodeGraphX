const Parser = require('tree-sitter');
const CSS = require('tree-sitter-css');
const BaseAdapter = require('../base-adapter');

class CSSAdapter extends BaseAdapter {
  constructor() {
    super();
    this.parser = new Parser();
    this.parser.setLanguage(CSS);
  }

  parse(contents) {
    return this.parser.parse(contents);
  }

  extractSymbols(tree, contents) {
    let symbols = [];
    if (!tree || !tree.rootNode) return symbols;
    let stack = [tree.rootNode];
    while (stack.length) {
      const node = stack.pop();
      if (!node) continue;

      if (node.type === "class_selector") {
        let nameNode = null;
        for (let i = 0; i < node.childCount; i++) {
          const child = node.child(i);
          if (child.type === "class_name") {
            nameNode = child;
            break;
          }
        }
        if (nameNode) {
          symbols.push({ type: 'class', name: '.' + nameNode.text, startPosition: node.startPosition });
        }
      } else if (node.type === "id_selector") {
        let nameNode = null;
        for (let i = 0; i < node.childCount; i++) {
          const child = node.child(i);
          if (child.type === "id_name") {
            nameNode = child;
            break;
          }
        }
        if (nameNode) {
          symbols.push({ type: 'id', name: '#' + nameNode.text, startPosition: node.startPosition });
        }
      }

      for (let i = 0; i < node.childCount; i++) {
        stack.push(node.child(i));
      }
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

module.exports = CSSAdapter;