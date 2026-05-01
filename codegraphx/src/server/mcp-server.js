const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { CallToolRequestSchema, ListToolsRequestSchema } = require("@modelcontextprotocol/sdk/types.js");
const { GraphStore } = require("../store");
const { loadConfig } = require("../utils");
const { buildCallEdges } = require("../edgebuilder");
const fs = require("fs");
const path = require("path");
const { BloomFilter } = require("bloom-filters");

class CodeGraphXServer {
  constructor() {
    this.server = new Server(
      {
        name: "codegraphx",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.projectRoot = process.cwd();
    this.config = loadConfig(this.projectRoot);
    this.store = new GraphStore(this.projectRoot, this.config);
    this.graph = { files: [], edges: [], generatedAt: null };
    this.bloom = null;

    this.setupTools();
    
    // Error handling
    this.server.onerror = (error) => console.error("[MCP Error]", error);
    process.on("SIGINT", async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  async initialize() {
    console.error("[CodeGraphX] Initializing MCP Server...");
    
    // Load files from store
    this.graph.files = this.store.getFilesData();
    
    // Build edges
    this.graph.edges = buildCallEdges(this.graph.files);
    
    // Set generatedAt from codebase.json if exists, else now
    const outputDir = path.join(this.projectRoot, this.config.outputDir);
    const codebasePath = path.join(outputDir, this.config.outputFile);
    if (fs.existsSync(codebasePath)) {
      try {
        const data = JSON.parse(fs.readFileSync(codebasePath, "utf8"));
        this.graph.generatedAt = data.generatedAt;
      } catch (e) {}
    }
    if (!this.graph.generatedAt) {
      this.graph.generatedAt = new Date().toISOString();
    }

    // Load Bloom Filter
    const bloomPath = path.join(outputDir, "symbols.bloom");
    if (fs.existsSync(bloomPath)) {
      try {
        const bloomData = JSON.parse(fs.readFileSync(bloomPath, "utf8"));
        this.bloom = BloomFilter.fromJSON(bloomData);
        console.error("[CodeGraphX] Bloom filter loaded.");
      } catch (e) {
        console.error("[CodeGraphX] Failed to load Bloom filter:", e.message);
      }
    }
    
    console.error(`[CodeGraphX] Loaded ${this.graph.files.length} files and ${this.graph.edges.length} edges.`);
  }

  setupTools() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "get_graph_status",
          description: "Get the current status of the CodeGraphX graph.",
          inputSchema: {
            type: "object",
            properties: {},
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (request.params.name === "get_graph_status") {
        const fileCount = this.graph.files.length;
        const symbolCount = this.graph.files.reduce((n, f) => n + (f.symbols?.length || 0), 0);
        const edgeCount = this.graph.edges.length;

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                initialized: true,
                fileCount,
                symbolCount,
                edgeCount,
                lastUpdated: this.graph.generatedAt,
              }, null, 2),
            },
          ],
        };
      }

      throw new Error(`Tool not found: ${request.params.name}`);
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("CodeGraphX MCP Server running on stdio");
  }
}

// Check if this script is being run directly
if (require.main === module) {
  const server = new CodeGraphXServer();
  server.initialize().then(() => {
    server.run().catch((error) => {
      console.error("Server error:", error);
      process.exit(1);
    });
  });
}

module.exports = { CodeGraphXServer };
