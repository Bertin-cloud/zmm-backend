import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';
import { api } from '../utils/api';
import './Dashboard.css';

export default function Dashboard({ onJoinRoom }) {
  const { token, user, isAdmin } = useAuth();
  const { t } = useLang();
  const [meetings, setMeetings] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [joinForm, setJoinForm] = useState({ meetingId: '', password: '', displayName: user?.username || '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.getAnnouncements().then(setAnnouncements).catch(() => {});
    if (isAdmin) api.getMeetings(token).then(setMeetings).catch(() => {});
  }, [token, isAdmin]);

  async function handleJoin(e) {
    e.preventDefault(); setLoading(true); setError('');
    try {
      const meeting = await api.joinMeeting(joinForm.meetingId.toUpperCase(), joinForm.password);
      const lkData = await api.getLiveKitToken(meeting.meetingId, joinForm.displayName, 'host');
      onJoinRoom({ ...meeting, displayName: joinForm.displayName, role: 'host', lkToken: lkData.token, lkUrl: lkData.url });
    } catch (err) { setError(err.message); }
    setLoading(false);
  }

  async function quickJoin(meeting) {
    try {
      const lkData = await api.getLiveKitToken(meeting.meetingId, user.username, 'host');
      onJoinRoom({ ...meeting, displayName: user.username, role: 'host', lkToken: lkData.token, lkUrl: lkData.url });
    } catch (err) { alert(err.message); }
  }

  return (
    <div className="dashboard">
      <div className="dash-left">
        <div className="dash-join card">
          <h3>🎥 {t('joinMeeting')}</h3>
          {error && <div className="error-banner" style={{marginBottom:12}}>⚠ {error}</div>}
          <form onSubmit={handleJoin} className="join-form">
            <div className="form-group"><label>{t('meetingId')}</label>
              <input placeholder="ABC123XY" value={joinForm.meetingId} onChange={e => setJoinForm(f=>({...f,meetingId:e.target.value}))} required />
            </div>
            <div className="form-group"><label>{t('password')}</label>
              <input type="password" placeholder="••••••" value={joinForm.password} onChange={e => setJoinForm(f=>({...f,password:e.target.value}))} required />
            </div>
            <div className="form-group"><label>{t('displayName')}</label>
              <input placeholder="Your name" value={joinForm.displayName} onChange={e => setJoinForm(f=>({...f,displayName:e.target.value}))} required />
            </div>
            <button className="btn btn-primary" type="submit" disabled={loading} style={{width:'100%'}}>
              {loading ? '...' : `▶ ${t('join')}`}
            </button>
          </form>
        </div>

        {isAdmin && meetings.length > 0 && (
          <div className="card" style={{marginTop:16}}>
            <h3 style={{marginBottom:14}}>⚡ Quick Join</h3>
            <div className="quick-meetings">
              {meetings.slice(0,5).map(m => (
                <div key={m.id} className="quick-item" onClick={() => quickJoin(m)}>
                  <div>
                    <div className="quick-title">{m.title}</div>
                    <div className="quick-id">{m.meetingId}</div>
                  </div>
                  <span className={`badge badge-${m.type==='main'?'blue':'yellow'}`}>
                    {m.type === 'main' ? t('main') : t('breakout')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="dash-right">
        <div className="card">
          <h3 style={{marginBottom:16}}>📢 {t('announcements')}</h3>
          {announcements.length === 0 ? (
            <p className="empty-text">{t('noAnnouncements')}</p>
          ) : announcements.slice(0,5).map(a => (
            <div key={a.id} className="ann-item">
              <div className="ann-item-title">{a.title}</div>
              <div className="ann-item-body">{a.message}</div>
              <div className="ann-item-date">{new Date(a.createdAt).toLocaleString()}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
