function getHtml(graphDataStr, filesCount, symbolsCount) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset='utf-8'>
  <title>CodeGraphX – Interactive Graph Dashboard (D3.js)</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <style>
    body { font-family:sans-serif; background:#fafafe; margin:0; display:flex; height:100vh; overflow:hidden; }
    .sidebar { background:#fff; min-width:280px; max-width:320px; width:21%; height:100vh; overflow-y:auto; padding:1.2em 1em 2em 1.5em; border-right:1px solid #eee; box-shadow:1px 0 6px #0001; }
    .sidebar h2 { font-size:1.2em; margin-bottom:0.7em; color:#805ad5; }
    .file-list { list-style: none; padding-left: 0; }
    .file-list li { margin: 0.13em 0; cursor:pointer; padding:2px 7px; border-radius:4px; font-size:15px; transition:background 0.13s; display:flex; align-items:center; }
    .file-list li:hover { background: #e9e6f7; }
    .symbol-entry { margin-left:0em; font-size:13px; color:#757; border-left:2.5px solid #efecfc; background:none; padding-left:0.55em; }
    .file-entry { font-size:15px; color:#374174; font-weight:600; margin-top:0.35em; border-bottom:1px solid #efefef88; padding-bottom:1px; transition:background 0.13s; }
    .file-entry:focus { outline: 2px solid #845ad5; outline-offset:0; }
    .file-entry:hover { background: #f4f1ff; }
    main { flex:1; display:flex; flex-direction:column; height:100vh; }
    header { flex:0 0 auto; text-align:center; padding:18px 0 0 0; background:#fafafe; font-size:1.65em; letter-spacing:0.5px; color:#805ad5; font-weight:600; }
    #viz-graph { flex:1; margin:0; min-height:0; position: relative; }
    .stats { background:#f4f4fa;margin:1em 1.3em 0.2em 1.3em;border-radius:6px;padding:10px 0.8em; }
    .legend { margin:1em 2.2em 0.2em 2.2em; color:#576; font-size:14px; }
    .legend span { display:inline-block;width:14px;height:14px;margin:0 3px 0 7px;border-radius:3px; }
    footer { color:#bbb; padding:1em 0; text-align:center; font-size:14px; }
    .node text { pointer-events: none; font-size: 12px; font-family: sans-serif; }
    .node circle, .node rect, .node polygon { stroke: #fff; stroke-width: 1.5px; }
    .link { stroke: #999; stroke-opacity: 0.6; }
    .link.calls { stroke: #90a; }
    .link.imports { stroke: #999; stroke-dasharray: 4, 2; }
    #tooltip { position: absolute; text-align: left; width: auto; max-width: 300px; padding: 8px; font: 12px sans-serif; background: rgba(0,0,0,0.8); color: #fff; border: 0px; border-radius: 4px; pointer-events: none; opacity: 0; z-index: 10; }
  </style>
</head>
<body>
  <div class="sidebar">
    <h2><i class="fa fa-folder"></i> File Structure</h2>
    <ul class="file-list" id="file-list"></ul>
  </div>
  <main>
    <header>CodeGraphX – Interactive Code Graph</header>
    <div class="stats"><b id="stats-files">Files: ${filesCount}</b>  <b id="stats-symbols">Total symbols: ${symbolsCount}</b></div>
    <div id="viz-graph"><div id="tooltip"></div></div>
    <div class='legend'><b>Legend:</b>
      <span style='background:#3593ee'></span> File
      <span style='background:#cf78e6'></span> Function
      <span style='background:#78c091'></span> Class
    </div>
    <footer>CodeGraphX agent dashboard &copy; 2026</footer>
  </main>
  
  <script src="https://d3js.org/d3.v7.min.js"></script>
  <script>
    let graphData = ${graphDataStr};
    
    const colorMap = { file: '#3593ee', function: '#cf78e6', class: '#78c091', symbol: '#888', default: '#888' };
    
    function getShape(type) {
      if (type === 'file') return 'rect';
      if (type === 'class') return 'polygon';
      return 'circle';
    }

    const width = document.getElementById('viz-graph').clientWidth || 800;
    const height = document.getElementById('viz-graph').clientHeight || 600;

    const svg = d3.select("#viz-graph").append("svg")
        .attr("width", "100%")
        .attr("height", "100%")
        .call(d3.zoom().on("zoom", function (event) {
             g.attr("transform", event.transform);
        }));

    const g = svg.append("g");

    let link = g.append("g").attr("class", "links").selectAll(".link");
    let node = g.append("g").attr("class", "nodes").selectAll(".node");

    const simulation = d3.forceSimulation()
        .force("link", d3.forceLink().id(d => d.id).distance(60))
        .force("charge", d3.forceManyBody().strength(-150))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("collide", d3.forceCollide().radius(20).iterations(2));

    const tooltip = d3.select("#tooltip");

    function renderGraph() {
      // Data join links
      link = link.data(graphData.links, d => (d.source.id || d.source) + "-" + (d.target.id || d.target));
      link.exit().remove();
      const linkEnter = link.enter().append("line")
          .attr("class", d => "link " + (d.type === 'CALLS' ? 'calls' : 'imports'))
          .attr("stroke-width", 1.5);
      link = linkEnter.merge(link);

      // Data join nodes
      node = node.data(graphData.nodes, d => d.id);
      node.exit().remove();
      
      const nodeEnter = node.enter().append("g")
          .attr("class", "node")
          .call(d3.drag()
              .on("start", dragstarted)
              .on("drag", dragged)
              .on("end", dragended));

      nodeEnter.each(function(d) {
        const el = d3.select(this);
        const color = colorMap[d.type] || colorMap.default;
        if (d.type === 'file') {
          el.append("rect")
            .attr("width", 24).attr("height", 24)
            .attr("x", -12).attr("y", -12)
            .attr("fill", color)
            .attr("rx", 4).attr("ry", 4);
        } else if (d.type === 'class') {
           el.append("polygon")
             .attr("points", "0,-14 14,0 0,14 -14,0")
             .attr("fill", color);
        } else {
           el.append("circle")
             .attr("r", 10)
             .attr("fill", color);
        }
        
        el.append("text")
          .attr("dx", 15).attr("dy", 4)
          .text(d => d.id.includes('::') ? d.id.split('::')[1] : (d.id.split('/').pop() || d.id));
      });

      nodeEnter.on("mouseover", function(event, d) {
          tooltip.transition().duration(200).style("opacity", .9);
          tooltip.html("<b>" + d.id + "</b><br/>Type: " + (d.type || 'symbol'))
              .style("left", (event.pageX + 10) + "px")
              .style("top", (event.pageY - 28) + "px");
      }).on("mouseout", function() {
          tooltip.transition().duration(500).style("opacity", 0);
      });

      node = nodeEnter.merge(node);

      simulation.nodes(graphData.nodes).on("tick", ticked);
      simulation.force("link").links(graphData.links);
      simulation.alpha(1).restart();
    }

    function ticked() {
      link
          .attr("x1", d => Math.max(0, Math.min(width, d.source.x)))
          .attr("y1", d => Math.max(0, Math.min(height, d.source.y)))
          .attr("x2", d => Math.max(0, Math.min(width, d.target.x)))
          .attr("y2", d => Math.max(0, Math.min(height, d.target.y)));

      node.attr("transform", d => {
        d.x = Math.max(15, Math.min(width - 15, d.x));
        d.y = Math.max(15, Math.min(height - 15, d.y));
        return "translate(" + d.x + "," + d.y + ")";
      });
    }

    function dragstarted(event, d) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x; d.fy = d.y;
    }

    function dragged(event, d) {
      d.fx = event.x; d.fy = event.y;
    }

    function dragended(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null; d.fy = null;
    }

    const fileList = document.getElementById('file-list');
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Search files/symbols...';
    searchInput.style.width = '97%';
    searchInput.style.margin = '2px 0 10px 0';
    searchInput.style.padding = '6px 8px';
    searchInput.style.borderRadius = '5px';
    searchInput.style.border = '1px solid #eee';
    fileList.parentNode.insertBefore(searchInput, fileList);

    function getTypeIcon(type) {
      if (type==='file') return '<i class="fa fa-file-code" style="color:#3593ee"></i>';
      if (type==='function') return '<i class="fa fa-circle-nodes" style="color:#cf78e6"></i>';
      if (type==='class') return '<i class="fa fa-cube" style="color:#78c091"></i>';
      return '<i class="fa fa-dot-circle" style="color:#888"></i>';
    }

    function renderSidebar(filter='') {
      const files = graphData.nodes.filter(n => n.type==='file');
      fileList.innerHTML = '';
      files.forEach((f) => {
        if (filter && !f.id.toLowerCase().includes(filter) && !(graphData.nodes.some(sym=>sym.file===f.id && (sym.id.split('::')[1]||'').toLowerCase().includes(filter)))) return;
        
        const li = document.createElement('li');
        li.className = 'file-entry';
        
        const chevron = document.createElement('span');
        chevron.innerHTML = '<i class="fa fa-chevron-down"></i>';
        chevron.style.marginRight = '7px';
        chevron.style.cursor = 'pointer';
        chevron.style.color = '#beb';
        li.appendChild(chevron);

        const fiElem = document.createElement('span');
        fiElem.innerHTML = getTypeIcon('file') + ' ' + f.id;
        fiElem.style.fontWeight = '600';
        fiElem.style.marginRight = '8px';
        li.appendChild(fiElem);
        
        const symbolsUL = document.createElement('ul');
        symbolsUL.style.listStyle = 'none';
        symbolsUL.style.marginLeft = '2.1em';
        symbolsUL.style.padding = '0';

        chevron.onclick = (e)=>{
          e.stopPropagation();
          const visible = symbolsUL.style.display !== 'none';
          symbolsUL.style.display = visible ? 'none' : 'block';
          chevron.innerHTML = '<i class="fa fa-chevron-' + (visible ? 'right' : 'down') + '"></i>';
        };

        const fileSymbols = graphData.nodes.filter(n => n.file===f.id && n.type!=='file');
        fileSymbols.forEach(sym => {
          if (filter && !(sym.id.split('::')[1]||'').toLowerCase().includes(filter) && !f.id.toLowerCase().includes(filter)) return;
          const symLi = document.createElement('li');
          symLi.className = 'symbol-entry';
          symLi.innerHTML = '<span style="width:1.3em; display:inline-block;">' + getTypeIcon(sym.type) + '</span><span>' + (sym.id.split('::')[1] || sym.id) + '</span>';
          symbolsUL.appendChild(symLi);
        });
        
        li.appendChild(symbolsUL);
        fileList.appendChild(li);
      });
    }

    searchInput.oninput = function(){ renderSidebar(this.value.toLowerCase()); };

    renderGraph();
    renderSidebar();

    const ws = new WebSocket('ws://localhost:6789');
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'delta') {
        if (msg.delta.symbols && msg.delta.symbols.added) {
          msg.delta.symbols.added.forEach(sym => {
            const symId = msg.file + "::" + sym.name;
            if (!graphData.nodes.find(n => n.id === symId)) {
              graphData.nodes.push({ id: symId, type: sym.type || 'symbol', file: msg.file });
              graphData.links.push({ source: msg.file, target: symId, type: 'DEFINED_IN' });
            }
          });
        }
        if (msg.delta.symbols && msg.delta.symbols.removed) {
          msg.delta.symbols.removed.forEach(sym => {
            const symId = msg.file + "::" + sym.name;
            graphData.nodes = graphData.nodes.filter(n => n.id !== symId);
            graphData.links = graphData.links.filter(l => (l.source.id || l.source) !== symId && (l.target.id || l.target) !== symId);
          });
        }
        
        renderGraph();
        renderSidebar(searchInput.value.toLowerCase());
        
        if (msg.delta.symbols && msg.delta.symbols.modified) {
          msg.delta.symbols.modified.forEach(sym => {
            const symId = msg.file + "::" + sym.name;
            node.filter(n => n.id === symId).select("circle, polygon")
              .transition().duration(200).style("fill", "yellow")
              .transition().duration(1000).style("fill", d => colorMap[d.type] || colorMap.default);
          });
        }
      }
    };
    ws.onclose = () => console.log("WebSocket connection closed.");
  </script>
</body>
</html>`;
}

module.exports = { getHtml };