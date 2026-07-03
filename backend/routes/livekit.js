const express = require('express');
const { AccessToken, RoomServiceClient } = require('livekit-server-sdk');
const { authMiddleware, adminOnly, optionalAuth } = require('../middleware/auth');
const router = express.Router();

// In-memory promotion map: { roomName: { identity: 'cohost' } }
const promotions = {};

// RoomService client for admin actions (kick/mute/etc.)
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

// Only the platform admin (there's one: the meeting owner) is allowed to hold
// host/cohost power. Everyone else — no matter what role they ask for in the
// request body — is forced down to 'participant'. This is what actually
// determines LiveKit permissions, so it can't be spoofed from the browser.
function resolveRole(req, roomName, participantName, requestedRole) {
  const isRealAdmin = req.user?.role === 'admin';

  if (isRealAdmin) {
    // The admin can join as host, or explicitly grant themself cohost.
    return requestedRole === 'cohost' ? 'cohost' : 'host';
  }

  // Non-admins can only ever be 'participant', unless a host has explicitly
  // promoted this exact identity to cohost via /promote (persisted below).
  if (promotions[roomName] && promotions[roomName][participantName] === 'cohost') {
    return 'cohost';
  }
  return 'participant';
}

// Generate LiveKit token for any participant.
// optionalAuth: if the caller has a valid admin JWT, they can become host.
// Everyone else is forced to 'participant' regardless of what they send.
router.post('/token', optionalAuth, async (req, res) => {
  try {
    const { roomName, participantName, role } = req.body;
    if (!roomName || !participantName) {
      return res.status(400).json({ error: 'roomName and participantName required' });
    }

    const assignedRole = resolveRole(req, roomName, participantName, role);

    const at = new AccessToken(
      process.env.LIVEKIT_API_KEY,
      process.env.LIVEKIT_API_SECRET,
      { identity: participantName }
    );

    at.addGrant({
      roomJoin: true,
      room: roomName,
      // Everyone can publish audio/video — this was the bug that broke
      // participant mic/camera. Only moderation power (roomAdmin) stays host-only.
      canPublish: true,
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

// Promote a participant to cohost — host/admin only.
router.post('/promote', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { roomName, participantName } = req.body;
    if (!roomName || !participantName) {
      return res.status(400).json({ error: 'roomName and participantName required' });
    }

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

// Kick / remove a participant — host/admin only. Previously had NO auth check
// at all, which is how any participant could remove the host.
router.post('/kick', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { roomName, participantName, revoke } = req.body;
    if (!roomName || !participantName) {
      return res.status(400).json({ error: 'roomName and participantName required' });
    }

    const service = getRoomService();
    if (!service) {
      return res.status(500).json({ error: 'LiveKit service not configured' });
    }

    const opts = {};
    if (revoke) opts.revokeTokenTs = Math.floor(Date.now() / 1000);

    await service.removeParticipant(roomName, participantName, opts);

    res.json({ ok: true });
  } catch (err) {
    console.error('LiveKit kick error:', err);
    res.status(500).json({ error: 'Failed to remove participant' });
  }
});

// Mute a participant's mic — host/admin only. Same missing-auth bug as /kick.
router.post('/mute', authMiddleware, adminOnly, async (req, res) => {
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
