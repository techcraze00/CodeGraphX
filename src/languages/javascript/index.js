const Parser = require('tree-sitter');
const JavaScript = require('tree-sitter-javascript');
const BaseAdapter = require('../base-adapter');

class JavaScriptAdapter extends BaseAdapter {
  constructor() {
    super();
    this.parser = new Parser();
    this.parser.setLanguage(JavaScript);
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

      if (node.type === "function_declaration") {
        const nameNode = node.childForFieldName("name");
        symbols.push({
          type: "function",
          name: nameNode ? nameNode.text : "anonymous",
          startPosition: node.startPosition,
          calls: this.extractCalls(node, contents),
          ontology: []
        });
      } else if (node.type === "class_declaration") {
        const nameNode = node.childForFieldName("name");
        symbols.push({
          type: "class",
          name: nameNode ? nameNode.text : "anonymous",
          startPosition: node.startPosition,
          calls: this.extractCalls(node, contents),
          ontology: []
        });
      }

      for (let i = node.childCount - 1; i >= 0; i--) {
        stack.push(node.child(i));
      }
    }
    return symbols;
  }

  extractImports(tree, contents) {
    let imports = [];
    if (!tree || !tree.rootNode) return imports;
    let stack = [tree.rootNode];
    while (stack.length) {
      const node = stack.pop();
      if (!node) continue;

      if (node.type === "import_statement") {
        for (let i = 0; i < node.childCount; i++) {
          const child = node.child(i);
          if (child && (child.type === "string" || child.type === "identifier")) {
            imports.push(child.text);
          }
        }
      }

      for (let i = node.childCount - 1; i >= 0; i--) {
        stack.push(node.child(i));
      }
    }
    return imports;
  }

  extractCalls(fnNode, contents) {
    const calls = [];
    let stack = [fnNode];
    while (stack.length) {
      const node = stack.pop();
      if (!node) continue;

      if (node.type === "call_expression") {
        let funcNode = node.childForFieldName("function") || node.child(0);
        if (funcNode) {
          if (funcNode.type === "identifier") {
            calls.push(funcNode.text);
          } else if (funcNode.type === "member_expression") {
            const prop = funcNode.childForFieldName("property") || funcNode.child(funcNode.childCount - 1);
            if (prop && (prop.type === "property_identifier" || prop.type === "identifier")) {
              calls.push(prop.text);
            }
          }
        }
      }

      for (let i = node.childCount - 1; i >= 0; i--) {
        stack.push(node.child(i));
      }
    }
    return Array.from(new Set(calls));
  }
}

module.exports = JavaScriptAdapter;