const Parser = require('tree-sitter');
const JavaScript = require('tree-sitter-javascript');
const BaseAdapter = require('../base-adapter');
const { extractApiContracts } = require('./api-contracts');

class JavaScriptAdapter extends BaseAdapter {
  constructor() {
    super();
    this.parser = new Parser();
    this.parser.setLanguage(JavaScript);
  }

  parse(contents) {
    return this.safeParse(this.parser, contents);
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
          params: this.extractParams(node),
          ontology: []
        });
      } else if (node.type === "class_declaration") {
        const nameNode = node.childForFieldName("name");
        symbols.push({
          type: "class",
          name: nameNode ? nameNode.text : "anonymous",
          startPosition: node.startPosition,
          calls: this.extractCalls(node, contents),
          params: this.extractParams(node),
          ontology: []
        });
      } else if (node.type === "variable_declarator") {
        const nameNode = node.childForFieldName("name");
        const valueNode = node.childForFieldName("value");
        if (nameNode && valueNode && (valueNode.type === "arrow_function" || valueNode.type === "function_expression")) {
           symbols.push({
             type: "function",
             name: nameNode.text,
             startPosition: node.startPosition,
             calls: this.extractCalls(valueNode, contents),
             params: this.extractParams(valueNode),
             ontology: []
           });
        }
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
        const sourceNode = node.childForFieldName("source");
        const source = sourceNode ? sourceNode.text.replace(/['"]/g, '') : null;
        
        let importClause = node.children.find(c => c.type === 'import_clause');
        if (importClause) {
            let namespaceImport = importClause.children.find(c => c.type === 'namespace_import');
            if (namespaceImport) {
                let localNameNode = namespaceImport.childForFieldName('alias') || namespaceImport.children.find(c => c.type === 'identifier');
                if (localNameNode) imports.push({ localName: localNameNode.text, importedName: '*', source });
            }
            
            let defaultImport = importClause.children.find(c => c.type === 'identifier');
            if (defaultImport) {
                imports.push({ localName: defaultImport.text, importedName: 'default', source });
            }
            
            let namedImports = importClause.children.find(c => c.type === 'named_imports');
            if (namedImports) {
                let specifiers = namedImports.children.filter(c => c.type === 'import_specifier');
                for (let spec of specifiers) {
                    let importedNameNode = spec.childForFieldName('name') || spec.children.find(c => c.type === 'identifier');
                    let localNameNode = spec.childForFieldName('alias');
                    let importedName = importedNameNode ? importedNameNode.text : null;
                    let localName = localNameNode ? localNameNode.text : importedName;
                    if (importedName && localName) {
                        imports.push({ localName, importedName, source });
                    }
                }
            }
        } else if (source) {
             imports.push({ localName: null, importedName: null, source });
        }
      } else if (node.type === "variable_declarator") {
        let nameNode = node.childForFieldName("name");
        let valueNode = node.childForFieldName("value");
        if (nameNode && valueNode && valueNode.type === "call_expression") {
           let funcNode = valueNode.childForFieldName("function") || valueNode.child(0);
           if (funcNode && funcNode.text === "require") {
              let argsNode = valueNode.childForFieldName("arguments");
              if (argsNode) {
                 let strNode = argsNode.children.find(c => c.type === 'string');
                 if (strNode) {
                    let source = strNode.text.replace(/['"]/g, '');
                    if (nameNode.type === 'identifier') {
                        imports.push({ localName: nameNode.text, importedName: 'default', source });
                    } else if (nameNode.type === 'object_pattern') {
                        // Shorthand: const { a, b } = require(...)
                        let props = nameNode.children.filter(c => c.type === 'shorthand_property_identifier_pattern');
                        for (let prop of props) {
                            imports.push({ localName: prop.text, importedName: prop.text, source });
                        }
                        // Renamed: const { a: b } = require(...)
                        let pairs = nameNode.children.filter(c => c.type === 'pair_pattern');
                        for (let pair of pairs) {
                            let keyNode = pair.childForFieldName('key');
                            let valNode = pair.childForFieldName('value');
                            if (keyNode && valNode) {
                                imports.push({ localName: valNode.text, importedName: keyNode.text, source });
                            }
                        }
                    } else {
                        imports.push({ localName: null, importedName: null, source });
                    }
                 }
              }
           }
        }
      }

      for (let i = node.childCount - 1; i >= 0; i--) {
        stack.push(node.child(i));
      }
    }
    return imports;
  }

  /**
   * Collect parameter names for a symbol — including those of any nested
   * functions/arrows, since `extractCalls` aggregates calls over the whole
   * subtree (e.g. a Promise executor's `resolve`/`reject`).
   */
  extractParams(fnNode) {
    const names = new Set();
    const FN_TYPES = new Set([
      'arrow_function', 'function_declaration', 'function_expression',
      'function', 'method_definition', 'generator_function', 'generator_function_declaration',
    ]);
    const collectBindings = (n) => {
      if (!n) return;
      if (n.type === 'identifier' || n.type === 'shorthand_property_identifier_pattern') { names.add(n.text); return; }
      if (n.type === 'assignment_pattern') { collectBindings(n.childForFieldName('left')); return; }
      if (n.type === 'pair_pattern') { collectBindings(n.childForFieldName('value')); return; }
      for (let i = 0; i < n.namedChildCount; i++) collectBindings(n.namedChild(i));
    };
    const stack = [fnNode];
    while (stack.length) {
      const n = stack.pop();
      if (!n) continue;
      if (FN_TYPES.has(n.type)) {
        const p = n.childForFieldName('parameters') || n.childForFieldName('parameter');
        if (p) collectBindings(p);
      }
      for (let i = 0; i < n.namedChildCount; i++) stack.push(n.namedChild(i));
    }
    return Array.from(names);
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
          calls.push(funcNode.text);
        }
      }

      for (let i = node.childCount - 1; i >= 0; i--) {
        stack.push(node.child(i));
      }
    }
    return Array.from(new Set(calls));
  }

  extractApiContracts(tree, contents) {
    return extractApiContracts(tree);
  }
}

module.exports = JavaScriptAdapter;