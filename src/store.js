const fs = require('fs');
const path = require('path');
const { computeHash, computeDelta } = require('./differ');
const { extractEntities } = require('./entities');
const { buildCallEdges } = require('./edgebuilder');
const { writeJSONSync, ensureDirSync } = require('./utils');

class GraphStore {
  constructor(projectRoot, config) {
    this.projectRoot = projectRoot;
    this.config = config;
    this.outputDir = path.join(projectRoot, config.outputDir);
    this.cacheFile = path.join(this.outputDir, 'cache.json');
    
    // Memory map: filepath -> { hash, entities: { symbols, imports } }
    // Space complexity: O(N) where N is total number of files, but very lightweight.
    this.cache = new Map(); 
    this.loadCache();
  }

  loadCache() {
    if (fs.existsSync(this.cacheFile)) {
      try {
        const raw = JSON.parse(fs.readFileSync(this.cacheFile, 'utf8'));
        for (const [k, v] of Object.entries(raw)) {
          this.cache.set(k, v);
        }
      } catch (e) {
        console.warn('Could not load cache.json');
      }
    }
  }

  saveCache() {
    ensureDirSync(this.outputDir);
    const obj = {};
    for (const [k, v] of this.cache.entries()) {
      obj[k] = v;
    }
    fs.writeFileSync(this.cacheFile, JSON.stringify(obj), 'utf8');
  }

  /**
   * Updates a file in the store. 
   * Time complexity: Best case O(1) if hash matches. Worst case O(size of file) for parsing.
   */
  async updateFile(filepath, contents) {
    const rel = path.relative(this.projectRoot, filepath);
    const newHash = computeHash(contents);
    const oldEntry = this.cache.get(rel);

    // O(1) skip if identical
    if (oldEntry && oldEntry.hash === newHash) {
      return { changed: false, entities: oldEntry.entities, delta: null };
    }

    const newEntities = await extractEntities(filepath, contents);
    
    let delta = null;
    if (oldEntry) {
      delta = {
        symbols: computeDelta(oldEntry.entities.symbols || [], newEntities.symbols || []),
        imports: computeDelta(
          (oldEntry.entities.imports || []).map(i => ({ type: 'import', name: i })), 
          (newEntities.imports || []).map(i => ({ type: 'import', name: i }))
        )
      };
    } else {
      delta = {
        symbols: { added: newEntities.symbols || [], removed: [], modified: [] },
        imports: { added: (newEntities.imports || []).map(i => ({ type: 'import', name: i })), removed: [], modified: [] }
      };
    }

    this.cache.set(rel, { hash: newHash, entities: newEntities });
    return { changed: true, entities: newEntities, delta };
  }

  removeFile(filepath) {
    const rel = path.relative(this.projectRoot, filepath);
    const oldEntry = this.cache.get(rel);
    this.cache.delete(rel);
    
    if (oldEntry) {
      return { 
        removed: true, 
        delta: {
          symbols: { added: [], removed: oldEntry.entities.symbols || [], modified: [] },
          imports: { added: [], removed: (oldEntry.entities.imports || []).map(i => ({ type: 'import', name: i })), modified: [] }
        }
      };
    }
    return { removed: false, delta: null };
  }

  getFilesData() {
    const files = [];
    for (const [file, entry] of this.cache.entries()) {
      files.push({ file, ...entry.entities });
    }
    return files;
  }
}

module.exports = { GraphStore };
