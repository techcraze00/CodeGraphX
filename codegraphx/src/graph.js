// JS/TS, HTML, and CSS extractors are simple stubs to be filled below later
function parsePythonFile(contents) {
  const Parser = require('tree-sitter');
  const Python = require('tree-sitter-python');
  const parser = new Parser();
  parser.setLanguage(Python);
  return parser.parse(contents);
}

const { extractSymbols, extractImports } = require('./symbols_imports_py');
function extractPython(tree, contents) {
  return { symbols: extractSymbols(tree, contents), imports: extractImports(tree, contents) };
}


function extractJS(tree, contents) {
  // For MVP: get top-level functions and imports
  let symbols = [];
  let imports = [];
  let stack = [tree.rootNode];
  while (stack.length) {
    const node = stack.pop();
    if (!node) continue;
    if (node.type === "function_declaration") {
      symbols.push({
        type: "function",
        name: node.childForFieldName("name")?.text,
        startPosition: node.startPosition,
      });
    } else if (node.type === "class_declaration") {
      symbols.push({
        type: "class",
        name: node.childForFieldName("name")?.text,
        startPosition: node.startPosition,
      });
    } else if (node.type === "import_statement") {
      for (let i = 0; i < node.namedChildCount; i++) {
        const child = node.namedChild(i);
        if (child.type === "string" || child.type === "identifier") imports.push(child.text);
      }
    }
    for (let i = node.namedChildCount - 1; i >= 0; i--) {
      stack.push(node.namedChild(i));
    }
  }
  return { symbols, imports };
}

function extractTS(tree, contents) {
  return extractJS(tree, contents); // For now, TypeScript shares JavaScript logic
}

function extractHTML(tree, contents) {
  let symbols = [], imports = [];
  let stack = [tree.rootNode];
  while (stack.length) {
    const node = stack.pop();
    if (!node) continue;
    if (node.type === "element") {
      symbols.push({ type: "element", tag: node.childForFieldName("name")?.text, startPosition: node.startPosition });
    }
    for (let i = node.namedChildCount - 1; i >= 0; i--) {
      stack.push(node.namedChild(i));
    }
  }
  return { symbols, imports };
}

function extractCSS(tree, contents) {
  let symbols = [], imports = [];
  let stack = [tree.rootNode];
  while (stack.length) {
    const node = stack.pop();
    if (!node) continue;
    if (node.type === "class_selector") {
      const nameNode = node.childForFieldName("name") || node.children.find(n => n.type === "class_name");
      if (nameNode) symbols.push({ type: node.type, name: '.' + nameNode.text, startPosition: node.startPosition });
    } else if (node.type === "id_selector") {
      const nameNode = node.childForFieldName("name") || node.children.find(n => n.type === "id_name");
      if (nameNode) symbols.push({ type: node.type, name: '#' + nameNode.text, startPosition: node.startPosition });
    }
    for (let i = node.namedChildCount - 1; i >= 0; i--) {
      stack.push(node.namedChild(i));
    }
  }
  return { symbols, imports };
}

module.exports = { extractPython, extractJS, extractTS, extractHTML, extractCSS };