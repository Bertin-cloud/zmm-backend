import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';
import { api } from '../utils/api';
import WaitingRoom from '../components/WaitingRoom';
import './Landing.css';

export default function Landing({ onJoinRoom }) {
  const { login } = useAuth();
  const { t, lang, changeLang } = useLang();
  const [tab, setTab] = useState('join'); // 'join' | 'admin'
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Once the guest has requested to join, we hold their pending request here
  // and render the WaitingRoom screen instead of the form.
  const [pendingRequest, setPendingRequest] = useState(null);

  // If someone opened a shared meeting link (?join=MEETINGID), prefill the
  // meeting ID so they just need to add their name and the password.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const joinId = params.get('join');
    if (joinId) {
      setForm(f => ({ ...f, meetingId: joinId.toUpperCase() }));
    }
  }, []);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); setError(''); }

  async function handleAdminLogin(e) {
    e.preventDefault(); setLoading(true); setError('');
    try {
      const { token, user } = await api.login(form.username, form.password);
      login(token, user);
    } catch (err) { setError(err.message); }
    setLoading(false);
  }

  // Guests never choose a role and never get a token directly — they request
  // to join, land in the waiting room, and only get a token once the host
  // admits them (handled inside WaitingRoom via socket.io).
  async function handleJoin(e) {
    e.preventDefault(); setLoading(true); setError('');
    try {
      const name = form.displayName || 'Guest';
      const result = await api.requestJoin(form.meetingId?.toUpperCase(), form.password, name);
      setPendingRequest({ ...result, displayName: name });
    } catch (err) { setError(err.message); }
    setLoading(false);
  }

  if (pendingRequest) {
    return (
      <WaitingRoom
        request={pendingRequest}
        onAdmitted={(roomData) => onJoinRoom(roomData)}
        onCancel={() => setPendingRequest(null)}
      />
    );
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
            <p className="join-hint">{t('waitingRoomHint')}</p>
            <button className="btn btn-primary btn-lg" type="submit" disabled={loading} style={{width:'100%'}}>
              {loading ? '...' : `🚀 ${t('askToJoin')}`}
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
