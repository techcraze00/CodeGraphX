# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Run all tests
npm test

# Run a single test file
npx jest tests/server/mcp-server.test.js --verbose

# Run tests matching a pattern
npx jest --testNamePattern="should trace impact"

# Scan the local codebase (generates .codegraphx/ artifacts and .codegraphx.db)
node bin/cgx init

# Start the MCP server (stdio transport, used by AI agents)
node bin/cgx-mcp

# Query a symbol
node bin/cgx query <symbolName>

# Trace impact
node bin/cgx impact <symbolName> --direction downstream --depth 5

# Run diagnostics
node bin/cgx doctor --json
```

## Architecture Overview

CodeGraphX is a **codebase graph engine** for AI agents. It parses source files with Tree-sitter, stores an append-only semantic graph in SQLite (or Postgres), and exposes it via a CLI and an MCP server.

### Core data flow

```
Source files
    → parser.js (Tree-sitter per-language adapters)
    → entities.js (SymbolEntity, FileEntity, EdgeEntity)
    → scanner.js (orchestrates full scan, writes DB + file artifacts)
    → store/sql-store.js (Kysely ORM — append-only temporal DB)
```

After a scan, the SQLite file (`.codegraphx.db` in the project root) is the source of truth. The `.codegraphx/` directory holds derived artifacts: `codegraph.html`, `codegraph-graph.json`, `codegraph.toon`, `file_index.toon`, `symbols.bloom`, and `cache.json`.

### Temporal / bi-temporal storage

The DB schema is intentionally append-only. Rows are **never deleted**. Instead, every `files`, `symbols`, and `edges` row carries `valid_from_commit_id` and `valid_to_commit_id`. `NULL` in `valid_to_commit_id` means the row is currently active. This pattern is implemented throughout `sql-store.js` and the migration in `src/db/migrations/001_initial_schema.js`.

### Key modules

| Module | Role |
|---|---|
| `src/db/index.js` | Kysely `db` instance — defaults to SQLite (`.codegraphx.db`), switchable to Postgres via `DB_DIALECT=postgres` + `DATABASE_URL` |
| `src/db/migrations/001_initial_schema.js` | Full DB schema; run via `src/db/migrator.js` |
| `src/store/sql-store.js` | `SqlGraphStore` — all DB reads/writes for files, symbols, edges, commits; `traceImpact` uses a recursive SQL CTE |
| `src/store.js` | `GraphStore` — in-memory + JSON cache layer (legacy, still used by scanner and doctor) |
| `src/scanner.js` | `runScan(projectRoot, config, mcpMode)` — the main indexing entry point; `mcpMode=true` skips heavy HTML/TOON outputs |
| `src/entities.js` | `SymbolEntity`, `FileEntity`, `EdgeEntity`, `Snapshot` — the domain model |
| `src/parser.js` | Delegates to language adapters; returns `declaredSymbols`, `imports`, `calls` |
| `src/languages/index.js` | Routes `.py/.js/.ts/.tsx/.jsx/.html/.css` to the matching Tree-sitter adapter |
| `src/edgebuilder.js` | Builds `EdgeEntity` records from parsed call/import references |
| `src/verifier.js` | `getVerificationEvidence` / `buildTaskVerification` — compares commit changes against a task description |
| `src/sdk/index.js` | `IntelligenceSDK` — programmatic API for embedding CGX in other tools |
| `src/sdk/drift-detector.js` | Detects architectural drift via downstream impact tracing + rule matching |
| `src/server/mcp-server.js` | `CodeGraphXServer` — MCP stdio server; exposes `get_graph_status`, `list_files`, `check_symbol_exists`, `explain_impact`, `verify_task`, `get_session_diff` |
| `src/git/commit-scanner.js` | Scans git history and annotates commits in the DB |

### Config

Project config lives in `.codegraphxrc` (JSON) or `codegraphx.config.json`. Relevant keys:

```json
{
  "extensions": [".js", ".py"],
  "ignore": ["node_modules", ".git"],
  "outputDir": ".codegraphx",
  "outputFile": "codebase.json"
}
```

`loadConfig()` in `src/utils.js` merges these with hardcoded defaults.

### MCP tools (for AI agents using the cgx-mcp server)

- `get_graph_status` — check if a scan has been run
- `list_files` — list indexed files, with optional substring filter
- `check_symbol_exists` — O(1) Bloom filter lookup (returns `probable_yes` or `definite_no`)
- `explain_impact` — upstream (who uses this) + downstream (what this breaks) for a symbol
- `verify_task` — given a task description and commit hash, returns `{status, changes, untested_additions}`
- `get_session_diff` — structural summary of changes vs HEAD/branch

The skill spec in `docs/superpowers/skills/cgx/SKILL.md` describes the preferred workflow when using these tools.

### Test layout

Tests mirror `src/` under `tests/`. The Jest config (`jest.config.js`) targets `tests/**/*.test.js` only (not the legacy `test/` directory). Tests that hit the DB create in-memory SQLite instances to avoid `.codegraphx.db` contamination.
