const { spawn } = require('child_process');
const path = require('path');

const MCP_SERVER_PATH = path.join(__dirname, '../bin/cgx-mcp');

let buffer = '';
function sendRequest(mcpProcess, request) {
  return new Promise((resolve, reject) => {
    const requestId = request.id;
    const onData = (data) => {
      buffer += data.toString();
      // MCP Stdio transport usually sends each message as a single line or follows JSON-RPC framing
      // We'll try to find the complete JSON object that matches our ID
      const messages = buffer.split('\n');
      for (let i = 0; i < messages.length; i++) {
        if (!messages[i].trim()) continue;
        try {
          const response = JSON.parse(messages[i]);
          if (response.id === requestId) {
            // Remove the processed messages from buffer
            buffer = messages.slice(i + 1).join('\n');
            mcpProcess.stdout.removeListener('data', onData);
            resolve(response);
            return;
          }
        } catch (e) {
          // Not valid JSON or incomplete, continue
        }
      }
    };
    mcpProcess.stdout.on('data', onData);
    mcpProcess.stdin.write(JSON.stringify(request) + '\n');
    
    // Timeout if no response
    setTimeout(() => {
      mcpProcess.stdout.removeListener('data', onData);
      reject(new Error(`Timeout waiting for response to request ${requestId}`));
    }, 5000);
  });
}

async function verify() {
  console.log('Starting CodeGraphX MCP Server verification...');
  
  // Use node to run the script directly to avoid permission issues with the bin script
  const mcpProcess = spawn('node', [MCP_SERVER_PATH], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, NODE_ENV: 'test' }
  });

  mcpProcess.stderr.on('data', (data) => {
    console.error(`[Server Stderr]: ${data.toString().trim()}`);
  });

  mcpProcess.on('error', (err) => {
    console.error('Failed to start MCP server:', err);
    process.exit(1);
  });

  try {
    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 1. Verify listTools
    console.log('Verifying listTools...');
    const listToolsRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {}
    };
    const toolsResponse = await sendRequest(mcpProcess, listToolsRequest);
    if (toolsResponse.error) {
      throw new Error(`listTools error: ${JSON.stringify(toolsResponse.error)}`);
    }
    
    const tools = toolsResponse.result.tools;
    console.log('Tools received:', tools.map(t => t.name));
    
    const requiredTools = [
      'get_graph_status',
      'list_files',
      'query_symbol',
      'check_symbol_exists',
      'trace_impact',
      'get_session_diff'
    ];
    
    for (const tool of requiredTools) {
      if (!tools.find(t => t.name === tool)) {
        throw new Error(`Missing tool: ${tool}`);
      }
    }
    console.log('✅ All tools verified.');

    // 2. Verify listResources
    console.log('Verifying listResources...');
    const listResourcesRequest = {
      jsonrpc: '2.0',
      id: 2,
      method: 'resources/list',
      params: {}
    };
    const resourcesResponse = await sendRequest(mcpProcess, listResourcesRequest);
    if (resourcesResponse.error) {
      throw new Error(`listResources error: ${JSON.stringify(resourcesResponse.error)}`);
    }
    
    const resources = resourcesResponse.result.resources;
    console.log('Resources received:', resources.map(r => r.uri));

    const requiredResources = [
      'codegraphx://file-index',
      'codegraphx://changelog'
    ];

    for (const res of requiredResources) {
      if (!resources.find(r => r.uri === res)) {
        throw new Error(`Missing resource: ${res}`);
      }
    }
    console.log('✅ All resources verified.');

    // 3. Try calling get_graph_status
    console.log('Verifying call get_graph_status...');
    const callRequest = {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'get_graph_status',
        arguments: {}
      }
    };
    const callResponse = await sendRequest(mcpProcess, callRequest);
    if (callResponse.error) {
      throw new Error(`call get_graph_status error: ${JSON.stringify(callResponse.error)}`);
    }
    console.log('get_graph_status response:', callResponse.result.content[0].text);
    console.log('✅ get_graph_status call verified.');

    console.log('\nVerification SUCCESSFUL!');
    process.exit(0);
  } catch (error) {
    console.error('\nVerification FAILED:', error.message);
    process.exit(1);
  } finally {
    mcpProcess.kill();
  }
}

verify();
