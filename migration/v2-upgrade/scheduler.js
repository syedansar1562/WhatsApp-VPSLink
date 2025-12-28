require('dotenv').config();
const makeWASocket = require('@whiskeysockets/baileys').default;
const { useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const ScheduledStore = require('./src/scheduledStore');
const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');

let sock;
let isConnected = false;

// S3 Client for jobs
const s3Client = new S3Client({
  endpoint: process.env.B2_S3_ENDPOINT,
  region: 'eu-central-003',
  credentials: {
    accessKeyId: process.env.B2_ACCESS_KEY_ID,
    secretAccessKey: process.env.B2_SECRET_ACCESS_KEY
  }
});
const BUCKET_NAME = process.env.B2_BUCKET;
const S3_PREFIX = process.env.B2_PREFIX || 'whatsapp/';

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
  const store = new ScheduledStore();

  try {
    const data = await store.load();

    const pendingMessages = store.getPendingMessages(data);

    if (pendingMessages.length === 0) {
      console.log('→ No messages to send');
      return;
    }

    console.log('→ Found ' + pendingMessages.length + ' message(s) to send');

    for (const msg of pendingMessages) {
      try {
        console.log('→ Sending: "' + msg.message + '" to ' + msg.contactName + ' (' + msg.to + ')');

        await sendMessage(msg.to, msg.message);

        store.updateMessageStatus(data, msg.id, 'sent');

      } catch (error) {
        console.error('✗ Error sending message ' + msg.id + ':', error.message);

        store.updateMessageStatus(data, msg.id, 'failed', error.message);
      }
    }

    await store.save(data);

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
  console.log("[DEBUG] processScheduledJobs() called");
  try {
    // Fetch jobs.json from S3
    const jobsData = await s3Client.send(new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: S3_PREFIX + 'jobs.json'
    }));

    const jobsBody = await jobsData.Body.transformToString();
    const jobs = JSON.parse(jobsBody);

    const now = new Date();

    // Find jobs that should start now
    const pendingJobs = jobs.filter(j =>
      j.status === 'pending' &&
      new Date(j.scheduledStartAt) <= now
    );

    if (pendingJobs.length === 0) {
      return; // No jobs to process
    }

    console.log(`\n[JOBS] Found ${pendingJobs.length} job(s) to execute`);

    // Process each job sequentially
    for (const job of pendingJobs) {
      await executeJob(job, jobs);
    }

  } catch (error) {
    if (error.name === 'NoSuchKey') {
      // jobs.json doesn't exist yet - that's okay
      return;
    }
    console.error('[JOBS] Error processing jobs:', error);
  }
}

/**
 * Execute a single job (all recipients, all message parts)
 */
async function executeJob(job, allJobs) {
  console.log(`\n[JOB ${job.id}] Starting execution`);
  console.log(`[JOB ${job.id}] Recipients: ${job.recipients.length}`);
  console.log(`[JOB ${job.id}] Message parts: ${job.messageParts.length}`);
  console.log(`[JOB ${job.id}] Total messages: ${job.recipients.length * job.messageParts.length}`);

  // Update status to running
  job.status = 'running';
  await updateJobInS3(job, allJobs);

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
      for (let attempt = 1; attempt <= job.config.maxRetries; attempt++) {
        try {
          await sock.sendMessage(recipientJid, { text: part.text });
          console.log(`[JOB ${job.id}]   ✅ Sent successfully`);
          sendSuccess = true;
          break;
        } catch (error) {
          console.error(`[JOB ${job.id}]   ❌ Attempt ${attempt}/${job.config.maxRetries} failed:`, error.message);

          if (attempt < job.config.maxRetries) {
            // Exponential backoff: 2s, 4s, 6s...
            const backoffDelay = 2000 * attempt;
            console.log(`[JOB ${job.id}]   ⏱️  Retrying in ${backoffDelay / 1000}s...`);
            await delay(backoffDelay);
          }
        }
      }

      if (!sendSuccess) {
        console.error(`[JOB ${job.id}]   ❌ FAILED after ${job.config.maxRetries} attempts`);
        recipientSuccess = false;
        break; // Skip remaining parts for this recipient
      }

      // Update progress
      job.progress.currentPartIndex = partIndex + 1;
      job.progress.lastSentAt = new Date().toISOString();
      await updateJobInS3(job, allJobs);

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
    await updateJobInS3(job, allJobs);

    // Gap between recipients (if not last recipient)
    if (recipientIndex < job.recipients.length - 1) {
      const gap = job.config.recipientGapSeconds;
      console.log(`[JOB ${job.id}] ⏱️  Gap before next recipient: ${gap}s`);
      await delay(gap * 1000);
    }
  }

  // Mark job as completed
  job.status = 'completed';
  job.completedAt = new Date().toISOString();
  await updateJobInS3(job, allJobs);

  console.log(`\n[JOB ${job.id}] ═══════════════════════════════════`);
  console.log(`[JOB ${job.id}] ✅ JOB COMPLETED`);
  console.log(`[JOB ${job.id}] Summary:`);
  console.log(`[JOB ${job.id}]   ✅ ${job.progress.recipientsSent} recipients succeeded`);
  console.log(`[JOB ${job.id}]   ❌ ${job.progress.recipientsFailed} recipients failed`);
  console.log(`[JOB ${job.id}] ═══════════════════════════════════\n`);
}

/**
 * Update job in S3 storage
 */
async function updateJobInS3(updatedJob, allJobs) {
  const jobIndex = allJobs.findIndex(j => j.id === updatedJob.id);
  if (jobIndex !== -1) {
    allJobs[jobIndex] = updatedJob;
  }

  await s3Client.send(new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: S3_PREFIX + 'jobs.json',
    Body: JSON.stringify(allJobs, null, 2),
    ContentType: 'application/json'
  }));
}

// ============================================================================
// MAIN INITIALIZATION
// ============================================================================

async function init() {
  console.log('🚀 WhatsApp Scheduler Worker starting...');
  console.log('📅 Timezone: Europe/London (UK)');
  console.log('⏰ Check interval: 60 seconds');
  console.log('');

  await connectToWhatsApp();

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

  await checkAndSendMessages();
  await processScheduledJobs(); // Check jobs on startup

  setInterval(async () => {
    const now = new Date().toLocaleString('en-GB', {
      timeZone: 'Europe/London',
      dateStyle: 'short',
      timeStyle: 'medium'
    });
    console.log('⏰ [' + now + '] Checking for scheduled messages...');

    try {
      await checkAndSendMessages();
      await processScheduledJobs(); // Process multi-message jobs
    } catch (error) {
      console.error('✗ Error in scheduler loop:', error);
    }
  }, 60000);
}

init().catch(err => {
  console.error('✗ Fatal error:', err);
  process.exit(1);
});
