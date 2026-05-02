function extractEntities(file, contents) {
  try {
    const { tree, type, error } = parseFile(file, contents);
    
    // Parser returned an error or null tree
    if (!tree || error) {
      return { symbols: [], imports: [], parseError: error || 'Unknown parse error' };
    }

    // Check for tree-sitter error nodes indicating invalid syntax
    if (tree.rootNode.hasError()) {
      console.warn(`[CodeGraphX] Syntax errors in ${file}, partial parse only`);
      // Still attempt extraction — partial results are better than none
    }

    switch (type) {
      case 'python':     return extractPython(tree, contents);
      case 'javascript':
      case 'jsx':        return extractJS(tree, contents);
      case 'typescript':
      case 'tsx':        return extractTS(tree, contents);
      case 'html':       return extractHTML(tree, contents);
      case 'css':        return extractCSS(tree, contents);
      default:           return { symbols: [], imports: [] };
    }
  } catch (e) {
    // Catch WASM aborts and any other runtime errors
    console.warn(`[CodeGraphX] Failed to extract entities from ${file}: ${e.message}`);
    return { symbols: [], imports: [], parseError: e.message };
  }
}