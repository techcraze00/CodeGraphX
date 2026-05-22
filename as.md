<!-- Please continue the development of Phase 2: Persistent Intelligence Layer for CodeGraphX. 
    
    Objective: Implement the **Incremental Snapshot Engine** and **SCD Type 2 Invalidation** within the `PostgresGraphStore`.
    
    Context & Progress:
    - We are working in the `feat/phase2-persistence` worktree.
    - Task 1 (DB Connection) and Task 2 (Schema Migration) are complete.
    - `PostgresGraphStore` is currently a skeleton with only `addCommit`.
    - Refer to `docs/superpowers/specs/2026-05-11-phase2-persistence-schema-design.md` for the approved architecture.
    
    Your Tasks:
    1. Implement **File Blob Deduplication**: Logic to manage `file_blobs` via content hashing before updating `files`.
    2. Implement **SCD Type 2 Invalidation**: When a file, symbol, or edge is modified:
        - Close the previous version by setting its `valid_to_commit_id`.
        - Insert the new version with the current `valid_from_commit_id`.
    3. Implement **Point-in-Time Retrieval**: A method to query the full state of the graph as it existed at a specific Git SHA.
    4. **Integration**: Link these methods into the indexing pipeline to replace the legacy JSON-based storage.
    
    Mandatory Workflow & Tools:
    - Use the `using-superpowers` skill to establish your workflow.
    - Use `using-git-worktrees` to switch into the existing `feat/phase2-persistence` directory.
    - Use the `brainstorming` skill to design the exact transaction flow for the "Close then Open" SCD2 logic, specifically handling how to identify which edges need invalidation when a symbol hash changes.
    - Adhere strictly to the `test-driven-development` skill. You MUST write integration tests that verify historical integrity (e.g., "After 3 commits, can I still query the exact graph state of commit #1?").
    - Utilize the `context7-mcp` skill to query latest documentation if you need to build complex Kysely queries (e.g., range-based filters or CTEs for graph traversal).
   25 - Use `writing-plans` and `subagent-driven-development` to execute the implementation step-by-step.


 -->


Please continue the development of Phase 2: Persistent Intelligence Layer for CodeGraphX. 
    
    Objective: Integrate the `PostgresGraphStore` into the main indexing pipeline, replacing the legacy JSON-based storage system.
    
    Context:
    - In the previous session, we successfully implemented the `PostgresGraphStore` with SCD Type 2 invalidation (handling files, symbols, and edges) and
      point-in-time retrieval.
    - These methods now need to be wired into the actual indexing pipeline (`src/scanner.js`, `src/cli.js`, etc.).
    - We want to deprecate and remove the old JSON file-based graph saving mechanism.
    
    Your Tasks:
    1. Identify all locations where the legacy JSON storage is used to save or load the graph (e.g., `.codegraphx/symbols.json`, `.codegraphx/edges.json`, or
       flat file writes).
    2. Refactor the indexing pipeline to inject and use `PostgresGraphStore`:
    - Initialize the DB connection.
    - Generate a new `commit_id` using `store.addCommit(...)` at the start of an indexing run.
    - Iterate through the parsed files and use `store.updateFile`, `store.updateSymbols`, and `store.updateEdges` to persist the data using our new SCD2
      logic.
    3. Update the necessary unit and integration tests to mock or use a test database instead of checking for JSON file creation.
    4. Remove the legacy JSON writing logic once the DB integration is fully tested.
    
    Mandatory Workflow & Tools:
    - Use the `activate_skill` tool to activate `using-superpowers` immediately to establish your workflow.
    - Activate and use `using-git-worktrees` to create a new isolated worktree named `feat/phase2-pipeline-integration`.
    - Activate and use the `brainstorming` skill to map out the exact files in the CLI/Scanner pipeline that need refactoring before writing any code.
    - Adhere strictly to the `test-driven-development` skill. Ensure you have failing integration tests for the CLI/Indexer before hooking up the database.
    - Utilize the `context7-mcp` skill if you need to fetch documentation on specific testing patterns or PostgreSQL/Kysely edge cases.
    - Use `writing-plans` to write a structured implementation plan, and then use `subagent-driven-development` to execute the refactoring task-by-task.
    - Once completed, use `finishing-a-development-branch` to merge the changes.
