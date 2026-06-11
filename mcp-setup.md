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
CAUSE 4 ▸ Wrong project root → server indexes the wrong directory
─────────────────────────────────────────────────────────────────
The server indexes the directory it starts in. If your MCP client does
not set a working directory, the server may look at the wrong folder.

FIX: Pass the project root explicitly — either works:
  cgx-mcp --project-root /path/to/your/project
  CGX_PROJECT_ROOT=/path/to/your/project cgx-mcp

Tools are ALWAYS registered, even before any scan exists. On first start
in a project the server automatically indexes the codebase in the
background; get_graph_status reports "indexing" until it is "ready".


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — (Optional) Scan
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

No manual scan is required: the MCP server auto-indexes on first start.

Running a scan yourself is still useful if you want the extra artifacts
(HTML dashboard, TOON files) or want indexing done before the agent
connects:

  cd /your/project
  npx codegraphx scan      # or `codegraphx scan` if installed globally


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
        "/ABSOLUTE/PATH/TO/node_modules/codegraphx/bin/cgx-mcp"
      ],
      "cwd": "/ABSOLUTE/PATH/TO/YOUR_PROJECT"
    }
  }
}

If your client ignores "cwd", add "--project-root /ABSOLUTE/PATH/TO/YOUR_PROJECT"
to args instead — it takes precedence over the working directory.

Real example (macOS, nvm, globally installed codegraphx):
{
  "mcpServers": {
    "codegraphx": {
      "command": "/Users/alice/.nvm/versions/node/v20.11.0/bin/node",
      "args": [
        "/Users/alice/.nvm/versions/node/v20.11.0/bin/cgx-mcp"
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
        "./node_modules/codegraphx/bin/cgx-mcp"
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

  □ settings.json uses ABSOLUTE path to node (not "npx", not "node")
  □ cwd (or --project-root) in settings.json matches the project root exactly
  □ Server name has NO underscores (use "codegraphx" not "code_graphx")
  □ gemini trust run in the project folder (project-scope only)
  □ Gemini CLI restarted after editing settings.json