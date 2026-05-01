# CodeGraphX Task List

This document tracks the tasks discussed and their current implementation status.

## Completed Tasks

* [x] **Virtual Graph Diffing (O(k) Updates)**
  * Implemented SHA-1 hash caching for files to prevent unnecessary parsing.
  * Implemented delta computation to only update added, removed, or modified nodes.
  * Time and space complexity optimized.

* [x] **Session/Git Intelligence**
  * Implemented `codegraphx session summary` command to parse git diffs.
  * Mapped git line changes to AST nodes to identify exactly which functions/classes were changed.
  * Scrum Agent can now verify completed tasks against JIRA/ticket scope by reading structured TOON outputs.
  * Implemented cross-branch diffing (`codegraphx diff`).

* [x] **Agent Integration**
  * Auto-generation of `GEMINI.md` context instructions on `codegraphx init`.
  * Included directives for Scrum Agent to use the new session summary commands.

* [x] **Fix Git Hooks**
  * Updated `codegraphx git-hook install` to install `post-commit` and `pre-push` hooks instead of just `pre-commit`.

* [x] **CSS Parser**
  * Implemented CSS parsing using `tree-sitter-css`.
  * Extracts class selectors (`.className`) and ID selectors (`#idName`) to add them as nodes in the graph.

## Remaining Tasks

* [x] **Live Dashboard (WebSocket Server)**
  * Implement a WebSocket server (using `ws` package) alongside the file watcher.
  * Push graph delta updates directly to the client browser in real-time when a file is saved.

* [x] **Dashboard Engine Migration**
  * Currently using static `vis.js`. The plan requires a self-contained, real-time `D3.js` force-directed graph.
