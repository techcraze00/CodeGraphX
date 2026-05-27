# CodeGraphX: Tic-Tac-Toe Real-World Test Report

## Test Environment Setup
- **Project**: `dummy-tic-tac-toe`
- **Structure**: Backend (Express), Frontend (Vanilla JS), Shared logic.
- **Goal**: Simulate a junior developer onboarding and making changes using CodeGraphX.

---

## Scenarios & Test Cases

### **Scenario 1: Codebase Discovery & Onboarding**
*   **Junior Dev Need**: "I just joined this project. What are the main components and how do they connect?"
*   **Test Case 1.1: Project Scanning**
    *   **Action**: Run `cgx scan` on the `dummy-tic-tac-toe` directory.
    *   **Expectation**: Should extract symbols from `backend/index.js`, `frontend/index.js`, and `shared/game-logic.js`.
*   **Test Case 1.2: Repository Stats**
    *   **Action**: Run `cgx stats`.
    *   **Expectation**: Should show the number of files and symbols correctly.

### **Scenario 2: Symbol Investigation**
*   **Junior Dev Need**: "I see `calculateWinner` being used in multiple places. Where is the actual implementation?"
*   **Test Case 2.1: Symbol Search**
    *   **Action**: Run `cgx query calculateWinner`.
    *   **Expectation**: Should point to `shared/game-logic.js`.

### **Scenario 3: Change Impact Analysis**
*   **Junior Dev Need**: "I want to modify the winning logic. What will break if I change `calculateWinner`?"
*   **Test Case 3.1: Upstream Impact Tracing**
    *   **Action**: Run `cgx impact calculateWinner --direction upstream`.
    *   **Expectation**: Should identify both `backend/index.js` and `frontend/index.js` as dependents.

### **Scenario 4: Task Verification**
*   **Junior Dev Need**: "I've implemented a new feature. Did I actually meet the requirements?"
*   **Test Case 4.1: Feature Completion Check**
    *   **Action**: Add a "Draw" condition to `calculateWinner`, commit, and run `cgx verify --task "Implement Draw condition logic" --commit <hash>`.
    *   **Expectation**: Should confirm the logic was added.

---

## Execution Results

| Test ID | Action | Result (Pass/Fail) | Findings |
|---------|--------|--------------------|----------|
| 1.1     | Scan   | **PASS**           | Successfully indexed files. Discovered bug where `codebase.json` is not actually written. |
| 1.2     | Stats  | **PASS**           | Stats updated correctly in Postgres. |
| 2.1     | Query  | **PARTIAL PASS**   | Found implementation, but missed some callers due to JS parser limitations (CommonJS/Anonymous functions). |
| 3.1     | Impact | **PARTIAL PASS**   | Traced impact to `play` but missed `backend/index.js` callers. |
| 4.1     | Verify | **PASS**           | Correctlly identified "Draw" condition implementation using semantic diff mapping. |

---

## Final Observations

### **Strengths**
1.  **Deterministic Verification**: Phase 4's `verify` engine is highly effective at linking code-level diffs to human-readable tasks.
2.  **Cross-File Awareness**: The system successfully links symbols across files when standard `function_declaration` patterns are used.
3.  **Persistence**: Postgres SCD Type 2 tracking works as expected, maintaining a clear history of symbols across commits.

### **Identified Bugs & Issues**
1.  **CLI Output Mismatch**: `cgx scan` logs that it wrote to `codebase.json`, but the file is never created. It seems to have been replaced by `.toon` files without updating the log message.
2.  **Unique Constraint Crash**: Attempting to `scan` the same commit twice causes a crash (`duplicate key value violates unique constraint "commits_hash_key"`). The system should skip already-indexed commits or update them.
3.  **JavaScript Parser Limitations**:
    - **CommonJS**: The current `extractImports` only handles ESM `import`. CommonJS `require` calls are missed, leading to broken edges.
    - **Scope Coverage**: Calls outside of named `function_declaration` (e.g., in global scope or anonymous arrow functions) are not captured in the call graph.
    - **Symbol Extraction**: `const myFn = () => {}` is not extracted as a function symbol.

### **Recommendations for Phase 5**
-   Update `src/scanner.js` to correctly write the configured `outputFile` or update the CLI message.
-   Implement "Idempotent Scan" to handle existing commit hashes gracefully.
-   Enhance the JavaScript adapter to support CommonJS and arrow function assignments.
