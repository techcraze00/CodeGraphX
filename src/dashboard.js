function getHtml(graphDataStr, filesCount, symbolsCount) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>CodeGraphX</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=IBM+Plex+Mono:ital,wght@0,300;0,400;0,500;1,300&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}

:root{
  /* Base palette */
  --bg:        #070710;
  --bg1:       #0b0b18;
  --bg2:       #0f0f20;
  --surface:   rgba(15,15,32,0.94);
  --surface2:  rgba(255,255,255,0.032);
  --surface3:  rgba(255,255,255,0.055);

  /* Borders */
  --border:    rgba(255,255,255,0.065);
  --border2:   rgba(255,255,255,0.13);
  --border3:   rgba(255,255,255,0.22);

  /* Text */
  --text:      #d8d8f0;
  --text-hi:   #f0f0ff;
  --text-md:   #a8a8cc;
  --text-lo:   #6060a0;

  /* Accent colors */
  --blue:      #4ca8ff;
  --blue-dim:  rgba(76,168,255,0.15);
  --violet:    #a78bfa;
  --violet-dim:rgba(167,139,250,0.15);
  --amber:     #fbbf24;
  --amber-dim: rgba(251,191,36,0.15);
  --green:     #34d399;
  --red:       #f87171;

  /* Layout */
  --sidebar-w: 280px;
  --topbar-h:  52px;
  --detail-w:  300px;
  --radius:    8px;
  --radius-sm: 5px;
}

html,body{
  width:100%;height:100%;overflow:hidden;
  background:var(--bg);color:var(--text);
  font-family:'Syne',sans-serif;
  -webkit-font-smoothing:antialiased;
  cursor:default;
}

/* ── Background layers ── */
#bg-canvas{
  position:fixed;inset:0;pointer-events:none;z-index:0;
}

/* Noise texture overlay */
#bg-canvas::after{
  content:'';position:absolute;inset:0;
  background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E");
  background-size:200px 200px;opacity:0.6;
}

.orb{
  position:absolute;border-radius:50%;
  filter:blur(110px);pointer-events:none;
}
.orb1{
  width:600px;height:500px;
  background:radial-gradient(ellipse, rgba(76,168,255,0.06) 0%, transparent 70%);
  top:-100px;left:-100px;
  animation:orb-drift1 50s ease-in-out infinite alternate;
}
.orb2{
  width:500px;height:600px;
  background:radial-gradient(ellipse, rgba(167,139,250,0.05) 0%, transparent 70%);
  bottom:-150px;right:-50px;
  animation:orb-drift2 60s ease-in-out infinite alternate;
}
.orb3{
  width:350px;height:350px;
  background:radial-gradient(ellipse, rgba(251,191,36,0.03) 0%, transparent 70%);
  top:40%;left:45%;
  animation:orb-drift3 70s ease-in-out infinite alternate;
}

@keyframes orb-drift1{from{transform:translate(0,0) scale(1)}to{transform:translate(80px,60px) scale(1.15)}}
@keyframes orb-drift2{from{transform:translate(0,0) scale(1)}to{transform:translate(-60px,-80px) scale(1.1)}}
@keyframes orb-drift3{from{transform:translate(0,0)}to{transform:translate(40px,-50px)}}

/* Fine grid */
#grid{
  position:fixed;inset:0;pointer-events:none;z-index:0;
  background-image:
    linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px);
  background-size:40px 40px;
}

/* ── Topbar ── */
#topbar{
  position:fixed;top:0;left:0;right:0;height:var(--topbar-h);
  display:flex;align-items:center;gap:0;padding:0 16px;
  background:rgba(7,7,16,0.9);
  backdrop-filter:blur(28px) saturate(180%);
  border-bottom:1px solid var(--border);
  z-index:200;
}

.logo{
  display:flex;align-items:center;gap:10px;
  font-weight:800;font-size:14px;letter-spacing:0.06em;
  text-transform:uppercase;color:var(--text-hi);
  flex-shrink:0;padding-right:20px;
  border-right:1px solid var(--border);
  margin-right:20px;
}
.logo-mark{
  width:28px;height:28px;
  background:linear-gradient(135deg, var(--blue) 0%, var(--violet) 100%);
  border-radius:6px;
  display:flex;align-items:center;justify-content:center;
  box-shadow:0 0 16px rgba(76,168,255,0.35), 0 0 32px rgba(167,139,250,0.2);
  flex-shrink:0;
}

.topbar-stats{
  display:flex;align-items:center;gap:6px;
}

.stat-pill{
  display:flex;align-items:center;gap:7px;
  padding:5px 12px;
  background:var(--surface2);
  border:1px solid var(--border);
  border-radius:20px;
  font-size:11px;
  color:var(--text-md);
  font-family:'IBM Plex Mono',monospace;
  transition:border-color .2s,background .2s;
}
.stat-pill:hover{
  background:var(--surface3);
  border-color:var(--border2);
}
.stat-pill .val{
  color:var(--text-hi);
  font-weight:500;
}
.stat-dot{
  width:6px;height:6px;border-radius:50%;flex-shrink:0;
}
.stat-dot.f{background:var(--blue);box-shadow:0 0 6px var(--blue)}
.stat-dot.s{background:var(--violet);box-shadow:0 0 6px var(--violet)}
.stat-dot.e{background:var(--amber);box-shadow:0 0 6px var(--amber)}

.topbar-spacer{flex:1}

.search-wrap{
  position:relative;
  margin-right:10px;
}
#search{
  background:var(--surface2);
  border:1px solid var(--border);
  border-radius:var(--radius-sm);
  padding:7px 12px 7px 34px;
  color:var(--text);
  font-family:'IBM Plex Mono',monospace;
  font-size:11.5px;
  width:200px;
  outline:none;
  transition:border-color .2s,box-shadow .2s,width .3s ease,background .2s;
}
#search::placeholder{color:var(--text-lo)}
#search:focus{
  background:var(--surface3);
  border-color:rgba(76,168,255,.45);
  box-shadow:0 0 0 3px rgba(76,168,255,.09),inset 0 1px 0 rgba(255,255,255,.04);
  width:250px;
}
.search-icon{
  position:absolute;left:10px;top:50%;
  transform:translateY(-50%);
  color:var(--text-lo);pointer-events:none;
}

.icon-btn{
  width:32px;height:32px;border-radius:var(--radius-sm);
  background:var(--surface2);
  border:1px solid var(--border);
  color:var(--text-lo);cursor:pointer;
  display:flex;align-items:center;justify-content:center;
  transition:all .15s;
  flex-shrink:0;
}
.icon-btn:hover{
  background:var(--surface3);
  color:var(--text);
  border-color:var(--border2);
  box-shadow:0 2px 8px rgba(0,0,0,0.3);
}
.icon-btn.active{
  background:var(--blue-dim);
  border-color:rgba(76,168,255,.3);
  color:var(--blue);
}

/* ── Sidebar ── */
#sidebar{
  position:fixed;
  left:0;top:var(--topbar-h);bottom:0;
  width:var(--sidebar-w);
  background:rgba(7,7,16,0.88);
  backdrop-filter:blur(24px) saturate(150%);
  border-right:1px solid var(--border);
  display:flex;flex-direction:column;
  z-index:150;
  transition:transform .3s cubic-bezier(.4,0,.2,1);
  overflow:hidden;
}
#sidebar.closed{transform:translateX(calc(-1 * var(--sidebar-w)))}

.sb-header{
  padding:14px 16px 12px;
  border-bottom:1px solid var(--border);
  display:flex;align-items:center;justify-content:space-between;
  flex-shrink:0;
}
.sb-title{
  font-size:9px;letter-spacing:.2em;
  text-transform:uppercase;font-weight:600;
  color:var(--text-lo);
}
.sb-count-badge{
  font-family:'IBM Plex Mono',monospace;
  font-size:10px;color:var(--text-lo);
  background:var(--surface2);
  border:1px solid var(--border);
  padding:2px 7px;border-radius:10px;
}

/* Sidebar filter tabs */
.sb-tabs{
  display:flex;padding:8px 10px;
  gap:4px;border-bottom:1px solid var(--border);
  flex-shrink:0;
}
.sb-tab{
  flex:1;padding:4px 8px;
  font-size:9.5px;letter-spacing:.06em;
  border-radius:4px;
  border:1px solid transparent;
  cursor:pointer;color:var(--text-lo);
  text-align:center;
  transition:all .15s;
  font-family:'IBM Plex Mono',monospace;
}
.sb-tab:hover{color:var(--text-md);background:var(--surface2)}
.sb-tab.active{
  background:var(--surface3);
  border-color:var(--border2);
  color:var(--text);
}

#sb-scroll{
  flex:1;overflow-y:auto;padding:4px 0 16px;
}
#sb-scroll::-webkit-scrollbar{width:2px}
#sb-scroll::-webkit-scrollbar-track{background:transparent}
#sb-scroll::-webkit-scrollbar-thumb{
  background:rgba(255,255,255,.08);border-radius:2px;
}
#sb-scroll::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,.16)}

/* File rows */
.f-row{
  display:flex;align-items:center;gap:8px;
  padding:5px 14px;cursor:pointer;
  font-size:11px;color:var(--text-md);
  transition:background .1s,color .1s;
  position:relative;overflow:hidden;
  border-left:2px solid transparent;
}
.f-row:hover{background:rgba(255,255,255,.035);color:var(--text)}
.f-row.active{
  background:rgba(76,168,255,.06);
  color:var(--blue);
  border-left-color:var(--blue);
}

.f-icon{
  width:14px;height:14px;border-radius:3px;
  display:flex;align-items:center;justify-content:center;
  flex-shrink:0;font-size:7px;
}
.f-icon.py{background:rgba(76,168,255,.2);color:var(--blue)}
.f-icon.js{background:rgba(251,191,36,.2);color:var(--amber)}
.f-icon.ts{background:rgba(76,168,255,.2);color:var(--blue)}
.f-icon.go{background:rgba(52,211,153,.2);color:var(--green)}
.f-icon.other{background:rgba(255,255,255,.08);color:var(--text-lo)}

.f-name{
  font-family:'IBM Plex Mono',monospace;
  font-size:10.5px;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;
}
.f-sym-count{
  font-family:'IBM Plex Mono',monospace;
  font-size:9px;color:var(--text-lo);
  background:var(--surface2);
  border:1px solid var(--border);
  padding:1px 5px;border-radius:8px;
  flex-shrink:0;
}
.f-chevron{
  font-size:9px;color:var(--text-lo);
  flex-shrink:0;transition:transform .2s;
  margin-left:-2px;
}
.f-row.open .f-chevron{transform:rotate(90deg)}

/* Symbol rows */
.sym-group{
  overflow:hidden;
  transition:max-height .25s cubic-bezier(.4,0,.2,1);
  max-height:0;
}
.s-row{
  display:flex;align-items:center;gap:8px;
  padding:3px 14px 3px 32px;cursor:pointer;
  font-family:'IBM Plex Mono',monospace;
  font-size:10px;color:var(--text-md);
  transition:color .1s,background .1s;
  border-left:2px solid transparent;
}
.s-row:hover{color:var(--text-hi);background:rgba(255,255,255,.025)}
.s-row.s-active{
  color:var(--violet);
  background:rgba(167,139,250,.05);
  border-left-color:var(--violet);
}

.s-badge{
  font-size:7.5px;letter-spacing:.1em;
  padding:1px 5px;border-radius:3px;
  font-weight:600;text-transform:uppercase;flex-shrink:0;
}
.s-badge.fn{background:var(--violet-dim);color:var(--violet)}
.s-badge.cl{background:var(--amber-dim);color:var(--amber)}

.s-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

/* ── Main graph area ── */
#canvas{
  position:fixed;
  left:var(--sidebar-w);
  top:var(--topbar-h);
  right:0;bottom:0;
  overflow:hidden;
  transition:left .3s cubic-bezier(.4,0,.2,1);
}
#canvas.full{left:0}
#viz{width:100%;height:100%}

/* ── SVG node/edge styles ── */
.node-g{cursor:pointer}

/* Node bodies */
.n-file{
  transition:filter .2s,opacity .2s;
  stroke:rgba(76,168,255,.25);stroke-width:1;
}
.n-func{
  transition:filter .2s,opacity .2s;
  stroke:rgba(167,139,250,.25);stroke-width:0.8;
}
.n-class{
  transition:filter .2s,opacity .2s;
  stroke:rgba(251,191,36,.25);stroke-width:0.8;
}

.node-g:hover .n-file,
.node-g:hover .n-func,
.node-g:hover .n-class{
  filter:brightness(1.4) saturate(1.3) drop-shadow(0 0 10px currentColor);
  stroke-width:1.5;
}
.node-g.sel .n-file,
.node-g.sel .n-func,
.node-g.sel .n-class{
  filter:brightness(1.6) saturate(1.5) drop-shadow(0 0 18px currentColor);
  stroke-width:2;
}
.node-g.dim .n-file,
.node-g.dim .n-func,
.node-g.dim .n-class{
  opacity:.12;
}

/* Pulse ring (selected node) */
.n-pulse{
  fill:none;
  stroke-width:1;
  opacity:0;
  transition:opacity .2s;
}
.node-g.sel .n-pulse{
  opacity:1;
  animation:pulse-ring 2s ease-out infinite;
}
@keyframes pulse-ring{
  0%  {r:0;opacity:.7;stroke-width:2}
  100%{r:28px;opacity:0;stroke-width:0.5}
}

.n-label{
  font-family:'IBM Plex Mono',monospace;
  font-size:9.5px;
  fill:rgba(220,220,245,.85);
  pointer-events:none;
  transition:fill .18s,opacity .18s;
  paint-order:stroke;
  stroke:rgba(7,7,16,.7);
  stroke-width:3px;
  stroke-linejoin:round;
}
.node-g:hover .n-label{fill:var(--text-hi)}
.node-g.sel   .n-label{fill:#fff}
.node-g.dim   .n-label{opacity:.06}

/* Edges */
.edge{
  fill:none;stroke-linecap:round;
  transition:opacity .2s,stroke-width .2s;
}
.edge.calls{
  stroke:rgba(167,139,250,.38);
  stroke-dasharray:5 3;
  stroke-width:1.4;
}
.edge.imports{
  stroke:rgba(76,168,255,.32);
  stroke-width:1.2;
}
.edge.defined-in{
  stroke:rgba(255,255,255,.1);
  stroke-dasharray:2 4;
  stroke-width:1;
}
.edge.dim{opacity:.05}
.edge.lit{opacity:1}
.edge.calls.lit{
  stroke:rgba(167,139,250,.9);
  stroke-width:2;
  animation:dash-flow 0.5s linear infinite;
}
.edge.imports.lit{
  stroke:rgba(76,168,255,.9);
  stroke-width:1.8;
}
.edge.defined-in.lit{
  stroke:rgba(255,255,255,.5);
  stroke-width:1.4;
}
@keyframes dash-flow{to{stroke-dashoffset:-16}}

/* ── Detail panel ── */
#detail{
  position:fixed;
  right:0;top:var(--topbar-h);bottom:0;
  width:var(--detail-w);
  background:rgba(7,7,16,0.96);
  backdrop-filter:blur(28px) saturate(150%);
  border-left:1px solid var(--border);
  transform:translateX(100%);
  transition:transform .3s cubic-bezier(.4,0,.2,1);
  z-index:150;display:flex;flex-direction:column;
  overflow:hidden;
}
#detail.open{transform:translateX(0)}

.d-header{
  padding:20px 18px 16px;
  border-bottom:1px solid var(--border);
  position:relative;flex-shrink:0;
}

.d-type-row{
  display:flex;align-items:center;gap:8px;
  margin-bottom:10px;
}
.d-badge{
  font-size:8px;letter-spacing:.18em;
  text-transform:uppercase;
  padding:3px 9px;border-radius:3px;
  font-weight:700;font-family:'Syne',sans-serif;
}
.d-badge.file    {background:var(--blue-dim);color:var(--blue);border:1px solid rgba(76,168,255,.2)}
.d-badge.function{background:var(--violet-dim);color:var(--violet);border:1px solid rgba(167,139,250,.2)}
.d-badge.class   {background:var(--amber-dim);color:var(--amber);border:1px solid rgba(251,191,36,.2)}

.d-name{
  font-family:'IBM Plex Mono',monospace;
  font-size:13.5px;
  color:var(--text-hi);
  word-break:break-all;line-height:1.5;
  font-weight:400;
}
.d-path{
  margin-top:6px;
  font-family:'IBM Plex Mono',monospace;
  font-size:9px;color:var(--text-lo);
  word-break:break-all;line-height:1.6;
  background:var(--surface2);
  border:1px solid var(--border);
  border-radius:4px;
  padding:5px 8px;
  margin-top:8px;
}

.d-close{
  position:absolute;top:16px;right:16px;
  width:24px;height:24px;border-radius:50%;
  background:var(--surface2);border:1px solid var(--border);
  color:var(--text-lo);cursor:pointer;
  display:flex;align-items:center;justify-content:center;font-size:14px;
  transition:all .15s;line-height:1;
}
.d-close:hover{
  background:rgba(248,113,113,.15);
  border-color:rgba(248,113,113,.3);
  color:var(--red);
}

.d-body{
  flex:1;overflow-y:auto;padding:14px 16px;
}
.d-body::-webkit-scrollbar{width:2px}
.d-body::-webkit-scrollbar-track{background:transparent}
.d-body::-webkit-scrollbar-thumb{background:rgba(255,255,255,.08);border-radius:2px}

.d-section{margin-bottom:18px}
.d-section-title{
  font-size:8.5px;letter-spacing:.2em;
  text-transform:uppercase;font-weight:600;
  color:var(--text-lo);
  margin-bottom:8px;
  display:flex;align-items:center;gap:6px;
}
.d-section-title::after{
  content:'';flex:1;height:1px;background:var(--border);
}

.d-count-badge{
  font-family:'IBM Plex Mono',monospace;
  font-size:9px;
  background:var(--surface2);
  border:1px solid var(--border);
  padding:1px 6px;border-radius:8px;
  color:var(--text-lo);
  margin-left:auto;
  letter-spacing:0;
}

.d-list{list-style:none;display:flex;flex-direction:column;gap:2px}
.d-item{
  padding:6px 10px;
  background:var(--surface2);
  border:1px solid var(--border);
  border-radius:var(--radius-sm);
  font-family:'IBM Plex Mono',monospace;
  font-size:10px;color:var(--text-md);
  cursor:pointer;word-break:break-all;
  transition:all .1s;
  display:flex;align-items:center;gap:6px;
}
.d-item::before{
  content:'';width:4px;height:4px;
  border-radius:50%;background:currentColor;
  opacity:.4;flex-shrink:0;
}
.d-item:hover{
  background:var(--surface3);
  border-color:var(--border2);
  color:var(--text-hi);
  transform:translateX(2px);
}

/* ── Legend ── */
#legend{
  position:fixed;bottom:16px;
  left:calc(var(--sidebar-w) + 16px);
  display:flex;gap:12px;flex-wrap:wrap;
  background:rgba(7,7,16,.88);
  backdrop-filter:blur(16px);
  border:1px solid var(--border);
  border-radius:var(--radius);
  padding:8px 14px;
  font-size:9.5px;color:var(--text-lo);
  z-index:100;
  transition:left .3s cubic-bezier(.4,0,.2,1);
  font-family:'IBM Plex Mono',monospace;
}
#legend.full{left:16px}
.leg{display:flex;align-items:center;gap:6px}
.leg-ico{
  width:8px;height:8px;flex-shrink:0;
}
.leg-ico.file{
  background:var(--blue);border-radius:2px;
  box-shadow:0 0 6px var(--blue);
}
.leg-ico.func{
  background:var(--violet);border-radius:50%;
  box-shadow:0 0 6px var(--violet);
}
.leg-ico.cls{
  background:var(--amber);
  transform:rotate(45deg);border-radius:1px;
  box-shadow:0 0 6px var(--amber);
}
.leg-line{
  width:20px;height:2px;flex-shrink:0;border-radius:1px;
}
.leg-line.calls{
  background:var(--violet);opacity:.8;
  border-top:1px dashed var(--violet);
  background:none;height:1px;
}
.leg-line.imports{background:var(--blue);opacity:.7;}
.leg-line.defined{background:rgba(255,255,255,.25);opacity:.7;}

/* ── Minimap ── */
#minimap{
  position:fixed;
  bottom:16px;right:16px;
  width:140px;height:100px;
  background:rgba(7,7,16,.85);
  backdrop-filter:blur(12px);
  border:1px solid var(--border);
  border-radius:var(--radius-sm);
  overflow:hidden;z-index:100;
  cursor:pointer;
  transition:opacity .2s,border-color .2s;
}
#minimap:hover{border-color:var(--border2)}
#minimap svg{width:100%;height:100%;pointer-events:none}
#minimap-label{
  position:absolute;top:5px;left:7px;
  font-family:'IBM Plex Mono',monospace;
  font-size:7.5px;letter-spacing:.1em;
  color:var(--text-lo);
  text-transform:uppercase;pointer-events:none;
}
#minimap-view{
  fill:rgba(76,168,255,.07);
  stroke:rgba(76,168,255,.4);
  stroke-width:1;
}

/* ── Tooltip ── */
#tip{
  position:fixed;pointer-events:none;z-index:400;
  background:rgba(7,7,16,.97);
  border:1px solid var(--border2);
  border-radius:var(--radius);
  padding:9px 14px;
  opacity:0;transform:translateY(6px) scale(.97);
  transition:opacity .12s,transform .12s;
  max-width:240px;
  box-shadow:0 8px 32px rgba(0,0,0,.5),0 2px 8px rgba(0,0,0,.3);
}
#tip.on{opacity:1;transform:translateY(0) scale(1)}
#tip-name{
  font-family:'IBM Plex Mono',monospace;
  font-size:11.5px;color:var(--text-hi);
  margin-bottom:3px;word-break:break-all;
}
#tip-type{
  font-size:9px;letter-spacing:.12em;
  text-transform:uppercase;font-weight:600;
  color:var(--text-lo);margin-bottom:2px;
}
#tip-file{
  font-family:'IBM Plex Mono',monospace;
  font-size:9.5px;color:var(--text-lo);
}

/* ── Loader ── */
#loader{
  position:fixed;inset:0;z-index:1000;
  background:var(--bg);
  display:flex;flex-direction:column;
  align-items:center;justify-content:center;
  gap:20px;
  transition:opacity .5s ease;
}
#loader.gone{opacity:0;pointer-events:none}
.loader-logo{
  width:52px;height:52px;
  background:linear-gradient(135deg, var(--blue) 0%, var(--violet) 100%);
  border-radius:12px;
  display:flex;align-items:center;justify-content:center;
  box-shadow:0 0 30px rgba(76,168,255,.4),0 0 60px rgba(167,139,250,.2);
  animation:loader-pulse 1.5s ease-in-out infinite alternate;
}
@keyframes loader-pulse{
  from{box-shadow:0 0 20px rgba(76,168,255,.3),0 0 40px rgba(167,139,250,.15)}
  to  {box-shadow:0 0 40px rgba(76,168,255,.6),0 0 80px rgba(167,139,250,.3)}
}
.loader-bars{
  display:flex;align-items:flex-end;gap:4px;height:24px;
}
.loader-bar{
  width:3px;border-radius:2px;
  background:var(--blue);
  animation:bar-bounce .8s ease-in-out infinite alternate;
}
.loader-bar:nth-child(1){height:8px;animation-delay:0s;background:var(--blue)}
.loader-bar:nth-child(2){height:16px;animation-delay:.1s;background:var(--violet)}
.loader-bar:nth-child(3){height:24px;animation-delay:.2s;background:var(--blue)}
.loader-bar:nth-child(4){height:14px;animation-delay:.3s;background:var(--violet)}
.loader-bar:nth-child(5){height:10px;animation-delay:.4s;background:var(--amber)}
@keyframes bar-bounce{
  from{opacity:.3;transform:scaleY(.5)}
  to  {opacity:1;transform:scaleY(1)}
}
.loader-text{
  font-family:'IBM Plex Mono',monospace;
  font-size:10px;letter-spacing:.3em;
  text-transform:uppercase;color:var(--text-lo);
}

/* ── Context menu ── */
#ctx-menu{
  position:fixed;z-index:500;
  background:rgba(7,7,16,.98);
  border:1px solid var(--border2);
  border-radius:var(--radius);
  padding:6px;
  box-shadow:0 8px 32px rgba(0,0,0,.6);
  display:none;min-width:160px;
}
#ctx-menu.open{display:block}
.ctx-item{
  padding:7px 12px;border-radius:var(--radius-sm);
  font-family:'IBM Plex Mono',monospace;
  font-size:10.5px;color:var(--text-md);
  cursor:pointer;display:flex;align-items:center;gap:8px;
  transition:background .1s,color .1s;
}
.ctx-item:hover{background:var(--surface3);color:var(--text-hi)}
.ctx-sep{height:1px;background:var(--border);margin:4px 6px}

/* ── Zoom controls ── */
#zoom-ctrl{
  position:fixed;
  left:calc(var(--sidebar-w) + 16px);
  top:calc(var(--topbar-h) + 16px);
  display:flex;flex-direction:column;gap:4px;
  z-index:100;
  transition:left .3s cubic-bezier(.4,0,.2,1);
}
#zoom-ctrl.full{left:16px}
.zoom-btn{
  width:30px;height:30px;
  background:rgba(7,7,16,.82);
  border:1px solid var(--border);
  border-radius:var(--radius-sm);
  color:var(--text-lo);
  cursor:pointer;
  display:flex;align-items:center;justify-content:center;
  font-size:16px;line-height:1;
  transition:all .15s;
  backdrop-filter:blur(12px);
}
.zoom-btn:hover{background:var(--surface3);color:var(--text);border-color:var(--border2)}
.zoom-btn.reset{font-size:10px;font-family:'IBM Plex Mono',monospace;letter-spacing:0}
</style>
</head>
<body>

<!-- Background -->
<div id="bg-canvas">
  <div class="orb orb1"></div>
  <div class="orb orb2"></div>
  <div class="orb orb3"></div>
</div>
<div id="grid"></div>

<!-- Loader -->
<div id="loader">
  <div class="loader-logo">
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <circle cx="14" cy="5" r="3" fill="white" opacity=".9"/>
      <circle cx="5"  cy="21" r="3" fill="white" opacity=".75"/>
      <circle cx="23" cy="21" r="3" fill="white" opacity=".75"/>
      <line x1="14" y1="8" x2="6.5"  y2="18.5" stroke="white" stroke-opacity=".5" stroke-width="1.5"/>
      <line x1="14" y1="8" x2="21.5" y2="18.5" stroke="white" stroke-opacity=".5" stroke-width="1.5"/>
      <line x1="8"  y1="21" x2="20"  y2="21"   stroke="white" stroke-opacity=".35" stroke-width="1.5"/>
    </svg>
  </div>
  <div class="loader-bars">
    <div class="loader-bar"></div>
    <div class="loader-bar"></div>
    <div class="loader-bar"></div>
    <div class="loader-bar"></div>
    <div class="loader-bar"></div>
  </div>
  <div class="loader-text">Building graph&hellip;</div>
</div>

<!-- Topbar -->
<div id="topbar">
  <div class="logo">
    <div class="logo-mark">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="3" r="2" fill="white" opacity=".9"/>
        <circle cx="3" cy="12" r="2" fill="white" opacity=".75"/>
        <circle cx="13" cy="12" r="2" fill="white" opacity=".75"/>
        <line x1="8" y1="5" x2="4" y2="10.2" stroke="white" stroke-opacity=".6" stroke-width="1.3"/>
        <line x1="8" y1="5" x2="12" y2="10.2" stroke="white" stroke-opacity=".6" stroke-width="1.3"/>
        <line x1="5" y1="12" x2="11" y2="12" stroke="white" stroke-opacity=".4" stroke-width="1.3"/>
      </svg>
    </div>
    CGX
  </div>

  <div class="topbar-stats">
    <div class="stat-pill">
      <div class="stat-dot f"></div>
      <span class="val" id="s-files">${filesCount}</span>
      <span>files</span>
    </div>
    <div class="stat-pill">
      <div class="stat-dot s"></div>
      <span class="val" id="s-syms">${symbolsCount}</span>
      <span>symbols</span>
    </div>
    <div class="stat-pill">
      <div class="stat-dot e"></div>
      <span class="val" id="s-edges">—</span>
      <span>edges</span>
    </div>
  </div>

  <div class="topbar-spacer"></div>

  <div class="search-wrap">
    <svg class="search-icon" width="13" height="13" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
    <input id="search" type="text" placeholder="Search nodes…" autocomplete="off" spellcheck="false">
  </div>

  <button class="icon-btn" id="sb-toggle" title="Toggle sidebar (B)">
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <line x1="9" y1="3" x2="9" y2="21"/>
    </svg>
  </button>

  <button class="icon-btn" id="fit-btn" title="Fit to screen (F)" style="margin-left:4px">
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M4 14H2v6h6v-2M4 10H2V4h6v2M20 14h2v6h-6v-2M20 10h2V4h-6v2"/>
    </svg>
  </button>
</div>

<!-- Sidebar -->
<div id="sidebar">
  <div class="sb-header">
    <span class="sb-title">Explorer</span>
    <span class="sb-count-badge" id="sb-count">— files</span>
  </div>
  <div class="sb-tabs">
    <div class="sb-tab active" data-filter="all">All</div>
    <div class="sb-tab" data-filter="function">Functions</div>
    <div class="sb-tab" data-filter="class">Classes</div>
  </div>
  <div id="sb-scroll">
    <div id="sb-list"></div>
  </div>
</div>

<!-- Graph canvas -->
<div id="canvas">
  <svg id="viz"></svg>
</div>

<!-- Zoom controls -->
<div id="zoom-ctrl">
  <button class="zoom-btn" id="zoom-in"  title="Zoom in (+)">+</button>
  <button class="zoom-btn" id="zoom-out" title="Zoom out (-)">−</button>
  <button class="zoom-btn reset" id="zoom-reset" title="Reset zoom (0)">1:1</button>
</div>

<!-- Detail panel -->
<div id="detail">
  <div class="d-header">
    <div class="d-type-row">
      <div class="d-badge" id="d-badge">—</div>
    </div>
    <div class="d-name" id="d-name">—</div>
    <div class="d-path" id="d-path"></div>
    <button class="d-close" id="d-close">×</button>
  </div>
  <div class="d-body" id="d-body"></div>
</div>

<!-- Legend -->
<div id="legend">
  <div class="leg"><div class="leg-ico file"></div>File</div>
  <div class="leg"><div class="leg-ico func"></div>Function</div>
  <div class="leg"><div class="leg-ico cls"></div>Class</div>
  <div class="leg"><div class="leg-line calls"></div>Calls</div>
  <div class="leg"><div class="leg-line imports"></div>Imports</div>
  <div class="leg"><div class="leg-line defined"></div>Defined in</div>
</div>

<!-- Minimap -->
<div id="minimap">
  <div id="minimap-label">Overview</div>
  <svg id="mm-svg"></svg>
</div>

<!-- Tooltip -->
<div id="tip">
  <div id="tip-type"></div>
  <div id="tip-name"></div>
  <div id="tip-file"></div>
</div>

<!-- Context menu -->
<div id="ctx-menu">
  <div class="ctx-item" id="ctx-focus">
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>
    Focus node
  </div>
  <div class="ctx-item" id="ctx-expand">
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
    Expand neighbors
  </div>
  <div class="ctx-sep"></div>
  <div class="ctx-item" id="ctx-pin">
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
    Pin / unpin
  </div>
</div>

<script src="https://d3js.org/d3.v7.min.js"></script>
<script>
// ── Data ──────────────────────────────────────────────────────────────────────
let G = ${graphDataStr};

// ── State ─────────────────────────────────────────────────────────────────────
let selNode = null, query = '', sbOpen = true;
let sim, linkSel, nodeSel;
let ctxNode = null;
let pinnedNodes = new Set();
let sbTypeFilter = 'all';

// ── Constants ─────────────────────────────────────────────────────────────────
const COL = {
  file:     '#4ca8ff',
  function: '#a78bfa',
  class:    '#fbbf24',
  symbol:   '#6b7280'
};

function col(d){ return COL[d.type] || COL.symbol }

function R(d){
  if(d.type==='file')     return 11;
  if(d.type==='class')    return 9;
  return 7;
}

function shortName(id){
  if(id.includes('::')){
    const p = id.split('::'); return p[p.length-1];
  }
  const p = id.split('/'); return p[p.length-1] || id;
}

function fileExt(id){
  const m = id.match(/\.(\w+)$/);
  return m ? m[1] : 'other';
}

// ── SVG Setup ─────────────────────────────────────────────────────────────────
const area = document.getElementById('canvas');
let W = area.clientWidth, H = area.clientHeight;

const svg = d3.select('#viz');

const zoom = d3.zoom()
  .scaleExtent([0.04, 8])
  .on('zoom', e => {
    g.attr('transform', e.transform);
    updateMinimap();
  });

svg.call(zoom);

// Defs
const defs = svg.append('defs');

// Arrow markers
['calls','imports'].forEach(type => {
  defs.append('marker')
    .attr('id','arr-'+type)
    .attr('viewBox','-0 -4 8 8')
    .attr('refX',16).attr('refY',0)
    .attr('orient','auto')
    .attr('markerWidth',5).attr('markerHeight',5)
    .append('path').attr('d','M0,-4L8,0L0,4')
    .attr('fill', type==='calls' ? 'rgba(167,139,250,0.6)' : 'rgba(76,168,255,0.55)');
});

// Glow filter
const filt = defs.append('filter').attr('id','glow').attr('x','-50%').attr('y','-50%').attr('width','200%').attr('height','200%');
filt.append('feGaussianBlur').attr('stdDeviation','3').attr('result','coloredBlur');
const feMerge = filt.append('feMerge');
feMerge.append('feMergeNode').attr('in','coloredBlur');
feMerge.append('feMergeNode').attr('in','SourceGraphic');

const g = svg.append('g');

// ── Build graph ───────────────────────────────────────────────────────────────
let edgeG, nodeG;

function build(){
  g.selectAll('*').remove();
  document.getElementById('s-edges').textContent = G.links.length;

  sim = d3.forceSimulation(G.nodes)
    .force('link', d3.forceLink(G.links).id(d=>d.id)
      .distance(d => {
        if(d.type==='IMPORTS') return 160;
        if(d.type==='DEFINED_IN') return 70;
        return 110;
      })
      .strength(d => {
        if(d.type==='DEFINED_IN') return 0.8;
        if(d.type==='IMPORTS') return 0.4;
        return 0.6;
      }))
    .force('charge', d3.forceManyBody()
      .strength(d => d.type==='file' ? -380 : -140)
      .theta(0.85).distanceMin(25))
    .force('collide', d3.forceCollide().radius(d => R(d)+14).iterations(3))
    .force('x', d3.forceX(W/2).strength(0.035))
    .force('y', d3.forceY(H/2).strength(0.035))
    .alphaDecay(.02);

  // Edges
  edgeG = g.append('g').attr('class','edges');
  linkSel = edgeG.selectAll('line')
    .data(G.links).join('line')
    .attr('class', d => {
      const t = d.type||'';
      if(t==='CALLS') return 'edge calls';
      if(t==='IMPORTS') return 'edge imports';
      return 'edge defined-in';
    })
    .attr('marker-end', d => {
      if(d.type==='CALLS')   return 'url(#arr-calls)';
      if(d.type==='IMPORTS') return 'url(#arr-imports)';
      return null;
    });

  // Nodes
  nodeG = g.append('g').attr('class','nodes');
  const ng = nodeG.selectAll('.node-g')
    .data(G.nodes).join('g')
    .attr('class','node-g')
    .call(d3.drag()
      .on('start', (e,d)=>{ if(!e.active) sim.alphaTarget(.18).restart(); d.fx=d.x; d.fy=d.y })
      .on('drag',  (e,d)=>{ d.fx=e.x; d.fy=e.y })
      .on('end',   (e,d)=>{ if(!e.active) sim.alphaTarget(0); if(!pinnedNodes.has(d.id)){ d.fx=null; d.fy=null } }))
    .on('click',       nodeClick)
    .on('mouseover',   nodeOver)
    .on('mouseout',    nodeOut)
    .on('contextmenu', nodeCtxMenu);

  nodeSel = ng;

  ng.each(function(d){
    const el = d3.select(this);
    const r = R(d), c = col(d);

    // Pulse ring (only for selected state animation)
    el.append('circle')
      .attr('class','n-pulse')
      .attr('r', r+4)
      .attr('fill','none')
      .attr('stroke', c)
      .attr('stroke-width',1.5);

    if(d.type==='file'){
      el.append('rect').attr('class','n-file')
        .attr('width', r*2.6).attr('height', r*2.6)
        .attr('x', -r*1.3).attr('y', -r*1.3)
        .attr('rx', 4)
        .attr('fill', c).attr('fill-opacity', .85)
        .style('color', c);
    } else if(d.type==='class'){
      const hw = r * 1.45;
      el.append('polygon').attr('class','n-class')
        .attr('points',\`0,\${-hw} \${hw},0 0,\${hw} \${-hw},0\`)
        .attr('fill', c).attr('fill-opacity', .82)
        .style('color', c);
    } else {
      el.append('circle').attr('class','n-func')
        .attr('r', r)
        .attr('fill', c).attr('fill-opacity', .80)
        .style('color', c);
    }

    el.append('text').attr('class','n-label')
      .attr('dy', r + 12)
      .attr('text-anchor','middle')
      .text(shortName(d.id));
  });

  sim.on('tick', ()=>{
    linkSel
      .attr('x1', d=>d.source.x).attr('y1', d=>d.source.y)
      .attr('x2', d=>d.target.x).attr('y2', d=>d.target.y);
    nodeSel.attr('transform', d=>\`translate(\${d.x},\${d.y})\`);
    updateMinimap();
  });
}

// ── Interactions ──────────────────────────────────────────────────────────────
const tip = document.getElementById('tip');

function nodeOver(e, d){
  const ext = fileExt(d.id).toUpperCase();
  document.getElementById('tip-type').textContent = d.type === 'file' ? ext + ' FILE' : d.type.toUpperCase();
  document.getElementById('tip-name').textContent = shortName(d.id);
  document.getElementById('tip-file').textContent = d.type !== 'file' && d.file ? d.file : '';
  tip.classList.add('on');
  moveTip(e);
}
function nodeOut(){ tip.classList.remove('on') }
svg.on('mousemove', e => { if(tip.classList.contains('on')) moveTip(e) });
function moveTip(e){
  const tx = Math.min(e.clientX + 16, window.innerWidth - 260);
  tip.style.left = tx + 'px';
  tip.style.top  = (e.clientY - 12) + 'px';
}

function nodeClick(e, d){
  e.stopPropagation();
  closeCtxMenu();
  if(selNode && selNode.id === d.id){
    selNode = null; closeDetail(); resetHL(); clearSbActive();
    return;
  }
  selNode = d;
  highlight(d);
  showDetail(d);
  if(d.type==='file') hlSbFile(d.id);
  else hlSbFile(d.file);
  hlSbSym(d.id);
}

svg.on('click', ()=>{ selNode=null; closeDetail(); resetHL(); clearSbActive(); closeCtxMenu() });

function highlight(d){
  const nb = new Set([d.id]);
  G.links.forEach(l=>{
    const s = l.source.id||l.source, t = l.target.id||l.target;
    if(s===d.id) nb.add(t);
    if(t===d.id) nb.add(s);
  });
  if(nodeSel){
    nodeSel
      .classed('sel', n => n.id===d.id)
      .classed('dim', n => !nb.has(n.id));
  }
  if(linkSel){
    linkSel
      .classed('dim', l => {
        const s=l.source.id||l.source, t=l.target.id||l.target;
        return s!==d.id && t!==d.id;
      })
      .classed('lit', l => {
        const s=l.source.id||l.source, t=l.target.id||l.target;
        return s===d.id || t===d.id;
      });
  }
}

function resetHL(){
  if(nodeSel) nodeSel.classed('sel dim', false);
  if(linkSel) linkSel.classed('dim lit', false);
}

function centerOn(d, duration=380){
  const t = d3.zoomTransform(svg.node());
  svg.transition().duration(duration)
    .call(zoom.transform,
      d3.zoomIdentity.translate(W/2 - t.k*d.x, H/2 - t.k*d.y).scale(t.k));
}

// ── Context menu ──────────────────────────────────────────────────────────────
const ctxMenu = document.getElementById('ctx-menu');
function nodeCtxMenu(e, d){
  e.preventDefault();
  e.stopPropagation();
  ctxNode = d;
  ctxMenu.style.left = e.clientX + 'px';
  ctxMenu.style.top  = e.clientY + 'px';
  ctxMenu.classList.add('open');
  // Update pin label
  document.getElementById('ctx-pin').querySelector('span') ||
    document.getElementById('ctx-pin').appendChild(document.createTextNode(''));
  document.getElementById('ctx-pin').lastChild.textContent =
    pinnedNodes.has(d.id) ? 'Unpin node' : 'Pin node';
}
function closeCtxMenu(){ ctxMenu.classList.remove('open') }
document.addEventListener('click', closeCtxMenu);
document.getElementById('ctx-focus').onclick = ()=>{
  if(!ctxNode) return;
  nodeClick({stopPropagation:()=>{}}, ctxNode);
  centerOn(ctxNode);
};
document.getElementById('ctx-expand').onclick = ()=>{
  if(!ctxNode) return;
  nodeClick({stopPropagation:()=>{}}, ctxNode);
};
document.getElementById('ctx-pin').onclick = ()=>{
  if(!ctxNode) return;
  if(pinnedNodes.has(ctxNode.id)){
    pinnedNodes.delete(ctxNode.id);
    const n = G.nodes.find(n=>n.id===ctxNode.id);
    if(n){ n.fx=null; n.fy=null }
  } else {
    pinnedNodes.add(ctxNode.id);
    const n = G.nodes.find(n=>n.id===ctxNode.id);
    if(n){ n.fx=n.x; n.fy=n.y }
  }
};

// ── Detail panel ──────────────────────────────────────────────────────────────
function showDetail(d){
  const badge = document.getElementById('d-badge');
  badge.textContent = d.type;
  badge.className = 'd-badge ' + (COL[d.type] ? d.type : '');

  document.getElementById('d-name').textContent = shortName(d.id);
  document.getElementById('d-path').textContent =
    d.type !== 'file' && d.file ? d.file : d.id;

  const body = document.getElementById('d-body');
  body.innerHTML = '';

  const out=[], inp=[], imp=[], defs=[];
  G.links.forEach(l=>{
    const s=l.source.id||l.source, t=l.target.id||l.target;
    if(l.type==='CALLS'      && s===d.id) out.push(t);
    if(l.type==='CALLS'      && t===d.id) inp.push(s);
    if(l.type==='IMPORTS'    && s===d.id) imp.push(t);
    if(l.type==='DEFINED_IN' && t===d.id) defs.push(s);
  });

  function sec(lbl, items, color){
    if(!items.length) return;
    const div = document.createElement('div');
    div.className = 'd-section';

    const h = document.createElement('div');
    h.className = 'd-section-title';
    h.style.color = color||'';
    h.innerHTML = lbl + \`<span class="d-count-badge">\${items.length}</span>\`;

    const ul = document.createElement('ul');
    ul.className = 'd-list';
    items.forEach(id=>{
      const li = document.createElement('li');
      li.className = 'd-item';
      li.style.color = color || 'var(--text-md)';
      li.textContent = shortName(id);
      li.title = id;
      li.onclick = ()=>{
        const tn = G.nodes.find(n=>n.id===id);
        if(tn){ nodeClick({stopPropagation:()=>{}}, tn); centerOn(tn) }
      };
      ul.appendChild(li);
    });
    div.appendChild(h);
    div.appendChild(ul);
    body.appendChild(div);
  }

  sec('Calls', out, 'var(--violet)');
  sec('Called by', inp, 'var(--violet)');
  sec('Imports', imp, 'var(--blue)');
  sec('Symbols', defs, 'var(--amber)');

  if(!out.length && !inp.length && !imp.length && !defs.length)
    body.innerHTML = '<div style="color:var(--text-lo);font-size:11px;font-family:IBM Plex Mono,monospace;padding-top:4px;line-height:1.8">No connections recorded for this node.</div>';

  document.getElementById('detail').classList.add('open');
}

function closeDetail(){ document.getElementById('detail').classList.remove('open') }
document.getElementById('d-close').onclick = ()=>{
  selNode=null; closeDetail(); resetHL(); clearSbActive();
};

// ── Zoom controls ─────────────────────────────────────────────────────────────
const zoomBy = factor => svg.transition().duration(260).call(zoom.scaleBy, factor);
document.getElementById('zoom-in').onclick    = ()=> zoomBy(1.4);
document.getElementById('zoom-out').onclick   = ()=> zoomBy(1/1.4);
document.getElementById('zoom-reset').onclick = ()=>
  svg.transition().duration(380).call(zoom.transform, d3.zoomIdentity.translate(W/2,H/2).scale(0.9));

document.getElementById('fit-btn').onclick = fitGraph;
function fitGraph(){
  if(!G.nodes.length) return;
  const xs = G.nodes.map(n=>n.x||0), ys = G.nodes.map(n=>n.y||0);
  const x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);
  const pw = x1-x0 || 1, ph = y1-y0 || 1;
  const k  = Math.min(W/pw, H/ph) * 0.8;
  const tx = W/2 - k*(x0+x1)/2, ty = H/2 - k*(y0+y1)/2;
  svg.transition().duration(480)
    .call(zoom.transform, d3.zoomIdentity.translate(tx,ty).scale(k));
}

// ── Search ────────────────────────────────────────────────────────────────────
document.getElementById('search').addEventListener('input', function(){
  query = this.value.trim().toLowerCase();
  if(!query){ resetHL(); renderSb(''); return }
  const hits = new Set();
  G.nodes.forEach(n=>{
    if(shortName(n.id).toLowerCase().includes(query) || n.id.toLowerCase().includes(query))
      hits.add(n.id);
  });
  if(nodeSel) nodeSel.classed('sel',n=>hits.has(n.id)).classed('dim',n=>!hits.has(n.id));
  if(linkSel) linkSel.classed('dim',true).classed('lit',false);
  renderSb(query);
});

// ── Keyboard shortcuts ────────────────────────────────────────────────────────
document.addEventListener('keydown', e=>{
  if(e.target.tagName==='INPUT') return;
  if(e.key==='b'||e.key==='B'){
    document.getElementById('sb-toggle').click();
  }
  if(e.key==='f'||e.key==='F') fitGraph();
  if(e.key==='+' || e.key==='=') zoomBy(1.3);
  if(e.key==='-') zoomBy(1/1.3);
  if(e.key==='0') document.getElementById('zoom-reset').click();
  if(e.key==='Escape'){ selNode=null; closeDetail(); resetHL(); clearSbActive() }
  if(e.key==='/'){ e.preventDefault(); document.getElementById('search').focus() }
});

// ── Sidebar ───────────────────────────────────────────────────────────────────
// Tab filter
document.querySelectorAll('.sb-tab').forEach(tab=>{
  tab.onclick = ()=>{
    document.querySelectorAll('.sb-tab').forEach(t=>t.classList.remove('active'));
    tab.classList.add('active');
    sbTypeFilter = tab.dataset.filter;
    renderSb(query);
  };
});

function renderSb(filter){
  const list = document.getElementById('sb-list');
  list.innerHTML = '';
  const files = G.nodes.filter(n=>n.type==='file');
  document.getElementById('sb-count').textContent = files.length + ' files';

  files.forEach(f=>{
    const fn = shortName(f.id).toLowerCase();
    let syms = G.nodes.filter(n=>n.file===f.id && n.type!=='file');

    // Apply type filter
    if(sbTypeFilter !== 'all')
      syms = syms.filter(s=>s.type===sbTypeFilter);

    const mSyms = filter ? syms.filter(s=>shortName(s.id).toLowerCase().includes(filter)) : syms;
    if(filter && !fn.includes(filter) && !mSyms.length) return;

    const ext = fileExt(f.id);
    const extMap = {py:'py',js:'js',ts:'ts',go:'go'};
    const extClass = extMap[ext] || 'other';
    const extLabel = ext.toUpperCase().slice(0,2);

    const row = document.createElement('div');
    row.className = 'f-row';
    row.dataset.id = f.id;
    row.innerHTML =
      \`<div class="f-icon \${extClass}">\${extLabel}</div>\`+
      \`<span class="f-name">\${shortName(f.id)}</span>\`+
      (syms.length ? \`<span class="f-sym-count">\${syms.length}</span>\` : '')+
      (syms.length ? \`<span class="f-chevron">›</span>\` : '');

    row.onclick = e=>{
      if(e.target.classList.contains('f-chevron')) return;
      nodeClick({stopPropagation:()=>{}}, f);
      centerOn(f);
    };

    const grp = document.createElement('div');
    grp.className = 'sym-group';

    if(syms.length){
      const chevron = row.querySelector('.f-chevron');
      if(chevron){
        chevron.onclick = e=>{
          e.stopPropagation();
          const open = row.classList.toggle('open');
          grp.style.maxHeight = open ? grp.scrollHeight + 40 + 'px' : '0';
        };
      }

      (filter ? mSyms : syms).forEach(s=>{
        const sr = document.createElement('div');
        sr.className = 's-row';
        sr.dataset.id = s.id;
        const badgeCls = s.type==='class' ? 'cl' : 'fn';
        const badgeTxt = s.type==='class' ? 'CLS' : 'FN';
        sr.innerHTML =
          \`<span class="s-badge \${badgeCls}">\${badgeTxt}</span>\`+
          \`<span class="s-name">\${shortName(s.id)}</span>\`;
        sr.onclick = e=>{
          e.stopPropagation();
          nodeClick({stopPropagation:()=>{}}, s);
          centerOn(s);
        };
        grp.appendChild(sr);
      });

      if(filter && mSyms.length){
        row.classList.add('open');
        grp.style.maxHeight = '999px';
      }
    }

    list.appendChild(row);
    if(syms.length) list.appendChild(grp);
  });
}

function hlSbFile(fileId){
  document.querySelectorAll('.f-row').forEach(el=>{
    el.classList.toggle('active', el.dataset.id===fileId);
  });
}
function hlSbSym(symId){
  document.querySelectorAll('.s-row').forEach(el=>{
    el.classList.toggle('s-active', el.dataset.id===symId);
  });
}
function clearSbActive(){
  document.querySelectorAll('.f-row,.s-row').forEach(el=>{
    el.classList.remove('active','s-active');
  });
}

// ── Sidebar toggle ────────────────────────────────────────────────────────────
document.getElementById('sb-toggle').onclick = ()=>{
  sbOpen = !sbOpen;
  document.getElementById('sidebar').classList.toggle('closed', !sbOpen);
  document.getElementById('canvas').classList.toggle('full', !sbOpen);
  document.getElementById('legend').classList.toggle('full', !sbOpen);
  document.getElementById('zoom-ctrl').classList.toggle('full', !sbOpen);
  document.getElementById('sb-toggle').classList.toggle('active', !sbOpen);
  setTimeout(()=>{
    W = area.clientWidth;
    if(sim) sim.force('center', d3.forceCenter(W/2,H/2)).alpha(.06).restart();
  }, 320);
};

// ── Minimap ───────────────────────────────────────────────────────────────────
const mmSvg = d3.select('#mm-svg');
const mmW = 140, mmH = 100;

function updateMinimap(){
  if(!G.nodes.length) return;
  mmSvg.selectAll('*').remove();

  const xs = G.nodes.map(n=>n.x||0), ys = G.nodes.map(n=>n.y||0);
  const x0=Math.min(...xs),x1=Math.max(...xs)+1;
  const y0=Math.min(...ys),y1=Math.max(...ys)+1;
  const pw=x1-x0, ph=y1-y0;
  const scale = Math.min(mmW/pw, mmH/ph)*0.85;
  const ox = (mmW - pw*scale)/2 - x0*scale;
  const oy = (mmH - ph*scale)/2 - y0*scale;

  // Nodes
  mmSvg.selectAll('circle')
    .data(G.nodes).join('circle')
    .attr('cx', d=>(d.x||0)*scale+ox)
    .attr('cy', d=>(d.y||0)*scale+oy)
    .attr('r', d=> d.type==='file'?2.5:1.5)
    .attr('fill', d=>col(d))
    .attr('opacity', .7);

  // Viewport rect
  const t = d3.zoomTransform(svg.node());
  const vx0 = (-t.x)/t.k, vy0=(-t.y)/t.k;
  const vx1 = vx0+W/t.k, vy1=vy0+H/t.k;
  mmSvg.append('rect').attr('id','minimap-view')
    .attr('x', vx0*scale+ox).attr('y', vy0*scale+oy)
    .attr('width', (vx1-vx0)*scale).attr('height', (vy1-vy0)*scale);
}

document.getElementById('minimap').onclick = e=>{
  const rect = e.currentTarget.getBoundingClientRect();
  const mx = e.clientX - rect.left, my = e.clientY - rect.top;
  if(!G.nodes.length) return;
  const xs=G.nodes.map(n=>n.x||0),ys=G.nodes.map(n=>n.y||0);
  const x0=Math.min(...xs),x1=Math.max(...xs)+1;
  const y0=Math.min(...ys),y1=Math.max(...ys)+1;
  const pw=x1-x0,ph=y1-y0;
  const scale=Math.min(mmW/pw,mmH/ph)*0.85;
  const ox=(mmW-pw*scale)/2-x0*scale;
  const oy=(mmH-ph*scale)/2-y0*scale;
  const gx=(mx-ox)/scale, gy=(my-oy)/scale;
  const t=d3.zoomTransform(svg.node());
  svg.transition().duration(300)
    .call(zoom.transform, d3.zoomIdentity.translate(W/2-t.k*gx,H/2-t.k*gy).scale(t.k));
};

// ── Resize ────────────────────────────────────────────────────────────────────
window.addEventListener('resize', ()=>{
  W = area.clientWidth; H = area.clientHeight;
  if(sim) sim.force('center', d3.forceCenter(W/2,H/2));
});

// ── WebSocket live updates ─────────────────────────────────────────────────────
function ws(){
  try{
    const sock = new WebSocket('ws://localhost:6789');
    sock.onmessage = e=>{
      const m = JSON.parse(e.data);
      if(m.type!=='delta') return;
      let dirty=false;
      (m.delta.symbols?.added||[]).forEach(s=>{
        const id = m.file+'::'+s.name;
        if(!G.nodes.find(n=>n.id===id)){
          G.nodes.push({id,type:s.type||'symbol',file:m.file});
          G.links.push({source:m.file,target:id,type:'DEFINED_IN'});
          dirty=true;
        }
      });
      (m.delta.symbols?.removed||[]).forEach(s=>{
        const id = m.file+'::'+s.name;
        G.nodes = G.nodes.filter(n=>n.id!==id);
        G.links = G.links.filter(l=>(l.source.id||l.source)!==id&&(l.target.id||l.target)!==id);
        dirty=true;
      });
      if(dirty){
        build(); renderSb(query);
        document.getElementById('s-syms').textContent =
          G.nodes.filter(n=>n.type!=='file').length;
      }
    };
    sock.onclose = ()=>setTimeout(ws,3000);
  }catch(e){}
}

// ── Init ──────────────────────────────────────────────────────────────────────
setTimeout(()=>{
  build();
  renderSb('');
  setTimeout(()=>{
    const ld = document.getElementById('loader');
    ld.classList.add('gone');
    setTimeout(()=>ld.remove(), 520);
  }, 800);
}, 30);

ws();
</script>
</body>
</html>`;
}

module.exports = { getHtml };