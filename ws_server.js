const WebSocket = require('ws');

const port = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port });
const rooms = new Map();

function broadcast(roomId, message, sender) {
  const clients = rooms.get(roomId) || [];
  for (const client of clients) {
    if (client !== sender && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  }
}

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://localhost`);
  const roomId = url.searchParams.get('room');
  const token = url.searchParams.get('token');

  if (!roomId || !token) {
    ws.close(1008, 'Missing room or token');
    return;
  }

  const roomClients = rooms.get(roomId) || [];
  roomClients.push(ws);
  rooms.set(roomId, roomClients);

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      if (data.event) {
        broadcast(roomId, data, ws);
      }
    } catch (err) {
      console.error('invalid message', err);
    }
  });

  ws.on('close', () => {
    const clients = rooms.get(roomId) || [];
    rooms.set(roomId, clients.filter((client) => client !== ws));
  });
});

console.log(`WebSocket server listening on ws://localhost:${port}`);
