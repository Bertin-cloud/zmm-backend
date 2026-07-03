import React, { useState, useEffect, useRef } from 'react';
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

function ParticipantList({ onAction, raiseHands, isModerator, localParticipant, micEnabled, camEnabled, micPending, camPending, toggleMic, toggleCam }) {
  const { t } = useLang();
  const participants = useParticipants();
  return (
    <div className="sidebar-section">
      <div className="sidebar-title">👥 {t('participants')} ({participants.length})</div>
      <div className="participant-list">
        <div className="participant-item local-participant">
          <div className="p-avatar">{localParticipant?.identity[0]?.toUpperCase()}</div>
          <div style={{ flex: 1 }}>
            <div className="p-name">{localParticipant?.identity || 'You'}</div>
            <div className="p-status">
              <span>{micEnabled ? '🎤' : '🔇'}</span>
              <span>{camEnabled ? '📷' : '🚫'}</span>
            </div>
          </div>
          <div className="p-actions">
            <button
              className="btn btn-ghost btn-xs"
              onClick={toggleMic}
              disabled={micPending}
            >
              {micEnabled ? '🔇' : '🎤'}
            </button>
            <button
              className="btn btn-ghost btn-xs"
              onClick={toggleCam}
              disabled={camPending}
            >
              {camEnabled ? '📷' : '📷'}
            </button>
          </div>
        </div>
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
              {isModerator && p.identity !== localParticipant?.identity && raiseHands[p.identity] && (
                <button className="btn btn-ghost btn-xs" onClick={() => onAction('lower', p.identity)}>👇</button>
              )}
              {isModerator && p.identity !== localParticipant?.identity && <button className="btn btn-ghost btn-xs" onClick={() => onAction('ask-audio', p.identity)} title="Ask participant to enable audio">🎧</button>}
              {isModerator && p.identity !== localParticipant?.identity && <button className="btn btn-ghost btn-xs" onClick={() => onAction('ask-video', p.identity)} title="Ask participant to enable video">📷</button>}
              {isModerator && p.identity !== localParticipant?.identity && <button className="btn btn-ghost btn-xs" onClick={() => onAction('mute', p.identity)}>🔇</button>}
              {isModerator && p.identity !== localParticipant?.identity && <button className="btn btn-ghost btn-xs" onClick={() => onAction('remove', p.identity)}>❌</button>}
              {isModerator && p.identity !== localParticipant?.identity && <button className="btn btn-ghost btn-xs" onClick={() => onAction('promote', p.identity)}>⭐</button>}
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
  const [remoteRequest, setRemoteRequest] = useState('');
  const [screenShareTrack, setScreenShareTrack] = useState(null);
  const [sharePending, setSharePending] = useState(false);
  const [screenShareError, setScreenShareError] = useState('');
  const [endingMeeting, setEndingMeeting] = useState(false);
  const [micPermissionError, setMicPermissionError] = useState('');
  const [micPermissionDenied, setMicPermissionDenied] = useState(false);
  const [backgroundMessage, setBackgroundMessage] = useState('');
  const [hadActiveMediaBeforeHidden, setHadActiveMediaBeforeHidden] = useState({ mic: false, cam: false });
  const [activeSpeaker, setActiveSpeaker] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const videoContainerRef = useRef(null);

  const isPermissionDeniedError = (err) => {
    if (!err) return false;
    const name = err.name || '';
    const message = err.message || '';
    return /NotAllowedError|PermissionDeniedError|NotReadableError|SecurityError/i.test(name)
      || /permission/i.test(message);
  };

  const handleMicPermissionError = (err) => {
    const denied = isPermissionDeniedError(err);
    if (denied) {
      setMicPermissionError('Microphone access is required to speak in this meeting. Please allow microphone access in your browser or device settings.');
      setMicPermissionDenied(true);
    } else {
      setMicPermissionError('Unable to access the microphone. Please check your device settings and retry.');
      setMicPermissionDenied(false);
    }
  };

  async function retryMicrophone() {
    if (!navigator?.mediaDevices?.getUserMedia) {
      setMicPermissionError('Your browser does not support microphone capture on this device.');
      setMicPermissionDenied(false);
      return;
    }

    setMicPermissionError('');
    setMicPermissionDenied(false);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false,
          sampleRate: 48000,
          channelCount: 1,
        },
      });
      const track = stream.getAudioTracks()[0];
      if (!track) throw new Error('No microphone track found');

      const livekit = await import('livekit-client');
      const lkTrack = livekit.createLocalAudioTrack
        ? await livekit.createLocalAudioTrack({ track })
        : new livekit.LocalAudioTrack(track);

      await localParticipant?.publishTrack(lkTrack);
      setMicPermissionError('');
      setMicPermissionDenied(false);
    } catch (err) {
      handleMicPermissionError(err);
      console.warn('Retry microphone failed:', err);
    }
  }

  async function handleToggleMic() {
    try {
      await toggleMic();
      if (micPermissionError) {
        setMicPermissionError('');
        setMicPermissionDenied(false);
      }
    } catch (err) {
      handleMicPermissionError(err);
    }
  }

  const localRole = roomData.role || 'participant';
  const isModerator = localRole === 'host' || localRole === 'cohost';
  const isHost = localRole === 'host';

  useEffect(() => {
    const updateFullscreen = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', updateFullscreen);
    return () => document.removeEventListener('fullscreenchange', updateFullscreen);
  }, []);

  useEffect(() => {
    let timeout;

    const handleVisibility = async () => {
      if (document.visibilityState === 'hidden') {
        setHadActiveMediaBeforeHidden({ mic: micEnabled, cam: camEnabled });
        setBackgroundMessage('The meeting is in the background. Browser or OS restrictions may pause audio, video, or connection while your phone screen is off.');
      } else {
        setBackgroundMessage('Meeting is active again. Restoring your audio/video streams if needed.');
        timeout = window.setTimeout(() => setBackgroundMessage(''), 7000);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pageshow', handleVisibility);
    window.addEventListener('focus', handleVisibility);
    document.addEventListener('resume', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pageshow', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
      document.removeEventListener('resume', handleVisibility);
      clearTimeout(timeout);
    };
  }, [micEnabled, camEnabled]);

  useEffect(() => {
    const updateSpeaker = () => {
      const candidates = [...participants, localParticipant]
        .filter(Boolean)
        .map(p => ({
          identity: p.identity,
          level: p.audioLevel ?? 0,
          speaking: p.isSpeaking ?? false,
        }));

      if (!candidates.length) {
        setActiveSpeaker('');
        return;
      }

      candidates.sort((a, b) => {
        if (b.level !== a.level) return b.level - a.level;
        return (b.speaking ? 1 : 0) - (a.speaking ? 1 : 0);
      });

      const winner = candidates[0];
      if (winner && (winner.level > 0.05 || winner.speaking)) {
        setActiveSpeaker(winner.identity);
      } else {
        setActiveSpeaker('');
      }
    };

    updateSpeaker();
    const timer = window.setInterval(updateSpeaker, 500);
    return () => window.clearInterval(timer);
  }, [participants, localParticipant]);

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
        } else if (data.action === 'request-audio') {
          window.dispatchEvent(new CustomEvent('lk-request-audio'));
        } else if (data.action === 'request-video') {
          window.dispatchEvent(new CustomEvent('lk-request-video'));
        }
      } else if (data.type === 'moderation' && data.action === 'end-meeting') {
        window.dispatchEvent(new CustomEvent('lk-end-meeting'));
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
        if (isPermissionDeniedError(err)) {
          handleMicPermissionError(err);
        }
        console.warn('Processed mic replacement failed (safe to ignore):', err);
      }
    }
    replaceMic();
    return () => {
      cancelled = true;
      if (audioCtx && audioCtx.state !== 'closed') audioCtx.close().catch(() => {});
    };
  }, [localParticipant]);

  const cameraTrackRef = React.useRef(null);
  const cameraConstraints = {
    facingMode: 'user',
    width: { ideal: 1920, min: 1280 },
    height: { ideal: 1080, min: 720 },
    frameRate: { ideal: 30, max: 30 },
    aspectRatio: 16 / 9,
  };

  useEffect(() => {
    let cancelled = false;
    async function replaceCam() {
      try {
        if (!localParticipant || typeof navigator === 'undefined') return;
        if (typeof localParticipant.publishTrack !== 'function') return;

        const stream = await navigator.mediaDevices.getUserMedia({
          video: cameraConstraints,
        });

        if (cancelled) return;
        const rawTrack = stream.getVideoTracks()[0];
        if (!rawTrack) return;
        if (rawTrack.applyConstraints) {
          try {
            await rawTrack.applyConstraints({ width: 1920, height: 1080, frameRate: 30 });
          } catch (err) {
            // ignore unsupported mobile constraints
          }
        }

        const livekit = await import('livekit-client');
        const LocalVideoTrack = livekit?.LocalVideoTrack || livekit?.createLocalVideoTrack;
        if (!LocalVideoTrack) return;

        let lkTrack;
        if (typeof livekit.createLocalVideoTrack === 'function') {
          lkTrack = await livekit.createLocalVideoTrack({ track: rawTrack });
        } else {
          lkTrack = new livekit.LocalVideoTrack(rawTrack);
        }
        if (!lkTrack) return;

        const pubs = localParticipant.getTrackPublications ? localParticipant.getTrackPublications() : [];
        for (const p of pubs) {
          if (p.kind === 'video' && p.track) {
            try { await localParticipant.unpublishTrack(p.track); } catch (e) {}
          }
        }

        await localParticipant.publishTrack(lkTrack, {
          simulcast: true,
          videoEncoding: {
            maxBitrate: 1800000,
            scaleResolutionDownBy: 1,
          }
        });

        cameraTrackRef.current?.stop?.();
        cameraTrackRef.current = lkTrack;
      } catch (err) {
        console.warn('Mobile camera replacement failed:', err);
      }
    }

    replaceCam();
    return () => {
      cancelled = true;
      if (cameraTrackRef.current) {
        cameraTrackRef.current.stop?.();
      }
    };
  }, [localParticipant]);

    const [micBoost, setMicBoost] = useState(1.6);
    const gainNodeRef = React.useRef(null);

    // Update gain node when micBoost changes
    useEffect(() => {
      if (gainNodeRef.current) gainNodeRef.current.gain.value = micBoost;
    }, [micBoost]);

    // Tune senders for audio/video bitrate and codec preferences.
    useEffect(() => {
      let cancelled = false;
      async function tuneSenders() {
        try {
          if (!localParticipant) return;

          const maybeRoom = localParticipant?.room || localParticipant?._room || localParticipant?.roomName && window.livekitRoom;
          const pc = maybeRoom?.pc || maybeRoom?.peerConnection || maybeRoom?.engine?.pc || maybeRoom?._pc || null;
          const fallbackPc = localParticipant?.connection?.pc || null;
          const peerConn = pc || fallbackPc;
          if (!peerConn || typeof peerConn.getSenders !== 'function') return;

          const senders = peerConn.getSenders();
          const transceivers = peerConn.getTransceivers ? peerConn.getTransceivers() : [];

          for (const sender of senders) {
            if (!sender.track) continue;
            const kind = sender.track.kind;
            try {
              const params = sender.getParameters();
              params.encodings = params.encodings && params.encodings.length ? params.encodings : [{}];

              if (kind === 'audio') {
                params.encodings[0].maxBitrate = 128000;
                params.encodings[0].priority = 'high';
              } else if (kind === 'video') {
                const isScreenShare = sender.track.label?.toLowerCase().includes('screen') || sender.track.label?.toLowerCase().includes('display');
                const videoBitrate = isScreenShare ? 1800000 : 1800000;
                params.encodings[0].maxBitrate = videoBitrate;
                params.encodings[0].minBitrate = 250000;
                params.encodings[0].scaleResolutionDownBy = 1;
              }

              await sender.setParameters(params);
            } catch (e) {
              // Some browsers may not support setParameters for all tracks.
            }
          }

          for (const tr of transceivers) {
            try {
              const track = tr.sender?.track;
              if (!track) continue;
              if (typeof RTCRtpSender === 'undefined' || typeof RTCRtpSender.getCapabilities !== 'function' || typeof tr.setCodecPreferences !== 'function') {
                continue;
              }

              if (track.kind === 'audio') {
                const caps = RTCRtpSender.getCapabilities('audio');
                const opus = caps?.codecs?.filter(c => c.mimeType?.toLowerCase().includes('opus')) || [];
                if (opus.length) {
                  tr.setCodecPreferences(opus);
                }
              } else if (track.kind === 'video') {
                const caps = RTCRtpSender.getCapabilities('video');
                if (caps?.codecs?.length) {
                  const preferred = caps.codecs.filter(c => /h264/i.test(c.mimeType));
                  if (!preferred.length) {
                    preferred.push(...caps.codecs.filter(c => /vp9/i.test(c.mimeType)));
                  }
                  if (!preferred.length) {
                    preferred.push(...caps.codecs.filter(c => /vp8/i.test(c.mimeType)));
                  }
                  if (preferred.length) {
                    const sorted = [...preferred, ...caps.codecs.filter(c => !preferred.includes(c))];
                    tr.setCodecPreferences(sorted);
                  }
                }
              }
            } catch (e) {
              // codec preference not supported by this browser
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
    if (!stats.rtt && stats.packetsLost == null && stats.jitter == null) return;
    const isPoor = (stats.rtt ?? 0) > 250 || (stats.packetsLost ?? 0) > 5 || (stats.jitter ?? 0) > 0.1;
    if (!localParticipant) return;

    const maybeRoom = localParticipant?.room || localParticipant?._room || localParticipant?.roomName && window.livekitRoom;
    const pc = maybeRoom?.pc || maybeRoom?.peerConnection || maybeRoom?.engine?.pc || maybeRoom?._pc || null;
    const fallbackPc = localParticipant?.connection?.pc || null;
    const peerConn = pc || fallbackPc;
    if (!peerConn || typeof peerConn.getSenders !== 'function') return;

    const senders = peerConn.getSenders();
    for (const sender of senders) {
      if (!sender.track || sender.track.kind !== 'video') continue;
      try {
        const params = sender.getParameters();
        params.encodings = params.encodings && params.encodings.length ? params.encodings : [{}];
        const settings = sender.track.getSettings ? sender.track.getSettings() : {};
        const height = settings.height || settings.frameHeight || 720;
        const minHeight = 360;
        const downscale = isPoor ? Math.max(1, Math.min(3, Math.floor(height / minHeight))) : 1;
        params.encodings[0].maxBitrate = isPoor ? 400000 : 900000;
        params.encodings[0].scaleResolutionDownBy = downscale;
        sender.setParameters(params).catch(() => {});
      } catch (e) {
        // ignore unsupported parameter changes
      }
    }
  }, [stats, localParticipant]);

  useEffect(() => {
    async function tryEnableAudio() {
      setRemoteRequest('Host requested you enable audio.');
      if (micEnabled) return true;
      try {
        await toggleMic();
        if (micEnabled) return true;
      } catch (err) {
        console.warn('Toggle mic failed:', err);
      }

      if (!navigator?.mediaDevices?.getUserMedia) {
        setRemoteRequest('Unable to access microphone.');
        return false;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: false,
            sampleRate: 48000,
            channelCount: 1,
          }
        });
        const track = stream.getAudioTracks()[0];
        if (!track) throw new Error('No microphone track found');

        const livekit = await import('livekit-client');
        const lkTrack = livekit.createLocalAudioTrack
          ? await livekit.createLocalAudioTrack({ track })
          : new livekit.LocalAudioTrack(track);

        await localParticipant?.publishTrack(lkTrack);
        return true;
      } catch (err) {
        console.warn('Audio re-publish failed:', err);
        handleMicPermissionError(err);
        setRemoteRequest('Unable to enable audio. Please allow microphone access.');
        return false;
      }
    }

    async function tryEnableVideo() {
      setRemoteRequest('Host requested you enable video.');
      if (camEnabled) return true;
      try {
        await toggleCam();
        if (camEnabled) return true;
      } catch (err) {
        console.warn('Toggle camera failed:', err);
      }

      if (!navigator?.mediaDevices?.getUserMedia) {
        setRemoteRequest('Unable to access camera.');
        return false;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30, max: 30 },
          }
        });
        const track = stream.getVideoTracks()[0];
        if (!track) throw new Error('No camera track found');

        const livekit = await import('livekit-client');
        const lkTrack = livekit.createLocalVideoTrack
          ? await livekit.createLocalVideoTrack({ track })
          : new livekit.LocalVideoTrack(track);

        await localParticipant?.publishTrack(lkTrack);
        return true;
      } catch (err) {
        console.warn('Video re-publish failed:', err);
        setRemoteRequest('Unable to enable video. Please allow camera access.');
        return false;
      }
    }

    function onLocalModerationMute() {
      if (micEnabled) {
        toggleMic();
      }
    }
    function onLocalRequestAudio() {
      if (!micEnabled) {
        tryEnableAudio();
      }
    }
    function onLocalRequestVideo() {
      if (!camEnabled) {
        tryEnableVideo();
      }
    }
    window.addEventListener('lk-local-moderation-mute', onLocalModerationMute);
    window.addEventListener('lk-request-audio', onLocalRequestAudio);
    window.addEventListener('lk-request-video', onLocalRequestVideo);
    return () => {
      window.removeEventListener('lk-local-moderation-mute', onLocalModerationMute);
      window.removeEventListener('lk-request-audio', onLocalRequestAudio);
      window.removeEventListener('lk-request-video', onLocalRequestVideo);
    };
  }, [micEnabled, toggleMic, camEnabled, toggleCam, localParticipant]);

  useEffect(() => {
    function onLocalEndMeeting() {
      setRemoteRequest('Host ended the meeting for everyone.');
      onLeave();
    }

    window.addEventListener('lk-end-meeting', onLocalEndMeeting);
    return () => {
      window.removeEventListener('lk-end-meeting', onLocalEndMeeting);
    };
  }, [onLeave]);

  useEffect(() => {
    return () => {
      if (screenShareTrack) {
        localParticipant?.unpublishTrack(screenShareTrack).catch(() => {});
        screenShareTrack.stop?.();
      }
    };
  }, [localParticipant, screenShareTrack]);

  function toggleFullScreen() {
    const container = videoContainerRef.current;
    if (!container) return;

    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    } else {
      container.requestFullscreen?.().catch(() => {
        if (typeof container.webkitRequestFullscreen === 'function') {
          container.webkitRequestFullscreen();
        }
      });
    }
  }

  async function toggleScreenShare() {
    if (!localParticipant || typeof navigator === 'undefined') {
      setScreenShareError('Screen sharing is not available in this browser.');
      return;
    }

    if (sharePending) return;
    setScreenShareError('');
    setSharePending(true);

    if (screenShareTrack) {
      try {
        await localParticipant.unpublishTrack(screenShareTrack);
      } catch (err) {
        console.warn('Unable to unpublish screen share track:', err);
      }
      screenShareTrack.stop?.();
      setScreenShareTrack(null);
      setSharePending(false);
      return;
    }

    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: { ideal: 30, max: 60 },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          cursor: 'always',
          displaySurface: 'browser',
        },
        audio: false,
      });
      const rawTrack = displayStream.getVideoTracks()[0];
      if (!rawTrack) throw new Error('No display track available');
      if (rawTrack.applyConstraints) {
        try {
          await rawTrack.applyConstraints({
            width: 1920,
            height: 1080,
            frameRate: 30,
          });
        } catch (err) {
          // ignore if the browser cannot apply additional constraints
        }
      }
      rawTrack.contentHint = 'detail';

      const livekit = await import('livekit-client');
      const lkTrack = livekit.createLocalVideoTrack
        ? await livekit.createLocalVideoTrack({ track: rawTrack })
        : new livekit.LocalVideoTrack(rawTrack);

      rawTrack.onended = async () => {
        try {
          await localParticipant.unpublishTrack(lkTrack);
        } catch (err) {
          console.warn('Failed to unpublish ended screen share track:', err);
        }
        setScreenShareTrack(null);
      };

      await localParticipant.publishTrack(lkTrack, {
        simulcast: true,
        videoEncoding: {
          maxBitrate: 1800000,
          scaleResolutionDownBy: 1,
        },
      });
      setScreenShareTrack(lkTrack);
    } catch (err) {
      console.warn('Screen share failed:', err);
      setScreenShareError(err?.message || 'Unable to start screen sharing.');
    } finally {
      setSharePending(false);
    }
  }

  function endMeetingForAll() {
    if (!window.confirm('End meeting for everyone?')) {
      return;
    }
    setEndingMeeting(true);
    try {
      sendSignal(new TextEncoder().encode(JSON.stringify({ type: 'moderation', action: 'end-meeting' })), { reliable: true });
    } catch (err) {
      console.warn('End meeting signal failed:', err);
    } finally {
      setEndingMeeting(false);
      onLeave();
    }
  }

  useEffect(() => {
    if (!remoteRequest) return;
    const timer = setTimeout(() => setRemoteRequest(''), 4000);
    return () => clearTimeout(timer);
  }, [remoteRequest]);

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
          {isHost && (
            <button className="btn btn-danger btn-sm" onClick={endMeetingForAll} disabled={endingMeeting}>
              🛑 {t('endMeeting')}
            </button>
          )}
        </div>
      </div>
      {remoteRequest && (
        <div className="room-request-banner">
          {remoteRequest}
        </div>
      )}
      {micPermissionError && (
        <div className="room-permission-banner">
          <div className="permission-message">{micPermissionError}</div>
          <div className="permission-actions">
            <button className="btn btn-primary btn-sm" onClick={retryMicrophone}>
              Retry Microphone
            </button>
          </div>
          {micPermissionDenied && (
            <div className="permission-instructions">
              <strong>Enable microphone access:</strong>
              <ol>
                <li>Open your browser's site settings for this meeting.</li>
                <li>Allow microphone access for this website.</li>
                <li>Reload the page if necessary.</li>
                <li>Press Retry Microphone again.</li>
              </ol>
            </div>
          )}
        </div>
      )}
      {backgroundMessage && (
        <div className="room-background-banner">
          {backgroundMessage}
        </div>
      )}

      {/* Main area */}
      <div className="room-body">
        <div className="room-video" ref={videoContainerRef}>
          <div className="video-toolbar">
            <button className="btn btn-ghost btn-xs" onClick={toggleFullScreen}>
              {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            </button>
            {activeSpeaker ? (
              <div className="active-speaker-badge">🎙️ {activeSpeaker} is speaking</div>
            ) : (
              <div className="active-speaker-badge inactive">No active speaker</div>
            )}
          </div>
          <VideoConference />
        </div>

        {sidePanel && (
          <div className="room-sidebar">
            <div className="sidebar-close-row">
              <button className="sidebar-close" onClick={() => setSidePanel(null)} aria-label="Close panel">×</button>
            </div>
            {sidePanel === 'waiting' && <WaitingRoomPanel meetingId={roomData.meetingId} isModerator={isHost} />}
            {sidePanel === 'participants' && <ParticipantList
              raiseHands={raiseHands}
              isModerator={isModerator}
              localParticipant={localParticipant}
              micEnabled={micEnabled}
              camEnabled={camEnabled}
              micPending={micPending}
              camPending={camPending}
              toggleMic={toggleMic}
              toggleCam={toggleCam}
              onAction={(action, target) => {
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
              } else if (action === 'ask-audio') {
                sendSignal(new TextEncoder().encode(JSON.stringify({ type: 'moderation', action: 'request-audio', target })), { reliable: true });
              } else if (action === 'ask-video') {
                sendSignal(new TextEncoder().encode(JSON.stringify({ type: 'moderation', action: 'request-video', target })), { reliable: true });
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

      {screenShareError && (
        <div className="room-error-banner">{screenShareError}</div>
      )}

      <div className="room-controls">
        <div className="controls-inner">
          <button className="btn btn-ghost btn-sm" onClick={handleToggleMic} disabled={micPending} {...micButtonProps}>
            {micEnabled ? '🔊 Mute' : '🔇 Unmute'}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => toggleCam()} disabled={camPending} {...camButtonProps}>
            {camEnabled ? '📷 Video Off' : '📷 Video On'}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={toggleScreenShare} disabled={sharePending}>
            {screenShareTrack ? '🛑 Stop Share' : '🖥️ Share Screen'}
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
      video={{
        facingMode: 'user',
        width: { ideal: 1920, min: 1280 },
        height: { ideal: 1080, min: 720 },
        frameRate: { ideal: 30, max: 30 },
        aspectRatio: 16 / 9,
        simulcast: true,
      }}
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
        },
        // Enable a higher default publish quality profile when available.
        defaultPublishOptions: {
          video: { simulcast: true, dtx: true },
          audio: { opusStereo: false }
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
