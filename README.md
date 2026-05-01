# CodeGraphX

A local, token-efficient, dynamic codebase graph system designed specifically for AI coding agents (like Gemini CLI, Claude Code, etc.). 

Its core purpose is to solve the problem of AI agents having to constantly re-scan files to understand a codebase. Instead, CodeGraphX uses **Tree-sitter** to incrementally parse code (Python, JS, TS, HTML, CSS) and builds a virtual dependency graph. It outputs highly compressed files in the **TOON (Token-Oriented Object Notation)** format, a **Bloom filter** for instant O(1) symbol lookup, and a `CHANGELOG.toon` for session memory. It also provides a live D3.js-based HTML dashboard that updates via WebSockets when files change.

## Architecture

- **File Watcher:** Detects file modifications (`chokidar`) with debouncing for performance.
- **Incremental Parser:** Re-parses changed files using `tree-sitter`.
- **Virtual Graph Engine:** Computes deltas between the old and new AST to patch the graph efficiently (O(k) updates).
- **Session & Git Intelligence:** Links AST changes with git diffs to track exactly which functions/classes were modified per session.
- **Live Dashboard:** Real-time, interactive D3.js visualization of your codebase powered by a WebSocket server.
- **Git Hooks Integration:** Automatically runs `codegraphx scan` via `post-commit` and `pre-push` hooks.
- **Persisted Store:** Saves the graph into flat, token-optimized files in the `.codegraphx/` directory.

## Installation

**Node.js / Python (Mixed Environment):**
```bash
npm install
pip install -e .
```

## CLI Usage

- `codegraphx init`: Parses the codebase and generates the initial graph inside `.codegraphx/`.
- `codegraphx watch`: Starts the file watcher and WebSocket server for real-time live graph updates.
- `codegraphx scan`: Manually triggers a re-scan.
- `codegraphx session summary`: Outputs a structural summary of changes in the current session/commit.
- `codegraphx diff <branch_a> <branch_b>`: Outputs the AST delta between two branches.
- `codegraphx query <symbol>`: Show details (files, edges, calls, called_by) for a specific symbol.
- `codegraphx impact <symbol>`: Trace all symbols directly or indirectly impacted by a given symbol.
- `codegraphx git-hook <install|remove>`: Install or remove `post-commit` and `pre-push` git hooks to auto-update the graph.
- `codegraphx dashboard`: Opens the live interactive HTML graph visualization in your default browser.
- `codegraphx stats`: Prints graph statistics (files, symbols, edges).

## Agent Workflow

CodeGraphX generates a `GEMINI.md` file so coding agents can seamlessly read:
1. `.codegraphx/file_index.toon`: A one-liner file and symbol summary to orient the agent.
2. `.codegraphx/CHANGELOG.toon`: For session/commit diffs and history.
3. `.codegraphx/codegraph.toon`: For full dependency and impact analysis.
4. `.codegraphx/symbols.bloom`: For O(1) symbol lookup.

### Why an MCP Server?

While agents can read the `.toon` files directly, an **MCP (Model Context Protocol) Server** acts as an active intelligence layer that further optimizes the experience:

- **Instant Orientation:** Instead of reading files into context, the agent calls a tool to get a project map, saving thousands of tokens on "cold starts."
- **Zero-Scan Impact Analysis:** The agent can query the graph directly ("What breaks if I change X?") instead of running multiple `grep` searches.
- **Symbol Discovery:** High-speed lookup using the Bloom filter via structured tool calls.
- **Context Efficiency:** The server only sends the *relevant* parts of the graph back to the agent, keeping the conversation fast and focused.

---
### My next steps:

My assumption is that this project implementation is production-ready. The next natural step for the project would be publishing to npm and writing the MCP server configuration snippet for claude_desktop_config.json and the Gemini CLI equivalent, so users know exactly how to wire up cgx-mcp in their agent configs. That's the last mile between working code and something developers can actually discover and use.
