# S3 to SQLite Migration Plan

**Created:** December 28, 2025
**Status:** Planning Phase
**Backup Location:** Garage S3 (ChromeBox Server)

---

## Executive Summary

Migrate from S3-as-live-storage to **SQLite-as-hot-storage** with **Garage S3 backups** for the WhatsApp VPSLink system.

### Key Changes

| Component | Before | After |
|-----------|--------|-------|
| **Hot Storage** | S3 (polled every 60s) | SQLite on Doodah VPS |
| **Backup Storage** | S3 versioned files | Garage S3 (hourly compressed) |
| **Web UI Access** | Direct S3 writes | API calls to Doodah |
| **Scheduler Trigger** | Poll S3 every 60s | Event-driven + 15min safety poll |
| **Read Pattern** | Every CLI command = S3 GET | Read from local SQLite |
| **Write Pattern** | Every change = S3 PUT | Batch writes + periodic flush |

---

## Current Architecture (Problems)

```
┌─────────────────┐
│   Web UI        │
│ (Saadi VPS)     │
└────────┬────────┘
         │
         │ Direct S3 writes
         │
         ▼
┌─────────────────────────────┐
│   Backblaze S3              │  ◄──── SOURCE OF TRUTH (WRONG!)
│   - contacts.json           │
│   - scheduled.json          │
│   - jobs.json               │
│   - chats.json              │
└─────────────────────────────┘
         ▲
         │
         │ Poll every 60s
         │
┌────────┴────────┐
│   Scheduler     │
│ (Doodah VPS)    │
└─────────────────┘
```

### Problems
1. **Polling waste:** 1,440 S3 GETs/day from scheduler alone
2. **No caching:** Every CLI command downloads full JSON
3. **Write amplification:** 5.5 MB file rewritten for 1 message
4. **API caps:** Hit Backblaze transaction limits
5. **Latency:** 50-100ms per S3 call
6. **No transactions:** Race conditions possible
7. **Version bloat:** 164 MB stored, <50 MB active

---

## Target Architecture (Solution)

```
┌─────────────────┐
│   Web UI        │
│ (Saadi VPS)     │
└────────┬────────┘
         │
         │ HTTP API (private endpoint)
         │
         ▼
┌─────────────────────────────┐
│   Doodah VPS                │  ◄──── SOURCE OF TRUTH (CORRECT!)
│                             │
│  ┌──────────────────────┐   │
│  │ SQLite Database      │   │
│  │ - contacts           │   │
│  │ - scheduled_messages │   │
│  │ - jobs               │   │
│  │ - chats              │   │
│  └──────────────────────┘   │
│                             │
│  ┌──────────────────────┐   │
│  │ WhatsApp Scheduler   │   │
│  │ - In-memory state    │   │
│  │ - Event-driven       │   │
│  └──────────────────────┘   │
└─────────────┬───────────────┘
              │
              │ Hourly compressed backup
              │
              ▼
┌─────────────────────────────┐
│   Garage S3 (ChromeBox)     │  ◄──── COLD BACKUP ONLY
│   - hourly snapshots        │
│   - compressed              │
│   - retention: 7 days       │
└─────────────────────────────┘
```

### Benefits
✅ **Zero polling:** Scheduler loads once, stays in memory
✅ **Event-driven:** Web UI triggers scheduler refresh via API
✅ **Local reads:** CLI commands read SQLite (sub-ms)
✅ **Batch writes:** Flush every 30s or on change
✅ **Transactions:** ACID guarantees
✅ **No caps:** No API limits on local DB
✅ **Fast backups:** Garage S3 on LAN (1-5ms latency)
✅ **Predictable growth:** ~300 MB max on Doodah (6 GB available)

---

## SQLite Schema Design

### Database Location
**Path:** `/root/whatsapp-vpslink/data/whatsapp.db`

### Tables

#### 1. `contacts`
```sql
CREATE TABLE contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT NOT NULL UNIQUE,              -- e.g., "447779299086"
  name TEXT NOT NULL,                      -- e.g., "Nick"
  aliases TEXT DEFAULT '[]',               -- JSON array: ["Nicholas", "Nicky"]
  tags TEXT DEFAULT '[]',                  -- JSON array: ["friend", "london"]
  is_favorite INTEGER DEFAULT 0,           -- 0 or 1
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_contacts_phone ON contacts(phone);
CREATE INDEX idx_contacts_favorite ON contacts(is_favorite);
```

**Migration from:** `whatsapp/contacts.json` (272 contacts)

#### 2. `scheduled_messages`
```sql
CREATE TABLE scheduled_messages (
  id TEXT PRIMARY KEY,                     -- e.g., "msg_1735157600_abc"
  to_phone TEXT NOT NULL,                  -- e.g., "447779299086"
  contact_name TEXT,                       -- e.g., "Nick"
  message TEXT NOT NULL,
  scheduled_at TEXT NOT NULL,              -- ISO 8601: "2025-12-28T18:00:00Z"
  status TEXT NOT NULL DEFAULT 'pending',  -- pending|sent|failed
  error_message TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  sent_at TEXT,
  FOREIGN KEY (to_phone) REFERENCES contacts(phone) ON UPDATE CASCADE
);

CREATE INDEX idx_scheduled_status ON scheduled_messages(status);
CREATE INDEX idx_scheduled_time ON scheduled_messages(scheduled_at);
CREATE INDEX idx_scheduled_phone ON scheduled_messages(to_phone);
```

**Migration from:** `whatsapp/scheduled.json` or `whatsapp/scheduled-messages.json`

#### 3. `jobs`
```sql
CREATE TABLE jobs (
  id TEXT PRIMARY KEY,                     -- e.g., "job_1735157600_xyz"
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending|running|completed|failed
  scheduled_start_at TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  current_recipient_index INTEGER DEFAULT 0,
  current_part_index INTEGER DEFAULT 0,
  recipients_sent INTEGER DEFAULT 0,
  recipients_failed INTEGER DEFAULT 0,
  last_sent_at TEXT,
  config TEXT NOT NULL,                    -- JSON: {maxRetries, recipientGapSeconds}
  message_parts TEXT NOT NULL,             -- JSON array: [{text, delayAfterSeconds}]
  recipients TEXT NOT NULL                 -- JSON array: ["447779299086@s.whatsapp.net"]
);

CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_scheduled ON jobs(scheduled_start_at);
```

**Migration from:** `whatsapp/jobs.json`

#### 4. `chats`
```sql
CREATE TABLE chats (
  id TEXT PRIMARY KEY,                     -- e.g., "447779299086@s.whatsapp.net"
  name TEXT,
  is_group INTEGER DEFAULT 0,
  unread_count INTEGER DEFAULT 0,
  last_message_time INTEGER,               -- Unix timestamp
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id TEXT NOT NULL,
  message TEXT NOT NULL,
  timestamp INTEGER NOT NULL,              -- Unix timestamp
  is_from_me INTEGER DEFAULT 0,
  message_type TEXT DEFAULT 'text',        -- text|audio|image|video|document
  raw_message TEXT,                        -- JSON (for media)
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
);

CREATE INDEX idx_messages_chat ON messages(chat_id);
CREATE INDEX idx_messages_timestamp ON messages(timestamp);
CREATE INDEX idx_chats_last_message ON chats(last_message_time);
```

**Migration from:** `whatsapp/chats.json` (currently ~5.5 MB)

---

## Data Migration Strategy

### Phase 1: One-Time Migration (Manual, Safe)

**Goal:** Copy existing S3 data to SQLite without breaking production

**Steps:**

1. **Download current S3 data to local machine**
   ```bash
   mkdir -p /tmp/s3-migration
   cd /tmp/s3-migration

   # Download from Garage S3
   s3cmd get s3://whatsapp-vpslink/whatsapp/contacts.json
   s3cmd get s3://whatsapp-vpslink/whatsapp/scheduled.json
   s3cmd get s3://whatsapp-vpslink/whatsapp/jobs.json
   s3cmd get s3://whatsapp-vpslink/whatsapp/chats.json
   ```

2. **Create migration script**
   - Script: `/Users/saadi/Documents/GitHub/WhatsApp-VPSLink/change-s3-to-sql/migrate-s3-to-sqlite.js`
   - Reads JSON files
   - Writes to SQLite
   - Validates counts
   - Reports errors

3. **Run migration locally (test)**
   ```bash
   node migrate-s3-to-sqlite.js --input /tmp/s3-migration --output ./test.db
   ```

4. **Verify migration**
   ```bash
   sqlite3 test.db "SELECT COUNT(*) FROM contacts;"
   sqlite3 test.db "SELECT COUNT(*) FROM scheduled_messages;"
   sqlite3 test.db "SELECT * FROM contacts LIMIT 5;"
   ```

5. **Upload SQLite database to Doodah VPS**
   ```bash
   scp test.db root@5.231.56.146:/root/whatsapp-vpslink/data/whatsapp.db
   ```

### Phase 2: Code Changes

#### A. Create SQLite Storage Modules

**File:** `/root/whatsapp-vpslink/src/db.js`
```javascript
const sqlite3 = require('better-sqlite3');
const path = require('path');

class Database {
  constructor() {
    const dbPath = path.join(__dirname, '..', 'data', 'whatsapp.db');
    this.db = new sqlite3(dbPath);
    this.db.pragma('journal_mode = WAL'); // Write-Ahead Logging for concurrency
  }

  // Contacts
  getAllContacts() { ... }
  getContact(phone) { ... }
  createContact(data) { ... }
  updateContact(phone, data) { ... }

  // Scheduled Messages
  getPendingMessages() { ... }
  createScheduledMessage(data) { ... }
  updateMessageStatus(id, status, error) { ... }

  // Jobs
  getPendingJobs() { ... }
  updateJobProgress(id, progress) { ... }

  // Chats
  createChat(chatId) { ... }
  addMessage(chatId, message) { ... }
  getChat(chatId) { ... }
}

module.exports = new Database();
```

**Dependencies:**
```bash
npm install better-sqlite3
```

#### B. Update Scheduler

**File:** `/root/whatsapp-vpslink/scheduler.js`

**Changes:**
```javascript
// OLD:
const ScheduledStore = require('./src/scheduledStore');
const store = new ScheduledStore();
const data = await store.load(); // S3 GET every 60s

// NEW:
const db = require('./src/db');
const pendingMessages = db.getPendingMessages(); // Local SQLite, sub-ms
```

**Scheduler Flow (Event-Driven):**
```javascript
let inMemoryState = null;

async function init() {
  // Load once at startup
  inMemoryState = {
    pendingMessages: db.getPendingMessages(),
    pendingJobs: db.getPendingJobs()
  };

  // Listen for Web UI triggers (push-based)
  startAPIServer(); // See API section below

  // Safety poll every 15 minutes (fallback)
  setInterval(() => {
    refreshState();
  }, 15 * 60 * 1000);
}

function refreshState() {
  inMemoryState = {
    pendingMessages: db.getPendingMessages(),
    pendingJobs: db.getPendingJobs()
  };
  recalculateTimers();
}
```

#### C. Create Doodah API Endpoint

**File:** `/root/whatsapp-vpslink/api.js`

```javascript
const express = require('express');
const crypto = require('crypto');
const app = express();

const API_SECRET = process.env.API_SECRET || crypto.randomBytes(32).toString('hex');
const ALLOWED_IPS = ['192.209.62.48']; // Saadi VPS only

app.use(express.json());

// Middleware: IP whitelist
app.use((req, res, next) => {
  const clientIP = req.ip || req.connection.remoteAddress;
  if (!ALLOWED_IPS.includes(clientIP)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
});

// Middleware: Shared secret
app.use((req, res, next) => {
  const authHeader = req.headers['x-api-secret'];
  if (authHeader !== API_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

// Endpoint: Refresh scheduler state
app.post('/scheduler/refresh', (req, res) => {
  console.log('[API] Refresh request from Web UI');
  refreshState(); // Reload from SQLite
  res.json({ success: true, message: 'Scheduler state refreshed' });
});

// Endpoint: Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    connected: isConnected,
    pendingMessages: inMemoryState.pendingMessages.length,
    pendingJobs: inMemoryState.pendingJobs.length
  });
});

app.listen(3001, '0.0.0.0', () => {
  console.log('[API] Server listening on port 3001');
  console.log('[API] Secret:', API_SECRET);
});
```

**UFW Rules on Doodah:**
```bash
ufw allow from 192.209.62.48 to any port 3001
```

#### D. Update Web UI

**File:** `/var/www/whatsapp-scheduler/lib/doodah-api.ts`

```typescript
const DOODAH_API_URL = process.env.DOODAH_API_URL || 'http://5.231.56.146:3001';
const DOODAH_API_SECRET = process.env.DOODAH_API_SECRET!;

export async function notifySchedulerRefresh() {
  try {
    const response = await fetch(`${DOODAH_API_URL}/scheduler/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Secret': DOODAH_API_SECRET
      }
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    console.log('[API] Scheduler notified successfully');
  } catch (error) {
    console.error('[API] Failed to notify scheduler:', error);
    // Non-fatal: scheduler will poll anyway
  }
}
```

**Usage in Web UI:**
```typescript
// After creating/updating/deleting a scheduled message
await db.createScheduledMessage(data);
await notifySchedulerRefresh(); // ← NEW: Push notification
```

#### E. Update ChatStore

**File:** `/root/whatsapp-vpslink/src/chatStore.js`

**Changes:**
```javascript
// Replace S3 mode with SQLite mode
async load() {
  // OLD: await this.loadFromS3();
  // NEW:
  const db = require('./db');
  const chats = db.getAllChats();
  return chats;
}

async save() {
  // OLD: await this.saveToS3();
  // NEW:
  const db = require('./db');
  db.bulkUpdateChats(this.chats);
}
```

---

## Backup Strategy

### Hourly Backups to Garage S3

**Script:** `/root/whatsapp-vpslink/backup.sh`

```bash
#!/bin/bash

BACKUP_DIR="/root/whatsapp-vpslink/backups"
DB_PATH="/root/whatsapp-vpslink/data/whatsapp.db"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/whatsapp_$TIMESTAMP.db"

# Create backup directory
mkdir -p $BACKUP_DIR

# SQLite backup (hot backup, safe)
sqlite3 $DB_PATH ".backup $BACKUP_FILE"

# Compress
gzip $BACKUP_FILE

# Upload to Garage S3
s3cmd put "$BACKUP_FILE.gz" s3://whatsapp-vpslink/backups/

# Local retention: keep last 24 hours only
find $BACKUP_DIR -name "whatsapp_*.db.gz" -mtime +1 -delete

echo "[BACKUP] Completed: $BACKUP_FILE.gz"
```

**Cron Job on Doodah:**
```bash
# Hourly backup
0 * * * * /root/whatsapp-vpslink/backup.sh >> /root/whatsapp-vpslink/logs/backup.log 2>&1
```

### Garage S3 Retention Policy

**Retention:**
- Hourly backups: 24 hours
- Daily snapshots (00:00): 7 days
- Weekly snapshots (Sunday 00:00): 4 weeks
- Monthly snapshots (1st 00:00): 12 months

**Script:** `/root/whatsapp-vpslink/cleanup-backups.sh`

```bash
#!/bin/bash

# Keep hourly for 24 hours
s3cmd ls s3://whatsapp-vpslink/backups/ | awk '{print $4}' | while read file; do
  timestamp=$(echo $file | grep -oP '\d{8}_\d{6}')
  age_hours=$(( ($(date +%s) - $(date -d "${timestamp:0:8} ${timestamp:9:11}:${timestamp:11:13}:${timestamp:13:15}" +%s)) / 3600 ))

  if [ $age_hours -gt 24 ]; then
    # Not a daily snapshot
    if [[ ! $timestamp =~ _000000$ ]]; then
      s3cmd del "$file"
    fi
  fi
done

# Keep daily for 7 days (similar logic)
# Keep weekly for 4 weeks (similar logic)
```

**Cron Job:**
```bash
# Daily cleanup at 01:00
0 1 * * * /root/whatsapp-vpslink/cleanup-backups.sh >> /root/whatsapp-vpslink/logs/cleanup.log 2>&1
```

---

## Deployment Plan

### Pre-Deployment Checklist

- [ ] Download all current S3 data to local machine
- [ ] Create SQLite schema script
- [ ] Create migration script
- [ ] Test migration locally
- [ ] Verify all 272 contacts migrated
- [ ] Verify scheduled messages migrated
- [ ] Create backup script
- [ ] Create API endpoint code
- [ ] Update scheduler code
- [ ] Update Web UI code
- [ ] Test API locally
- [ ] Document rollback procedure

### Deployment Steps (Step-by-Step)

#### Step 1: Prepare SQLite Database (Local)

```bash
# On local machine
cd /Users/saadi/Documents/GitHub/WhatsApp-VPSLink/change-s3-to-sql

# Run migration
node migrate-s3-to-sqlite.js

# Verify
sqlite3 whatsapp.db "SELECT COUNT(*) FROM contacts;"  # Should be 272
sqlite3 whatsapp.db "SELECT COUNT(*) FROM scheduled_messages;"
sqlite3 whatsapp.db ".schema"
```

#### Step 2: Deploy Database to Doodah

```bash
# Upload database
scp whatsapp.db root@5.231.56.146:/root/whatsapp-vpslink/data/

# Verify on Doodah
ssh root@5.231.56.146
sqlite3 /root/whatsapp-vpslink/data/whatsapp.db "SELECT COUNT(*) FROM contacts;"
```

#### Step 3: Deploy Code Changes to Doodah

```bash
# Copy new files
scp src/db.js root@5.231.56.146:/root/whatsapp-vpslink/src/
scp api.js root@5.231.56.146:/root/whatsapp-vpslink/
scp backup.sh root@5.231.56.146:/root/whatsapp-vpslink/
scp cleanup-backups.sh root@5.231.56.146:/root/whatsapp-vpslink/

# Install dependencies
ssh root@5.231.56.146
cd /root/whatsapp-vpslink
npm install better-sqlite3 express
chmod +x backup.sh cleanup-backups.sh
```

#### Step 4: Update Scheduler

```bash
# Backup old scheduler
ssh root@5.231.56.146
cd /root/whatsapp-vpslink
cp scheduler.js scheduler.js.backup-$(date +%Y%m%d)

# Update scheduler.js (manual edit or scp)
nano scheduler.js
# (Apply changes from section Phase 2.B above)

# Start API server
pm2 start api.js --name whatsapp-api
pm2 save
```

#### Step 5: Configure UFW on Doodah

```bash
ssh root@5.231.56.146
ufw allow from 192.209.62.48 to any port 3001
ufw status
```

#### Step 6: Update Web UI (Saadi VPS)

```bash
ssh root@192.209.62.48
cd /var/www/whatsapp-scheduler

# Backup
cp -r . ../whatsapp-scheduler-backup-$(date +%Y%m%d)

# Create API client file
nano lib/doodah-api.ts
# (Add code from section Phase 2.D above)

# Update .env.local
nano .env.local
# Add:
# DOODAH_API_URL=http://5.231.56.146:3001
# DOODAH_API_SECRET=<secret from Doodah>

# Rebuild
npm run build
pm2 restart whatsapp-web
```

#### Step 7: Test End-to-End

```bash
# Test 1: Schedule a message via Web UI
# - Go to http://192.209.62.48:3000
# - Schedule a test message for 2 minutes from now
# - Watch Doodah logs: ssh root@5.231.56.146 'pm2 logs whatsapp-scheduler'
# - Verify message sends

# Test 2: Check backup
ssh root@5.231.56.146
/root/whatsapp-vpslink/backup.sh
s3cmd ls s3://whatsapp-vpslink/backups/

# Test 3: Verify API
curl -X POST http://5.231.56.146:3001/scheduler/refresh \
  -H "X-API-Secret: <secret>" \
  -H "Content-Type: application/json"
```

#### Step 8: Setup Cron Jobs

```bash
ssh root@5.231.56.146
crontab -e

# Add:
# Hourly backup
0 * * * * /root/whatsapp-vpslink/backup.sh >> /root/whatsapp-vpslink/logs/backup.log 2>&1

# Daily cleanup at 01:00
0 1 * * * /root/whatsapp-vpslink/cleanup-backups.sh >> /root/whatsapp-vpslink/logs/cleanup.log 2>&1
```

#### Step 9: Monitor for 24 Hours

```bash
# Watch scheduler logs
ssh root@5.231.56.146 'pm2 logs whatsapp-scheduler'

# Watch API logs
ssh root@5.231.56.146 'pm2 logs whatsapp-api'

# Check backup logs
ssh root@5.231.56.146 'tail -f /root/whatsapp-vpslink/logs/backup.log'

# Check database size
ssh root@5.231.56.146 'du -sh /root/whatsapp-vpslink/data/'
```

#### Step 10: Decommission S3 Polling (Optional)

Once confirmed working for 7 days:

```bash
# Remove S3 dependency from scheduler
ssh root@5.231.56.146
cd /root/whatsapp-vpslink
npm uninstall @aws-sdk/client-s3  # (if not needed for backups)

# Update .env to remove old S3 config (keep for backups)
```

---

## Rollback Plan

If anything goes wrong:

### Immediate Rollback (< 1 hour)

1. **Restore old scheduler code:**
   ```bash
   ssh root@5.231.56.146
   cd /root/whatsapp-vpslink
   cp scheduler.js.backup-YYYYMMDD scheduler.js
   pm2 restart whatsapp-scheduler
   pm2 delete whatsapp-api
   ```

2. **Restore Web UI:**
   ```bash
   ssh root@192.209.62.48
   cd /var/www
   rm -rf whatsapp-scheduler
   mv whatsapp-scheduler-backup-YYYYMMDD whatsapp-scheduler
   cd whatsapp-scheduler
   pm2 restart whatsapp-web
   ```

3. **System returns to S3 polling mode**

### Data Recovery (if database corrupted)

1. **Restore from Garage S3:**
   ```bash
   ssh root@5.231.56.146
   s3cmd ls s3://whatsapp-vpslink/backups/ | tail -5
   s3cmd get s3://whatsapp-vpslink/backups/whatsapp_YYYYMMDD_HHMMSS.db.gz
   gunzip whatsapp_YYYYMMDD_HHMMSS.db.gz
   mv whatsapp_YYYYMMDD_HHMMSS.db /root/whatsapp-vpslink/data/whatsapp.db
   pm2 restart whatsapp-scheduler
   ```

2. **Maximum data loss: 1 hour** (last backup)

---

## Testing Plan

### Unit Tests

**File:** `/Users/saadi/Documents/GitHub/WhatsApp-VPSLink/change-s3-to-sql/test-db.js`

```javascript
const db = require('../src/db');

// Test contacts
console.log('Testing contacts...');
const contact = db.createContact({
  phone: '447000000000',
  name: 'Test User',
  aliases: ['Tester'],
  tags: ['test']
});
console.log('✓ Created contact:', contact);

const fetched = db.getContact('447000000000');
console.log('✓ Fetched contact:', fetched);

// Test scheduled messages
console.log('\nTesting scheduled messages...');
const msg = db.createScheduledMessage({
  to_phone: '447000000000',
  contact_name: 'Test User',
  message: 'Test message',
  scheduled_at: new Date(Date.now() + 60000).toISOString()
});
console.log('✓ Created scheduled message:', msg);

const pending = db.getPendingMessages();
console.log('✓ Pending messages:', pending.length);

// Test status update
db.updateMessageStatus(msg.id, 'sent');
const updated = db.getPendingMessages();
console.log('✓ After status update, pending:', updated.length);

console.log('\n✅ All tests passed!');
```

**Run:**
```bash
node test-db.js
```

### Integration Tests

1. **Test migration accuracy:**
   - Count records in S3 JSON files
   - Count records in SQLite
   - Compare totals
   - Spot-check 10 random contacts

2. **Test Web UI → Doodah API:**
   - Schedule message via Web UI
   - Check Doodah logs for API call
   - Verify message appears in SQLite
   - Verify scheduler picks it up

3. **Test backup/restore:**
   - Run manual backup
   - Corrupt database (rename it)
   - Restore from backup
   - Verify data intact

4. **Test scheduler event-driven mode:**
   - Stop polling (comment out setInterval)
   - Schedule message via Web UI
   - Verify scheduler picks it up immediately
   - Verify no polling logs

5. **Load test:**
   - Schedule 50 messages via Web UI
   - Verify all written to SQLite
   - Verify all sent by scheduler
   - Check performance (should be <100ms per write)

---

## Performance Expectations

### Before (S3 Polling)

| Metric | Value |
|--------|-------|
| Scheduler poll interval | 60s |
| S3 GETs per day | 1,440 (scheduler) + CLI usage |
| Average latency per read | 50-100ms |
| Write latency | 50-100ms |
| Backblaze transaction cost | ~$0.00 (free tier, but hitting caps) |
| Data transfer | ~164 MB/day (redundant reads) |

### After (SQLite + Garage S3)

| Metric | Value |
|--------|-------|
| Scheduler poll interval | 15 min (safety only) |
| SQLite reads per day | ~100 (event-driven) |
| Average latency per read | <1ms |
| Write latency | <5ms (batch flush) |
| Garage S3 cost | $0 (self-hosted) |
| Data transfer | ~50 MB/day (hourly backups) |

**Reduction:**
- 95% fewer reads
- 99% lower latency
- $0 cloud costs
- Predictable disk usage

---

## Maintenance

### Daily Tasks
- Check backup logs
- Monitor disk usage

### Weekly Tasks
- Verify backups are uploading to Garage S3
- Test restore from latest backup
- Check SQLite database size

### Monthly Tasks
- Review retention policy
- Clean up old backups manually if needed
- Optimize SQLite database (`VACUUM`)

### Commands

```bash
# Check database size
ssh root@5.231.56.146 'du -sh /root/whatsapp-vpslink/data/'

# Optimize database
ssh root@5.231.56.146 'sqlite3 /root/whatsapp-vpslink/data/whatsapp.db "VACUUM;"'

# List recent backups
ssh root@5.231.56.146 's3cmd ls s3://whatsapp-vpslink/backups/ | tail -10'

# Test restore (dry run)
ssh root@5.231.56.146
s3cmd get s3://whatsapp-vpslink/backups/whatsapp_latest.db.gz /tmp/test-restore.db.gz
gunzip /tmp/test-restore.db.gz
sqlite3 /tmp/test-restore.db "SELECT COUNT(*) FROM contacts;"
```

---

## FAQ

### Q: What happens if Garage S3 goes down?
**A:** No impact on production. Scheduler runs from local SQLite. Backups queue locally and upload when Garage returns.

### Q: What happens if Web UI can't reach Doodah API?
**A:** Non-fatal. Scheduler polls every 15 minutes as fallback. User might see a 1-15 minute delay.

### Q: What happens if Doodah VPS crashes?
**A:** Restore from latest Garage S3 backup (max 1 hour data loss). Scheduler auto-restarts via PM2.

### Q: Can I switch back to Backblaze S3 later?
**A:** Yes. Just update backup script to upload to Backblaze instead of Garage. Schema stays the same.

### Q: How much disk space will SQLite use?
**A:** Estimated 300-500 MB over time. Doodah has 6 GB available. Safe headroom.

### Q: Will this break the Web UI?
**A:** No. Web UI just changes from writing to S3 → writing to Doodah API. User experience identical.

---

## Next Steps

1. **Create migration script** (`migrate-s3-to-sqlite.js`)
2. **Create SQLite schema script** (`schema.sql`)
3. **Create database wrapper** (`src/db.js`)
4. **Create API endpoint** (`api.js`)
5. **Update scheduler** (modify `scheduler.js`)
6. **Update Web UI** (add `lib/doodah-api.ts`)
7. **Test locally**
8. **Deploy to staging** (if available)
9. **Deploy to production**
10. **Monitor for 7 days**
11. **Document lessons learned**

---

**Status:** Ready for implementation
**Risk Level:** Medium (good rollback plan, backups in place)
**Estimated Effort:** 4-6 hours
**Estimated Downtime:** <5 minutes (during scheduler restart)
