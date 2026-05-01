# CodeGraphX MCP Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a robust, token-efficient MCP server with full graph navigation and security.

**Architecture:** Node.js server using @modelcontextprotocol/sdk over stdio. Reuses GraphStore and EdgeBuilder.

**Tech Stack:** Node.js, @modelcontextprotocol/sdk, @toon-format/toon, bloom-filters.

---

### Task 1: Environment & Dependencies
- [x] **Step 1:** Add `@modelcontextprotocol/sdk` and `@toon-format/toon` to `codegraphx/package.json`.
- [x] **Step 2:** Run `npm install` in the `codegraphx/` directory.
- [x] **Step 3:** Create `codegraphx/bin/cgx-mcp` and make it executable.

### Task 2: Core Server Logic (Initialization)
- [x] **Step 1:** Create `codegraphx/src/server/mcp-server.js`.
- [x] **Step 2:** Implement startup logic: load config, init GraphStore, compute edges, load Bloom filter.
- [x] **Step 3:** Implement health check tool `get_graph_status`.

### Task 3: Navigator Tools (list_files, query_symbol)
- [x] **Step 1:** Implement `list_files` with glob filtering and JSON fallback.
- [x] **Step 2:** Implement `query_symbol` with `file::name` disambiguation logic.

### Task 4: Analysis Tools (trace_impact, check_symbol_exists)
- [x] **Step 1:** Implement `check_symbol_exists` using the loaded Bloom filter.
- [x] **Step 2:** Implement `trace_impact` with `upstream`/`downstream` support.

### Task 5: MCP Resources & Git Intelligence
- [x] **Step 1:** Register `codegraphx://file-index` and `codegraphx://changelog` resources.
- [x] **Step 2:** Implement `get_session_diff` using `commit-scanner.js`.

### Task 6: Verification & Testing
- [x] **Step 1:** Write a manual test script to verify stdio communication.
- [x] **Step 2:** Run the server and verify it responds to `listTools`.
- [x] **Step 3:** Commit all changes.
