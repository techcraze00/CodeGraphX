2. Next Session: The "Skills" Phase
  Creating Skills (like using-cgx or codebase-expert) will turn Gemini CLI into a "CodeGraphX Native" agent. Instead of you telling
  it which tools to run, the skill will instruct Gemini to automatically call cgx-mcp whenever it needs context.

  ---

  3. Detailed Prompt for Next Session
  Copy and paste this into Gemini CLI for your next session:

    1 **Topic: Implementing CodeGraphX AI Skills & SQLite Portability**
    2
    3 **Background:** 
    4 CodeGraphX (CGX) is a deterministic semantic graph engine for codebases. It is currently in Phase 5: "Pure Intelligence Tool"
      refactor. It has a Postgres backend, an MCP server, and an SDK. Our goal is to make CGX a "native" power for Gemini CLI by
      creating a dedicated Skill and migrating to a zero-config SQLite backend for easier npm distribution.
    5
    6 **Directive:**
    7 1. **Initialize Task:** Use the `writing-plans` skill to design a two-part implementation:
    8    - Part A: Migrate the storage layer from Postgres to SQLite (using `better-sqlite3` or `sqlite3`) to make the tool portable
      for npm users. Ensure Recursive CTEs for `traceImpact` are preserved.
    9    - Part B: Author a formal Gemini Skill (`SKILL.md`) for CodeGraphX.
   10
   11 2. **Skill Requirements:** The CodeGraphX Skill must instruct any AI agent to:
   12    - Always run `cgx get_session_diff` before reviewing a PR to understand semantic changes.
   13    - Use `cgx trace_impact` when a user asks to refactor a function to see what might break.
   14    - Use `cgx verify` to gather deterministic evidence before claiming a task is done.
   15    - Never read the entire file if a specific symbol can be queried via the graph.
   16
   17 3. **Optimization Constraints:**
   18    - **Context7:** Use this to fetch the best practices for writing "Gemini Skills" and "MCP Tool Orchestration" to ensure the
      `SKILL.md` is formatted for maximum agent performance.
   19    - **Caveman Mode:** Activate `/caveman full` during the refactoring turns to save tokens on technical explanations.
   20    - **Superpowers:** Use the `test-driven-development` skill. No SQLite migration or Skill logic is complete without a
      passing test suite in `tests/`.
   21    - **Verification:** Use the `verification-before-completion` skill to prove that the new SQLite backend produces the exact
      same impact-tracing results as the old Postgres one.
   22
   23 4. **Immediate First Step:**
   24    - Research `kysely` documentation via `context7` to see how to implement a multi-dialect setup that supports both Postgres
      and SQLite seamlessly.

  Summary of What This Achieves:
   - Portability: It makes the tool installable with a simple npm install -g.
   - Autonomy: The Skill ensures Gemini CLI uses CGX tools proactively without you prompting it.
   - Efficiency: It uses your existing advanced extensions (context7, superpowers) to ensure the code quality is top-tier.
▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
 > ok so proceed with this recommendation first:                                                                                    
    Recommendation: Migrate to SQLite.                                                                                              
      - Why? It requires zero installation (single file). Users won't need to set up a Docker container or a local DB.              
      - Can it do Impact Tracing? Yes. SQLite supports Recursive CTEs (Common Table Expressions) just like Postgres.                
      - Performance: For 99% of repos (under 1M LOC), SQLite is faster for local lookups than a network-bound Postgres.             
      - Strategy: We should add an adapter layer to the SDK that defaults to SQLite for the npm package, while keeping Postgres as  
   an                                                                                                                               
        option for server-side deployments (like the Scrum Master backend).                                                       