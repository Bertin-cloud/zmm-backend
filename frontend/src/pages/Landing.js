import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';
import { api } from '../utils/api';
import './Landing.css';

export default function Landing({ onJoinRoom }) {
  const { login } = useAuth();
  const { t, lang, changeLang } = useLang();
  const [tab, setTab] = useState('join'); // 'join' | 'admin'
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); setError(''); }

  async function handleAdminLogin(e) {
    e.preventDefault(); setLoading(true); setError('');
    try {
      const { token, user } = await api.login(form.username, form.password);
      login(token, user);
    } catch (err) { setError(err.message); }
    setLoading(false);
  }

  async function handleJoin(e) {
    e.preventDefault(); setLoading(true); setError('');
    try {
      const meeting = await api.joinMeeting(form.meetingId?.toUpperCase(), form.password);
      const guestRole = form.role || 'participant';
      const name = form.displayName || 'Guest';
      const lkData = await api.getLiveKitToken(meeting.meetingId, name, guestRole);
      onJoinRoom({ ...meeting, displayName: name, role: guestRole, lkToken: lkData.token, lkUrl: lkData.url });
    } catch (err) { setError(err.message); }
    setLoading(false);
  }

  return (
    <div className="landing">
      <div className="landing-bg">
        <div className="bg-blob b1" /><div className="bg-blob b2" /><div className="bg-blob b3" />
      </div>

      <div className="landing-header">
        <div className="landing-logo">
          <span className="logo-hex">⬡</span>
          <h1>ZMM</h1>
        </div>
        <p>Zoom Meeting Model</p>
        <div className="lang-pills">
          {['en','fr','rw'].map(l => (
            <button key={l} className={`lang-pill ${lang===l?'active':''}`} onClick={() => changeLang(l)}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="landing-card">
        <div className="tab-bar">
          <button className={`tab ${tab==='join'?'active':''}`} onClick={() => setTab('join')}>
            🎥 {t('joinMeeting')}
          </button>
          <button className={`tab ${tab==='admin'?'active':''}`} onClick={() => setTab('admin')}>
            🔐 {t('login')}
          </button>
        </div>

        {error && <div className="error-banner">⚠ {error}</div>}

        {tab === 'join' ? (
          <form onSubmit={handleJoin} className="landing-form">
            <div className="form-group">
              <label>{t('meetingId')}</label>
              <input placeholder={t('enterMeetingId')} value={form.meetingId||''} onChange={e => set('meetingId', e.target.value)} required />
            </div>
            <div className="form-group">
              <label>{t('password')}</label>
              <input type="password" placeholder={t('enterPassword')} value={form.password||''} onChange={e => set('password', e.target.value)} required />
            </div>
            <div className="form-group">
              <label>{t('displayName')}</label>
              <input placeholder={t('enterName')} value={form.displayName||''} onChange={e => set('displayName', e.target.value)} required />
            </div>
            <div className="form-group">
              <label>{t('host')} / {t('participant')}</label>
              <select value={form.role||'participant'} onChange={e => set('role', e.target.value)}>
                <option value="participant">{t('participant')}</option>
                <option value="host">{t('host')}</option>
                <option value="cohost">{t('cohost')}</option>
              </select>
            </div>
            <button className="btn btn-primary btn-lg" type="submit" disabled={loading} style={{width:'100%'}}>
              {loading ? '...' : `🚀 ${t('join')}`}
            </button>
          </form>
        ) : (
          <form onSubmit={handleAdminLogin} className="landing-form">
            <div className="form-group">
              <label>{t('username')}</label>
              <input placeholder="Bertin" value={form.username||''} onChange={e => set('username', e.target.value)} required />
            </div>
            <div className="form-group">
              <label>{t('password')}</label>
              <input type="password" placeholder="••••••••••" value={form.password||''} onChange={e => set('password', e.target.value)} required />
            </div>
            <button className="btn btn-primary btn-lg" type="submit" disabled={loading} style={{width:'100%'}}>
              {loading ? '...' : `🔑 ${t('login')}`}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
