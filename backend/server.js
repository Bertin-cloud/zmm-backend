require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const meetingRoutes = require('./routes/meetings');
const livekitRoutes = require('./routes/livekit');

const app = express();

app.use(cors());
app.use(express.json());

// --- Real-time layer for the waiting room ---
// Host joins a `host:{meetingId}` socket room to get live "someone wants in"
// notifications. Each guest joins `request:{requestId}` so we can push their
// admit/deny result straight to them instead of making them poll.
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
  }
});

io.on('connection', (socket) => {
  socket.on('host:watch', (meetingId) => {
    if (meetingId) socket.join(`host:${meetingId}`);
  });
  socket.on('guest:watch', (requestId) => {
    if (requestId) socket.join(`request:${requestId}`);
  });
});

app.set('io', io);

app.use('/api/auth', authRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/livekit', livekitRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ZMM Backend Running ✅' }));

// Serve frontend static files
const path = require('path');
const buildPath = path.join(__dirname, '../frontend/build');
const fs = require('fs');

console.log('Serving static files from:', buildPath);
console.log('Build folder exists:', fs.existsSync(buildPath));
console.log('Build folder is directory:', fs.existsSync(buildPath) && fs.statSync(buildPath).isDirectory());

if (fs.existsSync(buildPath)) {
  console.log('Build folder contents:', fs.readdirSync(buildPath));
}

app.use(express.static(buildPath));

// Global error handler for JSON API routes
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  if (req.path.startsWith('/api/')) {
    return res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
  }
  next(err);
});

// Fallback to index.html for React Router (SPA routing)
app.use((req, res) => {
  const indexPath = path.join(buildPath, 'index.html');
  
  if (!fs.existsSync(indexPath)) {
    console.error(`ERROR: index.html not found at ${indexPath}`);
    console.error('Build folder contents:', fs.existsSync(buildPath) ? fs.readdirSync(buildPath) : 'BUILD FOLDER MISSING');
    return res.status(500).send(`
      <h1>Build Error</h1>
      <p>Frontend build files not found!</p>
      <p>Expected path: ${indexPath}</p>
      <p>Build folder exists: ${fs.existsSync(buildPath)}</p>
    `);
  }
  
  console.log('Serving index.html for route:', req.path);
  res.sendFile(indexPath, (err) => {
    if (err) {
      console.error('Error serving index.html:', err);
      res.status(500).send('Server error - could not serve index.html');
    }
  });
});

const PORT = process.env.PORT || 4000;

// Log environment status for debugging
console.log('Environment Check:');
console.log('- PORT:', PORT);
console.log('- LIVEKIT_URL:', process.env.LIVEKIT_URL ? '✓ Set' : '✗ Missing');
console.log('- LIVEKIT_API_KEY:', process.env.LIVEKIT_API_KEY ? '✓ Set' : '✗ Missing');
console.log('- LIVEKIT_API_SECRET:', process.env.LIVEKIT_API_SECRET ? '✓ Set' : '✗ Missing');
console.log('- JWT_SECRET:', process.env.JWT_SECRET ? '✓ Set' : '✗ Missing');

server.listen(PORT, () => {
  console.log(`ZMM Backend running on http://localhost:${PORT}`);
});
