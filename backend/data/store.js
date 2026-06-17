// In-memory store — replace with MySQL/SQLite for production
const { v4: uuidv4 } = require('uuid');

const users = [
  { id: '1', username: 'Bertin', password: 'Bertin@1234567890', role: 'admin' }
];

const meetings = [];
const announcements = [];

// Helpers
function findUser(username) {
  return users.find(u => u.username === username);
}

function createMeeting({ title, password, hostId, type = 'main', parentId = null }) {
  const meeting = {
    id: uuidv4(),
    meetingId: Math.random().toString(36).substr(2, 9).toUpperCase(),
    title,
    password,
    hostId,
    type,
    parentId,
    participants: [],
    createdAt: new Date().toISOString()
  };
  meetings.push(meeting);
  return meeting;
}

function getMeetingById(meetingId) {
  return meetings.find(m => m.meetingId === meetingId);
}

function getAllMeetings() {
  return meetings;
}

function createAnnouncement({ title, message, authorId }) {
  const ann = { id: uuidv4(), title, message, authorId, createdAt: new Date().toISOString() };
  announcements.push(ann);
  return ann;
}

function getAnnouncements() {
  return [...announcements].reverse();
}

function deleteMeeting(meetingId) {
  const idx = meetings.findIndex(m => m.meetingId === meetingId);
  if (idx !== -1) meetings.splice(idx, 1);
}

module.exports = {
  findUser, createMeeting, getMeetingById,
  getAllMeetings, createAnnouncement, getAnnouncements, deleteMeeting
};
