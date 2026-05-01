`# CodeGraphX — Research & Build Plan
### A Local, Token-Efficient, Dynamic Codebase Graph System for AI Coding Agents

> **Author:** Prayas | **Date:** April 2026  
> **Target Agent:** Gemini CLI (initial), extensible to Claude Code, Cursor, Copilot CLI  
> **Package Goal:** `npm install -g codegraphx` or `pip install codegraphx`

---

## Table of Contents

1. [The Problem, Stated Precisely](#1-the-problem)
2. [What Already Exists (Research Summary)](#2-what-already-exists)
3. [Why Build From Scratch](#3-why-build-from-scratch)
4. [Core Concepts You Identified — Validated](#4-core-concepts-validated)
5. [System Architecture Overview](#5-system-architecture)
6. [Component-by-Component Deep Dive](#6-component-deep-dive)
7. [The Virtual Graph Diffing Engine](#7-virtual-graph-diffing)
8. [The TOON Output Layer](#8-toon-output)
9. [The Git Commit Intelligence Layer](#9-git-commit-intelligence)
10. [The HTML Live Dashboard](#10-html-dashboard)
11. [File Structure of the Package](#11-file-structure)
12. [Technology Stack (Zero Heavy Dependencies)](#12-tech-stack)
13. [Language Support Matrix](#13-language-support)
14. [Implementation Roadmap (Phases)](#14-roadmap)
15. [Integration with Gemini CLI](#15-gemini-cli-integration)
16. [Performance Targets & Benchmarks](#16-performance)
17. [Edge Cases & Known Challenges](#17-edge-cases)
18. [Naming, Packaging & Distribution](#18-packaging)

---

## 1. The Problem

When working on large, multi-file codebases with a coding agent (like Gemini CLI or Claude Code), the agent has no persistent memory of the codebase. Every new session forces it to:

- **Re-scan** every file in the project
- **Re-infer** which functions exist, where they are, and what they call
- **Re-understand** inter-file dependencies from scratch
- **Waste hundreds to thousands of tokens** just to "orient" itself before doing actual work

This is not just slow — it's expensive, it fills up the context window, and it introduces risk because the agent may miss or misread files during scanning.

Additionally:
- There is no record of **what changed between sessions** unless you manually tell the agent
- There is no quick answer to "if I change function X, what breaks?" without re-scanning
- There is no persistent, structured map of the codebase that survives across sessions

**CodeGraphX solves all of this.**

---

## 2. What Already Exists (Research Summary)

### 2a. Tools Reviewed

| Tool | Approach | Problem |
|------|----------|---------|
| **Graphify** | Visualizes GitHub repo as graph | No agent integration, web-only, requires auth |
| **GitNexus** | Graph of repo changes over time | Git-history focused, not code-structure focused |
| **Code-Review-Graph** | Shows review relationships | Not for code entities (functions/classes) |
| **Mem-Palace** | Memory layer for LLMs | General memory, not code-specific graph |
| **OpenSpace (HKUDS)** | Open-world reasoning graph | Academic research, not a dev tool |
| **CodePrism** | Rust-based, MCP server, AST graph | Excellent architecture but Rust, not a simple install |
| **CodeGraph (ChrisRoyse)** | Neo4j + MCP | Requires running Neo4j DB — heavy dependency |
| **Code-Graph-RAG** | Memgraph + Tree-sitter | Requires Memgraph DB + Docker — heavy dependency |
| **code-graph-mcp (sdsrss)** | SQLite + Tree-sitter + BM25 | Closest to ideal, but MCP-only, not CLI-first |
| **LogicLens** | Multi-repo graph + LLM | Academic paper, not a released package |

### 2b. Key Technology Findings

**Tree-sitter** — This is the correct and battle-tested choice for parsing.
- Incremental parser written in C (bindings for Python and Node.js via npm/pip)
- Already used by GitHub, VS Code, Neovim, Emacs
- Supports Python, JavaScript, TypeScript, React/JSX, HTML, CSS, and 100+ more
- When a file changes, it re-parses only the changed region — this is the foundation for your "Virtual Graph" concept
- Python: `pip install tree-sitter tree-sitter-python tree-sitter-javascript ...`
- Node.js: `npm install tree-sitter tree-sitter-javascript tree-sitter-python ...`

**TOON Format** — Your instinct was correct and the format now officially exists.
- TOON (Token-Oriented Object Notation) is a real, published spec at `toonformat.dev`
- It achieves 30–60% fewer tokens than JSON while maintaining full semantic accuracy
- Benchmarked across GPT-4, Gemini, Claude — TOON scores 27.7 accuracy-per-1K-tokens vs JSON's 16.4
- MIT licensed with Python (`pip install toon`) and TypeScript (`npm install @toon-format/toon`) SDKs
- Perfect for your "agent-readable helper files" — you will store the graph index in TOON format

**Bloom Filter** — This is exactly the "Google username check" system you described.
- A Bloom filter answers "is this symbol/function already in the graph?" in O(1) time, using almost no memory
- It guarantees: if the answer is "NO" — the item is definitively absent. If "YES" — it probably exists (verify)
- This is used by Google, Cassandra, Chrome, and every major LSM-tree database
- Python: `pip install pybloom-live` (or implement manually — it's ~50 lines)
- No false negatives means you will never miss an existing node when checking for duplicates

**Virtual DOM Diffing** — Your analogy is architecturally sound.
- React's reconciler compares a "Virtual DOM" (lightweight JS objects) with the real DOM, and patches only the diff
- You will build a "Virtual Code Graph" (lightweight JSON/dict in memory) and compare it with the persisted graph
- The delta is computed and only affected nodes are updated — this is how CodePrism achieves O(k) updates instead of O(n)
- The key insight: assign every node a **content hash** (like React's `key` prop). If hash unchanged → skip. If changed → patch.

---

## 3. Why Build From Scratch

Every existing solution fails one or more of these non-negotiable requirements:

1. **No external database required** — Neo4j, Memgraph, Redis: all disqualified
2. **No cloud/API dependency** — some tools require a running server or cloud auth
3. **No Docker** — heavyweight deployment defeats the purpose
4. **Token-efficient output for agents** — most tools output verbose JSON or HTML meant for humans, not LLMs
5. **Git session intelligence** — no tool tracks what changed *per session* with agent-readable summaries
6. **CLI-first** — most tools are IDE plugins or web apps, not terminal commands

**CodeGraphX will be:** a single CLI command + a background watcher + a set of flat files that any coding agent can read instantly.

---

## 4. Core Concepts — Validated

### 4a. Virtual Graph Diffing (your "Virtual DOM" idea)

**Status: Correct and used in production systems.**

CodePrism (Rust) uses exactly this:
```
File changes → Hash check → Only re-parse changed files → 
Compute delta nodes → Patch the persisted graph
Time: O(k) where k = changed nodes, not O(n) for all files
```

You will implement this in Python/Node.js as:
```
1. In-memory Virtual Graph = lightweight dict {file_path → {hash, nodes[]}}
2. On file save: re-parse only that file → build new Virtual Graph entry
3. Diff: compare old entry vs new entry (node added/removed/modified)
4. Patch: apply only the diff to the main persisted CodeGraph JSON/TOON file
5. Emit: push the delta to the live HTML dashboard via WebSocket
```

### 4b. Bloom Filter for Symbol Lookup (your "Google username check" idea)

**Status: Correct. This is a standard CS data structure.**

When an agent asks "does function `calculate_tax` exist anywhere?":
- Without Bloom filter: scan all nodes → O(n)
- With Bloom filter: hash the name → check bit array → answer in O(1) with near-zero false negatives

You maintain a Bloom filter of all **symbol names** (function names, class names, variable names) across the entire codebase. This lets the agent do near-instant existence checks before deeper lookup.

### 4c. TOON for Agent-Readable Files

**Status: Correct. The format exists and is proven 30–60% more token-efficient.**

Instead of storing:
```json
[{"file": "utils.py", "function": "parse_date", "line": 45, "calls": ["datetime.strptime"]},
 {"file": "utils.py", "function": "format_output", "line": 67, "calls": ["json.dumps"]}]
```

You store as TOON:
```
functions[2]{file,function,line,calls}:
utils.py,parse_date,45,[datetime.strptime]
utils.py,format_output,67,[json.dumps]
```

### 4d. Git Session Intelligence

**Status: Novel combination, not implemented in any existing tool.**

You will hook into `git diff` and `git log` to:
1. Detect what changed since the last commit or last session
2. Feed the diff to a local summary prompt (optional LLM or rule-based)
3. Write a structured `CHANGELOG.toon` entry: "Session 2026-04-19: Added auto-scroll to frontend, modified `handleScroll()` in `App.jsx`, added CSS rule in `styles.css`"
4. The agent reads this file at session start to instantly know "what we did last time"

---

## 5. System Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    YOUR CODEBASE                            │
│  src/  *.py  *.ts  *.js  *.jsx  *.html  *.css              │
└────────────────────────┬────────────────────────────────────┘
                         │ file save / git commit
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              FILE WATCHER (chokidar / watchdog)             │
│  Detects: create, modify, delete, rename                    │
└────────────────────────┬────────────────────────────────────┘
                         │ changed file path
                         ▼
┌─────────────────────────────────────────────────────────────┐
│           INCREMENTAL PARSER (Tree-sitter)                  │
│  Re-parses only the changed file                            │
│  Extracts: functions, classes, imports, exports, calls      │
└────────────────────────┬────────────────────────────────────┘
                         │ new AST nodes
                         ▼
┌─────────────────────────────────────────────────────────────┐
│         VIRTUAL GRAPH ENGINE (in-memory diff layer)         │
│  Compare new nodes vs cached nodes for this file            │
│  Compute delta: added / removed / modified nodes            │
└────────────────────────┬────────────────────────────────────┘
                         │ delta patch
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              PERSISTED CODE GRAPH (flat files)              │
│  codegraph.toon      ← full graph in TOON format            │
│  file_index.toon     ← one-liner summary per file           │
│  symbols.bloom       ← Bloom filter of all symbol names     │
│  CHANGELOG.toon      ← per-commit/session change log        │
└──────────┬──────────────────────────────┬───────────────────┘
           │ read (agent)                  │ push (websocket)
           ▼                               ▼
┌──────────────────────┐     ┌────────────────────────────────┐
│  CODING AGENT        │     │  LIVE HTML DASHBOARD           │
│  (Gemini CLI /       │     │  codegraph.html                │
│   Claude Code)       │     │  Auto-refreshes on every       │
│                      │     │  change via WebSocket          │
│  Reads TOON files    │     │  D3.js / Vis.js force graph    │
│  Gets full graph     │     │  Searchable, filterable        │
│  in minimal tokens   │     │  Impact highlighter            │
└──────────────────────┘     └────────────────────────────────┘
```

---

## 6. Component Deep Dive

### Component 1: File Watcher

**Purpose:** Detect any file change in the codebase and trigger the parser pipeline.

**Technology:**
- Node.js: `chokidar` (used by webpack, vite, jest — zero config)
- Python: `watchdog` library

**Behavior:**
```
watch(['**/*.py', '**/*.js', '**/*.ts', '**/*.jsx', '**/*.html', '**/*.css'])
ignore: ['node_modules/', '.git/', '__pycache__/', 'dist/', 'build/', '.codegraphx/']
debounce: 300ms (prevents firing 10 events per save)
```

**Trigger conditions:**
- File modified → re-parse that file
- File created → parse new file, add all nodes
- File deleted → remove all nodes associated with that file
- File renamed → remove old path nodes, add new path nodes

### Component 2: Language Parsers (Tree-sitter)

**Purpose:** Extract code entities and their relationships from source files.

**What it extracts per file:**

| Entity Type | Examples | Relationship |
|-------------|----------|-------------|
| Functions | `def process()`, `function render()` | DEFINED_IN, CALLS |
| Classes | `class UserModel`, `interface IUser` | DEFINED_IN, EXTENDS, IMPLEMENTS |
| Imports | `import pandas`, `from utils import *` | IMPORTS_FROM |
| Exports | `export default App`, `module.exports` | EXPORTED_BY |
| React Components | `const Button = () =>`, `class Card extends Component` | IS_COMPONENT, RENDERS |
| CSS Classes/IDs | `.container`, `#header` | DEFINED_IN, APPLIED_TO |
| HTML Elements | `<form id="login">` | CONTAINS |
| Variables (global) | `const API_URL = ...` | DECLARED_IN |

**Language → Tree-sitter grammar packages:**

```
Python     → tree-sitter-python
JavaScript → tree-sitter-javascript
TypeScript → tree-sitter-typescript
React/JSX  → tree-sitter-javascript (JSX support built-in)
HTML       → tree-sitter-html
CSS        → tree-sitter-css
```

**Node.js install:**
```bash
npm install tree-sitter tree-sitter-python tree-sitter-javascript \
            tree-sitter-typescript tree-sitter-html tree-sitter-css
```

**Python install:**
```bash
pip install tree-sitter tree-sitter-python tree-sitter-javascript \
            tree-sitter-typescript tree-sitter-html tree-sitter-css
```

### Component 3: Graph Builder

**Purpose:** Convert parsed AST nodes into a graph data structure.

**Node schema (one node):**
```
{
  id: "utils.py::parse_date",        # unique node ID
  type: "function",                   # function | class | variable | import | component
  name: "parse_date",
  file: "src/utils.py",
  line_start: 45,
  line_end: 52,
  signature: "parse_date(date_str: str) -> datetime",
  docstring: "Parses ISO date string to datetime",  # if present
  hash: "a3f9d2c1",                  # SHA-1 of the node's source code
  calls: ["datetime.strptime", "logger.debug"],
  called_by: [],                      # populated in resolution phase
  imports: [],
  language: "python"
}
```

**Edge types:**
```
CALLS        → function A calls function B
IMPORTS_FROM → file A imports from file B
DEFINED_IN   → entity X is defined in file Y
EXTENDS      → class A extends class B
IMPLEMENTS   → class A implements interface B
RENDERS      → React component A renders component B
EXPORTS      → file A exports entity X
IS_ENTRY     → this file is a top-level entry point
```

**Graph resolution (cross-file linking):**
After parsing all files, a resolution pass:
1. For each `calls` reference in a function node, search for a matching function node by name
2. If found → create a `CALLS` edge between them
3. If not found → mark as "external call" (library call, not user code)

This resolution is what enables impact analysis: "if I change `parse_date`, who calls it?"

### Component 4: Graph Store

**Purpose:** Persist the graph to disk in a format that agents can read efficiently.

**Files produced in `.codegraphx/` directory:**

```
.codegraphx/
├── codegraph.toon          # Full graph: all nodes and edges
├── file_index.toon         # One-liner per file (path, type, entity count, purpose)
├── symbols.bloom           # Bloom filter binary (fast symbol existence check)
├── symbols.json            # Full symbol → node_id lookup (for after bloom confirms)
├── CHANGELOG.toon          # Per-commit session log
├── graph.meta.json         # Stats: node count, edge count, last updated, version
└── codegraph.html          # Live interactive dashboard (self-contained HTML file)
```

**Why flat files (not a database):**
- Zero installation — no Postgres, Neo4j, SQLite setup required
- Git-friendly — TOON files can be committed and diffed
- Portable — copy the folder and everything works
- Agent-friendly — an agent can `read_file('.codegraphx/file_index.toon')` in one tool call

---

## 7. Virtual Graph Diffing Engine

This is the most sophisticated component — your "Virtual DOM" for code.

### The Core Idea

```
Real DOM          ←→     Virtual DOM (React)
Persisted Graph   ←→     Virtual Code Graph (CodeGraphX)
```

### How It Works (Step by Step)

**Step 1: Initial build**
- On `codegraphx init`, parse all files
- Build the full graph and persist it
- For each file, store: `file_path → content_hash`
- Store in `.codegraphx/cache.json`:
```json
{
  "src/utils.py": { "hash": "a3f9d2c1", "node_count": 12, "last_parsed": 1713500000 },
  "src/app.py":   { "hash": "b7e1f409", "node_count": 8,  "last_parsed": 1713500000 }
}
```

**Step 2: File change detected**

```python
def on_file_change(file_path):
    new_hash = sha1(file_path)
    old_hash = cache[file_path].hash
    
    if new_hash == old_hash:
        return  # No actual change (save without edits)
    
    # Re-parse only this file
    new_nodes = parse_file(file_path)
    old_nodes = cache[file_path].nodes
    
    # Compute delta
    delta = compute_delta(old_nodes, new_nodes)
    # delta = { added: [...], removed: [...], modified: [...] }
    
    # Apply patch to main graph
    apply_patch(delta)
    
    # Update cache
    cache[file_path] = { hash: new_hash, nodes: new_nodes }
    
    # Write updated graph files
    persist_graph()
    
    # Emit to dashboard WebSocket
    ws_broadcast(delta)
```

**Step 3: Delta computation**

For two sets of nodes (old and new for the same file):
```python
def compute_delta(old_nodes, new_nodes):
    old_by_id = {n.id: n for n in old_nodes}
    new_by_id = {n.id: n for n in new_nodes}
    
    added   = [n for id, n in new_by_id.items() if id not in old_by_id]
    removed = [n for id, n in old_by_id.items() if id not in new_by_id]
    modified = [n for id, n in new_by_id.items() 
                if id in old_by_id and n.hash != old_by_id[id].hash]
    
    return Delta(added=added, removed=removed, modified=modified)
```

**Step 4: Impact propagation**

When a node is modified or removed:
- Look up all nodes that have a `CALLS` edge pointing TO this node
- Mark them as "potentially impacted"
- Write to `impact_report.toon`: "Changing `parse_date` affects: `process_invoice`, `test_parse_date`, `export_report`"

This is the "what breaks if I change X" feature — derived automatically from the graph edges.

### The Bloom Filter Integration

```python
# On init: build bloom filter from all symbol names
bloom = BloomFilter(capacity=100_000, error_rate=0.001)
for node in all_nodes:
    bloom.add(node.name)

# On agent query: "does function 'calculate_tax' exist?"
if 'calculate_tax' not in bloom:
    return "Definitely does not exist"
else:
    return symbols_lookup['calculate_tax']  # O(1) hash lookup
```

The Bloom filter gives:
- Near-instant "definitely not exist" answers (eliminates unnecessary graph traversal)
- Memory usage: ~1.2MB for 100,000 symbols at 0.1% false positive rate
- Persisted to `.codegraphx/symbols.bloom` (binary, ~1KB for small projects)

---

## 8. TOON Output Layer

### What Each File Contains

**`file_index.toon`** — What the agent reads first to orient itself:
```
files[4]{path,type,entities,summary}:
src/utils.py,module,12,Date/string utility functions for data pipeline
src/transform.py,module,8,MB52 inventory transformation logic
src/xml_gen.py,module,6,SAP SpreadsheetML XML generator
src/main.py,entry,3,Pipeline orchestrator and CLI entry point
```
> This is 4 lines. The equivalent JSON would be ~20+ lines and 3x the tokens.

**`codegraph.toon`** — Full graph (what the agent reads for deep analysis):
```
meta:
  version: 1
  nodes: 47
  edges: 89
  generated: 2026-04-19T10:30:00

nodes[47]{id,type,name,file,line,calls,called_by}:
utils.py::parse_date,function,parse_date,src/utils.py,45,[datetime.strptime],[transform.py::process_row]
utils.py::format_output,function,format_output,src/utils.py,67,[json.dumps],[]
...

edges[89]{from,to,type}:
transform.py::process_row,utils.py::parse_date,CALLS
main.py::run_pipeline,transform.py::process_row,CALLS
...
```

**`CHANGELOG.toon`** — Agent reads this at session start:
```
sessions[3]{date,commit,summary,changed_files,changed_functions}:
2026-04-18,a3f9d2c,Added auto-scroll feature to frontend,src/App.jsx,[handleScroll,useEffect]
2026-04-17,b7e1f40,Fixed XML serialization bug in xml_gen.py,src/xml_gen.py,[_inject_rows,generate_sap_xml]
2026-04-16,c1d2e3f,Vectorized pandas operations for performance,src/transform.py,[transform_mb52_optimized]
```

**`graph.meta.json`** — Quick stats, not token-expensive:
```json
{
  "version": "1.0",
  "last_updated": "2026-04-19T10:30:00Z",
  "node_count": 47,
  "edge_count": 89,
  "file_count": 12,
  "languages": ["python", "javascript", "css"],
  "token_estimate": 1240
}
```

### How the Agent Uses These Files

When Gemini CLI starts a session, it should be given this GEMINI.md instruction (auto-generated by CodeGraphX):

```markdown
## CodeGraphX Context

This project has a live code graph. Before writing any code, read these files:

1. `.codegraphx/file_index.toon` — Overview of all files (fast orientation, ~50 tokens)
2. `.codegraphx/CHANGELOG.toon` — What changed in previous sessions
3. `.codegraphx/codegraph.toon` — Full graph (only if you need deep dependency analysis)

To check if a function exists: look in `.codegraphx/symbols.json`
To find what breaks if you change X: look for `called_by` field on that node in `codegraph.toon`
```

---

## 9. Git Commit Intelligence Layer

### How It Works

**On every `git commit`, a post-commit hook fires:**

```bash
# .git/hooks/post-commit (auto-installed by codegraphx init)
#!/bin/bash
codegraphx commit-scan
```

**`commit-scan` does:**

```python
def commit_scan():
    # 1. Get the diff of this commit
    diff = run("git diff HEAD~1 HEAD --unified=0")
    
    # 2. Parse changed functions from diff
    changed_functions = extract_changed_functions(diff)
    # Returns: [{"file": "App.jsx", "function": "handleScroll", "change": "added"}]
    
    # 3. Generate a one-line summary
    # Rule-based: "Added N functions, modified M functions in X files"
    # Optional LLM: Feed diff to local LLM for natural language summary
    summary = summarize_diff(diff, changed_functions)
    
    # 4. Get commit message
    commit_msg = run("git log -1 --pretty=%B")
    commit_hash = run("git log -1 --pretty=%H")[:7]
    
    # 5. Append to CHANGELOG.toon
    append_changelog_entry(commit_hash, summary, changed_functions)
    
    # 6. Update the graph with any new/changed nodes
    trigger_graph_update(changed_files)
```

### Rule-Based Summary (no LLM required)

You don't need an LLM to summarize a diff. A rule-based system works well:

```python
rules = {
    r"^\+def (\w+)":      "Added function {1}",
    r"^\+class (\w+)":    "Added class {1}",
    r"^-def (\w+)":       "Removed function {1}",
    r"^\+.*import (.+)":  "Added import {1}",
    r"^\+.*useState":     "Added React state hook",
    r"^\+.*useEffect":    "Added React effect hook",
}
```

This produces human-readable, agent-readable summaries with zero LLM dependency.

### Session Boundary Detection

A "session" ≠ a commit. You may make many commits in one work session, or work for hours without committing.

CodeGraphX tracks sessions by:
1. Timestamp-based: a new session starts if >4 hours since last file change
2. Git-based: a session = all commits since last "session marker" tag
3. Manual: `codegraphx session start "Implementing auto-scroll feature"`

---

## 10. HTML Live Dashboard

### What It Is

A self-contained, single HTML file (no build step, no npm server required) that:
- Opens in any browser
- Connects to a local WebSocket served by CodeGraphX
- Displays the code graph as an interactive force-directed network
- Updates in real-time as you save files

### Technology

- **D3.js (v7)** — loaded from CDN or bundled inline — for force-directed graph rendering
- **Native WebSocket API** — built into every modern browser
- **Vanilla JS** — no React, no build tools
- **Local WebSocket server** — served by the CodeGraphX watcher process on `ws://localhost:6789`

### Features

| Feature | Description |
|---------|-------------|
| **Force graph** | Nodes = code entities, edges = relationships, physics simulation |
| **Color coding** | Blue = Python, Orange = JavaScript, Green = CSS, Purple = React |
| **Click to inspect** | Click a node → see full details (signature, calls, called_by, file, line) |
| **Search** | Type a function name → highlight the node and its neighborhood |
| **Impact highlight** | Click "Impact Mode" → select a node → all affected nodes glow red |
| **Change pulse** | When a file is saved, changed nodes briefly pulse yellow |
| **Filter by language** | Toggle Python / JS / CSS / HTML layers on/off |
| **Zoom/pan** | Standard D3 zoom behavior |
| **Export** | Download current graph as PNG or as JSON |

### Update Mechanism

```javascript
// In codegraph.html
const ws = new WebSocket('ws://localhost:6789');
ws.onmessage = (event) => {
    const delta = JSON.parse(event.data);
    // delta = { added: [...nodes], removed: [...node_ids], modified: [...nodes] }
    
    // Apply delta to D3 simulation
    delta.added.forEach(node => graph.addNode(node));
    delta.removed.forEach(id => graph.removeNode(id));
    delta.modified.forEach(node => graph.updateNode(node));
    
    // Flash changed nodes yellow for 1 second
    delta.modified.forEach(id => flashNode(id, 'yellow'));
    delta.added.forEach(node => flashNode(node.id, 'green'));
};
```

This is the "Virtual DOM" principle applied to the graph dashboard. Only the delta is transmitted and applied — not a full re-render.

---

## 11. File Structure of the Package

```
codegraphx/
├── package.json                  # npm package definition
├── pyproject.toml                # Python package definition (both supported)
├── bin/
│   └── codegraphx                # CLI entry point
├── src/
│   ├── cli.js                    # CLI command router (init, watch, scan, etc.)
│   ├── watcher.js                # File system watcher (chokidar)
│   ├── parser/
│   │   ├── index.js              # Language router
│   │   ├── python.js             # Python AST extractor
│   │   ├── javascript.js         # JS/JSX AST extractor
│   │   ├── typescript.js         # TypeScript AST extractor
│   │   ├── html.js               # HTML element extractor
│   │   └── css.js                # CSS class/ID extractor
│   ├── graph/
│   │   ├── builder.js            # Node/edge construction
│   │   ├── resolver.js           # Cross-file edge resolution
│   │   ├── differ.js             # Virtual graph diff engine
│   │   └── store.js              # Persist to .codegraphx/
│   ├── bloom/
│   │   └── filter.js             # Bloom filter implementation (~50 lines)
│   ├── toon/
│   │   └── encoder.js            # JSON → TOON encoder
│   ├── git/
│   │   └── commit-scanner.js     # Git hook integration
│   ├── server/
│   │   └── ws-server.js          # WebSocket server for dashboard
│   └── dashboard/
│       └── codegraph.html        # Self-contained live dashboard
├── templates/
│   └── GEMINI.md.template        # Agent instruction file template
└── tests/
    ├── fixtures/                 # Sample code files for testing
    └── *.test.js                 # Unit tests
```

**Generated in user's project (`.codegraphx/`):**
```
your-project/
├── .codegraphx/
│   ├── codegraph.toon
│   ├── file_index.toon
│   ├── symbols.bloom
│   ├── symbols.json
│   ├── CHANGELOG.toon
│   ├── graph.meta.json
│   └── codegraph.html
├── GEMINI.md                     # Auto-generated agent instructions
└── .gitignore                    # CodeGraphX suggests adding .codegraphx/ or keeping it
```

---

## 12. Technology Stack (Zero Heavy Dependencies)

| Layer | Technology | Why | Install |
|-------|-----------|-----|---------|
| Parsing | `tree-sitter` + language grammars | Battle-tested, incremental, multi-language | `npm install tree-sitter tree-sitter-python ...` |
| File watching | `chokidar` (Node) or `watchdog` (Python) | Lightweight, cross-platform, debounced | `npm install chokidar` |
| Graph storage | Flat TOON files + JSON | No DB required, Git-friendly, agent-readable | (no install) |
| Bloom filter | Custom 50-line implementation | Tiny, no dependency | (built-in) |
| TOON encoding | `@toon-format/toon` | Official MIT SDK | `npm install @toon-format/toon` |
| WebSocket | `ws` (Node) | Minimal WebSocket server | `npm install ws` |
| Dashboard | D3.js v7 (CDN) + Vanilla JS | No build step required | (CDN link) |
| Git integration | `simple-git` | Thin wrapper over git CLI | `npm install simple-git` |
| Hashing | Node.js built-in `crypto` | No dependency | (built-in) |
| CLI | `commander.js` | Lightweight CLI framework | `npm install commander` |

**Total npm dependencies: ~6 packages**
**No database, no Docker, no cloud**

---

## 13. Language Support Matrix

| Language | Parsing | Functions | Classes | Imports | React/JSX | HTML Elements | CSS Selectors |
|----------|---------|-----------|---------|---------|-----------|----------------|---------------|
| Python | ✅ Full | ✅ | ✅ | ✅ | N/A | N/A | N/A |
| JavaScript | ✅ Full | ✅ | ✅ | ✅ | ✅ | N/A | N/A |
| TypeScript | ✅ Full | ✅ | ✅ | ✅ | ✅ | N/A | N/A |
| React JSX | ✅ Full | ✅ | ✅ | ✅ | ✅ | N/A | N/A |
| React TSX | ✅ Full | ✅ | ✅ | ✅ | ✅ | N/A | N/A |
| Node.js | ✅ (via JS) | ✅ | ✅ | ✅ | N/A | N/A | N/A |
| HTML | ✅ Full | N/A | N/A | ✅ (links) | N/A | ✅ | N/A |
| CSS | ✅ Full | N/A | N/A | N/A | N/A | N/A | ✅ |

---

## 14. Implementation Roadmap

### Phase 0: Foundation (Week 1–2)
**Goal: Basic parsing and graph output for Python**

- [ ] Set up Node.js package scaffold with `commander.js` CLI
- [ ] Implement `codegraphx init` command
- [ ] Integrate `tree-sitter-python` — extract functions, classes, imports
- [ ] Build graph node schema and builder
- [ ] Persist graph as `codegraph.json` (not TOON yet — JSON first for debugging)
- [ ] Write unit tests with sample Python files

**Milestone:** `codegraphx init` on a Python project produces `codegraph.json` with all functions and their call relationships.

### Phase 1: Multi-Language (Week 3–4)
**Goal: Full language support**

- [ ] Add `tree-sitter-javascript` + `tree-sitter-typescript`
- [ ] Add `tree-sitter-html` + `tree-sitter-css`
- [ ] Add JSX/TSX support
- [ ] Cross-file edge resolution pass
- [ ] Implement `file_index` generation
- [ ] Write language detection (by extension)

**Milestone:** `codegraphx init` on a React + Python project produces a connected cross-language graph.

### Phase 2: Live Watching (Week 5–6)
**Goal: Real-time updates**

- [ ] Integrate `chokidar` file watcher
- [ ] Implement `codegraphx watch` command
- [ ] Build Virtual Graph Differ (hash-based delta computation)
- [ ] Incremental graph patching (apply delta to persisted files)
- [ ] WebSocket server for dashboard communication

**Milestone:** Edit a Python function and within 500ms the graph is updated.

### Phase 3: TOON & Bloom (Week 7)
**Goal: Token-efficient agent output**

- [ ] Convert JSON output to TOON format
- [ ] Implement Bloom filter for symbol names
- [ ] Persist `symbols.bloom` and `symbols.json`
- [ ] Benchmark token count: TOON vs JSON on a real project

**Milestone:** `codegraph.toon` uses 40%+ fewer tokens than equivalent JSON.

### Phase 4: HTML Dashboard (Week 8–9)
**Goal: Real-time visual graph**

- [ ] Build self-contained `codegraph.html` with D3.js force graph
- [ ] Connect to WebSocket for real-time delta updates
- [ ] Node click → detail panel
- [ ] Impact highlighting
- [ ] Search by function name
- [ ] Change pulse animation

**Milestone:** Open `codegraph.html` in browser, save a file, see the graph update live.

### Phase 5: Git Intelligence (Week 10)
**Goal: Session memory**

- [ ] `codegraphx git-hook install` — installs post-commit hook
- [ ] `commit-scan` — parses git diff, extracts changed functions
- [ ] Rule-based diff summarizer
- [ ] `CHANGELOG.toon` writer
- [ ] `codegraphx session start/end` commands

**Milestone:** After a commit, `CHANGELOG.toon` contains a structured entry. A coding agent can read it and know exactly what changed.

### Phase 6: Agent Integration File (Week 11)
**Goal: Gemini CLI integration**

- [ ] Auto-generate `GEMINI.md` with CodeGraphX usage instructions
- [ ] Provide query examples for the agent
- [ ] Test end-to-end with Gemini CLI on a real project
- [ ] Performance benchmark: agent response quality with vs without CodeGraphX

**Milestone:** Gemini CLI, given only `GEMINI.md`, correctly navigates the codebase and answers "which functions call `parse_date`?" without scanning any files.

### Phase 7: Polish & Package (Week 12)
**Goal: Release as npm/pip package**

- [ ] `npm publish codegraphx`
- [ ] `pip publish codegraphx`
- [ ] `README.md` with quick-start guide
- [ ] `codegraphx update` command for upgrading the graph schema
- [ ] `codegraphx stats` command for quick overview

---

## 15. Gemini CLI Integration

Gemini CLI uses a `GEMINI.md` file in the project root as its system context. CodeGraphX auto-generates this file.

**Auto-generated `GEMINI.md` content:**

```markdown
# Project Context (Auto-generated by CodeGraphX v1.0)
Last updated: 2026-04-19 10:30:00

## How to Navigate This Codebase (DO THIS FIRST)

This project uses CodeGraphX for codebase navigation. 
NEVER scan individual files to understand structure. Instead:

### Step 1: Orient yourself (always do this at session start)
Read: `.codegraphx/file_index.toon`
This gives you a one-liner summary of every file. (~50 tokens)

### Step 2: Check what changed since last session
Read: `.codegraphx/CHANGELOG.toon`
This tells you what was built/changed in previous sessions.

### Step 3: Check if a function/class exists
Read: `.codegraphx/symbols.json`
Keys are symbol names, values are file paths and line numbers.

### Step 4: Understand dependencies (only when needed)
Read: `.codegraphx/codegraph.toon`
Full graph with all calls and relationships.

### Impact Analysis
In `codegraph.toon`, look at the `called_by` field on any node.
This tells you exactly which functions will break if you change it.

## Project Stats
- Total files: 12
- Total functions: 47
- Total classes: 8
- Languages: Python, JavaScript, CSS
```

---

## 16. Performance Targets

| Operation | Target | Method |
|-----------|--------|--------|
| Initial full scan (100 files) | < 10 seconds | Tree-sitter batch parse |
| File update propagation | < 500ms | Incremental parse + delta patch |
| Agent `file_index.toon` read | < 100 tokens | TOON format |
| Agent `codegraph.toon` read (100 nodes) | < 1,500 tokens | TOON format |
| Symbol existence check | < 1ms | Bloom filter O(1) |
| Impact analysis query | < 50ms | Graph traversal from node |
| Dashboard update latency | < 200ms | WebSocket delta push |

**Comparison: With vs Without CodeGraphX**

| Metric | Without CodeGraphX | With CodeGraphX |
|--------|--------------------|-----------------|
| Tokens to orient agent (100-file project) | 8,000–15,000 | 50–200 |
| Time to "understand" codebase | 30–90 seconds | < 2 seconds |
| Cross-session memory | None | Full CHANGELOG |
| Impact analysis | Manual + slow | Instant from graph |
| "What files exist?" | File scan every time | Single file read |

---

## 17. Edge Cases & Known Challenges

### Challenge 1: Dynamic imports and eval()
Python's `__import__()` or JavaScript's `import()` dynamic imports cannot be resolved statically by Tree-sitter. 

**Solution:** Mark these as "dynamic import" nodes — visible in dashboard but not resolved.

### Challenge 2: Monkeypatching and dynamic class modification
Python allows classes to be modified at runtime. Static analysis cannot capture this.

**Solution:** Flag files that contain `setattr()`, `__dict__` modification, or decorator patterns as "dynamically modified" — agent is warned.

### Challenge 3: Very large files (10,000+ lines)
Tree-sitter handles these well (it's incremental), but the graph output may be large.

**Solution:** Apply a depth limit — only extract top-level functions and classes, not every nested function. Nested functions are listed as children of their parent.

### Challenge 4: Minified JavaScript / compiled output
`dist/` and `build/` folders contain non-human-readable code.

**Solution:** Always ignore `dist/`, `build/`, `.next/`, `__pycache__/` by default. Configurable via `.codegraphxignore`.

### Challenge 5: Circular imports
`A imports B`, `B imports A` — creates a cycle in the graph.

**Solution:** Detect and mark cycles during the resolution pass. Show them in the dashboard with a distinct edge color (red dashed). Do not enter infinite loops.

### Challenge 6: TypeScript types and interfaces
TypeScript adds type annotations, generics, interfaces that have no runtime equivalent.

**Solution:** Include interfaces and type aliases as first-class nodes (`type: "interface"`, `type: "type_alias"`). This is useful for understanding the data contract in a codebase.

---

## 18. Naming, Packaging & Distribution

### Package Name: `codegraphx`
- **npm:** `npm install -g codegraphx`
- **pip:** `pip install codegraphx`
- **CLI command:** `cgx` (short alias) or `codegraphx`

### CLI Commands

```
codegraphx init              # Initial full scan of current directory
codegraphx watch             # Start file watcher + WebSocket server
codegraphx scan              # Re-scan everything (manual refresh)
codegraphx stats             # Print graph statistics
codegraphx dashboard         # Open codegraph.html in default browser
codegraphx git-hook install  # Install post-commit hook
codegraphx git-hook remove   # Remove the hook
codegraphx session start     # Mark a new work session
codegraphx session summary   # Print what changed in current session
codegraphx query <name>      # Look up a symbol by name
codegraphx impact <name>     # Show impact of changing a symbol
codegraphx export json       # Export graph as JSON (for debugging)
codegraphx update            # Upgrade CodeGraphX to latest version
```

### Configuration File: `.codegraphxrc`

```json
{
  "watch": ["src/**", "lib/**"],
  "ignore": ["node_modules", "dist", "__pycache__", ".git"],
  "languages": ["python", "javascript", "typescript", "html", "css"],
  "debounce_ms": 300,
  "ws_port": 6789,
  "output_dir": ".codegraphx",
  "agent": "gemini",
  "session_timeout_hours": 4,
  "toon_format": true,
  "bloom_capacity": 100000,
  "bloom_error_rate": 0.001
}
```

### `.gitignore` Recommendation

You can choose either:
- **Commit the graph** (team shares context) → don't ignore `.codegraphx/`
- **Local only** (each dev has their own) → add `.codegraphx/` to `.gitignore`

The `CHANGELOG.toon` is worth committing. The `codegraph.toon` can be regenerated from source.

---

## Summary: What Makes CodeGraphX Different

| Feature | Other Tools | CodeGraphX |
|---------|-------------|------------|
| No database required | ❌ Neo4j / Memgraph / SQLite | ✅ Flat files only |
| TOON token efficiency | ❌ JSON / verbose output | ✅ 40% fewer tokens |
| Virtual graph diffing | Partial (CodePrism only) | ✅ Full delta engine |
| Session memory (CHANGELOG) | ❌ None | ✅ Per-commit TOON log |
| Live HTML dashboard | ❌ External web app | ✅ Self-contained local HTML |
| Bloom filter for symbols | ❌ None | ✅ O(1) existence check |
| Gemini CLI native | ❌ None | ✅ Auto-generates GEMINI.md |
| Install complexity | ❌ Docker / cloud setup | ✅ `npm install -g codegraphx` |
| Truly from scratch | ❌ Wraps Neo4j etc. | ✅ All custom implementation |

---

*This document is a living reference. As CodeGraphX develops, update this file with implementation decisions, benchmark results, and design changes.*

*Generated with research from: CodePrism architecture, Tree-sitter docs, TOON format spec (toonformat.dev), Bloom filter CS theory, React reconciliation algorithm, and analysis of Graphify, GitNexus, Code-Review-Graph, Mem-Palace, OpenSpace, and code-graph-mcp.*
