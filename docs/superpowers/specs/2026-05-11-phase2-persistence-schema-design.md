# Phase 2: Persistent Intelligence Layer - Database Schema Design

## 1. Objective
Design and implement a scalable, enterprise-grade storage architecture for CodeGraphX using PostgreSQL and Kysely (with raw `pg` for advanced operations). This system replaces the legacy JSON persistence and moves us towards a system capable of semantic indexing and repository-scale graph intelligence.

## 2. Core Principles
- **Tooling:** Kysely is the primary query layer; raw `pg` is the escape hatch for advanced SQL (bulk COPY, graph traversal, pgvector).
- **Git-like Deduplication:** Use `file_blobs` to index raw content by hash. File blobs themselves are stored externally (to avoid DB bloat), storing only pointers in Postgres.
- **SCD Type 2 Validity:** Core entities (Files, Symbols, Edges) use `valid_from_commit_id` and `valid_to_commit_id` to allow exact point-in-time graph queries, using surrogate keys for performance.
- **Separation of Vectors:** Store embeddings in a dedicated `embeddings` table with a polymorphic association to avoid bloating core metadata tables.

## 3. Database Schema

### 3.1 Orchestration & Repositories

**`repositories`**
- `id` (UUID, PK)
- `name` (String)
- `path` (String)
- `created_at` (Timestamp)
- `updated_at` (Timestamp)

**`commits`**
- `id` (UUID or BIGINT, PK) - *Surrogate key for performance*
- `hash` (String, UNIQUE)
- `repository_id` (UUID, FK)
- `author` (String)
- `timestamp` (Timestamp)
- `message` (String)
- `branch` (String)
- `summary` (String)

**`index_jobs`** (Multi-stage indexing state)
- `id` (UUID, PK)
- `repository_id` (UUID, FK)
- `commit_id` (UUID/BIGINT, FK -> commits)
- `stage` (String: scan, parse, symbol extraction, edge building, embeddings, validation)
- `status` (String: pending, running, completed, failed)
- `started_at` (Timestamp)
- `completed_at` (Timestamp)
- `error` (String)
- `metrics` (JSONB: timings, counts)

### 3.2 File & Blob Storage

**`file_blobs`** (Git-like deduplication, but offloaded)
- `content_hash` (String, PK)
- `storage_type` (String: 'local_fs', 's3', 'compressed_blob')
- `content_pointer` (String: path or URL)
- `size_bytes` (Integer)

**`files`**
- `id` (UUID, PK)
- `repository_id` (UUID, FK)
- `path` (String)
- `content_hash` (String, FK -> file_blobs)
- `language` (String)
- `valid_from_commit_id` (UUID/BIGINT, FK -> commits)
- `valid_to_commit_id` (UUID/BIGINT, nullable, FK -> commits)

### 3.3 Semantic Graph Entities

**`symbols`** (Thoroughly modeled for intelligence)
- `id` (UUID, PK)
- `repository_id` (UUID, FK)
- `file_id` (UUID, FK -> files)
- `parent_symbol_id` (UUID, nullable, FK -> symbols)
- `qualified_name` (String)
- `name` (String)
- `kind` (String: function, class, module, etc.)
- `signature` (String)
- `visibility` (String)
- `is_exported` (Boolean)
- `language` (String)
- `docstring` (Text)
- `symbol_hash` (String)
- `start_line` (Integer)
- `end_line` (Integer)
- `start_column` (Integer)
- `end_column` (Integer)
- `parser_version` (String)
- `extractor_version` (String)
- `valid_from_commit_id` (UUID/BIGINT, FK -> commits)
- `valid_to_commit_id` (UUID/BIGINT, nullable, FK -> commits)

**`edges`** (Probabilistic and deterministic relationships)
- `id` (UUID, PK)
- `repository_id` (UUID, FK)
- `from_symbol_id` (UUID, FK -> symbols)
- `to_symbol_id` (UUID, FK -> symbols)
- `type` (String: CALLS, IMPORTS, etc.)
- `confidence` (Float)
- `discovered_by` (String: AST, heuristic, embedding, runtime)
- `metadata` (JSONB)
- `edge_hash` (String)
- `valid_from_commit_id` (UUID/BIGINT, FK -> commits)
- `valid_to_commit_id` (UUID/BIGINT, nullable, FK -> commits)

### 3.4 Auxiliary Intelligence

**`embeddings`** (Dedicated vector storage)
- `id` (UUID, PK)
- `entity_type` (String: file, symbol, repository, commit)
- `entity_id` (UUID) - Enforced at application layer
- `embedding_model` (String)
- `vector` (Vector/Array - dependent on pgvector configuration)
- `created_at` (Timestamp)

**`dependencies`** (Repository-level intelligence)
- `id` (UUID, PK)
- `repository_id` (UUID, FK)
- `package_name` (String)
- `version` (String)
- `ecosystem` (String)
- `imported_by_files` (JSONB/Array)

**`unresolved_symbols`** (Observability for parsing failures)
- `id` (UUID, PK)
- `repository_id` (UUID, FK)
- `file_id` (UUID, FK)
- `symbol_name` (String)
- `context` (String)
- `attempted_resolution` (String)

## 4. Edge Versioning and Invalidation Semantics

**Invalidation Rule:**
When a `symbol_hash` changes:
1. Invalidate all dependent edges originating from or pointing to that symbol (by closing their `valid_to_commit_id`).
2. Recompute the affected graph region incrementally.
3. Insert new edges with the new `valid_from_commit_id`.
This explicitly ensures that incremental indexing correctly maintains the graph's historical integrity without staleness.

## 5. Confidence Scoring Contract

The `edges.confidence` column must adhere strictly to the following scoring ranges:
- **`1.0`**: Deterministic AST resolution (absolute certainty).
- **`0.7 - 0.9`**: Scoped heuristic resolution (high confidence, e.g., name match within same module namespace).
- **`0.4 - 0.6`**: Probabilistic inference (e.g., cross-language matching or LLM fallback without execution trace).
- **`< 0.4`**: Weak semantic association (e.g., general text similarity).

## 6. Critical Indexes

To ensure scalability up to 10M LOC, the following indexes are strictly required:

**`symbols`**
- `(repository_id, qualified_name)` - Fast lookup of symbols by path.
- `(file_id)` - Fetching all symbols in a file.
- `(symbol_hash)` - Change detection and diffing.

**`edges`**
- `(from_symbol_id)` - Outgoing relationships.
- `(to_symbol_id)` - Incoming relationships.
- `(type)` - Traversal filtering.

**`files`**
- `(repository_id, path)` - Fetching historical state of a file path.

**`embeddings`**
- `ivfflat` or `hnsw` index on the `vector` column to support fast similarity search.

**`commits`**
- `(hash)` (UNIQUE) - Lookup by git SHA.

## 7. Spec Self-Review
- [x] Placeholder scan: No "TBD"s or "TODO"s.
- [x] Internal consistency: Edges correctly link symbols. Files correctly reference `file_blobs`.
- [x] Scope check: Clean definition of the data layer without encroaching on application logic.
- [x] Ambiguity check: Incorporates surrogate keys (`commit_id`) for foreign keys, offloads raw content to reduce database bloat, and provides strong guidelines on edge versioning, confidence scoring, and critical indexing.

## 8. Next Steps
Once the schema is approved, we will transition to `writing-plans` to break down the Kysely migrations and repository integration into bite-sized execution steps using test-driven development.
