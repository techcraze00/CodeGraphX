#!/usr/bin/env node

const { program } = require('commander');

program
  .name('codegraphx')
  .description('CodeGraphX - Codebase graphing and analysis tool')
  .version('1.0.0');

function runScan() {
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
  
  const ignoreMatchers = (config.ignore || []).map(name => name.toLowerCase());
  pyFiles = pyFiles.filter(f =>
    !ignoreMatchers.some(pattern => {
      if (pattern.startsWith('*.')) return f.toLowerCase().endsWith(pattern.slice(1));
      const parts = f.split(path.sep);
      return parts.some(part => part.toLowerCase() === pattern);
    })
  );
  
  console.log(`Found ${pyFiles.length} file(s).`);
  
  const store = new GraphStore(projectRoot, config);
  
  let changedFilesCount = 0;
  pyFiles.forEach(filepath => {
    try {
      const contents = fs.readFileSync(filepath, 'utf8');
      const res = store.updateFile(filepath, contents);
      if (res.changed) changedFilesCount++;
    } catch (err) {
      console.error(`Failed to parse ${filepath}:`, err.message);
    }
  });
  
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
     let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset='utf-8'>
  <title>CodeGraphX – Interactive Graph Dashboard (vis.js)</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <link href="https://unpkg.com/vis-network/styles/vis-network.min.css" rel="stylesheet" type="text/css" />
  <style>
    body { font-family:sans-serif; background:#fafafe; margin:0; display:flex; height:100vh; }
    .sidebar { background:#fff; min-width:280px; max-width:320px; width:21%; height:100vh; overflow-y:auto; padding:1.2em 1em 2em 1.5em; border-right:1px solid #eee; box-shadow:1px 0 6px #0001; }
    .sidebar h2 { font-size:1.2em; margin-bottom:0.7em; color:#805ad5; }
    .file-list { list-style: none; padding-left: 0; }
     .file-list li {
      margin: 0.13em 0; cursor:pointer; padding:2px 7px; border-radius:4px; font-size:15px; transition:background 0.13s;
      display:flex; align-items:center;
    }
     .file-list li:hover { background: #e9e6f7; }
     .symbol-entry {
      margin-left:0em;
      font-size:13px;
      color:#757;
      border-left:2.5px solid #efecfc; background:none;
      padding-left:0.55em;
    }
     .file-entry {
      font-size:15px;
      color:#374174;
      font-weight:600;
      margin-top:0.35em;
      border-bottom:1px solid #efefef88;
      padding-bottom:1px;
      transition:background 0.13s;
    }
     .file-entry:focus {
      outline: 2px solid #845ad5;
      outline-offset:0;
    }
     .file-entry:hover { background: #f4f1ff; }
    main { flex:1; display:flex; flex-direction:column; height:100vh; }
    header { flex:0 0 auto; text-align:center; padding:18px 0 0 0; background:#fafafe; font-size:1.65em; letter-spacing:0.5px; color:#805ad5; font-weight:600; }
    #viz-graph { flex:1; margin:0; min-height:0; height:74vh; }
    .stats { background:#f4f4fa;margin:1em 1.3em 0.2em 1.3em;border-radius:6px;padding:10px 0.8em; }
    .legend { margin:1em 2.2em 0.2em 2.2em; color:#576; font-size:14px; }
    .legend span { display:inline-block;width:14px;height:14px;margin:0 3px 0 7px;border-radius:3px; }
    footer { color:#bbb; padding:3em 0 0 0; text-align:center; font-size:14px; }
  </style>
</head>
<body>
  <div class="sidebar">
    <h2><i class="fa fa-folder"></i> File Structure</h2>
    <ul class="file-list" id="file-list"></ul>
  </div>
  <main>
    <header>CodeGraphX – Interactive Code Graph</header>
    <div class="stats"><b>Files:</b> ${results.length}  <b>Total symbols:</b> ${results.reduce((n,f)=>n+(f.symbols?.length||0),0)} </div>
    <div id="viz-graph"></div>
    <div class='legend'><b>Legend:</b>
      <span style='background:#3593ee'></span> File
      <span style='background:#cf78e6'></span> Function
      <span style='background:#78c091'></span> Class
    </div>
    <footer>CodeGraphX agent dashboard &copy; 2026</footer>
  </main>
  <script type="text/javascript" src="https://unpkg.com/vis-network/standalone/umd/vis-network.min.js"></script>
  <script>
    const graphData = __GRAPH_DATA__;
    // Map types to vis.js colors
    const colorMap = {file:'#3593ee',function:'#cf78e6',class:'#78c091',symbol:'#888', default:'#888'};
    // Convert to vis style
    const visNodes = graphData.nodes.map(n=>({
      id:n.id,
      label:n.id.includes('::')?n.id.split('::')[1]:(n.id.split('/').pop()||n.id),
      title:'<b>'+n.id+'</b>' + (n.type?'<br>Type: '+n.type:''),
      group: n.type||'symbol',
      color: colorMap[n.type] || colorMap.default,
      shape: n.type==='file' ? 'box' : (n.type==='class'?'diamond':'ellipse'),
      font: {size: n.type==='file'?16:13}
    }));
    const visEdges = graphData.links.map(l=>({from:l.source, to:l.target, color:l.type==='CALLS'?'#90a':'#999', dashes:l.type!=='CALLS'}));
    // Init network
    const container = document.getElementById('viz-graph');
    const data = { nodes: new vis.Network.DataSet(visNodes), edges: new vis.Network.DataSet(visEdges) };
    const options = {
      layout: { improvedLayout:true },
      physics: { enabled:true, barnesHut:{springLength:160, avoidOverlap:0.31}, stabilization:{iterations:500} },
      groups:{ file:{color:'#3593ee'}, function:{color:'#cf78e6'}, class:{color:'#78c091'} },
      nodes:{ shape:'ellipse', font:{size:13} },
      edges:{ arrows:'to', color:'#888', smooth:true },
      interaction:{ hover:true, tooltipDelay:138, navigationButtons:true, selectable:true }
    };
    const network = new vis.Network(container, data, options);
    // ----------- Sidebar (file/symbol tree) -----------
     // --- Enhanced Sidebar with search, icons, expand/collapse ---
     const fileList = document.getElementById('file-list');
     // Insert search box
     const searchInput = document.createElement('input');
     searchInput.type = 'text';
     searchInput.placeholder = 'Search files/symbols...';
     searchInput.style.width = '97%';
     searchInput.style.margin = '2px 0 10px 0';
     searchInput.style.padding = '6px 8px';
     searchInput.style.borderRadius = '5px';
     searchInput.style.border = '1px solid #eee';
     fileList.parentNode.insertBefore(searchInput, fileList);

     const files = graphData.nodes.filter(n => n.type==='file');
     function getTypeIcon(type) {
       // FontAwesome or emoji
       if (type==='file') return '<i class="fa fa-file-code" style="color:#3593ee"></i>';
       if (type==='function') return '<i class="fa fa-circle-nodes" style="color:#cf78e6"></i>';
       if (type==='class') return '<i class="fa fa-cube" style="color:#78c091"></i>';
       return '<i class="fa fa-dot-circle" style="color:#888"></i>';
     }

     function renderSidebar(filter='') {
       fileList.innerHTML = '';
       files.forEach((f, fi) => {
         if (filter && !f.id.toLowerCase().includes(filter) && !(graphData.nodes.some(sym=>sym.file===f.id && (sym.id.split('::')[1]||'').toLowerCase().includes(filter)))) return;
         // File li (collapsible)
         const li = document.createElement('li');
         li.className = 'file-entry';
         li.setAttribute('tabindex', 0);

         // Chevron for collapse/expand
         const chevron = document.createElement('span');
         chevron.innerHTML = '<i class="fa fa-chevron-down"></i>';
         chevron.style.marginRight = '7px';
         chevron.style.cursor = 'pointer';
         chevron.style.color = '#beb';
         chevron.onclick = (e)=>{
           e.stopPropagation();
           const visible = symbolsUL.style.display !== 'none';
           symbolsUL.style.display = visible ? 'none' : 'block';
            chevron.innerHTML = '<i class="fa fa-chevron-' + (visible ? 'right' : 'down') + '"></i>';

         };
         li.appendChild(chevron);

         // File icon and name
         const fiElem = document.createElement('span');
         fiElem.innerHTML = getTypeIcon('file') + ' ' + f.id;
         fiElem.style.fontWeight = '600';
         fiElem.style.marginRight = '8px';
         li.appendChild(fiElem);
         li.onclick = ()=> { network.selectNodes([f.id], true); network.focus(f.id, {scale:1.2, animation: {duration:400,easingFunction:'easeInOutQuad'}} ); };

         // Nested symbols
         const symbolsUL = document.createElement('ul');
         symbolsUL.style.listStyle = 'none';
         symbolsUL.style.marginLeft = '2.1em';
         symbolsUL.style.padding = '0';

         // Get all symbols for this file
         (graphData.nodes.filter(n => n.file===f.id && n.type!=='file')).forEach(sym => {
           if (filter && !(sym.id.split('::')[1]||'').toLowerCase().includes(filter) && !f.id.toLowerCase().includes(filter)) return;
           const symLi = document.createElement('li');
           symLi.className = 'symbol-entry';
           symLi.style.marginBottom = '2px';
           symLi.style.display = 'flex';
           symLi.style.alignItems = 'center';
           symLi.innerHTML = '<span style="font-size:13px; width:1.3em; display:inline-block;">' + getTypeIcon(sym.type) + '</span><span style="margin-left:0.4em;">' + (sym.id.split('::')[1] || sym.id) + '</span>';
           symLi.title = sym.type||'';
           symLi.onclick = (e)=> {
             e.stopPropagation();
             network.selectNodes([sym.id], true);
             network.focus(sym.id, {scale:1.23, animation:{duration:400,easingFunction:'easeInOutQuad'}});
           };
           symbolsUL.appendChild(symLi);
         });
         li.appendChild(symbolsUL);
         fileList.appendChild(li);
       });
     }

     // wire up search
     searchInput.oninput = function(){
       renderSidebar(this.value.toLowerCase());
     };
     renderSidebar();
     // Node click focuses sidebar
     network.on('select', (params) => {
       if(params.nodes.length===1){
         const sel = params.nodes[0];
         // find matching sidebar entry (file or symbol)
         let found = null;
         Array.from(fileList.querySelectorAll('.file-entry')).forEach(fli => {
           if(fli.textContent.includes(sel) && sel.indexOf('::')===-1) found = fli;
           // if symbol
           Array.from(fli.querySelectorAll('.symbol-entry')).forEach(sli => {
             if(sli.textContent === (sel.split('::')[1] || sel)) found = sli;
           });
         });
         if(found){
           found.scrollIntoView({behavior:'smooth', block:'center'});
           found.style.background='#dedcff';
           setTimeout(()=>found.style.background='', 700);
         }
       }
     });
  </script>
</body>
</html>`;
html = html.replace('const graphData = __GRAPH_DATA__;', 'const graphData = ' + JSON.stringify(graphData, null, 2) + ';');
fs.writeFileSync(htmlFile, html, 'utf8');
     console.log('📊 codegraph.html dashboard written.');
   } catch (e) {
     console.warn('[DASHBOARD] Could not write codegraph.html:', e.message);
   }

  // === TOON OUTPUTS ===
  try {
    const { encode } = require('@toon-format/toon');
    // file_index.toon: flat index of filenames
    const fileIndexToon = encode({ files: results.map(r => r.file) });
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
  .action(() => { runScan(); });

program
  .command('scan')
  .description('One-off scan of codebase (identical to init)')
  .action(() => { runScan(); });

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
  .action(() => {
    require('./watch')();
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
  .description('Install/remove a pre-commit hook to auto-run codegraphx scan')
  .action((action) => {
    const fs = require('fs');
    const path = require('path');
    if (!['install', 'remove'].includes(action)) {
      console.error(`Unknown action: ${action}. Use "install" or "remove".`);
      process.exit(1);
    }
    const hookPath = path.join(process.cwd(), '.git', 'hooks', 'pre-commit');
    if (action === 'install') {
      const hook = `#!/bin/sh\ncommand -v codegraphx > /dev/null && codegraphx scan\n`;
      fs.writeFileSync(hookPath, hook, { mode: 0o755 });
      console.log('✅ Pre-commit hook installed (runs codegraphx scan).');
    } else if (action === 'remove') {
      if (fs.existsSync(hookPath)) {
        fs.unlinkSync(hookPath);
        console.log('✅ Pre-commit hook removed.');
      } else {
        console.log('No pre-commit hook to remove.');
      }
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
    const { execSync } = require('child_process');
    const diffStr = execSync(`git diff ${branchA} ${branchB} --unified=0`, { encoding: 'utf8' }).trim();
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




