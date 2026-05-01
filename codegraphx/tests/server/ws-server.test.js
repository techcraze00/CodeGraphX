const WebSocket = require('ws');
const { startServer, broadcast, closeServer } = require('../../src/server/ws-server');

describe('WebSocket Server', () => {
  afterEach(() => {
    if (typeof closeServer === 'function') closeServer();
  });

  test('starts server and broadcasts messages to connected clients', (done) => {
    startServer(6790);

    const client = new WebSocket('ws://localhost:6790');
    
    client.on('open', () => {
      broadcast({ type: 'test', data: 'hello' });
    });

    client.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      expect(msg.type).toBe('test');
      expect(msg.data).toBe('hello');
      client.close();
      done();
    });
  });
});
