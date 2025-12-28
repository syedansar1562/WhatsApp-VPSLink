#!/usr/bin/env node

/**
 * S3 to SQLite Migration Script
 *
 * Purpose: Convert existing S3 JSON files to SQLite database
 * Usage: node migrate-s3-to-sqlite.js --input /path/to/json/files --output whatsapp.db
 *
 * Input files expected:
 * - contacts.json
 * - scheduled.json (or scheduled-messages.json)
 * - jobs.json
 * - chats.json
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

// ============================================================================
// CONFIGURATION
// ============================================================================

const args = process.argv.slice(2);
const inputDirIndex = args.indexOf('--input');
const outputIndex = args.indexOf('--output');

if (inputDirIndex === -1 || outputIndex === -1) {
  console.error('Usage: node migrate-s3-to-sqlite.js --input <dir> --output <db-file>');
  console.error('');
  console.error('Example:');
  console.error('  node migrate-s3-to-sqlite.js \\');
  console.error('    --input /tmp/s3-migration \\');
  console.error('    --output whatsapp.db');
  process.exit(1);
}

const INPUT_DIR = args[inputDirIndex + 1];
const OUTPUT_DB = args[outputIndex + 1];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function log(message) {
  console.log(`[MIGRATE] ${message}`);
}

function error(message) {
  console.error(`[ERROR] ${message}`);
  process.exit(1);
}

function readJsonFile(filename) {
  const filepath = path.join(INPUT_DIR, filename);

  if (!fs.existsSync(filepath)) {
    log(`⚠️  File not found: ${filename} (skipping)`);
    return null;
  }

  try {
    const data = fs.readFileSync(filepath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    error(`Failed to read ${filename}: ${err.message}`);
  }
}

// ============================================================================
// DATABASE SETUP
// ============================================================================

log('Setting up SQLite database...');

// Delete existing database if it exists
if (fs.existsSync(OUTPUT_DB)) {
  fs.unlinkSync(OUTPUT_DB);
  log(`Deleted existing database: ${OUTPUT_DB}`);
}

const db = new Database(OUTPUT_DB);
db.pragma('journal_mode = WAL');
// Disable foreign keys during migration to handle missing contact references
db.pragma('foreign_keys = OFF');

log('✓ Database created');

// ============================================================================
// CREATE SCHEMA
// ============================================================================

log('Creating schema...');

const schemaPath = path.join(__dirname, 'schema.sql');
if (!fs.existsSync(schemaPath)) {
  error('schema.sql not found! Make sure it exists in the same directory.');
}

const schema = fs.readFileSync(schemaPath, 'utf8');
db.exec(schema);

log('✓ Schema created');

// ============================================================================
// MIGRATE CONTACTS
// ============================================================================

log('');
log('─'.repeat(60));
log('MIGRATING CONTACTS');
log('─'.repeat(60));

const contactsData = readJsonFile('contacts.json');

if (contactsData && typeof contactsData === 'object') {
  const insertContact = db.prepare(`
    INSERT INTO contacts (phone, name, aliases, tags, is_favorite)
    VALUES (?, ?, ?, ?, ?)
  `);

  let contactCount = 0;

  const insertMany = db.transaction((contacts) => {
    for (const [phone, contactData] of Object.entries(contacts)) {
      if (!phone || !contactData.name) {
        log(`⚠️  Skipping invalid contact: ${phone}`);
        continue;
      }

      // Use primary phone if available, otherwise use the key
      const contactPhone = contactData.phones?.primary || phone;
      const aliases = Array.isArray(contactData.aliases) ? contactData.aliases : [];
      const tags = Array.isArray(contactData.tags) ? contactData.tags : [];
      const is_favorite = contactData.favorite || contactData.is_favorite || false;

      insertContact.run(
        contactPhone,
        contactData.name,
        JSON.stringify(aliases),
        JSON.stringify(tags),
        is_favorite ? 1 : 0
      );

      contactCount++;
    }
  });

  insertMany(contactsData);

  log(`✓ Migrated ${contactCount} contacts`);
} else {
  log('⚠️  No contacts to migrate');
}

// ============================================================================
// MIGRATE SCHEDULED MESSAGES
// ============================================================================

log('');
log('─'.repeat(60));
log('MIGRATING SCHEDULED MESSAGES');
log('─'.repeat(60));

// Try both filenames
let scheduledData = readJsonFile('scheduled.json') ||
                    readJsonFile('scheduled-messages.json');

if (scheduledData) {
  // Handle both array and object formats
  let messages = [];

  if (Array.isArray(scheduledData)) {
    messages = scheduledData;
  } else if (typeof scheduledData === 'object') {
    // Check if it has a 'messages' property
    if (Array.isArray(scheduledData.messages)) {
      messages = scheduledData.messages;
    } else {
      // Convert object to array
      messages = Object.values(scheduledData);
    }
  }

  if (messages.length > 0) {
    const insertMessage = db.prepare(`
      INSERT INTO scheduled_messages (
        id, to_phone, contact_name, message, scheduled_at, status,
        error_message, sent_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let messageCount = 0;

    const insertMany = db.transaction((msgs) => {
      for (const msg of msgs) {
        if (!msg.id || !msg.to || !msg.message) {
          log(`⚠️  Skipping invalid message: ${msg.id || 'unknown'}`);
          continue;
        }

        // Extract phone number
        const to_phone = msg.to.replace(/@s\.whatsapp\.net$/, '');

        // Convert scheduled time to ISO 8601 (handle both scheduledAt and scheduledTime)
        let scheduled_at;
        if (msg.scheduledAt) {
          scheduled_at = new Date(msg.scheduledAt).toISOString();
        } else if (msg.scheduledTime) {
          scheduled_at = new Date(msg.scheduledTime).toISOString();
        } else if (msg.scheduled_at) {
          scheduled_at = new Date(msg.scheduled_at).toISOString();
        } else {
          log(`⚠️  Skipping message without scheduled time: ${msg.id}`);
          continue;
        }

        // Get contact name from contacts table
        const contact = db.prepare('SELECT name FROM contacts WHERE phone = ?').get(to_phone);
        const contact_name = contact ? contact.name : msg.contactName || null;

        const status = msg.status || 'pending';
        const sent_at = msg.sentAt ? new Date(msg.sentAt).toISOString() : null;

        insertMessage.run(
          msg.id,
          to_phone,
          contact_name,
          msg.message,
          scheduled_at,
          status,
          msg.error || msg.errorMessage || null,
          sent_at
        );

        messageCount++;
      }
    });

    insertMany(messages);

    log(`✓ Migrated ${messageCount} scheduled messages`);
  } else {
    log('⚠️  No scheduled messages to migrate');
  }
} else {
  log('⚠️  No scheduled messages to migrate');
}

// ============================================================================
// MIGRATE JOBS
// ============================================================================

log('');
log('─'.repeat(60));
log('MIGRATING JOBS');
log('─'.repeat(60));

const jobsData = readJsonFile('jobs.json');

if (jobsData && Array.isArray(jobsData)) {
  const insertJob = db.prepare(`
    INSERT INTO jobs (
      id, title, status, scheduled_start_at, completed_at,
      current_recipient_index, current_part_index, recipients_sent, recipients_failed,
      last_sent_at, config, message_parts, recipients
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let jobCount = 0;

  const insertMany = db.transaction((jobs) => {
    for (const job of jobs) {
      if (!job.id) {
        log(`⚠️  Skipping invalid job: missing ID`);
        continue;
      }

      // Generate title from first message part if not provided
      let title = job.title;
      if (!title) {
        const messageParts = job.messageParts || job.message_parts || [];
        if (messageParts.length > 0) {
          const firstText = messageParts[0].text || '';
          title = firstText.substring(0, 50) + (firstText.length > 50 ? '...' : '');
        } else {
          title = `Job ${job.id}`;
        }
      }

      const scheduled_start_at = job.scheduledStartAt || job.scheduled_start_at;
      const completed_at = job.completedAt || job.completed_at || null;

      const progress = job.progress || {};

      insertJob.run(
        job.id,
        title,
        job.status || 'pending',
        new Date(scheduled_start_at).toISOString(),
        completed_at ? new Date(completed_at).toISOString() : null,
        progress.currentRecipientIndex || progress.current_recipient_index || 0,
        progress.currentPartIndex || progress.current_part_index || 0,
        progress.recipientsSent || progress.recipients_sent || 0,
        progress.recipientsFailed || progress.recipients_failed || 0,
        progress.lastSentAt || progress.last_sent_at || null,
        JSON.stringify(job.config || { maxRetries: 3, recipientGapSeconds: 30 }),
        JSON.stringify(job.messageParts || job.message_parts || []),
        JSON.stringify(job.recipients || [])
      );

      jobCount++;
    }
  });

  insertMany(jobsData);

  log(`✓ Migrated ${jobCount} jobs`);
} else {
  log('⚠️  No jobs to migrate');
}

// ============================================================================
// MIGRATE CHATS
// ============================================================================

log('');
log('─'.repeat(60));
log('MIGRATING CHATS');
log('─'.repeat(60));

const chatsData = readJsonFile('chats.json');

if (chatsData && typeof chatsData === 'object') {
  const insertChat = db.prepare(`
    INSERT INTO chats (id, name, is_group, unread_count, last_message_time)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertMessage = db.prepare(`
    INSERT INTO messages (
      chat_id, message, timestamp, is_from_me, message_type, raw_message
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);

  let chatCount = 0;
  let messageCount = 0;

  const insertMany = db.transaction((chats) => {
    for (const [chatId, chatData] of Object.entries(chats)) {
      if (!chatData.messages || !Array.isArray(chatData.messages)) {
        continue;
      }

      // Get last message time - handle both number and object timestamps
      const lastMessage = chatData.messages[chatData.messages.length - 1];
      let last_message_time = Math.floor(Date.now() / 1000);
      if (lastMessage && lastMessage.timestamp) {
        if (typeof lastMessage.timestamp === 'number') {
          last_message_time = lastMessage.timestamp;
        } else if (typeof lastMessage.timestamp === 'object' && lastMessage.timestamp.low !== undefined) {
          last_message_time = lastMessage.timestamp.low;
        }
      }

      // Insert chat
      insertChat.run(
        chatId,
        chatData.name || chatData.alias || null,
        chatId.endsWith('@g.us') ? 1 : 0,
        chatData.unreadCount || 0,
        last_message_time
      );

      chatCount++;

      // Insert messages
      for (const msg of chatData.messages) {
        if (!msg.timestamp) continue;

        // Handle timestamp - can be number or object with low/high
        let timestamp;
        if (typeof msg.timestamp === 'number') {
          timestamp = msg.timestamp;
        } else if (typeof msg.timestamp === 'object' && msg.timestamp.low !== undefined) {
          timestamp = msg.timestamp.low;
        } else {
          continue; // Skip messages with invalid timestamps
        }

        const message_type = msg.messageType || 'text';
        const raw_message = (message_type !== 'text' && msg.rawMessage)
          ? JSON.stringify(msg.rawMessage)
          : null;

        insertMessage.run(
          chatId,
          msg.text || msg.message || '[No text]',
          timestamp,
          msg.isFromMe || msg.fromMe || msg.is_from_me ? 1 : 0,
          message_type,
          raw_message
        );

        messageCount++;
      }
    }
  });

  insertMany(chatsData);

  log(`✓ Migrated ${chatCount} chats`);
  log(`✓ Migrated ${messageCount} messages`);
} else {
  log('⚠️  No chats to migrate');
}

// ============================================================================
// VERIFICATION
// ============================================================================

log('');
log('─'.repeat(60));
log('VERIFICATION');
log('─'.repeat(60));

const stats = {
  contacts: db.prepare('SELECT COUNT(*) as count FROM contacts').get().count,
  scheduled_messages: db.prepare('SELECT COUNT(*) as count FROM scheduled_messages').get().count,
  jobs: db.prepare('SELECT COUNT(*) as count FROM jobs').get().count,
  chats: db.prepare('SELECT COUNT(*) as count FROM chats').get().count,
  messages: db.prepare('SELECT COUNT(*) as count FROM messages').get().count
};

log(`Contacts:            ${stats.contacts}`);
log(`Scheduled messages:  ${stats.scheduled_messages}`);
log(`Jobs:                ${stats.jobs}`);
log(`Chats:               ${stats.chats}`);
log(`Messages:            ${stats.messages}`);

// Get database file size
const dbSize = fs.statSync(OUTPUT_DB).size;
const dbSizeMB = (dbSize / 1024 / 1024).toFixed(2);
log(`Database size:       ${dbSizeMB} MB`);

log('');

// Sample queries
log('Sample data:');
log('');

const sampleContacts = db.prepare('SELECT * FROM contacts LIMIT 3').all();
log('First 3 contacts:');
sampleContacts.forEach(c => {
  log(`  - ${c.name} (${c.phone})${c.is_favorite ? ' ⭐' : ''}`);
});

log('');

const pendingMessages = db.prepare("SELECT COUNT(*) as count FROM scheduled_messages WHERE status = 'pending'").get().count;
log(`Pending scheduled messages: ${pendingMessages}`);

const pendingJobs = db.prepare("SELECT COUNT(*) as count FROM jobs WHERE status = 'pending'").get().count;
log(`Pending jobs: ${pendingJobs}`);

// Re-enable foreign keys for production use
db.pragma('foreign_keys = ON');
log('');
log('✓ Re-enabled foreign key constraints');

// Close database
db.close();

// ============================================================================
// COMPLETION
// ============================================================================

log('');
log('─'.repeat(60));
log('✅ MIGRATION COMPLETE');
log('─'.repeat(60));
log('');
log(`Database created: ${OUTPUT_DB}`);
log('');
log('Next steps:');
log('  1. Test database:');
log(`     sqlite3 ${OUTPUT_DB} "SELECT COUNT(*) FROM contacts;"`);
log('');
log('  2. Upload to Doodah VPS:');
log(`     scp ${OUTPUT_DB} root@5.231.56.146:/root/whatsapp-vpslink/data/`);
log('');
log('  3. Verify on VPS:');
log('     ssh root@5.231.56.146');
log('     sqlite3 /root/whatsapp-vpslink/data/whatsapp.db "SELECT COUNT(*) FROM contacts;"');
log('');
log('─'.repeat(60));
