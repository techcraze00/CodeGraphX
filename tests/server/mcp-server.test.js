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
});
