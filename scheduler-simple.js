/**
 * Simple WhatsApp Scheduler
 * Checks database every 60 seconds and sends pending messages
 */

require('dotenv').config();
const whatsapp = require('./whatsapp-listener');
const Database = require('better-sqlite3');
const path = require('path');

// Database connection
const dbPath = path.join(__dirname, 'data', 'whatsapp.db');
const db = new Database(dbPath);

console.log('📦 Scheduler starting...');
console.log(`📊 Database: ${dbPath}`);

/**
 * Get pending messages that are ready to be sent
 */
function getPendingMessages() {
  const query = `
    SELECT
      id,
      to_phone,
      message,
      contact_name,
      scheduled_at
    FROM scheduled_messages
    WHERE status = 'pending'
      AND datetime(scheduled_at) <= datetime('now')
    ORDER BY scheduled_at ASC
  `;

  return db.prepare(query).all();
}

/**
 * Update message status after sending
 */
function updateMessageStatus(messageId, status, errorMessage = null) {
  const query = `
    UPDATE scheduled_messages
    SET
      status = ?,
      sent_at = datetime('now'),
      error_message = ?
    WHERE id = ?
  `;

  db.prepare(query).run(status, errorMessage, messageId);
}

/**
 * Check for pending messages and send them
 */
async function checkAndSendMessages() {
  try {
    // Check if WhatsApp is connected
    if (!whatsapp.isWhatsAppConnected()) {
      console.log('⏳ WhatsApp not connected yet, skipping check...');
      return;
    }

    // Get pending messages
    const pendingMessages = getPendingMessages();

    if (pendingMessages.length === 0) {
      console.log('✓ No messages to send');
      return;
    }

    console.log(`📬 Found ${pendingMessages.length} message(s) to send`);

    // Send each message
    for (const msg of pendingMessages) {
      try {
        console.log(`📤 Sending to ${msg.contact_name} (${msg.to_phone}): "${msg.message}"`);

        await whatsapp.sendMessage(msg.to_phone, msg.message);

        // Mark as sent
        updateMessageStatus(msg.id, 'sent');
        console.log(`✅ Message ${msg.id} sent successfully`);

      } catch (error) {
        console.error(`❌ Failed to send message ${msg.id}:`, error.message);

        // Mark as failed
        updateMessageStatus(msg.id, 'failed', error.message);
      }
    }

  } catch (error) {
    console.error('❌ Scheduler error:', error);
  }
}

// Run scheduler every 60 seconds
console.log('⏰ Scheduler will check every 60 seconds');
setInterval(checkAndSendMessages, 60 * 1000);

// Run immediately on startup
setTimeout(checkAndSendMessages, 5000); // Wait 5 seconds for WhatsApp to connect

// Keep process alive
console.log('🚀 Scheduler is running...');
