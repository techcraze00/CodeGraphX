const fs = require('fs');
const path = require('path');
const { computeHash, computeDelta } = require('./differ');
const { extractEntities, FileEntity, SymbolEntity } = require('./entities');
const { buildCallEdges } = require('./edgebuilder');
const { writeJSONSync, ensureDirSync } = require('./utils');

class GraphStore {
  constructor(projectRoot, config) {
    this.projectRoot = projectRoot;
    this.config = config;
    this.outputDir = path.join(projectRoot, config.outputDir);
    this.cacheFile = path.join(this.outputDir, 'cache.json');
    
    // Memory map: filepath -> { hash, entities: FileEntity }
    this.cache = new Map(); 
    this.symbolIndex = new Map(); // symbolId -> { file, symbol: SymbolEntity }
    this.loadCache();
  }

  loadCache() {
    if (fs.existsSync(this.cacheFile)) {
      try {
        const raw = JSON.parse(fs.readFileSync(this.cacheFile, 'utf8'));
        for (const [k, v] of Object.entries(raw)) {
          const fileEntity = new FileEntity({ 
            path: k, 
            hash: v.hash, 
            ...v.entities 
          });
          this.cache.set(k, { hash: v.hash, entities: fileEntity });
          // Populate symbol index
          if (fileEntity.symbols) {
            fileEntity.symbols.forEach(sym => {
              if (sym.id) this.symbolIndex.set(sym.id, { file: k, symbol: sym });
            });
          }
        }
      } catch (e) {
        console.warn('Could not load cache.json:', e.message);
      }
    }
  }

  saveCache() {
    ensureDirSync(this.outputDir);
    const obj = {};
    for (const [k, v] of this.cache.entries()) {
      obj[k] = {
        hash: v.hash,
        entities: v.entities instanceof FileEntity ? v.entities.toJSON() : v.entities
      };
    }
    fs.writeFileSync(this.cacheFile, JSON.stringify(obj, null, 2), 'utf8');
  }

  /**
   * Updates a file in the store. 
   */
  async updateFile(filepath, contents) {
    const rel = path.relative(this.projectRoot, filepath);
    const newHash = computeHash(contents);
    const oldEntry = this.cache.get(rel);

    if (oldEntry && oldEntry.hash === newHash) {
      return { changed: false, entities: oldEntry.entities, delta: null };
    }

    const newEntities = await extractEntities(filepath, contents, this.projectRoot);
    newEntities.hash = newHash;
    
    // Clear old symbols from index if they existed
    if (oldEntry && oldEntry.entities && oldEntry.entities.symbols) {
      oldEntry.entities.symbols.forEach(sym => {
        if (sym.id) this.symbolIndex.delete(sym.id);
      });
    }

    // Add new symbols to index
    if (newEntities.symbols) {
      newEntities.symbols.forEach(sym => {
        if (sym.id) this.symbolIndex.set(sym.id, { file: rel, symbol: sym });
      });
    }

    let delta = null;
    if (oldEntry) {
      delta = {
        symbols: computeDelta(
          (oldEntry.entities.symbols || []).map(s => s instanceof SymbolEntity ? s.toJSON() : s), 
          newEntities.symbols.map(s => s.toJSON())
        ),
        imports: computeDelta(
          (oldEntry.entities.imports || []).map(i => ({ type: 'import', name: i })), 
          (newEntities.imports || []).map(i => ({ type: 'import', name: i }))
        )
      };
    } else {
      delta = {
        symbols: { added: newEntities.symbols.map(s => s.toJSON()), removed: [], modified: [] },
        imports: { added: (newEntities.imports || []).map(i => ({ type: 'import', name: i })), removed: [], modified: [] }
      };
    }

    this.cache.set(rel, { hash: newHash, entities: newEntities });
    return { changed: true, entities: newEntities, delta };
  }

  removeFile(filepath) {
    const rel = path.relative(this.projectRoot, filepath);
    const oldEntry = this.cache.get(rel);
    
    if (oldEntry && oldEntry.entities && oldEntry.entities.symbols) {
      oldEntry.entities.symbols.forEach(sym => {
        if (sym.id) this.symbolIndex.delete(sym.id);
      });
    }

    this.cache.delete(rel);
    
    if (oldEntry) {
      return { 
        removed: true, 
        delta: {
          symbols: { added: [], removed: (oldEntry.entities.symbols || []).map(s => s instanceof SymbolEntity ? s.toJSON() : s), modified: [] },
          imports: { added: [], removed: (oldEntry.entities.imports || []).map(i => ({ type: 'import', name: i })), modified: [] }
        }
      };
    }
    return { removed: false, delta: null };
  }

  /**
   * Drop any cached file whose relative path is not in `keepRelPaths`.
   * Used by a full rescan to evict files deleted from disk so their stale
   * symbols don't survive into the regenerated graph/artifacts.
   * @param {Set<string>} keepRelPaths - relative paths currently on disk
   * @returns {string[]} the relative paths that were pruned
   */
  pruneExcept(keepRelPaths) {
    const pruned = [];
    for (const rel of [...this.cache.keys()]) {
      if (keepRelPaths.has(rel)) continue;
      const entry = this.cache.get(rel);
      if (entry && entry.entities && entry.entities.symbols) {
        entry.entities.symbols.forEach(sym => {
          if (sym.id) this.symbolIndex.delete(sym.id);
        });
      }
      this.cache.delete(rel);
      pruned.push(rel);
    }
    return pruned;
  }

  getFilesData() {
    const files = [];
    for (const [file, entry] of this.cache.entries()) {
      files.push({ 
        file, 
        ...(entry.entities instanceof FileEntity ? entry.entities.toJSON() : entry.entities)
      });
    }
    return files;
  }
}

module.exports = { GraphStore };
