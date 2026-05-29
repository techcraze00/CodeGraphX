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
      { name: "codegraphx", version: "1.0.0" },
      { capabilities: { tools: {}, resources: {} } }
    );

    this.projectRoot = process.cwd();
    this.config = loadConfig(this.projectRoot);
    this.pgStore = new SqlGraphStore(db);
    this.repositoryId = null;
    this.graphReady = false;
    this.bloom = null;

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
    
    try {
      const repo = await db.selectFrom('repositories').selectAll().limit(1).executeTakeFirst();
      if (repo) {
        this.repositoryId = repo.id;
        this.graphReady = true;
        log(`Connected to repository: ${repo.name} (${repo.id})`);
      } else {
        warn("No repository found in database. Run 'codegraphx scan' first.");
      }
    } catch (e) {
      warn("Database connection failed during initialization:", e.message);
    }

    // Load Bloom Filter
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

  _notReadyResponse(toolName) {
    return {
      content: [{ 
        type: "text", 
        text: JSON.stringify({
          status: "not_ready",
          message: "CodeGraphX graph not initialized. Run 'codegraphx scan' first.",
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
          name: "query_symbol",
          description: "Get detailed information about a specific symbol.",
          inputSchema: {
            type: "object",
            properties: {
              name: { type: "string", description: "Symbol name." },
            },
            required: ["name"],
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
          name: "trace_impact",
          description: "Trace the upstream or downstream impact of a symbol.",
          inputSchema: {
            type: "object",
            properties: {
              symbol: { type: "string", description: "Symbol ID or name." },
              direction: { type: "string", enum: ["upstream", "downstream"] },
              depth: { type: "integer" },
            },
            required: ["symbol", "direction"],
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
        if (!this.graphReady) return { content: [{ type: "text", text: "Not initialized" }] };
        const fileCountRes = await db.selectFrom('files').select(db.fn.count('id').as('count')).where('valid_to_commit_id', 'is', null).executeTakeFirst();
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              initialized: true,
              repositoryId: this.repositoryId,
              fileCount: fileCountRes?.count || 0
            }, null, 2),
          }],
        };
      }

      if (!this.graphReady) return this._notReadyResponse(name);

      if (name === "list_files") {
        const query = db.selectFrom('files')
          .select(['path as file'])
          .where('repository_id', '=', this.repositoryId)
          .where('valid_to_commit_id', 'is', null);
        
        if (args?.filter) {
          query = query.where('path', 'like', `%${args.filter}%`);
        }

        const files = await query.execute();
        return { content: [{ type: "text", text: JSON.stringify(files, null, 2) }] };
      }

      if (name === "query_symbol") {
        const matches = await db.selectFrom('symbols as s')
          .innerJoin('files as f', 's.file_id', 'f.id')
          .selectAll('s')
          .select('f.path as file_path')
          .where('s.name', '=', args.name)
          .where('s.valid_to_commit_id', 'is', null)
          .execute();

        return { content: [{ type: "text", text: JSON.stringify(matches, null, 2) }] };
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

      if (name === "trace_impact") {
        // Resolve symbol ID first if name given
        let symbolId = args.symbol;
        if (!symbolId.includes('-')) { // Heuristic: if no hyphen, it might be a name
          const sym = await db.selectFrom('symbols')
            .select('id')
            .where('name', '=', args.symbol)
            .where('valid_to_commit_id', 'is', null)
            .executeTakeFirst();
          if (sym) symbolId = sym.id;
        }

        const impact = await this.pgStore.traceImpact(this.repositoryId, symbolId, args.direction, args.depth || 3);
        return { content: [{ type: "text", text: JSON.stringify(impact, null, 2) }] };
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
