import { io } from 'socket.io-client';

export const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:4000/api';
const BASE = API_BASE;
const SOCKET_URL = BASE.replace(/\/api\/?$/, '');

let socket = null;
// Singleton socket connection — created lazily on first use so pages that
// never touch the waiting room don't open a connection for nothing.
export function getSocket() {
  if (!socket) {
    socket = io(SOCKET_URL, { autoConnect: true, transports: ['websocket', 'polling'] });
  }
  return socket;
}

async function apiFetch(path, options = {}, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { ...options, headers: { ...headers, ...options.headers } });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const api = {
  login: (username, password) =>
    apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),

  guestToken: (displayName, meetingId) =>
    apiFetch('/auth/guest', { method: 'POST', body: JSON.stringify({ displayName, meetingId }) }),

  getMeetings: (token) => apiFetch('/meetings', {}, token),

  createMeeting: (data, token) =>
    apiFetch('/meetings', { method: 'POST', body: JSON.stringify(data) }, token),

  joinMeeting: (meetingId, password) =>
    apiFetch('/meetings/join', { method: 'POST', body: JSON.stringify({ meetingId, password }) }),

  deleteMeeting: (meetingId, token) =>
    apiFetch(`/meetings/${meetingId}`, { method: 'DELETE' }, token),

  getAnnouncements: () => apiFetch('/meetings/announcements'),

  postAnnouncement: (data, token) =>
    apiFetch('/meetings/announcements', { method: 'POST', body: JSON.stringify(data) }, token),

  getLiveKitToken: (roomName, participantName, role, token) =>
    apiFetch('/livekit/token', {
      method: 'POST',
      body: JSON.stringify({ roomName, participantName, role })
    }, token),

  // --- Waiting room ---

  requestJoin: (meetingId, password, displayName) =>
    apiFetch(`/meetings/${meetingId}/waiting-room`, {
      method: 'POST',
      body: JSON.stringify({ password, displayName })
    }),

  getWaitingRoom: (meetingId, token) =>
    apiFetch(`/meetings/${meetingId}/waiting-room`, {}, token),

  admitGuest: (meetingId, requestId, token) =>
    apiFetch(`/meetings/${meetingId}/waiting-room/${requestId}/admit`, { method: 'POST' }, token),

  denyGuest: (meetingId, requestId, token) =>
    apiFetch(`/meetings/${meetingId}/waiting-room/${requestId}/deny`, { method: 'POST' }, token),
};
