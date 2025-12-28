// scheduler-jobs-addon.js
// Location on Doodah VPS: Add this code to /root/whatsapp-vpslink/scheduler.js
//
// Purpose: Job processing logic for multi-message, multi-recipient sequential sending
// Created: December 24, 2025
//
// INSTRUCTIONS:
// 1. Add these functions to the existing scheduler.js file
// 2. Add processScheduledJobs() call to the main loop (see below)
// 3. Ensure BUCKET_NAME constant is defined
// 4. Deploy to Doodah VPS

// ============================================================================
// ADD THESE FUNCTIONS TO scheduler.js
// ============================================================================

/**
 * Process scheduled jobs (multi-message, multi-recipient)
 * Called every 60 seconds alongside processScheduledMessages()
 */
async function processScheduledJobs() {
  try {
    // Fetch jobs.json from S3
    const jobsData = await s3Client.send(new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: 'whatsapp/jobs.json'
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
 *
 * @param {Object} job - The job to execute
 * @param {Array} allJobs - Full jobs array (for updating)
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
 *
 * @param {Object} updatedJob - The job object with updated fields
 * @param {Array} allJobs - Full jobs array
 */
async function updateJobInS3(updatedJob, allJobs) {
  const jobIndex = allJobs.findIndex(j => j.id === updatedJob.id);
  if (jobIndex !== -1) {
    allJobs[jobIndex] = updatedJob;
  }

  await s3Client.send(new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: 'whatsapp/jobs.json',
    Body: JSON.stringify(allJobs, null, 2),
    ContentType: 'application/json'
  }));
}

/**
 * Delay helper function
 *
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise} Resolves after delay
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// UPDATE THE MAIN LOOP IN scheduler.js
// ============================================================================

/*
// Find the existing setInterval in scheduler.js and update it to:

setInterval(async () => {
  if (isReady && sock) {
    try {
      // Process old system (single messages) - EXISTING
      await processScheduledMessages();

      // Process new system (multi-message jobs) - NEW
      await processScheduledJobs();
    } catch (error) {
      console.error('Error in scheduler loop:', error);
    }
  }
}, 60000); // Every 60 seconds
*/

// ============================================================================
// DEPLOYMENT INSTRUCTIONS
// ============================================================================

/*
1. SSH to Doodah VPS:
   ssh root@5.231.56.146

2. Navigate to project directory:
   cd /root/whatsapp-vpslink

3. Edit scheduler.js:
   nano scheduler.js

4. Add the three functions above:
   - processScheduledJobs()
   - executeJob()
   - updateJobInS3()
   - delay() (if not already exists)

5. Update the main setInterval loop to call both:
   - processScheduledMessages() (existing)
   - processScheduledJobs() (new)

6. Save and restart:
   pm2 restart whatsapp-scheduler

7. Monitor logs:
   pm2 logs whatsapp-scheduler

8. Test with a small job:
   - 1 recipient
   - 2 message parts
   - 5 second delays
*/

// ============================================================================
// TESTING CHECKLIST
// ============================================================================

/*
✅ Test 1: Single recipient, multiple parts
   - Create job with 1 recipient, 3 message parts
   - Verify all parts send in order
   - Verify delays are respected
   - Verify progress updates

✅ Test 2: Multiple recipients, single part
   - Create job with 3 recipients, 1 message part
   - Verify recipients process sequentially
   - Verify recipient gap is respected
   - Verify progress updates

✅ Test 3: Multiple recipients, multiple parts
   - Create job with 2 recipients, 2 message parts
   - Verify complete sequential execution
   - Verify all delays work correctly

✅ Test 4: Retry logic
   - Disconnect WhatsApp temporarily
   - Create job
   - Verify 3 retry attempts occur
   - Reconnect and verify eventual success

✅ Test 5: Crash recovery
   - Start a job
   - Kill scheduler mid-execution (pm2 restart)
   - Verify job resumes from last position
   - Verify no duplicate messages
*/

// ============================================================================
// BACKWARD COMPATIBILITY
// ============================================================================

/*
The new job system runs alongside the old scheduler system.
Both systems are independent:

- Old system: scheduled.json → processScheduledMessages()
- New system: jobs.json → processScheduledJobs()

No conflicts. Users can use both simultaneously.
*/

// ============================================================================
// EXAMPLE LOG OUTPUT
// ============================================================================

/*
⏰ [24/12/2025, 18:00:00] Checking for scheduled messages...
✓ Loaded 0 scheduled messages from S3
→ No messages to send

[JOBS] Found 1 job(s) to execute

[JOB job_1735157600_xyz] Starting execution
[JOB job_1735157600_xyz] Recipients: 2
[JOB job_1735157600_xyz] Message parts: 3
[JOB job_1735157600_xyz] Total messages: 6

[JOB job_1735157600_xyz] ────────────────────────────────────
[JOB job_1735157600_xyz] Recipient 1/2: 447957189696@s.whatsapp.net
[JOB job_1735157600_xyz]   Part 1/3
[JOB job_1735157600_xyz]   Text: "Hey! Merry Christmas! 🎄"
[JOB job_1735157600_xyz]   ✅ Sent successfully
[JOB job_1735157600_xyz]   ⏱️  Waiting 3s before next part...
[JOB job_1735157600_xyz]   Part 2/3
[JOB job_1735157600_xyz]   Text: "Hope you have an amazing day!"
[JOB job_1735157600_xyz]   ✅ Sent successfully
[JOB job_1735157600_xyz]   ⏱️  Waiting 5s before next part...
[JOB job_1735157600_xyz]   Part 3/3
[JOB job_1735157600_xyz]   Text: "Let's catch up in the new year! 🎉"
[JOB job_1735157600_xyz]   ✅ Sent successfully
[JOB job_1735157600_xyz] ✅ Recipient completed successfully
[JOB job_1735157600_xyz] ⏱️  Gap before next recipient: 30s

[JOB job_1735157600_xyz] ────────────────────────────────────
[JOB job_1735157600_xyz] Recipient 2/2: 447950724774@s.whatsapp.net
[JOB job_1735157600_xyz]   Part 1/3
[JOB job_1735157600_xyz]   Text: "Hey! Merry Christmas! 🎄"
[JOB job_1735157600_xyz]   ✅ Sent successfully
[JOB job_1735157600_xyz]   ⏱️  Waiting 3s before next part...
[JOB job_1735157600_xyz]   Part 2/3
[JOB job_1735157600_xyz]   Text: "Hope you have an amazing day!"
[JOB job_1735157600_xyz]   ✅ Sent successfully
[JOB job_1735157600_xyz]   ⏱️  Waiting 5s before next part...
[JOB job_1735157600_xyz]   Part 3/3
[JOB job_1735157600_xyz]   Text: "Let's catch up in the new year! 🎉"
[JOB job_1735157600_xyz]   ✅ Sent successfully
[JOB job_1735157600_xyz] ✅ Recipient completed successfully

[JOB job_1735157600_xyz] ═══════════════════════════════════
[JOB job_1735157600_xyz] ✅ JOB COMPLETED
[JOB job_1735157600_xyz] Summary:
[JOB job_1735157600_xyz]   ✅ 2 recipients succeeded
[JOB job_1735157600_xyz]   ❌ 0 recipients failed
[JOB job_1735157600_xyz] ═══════════════════════════════════
*/
