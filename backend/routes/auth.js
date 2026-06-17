const express = require('express');
const jwt = require('jsonwebtoken');
const { findUser } = require('../data/store');
const router = express.Router();

// Admin login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = findUser(username);
  if (!user || user.password !== password) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );
  res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
});

// Guest join — generate a short-lived token for a meeting
router.post('/guest', (req, res) => {
  const { displayName, meetingId } = req.body;
  if (!displayName || !meetingId) return res.status(400).json({ error: 'displayName and meetingId required' });
  const token = jwt.sign(
    { id: `guest_${Date.now()}`, username: displayName, role: 'participant', meetingId },
    process.env.JWT_SECRET,
    { expiresIn: '6h' }
  );
  res.json({ token, user: { username: displayName, role: 'participant' } });
});

module.exports = router;
