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
      client.send(JSON.stringify(message));
    }
  }
}

// WebSocket connection
wss.on("connection", (ws, req) => {
  try {
    const url = new URL(req.url, "http://localhost");

    const roomId = url.searchParams.get("room");
    const token = url.searchParams.get("token");

    // Validate request
    if (!roomId || !token) {
      ws.close(1008, "Missing room or token");
      return;
    }

    // Add client to room
    if (!rooms.has(roomId)) {
      rooms.set(roomId, []);
    }

    rooms.get(roomId).push(ws);

    console.log(`Client joined room: ${roomId}`);

    // Receive messages
    ws.on("message", (message) => {
      try {
        const data = JSON.parse(message.toString());

        if (data.event) {
          broadcast(roomId, data, ws);
        }
      } catch (err) {
        console.error("Invalid message:", err.message);
      }
    });

    // Remove client on disconnect
    ws.on("close", () => {
      const clients = rooms.get(roomId) || [];
      rooms.set(
        roomId,
        clients.filter((client) => client !== ws)
      );

      console.log(`Client left room: ${roomId}`);
    });
  } catch (err) {
    console.error("Connection error:", err.message);
    ws.close();
  }
});

// IMPORTANT: Render uses dynamic port
const PORT = process.env.PORT || 8080;

// Start server
server.listen(PORT, () => {
  console.log(`WebSocket server running on port ${PORT}`);
});