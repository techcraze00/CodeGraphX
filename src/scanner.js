// src/scanner.js
const path = require('path');
const fs = require('fs');
const { findFiles, writeJSONSync, ensureDirSync, loadConfig } = require('./utils');
const { GraphStore } = require('./store');
const { PostgresGraphStore } = require('./store/postgres-store');
const { db } = require('./db');
const { computeHash } = require('./differ');
const { extractEntities } = require('./entities');
const { buildEdges } = require('./edgebuilder');
const { Snapshot, FileEntity } = require('./entities');

/**
 * Core scanning logic - extracts symbols, builds graph, outputs artifacts
 * Can be called by CLI or MCP server
 * @param {string} projectRoot - Absolute path to project root
 * @param {object} config - Loaded config object
 * @param {boolean} mcpMode - If true, skip heavy outputs (HTML, TOON) for faster MCP startup
 * @returns {Promise<Snapshot>} - The generated snapshot
 */
async function runScan(projectRoot, config, mcpMode = false) {
  const outputDir = path.join(projectRoot, config.outputDir);
  const outputFile = path.join(outputDir, config.outputFile);

  ensureDirSync(outputDir);
  
  // Find files with configured extensions, respecting ignore list
  const ignoreList = config.ignore || [];
  let files = [];
  const extensions = config.extensions || ['.py'];
  for (const ext of extensions) {
    files.push(...findFiles(projectRoot, ext, [], ignoreList));
  }
  
  const store = new GraphStore(projectRoot, config);
  const pgStore = new PostgresGraphStore(db);
  
  // Use a fixed repo id for MVP or fetch from git
  let repositoryId = 'e7a0b381-b3a8-4c49-a274-81e9d4385bd2'; // Default known ID
  const repo = await db.selectFrom('repositories').selectAll().limit(1).executeTakeFirst();
  if (repo) repositoryId = repo.id;
  
  const commitHash = 'test-hash-' + Date.now(); // Mock hash for now
  const commitId = await pgStore.addCommit(repositoryId, commitHash, 'Scan', 'System');
  
  // Parse files incrementally
  for (const filepath of files) {
    try {
      const contents = fs.readFileSync(filepath, 'utf8');
      const relPath = path.relative(projectRoot, filepath);
      
      // New Postgres logic: persist file
      const newHash = computeHash(contents);
      const ext = path.extname(filepath).substring(1) || 'text';
      const fileId = await pgStore.updateFile(repositoryId, commitId, relPath, newHash, ext);
      
      const newEntities = await extractEntities(filepath, contents);
      if (newEntities.symbols && newEntities.symbols.length > 0) {
          // Format symbols for DB
          const dbSymbols = newEntities.symbols.map(s => ({
              name: s.name,
              qualified_name: s.id || s.name,
              kind: s.type, // DB uses 'kind' based on postgres-store.js
              symbol_hash: computeHash(JSON.stringify(s)),
              start_line: s.startPosition ? s.startPosition.row : 0,
              end_line: s.endPosition ? s.endPosition.row : 0,
              start_column: s.startPosition ? s.startPosition.column : 0,
              end_column: s.endPosition ? s.endPosition.column : 0
          }));
          await pgStore.updateSymbols(repositoryId, commitId, fileId, dbSymbols);
      }

      await store.updateFile(filepath, contents);
    } catch (err) {
      // Log to stderr for MCP compatibility
      if (!mcpMode) console.error(`Failed to parse ${filepath}:`, err.message);
      else process.stderr.write(`[CodeGraphX] Parse error ${filepath}: ${err.message}\n`);
    }
  }
  
  const filesData = store.getFilesData();
  const edges = buildEdges(filesData);

  // New Postgres logic: persist edges
  try {
    const activeSymbols = await db.selectFrom('symbols')
      .selectAll()
      .where('repository_id', '=', repositoryId)
      .where('valid_to_commit_id', 'is', null)
      .execute();

    const symMap = new Map(activeSymbols.map(s => [s.qualified_name, s.id]));
    const dbEdges = edges.map(e => {
      const fromId = symMap.get(e.from);
      const toId = symMap.get(e.to);
      if (fromId && toId) {
        return {
          repository_id: repositoryId,
          from_symbol_id: fromId,
          to_symbol_id: toId,
          type: e.type,
          confidence: 1.0,
          discovered_by: 'AST',
          edge_hash: computeHash(`${fromId}-${toId}-${e.type}`),
          valid_from_commit_id: commitId
        };
      }
      return null;
    }).filter(Boolean);

    if (dbEdges.length > 0) {
      await db.insertInto('edges').values(dbEdges).execute();
    }
  } catch (e) {
    if (!mcpMode) console.warn('[DB EDGES] Could not persist edges to Postgres:', e.message);
    else process.stderr.write(`[CodeGraphX] DB Edge error: ${e.message}\n`);
  }

  const snapshot = new Snapshot({    id: `snap-${Date.now()}`,
    timestamp: Date.now(),
    files: filesData.map(f => new FileEntity(f)),
    edges: edges
  });
  try {
    const { BloomFilter } = require('bloom-filters');
    const allSymbols = snapshot.files.flatMap(f => (f.symbols||[]).map(s => s.name).filter(Boolean));
    const bloom = BloomFilter.from(allSymbols, 0.01);
    const bloomJSON = JSON.stringify(bloom.saveAsJSON());
    fs.writeFileSync(path.join(outputDir, 'symbols.bloom'), bloomJSON, 'utf8');
  } catch (e) {
    if (!mcpMode) console.warn('[BLOOM] Could not generate symbols.bloom:', e.message);
    else process.stderr.write(`[CodeGraphX] Bloom filter error: ${e.message}\n`);
  }

  // Skip heavy outputs in MCP mode for faster startup
  if (!mcpMode) {
    // === D3-FORCE GRAPH OUTPUT ===
    try {
      const d3Nodes = [];
      snapshot.files.forEach(f => {
        d3Nodes.push({ id: f.path, type: "file" });
        (f.symbols||[]).forEach(s => {
          d3Nodes.push({ id: s.id, type: s.type||"symbol", file: f.path });
        });
      });
      const callLinks = snapshot.edges.map(edge => ({ source: edge.from, target: edge.to, type: edge.type }));
      const importLinks = [];
      const allFiles = snapshot.files.map(r => r.path);
      const { resolveImport } = require('./resolver');
      
      snapshot.files.forEach(f => {
        (f.imports||[]).forEach(im => {
          const matchPath = resolveImport(f.path, im, allFiles, projectRoot);
          if (matchPath) {
            importLinks.push({ source: f.path, target: matchPath, type: "IMPORTS" });
          }
        });
      });
      const d3Graph = { nodes: d3Nodes, links: [...callLinks, ...importLinks] };
      fs.writeFileSync(path.join(outputDir, 'codegraph-graph.json'), JSON.stringify(d3Graph, null, 2), 'utf8');
    } catch (e) {
      console.warn('[GRAPH GEN] Could not write codegraph-graph.json:', e.message);
    }

    // === HTML DASHBOARD OUTPUT ===
    try {
      const htmlFile = path.join(outputDir, 'codegraph.html');
      const graphData = JSON.parse(fs.readFileSync(path.join(outputDir, 'codegraph-graph.json'), 'utf8'));
      const { getHtml } = require('./dashboard');
      const filesCount = snapshot.files.length;
      const symbolsCount = snapshot.files.reduce((n,f)=>n+(f.symbols?.length||0),0);
      let html = getHtml(JSON.stringify(graphData, null, 2), filesCount, symbolsCount);
      fs.writeFileSync(htmlFile, html, 'utf8');
    } catch (e) {
      console.warn('[DASHBOARD] Could not write codegraph.html:', e.message);
    }

    // === TOON OUTPUTS ===
    try {
      const { encode } = require('@toon-format/toon');
      const fileIndexToon = encode({ files: snapshot.files.map(r => ({
        file: r.path,
        summary: (r.symbols||[]).filter(s => ['class', 'function'].includes(s.type)).map(s => s.name).join(', ') || 'No main symbols'
      })) });
      fs.writeFileSync(path.join(outputDir, 'file_index.toon'), fileIndexToon, 'utf8');
      
      const graphToon = encode(snapshot.toJSON());
      fs.writeFileSync(path.join(outputDir, 'codegraph.toon'), graphToon, 'utf8');
      
      let changelogData = {
        generatedAt: new Date(snapshot.timestamp).toISOString(),
        fileCount: snapshot.files.length,
        symbolCount: snapshot.files.reduce((n, f) => n + (f.symbols?.length||0), 0),
        sessions: []
      };
      try {
        const { scanCommit } = require('./git/commit-scanner');
        const gitSummary = scanCommit(projectRoot, store, 'HEAD');
        if (gitSummary) changelogData.sessions.push(gitSummary.toJSON());
      } catch(e) {}
      
      const changelogToon = encode(changelogData);
      fs.writeFileSync(path.join(outputDir, 'CHANGELOG.toon'), changelogToon, 'utf8');
    } catch (e) {
      console.warn('[TOON] Could not generate .toon output:', e.message);
    }

    // === GEMINI.md AGENT INTEGRATION ===
    const geminiMdPath = path.join(projectRoot, 'GEMINI.md');
    if (!fs.existsSync(geminiMdPath)) {
      const mdContent = `# Project Context (Auto-generated by CodeGraphX)
Last updated: ${new Date().toISOString()}

## How to Navigate This Codebase

- Files: ${snapshot.files.length}
- Symbols: ${snapshot.files.reduce((n, f) => n + (f.symbols?.length||0), 0)}

## MCP Server
Add to .gemini/mcp.json:
\`\`\`json
{
  "mcpServers": {
    "codegraphx": {
      "command": "npx",
      "args": ["cgx-mcp"],
      "cwd": "${projectRoot}"
    }
  }
}
\`\`\`
`;
      try {
        fs.writeFileSync(geminiMdPath, mdContent, 'utf8');
      } catch(e) {
        console.warn('Could not write GEMINI.md:', e.message);
      }
    }
  }
  
  return snapshot;
}

module.exports = { runScan };