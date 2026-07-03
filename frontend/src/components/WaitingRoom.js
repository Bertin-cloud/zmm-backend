import React, { useEffect, useState } from 'react';
import { getSocket } from '../utils/api';
import { useLang } from '../context/LangContext';
import './WaitingRoom.css';

// Shown to a guest right after they ask to join. Listens on their private
// socket room for the host's decision — no polling needed, they get let in
// (or turned away) the moment the host clicks a button.
export default function WaitingRoom({ request, onAdmitted, onCancel }) {
  const { t } = useLang();
  const [status, setStatus] = useState('waiting'); // 'waiting' | 'denied'

  useEffect(() => {
    const socket = getSocket();
    socket.emit('guest:watch', request.requestId);

    function handleAdmitted(payload) {
      if (payload.requestId !== request.requestId) return;
      onAdmitted({
        meetingId: payload.meetingId,
        title: payload.title,
        type: payload.type,
        displayName: payload.displayName,
        role: 'participant',
        lkToken: payload.lkToken,
        lkUrl: payload.lkUrl,
      });
    }
    function handleDenied(payload) {
      if (payload.requestId !== request.requestId) return;
      setStatus('denied');
    }

    socket.on('waiting-room:admitted', handleAdmitted);
    socket.on('waiting-room:denied', handleDenied);

    return () => {
      socket.off('waiting-room:admitted', handleAdmitted);
      socket.off('waiting-room:denied', handleDenied);
    };
  }, [request.requestId, onAdmitted]);

  return (
    <div className="waiting-room">
      <div className="waiting-card">
        {status === 'waiting' ? (
          <>
            <div className="waiting-spinner" />
            <h2>{t('waitingForHost')}</h2>
            <p className="waiting-sub">
              {t('waitingRoomAs')} <strong>{request.displayName}</strong>
            </p>
            <p className="waiting-meeting">{request.title}</p>
            <button className="btn btn-ghost" onClick={onCancel}>{t('cancel')}</button>
          </>
        ) : (
          <>
            <div className="waiting-denied-icon">✕</div>
            <h2>{t('requestDenied')}</h2>
            <p className="waiting-sub">{t('requestDeniedHint')}</p>
            <button className="btn btn-ghost" onClick={onCancel}>{t('back')}</button>
          </>
        )}
      </div>
    </div>
  );
}
