# CodeGraphX Extreme Stress Test Design (Phases 2-4)

**Goal:** Evaluate CodeGraphX's deterministic accuracy, persistence integrity, and diagnostic capabilities by subjecting the system to intentional structural "chaos" and semantic "deception."

## 1. Test Scenarios

### 1.1 Scenario A: The "Semantic Deception" (Groundedness Test)
*   **Method**: Tricking the AI by providing a truthful commit message but a deceitful or flawed implementation.
*   **Test Case 1 (The Off-by-One)**:
    *   **Commit Message**: "fix: ensure all 8 winning lines are checked in tic-tac-toe"
    *   **Reality**: Modify `calculateWinner` to only check 7 lines.
    *   **Verification**: Run `cgx verify --task "Verify that all 8 winning conditions are implemented"`.
    *   **Success**: `cgx verify` returns `task_completed: false`.
*   **Test Case 2 (The Phantom Feature)**:
    *   **Commit Message**: "feat: implement game reset logic"
    *   **Reality**: Add a `resetGame()` function that only logs "resetting..." but doesn't clear the `gameState` array.
    *   **Verification**: Run `cgx verify --task "Verify that game reset logic clears the board"`.
    *   **Success**: `cgx verify` returns `task_completed: false` with a risk note.

### 1.2 Scenario B: The "Structural Chaos" (Diagnostic Test)
*   **Method**: Injecting code patterns that typically break static analysis or cause graph instability.
*   **Test Case 3 (The Cyclic Import)**:
    *   **Action**: `shared/game-logic.js` imports `backend/index.js`, which already imports `shared/game-logic.js`.
    *   **Verification**: Run `cgx scan` then `cgx doctor`.
    *   **Success**: `cgx doctor` identifies the cycle; scanner does not hang.
*   **Test Case 4 (The Syntax Poison)**:
    *   **Action**: Delete a closing brace `}` in a core utility file.
    *   **Verification**: Run `cgx scan`.
    *   **Success**: Scanner reports a parse error but completes the scan for other files.

### 1.3 Scenario C: The "Database Time-Warp" (Persistence Test)
*   **Method**: Testing SCD Type 2 integrity across branching and rapid mutations.
*   **Test Case 5 (Divergent History)**:
    *   **Action**: Create `branch-a` (rename function) and `branch-b` (delete function). Scan both.
    *   **Verification**: Query the symbol on both branches.
    *   **Success**: `cgx query` reflects the correct state per branch/commit hash without pollution.

## 2. Success Criteria
1.  **Groundedness**: `cgx verify` must reject implementations that don't match the semantic requirements, regardless of the commit message.
2.  **Stability**: `cgx scan` must never hang or crash due to cyclic dependencies or syntax errors.
3.  **Isolation**: Database state must be strictly partitioned by `repository_id` and versioned by `commit_id`.

## 3. Reporting
All outcomes will be recorded in `CodeGraphX_Stress_Test_Report.md`, following the format established in the initial capability report.
