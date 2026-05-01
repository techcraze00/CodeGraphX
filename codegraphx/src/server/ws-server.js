const WebSocket = require('ws');

let wss = null;

function startServer(port = 6789) {
  if (wss) return;
  wss = new WebSocket.Server({ port });
}

function broadcast(deltaMsg) {
  if (!wss) return;
  const message = JSON.stringify(deltaMsg);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

function closeServer() {
  if (wss) {
    wss.close();
    wss = null;
  }
}

module.exports = { startServer, broadcast, closeServer };