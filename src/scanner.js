// src/scanner.js
const path = require('path');
const fs = require('fs');
const { findFiles, writeJSONSync, ensureDirSync, loadConfig } = require('./utils');
const { GraphStore } = require('./store');
const { buildCallEdges } = require('./edgebuilder');

/**
 * Core scanning logic - extracts symbols, builds graph, outputs artifacts
 * Can be called by CLI or MCP server
 * @param {string} projectRoot - Absolute path to project root
 * @param {object} config - Loaded config object
 * @param {boolean} mcpMode - If true, skip heavy outputs (HTML, TOON) for faster MCP startup
 * @returns {Promise<object>} - The generated graph data { files, edges, generatedAt }
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
  
  // Parse files incrementally
  for (const filepath of files) {
    try {
      const contents = fs.readFileSync(filepath, 'utf8');
      await store.updateFile(filepath, contents);
    } catch (err) {
      // Log to stderr for MCP compatibility
      if (!mcpMode) console.error(`Failed to parse ${filepath}:`, err.message);
      else process.stderr.write(`[CodeGraphX] Parse error ${filepath}: ${err.message}\n`);
    }
  }
  
  const results = store.getFilesData();
  const edges = buildCallEdges(results);
  
  // Write main codebase JSON
  writeJSONSync(outputFile, { 
    files: results, 
    edges, 
    generatedAt: new Date().toISOString() 
  });
  store.saveCache();

  // === BLOOM FILTER (critical for MCP check_symbol_exists) ===
  try {
    const { BloomFilter } = require('bloom-filters');
    const allSymbols = results.flatMap(f => (f.symbols||[]).map(s => s.name).filter(Boolean));
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
      results.forEach(f => {
        d3Nodes.push({ id: f.file, type: "file" });
        (f.symbols||[]).forEach(s => {
          d3Nodes.push({ id: f.file+"::"+s.name, type: s.type||"symbol", file: f.file });
        });
      });
      const callLinks = edges.map(edge => ({ source: edge.from, target: edge.to, type: edge.type }));
      const importLinks = [];
      results.forEach(f => {
        (f.imports||[]).forEach(im => {
          const match = results.find(ff => path.basename(ff.file, path.extname(ff.file)) === im);
          if (match) {
            importLinks.push({ source: f.file, target: match.file, type: "IMPORTS" });
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
      const filesCount = results.length;
      const symbolsCount = results.reduce((n,f)=>n+(f.symbols?.length||0),0);
      let html = getHtml(JSON.stringify(graphData, null, 2), filesCount, symbolsCount);
      fs.writeFileSync(htmlFile, html, 'utf8');
    } catch (e) {
      console.warn('[DASHBOARD] Could not write codegraph.html:', e.message);
    }

    // === TOON OUTPUTS ===
    try {
      const { encode } = require('@toon-format/toon');
      const fileIndexToon = encode({ files: results.map(r => ({
        file: r.file,
        summary: (r.symbols||[]).filter(s => ['class', 'function'].includes(s.type)).map(s => s.name).join(', ') || 'No main symbols'
      })) });
      fs.writeFileSync(path.join(outputDir, 'file_index.toon'), fileIndexToon, 'utf8');
      
      const graphToon = encode({ files: results, edges });
      fs.writeFileSync(path.join(outputDir, 'codegraph.toon'), graphToon, 'utf8');
      
      let changelogData = {
        generatedAt: new Date().toISOString(),
        fileCount: results.length,
        symbolCount: results.reduce((n, f) => n + (f.symbols?.length||0), 0),
        sessions: []
      };
      try {
        const { scanCommit } = require('./git/commit-scanner');
        const gitSummary = scanCommit(projectRoot, store, 'HEAD');
        if (gitSummary) changelogData.sessions.push(gitSummary);
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

- Files: ${results.length}
- Symbols: ${results.reduce((n, f) => n + (f.symbols?.length||0), 0)}

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
  
  return { files: results, edges, generatedAt: new Date().toISOString() };
}

module.exports = { runScan };