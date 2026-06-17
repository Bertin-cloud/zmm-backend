import React, { useState, useEffect, useRef } from 'react';
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
  ControlBar,
  useTracks,
  TrackLoop,
  TrackRefContext,
  VideoTrack,
  ParticipantTile,
  useParticipants,
  useLocalParticipant,
  GridLayout,
  FocusLayout,
  useTrackToggle,
  useDataChannel,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import { useLang } from '../context/LangContext';
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

function RoomContent({ roomData, onLeave }) {
  const { t } = useLang();
  const [sidePanel, setSidePanel] = useState('participants'); // 'participants' | 'chat' | null
  const { localParticipant } = useLocalParticipant();
  const participants = useParticipants();
  const [raiseHands, setRaiseHands] = useState({});

  const localRole = roomData.role || 'participant';
  const isModerator = localRole === 'host' || localRole === 'cohost';

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
        // if the server returned a token, update roomData via custom event
        window.dispatchEvent(new CustomEvent('lk-promotion', { detail: data.token }));
      } else if (data.type === 'moderation' && data.target === localParticipant?.identity) {
        if (data.action === 'mute') {
          // try to mute local mic if available
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
    // handled in callback above
  }, [signalMsg]);

  // toggles for local microphone and camera
  const { toggle: toggleMic, enabled: micEnabled, pending: micPending, buttonProps: micButtonProps } = useTrackToggle({ source: 'microphone' });
  const { toggle: toggleCam, enabled: camEnabled, pending: camPending, buttonProps: camButtonProps } = useTrackToggle({ source: 'camera' });

  useEffect(() => {
    function onLocalModerationMute() {
      if (micEnabled) {
        toggleMic();
      }
    }
    window.addEventListener('lk-local-moderation-mute', onLocalModerationMute);
    return () => window.removeEventListener('lk-local-moderation-mute', onLocalModerationMute);
  }, [micEnabled, toggleMic]);

  // Disable any attached audio processors (krisp/enhanced noise) on local mic tracks
  useEffect(() => {
    if (!localParticipant) return;
    const stopProcessors = async () => {
      try {
        const pubs = Array.from(localParticipant.audioTrackPublications ? localParticipant.audioTrackPublications.values() : []);
        pubs.forEach(pub => {
          const tr = pub.track;
          if (tr) {
            try {
              if (typeof tr.stopProcessor === 'function') {
                tr.stopProcessor(true);
              }
            } catch (e) {}
            try {
              if (typeof tr.internalStopProcessor === 'function') {
                tr.internalStopProcessor(true);
              }
            } catch (e) {}
            // prevent future processors being attached on this instance
            try {
              if (typeof tr.setProcessor === 'function') {
                tr.setProcessor = async () => {};
              }
            } catch (e) {}
          }
        });
      } catch (err) {
        // ignore
      }
    };

    stopProcessors();

    const onLocalPublished = () => stopProcessors();
    try {
      localParticipant.on && localParticipant.on('localTrackPublished', onLocalPublished);
      localParticipant.on && localParticipant.on('trackProcessorUpdate', onLocalPublished);
      localParticipant.on && localParticipant.on('TrackProcessorUpdate', onLocalPublished);
    } catch (e) {}

    return () => {
      try {
        localParticipant.off && localParticipant.off('localTrackPublished', onLocalPublished);
        localParticipant.off && localParticipant.off('trackProcessorUpdate', onLocalPublished);
        localParticipant.off && localParticipant.off('TrackProcessorUpdate', onLocalPublished);
      } catch (e) {}
    };
  }, [localParticipant]);

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
            {sidePanel === 'participants' && <ParticipantList raiseHands={raiseHands} isModerator={isModerator} onAction={(action, target) => {
              const me = localParticipant?.identity;
              const participant = participants.find(p => p.identity === target);
              const micPub = participant?.getTrackPublication?.('microphone');
              const trackSid = micPub?.trackSid;

              const safeFetch = async (url, payload) => {
                try {
                  await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
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
                  safeFetch('/api/livekit/mute', { roomName: roomData.meetingId, participantName: target, trackSid, muted: true });
                }
                sendSignal(new TextEncoder().encode(JSON.stringify({ type: 'moderation', action: 'mute', target })), { reliable: true });
              } else if (action === 'remove') {
                safeFetch('/api/livekit/kick', { roomName: roomData.meetingId, participantName: target, revoke: true });
                sendSignal(new TextEncoder().encode(JSON.stringify({ type: 'moderation', action: 'kick', target })), { reliable: true });
              } else if (action === 'promote') {
                fetch('/api/livekit/promote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomName: roomData.meetingId, participantName: target }) })
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
            // raise/lower hand toggle
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
        </div>
      </div>

      <RoomAudioRenderer />
    </div>
  );
}

export default function Room({ roomData, onLeave }) {
  const { t } = useLang();

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
      // disconnect local participant
      onLeave();
    }
    function onModerationMute() {
      // dispatch event to RoomContent to ensure mic is muted
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
      video={effectiveRoomData.role === 'host' || effectiveRoomData.role === 'cohost' ? { width: 1280, height: 720, frameRate: 30, simulcast: true } : { width: 640, height: 360, frameRate: 15, simulcast: true }}
      audio={{ echoCancellation: false, noiseSuppression: false, autoGainControl: false }}
      options={{
        adaptiveStream: true,
        dynacast: true,
        stopLocalTrackOnUnpublish: false,
        webAudioMix: true,
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
