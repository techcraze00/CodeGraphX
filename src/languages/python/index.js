const Parser = require('tree-sitter');
const Python = require('tree-sitter-python');
const BaseAdapter = require('../base-adapter');

class PythonAdapter extends BaseAdapter {
  constructor() {
    super();
    this.parser = new Parser();
    this.parser.setLanguage(Python);
  }

  parse(contents) {
    return this.parser.parse(contents);
  }

  extractSymbols(tree, contents) {
    const results = [];
    if (!tree || !tree.rootNode) return results;
    let stack = [tree.rootNode];
    while (stack.length) {
      const node = stack.pop();
      if (!node) continue;
      
      // Handle decorated definitions (e.g., @app.get)
      if (node.type === "decorated_definition") {
        let decorators = [];
        let definition = null;
        for (let i = 0; i < node.namedChildCount; i++) {
          const child = node.namedChild(i);
          if (child.type === "decorator") decorators.push(child.text);
          else if (["class_definition", "function_definition"].includes(child.type)) definition = child;
        }
        
        if (definition) {
          const calls = this.extractCalls(definition, contents);
          let ontology = [];
          // Basic ontology tagging based on decorators
          if (decorators.some(d => d.includes('.get') || d.includes('.post') || d.includes('.route') || d.includes('router.'))) {
            ontology.push('endpoint', 'http');
          }
          
          results.push({
            type: definition.type.replace("_definition", ""),
            name: definition.childForFieldName("name")?.text,
            startPosition: definition.startPosition,
            calls,
            decorators,
            ontology
          });
        }
      } else if (["class_definition", "function_definition"].includes(node.type)) {
        const calls = this.extractCalls(node, contents);
        results.push({
          type: node.type.replace("_definition", ""),
          name: node.childForFieldName("name")?.text,
          startPosition: node.startPosition,
          calls,
          decorators: [],
          ontology: []
        });
      }

      for (let i = node.namedChildCount - 1; i >= 0; i--) {
        stack.push(node.namedChild(i));
      }
    }
    return results;
  }

  extractImports(tree, contents) {
    const results = [];
    let stack = [tree.rootNode];
    while (stack.length) {
      const node = stack.pop();
      if (node.type === "import_statement") {
        for (let i = 0; i < node.namedChildCount; i++) {
          const child = node.namedChild(i);
          if (child.type === "dotted_name") {
            results.push(child.text);
          }
        }
      }
      if (node.type === "import_from_statement") {
        const mod = node.childForFieldName("module");
        if (mod) results.push(mod.text);
      }
      for (let i = node.namedChildCount - 1; i >= 0; i--) {
        stack.push(node.namedChild(i));
      }
    }
    return results;
  }

  extractCalls(fnNode, contents) {
    const calls = [];
    let stack = [fnNode];
    while (stack.length) {
      const node = stack.pop();
      if (node.type === "call") {
        let name = "";
        if (node.namedChildCount > 0) {
          const callTarget = node.namedChild(0);
          if (callTarget.type === "identifier" || callTarget.type === "dotted_name") {
            name = callTarget.text;
          } else if (callTarget.childForFieldName("name")) {
            name = callTarget.childForFieldName("name").text;
          }
        }
        if (name) calls.push(name);
      }
      for (let i = node.namedChildCount - 1; i >= 0; i--) {
        stack.push(node.namedChild(i));
      }
    }
    return Array.from(new Set(calls));
  }
}

module.exports = PythonAdapter;