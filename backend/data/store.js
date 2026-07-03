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
    waitingRoom: [], // pending join requests: { requestId, displayName, requestedAt }
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

// --- Waiting room ---

function addWaitingRequest(meetingId, displayName) {
  const meeting = getMeetingById(meetingId);
  if (!meeting) return null;
  const request = { requestId: uuidv4(), displayName, requestedAt: new Date().toISOString() };
  meeting.waitingRoom.push(request);
  return request;
}

function getWaitingRoom(meetingId) {
  const meeting = getMeetingById(meetingId);
  return meeting ? meeting.waitingRoom : [];
}

function findWaitingRequest(meetingId, requestId) {
  const meeting = getMeetingById(meetingId);
  if (!meeting) return null;
  return meeting.waitingRoom.find(r => r.requestId === requestId) || null;
}

function removeWaitingRequest(meetingId, requestId) {
  const meeting = getMeetingById(meetingId);
  if (!meeting) return;
  meeting.waitingRoom = meeting.waitingRoom.filter(r => r.requestId !== requestId);
}

module.exports = {
  findUser, createMeeting, getMeetingById,
  getAllMeetings, createAnnouncement, getAnnouncements, deleteMeeting,
  addWaitingRequest, getWaitingRoom, findWaitingRequest, removeWaitingRequest
};
