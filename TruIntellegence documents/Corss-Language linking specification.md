# Cross-Language Linking Specification

## Objective

Create semantic relationships between symbols across different programming languages.

---

# Problem

Modern systems are polyglot.

Example:
- TypeScript frontend
- Python backend
- Go microservices
- SQL schemas
- GraphQL contracts

Traditional indexing treats them as isolated systems.

This is incorrect.

---

# Cross-Language Linking Goals

Enable:
- end-to-end dependency tracing
- API flow mapping
- service interaction graphs
- semantic ownership detection

---

# Link Types

| Relationship | Example |
|---|---|
| API_CALLS | frontend → backend |
| DB_USES | backend → schema |
| EVENT_PUBLISHES | service → queue |
| EVENT_CONSUMES | queue → worker |
| GRAPHQL_RESOLVES | resolver → service |
| CONTRACT_IMPLEMENTS | API → implementation |

---

# Linking Sources

## Static Sources

- imports
- schemas
- API definitions
- GraphQL contracts
- OpenAPI specs

## Dynamic Sources

- runtime traces
- logs
- telemetry
- execution events

---

# Linking Pipeline

Parse →
Extract Symbols →
Generate Graph →
Identify Contracts →
Resolve Semantic Relationships →
Build Cross-Language Edges

---

# Semantic Resolution Strategy

The system should combine:

- static analysis
- embeddings
- naming similarity
- API signatures
- execution traces

---

# Future Direction

Long-term goal:
repository-wide executable semantic topology.

Meaning:
the system understands:
- what talks to what
- why
- how changes propagate
- where risks emerge