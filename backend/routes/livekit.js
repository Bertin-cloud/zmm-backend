const express = require('express');
const { AccessToken, RoomServiceClient } = require('livekit-server-sdk');
const router = express.Router();

// In-memory promotion map: { roomName: { identity: 'cohost' } }
const promotions = {};

// RoomService client for admin actions (kick/mute/etc.)
// Lazy initialization - only create when needed
let roomService = null;

function getRoomService() {
  if (!roomService) {
    if (!process.env.LIVEKIT_URL || !process.env.LIVEKIT_API_KEY || !process.env.LIVEKIT_API_SECRET) {
      console.error('ERROR: LiveKit environment variables not set!');
      console.error('Required: LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET');
      return null;
    }
    roomService = new RoomServiceClient(process.env.LIVEKIT_URL, process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET);
  }
  return roomService;
}

// Generate LiveKit token for any participant
router.post('/token', async (req, res) => {
  try {
    const { roomName, participantName, role } = req.body;
    if (!roomName || !participantName) {
      return res.status(400).json({ error: 'roomName and participantName required' });
    }

    // consult promotions map to persist cohost role across reconnects
    const assignedRole = role || (promotions[roomName] && promotions[roomName][participantName] ? promotions[roomName][participantName] : 'participant');

    const at = new AccessToken(
      process.env.LIVEKIT_API_KEY,
      process.env.LIVEKIT_API_SECRET,
      { identity: participantName }
    );

    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: assignedRole === 'host' || assignedRole === 'cohost',
      canSubscribe: true,
      canPublishData: true,
      roomAdmin: assignedRole === 'host',
    });

    const token = await at.toJwt();
    res.json({ token, url: process.env.LIVEKIT_URL, role: assignedRole });
  } catch (err) {
    console.error('LiveKit token error:', err);
    res.status(500).json({ error: 'Failed to generate token' });
  }
});

// Promote a participant to cohost by minting a cohost token for them and persisting the role
router.post('/promote', async (req, res) => {
  try {
    const { roomName, participantName } = req.body;
    if (!roomName || !participantName) {
      return res.status(400).json({ error: 'roomName and participantName required' });
    }

    // persist promotion
    promotions[roomName] = promotions[roomName] || {};
    promotions[roomName][participantName] = 'cohost';

    const at = new AccessToken(
      process.env.LIVEKIT_API_KEY,
      process.env.LIVEKIT_API_SECRET,
      { identity: participantName }
    );

    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      roomAdmin: false,
    });

    const token = await at.toJwt();
    res.json({ token, identity: participantName });
  } catch (err) {
    console.error('LiveKit promote error:', err);
    res.status(500).json({ error: 'Failed to generate promote token' });
  }
});

// Kick / remove a participant from a room (server-side admin action)
router.post('/kick', async (req, res) => {
  try {
    const { roomName, participantName, revoke } = req.body;
    if (!roomName || !participantName) {
      return res.status(400).json({ error: 'roomName and participantName required' });
    }

    const service = getRoomService();
    if (!service) {
      return res.status(500).json({ error: 'LiveKit service not configured' });
    }

    // revoke=true will revoke tokens immediately by setting revokeTokenTs to current time
    const opts = {};
    if (revoke) opts.revokeTokenTs = Math.floor(Date.now() / 1000);

    await service.removeParticipant(roomName, participantName, opts);

    res.json({ ok: true });
  } catch (err) {
    console.error('LiveKit kick error:', err);
    res.status(500).json({ error: 'Failed to remove participant' });
  }
});

// Mute a participant's published microphone track through the server-side admin API
router.post('/mute', async (req, res) => {
  try {
    const { roomName, participantName, trackSid, muted } = req.body;
    if (!roomName || !participantName || !trackSid) {
      return res.status(400).json({ error: 'roomName, participantName and trackSid required' });
    }

    const service = getRoomService();
    if (!service) {
      return res.status(500).json({ error: 'LiveKit service not configured' });
    }

    await service.mutePublishedTrack(roomName, participantName, trackSid, !!muted);
    res.json({ ok: true });
  } catch (err) {
    console.error('LiveKit mute error:', err);
    res.status(500).json({ error: 'Failed to mute participant' });
  }
});

module.exports = router;
