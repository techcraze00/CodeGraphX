const { CodeGraphXServer } = require('../../src/server/mcp-server');
const { GraphStore } = require('../../src/store');
const { buildEdges } = require('../../src/edgebuilder');
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
jest.mock('../../src/utils', () => ({
  loadConfig: jest.fn().mockReturnValue({ outputDir: '.codegraphx', outputFile: 'codebase.json' }),
  ensureDirSync: jest.fn(),
  writeJSONSync: jest.fn(),
  findFiles: jest.fn().mockReturnValue([])
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

  beforeEach(() => {
    jest.clearAllMocks();
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
    
    // Inject mock data into the instance created by the constructor
    server.store.getFilesData.mockReturnValue(mockFiles);
    server.store.symbolIndex.clear();
    mockFiles.forEach(f => {
      f.symbols.forEach(s => server.store.symbolIndex.set(s.id, { file: f.file, symbol: s }));
    });
    
    buildEdges.mockReturnValue([
      { from: 'javascript::src/main.js::global::start', to: 'javascript::src/utils.js::global::helper', type: 'CALLS' }
    ]);
    
    mockSetRequestHandler = server.server.setRequestHandler;
  });

  afterEach(() => {
    existsSyncSpy.mockRestore();
  });

  test('list_files returns all files with summaries', async () => {
    await server.initialize();
    
    // Find the handler for CallToolRequestSchema
    const CallToolRequestSchema = require('@modelcontextprotocol/sdk/types.js').CallToolRequestSchema;
    const handler = mockSetRequestHandler.mock.calls.find(call => call[0] === CallToolRequestSchema)[1];
    
    const result = await handler({
      params: {
        name: 'list_files',
        arguments: {}
      }
    });

    const files = JSON.parse(result.content[0].text);
    expect(files).toHaveLength(2);
    expect(files[0].file).toBe('src/main.js');
    expect(files[0].summary).toBe('start');
  });

  test('list_files with filter', async () => {
    await server.initialize();
    
    const CallToolRequestSchema = require('@modelcontextprotocol/sdk/types.js').CallToolRequestSchema;
    const handler = mockSetRequestHandler.mock.calls.find(call => call[0] === CallToolRequestSchema)[1];
    
    const result = await handler({
      params: {
        name: 'list_files',
        arguments: { filter: 'utils' }
      }
    });

    const files = JSON.parse(result.content[0].text);
    expect(files).toHaveLength(1);
    expect(files[0].file).toBe('src/utils.js');
  });

  test('query_symbol with bare name', async () => {
    await server.initialize();
    
    const CallToolRequestSchema = require('@modelcontextprotocol/sdk/types.js').CallToolRequestSchema;
    const handler = mockSetRequestHandler.mock.calls.find(call => call[0] === CallToolRequestSchema)[1];
    
    const result = await handler({
      params: {
        name: 'query_symbol',
        arguments: { name: 'start' }
      }
    });

    const results = JSON.parse(result.content[0].text);
    expect(results).toHaveLength(1);
    expect(results[0].file).toBe('src/main.js');
    expect(results[0].type).toBe('function');
  });

  test('query_symbol with ID', async () => {
    await server.initialize();
    
    const CallToolRequestSchema = require('@modelcontextprotocol/sdk/types.js').CallToolRequestSchema;
    const handler = mockSetRequestHandler.mock.calls.find(call => call[0] === CallToolRequestSchema)[1];
    
    const result = await handler({
      params: {
        name: 'query_symbol',
        arguments: { name: 'javascript::src/utils.js::global::helper' }
      }
    });

    const results = JSON.parse(result.content[0].text);
    expect(results).toHaveLength(1);
    expect(results[0].file).toBe('src/utils.js');
  });

  test('query_symbol not found', async () => {
    await server.initialize();
    
    const CallToolRequestSchema = require('@modelcontextprotocol/sdk/types.js').CallToolRequestSchema;
    const handler = mockSetRequestHandler.mock.calls.find(call => call[0] === CallToolRequestSchema)[1];
    
    const result = await handler({
      params: {
        name: 'query_symbol',
        arguments: { name: 'nonexistent' }
      }
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('No symbol named "nonexistent" found.');
  });

  test('check_symbol_exists returns error when bloom is null', async () => {
    await server.initialize();
    server.bloom = null; // Force null for this test
    
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

  test('trace_impact downstream', async () => {
    await server.initialize();
    
    const CallToolRequestSchema = require('@modelcontextprotocol/sdk/types.js').CallToolRequestSchema;
    const handler = mockSetRequestHandler.mock.calls.find(call => call[0] === CallToolRequestSchema)[1];
    
    const result = await handler({
      params: {
        name: 'trace_impact',
        arguments: { symbol: 'javascript::src/main.js::global::start', direction: 'downstream' }
      }
    });

    const data = JSON.parse(result.content[0].text);
    expect(data.startSymbol).toBe('javascript::src/main.js::global::start');
    expect(data.impactGraph).toHaveLength(2); // start and helper
    expect(data.impactGraph[0].calls).toContain('javascript::src/utils.js::global::helper');
  });

  test('trace_impact upstream', async () => {
    await server.initialize();
    
    const CallToolRequestSchema = require('@modelcontextprotocol/sdk/types.js').CallToolRequestSchema;
    const handler = mockSetRequestHandler.mock.calls.find(call => call[0] === CallToolRequestSchema)[1];
    
    const result = await handler({
      params: {
        name: 'trace_impact',
        arguments: { symbol: 'javascript::src/utils.js::global::helper', direction: 'upstream' }
      }
    });

    const data = JSON.parse(result.content[0].text);
    expect(data.startSymbol).toBe('javascript::src/utils.js::global::helper');
    expect(data.impactGraph).toHaveLength(2); // helper and start
    expect(data.impactGraph[0].called_by).toContain('javascript::src/main.js::global::start');
  });
});
