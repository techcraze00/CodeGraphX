# Design Doc: CodeGraphX MCP Server (Navigator Suite)

**Date:** 2026-05-02  
**Status:** Approved  
**Author:** Gemini CLI Agent

## 1. Objective
Create a dedicated Model Context Protocol (MCP) server for CodeGraphX to provide AI agents with a high-speed, token-efficient interface for codebase graph analysis.

## 2. Architecture
- **Environment:** Node.js.
- **Protocol:** JSON-RPC 2.0 over `stdio`.
- **SDK:** `@modelcontextprotocol/sdk`.
- **Location:** `codegraphx/src/server/mcp-server.js`.
- **Integration:** Can be started via `node codegraphx/src/server/mcp-server.js`.

## 3. Tool Suite ("Navigator")

### `list_files`
- **Purpose:** Provide a project-wide orientation summary.
- **Input:** None.
- **Output:** JSON object containing filenames and their top-level symbol summaries (extracted from `file_index.toon`).

### `query_symbol`
- **Purpose:** Detailed inspection of a specific symbol.
- **Input:** `name` (string, e.g., "MainController").
- **Output:** Symbol metadata including file path, type, line number, immediate outgoing calls, and incoming `called_by` references.

### `trace_impact`
- **Purpose:** Recursive dependency analysis to understand the ripple effect of changes.
- **Input:** 
  - `symbol` (string, format: `file::symbol` or `symbol`).
  - `depth` (optional int, default: 3).
- **Output:** A tree structure (DAG) showing all downstream symbols that directly or indirectly depend on the target.

### `get_session_diff`
- **Purpose:** Structural summary of recent changes for session continuity.
- **Input:** `branch` (optional string, default: "HEAD").
- **Output:** List of AST nodes (functions/classes) added, removed, or modified in the current session/commit.

## 4. Data Flow
1. **Startup:** Load the existing `GraphStore` from the `.codegraphx/` directory in the current working directory.
2. **Request:** Receive tool call via `stdio`.
3. **Execution:** Query the in-memory graph or the `.toon` files.
4. **Response:** Return a JSON-formatted subset of the graph data.

## 5. Security & Error Handling
- **Read-Only:** The MCP server is strictly read-only for codebase data.
- **CWD Isolation:** Only interacts with the `.codegraphx/` directory in the process's working directory.
- **Graceful Failure:** Returns structured error messages if the graph has not been initialized (`codegraphx init`).
- **Validation:** Inputs (symbol names, branch names) are treated as untrusted and passed to safe execution helpers (e.g., `execFileSync`).

## 6. Implementation Notes
- Use the existing `store.js` and `edgebuilder.js` logic to avoid duplication.
- Ensure the server remains lightweight and fast (under 100ms response time for most queries).
