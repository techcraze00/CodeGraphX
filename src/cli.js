#!/usr/bin/env node

const { program } = require('commander');

program
  .name('codegraphx')
  .description('CodeGraphX - Codebase graphing and analysis tool')
  .version('1.0.0');

async function runScan() {
  const path = require('path');
  const fs = require('fs');
  const { findFiles, writeJSONSync, ensureDirSync, loadConfig } = require('./utils');
  const { GraphStore } = require('./store');
  const projectRoot = process.cwd();
  const config = loadConfig(projectRoot);
  const outputDir = path.join(projectRoot, config.outputDir);
  const outputFile = path.join(outputDir, config.outputFile);
  
  ensureDirSync(outputDir);
  console.log('🔍 Scanning for files:', config.extensions.join(', '));
  
  let pyFiles = [];
  config.extensions.forEach(ext => {
    pyFiles.push(...findFiles(projectRoot, ext));
  });

  // Auto-generate .codegraphxrc if it doesn't exist
  const rcPath = path.join(projectRoot, '.codegraphxrc');
    if (!fs.existsSync(rcPath)) {
      const defaultConfig = {
        ignore: [
        ".git",
        "node_modules", 
        "__pycache__",
        ".venv",
        "venv",
        "dist",
        "build",
        ".next",
        "coverage",
        ".codegraphx",
        "*.pyc",
        "*.egg-info"
      ],
      outputDir: ".codegraphx",
      outputFile: "codebase.json",
      extensions: [".py", ".js", ".ts", ".jsx", ".tsx"]
    };
    try {
      fs.writeFileSync(rcPath, JSON.stringify(defaultConfig, null, 2), 'utf8');
      console.log('⚙️  .codegraphxrc generated with sensible defaults.');
    } catch(e) {
      console.warn('Could not write .codegraphxrc:', e.message);
    }
  }
  
  // const ignoreMatchers = (config.ignore || []).map(name => name.toLowerCase());
  // pyFiles = pyFiles.filter(f =>
  //   !ignoreMatchers.some(pattern => {
  //     if (pattern.startsWith('*.')) return f.toLowerCase().endsWith(pattern.slice(1));
  //     const parts = f.split(path.sep);
  //     return parts.some(part => part.toLowerCase() === pattern);
  //   })
  // );
  
  console.log(`Found ${pyFiles.length} file(s).`);
  
  const store = new GraphStore(projectRoot, config);
  
  let changedFilesCount = 0;
  for (const filepath of pyFiles) {
    try {
      const contents = fs.readFileSync(filepath, 'utf8');
      const res = await store.updateFile(filepath, contents);
      if (res.changed) changedFilesCount++;
    } catch (err) {
      console.error(`Failed to parse ${filepath}:`, err.message);
    }
  }
  
  console.log(`Parsed ${changedFilesCount} changed files (${pyFiles.length - changedFilesCount} cached).`);
  
  const results = store.getFilesData();
  
  // Build cross-file edges and add called_by
  const { buildCallEdges } = require('./edgebuilder');
  const edges = buildCallEdges(results);
  writeJSONSync(outputFile, { files: results, edges, generatedAt: new Date().toISOString() });
  store.saveCache();

  // === BLOOM FILTER OUTPUT ===
  try {
    const { BloomFilter } = require('bloom-filters');
    // collect all symbol names
    const allSymbols = results.flatMap(f => (f.symbols||[]).map(s => s.name).filter(Boolean));
    const bloom = BloomFilter.from(allSymbols, 0.01); // 1% default error rate
    const bloomJSON = JSON.stringify(bloom.saveAsJSON());
    fs.writeFileSync(path.join(outputDir, 'symbols.bloom'), bloomJSON, 'utf8');
    console.log('🌼 Bloom filter written: symbols.bloom');
  } catch (e) {
    console.warn('[BLOOM] Could not generate symbols.bloom:', e.message);
  }

   // === D3-FORCE GRAPH OUTPUT ===
   try {
     // Build {nodes:[{id,...}], links:[{source,target,type}]} for D3
     const d3Nodes = [];
     const nodeSet = new Set();
     results.forEach(f => {
       d3Nodes.push({ id: f.file, type: "file" });
       nodeSet.add(f.file);
       (f.symbols||[]).forEach(s => {
         d3Nodes.push({ id: f.file+"::"+s.name, type: s.type||"symbol", file: f.file });
         nodeSet.add(f.file+"::"+s.name);
       });
     });
     // Call edges already computed by edgebuilder
     const callLinks = edges.map(edge => ({ source: edge.from, target: edge.to, type: edge.type }));
     // Import edges
     const importLinks = [];
     results.forEach(f => {
       (f.imports||[]).forEach(im => {
         // Try to find a file whose basename matches the import (best effort)
         const match = results.find(ff => path.basename(ff.file, path.extname(ff.file)) === im);
         if (match) {
           importLinks.push({ source: f.file, target: match.file, type: "IMPORTS" });
         }
       });
     });
     const d3Graph = { nodes: d3Nodes, links: [...callLinks, ...importLinks] };
     fs.writeFileSync(path.join(outputDir, 'codegraph-graph.json'), JSON.stringify(d3Graph, null, 2), 'utf8');
     console.log('🌐 codegraph-graph.json (D3 graph) written.');
   } catch (e) {
     console.warn('[GRAPH GEN] Could not write codegraph-graph.json:', e.message);
   }

   // === HTML DASHBOARD OUTPUT ===
   try {
     const htmlFile = path.join(outputDir, 'codegraph.html');
     // Inline the codegraph-graph.json for simplicity
     const graphData = JSON.parse(fs.readFileSync(path.join(outputDir, 'codegraph-graph.json'), 'utf8'));
     const { getHtml } = require('./dashboard');
     const filesCount = results.length;
     const symbolsCount = results.reduce((n,f)=>n+(f.symbols?.length||0),0);
     let html = getHtml(JSON.stringify(graphData, null, 2), filesCount, symbolsCount);
fs.writeFileSync(htmlFile, html, 'utf8');
     console.log('📊 codegraph.html dashboard written.');
   } catch (e) {
     console.warn('[DASHBOARD] Could not write codegraph.html:', e.message);
   }

  // === TOON OUTPUTS ===
  try {
    const { encode } = require('@toon-format/toon');
    // file_index.toon: flat index of filenames
    const fileIndexToon = encode({ files: results.map(r => ({
      file: r.file,
      summary: (r.symbols||[]).filter(s => ['class', 'function'].includes(s.type)).map(s => s.name).join(', ') || 'No main symbols'
    })) });
    fs.writeFileSync(path.join(outputDir, 'file_index.toon'), fileIndexToon, 'utf8');
    
    // codegraph.toon: main result (files, symbols, edges)
    const graphToon = encode({ files: results, edges });
    fs.writeFileSync(path.join(outputDir, 'codegraph.toon'), graphToon, 'utf8');
    
    // CHANGELOG.toon
    let changelogData = {
      generatedAt: new Date().toISOString(),
      fileCount: results.length,
      symbolCount: results.reduce((n, f) => n + (f.symbols?.length||0), 0),
      sessions: []
    };
    try {
      const { scanCommit } = require('./git/commit-scanner');
      const gitSummary = scanCommit(projectRoot, store, 'HEAD');
      if (gitSummary) {
        changelogData.sessions.push(gitSummary);
      }
    } catch(e) {}
    
    const changelogToon = encode(changelogData);
    fs.writeFileSync(path.join(outputDir, 'CHANGELOG.toon'), changelogToon, 'utf8');
    console.log('📝 .toon files written: file_index.toon, codegraph.toon, CHANGELOG.toon');
  } catch (e) {
    console.warn('[TOON] Could not generate .toon output:', e.message);
  }
  
  // === AGENT INTEGRATION (GEMINI.md) ===
  const geminiMdPath = path.join(projectRoot, 'GEMINI.md');
  if (!fs.existsSync(geminiMdPath)) {
    const mdContent = `# Project Context (Auto-generated by CodeGraphX)
Last updated: ${new Date().toISOString()}

## How to Navigate This Codebase (DO THIS FIRST)

This project uses CodeGraphX for codebase navigation. 
NEVER scan individual files to understand structure. Instead:

### Step 1: Orient yourself (always do this at session start)
Read: \`.codegraphx/file_index.toon\`
This gives you a one-liner summary of every file.

### Step 2: Check what changed since last session
Read: \`.codegraphx/CHANGELOG.toon\`
This tells you what was built/changed in previous sessions. To verify task completion, run \`codegraphx session summary\`. Match \`changed_nodes\` to task requirements.

### Step 3: Check if a function/class exists
Read: \`.codegraphx/symbols.json\` (or bloom if needed)

### Step 4: Understand dependencies (only when needed)
Read: \`.codegraphx/codegraph.toon\`
Full graph with all calls and relationships. Look at \`called_by\` for impact analysis.

## Project Stats
- Files: ${results.length}
- Symbols: ${results.reduce((n, f) => n + (f.symbols?.length||0), 0)}

## MCP Server Configuration
If your agent supports MCP, add this to your .gemini/mcp.json:
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
The cwd is pre-filled with this project's absolute path.
Run \`npx codegraphx init\` before starting any agent session.
`;
    try {
      fs.writeFileSync(geminiMdPath, mdContent, 'utf8');
      console.log('🤖 GEMINI.md agent instructions generated.');
    } catch(e) {
      console.warn('Could not write GEMINI.md:', e.message);
    }
  }
  
  console.log(`✅ CodeGraph written to ${path.relative(projectRoot, outputFile)}`);
}

program
  .command('init')
  .description('Initialize the code graph project')
  .action(async () => { await runScan(); });

program
  .command('scan')
  .description('One-off scan of codebase (identical to init)')
  .action(async () => { await runScan(); });

program
  .command('dashboard')
  .description('Open the static codegraph.html dashboard in your browser')
  .action(() => {
    const path = require('path');
    const fs = require('fs');
    const { exec } = require('child_process');
    const outputDir = path.join(process.cwd(), '.codegraphx');
    const htmlFile = path.join(outputDir, 'codegraph.html');
    if (!fs.existsSync(htmlFile)) {
      console.error('No codegraph.html found, run `codegraphx scan` first.');
      process.exit(1);
    }
    const openCmd =
      process.platform === 'darwin' ? 'open' :
      process.platform === 'win32' ? 'start' : 'xdg-open';
    exec(`${openCmd} "${htmlFile}"`);
    console.log('Opening codegraph.html dashboard...');
  });

program
  .command('stats')
  .description('Print codebase/symbol/edge stats summary to console')
  .action(() => {
    const fs = require('fs');
    const path = require('path');
    const outputDir = path.join(process.cwd(), '.codegraphx');
    const jsonFile = path.join(outputDir, 'codebase.json');
    const fallback = path.join(outputDir, 'custom_codebase.json');
    let cgData;
    if (fs.existsSync(jsonFile))
      cgData = JSON.parse(fs.readFileSync(jsonFile));
    else if (fs.existsSync(fallback))
      cgData = JSON.parse(fs.readFileSync(fallback));
    else {
      console.error('No codebase.json found. Run `codegraphx scan` first.');
      process.exit(1);
    }
    const fileCount = cgData.files.length;
    const symbolCount = cgData.files.reduce((n,f)=>n+(f.symbols?.length||0),0);
    const classCount = cgData.files.reduce((n,f)=>n+(f.symbols?.filter(s=>s.type==="class").length||0),0);
    const funcCount = cgData.files.reduce((n,f)=>n+(f.symbols?.filter(s=>s.type==="function").length||0),0);
    const edgeCount = cgData.edges.length;
    console.log(`CodeGraphX Stats:\n  Files: ${fileCount}\n  Symbols: ${symbolCount}\n    - Functions: ${funcCount}\n    - Classes: ${classCount}\n  Edges: ${edgeCount}`);
  });

program
  .command('watch')
  .description('Watch Python files and auto-update graph on change')
  .action(async () => {
    await require('./watch')();
  });

program
  .command('query <symbol>')
  .description('Show details (files, edges, calls, called_by) for a symbol')
  .action((sym) => {
    const fs = require('fs');
    const path = require('path');
    const outputDir = path.join(process.cwd(), '.codegraphx');
    const jsonFile = path.join(outputDir, 'codebase.json');
    const fallback = path.join(outputDir, 'custom_codebase.json');
    let cgData;
    if (fs.existsSync(jsonFile))
      cgData = JSON.parse(fs.readFileSync(jsonFile));
    else if (fs.existsSync(fallback))
      cgData = JSON.parse(fs.readFileSync(fallback));
    else {
      console.error('No codebase.json found. Run `codegraphx scan` first.');
      process.exit(1);
    }
    let matches = [];
    cgData.files.forEach(f => {
      (f.symbols||[]).forEach(s => { if (s.name === sym) matches.push({file: f.file, symbol: s}); });
    });
    if (!matches.length) {
      console.error(`No symbol named "${sym}" found.`);
      process.exit(1);
    }
    matches.forEach(match => {
      console.log(`\nFile: ${match.file}`);
      console.log(`Type: ${match.symbol.type}`);
      if (match.symbol.startPosition)
        console.log(`Location: row ${match.symbol.startPosition.row+1}`);
      if (match.symbol.calls) console.log(`Calls: ${match.symbol.calls.join(', ')}`);
      if (match.symbol.called_by) console.log(`Called by: ${match.symbol.called_by.join(', ')}`);
      if (match.symbol.imports) console.log(`Imports: ${match.symbol.imports.join(', ')}`);
    });
  });

program
  .command('impact <symbol>')
  .description('Trace all symbols directly/indirectly impacted by <symbol> (calls, call graph)')
  .action((sym) => {
    const fs = require('fs');
    const path = require('path');
    const outputDir = path.join(process.cwd(), '.codegraphx');
    const jsonFile = path.join(outputDir, 'codebase.json');
    const fallback = path.join(outputDir, 'custom_codebase.json');
    let cgData;
    if (fs.existsSync(jsonFile))
      cgData = JSON.parse(fs.readFileSync(jsonFile));
    else if (fs.existsSync(fallback))
      cgData = JSON.parse(fs.readFileSync(fallback));
    else {
      console.error('No codebase.json found. Run `codegraphx scan` first.');
      process.exit(1);
    }
    // Find root(s)
    let roots = [];
    cgData.files.forEach(f => {
      (f.symbols||[]).forEach(s => { if (s.name === sym) roots.push({file: f.file, symbol: s}); });
    });
    if (!roots.length) {
      console.error(`No symbol named "${sym}" found.`);
      process.exit(1);
    }
    // build forward graph
    const callEdges = cgData.edges.filter(e => e.type === 'CALLS');
    const visited = new Set();
    function printImpact(symFull, depth) {
      if (visited.has(symFull)) return;
      visited.add(symFull);
      const indent = '  '.repeat(depth);
      console.log(`${indent}${symFull}`);
      callEdges.forEach(e => {
        if (e.from === symFull) {
          printImpact(e.to, depth + 1);
        }
      });
    }
    roots.forEach(({file, symbol}) => {
      const symFull = `${file}::${symbol.name}`;
      printImpact(symFull, 0);
    });
  });

program
  .command('git-hook <action>')
  .description('Install/remove post-commit and pre-push hooks to auto-run codegraphx scan')
  .action((action) => {
    const fs = require('fs');
    const path = require('path');
    if (!['install', 'remove'].includes(action)) {
      console.error(`Unknown action: ${action}. Use "install" or "remove".`);
      process.exit(1);
    }
    const hooks = ['post-commit', 'pre-push'];
    const hookScript = `#!/bin/sh\ncommand -v codegraphx > /dev/null && codegraphx scan\n`;
    
    if (action === 'install') {
      hooks.forEach(hook => {
        const hookPath = path.join(process.cwd(), '.git', 'hooks', hook);
        fs.writeFileSync(hookPath, hookScript, { mode: 0o755 });
      });
      console.log('✅ post-commit and pre-push hooks installed (runs codegraphx scan).');
    } else if (action === 'remove') {
      hooks.forEach(hook => {
        const hookPath = path.join(process.cwd(), '.git', 'hooks', hook);
        if (fs.existsSync(hookPath)) {
          fs.unlinkSync(hookPath);
        }
      });
      console.log('✅ post-commit and pre-push hooks removed.');
    }
  });

program
  .command('session summary')
  .description('Output a structural summary of changes in the current session/commit')
  .option('-b, --branch <branch>', 'Branch to compare against', 'HEAD')
  .action((options) => {
    const path = require('path');
    const { loadConfig } = require('./utils');
    const { GraphStore } = require('./store');
    const { scanCommit } = require('./git/commit-scanner');
    
    const projectRoot = process.cwd();
    const config = loadConfig(projectRoot);
    const store = new GraphStore(projectRoot, config);
    
    const summary = scanCommit(projectRoot, store, options.branch);
    if (!summary) {
      console.log('No changes detected or not a git repository.');
      return;
    }
    
    console.log(JSON.stringify(summary, null, 2));
  });

program
  .command('diff <branch_a> <branch_b>')
  .description('Output AST delta between two branches')
  .action((branchA, branchB) => {
    const { execFileSync } = require('child_process');
    const diffStr = execFileSync('git', ['diff', branchA, branchB, '--unified=0'], { encoding: 'utf8' }).trim();
    if (!diffStr) {
      console.log('No differences.');
      return;
    }
    const { parseDiff, mapDiffToNodes, generateSummary } = require('./git/commit-scanner');
    const { loadConfig } = require('./utils');
    const { GraphStore } = require('./store');
    
    const projectRoot = process.cwd();
    const config = loadConfig(projectRoot);
    const store = new GraphStore(projectRoot, config);
    
    const changes = parseDiff(diffStr);
    const impactedNodes = mapDiffToNodes(changes, store.getFilesData());
    const ruleSummary = generateSummary(diffStr);
    
    console.log(JSON.stringify({
      from: branchA,
      to: branchB,
      changed_nodes: impactedNodes,
      rule_summary: ruleSummary
    }, null, 2));
  });

program.parse(process.argv);
