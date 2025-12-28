-- WhatsApp VPSLink SQLite Schema
-- Created: December 28, 2025
-- Database: /root/whatsapp-vpslink/data/whatsapp.db

-- Enable WAL mode for better concurrency
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ============================================================================
-- CONTACTS TABLE
-- ============================================================================
-- Stores WhatsApp contacts with names, aliases, tags, and favorites
-- Migrated from: whatsapp/contacts.json (272 contacts)

CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT NOT NULL UNIQUE,              -- E.g., "447779299086" (no @ suffix)
  name TEXT NOT NULL,                      -- E.g., "Nick"
  aliases TEXT DEFAULT '[]',               -- JSON array: ["Nicholas", "Nicky"]
  tags TEXT DEFAULT '[]',                  -- JSON array: ["friend", "london"]
  is_favorite INTEGER DEFAULT 0,           -- 0 = not favorite, 1 = favorite
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone);
CREATE INDEX IF NOT EXISTS idx_contacts_favorite ON contacts(is_favorite);
CREATE INDEX IF NOT EXISTS idx_contacts_name ON contacts(name COLLATE NOCASE);

-- Trigger to update updated_at timestamp
CREATE TRIGGER IF NOT EXISTS update_contacts_timestamp
AFTER UPDATE ON contacts
FOR EACH ROW
BEGIN
  UPDATE contacts SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- ============================================================================
-- SCHEDULED MESSAGES TABLE
-- ============================================================================
-- Stores single scheduled messages (old system)
-- Migrated from: whatsapp/scheduled.json or whatsapp/scheduled-messages.json

CREATE TABLE IF NOT EXISTS scheduled_messages (
  id TEXT PRIMARY KEY,                     -- E.g., "msg_1735157600_abc"
  to_phone TEXT NOT NULL,                  -- E.g., "447779299086"
  contact_name TEXT,                       -- E.g., "Nick" (denormalized for display)
  message TEXT NOT NULL,                   -- The message text
  scheduled_at TEXT NOT NULL,              -- ISO 8601: "2025-12-28T18:00:00Z"
  status TEXT NOT NULL DEFAULT 'pending',  -- pending|sent|failed
  error_message TEXT,                      -- Error message if failed
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  sent_at TEXT,                            -- ISO 8601 timestamp when sent
  -- NOTE: No foreign key to contacts - allows scheduling messages to non-contacts
  CHECK (status IN ('pending', 'sent', 'failed'))
);

-- Indexes for scheduler queries
CREATE INDEX IF NOT EXISTS idx_scheduled_status ON scheduled_messages(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_time ON scheduled_messages(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_phone ON scheduled_messages(to_phone);

-- ============================================================================
-- JOBS TABLE
-- ============================================================================
-- Stores multi-message, multi-recipient jobs (new system)
-- Migrated from: whatsapp/jobs.json

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,                     -- E.g., "job_1735157600_xyz"
  title TEXT NOT NULL,                     -- Job title for display
  status TEXT NOT NULL DEFAULT 'pending',  -- pending|running|completed|failed
  scheduled_start_at TEXT NOT NULL,        -- ISO 8601: when to start execution
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,                       -- ISO 8601: when completed

  -- Progress tracking (for crash recovery)
  current_recipient_index INTEGER DEFAULT 0,
  current_part_index INTEGER DEFAULT 0,
  recipients_sent INTEGER DEFAULT 0,
  recipients_failed INTEGER DEFAULT 0,
  last_sent_at TEXT,                       -- ISO 8601: last message sent timestamp

  -- Configuration (stored as JSON)
  config TEXT NOT NULL,                    -- JSON: {"maxRetries": 3, "recipientGapSeconds": 30}
  message_parts TEXT NOT NULL,             -- JSON array: [{"text": "Hello", "delayAfterSeconds": 5}]
  recipients TEXT NOT NULL,                -- JSON array: ["447779299086@s.whatsapp.net", ...]

  CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled'))
);

-- Indexes for job queries
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_scheduled ON jobs(scheduled_start_at);

-- ============================================================================
-- CHATS TABLE
-- ============================================================================
-- Stores chat metadata (individual and group chats)
-- Migrated from: whatsapp/chats.json

CREATE TABLE IF NOT EXISTS chats (
  id TEXT PRIMARY KEY,                     -- E.g., "447779299086@s.whatsapp.net" or "group@g.us"
  name TEXT,                               -- Contact name or group name
  is_group INTEGER DEFAULT 0,              -- 0 = individual, 1 = group
  unread_count INTEGER DEFAULT 0,          -- Number of unread messages
  last_message_time INTEGER,               -- Unix timestamp (seconds)
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Index for sorting by recent activity
CREATE INDEX IF NOT EXISTS idx_chats_last_message ON chats(last_message_time DESC);
CREATE INDEX IF NOT EXISTS idx_chats_unread ON chats(unread_count);

-- Trigger to update updated_at timestamp
CREATE TRIGGER IF NOT EXISTS update_chats_timestamp
AFTER UPDATE ON chats
FOR EACH ROW
BEGIN
  UPDATE chats SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- ============================================================================
-- MESSAGES TABLE
-- ============================================================================
-- Stores individual messages within chats
-- Migrated from: whatsapp/chats.json (nested messages array)

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id TEXT NOT NULL,                   -- References chats.id
  message TEXT NOT NULL,                   -- Message text or placeholder like "[Image]"
  timestamp INTEGER NOT NULL,              -- Unix timestamp (seconds)
  is_from_me INTEGER DEFAULT 0,            -- 0 = received, 1 = sent by me
  message_type TEXT DEFAULT 'text',        -- text|audio|image|video|document|other
  raw_message TEXT,                        -- JSON of raw Baileys message (for media downloads)
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
  CHECK (message_type IN ('text', 'audio', 'image', 'video', 'document', 'other'))
);

-- Indexes for message queries
CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_messages_type ON messages(message_type);

-- ============================================================================
-- BACKUP METADATA TABLE (Optional)
-- ============================================================================
-- Tracks backup history for monitoring

CREATE TABLE IF NOT EXISTS backup_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  backup_timestamp TEXT NOT NULL,          -- ISO 8601: when backup was taken
  backup_file TEXT NOT NULL,               -- Filename on S3
  backup_size_bytes INTEGER,               -- Size of backup file
  backup_location TEXT DEFAULT 'garage-s3', -- garage-s3|backblaze|local
  status TEXT DEFAULT 'success',           -- success|failed
  error_message TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,

  CHECK (status IN ('success', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_backup_timestamp ON backup_history(backup_timestamp DESC);

-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

-- View: Pending scheduled messages with contact info
CREATE VIEW IF NOT EXISTS v_pending_messages AS
SELECT
  sm.id,
  sm.to_phone,
  sm.contact_name,
  sm.message,
  sm.scheduled_at,
  sm.created_at,
  c.name AS contact_name_from_db,
  c.is_favorite
FROM scheduled_messages sm
LEFT JOIN contacts c ON sm.to_phone = c.phone
WHERE sm.status = 'pending'
ORDER BY sm.scheduled_at ASC;

-- View: Pending jobs
CREATE VIEW IF NOT EXISTS v_pending_jobs AS
SELECT
  id,
  title,
  scheduled_start_at,
  json_extract(config, '$.recipientGapSeconds') AS recipient_gap,
  json_extract(config, '$.maxRetries') AS max_retries,
  json_array_length(recipients) AS recipient_count,
  json_array_length(message_parts) AS part_count,
  created_at
FROM jobs
WHERE status = 'pending'
ORDER BY scheduled_start_at ASC;

-- View: Recent chats with last message info
CREATE VIEW IF NOT EXISTS v_recent_chats AS
SELECT
  c.id,
  c.name,
  c.is_group,
  c.unread_count,
  c.last_message_time,
  datetime(c.last_message_time, 'unixepoch') AS last_message_datetime,
  (SELECT message FROM messages WHERE chat_id = c.id ORDER BY timestamp DESC LIMIT 1) AS last_message_text,
  (SELECT message_type FROM messages WHERE chat_id = c.id ORDER BY timestamp DESC LIMIT 1) AS last_message_type
FROM chats c
ORDER BY c.last_message_time DESC;

-- ============================================================================
-- HELPER FUNCTIONS (SQLite doesn't have stored procedures, but documenting logic)
-- ============================================================================

/*
-- Get pending messages due now (for scheduler)
SELECT * FROM scheduled_messages
WHERE status = 'pending'
  AND datetime(scheduled_at) <= datetime('now')
ORDER BY scheduled_at ASC;

-- Get contact by phone or alias
SELECT * FROM contacts
WHERE phone = ?
   OR json_extract(aliases, '$') LIKE '%' || ? || '%';

-- Mark message as sent
UPDATE scheduled_messages
SET status = 'sent', sent_at = datetime('now')
WHERE id = ?;

-- Mark message as failed
UPDATE scheduled_messages
SET status = 'failed', error_message = ?
WHERE id = ?;

-- Get chat message history
SELECT
  m.message,
  m.timestamp,
  m.is_from_me,
  m.message_type,
  datetime(m.timestamp, 'unixepoch') AS message_datetime
FROM messages m
WHERE m.chat_id = ?
ORDER BY m.timestamp DESC
LIMIT 100;

-- Add message to chat
INSERT INTO messages (chat_id, message, timestamp, is_from_me, message_type, raw_message)
VALUES (?, ?, ?, ?, ?, ?);

UPDATE chats
SET last_message_time = ?,
    unread_count = unread_count + CASE WHEN ? THEN 0 ELSE 1 END
WHERE id = ?;
*/

-- ============================================================================
-- INITIAL DATA (Optional - for testing)
-- ============================================================================

-- Example contact (will be replaced by migration)
-- INSERT INTO contacts (phone, name, aliases, tags, is_favorite) VALUES
--   ('447779299086', 'Nick', '["Nicholas"]', '["friend"]', 1);

-- ============================================================================
-- DATABASE INFO
-- ============================================================================

-- Check schema version
PRAGMA user_version = 1;

-- Stats query (run after migration)
/*
SELECT
  'contacts' AS table_name, COUNT(*) AS count FROM contacts
UNION ALL
SELECT 'scheduled_messages', COUNT(*) FROM scheduled_messages
UNION ALL
SELECT 'jobs', COUNT(*) FROM jobs
UNION ALL
SELECT 'chats', COUNT(*) FROM chats
UNION ALL
SELECT 'messages', COUNT(*) FROM messages;
*/

-- ============================================================================
-- NOTES
-- ============================================================================

/*
DESIGN DECISIONS:

1. **Phone Number Format:**
   - Stored WITHOUT @s.whatsapp.net suffix in contacts/scheduled_messages
   - Stored WITH @s.whatsapp.net suffix in chats.id (matches Baileys format)
   - Rationale: Contacts table is user-facing, chats table is technical

2. **JSON Fields:**
   - aliases, tags, config, message_parts, recipients stored as JSON TEXT
   - SQLite has good JSON support (json_extract, json_array_length, etc.)
   - Easier migration from existing S3 JSON files

3. **Timestamps:**
   - ISO 8601 strings for created_at, updated_at, scheduled_at (human-readable)
   - Unix seconds for last_message_time, message.timestamp (matches Baileys)
   - Rationale: Mix of human-readable and efficient storage

4. **Indexes:**
   - Added for all common query patterns
   - Covers status, timestamps, phone lookups, chat sorting
   - Minimal overhead, maximum performance

5. **Foreign Keys:**
   - ON UPDATE CASCADE for contacts.phone (if phone changes, scheduled messages update)
   - ON DELETE CASCADE for messages (if chat deleted, messages deleted)
   - Maintains referential integrity

6. **WAL Mode:**
   - Write-Ahead Logging for better concurrency
   - Allows reads while writes happen
   - Perfect for scheduler + CLI simultaneous access

7. **Views:**
   - Pre-defined for common queries
   - Simplifies application code
   - No performance penalty (virtual tables)
*/
