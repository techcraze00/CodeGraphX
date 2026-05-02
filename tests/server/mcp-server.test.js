const { CodeGraphXServer } = require('../../src/server/mcp-server');
const { GraphStore } = require('../../src/store');
const { buildCallEdges } = require('../../src/edgebuilder');
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

jest.mock('../../src/store');
jest.mock('../../src/edgebuilder');
jest.mock('../../src/utils', () => ({
  loadConfig: jest.fn().mockReturnValue({ outputDir: '.codegraphx', outputFile: 'codebase.json' })
}));

describe('CodeGraphXServer', () => {
  let server;
  let mockSetRequestHandler;
  let existsSyncSpy;
  const mockFiles = [
    {
      file: 'src/main.js',
      symbols: [
        { name: 'start', type: 'function', calls: ['helper'] }
      ]
    },
    {
      file: 'src/utils.js',
      symbols: [
        { name: 'helper', type: 'function', called_by: ['src/main.js::start'] }
      ]
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(false);
    GraphStore.prototype.getFilesData.mockReturnValue(mockFiles);
    buildCallEdges.mockReturnValue([
      { from: 'src/main.js::start', to: 'src/utils.js::helper', type: 'CALLS' }
    ]);
    server = new CodeGraphXServer();
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

  test('query_symbol with file::name', async () => {
    await server.initialize();
    
    const CallToolRequestSchema = require('@modelcontextprotocol/sdk/types.js').CallToolRequestSchema;
    const handler = mockSetRequestHandler.mock.calls.find(call => call[0] === CallToolRequestSchema)[1];
    
    const result = await handler({
      params: {
        name: 'query_symbol',
        arguments: { name: 'src/utils.js::helper' }
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

  test('check_symbol_exists returns definite_no when bloom is null', async () => {
    await server.initialize();
    
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
        arguments: { symbol: 'src/main.js::start', direction: 'downstream' }
      }
    });

    const data = JSON.parse(result.content[0].text);
    expect(data.startSymbol).toBe('src/main.js::start');
    expect(data.impactGraph).toHaveLength(2); // start and helper
    expect(data.impactGraph[0].calls).toContain('helper');
  });

  test('trace_impact upstream', async () => {
    await server.initialize();
    
    const CallToolRequestSchema = require('@modelcontextprotocol/sdk/types.js').CallToolRequestSchema;
    const handler = mockSetRequestHandler.mock.calls.find(call => call[0] === CallToolRequestSchema)[1];
    
    const result = await handler({
      params: {
        name: 'trace_impact',
        arguments: { symbol: 'src/utils.js::helper', direction: 'upstream' }
      }
    });

    const data = JSON.parse(result.content[0].text);
    expect(data.startSymbol).toBe('src/utils.js::helper');
    expect(data.impactGraph).toHaveLength(2); // helper and start
    expect(data.impactGraph[0].called_by).toContain('src/main.js::start');
  });
});
