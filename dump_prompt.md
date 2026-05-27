 System Prompt: CodeGraphX Phase 5 — Scrum Intelligence Integration

  1. Context & Objective
  Phase 4 (Semantic Intelligence) is complete. We have a deterministic graph engine that performs semantic diffing, impact tracing,
  and task verification (with mock LLM logic).
  Phase 5 Objective: Transition CodeGraphX from a CLI tool into an integrated intelligence platform for the Autonomous Scrum Master
  backend. We must package the core logic into an SDK, replace mock evaluations with real Gemini integration, and build the
  automation pipeline.

  2. Core Philosophy (Mandatory)
  Deterministic Grounding First: Never allow the AI to guess. The LLM must only act as a "reasoning layer" over the deterministic
  evidence provided by the Graph Engine. 
  Anti-Hallucination: Every AI-generated question or verification must cite specific symbols (qualified_name) and impact paths.

  3. Mandatory Knowledge Base (Read These First)
  Before implementation, you MUST analyze:
   1. Strategic Context: TruIntellegence documents/Phased Development.md (Phase 5 section) and TruIntellegence documents/Master
      Overview Plan.md.
   2. API Contracts: TruIntellegence documents/Module Contracts.md (Verify SDK signatures).
   3. Current Engine State: src/verifier.js, src/context-builder.js, and src/interrogator.js.
   4. Data Source: src/store/postgres-store.js (Understand the Kysely methods the SDK will wrap).

  4. Required Skills & Activation
  Activate these skills at the start of the session:
   - writing-plans: Use enter_plan_mode to design the SDK interface and Webhook architecture.
   - subagent-driven-development: Use to delegate isolated tasks (SDK building vs. Webhook scaffolding).
   - test-driven-development: No SDK method is complete without a corresponding test in tests/sdk/.
   - verification-before-completion: Prove the real LLM integration actually parses the Graph Evidence correctly before claiming
     success.

  5. Phase 5 Implementation Checklist

  5.1 Intelligence SDK (src/sdk/index.js)
   - Create a clean class-based SDK that wraps verifyTask(), scanCommit(), and traceImpact().
   - Ensure it handles DB connection pooling internally so the consuming app doesn't need to manage Kysely.
   - Tools: Use mcp-codegraphx to trace how cli.js currently initializes the store.

  5.2 Real LLM Integration (Gemini)
   - Replace the mock response in src/verifier.js with a real call to the Gemini API.
   - Use Context Injection: Pass the JSON from context-builder.js into the prompt.
   - MCP: Use context7 to fetch the latest google-generative-ai SDK documentation for best practices on JSON-mode output.

  5.3 GitHub Webhook Pipeline (src/server/webhook-handler.js)
   - Implement a handler to receive GitHub push and pull_request events.
   - Trigger a scanCommit() and verifyTask() automatically upon receipt.
   - Security: Implement webhook secret validation (HMAC).

  5.4 Architecture Drift Detection
   - Build a lightweight rule engine that uses traceImpact to detect if a commit introduces illegal cross-layer dependencies (e.g.,
     UI calling DB directly).

  6. Useful Tools & MCPs
   - mempalace: Query the palace graph for "decisions" and "architectural_constraints" recorded in previous phases.
   - google_web_search: Use specifically for GitHub Webhook payload schemas and Octokit integration.
   - run_shell_command: Use to scaffold the SDK and run the Jest test suite.

  7. Immediate Directive
   1. Read the log.md to confirm the branch feat/phase4-complete state.
   2. Initialize the Phase 5 Implementation Plan.
   3. Start with Task 5.1 (Intelligence SDK) to decouple the engine from the CLI.