# CodeGraphX

<p align="center">
  <img src="assets/logo.png" alt="CodeGraphX Banner" width="30%" border-radius="50%" />
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/codegraphx"><img src="https://img.shields.io/npm/v/codegraphx.svg" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/codegraphx"><img src="https://img.shields.io/npm/dm/codegraphx.svg" alt="npm downloads" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/npm/l/codegraphx.svg" alt="license" /></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D16-blue.svg" alt="node version" /></a>
</p>

> **CodeGraphX** is a local, token-efficient codebase graphing system designed for AI coding agents and human developers. It uses Tree-sitter to parse code incrementally, builds a dependency graph, and exposes it via CLI or MCP server — eliminating costly file-scanning loops and enabling instant symbol lookup.

---

## ✨ Key Features

| Feature | Benefit |
|---------|---------|
| 🧠 **Incremental Parsing** | Only re-parses changed files; O(1) cache hits for unchanged code |
| 🔗 **Call Graph & Dependencies** | Track `calls`, `called_by`, and `imports` across your entire codebase |
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
# Output: 1.0.5
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

### Available MCP Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `get_graph_status` | Returns initialization status and graph metrics | None |
| `list_files` | Lists all indexed files with symbol summaries | `filter?: string` |
| `query_symbol` | Get detailed info about a symbol (calls, location, imports) | `name: string` (use `file::symbol` for exact match) |
| `check_symbol_exists` | Instant O(1) symbol existence check via Bloom filter | `name: string` |
| `trace_impact` | Trace upstream/downstream dependency chain | `symbol: string`, `direction: "upstream" \| "downstream"`, `depth?: number` |
| `get_session_diff` | Summarize changes in current Git session/branch | `branch?: string` (default: `"HEAD"`) |

### Example Agent Workflow

```
User: "Where is the validateInput function defined and what calls it?"

Agent (via MCP):
1. query_symbol({ name: "validateInput" })
   → Returns: [{ file: "src/utils.js", type: "function", location: "row 42", called_by: ["src/auth.js::login"] }]

2. trace_impact({ symbol: "src/utils.js::validateInput", direction: "upstream" })
   → Returns full call chain with depth control

Result: Instant answer without scanning 50+ files.
```

---

## 🔌 Connecting MCP to AI Agents

### 🧭 Gemini CLI

Create or edit `.gemini/mcp.json` in your project root:

```json
{
  "mcpServers": {
    "codegraphx": {
      "command": "npx",
      "args": ["-y", "codegraphx", "cgx-mcp"],
      "cwd": "/absolute/path/to/your/project"
    }
  }
}
```

> 💡 **Pro Tip**: Use the absolute path to `node` instead of `npx` for maximum reliability:
> ```json
> {
>   "command": "/usr/local/bin/node",
>   "args": ["/usr/local/bin/cgx-mcp"]
> }
> ```

### 🤖 Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "codegraphx": {
      "command": "npx",
      "args": ["-y", "codegraphx", "cgx-mcp"],
      "cwd": "/absolute/path/to/your/project"
    }
  }
}
```

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
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | npx cgx-mcp
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
