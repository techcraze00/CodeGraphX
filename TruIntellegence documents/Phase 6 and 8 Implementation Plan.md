# Phase 6 & 8 Implementation Plan: Cross-Language Intelligence & Scale

## Objective
Outline the detailed implementation steps for Phase 6 (Cross-Language Intelligence) and Phase 8 (Scale & Optimization) of the CodeGraphX system. Following an "Intelligence-First" strategy, we will build out cross-language linking to prove semantic value before optimizing the infrastructure to handle enterprise-scale repositories.

## Section 1: Phase 6 - Cross-Language Intelligence

**Goal:** Establish semantic relationships between symbols across different programming languages (e.g., connecting a React frontend `fetch` call to an Express backend route).

### Architecture & Components
1. **Contract Resolvers:** Implement new modules in `src/languages/` to act as heuristic engines for identifying cross-language contracts.
   - Example: `express-route-resolver.js` to identify backend endpoints.
   - Example: `axios-call-resolver.js` or `fetch-resolver.js` to identify frontend API requests.
2. **Semantic Linker Pipeline:** Introduce a new processing stage (`src/cross-language-linker.js`) that executes after standard AST extraction and intra-file linking.
3. **New Edge Types:** Extend the graph schema to support:
   - `API_CALLS` (Frontend -> Backend)
   - `DB_USES` (Backend -> Schema)

### Data Flow & Execution
1. **Discovery:** The AST parser extracts a frontend API call (e.g., `axios.get('/api/users')`) and logs it as an `unresolved_symbol` since it doesn't match an internal frontend function.
2. **Definition:** The parser extracts backend route definitions (e.g., `app.get('/api/users', handler)`) and flags them as exposed contracts.
3. **Resolution:** The Semantic Linker queries `unresolved_symbols`, applying heuristic matching (comparing route strings and HTTP methods) against known contracts.
4. **Linking:** When a match is found, an `API_CALLS` edge is inserted into the `edges` table with an associated `confidence` score (e.g., 0.85 for exact string match).

---

## Section 2: Phase 8 - Scale & Optimization

**Goal:** Upgrade the engine to handle repositories of 1M-10M LOC by introducing distributed parsing, queue management, and graph compression.

### Architecture & Components
1. **Parallel Parsing (Worker Pool):** Replace the sequential processing in `src/scanner.js` with Node.js `worker_threads`.
2. **Task Queue System:** Integrate a Redis-backed queue (e.g., BullMQ) to decouple webhook ingestion from heavy indexing operations.
3. **Graph Compression:** Introduce background maintenance jobs to compress historical graph data and prune unreachable nodes.
4. **Advanced Incremental Rebuilds:** Enhance `src/store/sql-store.js` for partial graph invalidation.

### Data Flow & Execution
1. **Ingestion:** A GitHub webhook triggers a repository update. The webhook handler pushes an `indexing_job` to the Redis queue.
2. **Distribution:** The main coordinator pulls the job, identifies changed files via Git diff, and partitions the files across available worker threads.
3. **Parallel Execution:** Workers parse their assigned files concurrently and write entity/symbol updates directly to the PostgreSQL database.
4. **Reconciliation:** Once all workers finish, the coordinator runs the Cross-Language Linker and updates embeddings.