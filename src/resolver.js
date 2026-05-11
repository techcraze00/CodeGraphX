// src/resolver.js
const path = require('path');

/**
 * Attempts to resolve an import string to an actual file in the codebase.
 * @param {string} importerFile - Relative path of the file containing the import
 * @param {string} importString - The imported string (e.g., './utils', 'react')
 * @param {string[]} allKnownFiles - List of all files in the project
 * @param {string} projectRoot - Absolute path to project root
 * @returns {string|null} - Resolved relative path to the imported file, or null
 */
function resolveImport(importerFile, importString, allKnownFiles, projectRoot) {
  let normalizedSource = importString;
  // Normalize Python relative imports (.utils -> ./utils)
  if (importString.startsWith('.') && !importString.startsWith('./') && !importString.startsWith('../')) {
      normalizedSource = './' + importString.substring(1).replace(/\./g, '/');
  }

  // 1. Relative import resolution
  if (normalizedSource.startsWith('.')) {
    const dir = path.dirname(importerFile);
    const resolved = path.join(dir, normalizedSource);
    
    // Check exact match or with extensions
    const exts = ['', '.js', '.jsx', '.ts', '.tsx', '.py', '/index.js', '/index.ts', '/__init__.py'];
    for (const ext of exts) {
      const testPath = resolved + ext;
      if (allKnownFiles.includes(testPath)) {
        return testPath;
      }
    }
  }
  
  // 2. Package/Alias heuristic (simplified for MVP)
  // If it's not relative, try to find a file that exactly matches the module name
  // e.g. "utils" -> "src/utils.js"
  const fallbackMatch = allKnownFiles.find(f => {
    const base = path.basename(f, path.extname(f));
    return base === normalizedSource || 
           f.endsWith(`/${normalizedSource}/index.js`) ||
           f.endsWith(`/${normalizedSource}/__init__.py`);
  });
  
  return fallbackMatch || null;
}

module.exports = { resolveImport };

function resolveSourceToFile(importerFile, source, allKnownFiles) {
    let normalizedSource = source;
    // Normalize Python relative imports (.utils -> ./utils)
    if (source.startsWith('.') && !source.startsWith('./') && !source.startsWith('../')) {
        normalizedSource = './' + source.substring(1).replace(/\./g, '/');
    }

    if (normalizedSource.startsWith('.')) {
        const dir = path.dirname(importerFile);
        const resolved = path.join(dir, normalizedSource);
        const exts = ['', '.js', '.jsx', '.ts', '.tsx', '.py', '/index.js', '/index.ts', '/__init__.py'];
        for (const ext of exts) {
          const testPath = resolved + ext;
          if (allKnownFiles.includes(testPath)) {
            return testPath;
          }
        }
    }
    
    // Heuristic fallback for non-relative
    const fallbackMatch = allKnownFiles.find(f => {
      const base = path.basename(f, path.extname(f));
      return base === normalizedSource || 
             f.endsWith(`/${normalizedSource}/index.js`) || 
             f.endsWith(`/${normalizedSource}/__init__.py`) ||
             f.endsWith(`/${normalizedSource}.js`) || 
             f.endsWith(`/${normalizedSource}.py`);
    });
    
    return fallbackMatch || null;
}
module.exports.resolveSourceToFile = resolveSourceToFile;
