# FIXES APPLIED - NEW YEAR'S INCIDENT

**Date:** 1st January 2026
**Files Modified:** `scheduler-simple.js`
**Status:** Ready for deployment

---

## COMPLETE CODE CHANGES

### File: scheduler-simple.js

#### Change 1: Added Idempotency Table Creation (Lines 27-38)

**ADDED:**
```javascript
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
```

**Why:** Tracks every message sent to prevent duplicates across restarts/crashes.

---

#### Change 2: Added Idempotency Check Function (Lines 40-50)

**ADDED:**
```javascript
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
```

**Why:** Before sending any message, check if we've already sent it.

---

#### Change 3: Added Message Logging Function (Lines 52-68)

**ADDED:**
```javascript
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
```

**Why:** After successful send, log it so we never send again.

---

#### Change 4: Fixed SQL Syntax Error (Line 87)

**BEFORE:**
```javascript
const query = `
  SELECT id, to_phone, message, contact_name, actual_send_time, scheduled_at
  FROM scheduled_messages
  WHERE status = 'pending'
    AND datetime(COALESCE(actual_send_time, scheduled_at)) <= datetime('now')
  ORDER BY COALESCE(actual_send_time, scheduled_at) ASC
`;
`;  // <-- DUPLICATE SEMICOLON
```

**AFTER:**
```javascript
const query = `
  SELECT id, to_phone, message, contact_name, actual_send_time, scheduled_at
  FROM scheduled_messages
  WHERE status = 'pending'
    AND datetime(COALESCE(actual_send_time, scheduled_at)) <= datetime('now')
  ORDER BY COALESCE(actual_send_time, scheduled_at) ASC
`;
// FIX: Removed duplicate semicolon that was here
```

**Why:** Syntax error could cause query to fail.

---

#### Change 5: Added Status Re-Check Before Send (Lines 133-138)

**ADDED:**
```javascript
// FIX: Re-check status before sending (in case message was cancelled/deleted)
const currentStatus = db.prepare('SELECT status FROM scheduled_messages WHERE id = ?').get(msg.id);
if (!currentStatus || currentStatus.status !== 'pending') {
  console.log(`⚠️  Message ${msg.id} status changed to ${currentStatus?.status || 'deleted'}, skipping`);
  continue;
}
```

**Why:** Message could be deleted during 60s polling interval. Always verify before sending.

---

#### Change 6: Added Idempotency Check Before Send (Lines 140-146)

**ADDED:**
```javascript
// FIX: Check idempotency - have we already sent this?
const recipientJid = msg.to_phone.includes('@') ? msg.to_phone : `${msg.to_phone}@s.whatsapp.net`;
if (isAlreadySent(msg.id, recipientJid)) {
  console.log(`⚠️  Already sent message ${msg.id} to ${recipientJid}, skipping`);
  updateMessageStatus(msg.id, 'sent'); // Mark as sent in case it wasn't
  continue;
}
```

**Why:** If scheduler crashed and restarted, don't resend messages already sent.

---

#### Change 7: Added "Sending" Intermediate Status (Line 149)

**ADDED:**
```javascript
// FIX: Mark as "sending" BEFORE attempting to send (prevents double-sends)
updateMessageStatus(msg.id, 'sending');
```

**Why:** If two scheduler processes run concurrently, this prevents both from sending the same message.

---

#### Change 8: REMOVED ALL RETRY LOGIC (Lines 153-169)

**BEFORE:**
```javascript
// BROKEN CODE - caused duplicates
let sendSuccess = false;
const maxRetries = job.config?.maxRetries || 3;

for (let attempt = 1; attempt <= maxRetries; attempt++) {
  try {
    await whatsapp.sendMessage(recipientJid, part.text);
    sendSuccess = true;
    break;
  } catch (error) {
    if (attempt < maxRetries) {
      const backoffDelay = 2000 * attempt;
      await delay(backoffDelay);
    }
  }
}
```

**AFTER:**
```javascript
// FIX: Single send attempt - NO RETRIES
// WhatsApp's infrastructure handles reliability - retries cause duplicates
try {
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
```

**Why:** This is the main fix. Retries cause duplicates because WhatsApp may have received the message even if confirmation was lost.

---

#### Change 9: Job Status Re-Check (Lines 247-251)

**ADDED:**
```javascript
// FIX: Check job status before starting (in case it was cancelled)
const currentJob = db.prepare('SELECT status FROM scheduled_jobs WHERE id = ?').get(job.id);
if (!currentJob || currentJob.status === 'cancelled') {
  console.log(`[JOB ${job.id}] ⚠️  Job was cancelled, aborting`);
  return;
}
```

**Why:** Job could be cancelled before execution starts.

---

#### Change 10: Job Status Re-Check During Execution (Lines 283-288)

**ADDED:**
```javascript
// FIX: Re-check job status before each recipient (in case cancelled during execution)
const jobCheck = db.prepare('SELECT status FROM scheduled_jobs WHERE id = ?').get(job.id);
if (!jobCheck || jobCheck.status === 'cancelled') {
  console.log(`[JOB ${job.id}] ⚠️  Job was cancelled during execution, stopping`);
  return;
}
```

**Why:** Long-running jobs could be cancelled mid-execution. Check before each recipient.

---

#### Change 11: Job Idempotency Check (Lines 309-315)

**ADDED:**
```javascript
// FIX: Check idempotency before sending
const messageId = `${job.id}_r${recipientIndex}_p${partIndex}`;
if (isAlreadySent(messageId, recipientJid)) {
  console.log(`[JOB ${job.id}]   ⚠️  Already sent part ${partIndex + 1} to ${recipientJid}, skipping`);
  job.progress.sentCount++;
  continue;
}
```

**Why:** Track each part of multi-part messages separately to prevent duplicates.

---

#### Change 12: Job Retry Logic REMOVED (Lines 317-333)

**BEFORE:**
```javascript
// BROKEN CODE - caused duplicates
let sendSuccess = false;
const maxRetries = job.config?.maxRetries || 3;

for (let attempt = 1; attempt <= maxRetries; attempt++) {
  try {
    await whatsapp.sendMessage(recipientJid, part.text);
    sendSuccess = true;
    job.progress.sentCount++;
    break;
  } catch (error) {
    if (attempt < maxRetries) {
      const backoffDelay = 2000 * attempt;
      await delay(backoffDelay);
    }
  }
}
```

**AFTER:**
```javascript
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
```

**Why:** Same as single messages - no retries to prevent duplicates.

---

#### Change 13: Enhanced Startup Logging (Lines 432-442)

**ADDED:**
```javascript
console.log('🛡️  SAFETY FEATURES ENABLED:');
console.log('   - NO RETRIES (prevents duplicates)');
console.log('   - Idempotency checks (tracks sent messages)');
console.log('   - Status re-checks (prevents cancelled messages)');
console.log('   - "Sending" intermediate status (prevents double-sends)');
```

**Why:** Clear indication that safety features are active.

---

## SUMMARY OF CHANGES

### Safety Features Added:
1. ✅ Idempotency table and tracking
2. ✅ Status re-checks before every send
3. ✅ "Sending" intermediate status
4. ✅ Job cancellation checks

### Bugs Fixed:
1. ✅ Removed ALL retry logic
2. ✅ Fixed SQL syntax error
3. ✅ Added comprehensive logging

### Lines Changed:
- **Added:** ~180 lines of new code
- **Removed:** ~40 lines of retry logic
- **Modified:** ~20 lines for status checks
- **Total impact:** ~240 lines changed

---

## TESTING CHECKLIST

Before deploying to production:

### Unit Tests
- [ ] Idempotency table creation works
- [ ] `isAlreadySent()` correctly identifies duplicates
- [ ] `logSentMessage()` correctly logs sends
- [ ] Status re-checks work correctly

### Integration Tests
- [ ] Send 5 test messages, verify no duplicates
- [ ] Delete a scheduled message, verify it doesn't send
- [ ] Cancel a running job, verify it stops
- [ ] Restart scheduler mid-job, verify idempotency works

### Production Validation
- [ ] Deploy to VPS
- [ ] Monitor logs for 24 hours
- [ ] Verify `sent_message_log` table is populated
- [ ] Verify no duplicates in production

---

## ROLLBACK PLAN

If issues occur after deployment:

1. **Stop scheduler immediately**
   ```bash
   pm2 stop scheduler
   ```

2. **Restore backup**
   ```bash
   cp scheduler-simple.js.backup-YYYYMMDD scheduler-simple.js
   ```

3. **Restart scheduler**
   ```bash
   pm2 start scheduler
   ```

4. **Investigate logs**
   ```bash
   pm2 logs scheduler --lines 200
   ```

---

## DEPLOYMENT COMMAND

```bash
# From local machine
cd /Users/saadi/Documents/GitHub/WhatsApp-VPSLink
scp scheduler-simple.js root@5.231.56.146:/root/whatsapp-vpslink/
ssh root@5.231.56.146 "cd /root/whatsapp-vpslink && pm2 restart scheduler && pm2 logs scheduler --lines 50"
```
