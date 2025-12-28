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

/**
 * Delay helper function
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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
 * Execute a single job (all recipients, all message parts)
 */
async function executeJob(job) {
  console.log(`\n[JOB ${job.id}] Starting execution`);
  console.log(`[JOB ${job.id}] Recipients: ${job.recipients.length}`);
  console.log(`[JOB ${job.id}] Message parts: ${job.messageParts.length}`);
  console.log(`[JOB ${job.id}] Total messages: ${job.recipients.length * job.messageParts.length}`);

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

    // Determine starting part index (for crash recovery)
    const startPartIndex = (recipientIndex === job.progress.currentRecipientIndex)
      ? job.progress.currentPartIndex
      : 0;

    let recipientSuccess = true;

    // Process message parts sequentially
    for (let partIndex = startPartIndex; partIndex < job.messageParts.length; partIndex++) {
      const part = job.messageParts[partIndex];

      console.log(`[JOB ${job.id}]   Part ${partIndex + 1}/${job.messageParts.length}`);
      console.log(`[JOB ${job.id}]   Text: "${part.text.substring(0, 50)}${part.text.length > 50 ? '...' : ''}"`);

      // Attempt to send with retries
      let sendSuccess = false;
      const maxRetries = job.config?.maxRetries || 3;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          await whatsapp.sendMessage(recipientJid, part.text);
          console.log(`[JOB ${job.id}]   ✅ Sent successfully`);
          sendSuccess = true;
          job.progress.sentCount++;
          break;
        } catch (error) {
          console.error(`[JOB ${job.id}]   ❌ Attempt ${attempt}/${maxRetries} failed:`, error.message);

          if (attempt < maxRetries) {
            // Exponential backoff: 2s, 4s, 6s...
            const backoffDelay = 2000 * attempt;
            console.log(`[JOB ${job.id}]   ⏱️  Retrying in ${backoffDelay / 1000}s...`);
            await delay(backoffDelay);
          }
        }
      }

      if (!sendSuccess) {
        console.error(`[JOB ${job.id}]   ❌ FAILED after ${maxRetries} attempts`);
        recipientSuccess = false;
        job.progress.failedCount++;
        break; // Skip remaining parts for this recipient
      }

      // Update progress
      job.progress.currentPartIndex = partIndex + 1;
      job.progress.lastSentAt = new Date().toISOString();
      updateJob(job.id, { progress: job.progress });

      // Delay after message (if specified and not last part)
      if (part.delayAfterSeconds && partIndex < job.messageParts.length - 1) {
        console.log(`[JOB ${job.id}]   ⏱️  Waiting ${part.delayAfterSeconds}s before next part...`);
        await delay(part.delayAfterSeconds * 1000);
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

    // Gap between recipients (if not last recipient)
    if (recipientIndex < job.recipients.length - 1) {
      const gap = job.config?.recipientGapSeconds || 30;
      console.log(`[JOB ${job.id}] ⏱️  Gap before next recipient: ${gap}s`);
      await delay(gap * 1000);
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
console.log('🚀 Scheduler is running...');
