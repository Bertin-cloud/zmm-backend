import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';
import './Navbar.css';

export default function Navbar({ onNav, currentPage }) {
  const { user, logout, isAdmin } = useAuth();
  const { t, lang, changeLang, languages } = useLang();

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <div className="navbar-logo">
          <span className="logo-icon">ZM</span>
          <span className="logo-text">{t('appName')}</span>
        </div>
        <span className="navbar-tagline">{t('appTagline')}</span>
      </div>

      {user && (
        <div className="navbar-links">
          <button
            className={`nav-link ${currentPage === 'dashboard' ? 'active' : ''}`}
            onClick={() => onNav('dashboard')}
          >{t('dashboard')}</button>
          {isAdmin && (
            <button
              className={`nav-link ${currentPage === 'admin' ? 'active' : ''}`}
              onClick={() => onNav('admin')}
            >{t('adminPanel')}</button>
          )}
        </div>
      )}

      <div className="navbar-right">
        <select
          className="lang-select"
          value={lang}
          onChange={e => changeLang(e.target.value)}
        >
          <option value="en">EN</option>
          <option value="fr">FR</option>
          <option value="rw">RW</option>
        </select>

        {user ? (
          <div className="navbar-user">
            <div className="user-avatar">{user.username[0].toUpperCase()}</div>
            <span className="user-name">{user.username}</span>
            <span className={`badge badge-${user.role === 'admin' ? 'blue' : 'green'}`}>{t(user.role)}</span>
            <button className="btn btn-ghost btn-sm" onClick={logout}>{t('logout')}</button>
          </div>
        ) : null}
      </div>
    </nav>
  );
}
