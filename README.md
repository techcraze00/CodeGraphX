# CodeGraphX

A local, token-efficient, dynamic codebase graph system designed specifically for AI coding agents (like Gemini CLI, Claude Code, Cursor) and human developers.

Its core purpose is to solve the problem of AI agents having to constantly re-scan files to understand a codebase. Instead, CodeGraphX uses **Tree-sitter** to incrementally parse code (Python, JS, TS, HTML, CSS) and builds a virtual dependency graph. It outputs highly compressed files in the **TOON (Token-Oriented Object Notation)** format and a **Bloom filter** for instant O(1) symbol lookup.

This project is built purely in Node.js. No Python environment is required to use it, even though it can parse Python code!

## Installation

Install CodeGraphX globally via npm so you can use the CLI anywhere, or install it as a development dependency in your project.

```bash
npm install -g codegraphx
```

## Standalone Usage (CLI)

CodeGraphX can be used as a standalone tool to visualize and query your codebase's structure.

### Simple Example

Navigate to your project directory and initialize the graph:

```bash
cd my-project
codegraphx init
```
This will parse your codebase and generate the initial graph inside the `.codegraphx/` directory.

You can then query the graph. For example, to find out what depends on a function named `calculateTotal`:

```bash
codegraphx query calculateTotal
# Or, trace its entire downstream impact:
codegraphx impact calculateTotal --direction downstream
```

To see a live, real-time visualization of your codebase in your browser:

```bash
codegraphx watch
codegraphx dashboard
```

### Key Commands
- `codegraphx init`: Parses the codebase and generates the initial graph.
- `codegraphx watch`: Starts the file watcher for real-time live graph updates.
- `codegraphx query <symbol>`: Show details (files, edges, calls, called_by) for a specific symbol.
- `codegraphx impact <symbol>`: Trace all symbols directly or indirectly impacted by a given symbol.
- `codegraphx dashboard`: Opens a live interactive HTML graph visualization in your default browser.
- `codegraphx stats`: Prints graph statistics (files, symbols, edges).

## Usage with AI Coding Agents (MCP Server)

CodeGraphX includes an **MCP (Model Context Protocol) Server**. This is where it truly shines. Instead of the AI agent blindly reading raw source files, it can use the `cgx-mcp` server to intelligently query your codebase structure, saving thousands of tokens and eliminating "cold start" scanning time.

The MCP server provides tools to the AI like `get_graph_status`, `list_files`, `query_symbol`, `check_symbol_exists`, and `trace_impact`.

### Claude Desktop Configuration

To use CodeGraphX with Claude Desktop, add the following to your `claude_desktop_config.json` (usually located at `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "codegraphx": {
      "command": "npx",
      "args": ["-y", "codegraphx", "cgx-mcp"]
    }
  }
}
```

*Note: The command assumes you are running Claude Desktop within the context of a project directory where `codegraphx` should analyze the code.*

### Gemini CLI Configuration

To use CodeGraphX with Gemini CLI, you can set up a custom MCP server in your workspace's `.gemini/mcp.json` configuration:

```json
{
  "mcpServers": {
    "codegraphx": {
      "command": "npx",
      "args": ["codegraphx", "cgx-mcp"]
    }
  }
}
```

Once configured, simply tell your agent: *"Use the CodeGraphX MCP server to find where the `authenticateUser` function is defined and what other functions call it."* The agent will instantly traverse the graph instead of using expensive file `grep` searches.