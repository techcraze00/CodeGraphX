class BaseAdapter {
  /**
   * Parse file contents into an AST (e.g., Tree-sitter tree).
   * @param {string} contents 
   * @returns {any} AST root or tree
   */
  parse(contents) {
    throw new Error('Not implemented: parse()');
  }

  /**
   * Extract symbols (functions, classes, etc.) from AST.
   * @param {any} ast 
   * @param {string} contents 
   * @returns {Array}
   */
  extractSymbols(ast, contents) {
    throw new Error('Not implemented: extractSymbols()');
  }

  /**
   * Extract imports from AST.
   * @param {any} ast 
   * @param {string} contents 
   * @returns {Array}
   */
  extractImports(ast, contents) {
    throw new Error('Not implemented: extractImports()');
  }

  /**
   * Extract calls (functions called) from AST.
   * @param {any} ast 
   * @param {string} contents 
   * @returns {Array}
   */
  extractCalls(ast, contents) {
    throw new Error('Not implemented: extractCalls()');
  }

  /**
   * Build semantic edges from AST.
   * @param {any} ast
   * @param {string} contents
   * @returns {Array}
   */
  buildEdges(ast, contents) {
    // Optional: default to empty array
    return [];
  }

  /**
   * Extract cross-language API contracts (HTTP calls made and routes exposed).
   * @param {any} ast
   * @param {string} contents
   * @returns {{ apiCalls: Array, apiRoutes: Array }}
   */
  extractApiContracts(ast, contents) {
    // Optional: languages without HTTP semantics return empty contracts
    return { apiCalls: [], apiRoutes: [] };
  }
}

module.exports = BaseAdapter;