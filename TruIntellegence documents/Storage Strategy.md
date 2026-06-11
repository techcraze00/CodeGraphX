# Storage Strategy Specification

## Objective

Design a storage architecture capable of supporting:

- Massive repository analysis
- AI-agent optimized retrieval
- Incremental graph updates
- Semantic search
- Cross-language dependency linking
- Real-time collaboration
- Long-term historical intelligence

The system must scale from:
- Small repositories
- Mid-sized multi-service systems
- Enterprise-scale monorepos (1M–10M LOC)

---

# Core Design Principles

## 1. Separation of Storage Concerns

The system MUST NOT use a single database for everything.

Different workloads require different storage models.

| Workload | Storage Type |
|---|---|
| Transactional state | PostgreSQL |
| Semantic embeddings | Vector DB |
| Graph traversal | Graph database |
| Blob/raw cache | Object storage |
| Event stream | Append-only event log |
| Fast lookup cache | Redis |

---

# Recommended Storage Architecture

## 1. PostgreSQL — System of Record

### Responsibilities

- User accounts
- Organizations
- Repositories
- Tasks
- Agent state
- Workflow orchestration
- Permissions
- Project metadata
- Execution logs

### Why PostgreSQL

Advantages:
- Strong consistency
- Mature ecosystem
- Reliable transactions
- Excellent tooling
- Easy operational maintenance

### Constraints

PostgreSQL MUST NOT:
- Store semantic graph traversal workloads
- Execute deep dependency graph queries
- Store massive embedding collections

---

## 2. Graph Storage Layer

### Recommended Options

| Option | Recommendation |
|---|---|
| Neo4j | Good for rapid prototyping |
| Memgraph | Better real-time graph performance |
| Custom adjacency model | Long-term optimized approach |

### Responsibilities

Store:
- Symbol relationships
- Import dependencies
- Call graphs
- Ownership mappings
- Service boundaries
- Execution paths
- Context inheritance

### Core Entities

- Repository
- File
- Symbol
- Function
- Class
- Module
- API
- Service
- Agent
- Task

### Core Relationships

- IMPORTS
- CALLS
- EXTENDS
- IMPLEMENTS
- REFERENCES
- OWNS
- DEPENDS_ON
- GENERATED_FROM

---

## 3. Semantic Vector Storage

### Purpose

Store:
- File embeddings
- Symbol embeddings
- Architectural summaries
- Agent memory
- Semantic clusters

### Recommended Databases

| Option | Notes |
|---|---|
| Qdrant | Strong recommendation |
| Weaviate | Good semantic tooling |
| pgvector | Good MVP option |

### Embedding Granularity

Embeddings should exist for:
- Repository
- Service
- Directory
- File
- Symbol
- Function
- Task context

---

## 4. Object Storage

### Responsibilities

Store:
- Snapshots
- Cached ASTs
- Packed contexts
- Compressed graph exports
- Logs
- Temporary indexing artifacts

### Recommended

- MinIO (local-first)
- S3-compatible systems
- Cloudflare R2

---

## 5. Redis Layer

### Responsibilities

- Realtime cache
- WebSocket session state
- Active indexing queues
- Agent execution state
- Temporary retrieval cache

---

# Incremental Update Strategy

## Principle

Full repository rescans are forbidden except:
- Initial indexing
- Recovery operations
- Severe graph corruption

### Incremental Pipeline

Git Commit →
Changed Files →
AST Diff →
Symbol Diff →
Graph Patch →
Embedding Refresh →
Context Cache Update

---

# Event-Sourced Intelligence Layer

Every meaningful mutation should generate events.

## Event Types

- FILE_CHANGED
- SYMBOL_ADDED
- SYMBOL_REMOVED
- TASK_CREATED
- TASK_COMPLETED
- CONTEXT_UPDATED
- AGENT_EXECUTED

---

# Long-Term Scaling Direction

## Phase 1

- PostgreSQL
- pgvector
- Redis

## Phase 2

- Dedicated graph DB
- Distributed indexing workers
- Object storage

## Phase 3

- Multi-tenant sharding
- Distributed graph partitions
- Hybrid semantic retrieval
- Incremental distributed indexing