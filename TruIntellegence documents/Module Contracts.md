CodeGraphX + Autonomous Scrum Master — Module Contracts

Purpose

This document defines strict module boundaries, responsibilities, APIs, data contracts, ownership rules, failure behaviors, and testing expectations.

The primary goal is preventing architectural decay.

Without explicit contracts, this system will become:

* tightly coupled
* impossible to scale
* impossible to debug
* impossible to evolve safely

This document establishes:

* ownership boundaries
* communication contracts
* event contracts
* storage contracts
* indexing contracts
* AI interaction contracts
* security contracts
* test obligations

⸻

1. Global Architectural Rules

1.1 Hard Separation of Concerns

The system MUST remain divided into:

Layer	Responsibility
Git Intelligence Layer	Repository analysis only
Scrum Intelligence Layer	Workflow reasoning only
AI Orchestration Layer	LLM/SLM interaction only
Persistence Layer	Storage only
Event Layer	Async communication only
Security Layer	Identity/auth/permissions only

Violation of this rule creates long-term architectural collapse.

⸻

1.2 Forbidden Dependencies

The following dependencies are forbidden:

Forbidden Dependency	Reason
Frontend directly reading graph database	Security + coupling
AI directly reading git repo	No control layer
LLM directly invoking GitHub APIs	No permission mediation
Indexers invoking AI	Massive cost explosion
WebSocket consumers doing analysis	Event-loop blocking
Parser layer depending on vector DB	Circular architecture

⸻

1.3 Required Communication Style

All major modules communicate through:

* explicit interfaces
* typed payloads
* async events
* immutable analysis outputs

Never through:

* shared mutable state
* hidden globals
* implicit imports
* direct cross-layer mutation

⸻

2. Core System Modules

⸻

2.1 Repository Sync Module

Responsibility

Responsible ONLY for:

* repository cloning
* repository updates
* commit synchronization
* branch checkout
* webhook ingestion
* change detection

NOT responsible for:

* parsing
* AI analysis
* vector embeddings
* graph construction

⸻

Inputs

Input	Type
GitHub webhook	HTTP event
Manual sync request	API call
Scheduled sync	Internal cron

⸻

Outputs

RepositorySynced Event

{
  "project_id": "uuid",
  "repo_id": "uuid",
  "branch": "main",
  "commit_hash": "abc123",
  "changed_files": ["src/auth.js"],
  "timestamp": "ISO8601"
}

⸻

Storage Ownership

Owns:

* repository metadata
* sync timestamps
* branch states
* commit states

Does NOT own:

* ASTs
* graph data
* embeddings

⸻

Failure Rules

Failure	Action
Git clone failure	Retry exponential backoff
Webhook duplication	Deduplicate via delivery ID
Corrupted repo	Full reclone
Detached HEAD	Reject analysis

⸻

Performance Constraints

Constraint	Target
Sync latency	<30s
Webhook processing	<5s
Large repo pull	Streamed

⸻

Unit Test Requirements

Required tests:

* webhook deduplication
* branch switching
* corrupted repo recovery
* shallow clone correctness
* parallel sync safety

⸻

2.2 File Discovery Module

Responsibility

Responsible ONLY for:

* file traversal
* extension filtering
* ignore rules
* chunk scheduling

NOT responsible for:

* parsing
* semantic analysis
* embeddings

⸻

Input Contract

{
  "repo_path": "/repos/project-x",
  "extensions": [".py", ".js"],
  "ignore": ["node_modules", "dist"]
}

⸻

Output Contract

{
  "files": [
    {
      "path": "src/auth.py",
      "size": 1293,
      "language": "python",
      "hash": "sha1"
    }
  ]
}

⸻

Failure Rules

Failure	Action
Symlink loop	Abort traversal
Permission denied	Skip file
Oversized file	Skip + warn

⸻

Scaling Rules

Must support:

* 10M LOC
* chunked traversal
* incremental scanning
* parallel file walking

⸻

2.3 Parser Engine Module

Responsibility

Responsible ONLY for:

* AST generation
* syntax error collection
* language detection
* semantic extraction

NOT responsible for:

* embeddings
* vector indexing
* git operations
* AI reasoning

⸻

Supported Engines

Language	Engine
Python	tree-sitter + Jedi/LSP
TypeScript	ts-morph
JavaScript	tree-sitter + TS Compiler
Go	tree-sitter-go
Java	tree-sitter-java

⸻

Input Contract

{
  "file_path": "src/auth.py",
  "contents": "file string"
}

⸻

Output Contract

{
  "language": "python",
  "symbols": [],
  "imports": [],
  "calls": [],
  "exports": [],
  "errors": []
}

⸻

Critical Rules

Parser output MUST be:

* deterministic
* side-effect free
* immutable

Parser layer MUST NEVER:

* call LLMs
* access databases
* access GitHub

⸻

Failure Rules

Failure	Action
Parser crash	Sandbox parser
Malformed AST	Return partial parse
Unsupported language	Return unknown

⸻

Performance Constraints

Constraint	Target
Average parse time	<100ms/file
Memory spike	bounded
Incremental parsing	required

⸻

2.4 Symbol Resolution Engine

Responsibility

Responsible ONLY for:

* symbol linking
* import resolution
* alias tracking
* inheritance mapping
* cross-file references
* cross-language resolution

⸻

Critical Importance

This is the REAL intelligence layer.

Without strong symbol resolution:

* AI hallucinations explode
* impact analysis fails
* task verification becomes fake
* code review becomes unreliable

⸻

Input Contract

{
  "files": [],
  "symbols": [],
  "imports": []
}

⸻

Output Contract

{
  "resolved_edges": [
    {
      "from": "fileA::func",
      "to": "fileB::func",
      "confidence": 0.92,
      "type": "CALLS"
    }
  ]
}

⸻

Confidence Rules

Every edge MUST contain:

Field	Description
confidence	0-1 certainty
strategy	resolution method
ambiguity_count	candidate matches

⸻

Resolution Strategies

Strategy	Confidence
exact AST symbol	very high
import chain resolution	high
LSP inference	high
heuristic lexical	medium
embedding similarity	low

⸻

Forbidden Behavior

Never create fake certainty.

Low-confidence links MUST remain probabilistic.

⸻

2.5 Graph Engine Module

Responsibility

Responsible ONLY for:

* graph node creation
* edge storage
* traversal APIs
* dependency graph generation
* impact graph generation

⸻

Node Contract

{
  "id": "uuid",
  "type": "function",
  "name": "authenticate",
  "file": "src/auth.py",
  "language": "python"
}

⸻

Edge Contract

{
  "from": "node_id",
  "to": "node_id",
  "type": "CALLS",
  "confidence": 0.88
}

⸻

Supported Queries

Query	Purpose
callers(symbol)	upstream tracing
callees(symbol)	downstream tracing
shortest_path(a,b)	execution path
impact(symbol)	blast radius
unresolved_edges()	diagnostics

⸻

Scaling Constraints

Target:

* 100M+ edges eventually
* incremental graph rebuilds
* partial invalidation

⸻

2.6 Incremental Indexing Engine

Responsibility

Responsible ONLY for:

* delta computation
* changed-file analysis
* graph invalidation
* selective rebuilds

⸻

Input Contract

{
  "old_hash": "sha1",
  "new_hash": "sha1",
  "changed_files": []
}

⸻

Output Contract

{
  "reindex_files": [],
  "invalidate_edges": [],
  "recompute_embeddings": []
}

⸻

Critical Rule

Never trigger full repository rebuild unless absolutely necessary.

Full rebuilds at 10M LOC are operationally catastrophic.

⸻

2.7 Embedding Engine

Responsibility

Responsible ONLY for:

* embedding generation
* semantic chunking
* vector updates
* semantic similarity

NOT responsible for:

* execution tracing
* correctness validation
* graph construction

⸻

Chunk Rules

Chunks MUST be:

* symbol-aware
* dependency-aware
* token bounded

Never naive line chunks.

⸻

Input Contract

{
  "symbol_id": "uuid",
  "content": "code string"
}

⸻

Output Contract

{
  "embedding": [0.12, 0.44],
  "model": "gte-small",
  "dimensions": 768
}

⸻

Performance Rules

Embedding generation MUST:

* support batching
* support GPU optionality
* support local SLMs

⸻

2.8 Vector Search Module

Responsibility

Responsible ONLY for:

* semantic retrieval
* nearest-neighbor search
* hybrid ranking

⸻

Query Contract

{
  "query": "where is auth validated",
  "limit": 10
}

⸻

Result Contract

{
  "results": [
    {
      "symbol": "auth.validate",
      "score": 0.92,
      "reason": "semantic similarity"
    }
  ]
}

⸻

Critical Rules

Vector search MUST NEVER:

* replace graph traversal
* replace symbol resolution
* replace execution flow analysis

Vector search is support intelligence.
Not source-of-truth intelligence.

⸻

2.9 AI Context Builder

Responsibility

Responsible ONLY for:

* prompt assembly
* token budgeting
* context compression
* graph summarization

⸻

Input Sources

Source	Priority
graph traversal	highest
changed code	highest
embeddings	medium
commit summaries	medium
historical conversations	low

⸻

Output Contract

{
  "system_prompt": "...",
  "context_blocks": [],
  "token_estimate": 12000
}

⸻

Critical Rules

The AI Context Builder MUST:

* aggressively compress irrelevant context
* prioritize changed execution paths
* eliminate duplicate symbols
* preserve dependency chains

⸻

2.10 Scrum Intelligence Engine

Responsibility

Responsible ONLY for:

* task validation
* developer interrogation
* risk scoring
* completion verification
* vulnerability detection
* engineering reasoning

⸻

Inputs

Input	Purpose
task description	intent
PR diff	implementation
graph impact	dependency awareness
embeddings	semantic support
git history	historical context

⸻

Output Contract

{
  "task_completed": false,
  "confidence": 0.61,
  "risks": [],
  "missing_requirements": [],
  "questions": []
}

⸻

Critical Rules

The Scrum Intelligence Engine MUST:

* distrust developer claims
* validate implementation against task intent
* inspect hidden side effects
* detect shallow implementations
* detect fake completion attempts

⸻

Required Reasoning Types

Reasoning	Example
dependency reasoning	changed auth affects billing
security reasoning	input validation missing
architectural reasoning	violates service boundary
testing reasoning	edge cases untested
performance reasoning	added N+1 query

⸻

2.11 MCP Gateway Module

Responsibility

Responsible ONLY for:

* AI tool exposure
* graph query APIs
* repository query APIs
* controlled AI access

⸻

MCP Design Rules

The MCP layer MUST be:

* stateless
* permission-aware
* query-limited
* rate-limited

⸻

Required MCP Tools

Tool	Purpose
query_symbol	symbol lookup
trace_execution	execution path
trace_impact	blast radius
semantic_search	semantic lookup
get_commit_context	commit analysis
verify_task_completion	scrum validation
get_risk_report	security/performance risks

⸻

Forbidden MCP Behavior

MCP tools MUST NEVER:

* execute arbitrary code
* expose secrets
* expose raw repository filesystem
* allow unrestricted traversal

⸻

2.12 WebSocket Event Module

Responsibility

Responsible ONLY for:

* realtime updates
* streaming analysis
* UI synchronization

⸻

Event Contract

{
  "event": "analysis.completed",
  "project_id": "uuid",
  "payload": {}
}

⸻

Required Events

Event	Purpose
repo.synced	sync complete
indexing.started	indexing begin
indexing.completed	indexing done
task.analysis.completed	scrum reasoning done
vulnerability.detected	alert

⸻

2.13 Security Layer

Responsibility

Responsible ONLY for:

* access control
* repo isolation
* token encryption
* audit logging
* role enforcement

⸻

Critical Rules

Members MUST NEVER:

* access unrelated repositories
* query unrelated graphs
* inspect owner-only analytics

⸻

Required Security Features

Feature	Required
encrypted tokens	yes
signed webhooks	yes
rate limiting	yes
audit logs	yes
role isolation	yes

⸻

3. Database Contracts

3.1 PostgreSQL Ownership

Owns:

* users
* projects
* tasks
* metadata
* permissions
* analysis summaries

Not suitable for:

* graph traversal
* embeddings

⸻

3.2 Graph Storage Ownership

Owns:

* nodes
* edges
* execution flows
* dependency graphs

Candidates:

* DuckDB
* SQLite
* Neo4j later
* custom adjacency engine

⸻

3.3 Vector DB Ownership

Owns:

* embeddings
* semantic chunks
* semantic retrieval

Candidates:

* Qdrant
* LanceDB
* FAISS

⸻

4. AI Interaction Contracts

4.1 AI Must Never Be Trusted

LLMs are reasoning assistants.
Not truth engines.

Every AI conclusion must be grounded by:

* graph evidence
* AST evidence
* repository evidence
* commit evidence

⸻

4.2 AI Output Validation

Every AI response MUST include:

{
  "claim": "...",
  "evidence": [],
  "confidence": 0.0
}

⸻

4.3 Anti-Hallucination Rules

The system MUST reject:

* unsupported execution claims
* nonexistent symbols
* fake dependency chains
* fabricated vulnerabilities

⸻

5. Scaling Contracts

5.1 Required Scale Targets

Metric	Target
LOC	10M
files	500k+
edges	100M+
repos	1000+ eventually
concurrent users	1000+ eventually

⸻

5.2 Scaling Rules

Mandatory:

* incremental indexing
* batch processing
* async pipelines
* queue-based workloads
* bounded memory
* partial graph invalidation

Forbidden:

* full rescans by default
* in-memory monolithic graphs
* synchronous AI analysis

⸻

6. Testing Contracts

6.1 Required Test Types

Type	Required
unit tests	mandatory
parser fuzz tests	mandatory
graph correctness tests	mandatory
concurrency tests	mandatory
performance tests	mandatory
regression tests	mandatory
AI evaluation tests	mandatory

⸻

6.2 Critical Test Datasets

Must include:

* intentionally broken repos
* cyclic dependency repos
* large repos
* polyglot repos
* malicious code repos
* generated code repos

⸻

6.3 AI Evaluation Contracts

The Scrum AI MUST be benchmarked against:

* fake task completions
* shallow implementations
* hidden vulnerabilities
* incomplete refactors
* dependency regressions

⸻

7. Observability Contracts

7.1 Required Metrics

Metric	Purpose
parse latency	performance
graph build time	scalability
unresolved edges	correctness
embedding latency	AI throughput
hallucination rate	AI reliability
task validation accuracy	business metric

⸻

7.2 Required Logging

Mandatory structured logs:

* repository syncs
* parser failures
* graph corruption
* AI failures
* webhook events
* permission violations

⸻

8. Final Architectural Principles

Principle 1

Graph intelligence is the source of truth.
Not vector search.
Not AI.

⸻

Principle 2

Incremental indexing is mandatory.
Without it the system dies at scale.

⸻

Principle 3

Cross-language symbol resolution is the hardest problem.
Design around this reality.

⸻

Principle 4

AI reasoning must always be evidence-backed.
Never trust model confidence.

⸻

Principle 5

The Scrum Master is not a chatbot.
It is an engineering validation system.

⸻

Principle 6

Every module must remain independently replaceable.

That is the only way this architecture survives long term.