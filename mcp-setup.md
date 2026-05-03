# CodeGraphX × Gemini CLI — MCP Setup & Troubleshooting

## Why "Disconnected" happens (and what we fixed)

There are four distinct root causes for the Disconnected status. All four are
now addressed either in the server code or in the configuration below.

─────────────────────────────────────────────────────────────────
CAUSE 1 ▸ stdout pollution
─────────────────────────────────────────────────────────────────
The MCP stdio transport owns stdout 100%. A single console.log(), an npm
lifecycle print, or any stray byte on stdout corrupts the JSON-RPC frame
and Gemini drops the connection immediately.

FIX (applied in mcp-server.js + cgx-mcp entry point):
  • Every log/warn call now writes to process.stderr, never stdout.
  • The entry point monkey-patches console.log/console.info to stderr
    before any require() runs, so even transitive npm deps can't leak.
  • process.uncaughtException is caught and written to stderr only.

─────────────────────────────────────────────────────────────────
CAUSE 2 ▸ PATH not inherited (most common on macOS with nvm/fnm/volta)
─────────────────────────────────────────────────────────────────
Gemini CLI spawns the MCP process without your interactive-shell PATH.
"npx" resolves fine in your terminal but not when Gemini tries to find it.

FIX (in settings.json — see templates below):
  Use the ABSOLUTE path to node instead of relying on "npx".

  Find yours:   which node        (macOS/Linux)
                where node        (Windows cmd)
                (Get-Command node).Source   (PowerShell)

─────────────────────────────────────────────────────────────────
CAUSE 3 ▸ Untrusted folder → project .gemini/settings.json ignored
─────────────────────────────────────────────────────────────────
Gemini CLI ignores project-scoped .gemini/settings.json in untrusted
folders. The server shows Disconnected because it was never even started.

FIX: Trust the folder once:
  cd your-project
  gemini trust

─────────────────────────────────────────────────────────────────
CAUSE 4 ▸ Graph not initialised → 0 tools → connection dropped
─────────────────────────────────────────────────────────────────
The MCP server reads from the .codegraphx/ cache. If no scan has been run,
it registers 0 tools and Gemini silently drops the connection.

FIX: Always run scan before starting Gemini:
  codegraphx scan        # or: npx codegraphx scan

The patched server now returns a helpful error message from every tool
instead of crashing, so the connection stays alive even without a scan.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — Scan first
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  cd /your/project
  npx codegraphx scan      # or `codegraphx scan` if installed globally

This creates .codegraphx/codebase.json and .codegraphx/cache.json.
The MCP server is a read-only consumer of this cache — it never scans
itself. Re-run scan whenever your code changes significantly.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — Find your absolute node path
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  macOS / Linux:   which node
    → e.g. /usr/local/bin/node
    → e.g. /home/yourname/.nvm/versions/node/v20.11.0/bin/node

  Windows (cmd):   where node
    → e.g. C:\Program Files\nodejs\node.exe

  Windows (PS):    (Get-Command node).Source


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — Configure .gemini/settings.json
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Choose ONE of the two options below.

────────────────────────────────────────────────────────────────
OPTION A — Project-scoped (recommended, per-project)
File: YOUR_PROJECT/.gemini/settings.json
────────────────────────────────────────────────────────────────

{
  "mcpServers": {
    "codegraphx": {
      "command": "/ABSOLUTE/PATH/TO/node",
      "args": [
        "/ABSOLUTE/PATH/TO/node_modules/.bin/codegraphx",
        "cgx-mcp"
      ],
      "cwd": "/ABSOLUTE/PATH/TO/YOUR_PROJECT"
    }
  }
}

Real example (macOS, nvm, globally installed codegraphx):
{
  "mcpServers": {
    "codegraphx": {
      "command": "/Users/alice/.nvm/versions/node/v20.11.0/bin/node",
      "args": [
        "/Users/alice/.nvm/versions/node/v20.11.0/bin/codegraphx",
        "cgx-mcp"
      ],
      "cwd": "/Users/alice/projects/my-app"
    }
  }
}

Real example (Linux, system node, npx fallback):
{
  "mcpServers": {
    "codegraphx": {
      "command": "/usr/bin/node",
      "args": [
        "/usr/lib/node_modules/codegraphx/bin/cgx-mcp"
      ],
      "cwd": "/home/alice/projects/my-app"
    }
  }
}

────────────────────────────────────────────────────────────────
OPTION B — If codegraphx is installed locally in the project
File: YOUR_PROJECT/.gemini/settings.json
────────────────────────────────────────────────────────────────

{
  "mcpServers": {
    "codegraphx": {
      "command": "/ABSOLUTE/PATH/TO/node",
      "args": [
        "./node_modules/.bin/codegraphx",
        "cgx-mcp"
      ],
      "cwd": "/ABSOLUTE/PATH/TO/YOUR_PROJECT"
    }
  }
}

────────────────────────────────────────────────────────────────
OPTION C — Windows (cmd wrapper)
File: %USERPROFILE%\.gemini\settings.json  OR  project\.gemini\settings.json
────────────────────────────────────────────────────────────────

{
  "mcpServers": {
    "codegraphx": {
      "command": "cmd",
      "args": [
        "/c",
        "C:\\Program Files\\nodejs\\node.exe",
        "C:\\Users\\Alice\\AppData\\Roaming\\npm\\node_modules\\codegraphx\\bin\\cgx-mcp"
      ],
      "cwd": "C:\\Users\\Alice\\projects\\my-app"
    }
  }
}


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 — Trust the project folder
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Only needed if using project-scoped settings (Option A / B above):

  cd /your/project
  gemini trust

This is a one-time operation per machine. Without it, Gemini ignores
your project .gemini/settings.json entirely.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5 — Verify
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  gemini          # start Gemini CLI
  /mcp            # should show:  ✓ codegraphx — Connected  (N tools)

If still Disconnected, run the debug command:

  gemini mcp list

Then check stderr output by launching the server manually:

  /ABSOLUTE/PATH/TO/node /path/to/cgx-mcp 2>&1 | head -20

Any error printed there is the real cause.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
QUICK CHECKLIST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  □ codegraphx scan ran successfully (.codegraphx/ folder exists)
  □ settings.json uses ABSOLUTE path to node (not "npx", not "node")
  □ cwd in settings.json matches the project root exactly
  □ Server name has NO underscores (use "codegraphx" not "code_graphx")
  □ gemini trust run in the project folder (project-scope only)
  □ Gemini CLI restarted after editing settings.json