import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';
import { api } from '../utils/api';
import './Admin.css';

export default function Admin({ onJoinRoom }) {
  const { token, user } = useAuth();
  const { t } = useLang();
  const [meetings, setMeetings] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [tab, setTab] = useState('meetings');
  const [showCreate, setShowCreate] = useState(false);
  const [showAnn, setShowAnn] = useState(false);
  const [form, setForm] = useState({});
  const [annForm, setAnnForm] = useState({});
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [m, a] = await Promise.all([api.getMeetings(token), api.getAnnouncements()]);
      setMeetings(m); setAnnouncements(a);
    } catch {}
  }, [token]);

  useEffect(() => { loadData(); }, [loadData]);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3000); }

  async function createMeeting(e) {
    e.preventDefault(); setLoading(true);
    try {
      await api.createMeeting({ title: form.title, password: form.password, type: form.type || 'main' }, token);
      setShowCreate(false); setForm({}); loadData();
    } catch (err) { alert(err.message); }
    setLoading(false);
  }

  async function deleteMeeting(meetingId) {
    if (!window.confirm('Delete this meeting?')) return;
    await api.deleteMeeting(meetingId, token);
    loadData();
  }

  async function postAnnouncement(e) {
    e.preventDefault(); setLoading(true);
    try {
      await api.postAnnouncement({ title: annForm.title, message: annForm.message }, token);
      setShowAnn(false); setAnnForm({}); loadData();
    } catch (err) { alert(err.message); }
    setLoading(false);
  }

  function copyLink(meetingId) {
    navigator.clipboard.writeText(`${window.location.origin}/?join=${meetingId}`);
    showToast(t('linkCopied'));
  }

  async function hostJoin(meeting) {
    try {
      const lkData = await api.getLiveKitToken(meeting.meetingId, user.username, 'host');
      onJoinRoom({ ...meeting, displayName: user.username, role: 'host', lkToken: lkData.token, lkUrl: lkData.url });
    } catch (err) { alert(err.message); }
  }

  return (
    <div className="admin">
      {toast && <div className="toast">{toast}</div>}

      <div className="admin-header">
        <div>
          <h2>{t('adminPanel')}</h2>
          <p className="sub">{t('welcome')}, {user?.username}</p>
        </div>
        <div className="header-actions">
          {tab === 'meetings' && (
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
              + {t('createMeeting')}
            </button>
          )}
          {tab === 'announcements' && (
            <button className="btn btn-primary" onClick={() => setShowAnn(true)}>
              + {t('newAnnouncement')}
            </button>
          )}
        </div>
      </div>

      <div className="admin-tabs">
        <button className={`tab ${tab==='meetings'?'active':''}`} onClick={() => setTab('meetings')}>
          🎥 {t('meetings')} <span className="count">{meetings.length}</span>
        </button>
        <button className={`tab ${tab==='announcements'?'active':''}`} onClick={() => setTab('announcements')}>
          📢 {t('announcements')} <span className="count">{announcements.length}</span>
        </button>
      </div>

      {tab === 'meetings' && (
        <div className="admin-content">
          {meetings.length === 0 ? (
            <div className="empty">{t('noMeetings')}</div>
          ) : meetings.map(m => (
            <div key={m.id} className="meeting-card">
              <div className="meeting-info">
                <div className="meeting-title">{m.title}</div>
                <div className="meeting-meta">
                  <span className="meeting-id">ID: <strong>{m.meetingId}</strong></span>
                  <span className={`badge badge-${m.type==='main'?'blue':'yellow'}`}>
                    {m.type === 'main' ? t('main') : t('breakout')}
                  </span>
                </div>
              </div>
              <div className="meeting-actions">
                <button className="btn btn-success btn-sm" onClick={() => hostJoin(m)}>▶ {t('host')}</button>
                <button className="btn btn-ghost btn-sm" onClick={() => copyLink(m.meetingId)}>🔗 {t('copyLink')}</button>
                <button className="btn btn-danger btn-sm" onClick={() => deleteMeeting(m.meetingId)}>🗑 {t('delete')}</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'announcements' && (
        <div className="admin-content">
          {announcements.length === 0 ? (
            <div className="empty">{t('noAnnouncements')}</div>
          ) : announcements.map(a => (
            <div key={a.id} className="ann-card">
              <div className="ann-title">{a.title}</div>
              <div className="ann-body">{a.message}</div>
              <div className="ann-date">{new Date(a.createdAt).toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}

      {/* Create Meeting Modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>+ {t('createMeeting')}</h3>
            <form onSubmit={createMeeting} className="modal-form">
              <div className="form-group"><label>{t('meetingTitle')}</label>
                <input placeholder="Team Standup..." value={form.title||''} onChange={e => setForm(f=>({...f,title:e.target.value}))} required />
              </div>
              <div className="form-group"><label>{t('password')}</label>
                <input type="password" placeholder="Secret key..." value={form.password||''} onChange={e => setForm(f=>({...f,password:e.target.value}))} required />
              </div>
              <div className="form-group"><label>{t('type')}</label>
                <select value={form.type||'main'} onChange={e => setForm(f=>({...f,type:e.target.value}))}>
                  <option value="main">{t('main')}</option>
                  <option value="breakout">{t('breakout')}</option>
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>{t('create')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Post Announcement Modal */}
      {showAnn && (
        <div className="modal-overlay" onClick={() => setShowAnn(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>📢 {t('newAnnouncement')}</h3>
            <form onSubmit={postAnnouncement} className="modal-form">
              <div className="form-group"><label>{t('title')}</label>
                <input placeholder="Important update..." value={annForm.title||''} onChange={e => setAnnForm(f=>({...f,title:e.target.value}))} required />
              </div>
              <div className="form-group"><label>{t('message')}</label>
                <textarea rows="4" placeholder="Your message..." value={annForm.message||''} onChange={e => setAnnForm(f=>({...f,message:e.target.value}))} required />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setShowAnn(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>{t('post')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
