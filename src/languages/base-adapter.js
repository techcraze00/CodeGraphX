class BaseAdapter {
  // Cap to guard against pathological inputs (minified bundles, vendored blobs).
  static MAX_PARSE_BYTES = 8 * 1024 * 1024;

  /**
   * Parse file contents into an AST (e.g., Tree-sitter tree).
   * @param {string} contents 
   * @returns {any} AST root or tree
   */
  parse(contents) {
    throw new Error('Not implemented: parse()');
  }

  /**
   * Run a Tree-sitter parse with a buffer sized to the file.
   *
   * node-tree-sitter's default read buffer is 32 KB; feeding it a larger
   * source string makes the native binding throw "Invalid argument".
   * Sizing the buffer to the byte length (plus padding) avoids that on
   * large files. Returns null if the file is too large to parse safely.
   *
   * @param {object} parser A Tree-sitter Parser with a language already set.
   * @param {string} contents
   * @returns {any|null} parsed tree, or null when the file exceeds MAX_PARSE_BYTES
   */
  safeParse(parser, contents) {
    const bytes = Buffer.byteLength(contents, 'utf8');
    if (bytes > BaseAdapter.MAX_PARSE_BYTES) return null;
    return parser.parse(contents, null, { bufferSize: bytes + 1024 });
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