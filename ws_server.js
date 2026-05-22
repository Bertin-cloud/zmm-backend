const http = require("http");
const WebSocket = require("ws");

// Create HTTP server (REQUIRED for Render)
const server = http.createServer();

// Attach WebSocket server to HTTP server
const wss = new WebSocket.Server({ server });

// Store rooms
const rooms = new Map();

// Broadcast function
function broadcast(roomId, message, sender) {
  const clients = rooms.get(roomId) || [];

  for (const client of clients) {
    if (client !== sender && client.readyState === WebSocket.OPEN) {
      client.send(message.toString());
    }
  }
}

// WebSocket connection
wss.on("connection", (ws, req) => {
  try {
    const url = new URL(req.url, "http://localhost");

    const roomId = url.searchParams.get("room");
    const token = url.searchParams.get("token");

    if (!roomId || !token) {
      ws.close();
      return;
    }

    if (!rooms.has(roomId)) {
      rooms.set(roomId, []);
    }

    rooms.get(roomId).push(ws);

    console.log("Client joined room:", roomId);

    ws.on("message", (message) => {
      broadcast(roomId, message, ws);
    });

    ws.on("close", () => {
      const clients = rooms.get(roomId) || [];
      rooms.set(roomId, clients.filter(c => c !== ws));
    });

  } catch (err) {
    console.error("Connection error:", err);
    ws.close();
  }
});

// IMPORTANT: Render PORT binding
const PORT = process.env.PORT;

// MUST bind to 0.0.0.0 on Render
server.listen(PORT, "0.0.0.0", () => {
  console.log("WebSocket server running on port " + PORT);
});