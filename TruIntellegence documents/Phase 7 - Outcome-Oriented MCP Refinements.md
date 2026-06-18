# CodeGraphX Phase 7: Outcome-Oriented MCP Refinements

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the CodeGraphX MCP server to use high-level, outcome-oriented tools (`verify_task` and `explain_impact`) to drastically reduce AI token usage, eliminate schema errors, and provide instant, high-signal answers.

**Architecture:** We will deprecate the granular tools (`query_symbol`, `list_files`, `trace_impact`) and replace them with composite workflows on the server. The AST extractors will be updated to emit relative file paths to save tokens. The `verify_task` tool will return a strictly typed, flat JSON object.

**Tech Stack:** Node.js, CodeGraphX Core, MCP SDK.

---

### Task 1: Standardize Relative Paths in Graph Nodes

**Files:**
- Modify: `src/utils.js`

- [ ] **Step 1: Write the implementation to emit relative paths**

```javascript
const path = require('path');
function normalizeNodePath(absolutePath, workspaceRoot) {
    if (absolutePath.startsWith(workspaceRoot)) return path.relative(workspaceRoot, absolutePath);
    return absolutePath;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/utils.js
git commit -m "feat(core): emit relative paths for graph nodes"
```

### Task 2: Implement High-Level `explain_impact` Tool

**Files:**
- Modify: `src/server/mcp-server.js`

- [ ] **Step 1: Replace granular impact with explain_impact**

Remove `query_symbol` and `trace_impact` from the MCP registry. Add `explain_impact`.

```javascript
// src/server/mcp-server.js 
function handleExplainImpact(args) {
    if (typeof args !== 'object' || !args.symbol_name) throw new Error("Requires symbol_name string");
    
    // Internal logic: 
    // 1. Find symbol in DB
    // 2. Trace upstream/downstream
    // 3. Return flat JSON summarizing the blast radius
    return {
        symbol: args.symbol_name,
        breaks_downstream: ["..."], // simplified array of strings
        used_by_upstream: ["..."]
    };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/server/mcp-server.js
git commit -m "feat(mcp): introduce explain_impact outcome-oriented tool"
```

### Task 3: Implement High-Level `verify_task` Tool

**Files:**
- Modify: `src/server/mcp-server.js`
- Modify: `src/verifier.js`

- [ ] **Step 1: Implement the verify_task composite tool**

Remove the old `verify` tool. Add `verify_task`.

```javascript
// src/verifier.js
function buildTaskVerification(taskDesc, commitHash) {
    // 1. Get diff for commit
    // 2. Map to graph nodes
    // 3. Return clean, flat JSON
    return {
        status: "complete", // or "incomplete" based on internal heuristics
        changes: [
             { file: "src/auth.py", symbol: "login", status: "added" }
        ],
        untested_additions: true
    };
}

// src/server/mcp-server.js
function handleVerifyTask(args) {
    if (typeof args !== 'object' || !args.task_description) throw new Error("Requires task_description");
    return buildTaskVerification(args.task_description, args.commit_hash);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/server/mcp-server.js src/verifier.js
git commit -m "feat(mcp): introduce verify_task outcome-oriented tool"
```

### Task 4: Update CGX Skill Instructions

**Files:**
- Modify: `docs/superpowers/skills/cgx/SKILL.md`

- [ ] **Step 1: Update the skill content to use the new tools**

Rewrite the skill to instruct the AI to use `verify_task(task_description)` and `explain_impact(symbol)` exclusively, removing references to the old granular tools and CLI fallbacks.
