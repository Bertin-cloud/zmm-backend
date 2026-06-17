import React, { useState, useEffect, useRef } from 'react';
import { useDataChannel, useLocalParticipant, useParticipants } from '@livekit/components-react';
import { useLang } from '../context/LangContext';
import './Chat.css';

export default function Chat({ displayName }) {
  const { t } = useLang();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const bottomRef = useRef();
  const { localParticipant } = useLocalParticipant();

  const { send, message } = useDataChannel('chat', (msg) => {
    try {
      const decoded = new TextDecoder().decode(msg.payload);
      const data = JSON.parse(decoded);
      // only show messages intended for us or for all
      const localId = localParticipant?.identity;
      if (!data.recipient || data.recipient === 'all' || data.recipient === localId || data.sender === localId) {
        setMessages(prev => [...prev, { ...data, id: Date.now() + Math.random() }]);
      }
    } catch {}
  });

  const participants = useParticipants();
  const [recipient, setRecipient] = useState('all');

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function sendMessage(e) {
    e.preventDefault();
    if (!input.trim()) return;
    const data = { sender: displayName || localParticipant?.identity || 'You', text: input.trim(), time: new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}), recipient };
    // Also add to local messages immediately
    setMessages(prev => [...prev, { ...data, id: Date.now(), isSelf: true }]);
    send(new TextEncoder().encode(JSON.stringify(data)), { reliable: true });
    setInput('');
  }

  return (
    <div className="sidebar-section chat-section">
      <div className="sidebar-title">💬 {t('chat')}</div>
      <div className="chat-messages">
        {messages.length === 0 && <div className="chat-empty">No messages yet</div>}
        {messages.map(m => (
          <div key={m.id} className={`chat-msg ${m.isSelf ? 'self' : ''}`}>
            {!m.isSelf && <div className="chat-sender">{m.sender}</div>}
            <div className="chat-bubble">{m.text}</div>
            <div className="chat-time">{m.time}</div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={sendMessage} className="chat-input-row">
        <select value={recipient} onChange={e => setRecipient(e.target.value)} className="chat-recipient-select">
          <option value="all">All</option>
          {participants.map(p => (
            <option key={p.identity} value={p.identity}>{p.identity}</option>
          ))}
        </select>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={t('sendMessage')}
        />
        <button type="submit" className="btn btn-primary btn-sm">➤</button>
      </form>
    </div>
  );
}
