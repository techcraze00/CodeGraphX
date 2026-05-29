---
name: using-cgx
description: Use this skill to orchestrate CodeGraphX (CGX) MCP tools for deep codebase understanding without reading entire files.
---

# CodeGraphX (CGX) Intelligence Skill

You have access to the CodeGraphX MCP server (`cgx-mcp`), a deterministic semantic graph engine. Your goal is to minimize token usage and hallucination by relying on the graph.

## The Prime Directives
1. **Never read entire files blindly.** Always use CGX tools to find the exact location of a symbol first.
2. **Always check the session diff.** Before reviewing a PR or answering "what changed", run `get_session_diff`.
3. **Always trace impact.** Before refactoring or answering "what happens if I change X", run `trace_impact(symbol_id)`.
4. **Prefer Graph over Grep.** If you are looking for where a function is called, `trace_impact` is more accurate than `grep`.

## Workflow

### 1. Discovery
When asked about a function, class, or variable:
- RUN `query_symbol(name: "...")`
- DO NOT use `grep` or `read_file` until you know the exact file and lines from the CGX output.

### 2. Impact Analysis (Blast Radius)
When asked about the effects of changing code:
- RUN `trace_impact(symbol: "...", direction: "downstream")` to see what depends on this code.
- RUN `trace_impact(symbol: "...", direction: "upstream")` to see what this code depends on.

### 3. Task Verification
When a human claims a task is complete:
- Use standard validation skills, but inject the CGX session diff into your reasoning to prove they actually changed the required layers.
- If a task involves changing "API and DB", and CGX shows no changes in `src/db`, report it as incomplete.

### 4. Global Orientation
At the start of a session or when exploring a new repo:
- RUN `get_graph_status` to see if a graph exists.
- If not initialized, suggest the user run `codegraphx scan`.
- RUN `codegraphx://file-index` (resource) to get a one-liner summary of all files.
