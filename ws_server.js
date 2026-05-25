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
  const clients = rooms.get(roomId);
  if (!clients) return;

  for (const client of clients) {
    if (client !== sender && client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

function cleanupRoom(roomId) {
  const clients = rooms.get(roomId);
  if (!clients || clients.size === 0) {
    rooms.delete(roomId);
  }
}

wss.on("connection", (ws, req) => {
  const url = new URL(req.url, "http://localhost");
  const roomId = url.searchParams.get("room");
  const token = url.searchParams.get("token");

  if (!roomId || !token) {
    ws.close(1008, "Missing room or token");
    return;
  }

  ws.isAlive = true;
  ws.roomId = roomId;

  ws.on("pong", () => {
    ws.isAlive = true;
  });

  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Set());
  }

  rooms.get(roomId).add(ws);

  ws.on("message", (message) => {
    let payload = message;

    if (Buffer.isBuffer(message)) {
      payload = message.toString();
    }

    if (typeof payload === "string") {
      try {
        const parsed = JSON.parse(payload);
        broadcast(roomId, JSON.stringify(parsed), ws);
      } catch (error) {
        broadcast(roomId, payload, ws);
      }
    }
  });

  ws.on("close", () => {
    const clients = rooms.get(roomId);
    if (clients) {
      clients.delete(ws);
      cleanupRoom(roomId);
    }
  });

  ws.on("error", (error) => {
    console.warn(`WebSocket error in room ${roomId}:`, error);
  });
});

const healthInterval = setInterval(() => {
  wss.clients.forEach((client) => {
    if (client.isAlive === false) {
      client.terminate();
      return;
    }

    client.isAlive = false;
    client.ping();
  });
}, 30000);

wss.on("close", () => {
  clearInterval(healthInterval);
});

const PORT = process.env.PORT || 8080;
const HOST = process.env.HOST || "0.0.0.0";

server.listen(PORT, HOST, () => {
  console.log(`Server running on ${HOST}:${PORT}`);
});