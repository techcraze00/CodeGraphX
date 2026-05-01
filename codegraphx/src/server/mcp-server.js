const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { 
  CallToolRequestSchema, 
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema
} = require("@modelcontextprotocol/sdk/types.js");
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
          resources: {},
        },
      }
    );

    this.projectRoot = process.cwd();
    this.config = loadConfig(this.projectRoot);
    this.store = new GraphStore(this.projectRoot, this.config);
    this.graph = { files: [], edges: [], generatedAt: null };
    this.bloom = null;

    this.setupTools();
    this.setupResources();
    
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
        {
          name: "list_files",
          description: "List all files in the codebase with a summary of their contents.",
          inputSchema: {
            type: "object",
            properties: {
              filter: {
                type: "string",
                description: "Optional glob or substring filter for file paths.",
              },
            },
          },
        },
        {
          name: "query_symbol",
          description: "Get detailed information about a specific symbol (function, class, etc.).",
          inputSchema: {
            type: "object",
            properties: {
              name: {
                type: "string",
                description: "The name of the symbol to query. Can be a bare name or 'file::name' for exact matching.",
              },
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
              name: {
                type: "string",
                description: "The name of the symbol to check.",
              },
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
              symbol: {
                type: "string",
                description: "The symbol to trace (name or 'file::name').",
              },
              direction: {
                type: "string",
                enum: ["upstream", "downstream"],
                description: "The direction to trace: 'upstream' for callers, 'downstream' for callees.",
              },
              depth: {
                type: "integer",
                default: 3,
                description: "Maximum depth to trace (default 3).",
              },
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
              branch: {
                type: "string",
                description: "The branch or commit to diff against HEAD~1 (default: 'HEAD').",
                default: "HEAD",
              },
            },
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      if (name === "get_graph_status") {
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

      if (name === "list_files") {
        const filter = args?.filter?.toLowerCase();
        const files = this.graph.files
          .filter(f => !filter || f.file.toLowerCase().includes(filter))
          .map(f => ({
            file: f.file,
            summary: (f.symbols || [])
              .filter(s => ['class', 'function'].includes(s.type))
              .map(s => s.name)
              .join(', ') || 'No main symbols'
          }));

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(files, null, 2),
            },
          ],
        };
      }

      if (name === "query_symbol") {
        const symbolName = args?.name;
        if (!symbolName) {
          throw new Error("Symbol name is required");
        }

        let matches = [];
        if (symbolName.includes("::")) {
          const [filePath, sym] = symbolName.split("::");
          const fileData = this.graph.files.find(f => f.file === filePath);
          if (fileData) {
            const symbol = (fileData.symbols || []).find(s => s.name === sym);
            if (symbol) {
              matches.push({ file: fileData.file, symbol });
            }
          }
        } else {
          this.graph.files.forEach(f => {
            (f.symbols || []).forEach(s => {
              if (s.name === symbolName) {
                matches.push({ file: f.file, symbol: s });
              }
            });
          });
        }

        if (matches.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `No symbol named "${symbolName}" found.`,
              },
            ],
            isError: true,
          };
        }

        const results = matches.map(match => ({
          file: match.file,
          type: match.symbol.type,
          location: match.symbol.startPosition ? `row ${match.symbol.startPosition.row + 1}` : "unknown",
          calls: match.symbol.calls || [],
          called_by: match.symbol.called_by || [],
          imports: match.symbol.imports || [],
        }));

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(results, null, 2),
            },
          ],
        };
      }

      if (name === "check_symbol_exists") {
        const symbolName = args?.name;
        if (!symbolName) {
          throw new Error("Symbol name is required");
        }

        if (!this.bloom) {
          return {
            content: [
              {
                type: "text",
                text: "Bloom filter not loaded. Cannot perform instant check.",
              },
            ],
            isError: true,
          };
        }

        const exists = this.bloom.has(symbolName);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                name: symbolName,
                exists: exists ? "probable_yes" : "definite_no",
              }, null, 2),
            },
          ],
        };
      }

      if (name === "trace_impact") {
        const { symbol: startSymbol, direction, depth = 3 } = args;
        if (!startSymbol || !direction) {
          throw new Error("Symbol and direction are required");
        }

        const findSymbol = (id) => {
          let filePath, symName;
          if (id.includes("::")) {
            const parts = id.split("::");
            filePath = parts[0];
            symName = parts[1];
          } else {
            symName = id;
          }

          for (const f of this.graph.files) {
            if (filePath && f.file !== filePath) continue;
            const symbol = (f.symbols || []).find(s => s.name === symName);
            if (symbol) return { file: f.file, symbol, id: `${f.file}::${symbol.name}` };
          }
          return null;
        };

        const startNode = findSymbol(startSymbol);
        if (!startNode) {
          return {
            content: [{ type: "text", text: `Symbol "${startSymbol}" not found.` }],
            isError: true,
          };
        }

        const visited = new Set();
        const results = [];
        const queue = [{ id: startNode.id, depth: 0 }];
        visited.add(startNode.id);

        while (queue.length > 0) {
          const { id, depth: currentDepth } = queue.shift();
          const node = findSymbol(id);
          
          if (!node) continue;

          const neighbors = direction === "downstream" ? 
            (node.symbol.calls || []) : 
            (node.symbol.called_by || []);

          results.push({
            id: node.id,
            depth: currentDepth,
            type: node.symbol.type,
            [direction === "downstream" ? "calls" : "called_by"]: neighbors
          });

          if (currentDepth < depth) {
            for (const neighbor of neighbors) {
              if (!visited.has(neighbor)) {
                visited.add(neighbor);
                queue.push({ id: neighbor, depth: currentDepth + 1 });
              }
            }
          }
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                startSymbol: startNode.id,
                direction,
                maxDepth: depth,
                impactGraph: results
              }, null, 2),
            },
          ],
        };
      }

      if (name === "get_session_diff") {
        const branch = args?.branch || "HEAD";
        const { scanCommit } = require("../git/commit-scanner");
        const summary = scanCommit(this.projectRoot, this.store, branch);

        if (!summary) {
          return {
            content: [{ type: "text", text: "No changes found or not a git repository." }],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(summary, null, 2),
            },
          ],
        };
      }

      throw new Error(`Tool not found: ${name}`);
    });
  }

  setupResources() {
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: [
        {
          uri: "codegraphx://file-index",
          name: "CodeGraphX File Index",
          mimeType: "text/plain",
          description: "One-liner summary of every file in the codebase."
        },
        {
          uri: "codegraphx://changelog",
          name: "CodeGraphX Changelog",
          mimeType: "text/plain",
          description: "Session and commit history of code changes."
        }
      ]
    }));

    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const uri = request.params.uri;
      const outputDir = path.join(this.projectRoot, this.config.outputDir);

      if (uri === "codegraphx://file-index") {
        const toonPath = path.join(outputDir, "file_index.toon");
        let content = "";

        if (fs.existsSync(toonPath)) {
          try {
            const { decode } = require("@toon-format/toon");
            const raw = fs.readFileSync(toonPath, "utf8");
            const decoded = decode(raw);
            content = JSON.stringify(decoded, null, 2);
          } catch (e) {
            console.error("[MCP Resource] Failed to decode TOON file-index:", e.message);
          }
        }

        if (!content) {
          // Fallback to codebase.json
          const codebasePath = path.join(outputDir, this.config.outputFile);
          const customPath = path.join(outputDir, "custom_codebase.json");
          const fallbackPath = fs.existsSync(codebasePath) ? codebasePath : (fs.existsSync(customPath) ? customPath : null);

          if (fallbackPath) {
            try {
              const data = JSON.parse(fs.readFileSync(fallbackPath, "utf8"));
              const index = {
                files: (data.files || []).map(f => ({
                  file: f.file,
                  summary: (f.symbols || [])
                    .filter(s => ['class', 'function'].includes(s.type))
                    .map(s => s.name)
                    .join(', ') || 'No main symbols'
                }))
              };
              content = JSON.stringify(index, null, 2);
            } catch (e) {
              console.error("[MCP Resource] Fallback failed:", e.message);
            }
          }
        }

        return {
          contents: [
            {
              uri,
              mimeType: "text/plain",
              text: content || "File index not available."
            }
          ]
        };
      }

      if (uri === "codegraphx://changelog") {
        const toonPath = path.join(outputDir, "CHANGELOG.toon");
        let content = "";

        if (fs.existsSync(toonPath)) {
          try {
            const { decode } = require("@toon-format/toon");
            const raw = fs.readFileSync(toonPath, "utf8");
            const decoded = decode(raw);
            content = JSON.stringify(decoded, null, 2);
          } catch (e) {
            console.error("[MCP Resource] Failed to decode TOON changelog:", e.message);
          }
        }

        return {
          contents: [
            {
              uri,
              mimeType: "text/plain",
              text: content || "Changelog not available."
            }
          ]
        };
      }

      throw new Error(`Resource not found: ${uri}`);
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
