---
name: using-cgx
description: Use this skill to orchestrate CodeGraphX (CGX) MCP tools for deep codebase understanding without reading entire files.
---

# CodeGraphX (CGX) Intelligence Skill

You have access to the CodeGraphX MCP server (`cgx-mcp`), a deterministic semantic graph engine. Your goal is to minimize token usage and hallucination by relying on high-level, outcome-oriented tools.

## The Prime Directives
1. **Prefer Outcomes over Granularity.** Use `explain_impact` instead of manually tracing symbols. Use `verify_task` instead of manual diff analysis.
2. **Never read entire files blindly.** Use `list_files` to orient yourself, then `explain_impact` to understand a symbol's role.
3. **Always verify tasks.** When a task is claimed to be complete, run `verify_task` to get an automated status report.

## Workflow

### 1. Global Orientation
At the start of a session or when exploring a new repo:
- RUN `get_graph_status` to see if a graph exists.
- If not initialized, suggest the user run `codegraphx scan`.
- RUN `codegraphx://file-index` (resource) to get a list of all files.

### 2. Deep Understanding & Blast Radius
When asked about a function, class, or variable, or the effect of changing it:
- RUN `explain_impact(symbol_name: "...")`
- This provides:
  - `used_by_upstream`: What this symbol depends on.
  - `breaks_downstream`: What depends on this symbol (the blast radius).
- Use this information to pinpoint exactly which files need to be read or modified.

### 3. Automated Task Verification
When a task is claimed to be complete or you need to check progress:
- RUN `verify_task(task_description: "...", commit_hash: "...")`
- Analyze the `status`, `changes`, and `untested_additions` fields.
- If `untested_additions` is `true`, remind the user to add tests for their changes.

### 4. Search
- Use `check_symbol_exists(name: "...")` for instant verification if a symbol exists before attempting deeper analysis.
- Use `list_files(filter: "...")` to find files by path substring.
