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
    return this.safeParse(this.parser, contents);
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
            params: this.extractParams(definition),
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
          params: this.extractParams(node),
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
    if (!tree || !tree.rootNode) return results;
    let stack = [tree.rootNode];
    while (stack.length) {
      const node = stack.pop();
      if (!node) continue;
      
      if (node.type === "import_statement") {
        for (let i = 0; i < node.childCount; i++) {
          if (node.fieldNameForChild(i) === "name") {
            const child = node.child(i);
            if (child.type === "dotted_name") {
              results.push({ localName: child.text, importedName: '*', source: child.text });
            } else if (child.type === "aliased_import") {
              const nameNode = child.childForFieldName("name");
              const aliasNode = child.childForFieldName("alias");
              if (nameNode && aliasNode) {
                results.push({ localName: aliasNode.text, importedName: '*', source: nameNode.text });
              }
            }
          }
        }
      } else if (node.type === "import_from_statement") {
        const mod = node.childForFieldName("module_name");
        const source = mod ? mod.text : null;
        if (source) {
          // Handle both direct names and import_list (multiple names in parentheses or comma-separated)
          const processNameNode = (n) => {
            if (n.type === "dotted_name" || n.type === "identifier") {
              results.push({ localName: n.text, importedName: n.text, source });
            } else if (n.type === "aliased_import") {
              const nameNode = n.childForFieldName("name");
              const aliasNode = n.childForFieldName("alias");
              if (nameNode && aliasNode) {
                results.push({ localName: aliasNode.text, importedName: nameNode.text, source });
              }
            }
          };

          for (let i = 0; i < node.childCount; i++) {
            const field = node.fieldNameForChild(i);
            const child = node.child(i);
            if (field === "name") {
              processNameNode(child);
            } else if (child.type === "import_list") {
              for (let j = 0; j < child.namedChildCount; j++) {
                processNameNode(child.namedChild(j));
              }
            }
          }
        }
      }
      for (let i = node.namedChildCount - 1; i >= 0; i--) {
        stack.push(node.namedChild(i));
      }
    }
    return results;
  }

  /**
   * Collect parameter names for a symbol — including those of any nested
   * `def`/`lambda`, since `extractCalls` aggregates calls over the whole subtree.
   */
  extractParams(defNode) {
    const names = new Set();
    if (!defNode) return [];
    const collectFrom = (p) => {
      if (!p) return;
      for (let i = 0; i < p.namedChildCount; i++) {
        const c = p.namedChild(i);
        if (c.type === 'identifier') names.add(c.text);
        else if (c.type === 'typed_parameter') {
          const id = c.namedChild(0);
          if (id && id.type === 'identifier') names.add(id.text);
        } else if (c.type === 'default_parameter' || c.type === 'typed_default_parameter') {
          const n = c.childForFieldName('name');
          if (n) names.add(n.text);
        } else if (c.type === 'list_splat_pattern' || c.type === 'dictionary_splat_pattern') {
          const id = c.namedChild(0);
          if (id && id.type === 'identifier') names.add(id.text);
        }
      }
    };
    const stack = [defNode];
    while (stack.length) {
      const n = stack.pop();
      if (!n) continue;
      if (n.type === 'function_definition' || n.type === 'lambda') {
        collectFrom(n.childForFieldName('parameters'));
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
      if (node.type === "call") {
        let name = "";
        if (node.namedChildCount > 0) {
          const callTarget = node.namedChild(0);
          if (callTarget.type === "identifier" || callTarget.type === "dotted_name" || callTarget.type === "attribute") {
            name = callTarget.text;
          } else if (callTarget.childForFieldName("name")) {
            name = callTarget.childForFieldName("name").text;
          }
        }
        if (name) {
          calls.push(name);
        }
      }
      for (let i = node.namedChildCount - 1; i >= 0; i--) {
        stack.push(node.namedChild(i));
      }
    }
    return Array.from(new Set(calls));
  }

  /**
   * Extract HTTP routes from Flask/FastAPI-style decorators:
   *   @app.route('/users', methods=['GET', 'POST'])
   *   @app.get('/users')  /  @router.post('/items/{id}')
   */
  extractApiContracts(tree, contents) {
    const apiRoutes = [];
    if (!tree || !tree.rootNode) return { apiCalls: [], apiRoutes };

    const HTTP_METHODS = new Set(['get', 'post', 'put', 'delete', 'patch', 'head', 'options']);
    const stack = [tree.rootNode];
    while (stack.length) {
      const node = stack.pop();
      if (!node) continue;

      if (node.type === 'decorated_definition') {
        let definition = null;
        const decorators = [];
        for (let i = 0; i < node.namedChildCount; i++) {
          const child = node.namedChild(i);
          if (child.type === 'decorator') decorators.push(child.text);
          else if (['class_definition', 'function_definition'].includes(child.type)) definition = child;
        }
        const handlerName = definition?.childForFieldName('name')?.text;
        if (!handlerName) continue;

        for (const dec of decorators) {
          // @receiver.verb('/path' ...) — verb is route/get/post/...
          const match = dec.match(/^@\s*[\w.]+\.(\w+)\s*\(\s*(['"])([^'"]*)\2/);
          if (!match) continue;
          const verb = match[1].toLowerCase();
          const routePath = match[3];

          if (verb === 'route') {
            // Flask: methods kwarg lists the verbs, defaulting to GET
            const methodsMatch = dec.match(/methods\s*=\s*\[([^\]]*)\]/);
            const methods = methodsMatch
              ? methodsMatch[1].split(',').map(m => m.replace(/['"\s]/g, '').toUpperCase()).filter(Boolean)
              : ['GET'];
            for (const method of methods) {
              apiRoutes.push({ method, path: routePath, handlerName, framework: 'flask' });
            }
          } else if (HTTP_METHODS.has(verb)) {
            apiRoutes.push({ method: verb.toUpperCase(), path: routePath, handlerName, framework: 'fastapi' });
          }
        }
      }

      for (let i = node.namedChildCount - 1; i >= 0; i--) {
        stack.push(node.namedChild(i));
      }
    }

    return { apiCalls: [], apiRoutes };
  }
}

module.exports = PythonAdapter;
