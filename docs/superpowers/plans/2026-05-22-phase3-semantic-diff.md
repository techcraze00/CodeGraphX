# Phase 3: Semantic Diffing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement deep semantic diffing by mapping Git changes to the Postgres-backed graph nodes and tracing impact.

**Architecture:** Use `PostgresGraphStore` to query symbol versions across commits. Symbol Change Detection will identify added/modified/removed symbols by comparing `valid_from_commit_id` and `valid_to_commit_id`. Impact Tracing will use recursive CTEs in Postgres to traverse caller/callee edges.

**Tech Stack:** Node.js, Git, Postgres (Kysely), Jest (TDD).

---

### Task 1: Refactor commit-scanner.js for Postgres

**Files:**
- Modify: `src/git/commit-scanner.js`
- Test: `tests/git/commit-scanner.test.js`

- [ ] **Step 1: Update `scanCommit` signature and dependencies**
  - Inject `pgStore` and `repositoryId` instead of legacy `store`.
  - Remove dependency on `store.getFilesData()`.

- [ ] **Step 2: Implement Symbol Mapping via Postgres**
  - Update `mapDiffToNodes` to query active symbols for a file from Postgres using `repositoryId` and current `commit_id`.

- [ ] **Step 3: Write failing test for Postgres-backed scanner**
  - Mock `PostgresGraphStore` and `repositoryId`.
  - Expect `scanCommit` to return `CommitEntity` with changes fetched from DB.

- [ ] **Step 4: Implement minimal refactor**
  - Use `pgStore` to fetch symbols.
  - Maintain line-based matching logic (±5 lines).

- [ ] **Step 5: Run tests and commit**
  - Run `npm test tests/git/commit-scanner.test.js`.
  - `git commit -m "refactor(git): migrate commit-scanner to PostgresStore"`

### Task 2: Implement Symbol Change Detection

**Files:**
- Modify: `src/store/postgres-store.js`
- Test: `tests/store/postgres-store.test.js`

- [ ] **Step 1: Add `getChangesBetweenCommits` to `PostgresGraphStore`**
  - Query symbols where `valid_from_commit_id` is the new commit (Added).
  - Query symbols where `valid_to_commit_id` is the new commit (Removed/Modified).

- [ ] **Step 2: Write failing test for change detection**
  - Setup two commits in a test DB.
  - Verify `getChangesBetweenCommits` correctly identifies symbol lifecycle states.

- [ ] **Step 3: Implement query logic**
  - Use Kysely to fetch diffing symbols.

- [ ] **Step 4: Run tests and commit**
  - `git commit -m "feat(db): implement symbol change detection in PostgresStore"`

### Task 3: Enhance Impact Tracing

**Files:**
- Modify: `src/store/postgres-store.js`
- Modify: `src/cli.js` (to expose impact command)
- Test: `tests/store/impact-tracing.test.js`

- [ ] **Step 1: Add `traceImpact` to `PostgresGraphStore`**
  - Use recursive CTE to find all downstream callees or upstream callers.
  - Support depth limiting.

- [ ] **Step 2: Write TDD test for impact radius**
  - Create a graph: A -> B -> C.
  - Trace impact of modifying B.
  - Verify C is in blast radius.

- [ ] **Step 3: Implement recursive traversal**
  - Write `WITH RECURSIVE` query in Kysely.

- [ ] **Step 4: Expose `impact` command in CLI**
  - Add `cgx impact <symbol>` command.

- [ ] **Step 5: Run tests and commit**
  - `git commit -m "feat(intel): add recursive impact tracing and CLI command"`

### Task 4: Final Validation and Cleanup

- [ ] **Step 1: Run full test suite**
  - Ensure no regressions in existing Phase 2 logic.
- [ ] **Step 2: Verify against real Git repository**
  - Run `cgx scan` then `cgx impact` on a known symbol.
- [ ] **Step 3: Cleanup legacy JSON cache mentions**
  - Remove `cache.json` usage where redundant.
- [ ] **Step 4: Final Commit**
  - `git commit -m "chore: complete Phase 3 semantic diffing implementation"`
