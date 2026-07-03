const express = require('express');
const { AccessToken } = require('livekit-server-sdk');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const {
  createMeeting, getMeetingById, getAllMeetings,
  createAnnouncement, getAnnouncements, deleteMeeting,
  addWaitingRequest, getWaitingRoom, findWaitingRequest, removeWaitingRequest
} = require('../data/store');
const router = express.Router();

// Get all meetings (admin)
router.get('/', authMiddleware, adminOnly, (req, res) => {
  res.json(getAllMeetings());
});

// Create meeting (admin)
router.post('/', authMiddleware, adminOnly, (req, res) => {
  const { title, password, type, parentId } = req.body;
  if (!title || !password) return res.status(400).json({ error: 'title and password required' });
  const meeting = createMeeting({ title, password, hostId: req.user.id, type, parentId });
  res.json(meeting);
});

// Join meeting (host / admin path — password check only, role is decided
// separately and locked down in /api/livekit/token)
router.post('/join', (req, res) => {
  const { meetingId, password } = req.body;
  const meeting = getMeetingById(meetingId);
  if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
  if (meeting.password !== password) return res.status(401).json({ error: 'Wrong password' });
  res.json({ meetingId: meeting.meetingId, title: meeting.title, type: meeting.type });
});

// Delete meeting (admin)
router.delete('/:meetingId', authMiddleware, adminOnly, (req, res) => {
  deleteMeeting(req.params.meetingId);
  res.json({ success: true });
});

// Announcements
router.get('/announcements', (req, res) => {
  res.json(getAnnouncements());
});

router.post('/announcements', authMiddleware, adminOnly, (req, res) => {
  const { title, message } = req.body;
  if (!title || !message) return res.status(400).json({ error: 'title and message required' });
  const ann = createAnnouncement({ title, message, authorId: req.user.id });
  res.json(ann);
});

// ===========================================================================
// Waiting room
// Guests never get a LiveKit token directly. They request to join, sit in a
// waiting room, and only get in once the host admits them.
// ===========================================================================

// Guest asks to join — checks the password, drops them in the waiting room,
// and notifies the host in real time over socket.io.
router.post('/:meetingId/waiting-room', (req, res) => {
  const { meetingId } = req.params;
  const { password, displayName } = req.body;
  if (!displayName) return res.status(400).json({ error: 'displayName required' });

  const meeting = getMeetingById(meetingId);
  if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
  if (meeting.password !== password) return res.status(401).json({ error: 'Wrong password' });

  const request = addWaitingRequest(meetingId, displayName);

  const io = req.app.get('io');
  if (io) {
    io.to(`host:${meetingId}`).emit('waiting-room:new-request', {
      meetingId,
      requestId: request.requestId,
      displayName: request.displayName,
      requestedAt: request.requestedAt,
    });
  }

  res.json({ requestId: request.requestId, meetingId, title: meeting.title });
});

// Host views current waiting list (also pushed live via socket, this covers
// the initial load / refresh case).
router.get('/:meetingId/waiting-room', authMiddleware, adminOnly, (req, res) => {
  res.json(getWaitingRoom(req.params.meetingId));
});

// Host admits a waiting guest — mints their LiveKit token and pushes it
// straight to that guest's browser over socket.io.
router.post('/:meetingId/waiting-room/:requestId/admit', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { meetingId, requestId } = req.params;
    const meeting = getMeetingById(meetingId);
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });

    const request = findWaitingRequest(meetingId, requestId);
    if (!request) return res.status(404).json({ error: 'Request not found or already handled' });

    const at = new AccessToken(
      process.env.LIVEKIT_API_KEY,
      process.env.LIVEKIT_API_SECRET,
      { identity: request.displayName }
    );
    at.addGrant({
      roomJoin: true,
      room: meetingId,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      roomAdmin: false,
    });
    const token = await at.toJwt();

    removeWaitingRequest(meetingId, requestId);

    const io = req.app.get('io');
    if (io) {
      io.to(`request:${requestId}`).emit('waiting-room:admitted', {
        requestId,
        meetingId,
        title: meeting.title,
        type: meeting.type,
        displayName: request.displayName,
        lkToken: token,
        lkUrl: process.env.LIVEKIT_URL,
      });
      io.to(`host:${meetingId}`).emit('waiting-room:resolved', { requestId });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('Admit error:', err);
    res.status(500).json({ error: 'Failed to admit guest' });
  }
});

// Host denies a waiting guest.
router.post('/:meetingId/waiting-room/:requestId/deny', authMiddleware, adminOnly, (req, res) => {
  const { meetingId, requestId } = req.params;
  const request = findWaitingRequest(meetingId, requestId);
  if (!request) return res.status(404).json({ error: 'Request not found or already handled' });

  removeWaitingRequest(meetingId, requestId);

  const io = req.app.get('io');
  if (io) {
    io.to(`request:${requestId}`).emit('waiting-room:denied', { requestId });
    io.to(`host:${meetingId}`).emit('waiting-room:resolved', { requestId });
  }

  res.json({ ok: true });
});

module.exports = router;
