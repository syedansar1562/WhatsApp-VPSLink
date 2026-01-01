/**
 * Enhanced WhatsApp Scheduler with Humanization
 * Checks database every 60 seconds and sends pending messages with natural delays
 *
 * CRITICAL FIXES (Jan 1, 2026):
 * - REMOVED retry logic to prevent duplicate sends
 * - ADDED status re-checks before sending
 * - ADDED "sending" intermediate status
 * - FIXED SQL syntax error (duplicate semicolon)
 * - ADDED idempotency protection
 */

require('dotenv').config();
const whatsapp = require('./whatsapp-listener');
const Database = require('better-sqlite3');
const path = require('path');
const { calculateMessageDelay, delay, getRandomJitter } = require('./humanization-utils');
const config = require('./humanization-config');

// Database connection
const dbPath = path.join(__dirname, 'data', 'whatsapp.db');
const db = new Database(dbPath);

console.log('📦 Scheduler starting...');
console.log(`📊 Database: ${dbPath}`);

// Create idempotency table if it doesn't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS sent_message_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id TEXT NOT NULL,
    job_id TEXT,
    recipient_jid TEXT NOT NULL,
    message_text_hash TEXT NOT NULL,
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(message_id, recipient_jid)
  )
`);

/**
 * Check if message already sent to prevent duplicates
 */
function isAlreadySent(messageId, recipientJid) {
  const result = db.prepare(`
    SELECT id FROM sent_message_log
    WHERE message_id = ? AND recipient_jid = ?
  `).get(messageId, recipientJid);

  return !!result;
}

/**
 * Log sent message to prevent future duplicates
 */
function logSentMessage(messageId, recipientJid, messageText, jobId = null) {
  // Simple hash of message text for deduplication
  const textHash = require('crypto').createHash('md5').update(messageText).digest('hex');

  try {
    db.prepare(`
      INSERT OR IGNORE INTO sent_message_log (message_id, job_id, recipient_jid, message_text_hash)
      VALUES (?, ?, ?, ?)
    `).run(messageId, jobId, recipientJid, textHash);
  } catch (error) {
    console.error('⚠️  Failed to log sent message:', error.message);
    // Don't throw - this is just for safety, not critical
  }
}

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
      actual_send_time,
      scheduled_at
    FROM scheduled_messages
    WHERE status = 'pending'
      AND datetime(COALESCE(actual_send_time, scheduled_at)) <= datetime('now')
    ORDER BY COALESCE(actual_send_time, scheduled_at) ASC
  `;
  // FIX: Removed duplicate semicolon that was here

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
 * FIX: Added status re-checks and idempotency
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

    // Send each message with humanization
    for (const msg of pendingMessages) {
      try {
        // FIX: Re-check status before sending (in case message was cancelled/deleted)
        const currentStatus = db.prepare('SELECT status FROM scheduled_messages WHERE id = ?').get(msg.id);
        if (!currentStatus || currentStatus.status !== 'pending') {
          console.log(`⚠️  Message ${msg.id} status changed to ${currentStatus?.status || 'deleted'}, skipping`);
          continue;
        }

        // FIX: Check idempotency - have we already sent this?
        const recipientJid = msg.to_phone.includes('@') ? msg.to_phone : `${msg.to_phone}@s.whatsapp.net`;
        if (isAlreadySent(msg.id, recipientJid)) {
          console.log(`⚠️  Already sent message ${msg.id} to ${recipientJid}, skipping`);
          updateMessageStatus(msg.id, 'sent'); // Mark as sent in case it wasn't
          continue;
        }

        // FIX: Mark as "sending" BEFORE attempting to send (prevents double-sends)
        updateMessageStatus(msg.id, 'sending');

        console.log(`📤 Sending to ${msg.contact_name || msg.to_phone}: "${msg.message.substring(0, 50)}..."`);

        // FIX: Single send attempt - NO RETRIES
        // WhatsApp's infrastructure handles reliability - retries cause duplicates
        await whatsapp.sendMessage(msg.to_phone, msg.message);

        // Log to prevent duplicates
        logSentMessage(msg.id, recipientJid, msg.message);

        // Mark as sent
        updateMessageStatus(msg.id, 'sent');
        console.log(`✅ Message ${msg.id} sent successfully`);

      } catch (error) {
        console.error(`❌ Failed to send message ${msg.id}:`, error.message);

        // Mark as failed - NO RETRY
        updateMessageStatus(msg.id, 'failed', error.message);
        console.log(`⚠️  Message ${msg.id} marked as failed - no retries to prevent duplicates`);
      }
    }

  } catch (error) {
    console.error('❌ Scheduler error:', error);
  }
}

/**
 * Get pending jobs that are ready to start
 */
function getPendingJobs() {
  const query = `
    SELECT id, job_data, status, scheduled_at
    FROM scheduled_jobs
    WHERE status = 'pending'
      AND datetime(scheduled_at) <= datetime('now')
    ORDER BY scheduled_at ASC
  `;

  const rows = db.prepare(query).all();
  return rows.map(row => ({
    id: row.id,
    status: row.status,
    scheduledStartAt: row.scheduled_at,
    ...JSON.parse(row.job_data)
  }));
}

/**
 * Update job status and data in database
 */
function updateJob(jobId, updates) {
  const now = new Date().toISOString();

  // Get current job data
  const current = db.prepare('SELECT job_data FROM scheduled_jobs WHERE id = ?').get(jobId);
  if (!current) return;

  const jobData = JSON.parse(current.job_data);

  // Merge updates
  Object.assign(jobData, updates);

  // Update database
  db.prepare(`
    UPDATE scheduled_jobs
    SET job_data = ?,
        updated_at = ?
    WHERE id = ?
  `).run(JSON.stringify(jobData), now, jobId);
}

/**
 * Update job status in database
 */
function updateJobStatus(jobId, status) {
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE scheduled_jobs
    SET status = ?,
        updated_at = ?
    WHERE id = ?
  `).run(status, now, jobId);
}

/**
 * Execute a single job (all recipients, all message parts) with HUMANIZATION
 * FIX: Removed retry logic, added status checks, added idempotency
 */
async function executeJob(job) {
  console.log(`\n[JOB ${job.id}] Starting execution with HUMANIZATION`);
  console.log(`[JOB ${job.id}] Recipients: ${job.recipients.length}`);
  console.log(`[JOB ${job.id}] Message parts: ${job.messageParts.length}`);
  console.log(`[JOB ${job.id}] Total messages: ${job.recipients.length * job.messageParts.length}`);

  // FIX: Check job status before starting (in case it was cancelled)
  const currentJob = db.prepare('SELECT status FROM scheduled_jobs WHERE id = ?').get(job.id);
  if (!currentJob || currentJob.status === 'cancelled') {
    console.log(`[JOB ${job.id}] ⚠️  Job was cancelled, aborting`);
    return;
  }

  // Update status to running
  updateJobStatus(job.id, 'running');

  // Initialize progress if not exists or fill in missing fields
  if (!job.progress) {
    job.progress = {
      currentRecipientIndex: 0,
      currentPartIndex: 0,
      recipientsSent: 0,
      recipientsFailed: 0,
      sentCount: 0,
      failedCount: 0
    };
  } else {
    // Ensure all required fields exist
    if (job.progress.currentRecipientIndex === undefined) job.progress.currentRecipientIndex = 0;
    if (job.progress.currentPartIndex === undefined) job.progress.currentPartIndex = 0;
    if (job.progress.recipientsSent === undefined) job.progress.recipientsSent = 0;
    if (job.progress.recipientsFailed === undefined) job.progress.recipientsFailed = 0;
    if (job.progress.sentCount === undefined) job.progress.sentCount = 0;
    if (job.progress.failedCount === undefined) job.progress.failedCount = 0;
  }

  // Process recipients sequentially
  for (let recipientIndex = job.progress.currentRecipientIndex; recipientIndex < job.recipients.length; recipientIndex++) {
    const recipientJid = job.recipients[recipientIndex];

    console.log(`\n[JOB ${job.id}] ────────────────────────────────────`);
    console.log(`[JOB ${job.id}] Recipient ${recipientIndex + 1}/${job.recipients.length}: ${recipientJid}`);

    // FIX: Re-check job status before each recipient (in case cancelled during execution)
    const jobCheck = db.prepare('SELECT status FROM scheduled_jobs WHERE id = ?').get(job.id);
    if (!jobCheck || jobCheck.status === 'cancelled') {
      console.log(`[JOB ${job.id}] ⚠️  Job was cancelled during execution, stopping`);
      return;
    }

    // Determine starting part index (for crash recovery)
    const startPartIndex = (recipientIndex === job.progress.currentRecipientIndex)
      ? job.progress.currentPartIndex
      : 0;

    let recipientSuccess = true;

    // Process message parts sequentially with HUMANIZATION
    for (let partIndex = startPartIndex; partIndex < job.messageParts.length; partIndex++) {
      const part = job.messageParts[partIndex];

      console.log(`[JOB ${job.id}]   Part ${partIndex + 1}/${job.messageParts.length}`);
      console.log(`[JOB ${job.id}]   Text: "${part.text.substring(0, 50)}${part.text.length > 50 ? '...' : ''}"`);
      console.log(`[JOB ${job.id}]   Length: ${part.text.length} characters`);

      // Calculate humanized delay based on message length
      const messageDelay = calculateMessageDelay(part.text);
      console.log(`[JOB ${job.id}]   📊 Calculated delay: ${(messageDelay / 1000).toFixed(1)}s (length-based + jitter)`);

      // FIX: Check idempotency before sending
      const messageId = `${job.id}_r${recipientIndex}_p${partIndex}`;
      if (isAlreadySent(messageId, recipientJid)) {
        console.log(`[JOB ${job.id}]   ⚠️  Already sent part ${partIndex + 1} to ${recipientJid}, skipping`);
        job.progress.sentCount++;
        continue;
      }

      // FIX: Single send attempt - NO RETRIES to prevent duplicates
      let sendSuccess = false;
      try {
        await whatsapp.sendMessage(recipientJid, part.text);
        console.log(`[JOB ${job.id}]   ✅ Sent successfully`);
        sendSuccess = true;
        job.progress.sentCount++;

        // Log to prevent duplicates
        logSentMessage(messageId, recipientJid, part.text, job.id);

      } catch (error) {
        console.error(`[JOB ${job.id}]   ❌ Send failed:`, error.message);
        console.log(`[JOB ${job.id}]   ⚠️  NO RETRY - prevents duplicates. Message marked as failed.`);
        sendSuccess = false;
        job.progress.failedCount++;
      }

      if (!sendSuccess) {
        console.error(`[JOB ${job.id}]   ❌ FAILED - moving to next recipient`);
        recipientSuccess = false;
        break; // Skip remaining parts for this recipient
      }

      // Update progress
      job.progress.currentPartIndex = partIndex + 1;
      job.progress.lastSentAt = new Date().toISOString();
      updateJob(job.id, { progress: job.progress });

      // Apply humanized delay before next part (if not last part)
      if (partIndex < job.messageParts.length - 1) {
        console.log(`[JOB ${job.id}]   ⏱️  Humanized delay: ${(messageDelay / 1000).toFixed(1)}s before next part...`);
        await delay(messageDelay);
      }
    }

    // Update recipient progress
    if (recipientSuccess) {
      job.progress.recipientsSent++;
      console.log(`[JOB ${job.id}] ✅ Recipient completed successfully`);
    } else {
      job.progress.recipientsFailed++;
      console.log(`[JOB ${job.id}] ❌ Recipient failed`);
    }

    job.progress.currentRecipientIndex = recipientIndex + 1;
    job.progress.currentPartIndex = 0; // Reset for next recipient
    updateJob(job.id, { progress: job.progress });

    // Gap between recipients with jitter (if not last recipient)
    if (recipientIndex < job.recipients.length - 1) {
      const baseGap = job.config?.recipientGapSeconds || config.RECIPIENT_GAP;
      const jitter = getRandomJitter();
      const totalGap = baseGap + jitter;
      console.log(`[JOB ${job.id}] ⏱️  Gap before next recipient: ${totalGap.toFixed(1)}s (${baseGap}s + ${jitter.toFixed(1)}s jitter)`);
      await delay(totalGap * 1000);
    }
  }

  // Mark job as completed
  updateJobStatus(job.id, 'completed');

  console.log(`\n[JOB ${job.id}] ═══════════════════════════════════`);
  console.log(`[JOB ${job.id}] ✅ JOB COMPLETED`);
  console.log(`[JOB ${job.id}] Summary:`);
  console.log(`[JOB ${job.id}]   ✅ ${job.progress.recipientsSent} recipients succeeded`);
  console.log(`[JOB ${job.id}]   ❌ ${job.progress.recipientsFailed} recipients failed`);
  console.log(`[JOB ${job.id}]   📊 ${job.progress.sentCount} messages sent, ${job.progress.failedCount} failed`);
  console.log(`[JOB ${job.id}] ═══════════════════════════════════\n`);
}

/**
 * Process scheduled jobs (multi-message, multi-recipient)
 */
async function checkAndProcessJobs() {
  try {
    // Check if WhatsApp is connected
    if (!whatsapp.isWhatsAppConnected()) {
      return; // Already logged in checkAndSendMessages
    }

    // Get pending jobs
    const pendingJobs = getPendingJobs();

    if (pendingJobs.length === 0) {
      return; // No jobs to process
    }

    console.log(`\n[JOBS] Found ${pendingJobs.length} job(s) to execute`);

    // Process each job sequentially
    for (const job of pendingJobs) {
      await executeJob(job);
    }

  } catch (error) {
    console.error('[JOBS] Error processing jobs:', error);
  }
}

// Main scheduler loop - check both messages and jobs
async function runScheduler() {
  await checkAndSendMessages();
  await checkAndProcessJobs();
}

// Run scheduler every 60 seconds
console.log('⏰ Scheduler will check every 60 seconds');
setInterval(runScheduler, 60 * 1000);

// Run immediately on startup
setTimeout(runScheduler, 5000); // Wait 5 seconds for WhatsApp to connect

// Keep process alive
console.log('🚀 Scheduler is running with HUMANIZATION enabled...');
console.log('🛡️  SAFETY FEATURES ENABLED:');
console.log('   - NO RETRIES (prevents duplicates)');
console.log('   - Idempotency checks (tracks sent messages)');
console.log('   - Status re-checks (prevents cancelled messages)');
console.log('   - "Sending" intermediate status (prevents double-sends)');
console.log('📊 Settings:');
console.log(`   - Min delay: ${config.MIN_DELAY}s`);
console.log(`   - Jitter: ${config.JITTER_MIN}-${config.JITTER_MAX}s`);
console.log(`   - Typing indicator: ${config.ENABLE_TYPING_INDICATOR ? 'ON' : 'OFF'}`);
console.log(`   - Long message delay: ~${config.MESSAGE_DELAYS.LONG.baseDelay}s + jitter`);
