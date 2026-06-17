import React, { createContext, useContext, useState } from 'react';

const translations = {
  en: {
    appName: 'ZMM', appTagline: 'Zoom Meeting Model',
    login: 'Login', logout: 'Logout', username: 'Username', password: 'Password',
    joinMeeting: 'Join Meeting', createMeeting: 'Create Meeting',
    meetingId: 'Meeting ID', meetingTitle: 'Meeting Title',
    host: 'Host', cohost: 'Co-host', participant: 'Participant', admin: 'Admin',
    participants: 'Participants', chat: 'Chat', announcements: 'Announcements',
    meetings: 'Meetings', dashboard: 'Dashboard',
    enterMeetingId: 'Enter Meeting ID', enterPassword: 'Enter Password',
    enterName: 'Your Name', join: 'Join', create: 'Create',
    type: 'Type', main: 'Main Meeting', breakout: 'Breakout Room',
    copyLink: 'Copy Link', delete: 'Delete', noMeetings: 'No meetings yet',
    sendMessage: 'Type a message...', send: 'Send',
    mute: 'Mute', unmute: 'Unmute', video: 'Video', screen: 'Share Screen',
    leave: 'Leave', endMeeting: 'End Meeting',
    newAnnouncement: 'New Announcement', title: 'Title', message: 'Message',
    post: 'Post', noAnnouncements: 'No announcements',
    invalidCredentials: 'Invalid credentials', error: 'Error',
    linkCopied: 'Link copied!', language: 'Language',
    welcome: 'Welcome back', adminPanel: 'Admin Panel',
    guestJoin: 'Join as Guest', displayName: 'Display Name',
    wrongPassword: 'Wrong password', meetingNotFound: 'Meeting not found',
  },
  fr: {
    appName: 'ZMM', appTagline: 'Modèle de Réunion Zoom',
    login: 'Connexion', logout: 'Déconnexion', username: 'Identifiant', password: 'Mot de passe',
    joinMeeting: 'Rejoindre', createMeeting: 'Créer une réunion',
    meetingId: 'ID Réunion', meetingTitle: 'Titre de la réunion',
    host: 'Hôte', cohost: 'Co-hôte', participant: 'Participant', admin: 'Admin',
    participants: 'Participants', chat: 'Chat', announcements: 'Annonces',
    meetings: 'Réunions', dashboard: 'Tableau de bord',
    enterMeetingId: "Entrez l'ID de réunion", enterPassword: 'Entrez le mot de passe',
    enterName: 'Votre nom', join: 'Rejoindre', create: 'Créer',
    type: 'Type', main: 'Réunion principale', breakout: 'Salle de sous-groupe',
    copyLink: 'Copier le lien', delete: 'Supprimer', noMeetings: 'Aucune réunion',
    sendMessage: 'Tapez un message...', send: 'Envoyer',
    mute: 'Muet', unmute: 'Activer', video: 'Vidéo', screen: 'Partager',
    leave: 'Partir', endMeeting: 'Terminer',
    newAnnouncement: 'Nouvelle annonce', title: 'Titre', message: 'Message',
    post: 'Publier', noAnnouncements: 'Aucune annonce',
    invalidCredentials: 'Identifiants incorrects', error: 'Erreur',
    linkCopied: 'Lien copié!', language: 'Langue',
    welcome: 'Bon retour', adminPanel: 'Panneau admin',
    guestJoin: 'Rejoindre en invité', displayName: 'Nom affiché',
    wrongPassword: 'Mauvais mot de passe', meetingNotFound: 'Réunion introuvable',
  },
  rw: {
    appName: 'ZMM', appTagline: 'Sisitemu y\'Inama',
    login: 'Injira', logout: 'Sohoka', username: 'Izina', password: 'Ijambo banga',
    joinMeeting: 'Injira mu nama', createMeeting: 'Kora inama',
    meetingId: 'Indangamuntu y\'inama', meetingTitle: 'Izina ry\'inama',
    host: 'Umutumizi', cohost: 'Umufasha', participant: 'Uwitabiriye', admin: 'Umuyobozi',
    participants: 'Abitabiriye', chat: 'Ikiganiro', announcements: 'Amatangazo',
    meetings: 'Inama', dashboard: 'Ikibaho',
    enterMeetingId: "Injiza ID y'inama", enterPassword: 'Injiza ijambo banga',
    enterName: 'Izina ryawe', join: 'Injira', create: 'Kora',
    type: 'Ubwoko', main: 'Inama ngenderwaho', breakout: 'Icyumba gito',
    copyLink: 'Gutunga link', delete: 'Siba', noMeetings: 'Nta nama',
    sendMessage: 'Andika ubutumwa...', send: 'Ohereza',
    mute: 'Suzuma', unmute: 'Fungura', video: 'Videwo', screen: 'Sangira',
    leave: 'Sohoka', endMeeting: 'Rangiza inama',
    newAnnouncement: 'Itangazo rishya', title: 'Umutwe', message: 'Ubutumwa',
    post: 'Shyira', noAnnouncements: 'Nta matangazo',
    invalidCredentials: 'Amakuru atari yo', error: 'Ikosa',
    linkCopied: 'Link yakuweho!', language: 'Ururimi',
    welcome: 'Murakaza neza', adminPanel: 'Icyumba cy\'umuyobozi',
    guestJoin: 'Injira nk\'inshuti', displayName: 'Izina rigaragara',
    wrongPassword: 'Ijambo banga ritari ryo', meetingNotFound: 'Inama ntiboneka',
  }
};

const LangContext = createContext();

export function LangProvider({ children }) {
  const [lang, setLang] = useState(localStorage.getItem('zmm_lang') || 'en');
  const t = (key) => translations[lang]?.[key] || translations.en[key] || key;
  function changeLang(l) { setLang(l); localStorage.setItem('zmm_lang', l); }
  return (
    <LangContext.Provider value={{ lang, changeLang, t, languages: ['en', 'fr', 'rw'] }}>
      {children}
    </LangContext.Provider>
  );
}

export const useLang = () => useContext(LangContext);
