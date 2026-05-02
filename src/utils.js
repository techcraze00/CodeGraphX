const path = require('path');
const fs = require('fs');

function ensureDirSync(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function writeJSONSync(filePath, data) {
  ensureDirSync(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

// function findFiles(rootDir, ext, results = []) {
//   const files = fs.readdirSync(rootDir);
//   for (const file of files) {
//     const filepath = path.join(rootDir, file);
//     const stat = fs.statSync(filepath);
//     if (stat.isDirectory()) {
//       if ([".git", ".codegraphx", "node_modules", "__pycache__"].includes(file)) continue;
//       findFiles(filepath, ext, results);
//     } else if (file.endsWith(ext)) {
//       results.push(filepath);
//     }
//   }
//   return results;
// }

function findFiles(rootDir, ext, results = [], ignoreList = []) {
  // Built-in ignores that should ALWAYS be skipped
  // regardless of user config
  const hardcodedIgnore = new Set([
    ".git",
    ".codegraphx", 
    "node_modules",
    "__pycache__",
    ".venv",
    "venv",
    "ENV",
    "dist",
    "build",
    ".next",
    ".nuxt",
    "coverage",
    ".nyc_output",
    ".pytest_cache",
    ".mypy_cache",
    ".ruff_cache",
    ".tox",
    "*.egg-info",
    ".DS_Store"
  ]);

  let files;
  try {
    files = fs.readdirSync(rootDir);
  } catch (e) {
    // Permission errors on some system directories
    return results;
  }

  for (const file of files) {
    const filepath = path.join(rootDir, file);

    // Check hardcoded ignores first (directory name match)
    if (hardcodedIgnore.has(file)) continue;

    // Check .egg-info pattern
    if (file.endsWith('.egg-info')) continue;

    let stat;
    try {
      stat = fs.statSync(filepath);
    } catch (e) {
      continue; // Skip files we can't stat (broken symlinks etc.)
    }

    if (stat.isDirectory()) {
      // Check user config ignores for directories
      const shouldIgnore = ignoreList.some(pattern => {
        if (pattern.startsWith('*.')) return false; // extension patterns don't apply to dirs
        return file.toLowerCase() === pattern.toLowerCase();
      });
      if (shouldIgnore) continue;

      findFiles(filepath, ext, results, ignoreList);
    } else if (file.endsWith(ext)) {
      // Check user config ignores for files (extension patterns)
      const shouldIgnore = ignoreList.some(pattern => {
        if (pattern.startsWith('*.')) {
          return file.toLowerCase().endsWith(pattern.slice(1).toLowerCase());
        }
        return false;
      });
      if (shouldIgnore) continue;

      results.push(filepath);
    }
  }
  return results;
}

function loadConfig(projectRoot = process.cwd()) {
  const fs = require('fs');
  const path = require('path');
  let configPath = path.join(projectRoot, '.codegraphxrc');
  let config = {};
  if (fs.existsSync(configPath)) {
    try {
      const rcRaw = fs.readFileSync(configPath, 'utf8').trim();
      config = JSON.parse(rcRaw);
    } catch (e) {
      console.error('[CodeGraphX] Failed to parse .codegraphxrc (must be JSON):', e.message);
    }
  } else {
    configPath = path.join(projectRoot, 'codegraphx.config.json');
    if (fs.existsSync(configPath)) {
      try {
        config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      } catch (e) {
        console.error('[CodeGraphX] Failed to parse codegraphx.config.json:', e.message);
      }
    }
  }
  // sensible defaults/merges
  // config.ignore = config.ignore || [".git", ".codegraphx", "node_modules", "__pycache__", "*.pyc"];
  config.ignore = config.ignore || [
  // Version control
  ".git",
  // Package managers
  "node_modules",
  // Python
  "__pycache__",
  ".venv",
  "venv",
  "ENV",
  "*.pyc",
  "*.pyo",
  "*.egg-info",
  ".pytest_cache",
  ".mypy_cache",
  ".ruff_cache",
  ".tox",
  // Build outputs
  "dist",
  "build",
  ".next",
  ".nuxt",
  "out",
  // Test coverage
  "coverage",
  ".nyc_output",
  // CodeGraphX own output
  ".codegraphx",
  // OS files
  ".DS_Store"
];
  config.outputDir = config.outputDir || ".codegraphx";
  config.outputFile = config.outputFile || "codebase.json";
  config.extensions = config.extensions || [".py"];
  return config;
}

module.exports = { ensureDirSync, writeJSONSync, findFiles, loadConfig };
