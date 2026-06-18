const { parseFile } = require('./parser');
const { getAdapterForFile } = require('./languages');


class SymbolEntity {
  constructor({ id, name, type, file, scope, startPosition, calls, ontology }) {
    this.id = id;
    this.name = name;
    this.type = type;
    this.file = file;
    this.scope = scope || 'global';
    this.startPosition = startPosition;
    this.calls = calls || [];
    this.ontology = ontology || [];
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      file: this.file,
      scope: this.scope,
      startPosition: this.startPosition,
      calls: this.calls,
      ontology: this.ontology
    };
  }
}

class FileEntity {
  constructor({ path, file, hash, language, symbols, imports, syntaxErrors, parseError }) {
    this.path = path || file;
    this.file = this.path; // Compatibility alias
    this.hash = hash;
    this.language = language;
    this.symbols = (symbols || []).map(s => s instanceof SymbolEntity ? s : new SymbolEntity(s));
    this.imports = imports || [];
    this.syntaxErrors = syntaxErrors || [];
    this.parseError = parseError;
  }

  toJSON() {
    return {
      path: this.path,
      file: this.file, // Compatibility
      hash: this.hash,
      language: this.language,
      symbols: this.symbols.map(s => s.toJSON()),
      imports: this.imports,
      syntaxErrors: this.syntaxErrors,
      parseError: this.parseError
    };
  }
}

class EdgeEntity {
  static EDGE_TYPES = {
    CALLS: 'CALLS',
    IMPORTS: 'IMPORTS',
    INHERITS: 'INHERITS',
    IMPLEMENTS: 'IMPLEMENTS',
    USES: 'USES',
    REFERENCES: 'REFERENCES',
    ROUTES_TO: 'ROUTES_TO'
  };

  constructor({ from, to, type, confidence = 1.0 }) {
    if (!EdgeEntity.EDGE_TYPES[type]) {
      throw new Error(`Invalid edge type: ${type}. Must be one of: ${Object.keys(EdgeEntity.EDGE_TYPES).join(', ')}`);
    }
    this.from = from;
    this.to = to;
    this.type = type;
    this.confidence = confidence;
  }

  toJSON() {
    return {
      from: this.from,
      to: this.to,
      type: this.type,
      confidence: this.confidence
    };
  }
}

class Snapshot {
  constructor({ id, timestamp, repositoryId, commitHash, files, edges }) {
    this.id = id;
    this.timestamp = timestamp || Date.now();
    this.repositoryId = repositoryId;
    this.commitHash = commitHash;
    this.files = (files || []).map(f => f instanceof FileEntity ? f : new FileEntity(f));
    this.edges = (edges || []).map(e => e instanceof EdgeEntity ? e : new EdgeEntity(e));
  }

  toJSON() {
    return {
      id: this.id,
      timestamp: this.timestamp,
      repositoryId: this.repositoryId,
      commitHash: this.commitHash,
      files: this.files.map(f => f.toJSON()),
      edges: this.edges.map(e => e.toJSON())
    };
  }
}

class Repository {
  constructor({ id, name, path, snapshots }) {
    this.id = id;
    this.name = name;
    this.path = path;
    this.snapshots = (snapshots || []).map(s => s instanceof Snapshot ? s : new Snapshot(s));
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      path: this.path,
      snapshots: this.snapshots.map(s => s.toJSON())
    };
  }
}

class CommitEntity {
  constructor({ hash, author, timestamp, message, changes, branch, summary }) {
    this.hash = hash;
    this.author = author;
    this.timestamp = timestamp || Date.now();
    this.message = message;
    this.changes = changes || { added: [], removed: [], modified: [] };
    this.branch = branch;
    this.summary = summary;
  }

  toJSON() {
    return {
      hash: this.hash,
      author: this.author,
      timestamp: this.timestamp,
      message: this.message,
      changes: this.changes,
      branch: this.branch,
      summary: this.summary
    };
  }
}

/**
 * Walk the tree-sitter CST and collect every ERROR and MISSING node.
 */
function collectSyntaxErrors(rootNode, contents) {
  const errors = [];
  const lines  = contents.split('\n');

  const stack = [rootNode];
  while (stack.length) {
    const node = stack.pop();
    if (!node) continue;

    if (node.type === 'ERROR' || node.isMissing) {
      const row    = node.startPosition.row;
      const col    = node.startPosition.column;
      const line   = lines[row] || '';
      const start  = Math.max(0, col - 10);
      const end    = Math.min(line.length, col + 30);
      const context = line.slice(start, end).trim();

      errors.push({
        line:     row + 1,
        column:   col,
        nodeType: node.isMissing ? 'MISSING' : 'ERROR',
        context,
      });
      continue;
    }

    for (let i = node.childCount - 1; i >= 0; i--) {
      stack.push(node.child(i));
    }
  }

  return errors;
}

function extractEntities(file, contents, projectRoot = null) {
  const { normalizeNodePath } = require('./utils');
  const normalizedFile = projectRoot ? normalizeNodePath(file, projectRoot) : file;

  try {
    const { tree, type, error } = parseFile(file, contents);

    if (!tree || error) {
      return new FileEntity({ 
        path: normalizedFile, 
        symbols: [], 
        imports: [], 
        parseError: error || 'Unknown parse error' 
      });
    }

    const { adapter } = getAdapterForFile(file);
    const rawSymbols = adapter.extractSymbols(tree, contents);
    const imports = adapter.extractImports(tree, contents);

    const symbols = (rawSymbols || []).map(sym => {
      const scope = sym.scope || 'global';
      // Use normalizedFile (relative) in the ID
      const id = `${type}::${normalizedFile}::${scope}::${sym.name}`;
      return new SymbolEntity({
        ...sym,
        id,
        file: normalizedFile,
        scope
      });
    });

    let syntaxErrors = [];
    if (tree.rootNode.hasError) {
      console.warn(`[CodeGraphX] Syntax errors in ${file}, partial parse only`);
      syntaxErrors = collectSyntaxErrors(tree.rootNode, contents);
    }

    return new FileEntity({
      path: normalizedFile,
      language: type,
      symbols,
      imports,
      syntaxErrors
    });
  } catch (e) {
    console.warn(`[CodeGraphX] Failed to extract entities from ${file}: ${e.message}`);
    return new FileEntity({
      path: normalizedFile,
      symbols: [],
      imports: [],
      syntaxErrors: [],
      parseError: e.message
    });
  }
}

module.exports = { 
  SymbolEntity, 
  FileEntity, 
  EdgeEntity, 
  Snapshot, 
  Repository, 
  CommitEntity, 
  extractEntities 
};