-- ============================================================
--  ZMM Database Schema
--  Run this file once to create all tables
--  mysql -u root -p zmm_db < schema.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS zmm_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE zmm_db;

-- ── Users ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    username      VARCHAR(80)  NOT NULL UNIQUE,
    email         VARCHAR(180) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role          ENUM('admin','host','participant') NOT NULL DEFAULT 'participant',
    avatar_url    VARCHAR(512) DEFAULT NULL,
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ── Meetings ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS meetings (
    id                 INT AUTO_INCREMENT PRIMARY KEY,
    meeting_id         VARCHAR(20)  NOT NULL UNIQUE,
    password           VARCHAR(100) NOT NULL,
    title              VARCHAR(255) NOT NULL,
    topic              TEXT         DEFAULT NULL,
    host_id            INT          NOT NULL,
    type               ENUM('main','breakout','webinar') NOT NULL DEFAULT 'main',
    status             ENUM('waiting','live','ended')    NOT NULL DEFAULT 'waiting',
    is_recording       TINYINT(1)   NOT NULL DEFAULT 0,
    parent_meeting_id  VARCHAR(20)  DEFAULT NULL,
    livekit_room       VARCHAR(255) DEFAULT NULL,
    started_at         DATETIME     DEFAULT NULL,
    ended_at           DATETIME     DEFAULT NULL,
    created_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (host_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ── Participants (session log) ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS participants (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    meeting_id  VARCHAR(20)  NOT NULL,
    user_id     INT          DEFAULT NULL,
    name        VARCHAR(120) NOT NULL,
    role        ENUM('host','co-host','participant') NOT NULL DEFAULT 'participant',
    joined_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    left_at     DATETIME DEFAULT NULL,
    is_muted    TINYINT(1) NOT NULL DEFAULT 1,
    is_video_off TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB;

-- ── Chat Messages ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_messages (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    meeting_id  VARCHAR(20)  NOT NULL,
    sender_id   INT          DEFAULT NULL,
    sender_name VARCHAR(120) NOT NULL,
    message     TEXT         NOT NULL,
    is_system   TINYINT(1)   NOT NULL DEFAULT 0,
    sent_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ── Announcements ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS announcements (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    title       VARCHAR(255) NOT NULL,
    message     TEXT         NOT NULL,
    type        ENUM('info','warning','promo') NOT NULL DEFAULT 'info',
    author_id   INT          NOT NULL,
    author_name VARCHAR(120) NOT NULL,
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ── Auth Tokens ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS auth_tokens (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    user_id    INT          NOT NULL,
    token      VARCHAR(512) NOT NULL UNIQUE,
    expires_at DATETIME     NOT NULL,
    created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ── Seed Admin User ───────────────────────────────────────────────────────────
INSERT IGNORE INTO users (username, email, password_hash, role)
VALUES ('Bertin', 'admin@zmm.app', '$2y$12$BertinHashWillBeReplacedOnFirstLogin', 'admin');

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX idx_meetings_meeting_id  ON meetings(meeting_id);
CREATE INDEX idx_meetings_host_id     ON meetings(host_id);
CREATE INDEX idx_meetings_status      ON meetings(status);
CREATE INDEX idx_participants_meeting ON participants(meeting_id);
CREATE INDEX idx_chat_meeting         ON chat_messages(meeting_id);
CREATE INDEX idx_tokens_token         ON auth_tokens(token);
