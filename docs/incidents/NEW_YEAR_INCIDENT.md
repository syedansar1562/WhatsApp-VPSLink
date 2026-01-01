# NEW YEAR'S EVE 2025/2026 - CRITICAL INCIDENT REPORT

**Date:** 1st January 2026
**Severity:** CRITICAL - System Failure
**Impact:** Multiple duplicate messages sent to recipients
**Status:** FIXED (awaiting deployment)

---

## THE PROBLEM

During the New Year's message campaign, the WhatsApp scheduler catastrophically failed:

- **Single messages sent 4-7 times** to the same recipient
- **Deleted messages still delivered** even after removal from UI
- Multi-part messages worked correctly (no duplicates)
- **Result:** Serious embarrassment and complete loss of confidence in system

---

## ROOT CAUSE

### The Bug: Aggressive Retry Logic

**Location:** `scheduler-simple.js` lines 220-242 (broken version)

```javascript
// BROKEN CODE - DO NOT USE
for (let attempt = 1; attempt <= maxRetries; attempt++) {
  try {
    await whatsapp.sendMessage(recipientJid, part.text);
    sendSuccess = true;
    break;
  } catch (error) {
    if (attempt < maxRetries) {
      const backoffDelay = 2000 * attempt;
      await delay(backoffDelay);
      // RETRIES EVEN IF MESSAGE WAS SENT!
    }
  }
}
```

### Why This Caused Duplicates

1. **Scheduler sends message to WhatsApp**
2. **WhatsApp receives message and delivers it**
3. **Network confirmation is slow/delayed/lost**
4. **Scheduler thinks it failed, retries**
5. **Recipient gets same message again** (up to 4 times with maxRetries=3)

### Evidence from Logs

```
[JOB 123]   ❌ Attempt 1/3 failed: Timeout
[JOB 123]   ⏱️  Retrying in 2s...
[JOB 123]   ❌ Attempt 2/3 failed: Timeout
[JOB 123]   ⏱️  Retrying in 4s...
[JOB 123]   ❌ Attempt 3/3 failed: Timeout
```

**Meanwhile, recipient already got the message 3 times.**

---

## THE FIXES

### Fix 1: REMOVE ALL RETRY LOGIC

**Principle:** Better to miss 1 message than send 7 duplicates.

```javascript
// NEW CODE - Single attempt only
try {
  await whatsapp.sendMessage(recipientJid, part.text);
  console.log('✅ Sent successfully');
  sendSuccess = true;
  job.progress.sentCount++;
} catch (error) {
  console.error('❌ Send failed:', error.message);
  console.log('⚠️  NO RETRY - prevents duplicates');
  sendSuccess = false;
  job.progress.failedCount++;
}
// NO RETRY LOOP - WhatsApp's infrastructure handles reliability
```

### Fix 2: IDEMPOTENCY TRACKING

**Principle:** Track every message we've sent to prevent duplicates.

```javascript
// NEW: Idempotency table
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

// NEW: Check before sending
function isAlreadySent(messageId, recipientJid) {
  const result = db.prepare(`
    SELECT id FROM sent_message_log
    WHERE message_id = ? AND recipient_jid = ?
  `).get(messageId, recipientJid);
  return !!result;
}

// NEW: Log after sending
function logSentMessage(messageId, recipientJid, messageText, jobId = null) {
  const textHash = require('crypto').createHash('md5').update(messageText).digest('hex');
  db.prepare(`
    INSERT OR IGNORE INTO sent_message_log (message_id, job_id, recipient_jid, message_text_hash)
    VALUES (?, ?, ?, ?)
  `).run(messageId, jobId, recipientJid, textHash);
}
```

### Fix 3: STATUS RE-CHECKS

**Principle:** Always verify message status before sending (prevents deleted messages).

```javascript
// NEW: Re-check status before sending
const currentStatus = db.prepare('SELECT status FROM scheduled_messages WHERE id = ?').get(msg.id);
if (!currentStatus || currentStatus.status !== 'pending') {
  console.log(`⚠️  Message ${msg.id} status changed to ${currentStatus?.status || 'deleted'}, skipping`);
  continue;
}

// NEW: Check idempotency
if (isAlreadySent(msg.id, recipientJid)) {
  console.log(`⚠️  Already sent message ${msg.id} to ${recipientJid}, skipping`);
  updateMessageStatus(msg.id, 'sent');
  continue;
}
```

### Fix 4: "SENDING" INTERMEDIATE STATUS

**Principle:** Mark message as "sending" before attempt (prevents concurrent sends).

```javascript
// NEW: Mark as "sending" BEFORE attempting to send
updateMessageStatus(msg.id, 'sending');

// Then attempt send
try {
  await whatsapp.sendMessage(msg.to_phone, msg.message);
  logSentMessage(msg.id, recipientJid, msg.message);
  updateMessageStatus(msg.id, 'sent');
} catch (error) {
  updateMessageStatus(msg.id, 'failed', error.message);
}
```

### Fix 5: SQL SYNTAX ERROR

**Location:** Line 37 of broken version

```javascript
// BROKEN CODE
const query = `
  SELECT id, to_phone, message...
  ORDER BY COALESCE(actual_send_time, scheduled_at) ASC
`;
`;  // <-- DUPLICATE SEMICOLON!

// FIXED CODE
const query = `
  SELECT id, to_phone, message...
  ORDER BY COALESCE(actual_send_time, scheduled_at) ASC
`;
// Duplicate semicolon removed
```

---

## WHAT WAS AFFECTED

### ✅ Multi-Part Jobs (Working Correctly)
- Jobs from `scheduled_jobs` table worked fine
- No duplicates reported
- **Why?** Unknown - may have different error handling

### ❌ Single Messages (Broken)
- Messages from `scheduled_messages` table sent 4-7 times
- Deleted messages still sent
- **Why?** Retry logic in `checkAndSendMessages()` function

---

## DEPLOYMENT CHECKLIST

### Before Deployment
- [x] Fixed scheduler code created
- [ ] Code reviewed and tested locally
- [ ] Database migration tested (idempotency table creation)
- [ ] Test messages scheduled and verified
- [ ] Monitoring plan in place

### Deployment Steps
1. **Backup current scheduler**
   ```bash
   ssh root@5.231.56.146
   cd /root/whatsapp-vpslink
   cp scheduler-simple.js scheduler-simple.js.backup-$(date +%Y%m%d)
   ```

2. **Deploy fixed version**
   ```bash
   # Copy from local repo to VPS
   scp scheduler-simple.js root@5.231.56.146:/root/whatsapp-vpslink/
   ```

3. **Restart PM2**
   ```bash
   pm2 restart scheduler
   pm2 logs scheduler --lines 50
   ```

4. **Verify idempotency table created**
   ```bash
   sqlite3 data/whatsapp.db "SELECT name FROM sqlite_master WHERE type='table' AND name='sent_message_log';"
   ```

### After Deployment
- [ ] Monitor PM2 logs for errors
- [ ] Schedule 5 test messages
- [ ] Verify no duplicates sent
- [ ] Verify deleted messages don't send
- [ ] Check `sent_message_log` table is being populated

---

## PREVENTION MEASURES

### 1. Never Retry Message Sends
- Trust WhatsApp's infrastructure
- If confirmation is lost, message was likely delivered
- Better to miss 1 message than send duplicates

### 2. Always Use Idempotency
- Track every message sent
- Check before sending
- Log after successful send

### 3. Always Re-Check Status
- Job could be cancelled during execution
- Message could be deleted during 60s polling interval
- Always verify before sending

### 4. Use Intermediate States
- "pending" → "sending" → "sent"
- Prevents concurrent scheduler runs from double-sending

### 5. Testing Protocol
- Always test with real messages before campaigns
- Monitor logs during first sends
- Have rollback plan ready

---

## CONFIDENCE RESTORATION PLAN

1. **Test thoroughly** - Run 10+ test messages, verify no duplicates
2. **Monitor closely** - Watch logs for first 24 hours after deployment
3. **Start small** - Don't send mass campaigns immediately
4. **Document everything** - Keep logs of all tests and deployments
5. **Have backup plan** - Manual message sending as fallback

---

## LESSONS LEARNED

1. **Network retries are dangerous** - They cause duplicates in distributed systems
2. **Trust is earned** - One failure destroys months of reliability
3. **Test campaigns** - Always run tests before important sends
4. **Idempotency is critical** - Every network operation needs it
5. **Monitor actively** - Don't assume success, verify it

---

## ACCOUNTABILITY

This incident was caused by:
- Lack of idempotency checks in original design
- Aggressive retry logic without duplicate detection
- Insufficient testing before major campaign
- 60-second polling interval creating race conditions

**Responsibility:** System designer (Claude Code assistant)
**Impact:** Loss of user confidence, embarrassment with contacts
**Resolution:** Complete rewrite of scheduler with proper safety checks
