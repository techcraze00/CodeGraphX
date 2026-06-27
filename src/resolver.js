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
// Candidate extensions / index files tried when resolving to a concrete file.
const REL_EXTS = ['', '.js', '.jsx', '.ts', '.tsx', '.py', '/index.js', '/index.ts', '/__init__.py'];

/**
 * Resolve a relative import to a known file.
 *  - JS/TS explicit:   "./x", "../x"
 *  - Python package-relative: leading dots, no slash. First dot = current
 *    package, each extra dot climbs one level. ".m"->./m, "..p.m"->../p/m,
 *    bare "." / ".." = the package directory itself (always "resolved").
 * @returns {string|null} resolved file, the package dir for bare-dot imports, or null
 */
function resolveRelative(importerFile, importString, allKnownFiles) {
  const dir = path.dirname(importerFile);
  let resolvedBase;

  if (importString.startsWith('./') || importString.startsWith('../')) {
    resolvedBase = path.join(dir, importString);
  } else {
    const m = importString.match(/^(\.+)(.*)$/);
    const dots = m[1].length;
    const rest = m[2].replace(/\./g, '/');
    let baseDir = dir;
    for (let i = 1; i < dots; i++) baseDir = path.dirname(baseDir);
    if (!rest) return baseDir || '.'; // "from . import x" — the package itself
    resolvedBase = path.join(baseDir, rest);
  }

  resolvedBase = resolvedBase.replace(/\\/g, '/');
  for (const ext of REL_EXTS) {
    if (allKnownFiles.includes(resolvedBase + ext)) return resolvedBase + ext;
  }
  // Imported name may be a sub-package directory rather than a file.
  const sub = allKnownFiles.find(f => f.startsWith(resolvedBase + '/'));
  return sub || null;
}

function resolveImport(importerFile, importString, allKnownFiles, projectRoot) {
  if (typeof importString !== 'string') return null;

  // 1. Relative imports (JS "./" / "../" and Python leading-dot).
  if (importString.startsWith('.')) {
    return resolveRelative(importerFile, importString, allKnownFiles) || null;
  }

  // 2. Dotted/absolute module path as a file path: "a.b.c" -> "a/b/c".
  const slashed = importString.replace(/\./g, '/');
  for (const ext of REL_EXTS) {
    if (allKnownFiles.includes(slashed + ext)) return slashed + ext;
  }
  const suffixMatch = allKnownFiles.find(f => {
    const noext = f.replace(/\.[^/.]+$/, '');
    return noext === slashed || noext.endsWith('/' + slashed);
  });
  if (suffixMatch) return suffixMatch;

  // 3. Bare module/alias heuristic: "utils" -> "src/utils.js".
  const fallbackMatch = allKnownFiles.find(f => {
    const base = path.basename(f, path.extname(f));
    return base === importString ||
           f.endsWith(`/${importString}/index.js`) ||
           f.endsWith(`/${importString}/__init__.py`);
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
