# Project Context: CodeGraphX

## Project Overview

**CodeGraphX** is a local, token-efficient, dynamic codebase graph system designed specifically for AI coding agents (like Gemini CLI, Claude Code, etc.). 

Its core purpose is to solve the problem of AI agents having to constantly re-scan files to understand a codebase. Instead, CodeGraphX uses **Tree-sitter** to incrementally parse code (Python, JS, TS, HTML, CSS) and builds a virtual dependency graph. It outputs highly compressed files in the **TOON (Token-Oriented Object Notation)** format, a **Bloom filter** for instant O(1) symbol lookup, and a `CHANGELOG.toon` for session memory. It also provides a live D3.js-based HTML dashboard that updates via WebSockets when files change.

**Architecture:**
- **File Watcher:** Detects file modifications (`chokidar` / `watchdog`).
- **Incremental Parser:** Re-parses changed files using `tree-sitter`.
- **Virtual Graph Engine:** Computes deltas between the old and new AST to patch the graph efficiently (O(k) updates).
- **Persisted Store:** Saves the graph into flat files (`codegraph.toon`, `file_index.toon`, `symbols.bloom`, `CHANGELOG.toon`) in the `.codegraphx/` directory.

**Key Technologies:**
- Python & Node.js (Mixed ecosystem, supports both `pip` and `npm` installations)
- Tree-sitter (AST Parsing)
- TOON Format (Token compression)
- Bloom Filters (Fast symbol lookup)
- Vanilla JS, WebSockets, & D3.js (Live Dashboard)

## Building and Running

CodeGraphX supports both Python and Node.js environments.

**Setup / Installation:**
- **Node.js:** Run `npm install` to install dependencies (including `@toon-format/toon`, `bloom-filters`, and various `tree-sitter-*` packages).
- **Python:** Use `pip install -e .` or `uv sync` (as indicated by `uv.lock` and `pyproject.toml`) to install the `codegraphx` and `cgx` CLI commands.

**Running the CLI:**
- `codegraphx init` (or `npx codegraphx init`): Parses the codebase and generates the initial graph inside `.codegraphx/`.
- `codegraphx watch` (or `npx codegraphx watch`): Starts the file watcher and the WebSocket server for real-time live graph updates.
- `codegraphx scan`: Manually triggers a re-scan.
- `codegraphx dashboard`: Opens the live HTML graph visualization in the browser.
- `codegraphx stats`: Prints graph statistics.

## Development Conventions & Agent Usage

**Agent Workflow:**
When working in this repository, you should **NEVER** scan individual files to understand the overall project structure. Instead, rely on the CodeGraphX outputs:
1. **`.codegraphx/file_index.toon`**: Read this first for a one-liner summary of every file to orient yourself.
2. **`.codegraphx/CHANGELOG.toon`**: Check this to see what was built or changed in previous sessions.
3. **`.codegraphx/symbols.json`** & **`.codegraphx/symbols.bloom`**: Use these to check if a specific function or class exists before attempting to implement it.
4. **`.codegraphx/codegraph.toon`**: Use this for deep dependency tracking (e.g., checking the `called_by` field to analyze the impact of changing a function).

**Coding Practices:**
- Maintain zero heavy dependencies (no databases like Neo4j, Redis, SQLite, or Docker).
- Ensure cross-compatibility between Node.js and Python ecosystems.
- Emphasize token efficiency; favor TOON over JSON for any persisted metadata intended for LLM consumption.

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- For cross-module "how does X relate to Y" questions, prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` over grep — these traverse the graph's EXTRACTED + INFERRED edges instead of scanning files
- After modifying code files in this session, run `graphify update .` to keep the graph current (AST-only, no API cost)
