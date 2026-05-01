# CodeGraphX

A local, token-efficient, dynamic codebase graph system designed specifically for AI coding agents (like Gemini CLI, Claude Code, etc.). 

Its core purpose is to solve the problem of AI agents having to constantly re-scan files to understand a codebase. Instead, CodeGraphX uses **Tree-sitter** to incrementally parse code (Python, JS, TS, HTML, CSS) and builds a virtual dependency graph. It outputs highly compressed files in the **TOON (Token-Oriented Object Notation)** format, a **Bloom filter** for instant O(1) symbol lookup, and a `CHANGELOG.toon` for session memory. It also provides a live D3.js-based HTML dashboard that updates via WebSockets when files change.

## Architecture

- **File Watcher:** Detects file modifications (`chokidar`).
- **Incremental Parser:** Re-parses changed files using `tree-sitter`.
- **Virtual Graph Engine:** Computes deltas between the old and new AST to patch the graph efficiently (O(k) updates).
- **Session & Git Intelligence:** Links AST changes with git diffs to track exact functions/classes modified per session. 
- **Persisted Store:** Saves the graph into flat files in the `.codegraphx/` directory.

## Installation

**Node.js / Python (Mixed Environment):**
\`\`\`bash
npm install
pip install -e .
\`\`\`

## CLI Usage

- \`codegraphx init\`: Parses the codebase and generates the initial graph.
- \`codegraphx watch\`: Starts the file watcher for real-time live graph updates.
- \`codegraphx scan\`: Manually triggers a re-scan.
- \`codegraphx session summary\`: Outputs structural summary of changes for agent integration.
- \`codegraphx diff <branch_a> <branch_b>\`: Outputs AST delta between branches.
- \`codegraphx dashboard\`: Opens the live HTML graph visualization in the browser.
- \`codegraphx stats\`: Prints graph statistics.

## Agent Workflow

CodeGraphX generates a \`GEMINI.md\` file so coding agents can seamlessly read:
1. \`.codegraphx/file_index.toon\` for a one-liner file summary.
2. \`.codegraphx/CHANGELOG.toon\` for session/commit diffs.
3. \`.codegraphx/codegraph.toon\` for dependency and impact analysis.
