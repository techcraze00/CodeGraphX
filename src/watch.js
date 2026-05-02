const path = require('path');
const fs = require('fs');
const chokidar = require('chokidar');
const { writeJSONSync, ensureDirSync, findFiles, loadConfig } = require('./utils');
const { GraphStore } = require('./store');
const { startServer, broadcast } = require('./server/ws-server');

module.exports = function () {
  const projectRoot = process.cwd();
  const config = loadConfig(projectRoot);
  const outputDir = path.join(projectRoot, config.outputDir);
  const outputFile = path.join(outputDir, config.outputFile);
  ensureDirSync(outputDir);
  const ignoreMatchers = (config.ignore || []).map(x => x.toLowerCase());

  const store = new GraphStore(projectRoot, config);

  function isIgnored(f) {
    return ignoreMatchers.some(pattern => {
      if (pattern.startsWith('*.')) return f.toLowerCase().endsWith(pattern.slice(1));
      const parts = f.split(path.sep);
      return parts.some(part => part.toLowerCase() === pattern);
    });
  }

  function updateFile(filepath) {
    try {
      const contents = fs.readFileSync(filepath, 'utf8');
      const res = store.updateFile(filepath, contents);
      const rel = path.relative(projectRoot, filepath);
      if (res.changed) {
        console.log(`📝 Updated: ${rel} (delta: +${res.delta.symbols.added.length} -${res.delta.symbols.removed.length} ~${res.delta.symbols.modified.length} symbols)`);
        broadcast({ type: 'delta', file: rel, delta: res.delta });
      }
    } catch (err) {
      console.error(`Failed to parse ${filepath}: ${err.message}`);
    }
  }

  function removeFile(filepath) {
    const res = store.removeFile(filepath);
    if (res.removed) {
      const rel = path.relative(projectRoot, filepath);
      console.log(`🗑️  Removed: ${rel}`);
      broadcast({ type: 'delta', file: rel, delta: res.delta });
    }
  }

  function writeGraph() {
    const files = store.getFilesData();
    // Rebuilding call edges is fast
    const { buildCallEdges } = require('./edgebuilder');
    const edges = buildCallEdges(files);
    
    writeJSONSync(outputFile, { files, edges, generatedAt: new Date().toISOString() });
    store.saveCache();
    console.log(`📡 CodeGraph updated: ${path.relative(projectRoot, outputFile)}`);
  }

  // Initial population
  console.log('👀 Watching for file changes...');
  const wsPort = config.wsPort || 6789;
  startServer(wsPort);

  let watchGlobs = (config.extensions || ['.py']).map(e => `**/*${e}`);
  watchGlobs = [...new Set(watchGlobs)];

  let allFiles = [];
  for (const ext of config.extensions || ['.py']) {
    allFiles.push(...findFiles(projectRoot, ext));
  }
  allFiles = allFiles.filter(f => !isIgnored(f));
  allFiles.forEach(updateFile);
  writeGraph();

  const watcher = chokidar.watch(watchGlobs, {
    cwd: projectRoot,
    ignored: (f) => isIgnored(f),
    ignoreInitial: true,
    persistent: true
  });

  let writeTimeout;
  function scheduleWrite() {
    if (writeTimeout) clearTimeout(writeTimeout);
    writeTimeout = setTimeout(() => {
      writeGraph();
    }, 300);
  }

  watcher
    .on('add',    f => { updateFile(f); scheduleWrite(); })
    .on('change', f => { updateFile(f); scheduleWrite(); })
    .on('unlink', f => { removeFile(f); scheduleWrite(); });

  process.on('SIGINT', () => {
    console.log('\n👋 Stopping watcher.');
    watcher.close();
    process.exit(0);
  });
};
