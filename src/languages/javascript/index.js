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
          calls.push(funcNode.text);
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