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

function findFiles(rootDir, ext, results = []) {
  const files = fs.readdirSync(rootDir);
  for (const file of files) {
    const filepath = path.join(rootDir, file);
    const stat = fs.statSync(filepath);
    if (stat.isDirectory()) {
      if ([".git", ".codegraphx", "node_modules", "__pycache__"].includes(file)) continue;
      findFiles(filepath, ext, results);
    } else if (file.endsWith(ext)) {
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
  config.ignore = config.ignore || [".git", ".codegraphx", "node_modules", "__pycache__", "*.pyc"];
  config.outputDir = config.outputDir || ".codegraphx";
  config.outputFile = config.outputFile || "codebase.json";
  config.extensions = config.extensions || [".py"];
  return config;
}

module.exports = { ensureDirSync, writeJSONSync, findFiles, loadConfig };
