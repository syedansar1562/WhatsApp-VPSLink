require('dotenv').config();
const makeWASocket = require('@whiskeysockets/baileys').default;
const { useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const db = require('./src/db');

let sock;
let isConnected = false;

async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');

  sock = makeWASocket({
    auth: state,
    printQRInTerminal: false
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === 'close') {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;

      if (shouldReconnect) {
        console.log('✗ Connection closed, reconnecting in 5 seconds...');
        setTimeout(connectToWhatsApp, 5000);
      }
      isConnected = false;
    } else if (connection === 'open') {
      console.log('✓ Connected to WhatsApp!');
      isConnected = true;
    }
  });
}

async function sendMessage(phoneNumber, message) {
  if (!isConnected) {
    throw new Error('WhatsApp not connected');
  }

  const jid = phoneNumber.includes('@')
    ? phoneNumber
    : phoneNumber + '@s.whatsapp.net';

  try {
    await sock.sendMessage(jid, { text: message });
    console.log('✓ Sent message to ' + phoneNumber);
    return true;
  } catch (error) {
    console.error('✗ Failed to send to ' + phoneNumber + ':', error.message);
    throw error;
  }
}

async function checkAndSendMessages() {
  try {
    // Get pending messages from SQLite
    const pendingMessages = db.getPendingMessages();

    if (pendingMessages.length === 0) {
      console.log('→ No messages to send');
      return;
    }

    console.log('→ Found ' + pendingMessages.length + ' message(s) to send');

    for (const msg of pendingMessages) {
      try {
        console.log('→ Sending: "' + msg.message + '" to ' + msg.contact_name + ' (' + msg.to_phone + ')');

        await sendMessage(msg.to_phone, msg.message);

        // Update status to sent in SQLite
        db.updateMessageStatus(msg.id, 'sent');

      } catch (error) {
        console.error('✗ Error sending message ' + msg.id + ':', error.message);

        // Update status to failed in SQLite
        db.updateMessageStatus(msg.id, 'failed', error.message);
      }
    }

  } catch (error) {
    console.error('✗ Scheduler error:', error.message);
  }
}

// ============================================================================
// MULTI-MESSAGE JOB PROCESSING FUNCTIONS
// ============================================================================

/**
 * Delay helper function
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Process scheduled jobs (multi-message, multi-recipient)
 * Called every 60 seconds alongside checkAndSendMessages()
 */
async function processScheduledJobs() {
  try {
    // Get pending jobs from SQLite
    const pendingJobs = db.getPendingJobs();

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

/**
 * Execute a single job (all recipients, all message parts)
 */
async function executeJob(job) {
  // Parse JSON fields
  const messageParts = JSON.parse(job.message_parts);
  const recipients = JSON.parse(job.recipients);
  const config = JSON.parse(job.config);

  console.log(`\n[JOB ${job.id}] Starting execution`);
  console.log(`[JOB ${job.id}] Recipients: ${recipients.length}`);
  console.log(`[JOB ${job.id}] Message parts: ${messageParts.length}`);
  console.log(`[JOB ${job.id}] Total messages: ${recipients.length * messageParts.length}`);

  // Update status to running
  db.updateJobProgress(job.id, {
    status: 'running'
  });

  // Process recipients sequentially
  for (let recipientIndex = job.current_recipient_index; recipientIndex < recipients.length; recipientIndex++) {
    const recipientJid = recipients[recipientIndex];

    console.log(`\n[JOB ${job.id}] ────────────────────────────────────`);
    console.log(`[JOB ${job.id}] Recipient ${recipientIndex + 1}/${recipients.length}: ${recipientJid}`);

    // Determine starting part index (for crash recovery)
    const startPartIndex = (recipientIndex === job.current_recipient_index)
      ? job.current_part_index
      : 0;

    let recipientSuccess = true;

    // Process message parts sequentially
    for (let partIndex = startPartIndex; partIndex < messageParts.length; partIndex++) {
      const part = messageParts[partIndex];

      console.log(`[JOB ${job.id}]   Part ${partIndex + 1}/${messageParts.length}`);
      console.log(`[JOB ${job.id}]   Text: "${part.text.substring(0, 50)}${part.text.length > 50 ? '...' : ''}"`);

      // Attempt to send with retries
      let sendSuccess = false;
      for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
        try {
          await sock.sendMessage(recipientJid, { text: part.text });
          console.log(`[JOB ${job.id}]   ✅ Sent successfully`);
          sendSuccess = true;
          break;
        } catch (error) {
          console.error(`[JOB ${job.id}]   ❌ Attempt ${attempt}/${config.maxRetries} failed:`, error.message);

          if (attempt < config.maxRetries) {
            // Exponential backoff: 2s, 4s, 6s...
            const backoffDelay = 2000 * attempt;
            console.log(`[JOB ${job.id}]   ⏱️  Retrying in ${backoffDelay / 1000}s...`);
            await delay(backoffDelay);
          }
        }
      }

      if (!sendSuccess) {
        console.error(`[JOB ${job.id}]   ❌ FAILED after ${config.maxRetries} attempts`);
        recipientSuccess = false;
        break; // Skip remaining parts for this recipient
      }

      // Update progress
      db.updateJobProgress(job.id, {
        current_part_index: partIndex + 1,
        last_sent_at: new Date().toISOString()
      });

      // Delay after message (if specified and not last part)
      if (part.delayAfterSeconds && partIndex < messageParts.length - 1) {
        console.log(`[JOB ${job.id}]   ⏱️  Waiting ${part.delayAfterSeconds}s before next part...`);
        await delay(part.delayAfterSeconds * 1000);
      }
    }

    // Update recipient progress
    const updatedProgress = {
      current_recipient_index: recipientIndex + 1,
      current_part_index: 0 // Reset for next recipient
    };

    if (recipientSuccess) {
      updatedProgress.recipients_sent = job.recipients_sent + 1;
      console.log(`[JOB ${job.id}] ✅ Recipient completed successfully`);
    } else {
      updatedProgress.recipients_failed = job.recipients_failed + 1;
      console.log(`[JOB ${job.id}] ❌ Recipient failed`);
    }

    db.updateJobProgress(job.id, updatedProgress);

    // Gap between recipients (if not last recipient)
    if (recipientIndex < recipients.length - 1) {
      const gap = config.recipientGapSeconds;
      console.log(`[JOB ${job.id}] ⏱️  Gap before next recipient: ${gap}s`);
      await delay(gap * 1000);
    }
  }

  // Mark job as completed
  db.updateJobProgress(job.id, {
    status: 'completed',
    completed_at: new Date().toISOString()
  });

  // Reload job to get latest counts
  const completedJob = db.getJob(job.id);

  console.log(`\n[JOB ${job.id}] ═══════════════════════════════════`);
  console.log(`[JOB ${job.id}] ✅ JOB COMPLETED`);
  console.log(`[JOB ${job.id}] Summary:`);
  console.log(`[JOB ${job.id}]   ✅ ${completedJob.recipients_sent} recipients succeeded`);
  console.log(`[JOB ${job.id}]   ❌ ${completedJob.recipients_failed} recipients failed`);
  console.log(`[JOB ${job.id}] ═══════════════════════════════════\n`);
}

// ============================================================================
// MAIN INITIALIZATION
// ============================================================================

async function init() {
  console.log('🚀 WhatsApp Scheduler Worker starting...');
  console.log('📅 Timezone: Europe/London (UK)');
  console.log('⏰ Check interval: 60 seconds');
  console.log('💾 Storage: SQLite database');
  console.log('');

  // Connect to WhatsApp
  await connectToWhatsApp();

  // Wait for connection
  await new Promise(resolve => {
    const interval = setInterval(() => {
      if (isConnected) {
        clearInterval(interval);
        resolve();
      }
    }, 1000);
  });

  console.log('✓ Scheduler ready');
  console.log('');

  // Initial check
  await checkAndSendMessages();
  await processScheduledJobs();

  // Schedule recurring checks every 60 seconds
  setInterval(async () => {
    const now = new Date().toLocaleString('en-GB', {
      timeZone: 'Europe/London',
      dateStyle: 'short',
      timeStyle: 'medium'
    });
    console.log('⏰ [' + now + '] Checking for scheduled messages...');

    try {
      await checkAndSendMessages();
      await processScheduledJobs();
    } catch (error) {
      console.error('✗ Error in scheduler loop:', error);
    }
  }, 60000);
}

init().catch(err => {
  console.error('✗ Fatal error:', err);
  process.exit(1);
});
