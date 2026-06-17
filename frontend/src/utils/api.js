const BASE = process.env.REACT_APP_API_URL || 'http://localhost:4000/api';

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

  getLiveKitToken: (roomName, participantName, role) =>
    apiFetch('/livekit/token', {
      method: 'POST',
      body: JSON.stringify({ roomName, participantName, role })
    }),
};
