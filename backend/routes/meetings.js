const express = require('express');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const {
  createMeeting, getMeetingById, getAllMeetings,
  createAnnouncement, getAnnouncements, deleteMeeting
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

// Join meeting (anyone with ID + password)
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

module.exports = router;
