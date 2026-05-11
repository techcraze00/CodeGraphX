# Phase 2: Persistent Intelligence Layer - Database Schema Design

## 1. Objective
Design and implement a scalable, enterprise-grade storage architecture for CodeGraphX using PostgreSQL and Kysely (with raw `pg` for advanced operations). This system replaces the legacy JSON persistence and moves us towards a system capable of semantic indexing and repository-scale graph intelligence.

## 2. Core Principles
- **Tooling:** Kysely is the primary query layer; raw `pg` is the escape hatch for advanced SQL (bulk COPY, graph traversal, pgvector).
- **Git-like Deduplication:** Use `file_blobs` to store raw content by hash, preventing exponential bloat over commits.
- **SCD Type 2 Validity:** Core entities (Files, Symbols, Edges) use `valid_from_commit` and `valid_to_commit` to allow exact point-in-time graph queries.
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
- `hash` (String, PK)
- `repository_id` (UUID, FK)
- `author` (String)
- `timestamp` (Timestamp)
- `message` (String)
- `branch` (String)
- `summary` (String)

**`index_jobs`** (Multi-stage indexing state)
- `id` (UUID, PK)
- `repository_id` (UUID, FK)
- `commit_hash` (String, FK)
- `stage` (String: scan, parse, symbol extraction, edge building, embeddings, validation)
- `status` (String: pending, running, completed, failed)
- `started_at` (Timestamp)
- `completed_at` (Timestamp)
- `error` (String)
- `metrics` (JSONB: timings, counts)

### 3.2 File & Blob Storage

**`file_blobs`** (Git-like deduplication)
- `content_hash` (String, PK)
- `content` (Text/Bytea)

**`files`**
- `id` (UUID, PK)
- `repository_id` (UUID, FK)
- `path` (String)
- `content_hash` (String, FK -> file_blobs)
- `language` (String)
- `valid_from_commit` (String, FK -> commits)
- `valid_to_commit` (String, nullable, FK -> commits)

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
- `valid_from_commit` (String)
- `valid_to_commit` (String, nullable)

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
- `valid_from_commit` (String)
- `valid_to_commit` (String, nullable)

### 3.4 Auxiliary Intelligence

**`embeddings`** (Dedicated vector storage)
- `id` (UUID, PK)
- `entity_type` (String: file, symbol, repository, commit)
- `entity_id` (String - ID of the entity)
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

## 4. Spec Self-Review
- [x] Placeholder scan: No "TBD"s or "TODO"s.
- [x] Internal consistency: Edges correctly link symbols. Files correctly reference `file_blobs`.
- [x] Scope check: Clean definition of the data layer without encroaching on application logic.
- [x] Ambiguity check: The usage of `valid_from_commit` and `valid_to_commit` clearly points to SCD Type 2 behavior. Embeddings are stored separately to prevent table bloat.

## 5. Next Steps
Once the schema is approved, we will transition to `writing-plans` to break down the Kysely migrations and repository integration into bite-sized execution steps using test-driven development.
