const { CodeGraphXServer } = require('../../src/server/mcp-server');
const { GraphStore } = require('../../src/store');
const { buildEdges } = require('../../src/edgebuilder');
const { runMigrations } = require('../../src/db/migrator');
const { db, closeDb, dialectType } = require('../../src/db');
const { sql } = require('kysely');
const fs = require('fs');

jest.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: jest.fn().mockImplementation(() => ({
    setRequestHandler: jest.fn(),
    onerror: jest.fn(),
    connect: jest.fn(),
    close: jest.fn(),
  })),
}));

jest.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: jest.fn(),
}));

jest.mock('../../src/store', () => {
  return {
    GraphStore: jest.fn().mockImplementation(() => ({
      getFilesData: jest.fn(),
      symbolIndex: new Map(),
      updateFile: jest.fn(),
      removeFile: jest.fn(),
      loadCache: jest.fn(),
      saveCache: jest.fn(),
    })),
  };
});
jest.mock('../../src/edgebuilder');
jest.mock('../../src/scanner', () => ({
  runScan: jest.fn()
}));
jest.mock('../../src/utils', () => ({
  loadConfig: jest.fn().mockReturnValue({ outputDir: '.codegraphx', outputFile: 'codebase.json' }),
  ensureDirSync: jest.fn(),
  findFiles: jest.fn().mockReturnValue([]),
  writeJSONSync: jest.fn()
}));

jest.mock('bloom-filters', () => ({
  BloomFilter: {
    from: jest.fn(),
    fromJSON: jest.fn()
  }
}));

describe('CodeGraphXServer', () => {
  let server;
  let mockSetRequestHandler;
  let existsSyncSpy;
  const mockFiles = [
    {
      file: 'src/main.js',
      symbols: [
        { id: 'javascript::src/main.js::global::start', name: 'start', type: 'function', calls: ['helper'] }
      ]
    },
    {
      file: 'src/utils.js',
      symbols: [
        { id: 'javascript::src/utils.js::global::helper', name: 'helper', type: 'function', called_by: ['javascript::src/main.js::global::start'] }
      ]
    }
  ];

  beforeAll(async () => {
    if (dialectType === 'postgres') {
      await sql`DROP SCHEMA public CASCADE; CREATE SCHEMA public;`.execute(db);
    } else {
      const tables = ['unresolved_symbols', 'dependencies', 'embeddings', 'edges', 'symbols', 'files', 'file_blobs', 'index_jobs', 'commits', 'repositories', 'kysely_migration', 'kysely_migration_lock'];
      for (const table of tables) {
        await db.schema.dropTable(table).ifExists().execute();
      }
    }
    await runMigrations();
  });

  afterAll(async () => {
    await closeDb();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup runScan mock from baseline
    const { runScan } = require('../../src/scanner');
    runScan.mockResolvedValue({
      files: mockFiles,
      edges: [
        { from: 'javascript::src/main.js::global::start', to: 'javascript::src/utils.js::global::helper', type: 'CALLS' }
      ],
      generatedAt: new Date().toISOString()
    });

    // Incorporate filesystem mocks from test branch
    const originalExistsSync = fs.existsSync;
    existsSyncSpy = jest.spyOn(fs, 'existsSync').mockImplementation((path) => {
      if (typeof path === 'string' && path.endsWith('codebase.json')) return true;
      if (typeof path === 'string' && path.endsWith('symbols.bloom')) return false;
      return originalExistsSync(path);
    });
    const originalReadFileSync = fs.readFileSync;
    jest.spyOn(fs, 'readFileSync').mockImplementation((path, options) => {
      if (typeof path === 'string' && path.endsWith('codebase.json')) {
        return JSON.stringify({ generatedAt: '2026-05-10T00:00:00.000Z' });
      }
      return originalReadFileSync(path, options);
    });
    
    server = new CodeGraphXServer();
    
    // Inject mock data
    server.pgStore.getFilesData = jest.fn().mockReturnValue(mockFiles);
    server.pgStore.symbolIndex = new Map();
    mockFiles.forEach(f => {
      f.symbols.forEach(s => server.pgStore.symbolIndex.set(s.id, { file: f.file, symbol: s }));
    });
    
    buildEdges.mockReturnValue([
      { from: 'javascript::src/main.js::global::start', to: 'javascript::src/utils.js::global::helper', type: 'CALLS' }
    ]);
    
    mockSetRequestHandler = server.server.setRequestHandler;
  });

  afterEach(() => {
    existsSyncSpy.mockRestore();
    if (fs.readFileSync.mockRestore) fs.readFileSync.mockRestore();
  });

  test('list_files returns all files with summaries', async () => {
    // Manually set ready state and repoId since we mocked the DB queries
    server.graphReady = true;
    server.repositoryId = 'test-repo';

    const CallToolRequestSchema = require('@modelcontextprotocol/sdk/types.js').CallToolRequestSchema;
    const handler = mockSetRequestHandler.mock.calls.find(call => call[0] === CallToolRequestSchema)[1];
    
    const result = await handler({
      params: {
        name: 'list_files',
        arguments: {}
      }
    });

    // The handler for list_files uses the DB. We need to mock the response or setup the DB.
    // Given the test complexity, let's just setup a repo in the DB.
    await db.insertInto('repositories').values({
        id: 'test-repo',
        name: 'test',
        path: process.cwd(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    }).execute();

    await db.insertInto('commits').values({
        id: 'c1',
        hash: 'h1',
        repository_id: 'test-repo',
        timestamp: new Date().toISOString()
    }).execute();

    await db.insertInto('file_blobs').values({ content_hash: 'h1', storage_type: 'local' }).execute();

    await db.insertInto('files').values({
        id: 'f1',
        repository_id: 'test-repo',
        path: 'src/main.js',
        content_hash: 'h1',
        valid_from_commit_id: 'c1'
    }).execute();

    const result2 = await handler({
      params: {
        name: 'list_files',
        arguments: {}
      }
    });

    const files = JSON.parse(result2.content[0].text);
    expect(files).toHaveLength(1);
    expect(files[0].file).toBe('src/main.js');
  });

  test('list_files applies the filter argument without crashing', async () => {
    server.graphReady = true;
    server.repositoryId = 'test-repo';

    const CallToolRequestSchema = require('@modelcontextprotocol/sdk/types.js').CallToolRequestSchema;
    const handler = mockSetRequestHandler.mock.calls.find(call => call[0] === CallToolRequestSchema)[1];

    const matching = await handler({
      params: { name: 'list_files', arguments: { filter: 'main' } }
    });
    expect(matching.isError).toBeUndefined();
    expect(JSON.parse(matching.content[0].text)).toHaveLength(1);

    const nonMatching = await handler({
      params: { name: 'list_files', arguments: { filter: 'no-such-file' } }
    });
    expect(JSON.parse(nonMatching.content[0].text)).toHaveLength(0);
  });

  test('explain_impact returns impact summary', async () => {
    server.graphReady = true;
    server.repositoryId = 'test-repo';

    // Insert a symbol
    await db.insertInto('symbols').values({
      id: 's1',
      repository_id: 'test-repo',
      file_id: 'f1',
      name: 'mySymbol',
      qualified_name: 'mySymbol',
      kind: 'function',
      symbol_hash: 'hash1',
      valid_from_commit_id: 'c1'
    }).execute();

    const CallToolRequestSchema = require('@modelcontextprotocol/sdk/types.js').CallToolRequestSchema;
    const handler = mockSetRequestHandler.mock.calls.find(call => call[0] === CallToolRequestSchema)[1];
    
    const result = await handler({
      params: {
        name: 'explain_impact',
        arguments: { symbol_name: 'mySymbol' }
      }
    });

    const impact = JSON.parse(result.content[0].text);
    expect(impact.symbol).toBe('mySymbol');
    expect(Array.isArray(impact.used_by_upstream)).toBe(true);
    expect(Array.isArray(impact.breaks_downstream)).toBe(true);
  });

  test('verify_task calls buildTaskVerification', async () => {
    server.graphReady = true;
    server.repositoryId = 'test-repo';

    const { buildTaskVerification } = require('../../src/verifier');
    jest.mock('../../src/verifier', () => ({
      buildTaskVerification: jest.fn().mockResolvedValue({ status: 'complete', changes: [] })
    }), { virtual: true });

    const CallToolRequestSchema = require('@modelcontextprotocol/sdk/types.js').CallToolRequestSchema;
    const handler = mockSetRequestHandler.mock.calls.find(call => call[0] === CallToolRequestSchema)[1];
    
    const result = await handler({
      params: {
        name: 'verify_task',
        arguments: { task_description: 'test task' }
      }
    });

    const verification = JSON.parse(result.content[0].text);
    expect(verification.status).toBe('complete');
  });

  test('check_symbol_exists returns error when bloom is null', async () => {
    await server.initialize();
    server.bloom = null; 
    
    const CallToolRequestSchema = require('@modelcontextprotocol/sdk/types.js').CallToolRequestSchema;
    const handler = mockSetRequestHandler.mock.calls.find(call => call[0] === CallToolRequestSchema)[1];
    
    const result = await handler({
      params: {
        name: 'check_symbol_exists',
        arguments: { name: 'any' }
      }
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Bloom filter not loaded');
  });

  describe('auto-scan on empty graph', () => {
    async function wipeDb() {
      const tables = ['unresolved_symbols', 'dependencies', 'embeddings', 'edges', 'symbols', 'files', 'file_blobs', 'index_jobs', 'commits', 'repositories'];
      for (const table of tables) {
        await db.deleteFrom(table).execute();
      }
    }

    function getHandler() {
      const CallToolRequestSchema = require('@modelcontextprotocol/sdk/types.js').CallToolRequestSchema;
      return mockSetRequestHandler.mock.calls.find(call => call[0] === CallToolRequestSchema)[1];
    }

    beforeEach(async () => {
      await wipeDb();
    });

    afterEach(async () => {
      // Let any in-flight background scan settle so it cannot leak mock
      // calls into the next test.
      if (server._scanPromise) await server._scanPromise.catch(() => {});
    });

    test('initialize triggers a background scan and becomes ready', async () => {
      const { runScan } = require('../../src/scanner');
      runScan.mockImplementation(async () => {
        await db.insertInto('repositories').values({
          id: 'scanned-repo',
          name: 'scanned',
          path: process.cwd(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }).execute();
        return { files: [], edges: [], generatedAt: new Date().toISOString() };
      });

      await server.initialize();
      expect(server.graphReady).toBe(false);

      await server._scanPromise;
      expect(runScan).toHaveBeenCalledTimes(1);
      expect(runScan).toHaveBeenCalledWith(server.projectRoot, server.config, true);
      expect(server.graphReady).toBe(true);
      expect(server.repositoryId).toBe('scanned-repo');
      expect(server.indexing).toBe(false);
      expect(server.indexError).toBeNull();
    });

    test('get_graph_status reports indexing while scan is in progress', async () => {
      const { runScan } = require('../../src/scanner');
      let releaseScan;
      const gate = new Promise((resolve) => { releaseScan = resolve; });
      runScan.mockImplementation(async () => {
        await gate;
        await db.insertInto('repositories').values({
          id: 'scanned-repo',
          name: 'scanned',
          path: process.cwd(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }).execute();
        return { files: [], edges: [], generatedAt: new Date().toISOString() };
      });

      await server.initialize();
      const handler = getHandler();

      const pending = await handler({ params: { name: 'get_graph_status', arguments: {} } });
      expect(JSON.parse(pending.content[0].text).status).toBe('indexing');

      // Other tools report indexing as a non-error transient state
      const blocked = await handler({ params: { name: 'list_files', arguments: {} } });
      expect(blocked.isError).toBe(false);
      expect(JSON.parse(blocked.content[0].text).status).toBe('indexing');

      releaseScan();
      await server._scanPromise;

      const ready = await handler({ params: { name: 'get_graph_status', arguments: {} } });
      expect(JSON.parse(ready.content[0].text).status).toBe('ready');
    });

    test('concurrent scan requests share one scan', async () => {
      const first = server._startBackgroundScan();
      const second = server._startBackgroundScan();
      expect(second).toBe(first);
      await first;
      const { runScan } = require('../../src/scanner');
      expect(runScan).toHaveBeenCalledTimes(1);
    });

    test('scan failure surfaces an error status but keeps the server alive', async () => {
      const { runScan } = require('../../src/scanner');
      runScan.mockRejectedValue(new Error('boom'));

      await server.initialize();
      await server._scanPromise;

      expect(server.graphReady).toBe(false);
      expect(server.indexing).toBe(false);
      expect(server.indexError).toBe('boom');

      const handler = getHandler();
      const status = await handler({ params: { name: 'get_graph_status', arguments: {} } });
      const parsed = JSON.parse(status.content[0].text);
      expect(parsed.status).toBe('error');
      expect(parsed.error).toBe('boom');

      const blocked = await handler({ params: { name: 'list_files', arguments: {} } });
      expect(blocked.isError).toBe(true);
    });
  });
});
