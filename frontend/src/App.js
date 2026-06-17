import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LangProvider } from './context/LangContext';
import Navbar from './components/Navbar';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import Admin from './pages/Admin';
import Room from './pages/Room';

function AppContent() {
  const { user } = useAuth();
  const [page, setPage] = useState('dashboard');
  const [activeRoom, setActiveRoom] = useState(null);

  // Check URL for join param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const joinId = params.get('join');
    if (joinId) {
      // Pre-fill join form — handled in Landing
    }
  }, []);

  function handleJoinRoom(roomData) {
    setActiveRoom(roomData);
  }

  function handleLeaveRoom() {
    setActiveRoom(null);
  }

  // If in a meeting room
  if (activeRoom) {
    return <Room roomData={activeRoom} onLeave={handleLeaveRoom} />;
  }

  // Not logged in — show landing
  if (!user) {
    return <Landing onJoinRoom={handleJoinRoom} />;
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar onNav={setPage} currentPage={page} />
      <div style={{ flex: 1 }}>
        {page === 'dashboard' && <Dashboard onJoinRoom={handleJoinRoom} />}
        {page === 'admin' && user?.role === 'admin' && <Admin onJoinRoom={handleJoinRoom} />}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <LangProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </LangProvider>
  );
}
