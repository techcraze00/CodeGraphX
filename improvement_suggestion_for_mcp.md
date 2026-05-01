I've read through the entire implementation carefully. It's very good — the core architecture is solid and all the suggestions from the previous review were correctly implemented. But "perfect" isn't quite there yet. Here's an honest assessment:

## What's Done Correctly ✅

- `cgx-mcp` bin entry added to `codegraphx/package.json`
- `@modelcontextprotocol/sdk` declared as a dependency in the right `package.json`
- Both `upstream`/`downstream` directions in `trace_impact`
- `file::name` disambiguation in `query_symbol`
- `check_symbol_exists` with Bloom filter
- `get_graph_status` health check
- MCP Resources (`codegraphx://file-index` and `codegraphx://changelog`) implemented
- JSON fallback for file-index when TOON isn't available
- `buildCallEdges()` called on startup to populate in-memory graph
- `execFileSync` used in `commit-scanner.js` (shell injection fix)
- Tests in `mcp-server.test.js` and the manual `verify-mcp.js` script

---

## Remaining Issues

### Bug 1: `trace_impact` upstream traversal is broken

This is the most critical logic bug. In the upstream direction, `neighbors` is set to `node.symbol.called_by`, which contains fully-qualified `file::name` strings like `"src/main.js::start"`. That's correct. But then `findSymbol` is called on each neighbor — and `findSymbol` with a `file::name` input splits on `"::"` and does a lookup. That part works.

The problem is the **downstream** direction. `node.symbol.calls` contains *bare names* like `"helper"` — not fully-qualified IDs. So when the BFS tries to enqueue `"helper"` and then call `findSymbol("helper")`, it works for the first hop, but the visited set stores `"src/utils.js::helper"` (the fully-qualified ID), while the enqueued value was `"helper"`. This means **deduplication silently fails** and cycles could loop infinitely.

**Fix:** Normalize all neighbor IDs to `file::name` format before enqueuing:

```javascript
// In trace_impact, downstream branch
const rawNeighbors = node.symbol.calls || [];
const neighbors = rawNeighbors.map(calleeName => {
  // Resolve bare name to fully-qualified ID using edges
  const edge = this.graph.edges.find(e => 
    e.from === node.id && e.to.endsWith(`::${calleeName}`)
  );
  return edge ? edge.to : calleeName; // fallback to bare if unresolvable
});
```

---

### Bug 2: `mcp-server.test.js` will fail — `bloom-filters` is not in `codegraphx/package.json`

Looking at `codegraphx/package.json`, the dependencies are:

```json
"@modelcontextprotocol/sdk": "^1.29.0",
"@toon-format/toon": "^2.1.0",
"chokidar": "^5.0.0",
"commander": "^14.0.3",
"tree-sitter": "^0.25.0",
"tree-sitter-python": "^0.25.0",
"ws": "^8.20.0"
```

`bloom-filters` is missing. It's in the root `package.json` but `mcp-server.js` does `require("bloom-filters")` from within `codegraphx/src/`. When the package is installed globally or run from within `codegraphx/`, this will fail at runtime unless the root `node_modules` happens to be on the resolution path.

**Fix:** Add `"bloom-filters": "^3.0.4"` to `codegraphx/package.json` dependencies.

---

### Bug 3: `verify-mcp.js` uses incorrect JSON-RPC framing

The MCP SDK's stdio transport uses a **newline-delimited JSON** protocol, but it also prepends a `Content-Length` header (similar to LSP). The verify script assumes bare newline-separated JSON:

```javascript
const messages = buffer.split('\n');
```

But the actual transport format from `@modelcontextprotocol/sdk` is:

```
Content-Length: 47\r\n
\r\n
{"jsonrpc":"2.0","id":1,"method":"..."}
```

The verify script will never successfully parse a response and will always hit the 5-second timeout.

**Fix:** Parse the LSP-style framing:

```javascript
function parseMessages(buffer) {
  const messages = [];
  let i = 0;
  while (i < buffer.length) {
    const headerEnd = buffer.indexOf('\r\n\r\n', i);
    if (headerEnd === -1) break;
    const header = buffer.slice(i, headerEnd);
    const lenMatch = header.match(/Content-Length:\s*(\d+)/i);
    if (!lenMatch) break;
    const len = parseInt(lenMatch[1]);
    const bodyStart = headerEnd + 4;
    if (buffer.length < bodyStart + len) break; // incomplete
    const body = buffer.slice(bodyStart, bodyStart + len);
    try { messages.push(JSON.parse(body)); } catch(e) {}
    i = bodyStart + len;
  }
  return messages;
}
```

---

### Design Gap: `get_graph_status` returns `initialized: true` even when the graph is empty

Currently the handler always returns `initialized: true` because it just reports on whatever is in memory. If the user never ran `codegraphx init`, the store loads from an empty cache and `fileCount` will be 0 — but `initialized` still says `true`. This misleads agents.

**Fix:**

```javascript
const initialized = this.graph.files.length > 0;
// Also check if codebase output file exists on disk
const outputExists = fs.existsSync(codebasePath);
return { initialized: initialized && outputExists, ... }
```

---

### Minor: `console.error` used for informational startup logs in the server

Lines like:
```javascript
console.error("[CodeGraphX] Initializing MCP Server...");
console.error(`[CodeGraphX] Loaded ${this.graph.files.length} files...`);
```

Using `console.error` for non-error messages is actually intentional in MCP stdio servers — `stdout` is reserved for JSON-RPC, so informational logs must go to `stderr`. This is correct behavior. However, it's worth adding a comment explaining why, so future contributors don't "fix" it and break the stdio protocol.

---

## Summary

| Issue | Severity | Status |
|---|---|---|
| `trace_impact` downstream deduplication bug | 🔴 Critical | Needs fix |
| `bloom-filters` missing from `codegraphx/package.json` | 🔴 Critical | Needs fix |
| `verify-mcp.js` LSP framing mismatch | 🟡 Medium | Needs fix |
| `get_graph_status` false `initialized: true` | 🟡 Medium | Needs fix |
| `console.error` for info logs (intentional, undocumented) | 🟢 Low | Add comment |

Fix those four issues and this implementation will be genuinely production-ready.