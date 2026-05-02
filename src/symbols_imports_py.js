function extractSymbols(tree, content) {
  // Traverses for top-level classes/functions and collects calls
  const results = [];
  let stack = [tree.rootNode];
  while (stack.length) {
    const node = stack.pop();
    if (["class_definition", "function_definition"].includes(node.type)) {
      const calls = findCalls(node);
      results.push({
        type: node.type.replace("_definition", ""),
        name: node.childForFieldName("name")?.text,
        startPosition: node.startPosition,
        calls
      });
    }
    for (let i = node.namedChildCount - 1; i >= 0; i--) {
      stack.push(node.namedChild(i));
    }
  }
  return results;
}

function findCalls(fnNode) {
  // Return all called function names directly below this node
  const calls = [];
  let stack = [fnNode];
  while (stack.length) {
    const node = stack.pop();
    if (node.type === "call") {
      // Try to get the function name for `foo()` or `self.foo()`
      let name = "";
      if (node.namedChildCount > 0) {
        // Prefer the function field or the called object
        const callTarget = node.namedChild(0);
        // Either a dotted_name or identifier
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
  return calls;
}

function extractImports(tree, content) {
  // Find import_statement or import_from_statement nodes
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

module.exports = { extractSymbols, extractImports };
