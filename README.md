# CodeGraphX

<p align="center">
  <img src="assets/logo.png" alt="CodeGraphX Banner" width="30%" border-radius="50%" />
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/codegraphx"><img src="https://img.shields.io/npm/v/codegraphx.svg" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/codegraphx"><img src="https://img.shields.io/npm/dm/codegraphx.svg" alt="npm downloads" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/npm/l/codegraphx.svg" alt="license" /></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D18-blue.svg" alt="node version" /></a>
</p>

> **CodeGraphX** is a local, token-efficient codebase graphing system designed for AI coding agents and human developers. It uses Tree-sitter to parse code incrementally, builds a dependency graph, and exposes it via CLI or MCP server — eliminating costly file-scanning loops and enabling instant symbol lookup.

---

## ✨ Key Features

| Feature | Benefit |
|---------|---------|
| 🧠 **Incremental Parsing** | Only re-parses changed files; O(1) cache hits for unchanged code |
| 🔗 **Call Graph & Dependencies** | Track `calls`, `called_by`, and `imports` across your entire codebase |
| 🌉 **Cross-Language Linking** | Connect frontend HTTP calls (`fetch`/`axios`) to backend routes (Express/Flask/FastAPI) — even across JS ↔ Python |
| ⚡ **Bloom Filter Lookup** | O(1) symbol existence checks with configurable false-positive rate |
| 🤖 **MCP Server Support** | Native integration with Gemini CLI, Claude Desktop, Cursor, and other MCP-compatible agents |
| 🌐 **Interactive Dashboard** | Real-time D3.js visualization of your code graph in the browser |
| 🔐 **100% Local** | No cloud, no telemetry, no data leaves your machine |
| 📦 **TOON Output Format** | Token-optimized serialization for efficient agent context injection |
| 🛠️ **Multi-Language** | Python, JavaScript, TypeScript, JSX, TSX, HTML, CSS (expandable) |

---

## 🚀 Installation

### Global Installation (Recommended)

```bash
npm install -g codegraphx
```

### Project-Local Installation

```bash
npm install --save-dev codegraphx
```

### Verify Installation

```bash
codegraphx --version
# Output: 1.1.0
```

---

## 📦 Quick Start

### Step 1: Initialize Your Code Graph

```bash
cd your-project
codegraphx scan
```

This creates a `.codegraphx/` directory containing:
- `codebase.json` — Full symbol/edge graph
- `symbols.bloom` — Bloom filter for O(1) symbol checks
- `cache.json` — Incremental parsing cache
- `codegraph.html` — Interactive dashboard (optional)

### Step 2: Query Your Codebase

```bash
# Find where a symbol is defined
codegraphx query authenticateUser

# Trace downstream impact (what does this function call?)
codegraphx impact authenticateUser --direction downstream

# Trace upstream impact (what calls this function?)
codegraphx impact authenticateUser --direction upstream

# View graph statistics
codegraphx stats
```

### Step 3: Live Watch & Dashboard (Optional)

```bash
# Start file watcher for real-time updates
codegraphx watch

# Open interactive graph in browser
codegraphx dashboard
```

---

## 🤖 MCP Server Integration

CodeGraphX includes a **Model Context Protocol (MCP)** server that allows AI coding agents to query your codebase structure intelligently — saving tokens and eliminating cold-start scanning.

**Zero-setup:** you do not need to run a scan first. On its first start in a project, the server automatically indexes the codebase in the background. While indexing, `get_graph_status` reports `"indexing"`; once it reports `"ready"`, every tool is live.

### Available MCP Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `get_graph_status` | Readiness check: `indexing`, `ready`, or `error`, plus file count | None |
| `list_files` | Lists all indexed files | `filter?: string` |
| `check_symbol_exists` | Instant O(1) Bloom-filter lookup — `probable_yes` / `definite_no` | `name: string` |
| `explain_impact` | Blast radius of a symbol: who uses it upstream, what it breaks downstream | `symbol_name: string` |
| `verify_task` | Compare a task description against a commit's actual changes — status, changed symbols, untested additions | `task_description: string`, `commit_hash?: string` |
| `get_session_diff` | Summarize changes in current Git session/branch | `branch?: string` (default: `"HEAD"`) |

### Example Agent Workflow

```
User: "What breaks if I change the validateInput function?"

Agent (via MCP):
1. check_symbol_exists({ name: "validateInput" })
   → { "exists": "probable_yes" }

2. explain_impact({ symbol_name: "validateInput" })
   → { "used_by_upstream": ["src/auth.js::login"], "breaks_downstream": ["src/api.js::handleRequest"] }

Result: Instant answer without scanning 50+ files.
```

### Picking the Project Root

The server indexes the directory it is started in. If your MCP client doesn't set a working directory, pass it explicitly — either way works:

```bash
cgx-mcp --project-root /path/to/your/project
# or
CGX_PROJECT_ROOT=/path/to/your/project cgx-mcp
```

---

## 🔌 Connecting MCP to AI Agents

### 💻 Claude Code (CLI)

From inside your project directory:

```bash
claude mcp add codegraphx -- npx -y -p codegraphx cgx-mcp
```

Or in your project's `.mcp.json`:

```json
{
  "mcpServers": {
    "codegraphx": {
      "command": "npx",
      "args": ["-y", "-p", "codegraphx", "cgx-mcp"]
    }
  }
}
```

### 🤖 Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows). Claude Desktop has no project directory, so set the root explicitly:

```json
{
  "mcpServers": {
    "codegraphx": {
      "command": "npx",
      "args": ["-y", "-p", "codegraphx", "cgx-mcp", "--project-root", "/path/to/your/project"]
    }
  }
}
```

### 🧭 Gemini CLI

In your project's `.gemini/settings.json` (use an absolute path to `node` — Gemini doesn't inherit your shell PATH; see `mcp-setup.md` for troubleshooting):

```json
{
  "mcpServers": {
    "codegraphx": {
      "command": "/ABSOLUTE/PATH/TO/node",
      "args": ["/ABSOLUTE/PATH/TO/node_modules/codegraphx/bin/cgx-mcp"],
      "cwd": "/ABSOLUTE/PATH/TO/YOUR_PROJECT"
    }
  }
}
```

> 💡 **Pro Tip**: If your client ignores `cwd`, add `"--project-root", "/path/to/project"` to `args` — it takes precedence over the working directory.

### 🪄 Cursor / Windsurf / Other MCP Clients

Most MCP clients support a `mcp.json` or settings file. Use the same structure as above, ensuring:
- `cwd` points to your project root
- The server has read access to your codebase
- You've run `codegraphx scan` at least once (or let the server auto-initialize)

### ✅ Verification

After configuration, test the connection:

```bash
# In Gemini CLI
/mcp list
# Should show: ✓ codegraphx — Connected (6 tools)

# Or manually test the MCP server
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | npx -y -p codegraphx cgx-mcp
```

---

## 🔐 Security & Privacy

### Data Handling
- ✅ **100% local execution** — No network calls, no telemetry, no cloud sync
- ✅ **Read-only analysis** — CodeGraphX never modifies your source files
- ✅ **Configurable ignore patterns** — Exclude sensitive directories via `.codegraphxrc`

### Configuration Example (`.codegraphxrc`)

```json
{
  "ignore": [
    ".git",
    "node_modules",
    "__pycache__",
    ".venv",
    "secrets/",
    "*.env",
    "config/private/"
  ],
  "outputDir": ".codegraphx",
  "extensions": [".py", ".js", ".ts"],
  "bloomErrorRate": 0.01
}
```

### MCP Security Notes
- The MCP server runs with the same permissions as your terminal session
- It only reads files matching configured extensions and ignore patterns
- No code is executed — only parsed statically via Tree-sitter
- For sensitive projects, run CodeGraphX in a sandboxed environment or container

---

## 📁 Project Structure

```
your-project/
├── .codegraphx/              # Generated output (gitignore recommended)
│   ├── codebase.json         # Full graph data
│   ├── symbols.bloom         # Bloom filter for O(1) lookups
│   ├── cache.json            # Incremental parse cache
│   ├── codegraph.html        # Interactive dashboard
│   ├── codegraph-graph.json  # D3.js compatible graph
│   ├── file_index.toon       # Token-optimized file index
│   ├── codegraph.toon        # Token-optimized full graph
│   └── CHANGELOG.toon        # Session/commit change history
├── .codegraphxrc             # Optional config file
├── .gemini/
│   └── mcp.json              # Gemini CLI MCP configuration
└── GEMINI.md                 # Auto-generated agent instructions
```

> 💡 Add `.codegraphx/` to your `.gitignore` — these are build artifacts, not source.

---

## 🛠️ Advanced Usage

### Custom Configuration

Create `.codegraphxrc` in your project root:

```json
{
  "extensions": [".py", ".js", ".ts", ".jsx", ".tsx", ".html", ".css"],
  "ignore": [
    ".git", "node_modules", "__pycache__", ".venv", "dist", "build",
    "*.test.*", "*.spec.*", "coverage", ".next", ".nuxt"
  ],
  "outputDir": ".codegraphx",
  "outputFile": "codebase.json",
  "bloomErrorRate": 0.001
}
```

### Git Integration

Auto-update graph on commits:

```bash
# Install Git hooks
codegraphx git-hook install

# Hooks will auto-run `codegraphx scan` on:
# - post-commit (after each commit)
# - pre-push (before pushing to remote)

# Remove hooks later
codegraphx git-hook remove
```

### Health Check & Diagnostics

```bash
# Analyze graph for issues
codegraphx doctor

# JSON output for CI/CD
codegraphx doctor --json

# Strict mode: exit code 1 if issues found
codegraphx doctor --strict

# Skip call-target warnings (reduce noise)
codegraphx doctor --no-calls
```

### Session Diff & Branch Comparison

```bash
# Summarize changes in current session
codegraphx session summary

# Compare two branches
codegraphx diff main feature-branch

# Output includes:
# - added/removed/modified symbols
# - Rule-based summary (e.g., "Added function processOrder")
# - Impact analysis ready for agent review
```

### Cross-Language Intelligence

CodeGraphX links the frontend to the backend automatically. During a scan it
extracts the HTTP requests your client code makes and the routes your server
exposes, then matches them into `API_CALLS` edges with a confidence score:

```
fetch('/api/users')        ──API_CALLS(0.9)──▶  app.get('/api/users', listUsers)   [Express]
axios.post('/api/orders')  ──API_CALLS(0.9)──▶  @router.post('/api/orders')        [FastAPI]
fetch(`/api/users/${id}`)  ──API_CALLS(0.7)──▶  @app.route('/api/users/<id>')      [Flask]
```

Supported on both sides of the stack:

- **Frontend calls**: `fetch(...)` (with `method` option), `axios.get/post/...`, `axios({ url, method })`, and axios-like clients.
- **Backend routes**: Express/`router` (`app.get`, `router.post`, …), Flask (`@app.route(..., methods=[...])`), and FastAPI (`@router.get`, `@app.post`, …).

Confidence: `0.9` exact path + method, `0.75` exact path / different method,
`0.7` parameterized path + method, `0.55` parameterized path / different method.
Path parameters (`:id`, `{id}`, `<int:id>`) are normalized before matching, so a
React component calling `/api/users/${id}` links to a FastAPI `/api/users/{user_id}`
handler even though the two never reference each other directly. Route handlers
are also tagged with an `endpoint` ontology marker, and `explain_impact` traverses
`API_CALLS` edges — so an agent asking "what calls this backend handler?" sees the
frontend functions across the language boundary.

---

## 📊 Benchmarks / Accuracy

CodeGraphX is meant to be *trusted* in place of reading code, so its graph is
measured against a hand-labeled golden corpus (`tests/golden/`) where every
symbol, edge, cross-language API link and import cycle is known. The same
harness gates CI (`tests/golden/accuracy.test.js`) — a parser regression fails
the build.

Latest run (curated corpus: 3 fixtures, 9 files, 20 symbols):

| Category | Precision | Recall | F1 |
|---|---|---|---|
| Symbols | 100% | 100% | 100% |
| Structural edges (CALLS / IMPORTS / INHERITS) | 100% | 100% | 100% |
| Cross-language API links | 100% | 100% | 100% |
| Endpoint tagging | 100% | 100% | 100% |

| Reasoning check | Result |
|---|---|
| Impact tracing (exact reachable set) | 4/4 (100%) |
| Circular-import detection (recall) | 1/1 (100%) |
| Circular-import false positives | 0 |
| Deterministic across re-scans | yes |

Reproduce and regenerate [`BENCHMARK.md`](BENCHMARK.md) + `benchmark-results.json`:

```bash
npm run benchmark
```

> Numbers reflect the controlled golden corpus, not arbitrary real-world repos —
> they verify extraction *correctness*, not coverage of every language construct.
> Extend the corpus under `tests/golden/<fixture>/` with a `ground-truth.json` to
> raise the bar.

---

## 🧪 Testing

```bash
# Run test suite
npm test

# Run specific test file
npm test -- tests/server/mcp-server.test.js

# Verify MCP server manually
node tests/verify-mcp.js
```

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Make changes and add tests
4. Run tests: `npm test`
5. Submit a pull request

### Development Setup

```bash
git clone https://github.com/techcraze00/CodeGraphX.git
cd codegraphx
npm install
npm link  # Makes `codegraphx` command available globally
```

### Adding New Language Support

1. Add language grammar to `package.json` dependencies
2. Register parser in `src/parser.js`
3. Implement extractor in `src/graph.js`
4. Add tests in `tests/parser/`

---

## ❓ FAQ

**Q: Do I need to run `codegraphx scan` every time?**  
A: No. The server auto-initializes on first use. Re-scan only when you want to update the graph after significant changes, or use `codegraphx watch` for real-time updates.

**Q: Does this work with large codebases?**  
A: Yes. CodeGraphX uses incremental parsing and caching. A 10k-file Python project typically scans in 30-90 seconds on a modern machine, with subsequent updates processing only changed files.

**Q: Can I use this with private/proprietary code?**  
A: Absolutely. CodeGraphX runs 100% locally with no external dependencies or telemetry. Your code never leaves your machine.

**Q: What if the MCP server shows "Disconnected"?**  
A: Common fixes:
1. Run `codegraphx scan` manually once
2. Ensure `cwd` in MCP config matches your project root exactly
3. Use absolute path to `node` instead of `npx`
4. Run `gemini trust` if using project-scoped settings
5. Check stderr: `node /path/to/cgx-mcp 2>&1 | head -20`

**Q: How accurate is the Bloom filter?**  
A: Configurable via `bloomErrorRate` (default: 0.01 = 1% false positive rate). False positives only cause a fallback to linear search — never false negatives.

---

## 📄 License

CodeGraphX is released under the [MIT License](LICENSE).

```
MIT License

Copyright (c) 2026 Prayas Jadhav

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## npm Package

- **Package**: [`codegraphx`](https://www.npmjs.com/package/codegraphx)
- **Latest Version**: [![npm version](https://img.shields.io/npm/v/codegraphx.svg)](https://www.npmjs.com/package/codegraphx)
- **Downloads**: [![npm downloads](https://img.shields.io/npm/dm/codegraphx.svg)](https://www.npmjs.com/package/codegraphx)
- **Repository**: [github.com/techcraze00/CodeGraphX](https://github.com/techcraze00/CodeGraphX)
- **Issues & Feedback**: [github.com/techcraze00/CodeGraphX/issues](https://github.com/techcraze00/CodeGraphX/issues)

---

## Acknowledgments

- [Tree-sitter](https://tree-sitter.github.io/) — Incremental parsing engine
- [Model Context Protocol](https://modelcontextprotocol.io/) — Agent communication standard
- [TOON Format](https://github.com/toon-format/toon) — Token-optimized serialization
- [bloom-filters](https://github.com/Callidon/bloom-filters) — Probabilistic data structures
- The open-source community for inspiring efficient, local-first developer tools

---

<p align="center">
  <strong>CodeGraphX</strong> — Understand your codebase. Instantly.
</p>

<p align="center">
  <sub>Built with ❤️ for developers and AI agents alike.</sub>
</p>
