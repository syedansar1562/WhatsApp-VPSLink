/**
 * Database Abstraction Layer
 *
 * Purpose: Provide a clean interface to SQLite (or future Postgres)
 * Location: /root/whatsapp-vpslink/src/db.js
 *
 * Design: Database-agnostic API that can swap SQLite <-> Postgres
 * with zero changes to consuming code (API server, scheduler, etc.)
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

class WhatsAppDatabase {
  constructor() {
    const dbPath = path.join(__dirname, '..', 'data', 'whatsapp.db');

    // Ensure data directory exists
    const dataDir = path.dirname(dbPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    this.db = new Database(dbPath);

    // Enable WAL mode for better concurrency
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');

    console.log('[DB] Connected to SQLite database at', dbPath);
  }

  // ============================================================================
  // CONTACTS
  // ============================================================================

  /**
   * Get all contacts with optional filtering
   * @param {Object} filters - { search, favorite, limit, offset }
   * @returns {Array} Array of contacts
   */
  getAllContacts(filters = {}) {
    const { search, favorite, limit = 100, offset = 0 } = filters;

    let sql = 'SELECT * FROM contacts WHERE 1=1';
    const params = [];

    if (search) {
      sql += ` AND (
        name LIKE ? OR
        phone LIKE ? OR
        aliases LIKE ?
      )`;
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (favorite !== undefined) {
      sql += ' AND is_favorite = ?';
      params.push(favorite ? 1 : 0);
    }

    sql += ' ORDER BY name COLLATE NOCASE ASC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const contacts = this.db.prepare(sql).all(...params);

    // Parse JSON fields
    return contacts.map(c => ({
      ...c,
      aliases: JSON.parse(c.aliases || '[]'),
      tags: JSON.parse(c.tags || '[]'),
      is_favorite: Boolean(c.is_favorite)
    }));
  }

  /**
   * Get total count of contacts (for pagination)
   * @param {Object} filters - { search, favorite }
   * @returns {number} Total count
   */
  getContactsCount(filters = {}) {
    const { search, favorite } = filters;

    let sql = 'SELECT COUNT(*) as count FROM contacts WHERE 1=1';
    const params = [];

    if (search) {
      sql += ` AND (
        name LIKE ? OR
        phone LIKE ? OR
        aliases LIKE ?
      )`;
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (favorite !== undefined) {
      sql += ' AND is_favorite = ?';
      params.push(favorite ? 1 : 0);
    }

    const result = this.db.prepare(sql).get(...params);
    return result.count;
  }

  /**
   * Get a single contact by phone
   * @param {string} phone - Phone number (without @s.whatsapp.net)
   * @returns {Object|null} Contact object or null
   */
  getContact(phone) {
    const contact = this.db.prepare('SELECT * FROM contacts WHERE phone = ?').get(phone);

    if (!contact) return null;

    return {
      ...contact,
      aliases: JSON.parse(contact.aliases || '[]'),
      tags: JSON.parse(contact.tags || '[]'),
      is_favorite: Boolean(contact.is_favorite)
    };
  }

  /**
   * Create a new contact
   * @param {Object} data - { phone, name, aliases, tags, is_favorite }
   * @returns {Object} Created contact
   */
  createContact(data) {
    const { phone, name, aliases = [], tags = [], is_favorite = false } = data;

    const stmt = this.db.prepare(`
      INSERT INTO contacts (phone, name, aliases, tags, is_favorite)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(
      phone,
      name,
      JSON.stringify(aliases),
      JSON.stringify(tags),
      is_favorite ? 1 : 0
    );

    return this.getContact(phone);
  }

  /**
   * Update an existing contact
   * @param {string} phone - Phone number
   * @param {Object} data - Fields to update
   * @returns {Object} Updated contact
   */
  updateContact(phone, data) {
    const fields = [];
    const values = [];

    if (data.name !== undefined) {
      fields.push('name = ?');
      values.push(data.name);
    }
    if (data.aliases !== undefined) {
      fields.push('aliases = ?');
      values.push(JSON.stringify(data.aliases));
    }
    if (data.tags !== undefined) {
      fields.push('tags = ?');
      values.push(JSON.stringify(data.tags));
    }
    if (data.is_favorite !== undefined) {
      fields.push('is_favorite = ?');
      values.push(data.is_favorite ? 1 : 0);
    }

    if (fields.length === 0) {
      return this.getContact(phone);
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');

    const sql = `UPDATE contacts SET ${fields.join(', ')} WHERE phone = ?`;
    values.push(phone);

    this.db.prepare(sql).run(...values);

    return this.getContact(phone);
  }

  /**
   * Delete a contact
   * @param {string} phone - Phone number
   * @returns {boolean} True if deleted
   */
  deleteContact(phone) {
    const result = this.db.prepare('DELETE FROM contacts WHERE phone = ?').run(phone);
    return result.changes > 0;
  }

  // ============================================================================
  // SCHEDULED MESSAGES
  // ============================================================================

  /**
   * Get all scheduled messages with optional filtering
   * @param {Object} filters - { status, limit, offset }
   * @returns {Array} Array of scheduled messages
   */
  getAllScheduledMessages(filters = {}) {
    const { status, limit = 100, offset = 0 } = filters;

    let sql = 'SELECT * FROM scheduled_messages WHERE 1=1';
    const params = [];

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    sql += ' ORDER BY scheduled_at ASC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    return this.db.prepare(sql).all(...params);
  }

  /**
   * Get pending scheduled messages (for scheduler)
   * @returns {Array} Array of pending messages due now
   */
  getPendingMessages() {
    const sql = `
      SELECT * FROM scheduled_messages
      WHERE status = 'pending'
        AND datetime(scheduled_at) <= datetime('now')
      ORDER BY scheduled_at ASC
    `;
    return this.db.prepare(sql).all();
  }

  /**
   * Get a single scheduled message
   * @param {string} id - Message ID
   * @returns {Object|null} Scheduled message or null
   */
  getScheduledMessage(id) {
    return this.db.prepare('SELECT * FROM scheduled_messages WHERE id = ?').get(id);
  }

  /**
   * Create a scheduled message
   * @param {Object} data - { id, to_phone, contact_name, message, scheduled_at }
   * @returns {Object} Created message
   */
  createScheduledMessage(data) {
    const { id, to_phone, contact_name, message, scheduled_at } = data;

    const stmt = this.db.prepare(`
      INSERT INTO scheduled_messages (id, to_phone, contact_name, message, scheduled_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(id, to_phone, contact_name, message, scheduled_at);

    return this.getScheduledMessage(id);
  }

  /**
   * Update scheduled message status
   * @param {string} id - Message ID
   * @param {string} status - New status (pending|sent|failed)
   * @param {string} errorMessage - Error message if failed
   * @returns {Object} Updated message
   */
  updateMessageStatus(id, status, errorMessage = null) {
    let sql = 'UPDATE scheduled_messages SET status = ?';
    const params = [status];

    if (status === 'sent') {
      sql += ', sent_at = datetime("now")';
    }

    if (errorMessage) {
      sql += ', error_message = ?';
      params.push(errorMessage);
    }

    sql += ' WHERE id = ?';
    params.push(id);

    this.db.prepare(sql).run(...params);

    return this.getScheduledMessage(id);
  }

  /**
   * Update a scheduled message (only if pending)
   * @param {string} id - Message ID
   * @param {Object} data - Fields to update
   * @returns {Object|null} Updated message or null if not pending
   */
  updateScheduledMessage(id, data) {
    // Check if message is pending
    const message = this.getScheduledMessage(id);
    if (!message || message.status !== 'pending') {
      return null;
    }

    const fields = [];
    const values = [];

    if (data.message !== undefined) {
      fields.push('message = ?');
      values.push(data.message);
    }
    if (data.scheduled_at !== undefined) {
      fields.push('scheduled_at = ?');
      values.push(data.scheduled_at);
    }

    if (fields.length === 0) {
      return message;
    }

    const sql = `UPDATE scheduled_messages SET ${fields.join(', ')} WHERE id = ?`;
    values.push(id);

    this.db.prepare(sql).run(...values);

    return this.getScheduledMessage(id);
  }

  /**
   * Delete a scheduled message
   * @param {string} id - Message ID
   * @returns {boolean} True if deleted
   */
  deleteScheduledMessage(id) {
    const result = this.db.prepare('DELETE FROM scheduled_messages WHERE id = ?').run(id);
    return result.changes > 0;
  }

  // ============================================================================
  // JOBS (Multi-Message)
  // ============================================================================

  /**
   * Get all jobs with optional filtering
   * @param {Object} filters - { status }
   * @returns {Array} Array of jobs
   */
  getAllJobs(filters = {}) {
    const { status } = filters;

    let sql = 'SELECT * FROM jobs WHERE 1=1';
    const params = [];

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    sql += ' ORDER BY scheduled_start_at ASC';

    const jobs = this.db.prepare(sql).all(...params);

    // Parse JSON fields
    return jobs.map(j => ({
      ...j,
      config: JSON.parse(j.config),
      message_parts: JSON.parse(j.message_parts),
      recipients: JSON.parse(j.recipients),
      recipient_count: JSON.parse(j.recipients).length,
      message_parts_count: JSON.parse(j.message_parts).length
    }));
  }

  /**
   * Get pending jobs (for scheduler)
   * @returns {Array} Array of pending jobs due now
   */
  getPendingJobs() {
    const sql = `
      SELECT * FROM jobs
      WHERE status = 'pending'
        AND datetime(scheduled_start_at) <= datetime('now')
      ORDER BY scheduled_start_at ASC
    `;

    const jobs = this.db.prepare(sql).all();

    return jobs.map(j => ({
      ...j,
      config: JSON.parse(j.config),
      message_parts: JSON.parse(j.message_parts),
      recipients: JSON.parse(j.recipients)
    }));
  }

  /**
   * Get a single job
   * @param {string} id - Job ID
   * @returns {Object|null} Job object or null
   */
  getJob(id) {
    const job = this.db.prepare('SELECT * FROM jobs WHERE id = ?').get(id);

    if (!job) return null;

    return {
      ...job,
      config: JSON.parse(job.config),
      message_parts: JSON.parse(job.message_parts),
      recipients: JSON.parse(job.recipients),
      progress: {
        current_recipient_index: job.current_recipient_index,
        current_part_index: job.current_part_index,
        recipients_sent: job.recipients_sent,
        recipients_failed: job.recipients_failed,
        last_sent_at: job.last_sent_at
      }
    };
  }

  /**
   * Create a job
   * @param {Object} data - Job data
   * @returns {Object} Created job
   */
  createJob(data) {
    const {
      id,
      title,
      scheduled_start_at,
      config,
      message_parts,
      recipients
    } = data;

    const stmt = this.db.prepare(`
      INSERT INTO jobs (
        id, title, scheduled_start_at, config, message_parts, recipients
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      title,
      scheduled_start_at,
      JSON.stringify(config),
      JSON.stringify(message_parts),
      JSON.stringify(recipients)
    );

    return this.getJob(id);
  }

  /**
   * Update job progress
   * @param {string} id - Job ID
   * @param {Object} progress - Progress data
   * @returns {Object} Updated job
   */
  updateJobProgress(id, progress) {
    const fields = [];
    const values = [];

    if (progress.status !== undefined) {
      fields.push('status = ?');
      values.push(progress.status);
    }
    if (progress.current_recipient_index !== undefined) {
      fields.push('current_recipient_index = ?');
      values.push(progress.current_recipient_index);
    }
    if (progress.current_part_index !== undefined) {
      fields.push('current_part_index = ?');
      values.push(progress.current_part_index);
    }
    if (progress.recipients_sent !== undefined) {
      fields.push('recipients_sent = ?');
      values.push(progress.recipients_sent);
    }
    if (progress.recipients_failed !== undefined) {
      fields.push('recipients_failed = ?');
      values.push(progress.recipients_failed);
    }
    if (progress.last_sent_at !== undefined) {
      fields.push('last_sent_at = ?');
      values.push(progress.last_sent_at);
    }
    if (progress.status === 'completed') {
      fields.push('completed_at = datetime("now")');
    }

    if (fields.length === 0) {
      return this.getJob(id);
    }

    const sql = `UPDATE jobs SET ${fields.join(', ')} WHERE id = ?`;
    values.push(id);

    this.db.prepare(sql).run(...values);

    return this.getJob(id);
  }

  /**
   * Delete a job
   * @param {string} id - Job ID
   * @returns {boolean} True if deleted
   */
  deleteJob(id) {
    const result = this.db.prepare('DELETE FROM jobs WHERE id = ?').run(id);
    return result.changes > 0;
  }

  // ============================================================================
  // CHATS
  // ============================================================================

  /**
   * Get all chats with optional filtering
   * @param {Object} filters - { unread, limit, offset }
   * @returns {Array} Array of chats
   */
  getAllChats(filters = {}) {
    const { unread, limit = 20, offset = 0 } = filters;

    let sql = 'SELECT * FROM v_recent_chats WHERE 1=1';
    const params = [];

    if (unread) {
      sql += ' AND unread_count > 0';
    }

    sql += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);

    return this.db.prepare(sql).all(...params);
  }

  /**
   * Get a single chat
   * @param {string} chatId - Chat ID (JID)
   * @returns {Object|null} Chat object or null
   */
  getChat(chatId) {
    return this.db.prepare('SELECT * FROM chats WHERE id = ?').get(chatId);
  }

  /**
   * Create or update chat
   * @param {Object} data - Chat data
   * @returns {Object} Chat object
   */
  upsertChat(data) {
    const { id, name, is_group, unread_count, last_message_time } = data;

    const stmt = this.db.prepare(`
      INSERT INTO chats (id, name, is_group, unread_count, last_message_time)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = ?,
        unread_count = ?,
        last_message_time = ?
    `);

    stmt.run(
      id, name, is_group ? 1 : 0, unread_count || 0, last_message_time,
      name, unread_count || 0, last_message_time
    );

    return this.getChat(id);
  }

  /**
   * Mark chat as read
   * @param {string} chatId - Chat ID
   * @returns {boolean} True if updated
   */
  markChatAsRead(chatId) {
    const result = this.db.prepare(
      'UPDATE chats SET unread_count = 0 WHERE id = ?'
    ).run(chatId);
    return result.changes > 0;
  }

  /**
   * Add message to chat
   * @param {Object} data - Message data
   * @returns {Object} Created message
   */
  addMessage(data) {
    const { chat_id, message, timestamp, is_from_me, message_type, raw_message } = data;

    const stmt = this.db.prepare(`
      INSERT INTO messages (
        chat_id, message, timestamp, is_from_me, message_type, raw_message
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    const info = stmt.run(
      chat_id,
      message,
      timestamp,
      is_from_me ? 1 : 0,
      message_type || 'text',
      raw_message ? JSON.stringify(raw_message) : null
    );

    // Update chat last_message_time and unread_count
    this.db.prepare(`
      UPDATE chats
      SET last_message_time = ?,
          unread_count = unread_count + CASE WHEN ? THEN 0 ELSE 1 END
      WHERE id = ?
    `).run(timestamp, is_from_me ? 1 : 0, chat_id);

    return { id: info.lastInsertRowid, ...data };
  }

  /**
   * Get messages for a chat
   * @param {string} chatId - Chat ID
   * @param {number} limit - Max messages
   * @returns {Array} Array of messages
   */
  getChatMessages(chatId, limit = 100) {
    const sql = `
      SELECT * FROM messages
      WHERE chat_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `;

    const messages = this.db.prepare(sql).all(chatId, limit);

    return messages.map(m => ({
      ...m,
      raw_message: m.raw_message ? JSON.parse(m.raw_message) : null,
      is_from_me: Boolean(m.is_from_me)
    })).reverse(); // Reverse to show oldest first
  }

  // ============================================================================
  // STATISTICS
  // ============================================================================

  /**
   * Get system statistics
   * @returns {Object} Statistics object
   */
  getStats() {
    const contacts = this.db.prepare('SELECT COUNT(*) as count FROM contacts').get().count;

    const scheduled = this.db.prepare(`
      SELECT
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM scheduled_messages
    `).get();

    const jobs = this.db.prepare(`
      SELECT
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as running,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
      FROM jobs
    `).get();

    const chats = this.db.prepare('SELECT COUNT(*) as count FROM chats').get().count;
    const messages = this.db.prepare('SELECT COUNT(*) as count FROM messages').get().count;

    // Get database file size
    const dbPath = path.join(__dirname, '..', 'data', 'whatsapp.db');
    const dbSizeMB = fs.existsSync(dbPath)
      ? (fs.statSync(dbPath).size / 1024 / 1024).toFixed(2)
      : 0;

    return {
      contacts,
      scheduled_messages: {
        pending: scheduled.pending || 0,
        sent: scheduled.sent || 0,
        failed: scheduled.failed || 0
      },
      jobs: {
        pending: jobs.pending || 0,
        running: jobs.running || 0,
        completed: jobs.completed || 0
      },
      chats,
      messages,
      database_size_mb: parseFloat(dbSizeMB)
    };
  }

  /**
   * Close database connection
   */
  close() {
    this.db.close();
    console.log('[DB] Database connection closed');
  }
}

// Export singleton instance
module.exports = new WhatsAppDatabase();
