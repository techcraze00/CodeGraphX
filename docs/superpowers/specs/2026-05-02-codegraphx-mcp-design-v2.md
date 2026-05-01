# Design Doc: CodeGraphX MCP Server (Navigator Suite) - Revised

**Date:** 2026-05-02  
**Status:** Approved (Revised)  
**Author:** Gemini CLI Agent (incorporating user improvements)

## 1. Objective
Create a dedicated Model Context Protocol (MCP) server for CodeGraphX to provide AI agents with a high-speed, token-efficient interface for codebase graph analysis.

## 2. Architecture
- **Environment:** Node.js.
- **Protocol:** JSON-RPC 2.0 over `stdio`.
- **SDK:** `@modelcontextprotocol/sdk`.
- **Location:** `codegraphx/src/server/mcp-server.js`.
- **Dependency Management:** Ensure `@toon-format/toon` is available in `codegraphx/package.json` or fallback to JSON for resilience.
- **Initialization:** Startup will load `GraphStore`, compute edges via `buildCallEdges()`, and load the Bloom filter from `symbols.bloom`.

## 3. MCP Resources (Static Snapshots)
Agents can read these directly without tool parameters.

### `codegraphx://file-index`
- **Data Source:** `.codegraphx/file_index.toon` (or JSON fallback).
- **Content:** Flat list of files and their top-level symbol summaries.

### `codegraphx://changelog`
- **Data Source:** `.codegraphx/CHANGELOG.toon`.
- **Content:** Structural session history and recent changes.

## 4. MCP Tools (Dynamic Queries)

### `get_graph_status`
- **Purpose:** Health check to verify if the graph is initialized and up to date.
- **Output:** `{ initialized, fileCount, symbolCount, edgeCount, lastUpdated }`.

### `list_files`
- **Purpose:** Filterable file orientation.
- **Input:** `filter` (optional string, glob/substring).
- **Output:** Filtered list of files with their symbol summaries.

### `query_symbol`
- **Purpose:** Detailed inspection of a specific symbol.
- **Input:** `name` (string). Handles both bare names (returns all matches) and `file::name` (exact match).
- **Output:** Full metadata (file, type, row, calls, called_by).

### `check_symbol_exists`
- **Purpose:** Ultra-fast O(1) existence check using the Bloom filter.
- **Input:** `name` (string).
- **Output:** `{ exists: boolean, confidence: "definite_no" | "probable_yes" }`.

### `trace_impact`
- **Purpose:** Recursive dependency analysis ("What breaks if X changes?").
- **Input:** 
  - `symbol` (string, `file::name`).
  - `direction` (enum: "upstream" / "downstream").
    - `upstream`: Follows `called_by` (callers).
    - `downstream`: Follows `calls` (callees).
  - `depth` (optional int, default: 3).
- **Output:** Tree structure of impacted symbols.

### `get_session_diff`
- **Purpose:** Summary of AST nodes changed in the current git session.
- **Input:** `branch` (optional string, default: "HEAD").
- **Output:** `{ added, removed, modified }` nodes.

## 5. Security & Error Handling
- **Read-Only:** No side effects allowed.
- **CWD Context:** Reads data relative to `process.cwd()`.
- **Input Validation:** Use `execFileSync` for all git-related commands to prevent shell injection.
- **Graceful Error:** Clear messaging when `.codegraphx/` is missing or corrupted.

## 6. Implementation Notes
- Add `cgx-mcp` entry to `codegraphx/package.json` bins.
- Ensure the MCP server is compatible with standard agent hosts (Gemini CLI, Claude Code).
