const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { 
  CallToolRequestSchema, 
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema
} = require("@modelcontextprotocol/sdk/types.js");
const { SqlGraphStore } = require("../store/sql-store");
const { db } = require("../db");
const { loadConfig, ensureDirSync } = require("../utils");
const fs = require("fs");
const path = require("path");
const { BloomFilter } = require("bloom-filters");

const log  = (...a) => process.stderr.write('[CodeGraphX] ' + a.join(' ') + '\n');
const warn = (...a) => process.stderr.write('[CodeGraphX] WARN ' + a.join(' ') + '\n');

class CodeGraphXServer {
  constructor() {
    this.server = new Server(
      { name: "codegraphx", version: require("../../package.json").version },
      { capabilities: { tools: {}, resources: {} } }
    );

    this.projectRoot = process.cwd();
    this.config = loadConfig(this.projectRoot);
    this.pgStore = new SqlGraphStore(db);
    this.repositoryId = null;
    this.graphReady = false;
    this.bloom = null;
    this.indexing = false;
    this.indexError = null;
    this._scanPromise = null;

    this.setupTools();
    this.setupResources();

    this.server.onerror = (error) => {
      process.stderr.write('[CodeGraphX] MCP Error: ' + error + '\n');
    };

    process.on("SIGINT", async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  async initialize() {
    log("Initializing MCP Server...");

    let needsScan = false;
    try {
      const repo = await db.selectFrom('repositories').selectAll().limit(1).executeTakeFirst();
      if (repo) {
        const fileCountRes = await db.selectFrom('files')
          .select(db.fn.count('id').as('count'))
          .where('valid_to_commit_id', 'is', null)
          .executeTakeFirst();
        if (Number(fileCountRes?.count || 0) > 0) {
          this.repositoryId = repo.id;
          this.graphReady = true;
          log(`Connected to repository: ${repo.name} (${repo.id})`);
        } else {
          needsScan = true;
        }
      } else {
        needsScan = true;
      }
    } catch (e) {
      // Fresh project: tables don't exist until migrations run.
      needsScan = true;
      log("Database not initialized yet:", e.message);
    }

    if (needsScan) {
      log("No indexed graph found. Starting background scan...");
      // Intentionally not awaited: initialize() must return fast so the
      // stdio handshake doesn't time out while a large repo is indexed.
      this._startBackgroundScan();
    }

    this._loadBloom();
  }

  _loadBloom() {
    const bloomPath = path.join(this.projectRoot, this.config.outputDir, "symbols.bloom");
    if (fs.existsSync(bloomPath)) {
      try {
        const bloomData = JSON.parse(fs.readFileSync(bloomPath, "utf8"));
        this.bloom = BloomFilter.fromJSON(bloomData);
        log("Bloom filter loaded.");
      } catch (e) {
        warn("Failed to load Bloom filter:", e.message);
      }
    }
  }

  _startBackgroundScan() {
    if (this._scanPromise) return this._scanPromise;

    this.indexing = true;
    this.indexError = null;

    this._scanPromise = (async () => {
      const { runMigrations } = require("../db/migrator");
      const { runScan } = require("../scanner");

      await runMigrations();
      await runScan(this.projectRoot, this.config, true);

      const repo = await db.selectFrom('repositories').selectAll().limit(1).executeTakeFirst();
      if (!repo) throw new Error("Scan completed but no repository was created.");

      this.repositoryId = repo.id;
      this.graphReady = true;
      this._loadBloom();
      log(`Background scan complete. Connected to repository: ${repo.name} (${repo.id})`);
    })().catch((e) => {
      this.indexError = e.message;
      warn("Background scan failed:", e.message);
    }).finally(() => {
      this.indexing = false;
    });

    return this._scanPromise;
  }

  _notReadyResponse(toolName) {
    if (this.indexing) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            status: "indexing",
            message: "CodeGraphX is indexing this project for the first time. Retry this tool in a few seconds.",
            tool: toolName
          }, null, 2)
        }],
        isError: false,
      };
    }
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          status: this.indexError ? "error" : "not_ready",
          message: this.indexError
            ? `Initial scan failed: ${this.indexError}. Run 'npx codegraphx scan' manually.`
            : "CodeGraphX graph not initialized. Run 'codegraphx scan' first.",
          tool: toolName
        }, null, 2)
      }],
      isError: true,
    };
  }

  setupTools() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "get_graph_status",
          description: "Get the current status of the CodeGraphX graph.",
          inputSchema: { type: "object", properties: {} },
        },
        {
          name: "list_files",
          description: "List all files in the codebase.",
          inputSchema: {
            type: "object",
            properties: {
              filter: { type: "string", description: "Optional substring filter for file paths." },
            },
          },
        },
        {
          name: "explain_impact",
          description: "Provides a high-level summary of a symbol's blast radius (upstream/downstream).",
          inputSchema: {
            type: "object",
            properties: {
              symbol_name: { type: "string", description: "The symbol name to explain impact for." },
            },
            required: ["symbol_name"],
          },
        },
        {
          name: "check_symbol_exists",
          description: "Instantly check if a symbol exists using a Bloom filter.",
          inputSchema: {
            type: "object",
            properties: {
              name: { type: "string", description: "The symbol name to check." },
            },
            required: ["name"],
          },
        },
        {
          name: "verify_task",
          description: "High-level tool to verify if a specific task description has been implemented in a commit.",
          inputSchema: {
            type: "object",
            properties: {
              task_description: { type: "string", description: "Description of the task to verify." },
              commit_hash: { type: "string", description: "The commit hash to verify against (optional, defaults to HEAD)." },
            },
            required: ["task_description"],
          },
        },
        {
          name: "get_session_diff",
          description: "Get a summary of changes in the current session or a specific branch.",
          inputSchema: {
            type: "object",
            properties: {
              branch: { type: "string", description: "Branch to diff (default: 'HEAD')." },
            },
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      if (name === "get_graph_status") {
        if (!this.graphReady) {
          const status = this.indexing
            ? { initialized: false, status: "indexing", message: "Initial scan in progress. Retry in a few seconds." }
            : this.indexError
              ? { initialized: false, status: "error", error: this.indexError, hint: "Run 'npx codegraphx scan' manually." }
              : { initialized: false, status: "not_ready", message: "No graph found. Run 'codegraphx scan' first." };
          return { content: [{ type: "text", text: JSON.stringify(status, null, 2) }] };
        }
        const fileCountRes = await db.selectFrom('files').select(db.fn.count('id').as('count')).where('valid_to_commit_id', 'is', null).executeTakeFirst();
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              initialized: true,
              status: "ready",
              repositoryId: this.repositoryId,
              fileCount: fileCountRes?.count || 0
            }, null, 2),
          }],
        };
      }

      if (!this.graphReady) return this._notReadyResponse(name);

      if (name === "list_files") {
        let query = db.selectFrom('files')
          .select(['path as file'])
          .where('repository_id', '=', this.repositoryId)
          .where('valid_to_commit_id', 'is', null);
        
        if (args?.filter) {
          query = query.where('path', 'like', `%${args.filter}%`);
        }

        const files = await query.execute();
        return { content: [{ type: "text", text: JSON.stringify(files, null, 2) }] };
      }

      if (name === "explain_impact") {
        const sym = await db.selectFrom('symbols')
          .select('id')
          .where('name', '=', args.symbol_name)
          .where('valid_to_commit_id', 'is', null)
          .executeTakeFirst();
        
        if (!sym) {
          return { content: [{ type: "text", text: `Symbol not found: ${args.symbol_name}` }], isError: true };
        }

        const upstream = await this.pgStore.traceImpact(this.repositoryId, sym.id, 'upstream', 3);
        const downstream = await this.pgStore.traceImpact(this.repositoryId, sym.id, 'downstream', 3);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              symbol: args.symbol_name,
              used_by_upstream: upstream.map(s => `${s.path}::${s.name}`),
              breaks_downstream: downstream.map(s => `${s.path}::${s.name}`)
            }, null, 2)
          }]
        };
      }

      if (name === "check_symbol_exists") {
        if (!this.bloom) return { content: [{ type: "text", text: "Bloom filter not loaded" }], isError: true };
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              name: args.name,
              exists: this.bloom.has(args.name) ? "probable_yes" : "definite_no",
            }, null, 2),
          }],
        };
      }

      if (name === "verify_task") {
        const { buildTaskVerification } = require("../verifier");
        const verification = await buildTaskVerification(
          args.task_description, 
          args.commit_hash || "HEAD",
          this.pgStore,
          this.repositoryId
        );
        return { content: [{ type: "text", text: JSON.stringify(verification, null, 2) }] };
      }

      if (name === "get_session_diff") {
        const { scanCommit } = require("../git/commit-scanner");
        const summary = await scanCommit(this.projectRoot, this.pgStore, this.repositoryId, args.branch || "HEAD");
        return { content: [{ type: "text", text: JSON.stringify(summary, null, 2) }] };
      }

      throw new Error(`Tool not found: ${name}`);
    });
  }

  setupResources() {
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: [
        { uri: "codegraphx://file-index", name: "File Index", mimeType: "application/json" },
        { uri: "codegraphx://changelog", name: "Changelog", mimeType: "application/json" }
      ]
    }));

    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const uri = request.params.uri;
      if (uri === "codegraphx://file-index") {
        const files = await db.selectFrom('files').select('path').where('valid_to_commit_id', 'is', null).execute();
        return { contents: [{ uri, mimeType: "application/json", text: JSON.stringify(files) }] };
      }
      // Add changelog if needed
      throw new Error(`Resource not found: ${uri}`);
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    log("MCP Server running on stdio");
  }
}

if (require.main === module) {
  const server = new CodeGraphXServer();
  server.initialize().then(() => server.run());
}

module.exports = { CodeGraphXServer };
