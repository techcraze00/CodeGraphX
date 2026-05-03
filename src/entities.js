const { parseFile } = require('./parser');
const { extractPython, extractJS, extractTS, extractHTML, extractCSS } = require('./graph');

/**
 * Walk the tree-sitter CST and collect every ERROR and MISSING node.
 * Returns an array of { line, column, nodeType, context } objects.
 *
 * - line    : 1-based line number
 * - column  : 0-based column
 * - nodeType: "ERROR" or "MISSING"
 * - context : up to 40 chars of surrounding source text (trimmed)
 */
function collectSyntaxErrors(rootNode, contents) {
  const errors = [];
  const lines  = contents.split('\n');

  const stack = [rootNode];
  while (stack.length) {
    const node = stack.pop();
    if (!node) continue;

    if (node.type === 'ERROR' || node.isMissing) {
      const row    = node.startPosition.row;        // 0-based
      const col    = node.startPosition.column;     // 0-based
      const line   = lines[row] || '';
      // Grab a short context snippet centred around the error column
      const start  = Math.max(0, col - 10);
      const end    = Math.min(line.length, col + 30);
      const context = line.slice(start, end).trim();

      errors.push({
        line:     row + 1,               // convert to 1-based
        column:   col,
        nodeType: node.isMissing ? 'MISSING' : 'ERROR',
        context,
      });
      // Don't descend into ERROR nodes — their children are noise
      continue;
    }

    for (let i = node.childCount - 1; i >= 0; i--) {
      stack.push(node.child(i));
    }
  }

  return errors;
}

function extractEntities(file, contents) {
  try {
    const { tree, type, error } = parseFile(file, contents);

    // Parser returned an error or null tree
    if (!tree || error) {
      return { symbols: [], imports: [], parseError: error || 'Unknown parse error' };
    }

    let result;
    switch (type) {
      case 'python':     result = extractPython(tree, contents); break;
      case 'javascript':
      case 'jsx':        result = extractJS(tree, contents);     break;
      case 'typescript':
      case 'tsx':        result = extractTS(tree, contents);     break;
      case 'html':       result = extractHTML(tree, contents);   break;
      case 'css':        result = extractCSS(tree, contents);    break;
      default:           result = { symbols: [], imports: [] };  break;
    }

    // Collect syntax errors from ERROR / MISSING nodes regardless of language
    if (tree.rootNode.hasError) {
      console.warn(`[CodeGraphX] Syntax errors in ${file}, partial parse only`);
      result.syntaxErrors = collectSyntaxErrors(tree.rootNode, contents);
    } else {
      result.syntaxErrors = [];
    }

    return result;
  } catch (e) {
    // Catch WASM aborts and any other runtime errors
    console.warn(`[CodeGraphX] Failed to extract entities from ${file}: ${e.message}`);
    return { symbols: [], imports: [], syntaxErrors: [], parseError: e.message };
  }
}

module.exports = { extractEntities };