const { spawn } = require('child_process');
const path = require('path');

const MCP_SERVER_PATH = path.join(__dirname, '../bin/cgx-mcp');

let buffer = '';
function sendRequest(mcpProcess, request) {
  return new Promise((resolve, reject) => {
    const requestId = request.id;
    const onData = (data) => {
      buffer += data.toString();

      // MCP Stdio transport uses newline-delimited JSON.
      // We split by newline and process each complete line.
      const lines = buffer.split('\n');
      buffer = lines.pop(); // The last element is either an empty string (if ended with \n) or a partial line.

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const response = JSON.parse(line);
          if (response.id === requestId) {
            mcpProcess.stdout.removeListener('data', onData);
            resolve(response);
            return;
          }
        } catch (e) {}
      }

      // Fallback: If the remaining buffer is a valid JSON object with the right ID,
      // it might be a message that wasn't newline-terminated.
      if (buffer.trim().startsWith('{') && buffer.trim().endsWith('}')) {
        try {
          const response = JSON.parse(buffer);
          if (response.id === requestId) {
            buffer = '';
            mcpProcess.stdout.removeListener('data', onData);
            resolve(response);
            return;
          }
        } catch (e) {}
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
    cwd: path.join(__dirname, '../..'),
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

    // 4. Verify trace_impact
    console.log('Verifying call trace_impact...');
    const traceRequest = {
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: {
        name: 'trace_impact',
        arguments: {
          symbol: 'test.py::my_new_function',
          direction: 'downstream'
        }
      }
    };
    const traceResponse = await sendRequest(mcpProcess, traceRequest);
    if (traceResponse.error) {
      throw new Error(`call trace_impact error: ${JSON.stringify(traceResponse.error)}`);
    }
    const impactData = JSON.parse(traceResponse.result.content[0].text);
    console.log('trace_impact response received.');
    if (impactData.impactGraph.length < 2) {
      throw new Error(`trace_impact failed to find children. Found: ${impactData.impactGraph.length}`);
    }
    console.log('✅ trace_impact call verified.');

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
