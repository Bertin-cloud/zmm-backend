import React, { useState, useEffect } from 'react';
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
  useParticipants,
  useLocalParticipant,
  useTrackToggle,
  useDataChannel,
} from '@livekit/components-react';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';
import { api, getSocket, API_BASE } from '../utils/api';
import Chat from '../components/Chat';
import './Room.css';

function ParticipantList({ onAction, raiseHands, isModerator }) {
  const { t } = useLang();
  const participants = useParticipants();
  return (
    <div className="sidebar-section">
      <div className="sidebar-title">👥 {t('participants')} ({participants.length})</div>
      <div className="participant-list">
        {participants.map(p => (
          <div key={p.identity} className="participant-item">
            <div className="p-avatar">{p.identity[0]?.toUpperCase()}</div>
            <div style={{ flex: 1 }}>
              <div className="p-name">{p.identity} {raiseHands[p.identity] ? '✋' : ''}</div>
              <div className="p-status">
                <span>{p.isMicrophoneEnabled ? '🎤' : '🔇'}</span>
                <span>{p.isCameraEnabled ? '📷' : '🚫'}</span>
              </div>
            </div>
            <div className="p-actions">
              {isModerator && raiseHands[p.identity] && (
                <button className="btn btn-ghost btn-xs" onClick={() => onAction('lower', p.identity)}>👇</button>
              )}
              {isModerator && <button className="btn btn-ghost btn-xs" onClick={() => onAction('mute', p.identity)}>🔇</button>}
              {isModerator && <button className="btn btn-ghost btn-xs" onClick={() => onAction('remove', p.identity)}>❌</button>}
              {isModerator && <button className="btn btn-ghost btn-xs" onClick={() => onAction('promote', p.identity)}>⭐</button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Host-only panel: shows people waiting to be let in, live, via socket.io.
// Only rendered when isModerator is true, and every admit/deny call is sent
// with the host's admin JWT so the backend can verify it's really them.
function WaitingRoomPanel({ meetingId, isModerator }) {
  const { t } = useLang();
  const { token } = useAuth();
  const [pending, setPending] = useState([]);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    if (!isModerator || !token) return;
    const socket = getSocket();
    socket.emit('host:watch', meetingId);

    api.getWaitingRoom(meetingId, token).then(setPending).catch(() => {});

    function onNewRequest(req) {
      if (req.meetingId !== meetingId) return;
      setPending(prev => (prev.some(r => r.requestId === req.requestId) ? prev : [...prev, req]));
    }
    function onResolved({ requestId }) {
      setPending(prev => prev.filter(r => r.requestId !== requestId));
    }

    socket.on('waiting-room:new-request', onNewRequest);
    socket.on('waiting-room:resolved', onResolved);
    return () => {
      socket.off('waiting-room:new-request', onNewRequest);
      socket.off('waiting-room:resolved', onResolved);
    };
  }, [meetingId, isModerator, token]);

  if (!isModerator) return null;

  async function admit(requestId) {
    setBusyId(requestId);
    try {
      await api.admitGuest(meetingId, requestId, token);
    } catch (err) {
      console.warn('Admit failed', err);
    }
    setBusyId(null);
  }

  async function deny(requestId) {
    setBusyId(requestId);
    try {
      await api.denyGuest(meetingId, requestId, token);
    } catch (err) {
      console.warn('Deny failed', err);
    }
    setBusyId(null);
  }

  return (
    <div className="sidebar-section">
      <div className="sidebar-title">🚪 {t('waitingRoom')} ({pending.length})</div>
      {pending.length === 0 ? (
        <p className="empty-text">{t('noOneWaiting')}</p>
      ) : (
        <div className="participant-list">
          {pending.map(req => (
            <div key={req.requestId} className="participant-item">
              <div className="p-avatar">{req.displayName?.[0]?.toUpperCase()}</div>
              <div style={{ flex: 1 }}>
                <div className="p-name">{req.displayName}</div>
              </div>
              <div className="p-actions">
                <button
                  className="btn btn-success btn-xs"
                  disabled={busyId === req.requestId}
                  onClick={() => admit(req.requestId)}
                >✔ {t('admit')}</button>
                <button
                  className="btn btn-ghost btn-xs"
                  disabled={busyId === req.requestId}
                  onClick={() => deny(req.requestId)}
                >✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RoomContent({ roomData, onLeave }) {
  const { t } = useLang();
  const { token } = useAuth();
  const [sidePanel, setSidePanel] = useState('participants'); // 'participants' | 'chat' | 'waiting' | null
  const { localParticipant } = useLocalParticipant();
  const participants = useParticipants();
  const [raiseHands, setRaiseHands] = useState({});
  const [waitingCount, setWaitingCount] = useState(0);
  const [stats, setStats] = useState({ rtt: null, packetsLost: null, jitter: null });

  const localRole = roomData.role || 'participant';
  const isModerator = localRole === 'host' || localRole === 'cohost';
  const isHost = localRole === 'host';

  // Track pending waiting-room count for the header badge, independent of
  // which sidebar tab is open.
  useEffect(() => {
    if (!isHost || !token) return;
    const socket = getSocket();
    socket.emit('host:watch', roomData.meetingId);
    api.getWaitingRoom(roomData.meetingId, token).then(list => setWaitingCount(list.length)).catch(() => {});
    function onNew(req) { if (req.meetingId === roomData.meetingId) setWaitingCount(c => c + 1); }
    function onResolved() { setWaitingCount(c => Math.max(0, c - 1)); }
    socket.on('waiting-room:new-request', onNew);
    socket.on('waiting-room:resolved', onResolved);
    return () => {
      socket.off('waiting-room:new-request', onNew);
      socket.off('waiting-room:resolved', onResolved);
    };
  }, [isHost, token, roomData.meetingId]);

  // data channel for control signals (raise-hand, promote, moderation)
  const { send: sendSignal, message: signalMsg } = useDataChannel('signals', (msg) => {
    try {
      const decoded = new TextDecoder().decode(msg.payload);
      const data = JSON.parse(decoded);
      if (data.type === 'raise') {
        setRaiseHands(prev => ({ ...prev, [data.from]: true }));
      } else if (data.type === 'lower') {
        setRaiseHands(prev => ({ ...prev, [data.from]: false }));
      } else if (data.type === 'promote' && data.target === localParticipant?.identity) {
        window.dispatchEvent(new CustomEvent('lk-promotion', { detail: data.token }));
      } else if (data.type === 'moderation' && data.target === localParticipant?.identity) {
        if (data.action === 'mute') {
          const ev = new CustomEvent('lk-moderation-mute');
          window.dispatchEvent(ev);
        } else if (data.action === 'kick') {
          window.dispatchEvent(new CustomEvent('lk-moderation-kick'));
        }
      }
    } catch (e) {}
  });

  useEffect(() => {
    if (!signalMsg) return;
  }, [signalMsg]);

  // toggles for local microphone and camera
  const { toggle: toggleMic, enabled: micEnabled, pending: micPending, buttonProps: micButtonProps } = useTrackToggle({ source: 'microphone' });
  const { toggle: toggleCam, enabled: camEnabled, pending: camPending, buttonProps: camButtonProps } = useTrackToggle({ source: 'camera' });

  // Optional: try to replace the outgoing microphone track with a
  // WebAudio-processed track (modest gain, AGC off). This is guarded and
  // will silently no-op if the LiveKit client APIs are not available.
  useEffect(() => {
    let audioCtx;
    let cancelled = false;
    async function replaceMic() {
      try {
        if (!localParticipant || typeof navigator === 'undefined') return;
        // feature-check LiveKit publish API
        if (typeof localParticipant.publishTrack !== 'function') return;

        // capture raw mic with AGC disabled so we can control gain ourselves
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: false,
            sampleRate: 48000,
            channelCount: 1,
          }
        });

        if (cancelled) return;
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const src = audioCtx.createMediaStreamSource(stream);
        const gainNode = audioCtx.createGain();
          gainNode.gain.value = micBoost;
          gainNodeRef.current = gainNode;
        const dest = audioCtx.createMediaStreamDestination();
        src.connect(gainNode);
        gainNode.connect(dest);

        const processedTrack = dest.stream.getAudioTracks()[0];
        if (!processedTrack) return;

        // Try to construct a LiveKit LocalAudioTrack if available and replace
        // the published track. Use dynamic import so bundlers keep things OK.
        const livekit = await import('livekit-client');
        const LocalAudioTrack = livekit?.LocalAudioTrack || livekit?.createLocalAudioTrack;
        if (!LocalAudioTrack) return;

        let lkTrack;
        if (typeof livekit.createLocalAudioTrack === 'function') {
          // createLocalAudioTrack accepts constraints or an existing track
          lkTrack = await livekit.createLocalAudioTrack({ track: processedTrack });
        } else if (typeof livekit.LocalAudioTrack === 'function') {
          lkTrack = new livekit.LocalAudioTrack(processedTrack);
        }
        if (!lkTrack) return;

        // find current audio publication and attempt to unpublish it
        const pubs = localParticipant.getTrackPublications ? localParticipant.getTrackPublications() : [];
        for (const p of pubs) {
          if (p.kind === 'audio' && p.track) {
            try { await localParticipant.unpublishTrack(p.track); } catch (e) {}
          }
        }

        await localParticipant.publishTrack(lkTrack);
      } catch (err) {
        console.warn('Processed mic replacement failed (safe to ignore):', err);
      }
    }
    replaceMic();
    return () => {
      cancelled = true;
      if (audioCtx && audioCtx.state !== 'closed') audioCtx.close().catch(() => {});
    };
  }, [localParticipant]);

    const [micBoost, setMicBoost] = useState(1.6);
    const gainNodeRef = React.useRef(null);

    // Update gain node when micBoost changes
    useEffect(() => {
      if (gainNodeRef.current) gainNodeRef.current.gain.value = micBoost;
    }, [micBoost]);

    // Try to prioritize Opus and set sender bitrate for audio senders.
    useEffect(() => {
      let cancelled = false;
      async function tuneSenders() {
        try {
          if (!localParticipant) return;

          // Attempt several paths to find the RTCPeerConnection used by LiveKit.
          const maybeRoom = localParticipant?.room || localParticipant?._room || localParticipant?.roomName && window.livekitRoom;
          const pc = maybeRoom?.pc || maybeRoom?.peerConnection || maybeRoom?.engine?.pc || maybeRoom?._pc || null;
          // Fallback: some SDKs expose connection on participant.connection
          const fallbackPc = localParticipant?.connection?.pc || null;
          const peerConn = pc || fallbackPc;
          if (!peerConn || typeof peerConn.getSenders !== 'function') return;

          // Set codec preferences to Opus when possible, and increase maxBitrate.
          const senders = peerConn.getSenders();
          for (const sender of senders) {
            if (!sender.track || sender.track.kind !== 'audio') continue;

            // Set maxBitrate on encodings
            try {
              const params = sender.getParameters();
              params.encodings = params.encodings && params.encodings.length ? params.encodings : [{}];
              // 128 kbps is a good starting point for clear mono speech
              params.encodings[0].maxBitrate = 128000;
              await sender.setParameters(params);
            } catch (e) {
              // Ignore browsers that don't support setParameters.
            }

            // Prefer Opus via transceiver codec preferences when available
            const transceivers = peerConn.getTransceivers ? peerConn.getTransceivers() : [];
            for (const tr of transceivers) {
              try {
                if (tr.sender !== sender) continue;
                if (typeof RTCRtpSender !== 'undefined' && typeof RTCRtpSender.getCapabilities === 'function' && typeof tr.setCodecPreferences === 'function') {
                  const caps = RTCRtpSender.getCapabilities('audio');
                  if (caps && caps.codecs) {
                    const opus = caps.codecs.filter(c => c.mimeType && c.mimeType.toLowerCase().includes('opus'));
                    if (opus.length) {
                      tr.setCodecPreferences(opus);
                    }
                  }
                }
              } catch (e) {}
            }
          }
        } catch (err) {
          console.warn('Failed tuning RTCRtpSenders:', err);
        }
      }
      if (!cancelled) tuneSenders();
      return () => { cancelled = true; };
    }, [localParticipant]);

    // Simple stats polling for diagnostics (RTT, packet loss, jitter)
    useEffect(() => {
      let mounted = true;
      let timer;
      async function poll() {
        try {
          if (!localParticipant) return;
          const maybeRoom = localParticipant?.room || localParticipant?._room || localParticipant?.roomName && window.livekitRoom;
          const pc = maybeRoom?.pc || maybeRoom?.peerConnection || maybeRoom?.engine?.pc || maybeRoom?._pc || null;
          const fallbackPc = localParticipant?.connection?.pc || null;
          const peerConn = pc || fallbackPc;
          if (!peerConn || typeof peerConn.getStats !== 'function') return;

          const statsReport = await peerConn.getStats();
          let rtt = null, packetsLost = null, jitter = null;
          statsReport.forEach(r => {
            if (!r) return;
            if (!r.type) return;
            if (r.type === 'candidate-pair' && r.nominated && (r.state === 'succeeded' || r.state === 'completed')) {
              rtt = r.currentRoundTripTime != null ? r.currentRoundTripTime * 1000 : r.roundTripTime != null ? r.roundTripTime * 1000 : rtt;
            }
            if ((r.type === 'inbound-rtp' || r.type === 'remote-inbound-rtp') && r.kind === 'audio') {
              if (r.packetsLost != null) packetsLost = r.packetsLost;
              if (r.jitter != null) jitter = r.jitter;
            }
          });
          if (mounted) setStats({ rtt, packetsLost, jitter });
        } catch (e) {}
        timer = setTimeout(poll, 2000);
      }
      poll();
      return () => { mounted = false; if (timer) clearTimeout(timer); };
    }, [localParticipant]);

  useEffect(() => {
    function onLocalModerationMute() {
      if (micEnabled) {
        toggleMic();
      }
    }
    window.addEventListener('lk-local-moderation-mute', onLocalModerationMute);
    return () => window.removeEventListener('lk-local-moderation-mute', onLocalModerationMute);
  }, [micEnabled, toggleMic]);

  return (
    <div className="room-layout">
      {/* Header */}
      <div className="room-header">
        <div className="room-info">
          <div className="room-name">{roomData.title}</div>
          <div className="room-meta">
            <span className="room-id">ID: {roomData.meetingId}</span>
            <span className={`badge badge-${roomData.role==='host'?'blue':roomData.role==='cohost'?'yellow':'green'}`}>
              {t(roomData.role)}
            </span>
            <span className="live-badge">🔴 LIVE</span>
          </div>
        </div>
        <div className="room-header-actions">
          {isHost && (
            <button className={`panel-btn ${sidePanel==='waiting'?'active':''}`} onClick={() => setSidePanel(s => s==='waiting'?null:'waiting')} style={{ position: 'relative' }}>
              🚪
              {waitingCount > 0 && <span className="panel-badge">{waitingCount}</span>}
            </button>
          )}
          <button className={`panel-btn ${sidePanel==='participants'?'active':''}`} onClick={() => setSidePanel(s => s==='participants'?null:'participants')}>
            👥
          </button>
          <button className={`panel-btn ${sidePanel==='chat'?'active':''}`} onClick={() => setSidePanel(s => s==='chat'?null:'chat')}>
            💬
          </button>
          <button className="btn btn-danger btn-sm" onClick={onLeave}>
            📞 {t('leave')}
          </button>
        </div>
      </div>

      {/* Main area */}
      <div className="room-body">
        <div className="room-video">
          <VideoConference />
        </div>

        {sidePanel && (
          <div className="room-sidebar">
            {sidePanel === 'waiting' && <WaitingRoomPanel meetingId={roomData.meetingId} isModerator={isHost} />}
            {sidePanel === 'participants' && <ParticipantList raiseHands={raiseHands} isModerator={isModerator} onAction={(action, target) => {
              const me = localParticipant?.identity;
              const participant = participants.find(p => p.identity === target);
              const micPub = participant?.getTrackPublication?.('microphone');
              const trackSid = micPub?.trackSid;

              // Moderation endpoints now require the host's admin JWT — sending
              // it here is what makes /kick and /mute actually work again
              // (and what stops a participant from calling them at all, since
              // participants never hold this token).
              const safeFetch = async (url, payload) => {
                try {
                  await fetch(url, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    },
                    body: JSON.stringify(payload),
                  });
                } catch (err) {
                  console.warn('LiveKit moderation API failed', err);
                }
              };

              if (action === 'raise') {
                sendSignal(new TextEncoder().encode(JSON.stringify({ type: 'raise', from: me })), { reliable: true });
                setRaiseHands(prev => ({ ...prev, [me]: true }));
              } else if (action === 'lower') {
                sendSignal(new TextEncoder().encode(JSON.stringify({ type: 'lower', from: target })), { reliable: true });
                setRaiseHands(prev => ({ ...prev, [target]: false }));
              } else if (action === 'mute') {
                if (trackSid) {
                  safeFetch(`${API_BASE}/livekit/mute`, { roomName: roomData.meetingId, participantName: target, trackSid, muted: true });
                }
                sendSignal(new TextEncoder().encode(JSON.stringify({ type: 'moderation', action: 'mute', target })), { reliable: true });
              } else if (action === 'remove') {
                safeFetch(`${API_BASE}/livekit/kick`, { roomName: roomData.meetingId, participantName: target, revoke: true });
                sendSignal(new TextEncoder().encode(JSON.stringify({ type: 'moderation', action: 'kick', target })), { reliable: true });
              } else if (action === 'promote') {
                fetch(`${API_BASE}/livekit/promote`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                  },
                  body: JSON.stringify({ roomName: roomData.meetingId, participantName: target })
                })
                  .then(r => r.json())
                  .then(json => {
                    if (json?.token) {
                      sendSignal(new TextEncoder().encode(JSON.stringify({ type: 'promote', target, token: json.token })), { reliable: true });
                    }
                  }).catch(() => {
                    console.warn('Promote request failed');
                  });
              }
            }} />}
            {sidePanel === 'chat' && <Chat roomId={roomData.meetingId} displayName={roomData.displayName} />}
          </div>
        )}
      </div>

      <div className="room-controls">
        <div className="controls-inner">
          <button className="btn btn-ghost btn-sm" onClick={() => toggleMic()} disabled={micPending} {...micButtonProps}>
            {micEnabled ? '🔊 Mute' : '🔇 Unmute'}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => toggleCam()} disabled={camPending} {...camButtonProps}>
            {camEnabled ? '📷 Video Off' : '📷 Video On'}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => {
            const me = localParticipant?.identity;
            const currently = raiseHands[me];
            if (currently) {
              sendSignal(new TextEncoder().encode(JSON.stringify({ type: 'lower', from: me })), { reliable: true });
              setRaiseHands(prev => ({ ...prev, [me]: false }));
            } else {
              sendSignal(new TextEncoder().encode(JSON.stringify({ type: 'raise', from: me })), { reliable: true });
              setRaiseHands(prev => ({ ...prev, [me]: true }));
            }
          }}>{raiseHands[localParticipant?.identity] ? '✋ Lower' : '✋ Raise'}</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '12px' }}>
            <label style={{ fontSize: '12px' }}>Mic boost</label>
            <input type="range" min="1" max="3" step="0.1" value={micBoost} onChange={e => setMicBoost(parseFloat(e.target.value))} />
            <div style={{ fontSize: '12px', width: '110px' }}>RTT: {stats.rtt ? `${Math.round(stats.rtt)} ms` : '—'} • Loss: {stats.packetsLost ?? '—'}</div>
          </div>
        </div>
      </div>

      <RoomAudioRenderer />
    </div>
  );
}

export default function Room({ roomData, onLeave }) {
  const [token, setToken] = useState(roomData?.lkToken);
  const [currentRole, setCurrentRole] = useState(roomData?.role || 'participant');
  const effectiveRoomData = { ...roomData, role: currentRole };

  useEffect(() => {
    function onPromotion(e) {
      const newToken = e.detail;
      if (newToken) {
        setToken(newToken);
        setCurrentRole('cohost');
      }
    }
    function onModerationKick() {
      onLeave();
    }
    function onModerationMute() {
      window.dispatchEvent(new CustomEvent('lk-local-moderation-mute'));
    }
    window.addEventListener('lk-promotion', onPromotion);
    window.addEventListener('lk-moderation-kick', onModerationKick);
    window.addEventListener('lk-moderation-mute', onModerationMute);
    return () => {
      window.removeEventListener('lk-promotion', onPromotion);
      window.removeEventListener('lk-moderation-kick', onModerationKick);
      window.removeEventListener('lk-moderation-mute', onModerationMute);
    };
  }, [onLeave]);

  if (!token || !roomData?.lkUrl) {
    return (
      <div className="room-error">
        <p>Missing LiveKit credentials. Please re-join the meeting.</p>
        <button className="btn btn-ghost" onClick={onLeave}>← Back</button>
      </div>
    );
  }
  return (
    <LiveKitRoom
      token={token}
      serverUrl={effectiveRoomData.lkUrl}
      connect={true}
      video={{ width: 1280, height: 720, frameRate: 30, simulcast: true }}
      audio={{
        // Improve capture settings: keep echo/noise suppression enabled,
        // but disable automatic gain control (AGC) which often causes
        // pumping, distortion and level instability. Request a 48kHz
        // sample rate and mono channel for lower CPU and consistent
        // encoding behavior.
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: false,
        sampleRate: 48000,
        channelCount: 1,
      }}
      options={{
        adaptiveStream: true,
        dynacast: true,
        stopLocalTrackOnUnpublish: false,
        reconnectPolicy: {
          nextRetryDelayInMs: ({ retryCount }) => {
            if (retryCount >= 7) return null;
            return Math.min(500 * 2 ** retryCount, 10000);
          }
        }
      }}
      connectOptions={{
        autoSubscribe: true,
        maxRetries: 7,
        websocketTimeout: 15000,
        peerConnectionTimeout: 30000,
      }}
      onDisconnected={onLeave}
      className="lk-room-container"
    >
      <RoomContent roomData={effectiveRoomData} onLeave={onLeave} />
    </LiveKitRoom>
  );
}
