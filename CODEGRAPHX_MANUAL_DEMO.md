# CodeGraphX Manual Demo — Step-by-Step Testing

Follow these steps to manually test CodeGraphX end-to-end and verify that both the tool and your agent workflow behave as expected.

---

## 1. Clean your environment (optional)

To start fresh for testing:
```sh
rm -rf .codegraphx/
rm -rf node_modules/
rm package-lock.json
```

## 2. Install dependencies
```sh
npm install
```

## 3. Run the core indexer (init)
```sh
npx codegraphx init
# or, if installed globally:
codegraphx init
```

This should produce `.codegraphx/` with:
- `file_index.toon` (one line per file)
- `codegraph.toon` (full graph)
- `symbols.json` and `symbols.bloom` (agent lookup/Bloom)
- `CHANGELOG.toon` (if git used/tested)
- `codegraph.html` (optional dashboard)

## 4. Open the dashboard
```sh
npx codegraphx dashboard
# or open .codegraphx/codegraph.html in your browser
```

## 5. Make a coding change (e.g., edit/add a .py or .js file)
```sh
echo "def hello(): print('hi')" > demo.py
npx codegraphx scan  # or rerun init
```

Check `.codegraphx/codegraph.toon` — the new function and its edges should appear in the graph.

## 6. Test live update (watch mode)
```sh
npx codegraphx watch
# In a second terminal, edit a file, e.g.:
echo "def foobar(): return 42" > live_test.py
# Watch should instantly update .codegraphx/ files
```

## 7. Test with your coding agent
Start your agent (e.g. Gemini CLI, Claude Code, Copilot CLI). Ensure it reads
`.codegraphx/file_index.toon` and `.codegraphx/codegraph.toon` as first input.

Ask it structural questions (e.g. “Which files import X?”, “What functions call foo?”). It
should answer instantly using those files, without a full scan.

## 8. (Optional) Install the git hook and check changelog
```sh
npx codegraphx git-hook install
# Make a commit, then check .codegraphx/CHANGELOG.toon
```

## 9. Try the impact/query/stat CLI features
```sh
npx codegraphx stats
npx codegraphx query hello
npx codegraphx impact foobar
```

---

If any step fails, check your config file (`.codegraphxrc` or `codegraphx.config.json`) and be sure your agent is set up per `CODEGRAPHX_AGENT_USAGE.md`.

You are now ready for robust, agent-driven codebase navigation!
