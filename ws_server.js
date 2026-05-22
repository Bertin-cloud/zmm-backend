const http = require("http");
const WebSocket = require("ws");

// Create HTTP server
const server = http.createServer((req, res) => {
  if (req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("ZMM Backend is running 🚀");
  } else if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
  } else {
    res.writeHead(404);
    res.end("Not Found");
  }
});

// Attach WebSocket server
const wss = new WebSocket.Server({ server });

const rooms = new Map();

function broadcast(roomId, message, sender) {
  const clients = rooms.get(roomId) || [];

  for (const client of clients) {
    if (client !== sender && client.readyState === WebSocket.OPEN) {
      client.send(message.toString());
    }
  }
}

wss.on("connection", (ws, req) => {
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

  ws.on("message", (message) => {
    broadcast(roomId, message, ws);
  });

  ws.on("close", () => {
    const clients = rooms.get(roomId) || [];
    rooms.set(roomId, clients.filter(c => c !== ws));
  });
});

// IMPORTANT RENDER PORT
const PORT = process.env.PORT;

server.listen(PORT, "0.0.0.0", () => {
  console.log("Server running on port " + PORT);
});