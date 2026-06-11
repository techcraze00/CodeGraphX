# Phase 6 & 8: Cross-Language Intelligence & Enterprise Scale

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bridge frontend-backend language boundaries through semantic linking and scale the engine to handle 10M LOC repositories using parallel parsing and job queues.

**Architecture:** 
1. **Intelligence Phase (Phase 6):** Heuristic "Contract Resolvers" for Express/Axios, and a post-processing "Semantic Linker" pipeline step.
2. **Scale Phase (Phase 8):** Node.js `worker_threads` for parallel AST extraction, BullMQ for job management, and advanced partial graph invalidation.

**Tech Stack:** Node.js, tree-sitter, PostgreSQL (SCD2), Redis, BullMQ, worker_threads.

---

### Task 1: Cross-Language Edge Schema & Resolver Infrastructure

**Files:**
- Modify: `src/db/migrations/001_initial_schema.js` (Add new edge types to comments or just use them if generic)
- Create: `src/languages/javascript/resolvers/express-resolver.js`
- Test: `tests/languages/javascript/express-resolver.test.js`

- [ ] **Step 1: Write failing test for Express route extraction**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Implement Express route contract extraction in `JavaScriptAdapter`**
- [ ] **Step 4: Run test to verify it passes**
- [ ] **Step 5: Commit**

### Task 2: Frontend API Call Extraction

**Files:**
- Create: `src/languages/javascript/resolvers/axios-resolver.js`
- Test: `tests/languages/javascript/axios-resolver.test.js`

- [ ] **Step 1: Write failing test for Axios call extraction**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Implement Axios call extraction (identifying target URL and method)**
- [ ] **Step 4: Run test to verify it passes**
- [ ] **Step 5: Commit**

### Task 3: Semantic Linker Pipeline

**Files:**
- Create: `src/cross-language-linker.js`
- Test: `tests/cross-language-linker.test.js`

- [ ] **Step 1: Write failing test for linking an Axios call to an Express route**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Implement `linkCrossLanguageEdges(pgStore, repositoryId)`**
- [ ] **Step 4: Run test to verify it passes**
- [ ] **Step 5: Commit**

### Task 4: Parallel Parsing with Worker Threads

**Files:**
- Modify: `src/scanner.js`
- Create: `src/workers/parser-worker.js`
- Test: `tests/workers/parallel-parser.test.js`

- [ ] **Step 1: Write failing test for parallel file parsing**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Implement `worker_threads` pool in `runScan`**
- [ ] **Step 4: Run test to verify it passes**
- [ ] **Step 5: Commit**

### Task 5: Redis/BullMQ Job Queue Integration

**Files:**
- Modify: `src/server/webhook-handler.js`
- Create: `src/queue/indexing-queue.js`
- Test: `tests/queue/indexing-queue.test.js`

- [ ] **Step 1: Write failing test for pushing indexing job to queue**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Implement BullMQ producer/consumer for `indexing_job`**
- [ ] **Step 4: Run test to verify it passes**
- [ ] **Step 5: Commit**

### Task 6: Advanced Incremental Rebuilds

**Files:**
- Modify: `src/store/sql-store.js`
- Test: `tests/store/incremental-invalidation.test.js`

- [ ] **Step 1: Write failing test for partial graph invalidation (blast radius only)**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Implement selective invalidation logic in `pgStore`**
- [ ] **Step 4: Run test to verify it passes**
- [ ] **Step 5: Commit**
