# Implementation Checklist

**Status:** Ready to begin implementation
**Estimated Time:** 4-6 hours
**Risk:** Medium (good rollback plan)

---

## Pre-Implementation (Complete ✅)

- [x] Read migration plan
- [x] Understand architecture changes
- [x] Review SQLite schema
- [x] Understand backup switching
- [x] Create all documentation

---

## Phase 1: Local Preparation (1-2 hours)

### Step 1: Create Migration Script
- [ ] Create `migrate-s3-to-sqlite.js`
- [ ] Test with sample data locally
- [ ] Verify output SQLite database

### Step 2: Test SQLite Schema
- [ ] Create test database: `sqlite3 test.db < schema.sql`
- [ ] Insert sample contacts
- [ ] Insert sample scheduled messages
- [ ] Query with views
- [ ] Verify foreign keys work

### Step 3: Download Production S3 Data
```bash
mkdir -p /tmp/s3-migration
s3cmd get s3://whatsapp-vpslink/whatsapp/contacts.json /tmp/s3-migration/
s3cmd get s3://whatsapp-vpslink/whatsapp/scheduled.json /tmp/s3-migration/
s3cmd get s3://whatsapp-vpslink/whatsapp/jobs.json /tmp/s3-migration/
s3cmd get s3://whatsapp-vpslink/whatsapp/chats.json /tmp/s3-migration/
```

### Step 4: Run Migration
```bash
node migrate-s3-to-sqlite.js \
  --input /tmp/s3-migration \
  --output whatsapp.db
```

### Step 5: Verify Migration
```bash
sqlite3 whatsapp.db "SELECT COUNT(*) FROM contacts;"  # Should be 272
sqlite3 whatsapp.db "SELECT COUNT(*) FROM scheduled_messages;"
sqlite3 whatsapp.db "SELECT COUNT(*) FROM jobs;"
sqlite3 whatsapp.db "SELECT * FROM contacts LIMIT 5;"
```

**Checklist:**
- [ ] Downloaded all S3 data
- [ ] Created migration script
- [ ] Ran migration successfully
- [ ] Verified 272 contacts
- [ ] Verified all scheduled messages migrated
- [ ] Verified schema is correct

---

## Phase 2: Doodah VPS Setup (2 hours)

### Step 1: Backup Current System
```bash
ssh root@5.231.56.146
cd /root/whatsapp-vpslink
tar -czf ../whatsapp-vpslink-backup-$(date +%Y%m%d).tar.gz .
cp scheduler.js scheduler.js.backup-$(date +%Y%m%d)
```

### Step 2: Upload Database
```bash
# From local machine
scp whatsapp.db root@5.231.56.146:/root/whatsapp-vpslink/data/

# Verify on Doodah
ssh root@5.231.56.146
ls -lh /root/whatsapp-vpslink/data/whatsapp.db
sqlite3 /root/whatsapp-vpslink/data/whatsapp.db "SELECT COUNT(*) FROM contacts;"
```

### Step 3: Install Dependencies
```bash
ssh root@5.231.56.146
cd /root/whatsapp-vpslink
npm install better-sqlite3 express
```

### Step 4: Upload New Files
```bash
# From local machine
scp change-s3-to-sql/backup.sh root@5.231.56.146:/root/whatsapp-vpslink/
scp change-s3-to-sql/setup-backup-cron.sh root@5.231.56.146:/root/whatsapp-vpslink/
scp change-s3-to-sql/backup-config.env.example root@5.231.56.146:/root/whatsapp-vpslink/.env.backup.example
```

### Step 5: Configure Backup
```bash
ssh root@5.231.56.146
cd /root/whatsapp-vpslink
cp .env.backup.example .env.backup
nano .env.backup
# Set BACKUP_PROVIDER=garage
# Set BACKUP_INTERVAL_MINUTES=60
```

### Step 6: Setup Backup Cron
```bash
chmod +x backup.sh setup-backup-cron.sh
sudo ./setup-backup-cron.sh
# Answer 'y' to test backup
```

### Step 7: Verify Backup on Garage S3
```bash
ssh root@192.168.1.18 's3cmd ls s3://whatsapp-vpslink/backups/'
# Should see whatsapp_YYYYMMDD_HHMMSS.db.gz
```

**Checklist:**
- [ ] Backed up current system
- [ ] Uploaded SQLite database
- [ ] Installed dependencies
- [ ] Uploaded backup scripts
- [ ] Configured `.env.backup`
- [ ] Setup cron job
- [ ] Test backup ran successfully
- [ ] Verified backup on Garage S3

---

## Phase 3: Code Changes (1-2 hours)

### To Do:
1. [ ] Create `src/db.js` (database wrapper)
2. [ ] Create `api.js` (Web UI API endpoint)
3. [ ] Update `scheduler.js` (use SQLite, event-driven)
4. [ ] Update `src/chatStore.js` (use SQLite)
5. [ ] Test locally if possible

**Note:** These require creating the actual implementation files. Ready to start?

---

## Phase 4: Web UI Updates (30 mins)

### To Do:
1. [ ] SSH to Saadi VPS
2. [ ] Create `lib/doodah-api.ts`
3. [ ] Update `.env.local` with Doodah API settings
4. [ ] Update schedule creation code to call API
5. [ ] Rebuild: `npm run build`
6. [ ] Restart: `pm2 restart whatsapp-web`

---

## Phase 5: Deployment & Testing (1 hour)

### Step 1: Start API Server
```bash
ssh root@5.231.56.146
cd /root/whatsapp-vpslink
pm2 start api.js --name whatsapp-api
pm2 save
```

### Step 2: Update Scheduler
```bash
pm2 restart whatsapp-scheduler
pm2 logs whatsapp-scheduler --lines 50
```

### Step 3: Configure UFW
```bash
ufw allow from 192.209.62.48 to any port 3001
ufw status
```

### Step 4: Test End-to-End
- [ ] Schedule message via Web UI
- [ ] Verify API call in Doodah logs
- [ ] Verify message in SQLite
- [ ] Wait for scheduler to send message
- [ ] Verify message sent successfully

### Step 5: Monitor for 24 Hours
```bash
# Watch scheduler logs
pm2 logs whatsapp-scheduler

# Watch API logs
pm2 logs whatsapp-api

# Watch backup logs
tail -f /root/whatsapp-vpslink/logs/backup.log

# Check database size
du -sh /root/whatsapp-vpslink/data/
```

**Checklist:**
- [ ] API server running
- [ ] Scheduler updated and running
- [ ] UFW configured
- [ ] End-to-end test passed
- [ ] No errors in logs for 24 hours
- [ ] Backups running on schedule

---

## Phase 6: Rollback Testing (Optional but Recommended)

### Test Rollback Procedure
```bash
ssh root@5.231.56.146
cd /root/whatsapp-vpslink

# Restore old scheduler
cp scheduler.js.backup-YYYYMMDD scheduler.js
pm2 restart whatsapp-scheduler
pm2 delete whatsapp-api

# Verify system works in old mode
```

### Test Database Recovery
```bash
# Download latest backup
s3cmd get s3://whatsapp-vpslink/backups/whatsapp_latest.db.gz /tmp/
gunzip /tmp/whatsapp_latest.db.gz

# Verify backup is valid
sqlite3 /tmp/whatsapp_latest.db "SELECT COUNT(*) FROM contacts;"
```

**Checklist:**
- [ ] Rollback tested successfully
- [ ] Database recovery tested
- [ ] Switched back to new system

---

## Phase 7: Final Verification (After 7 Days)

- [ ] No duplicate messages sent
- [ ] All scheduled messages sending correctly
- [ ] Backups uploading to Garage S3
- [ ] No errors in logs
- [ ] Database size is reasonable
- [ ] Web UI working correctly
- [ ] Scheduler responding to Web UI changes

---

## Optional: Decommission S3 Polling

**Only after 7+ days of stable operation:**

```bash
ssh root@5.231.56.146
cd /root/whatsapp-vpslink

# Remove old S3 storage code (keep S3 SDK for backups)
# Update .env to remove old S3 config (keep for backup.sh)

# Document the change
```

---

## Emergency Rollback

If anything goes wrong at any point:

```bash
# 1. Restore old code
ssh root@5.231.56.146
cd /root/whatsapp-vpslink
cp scheduler.js.backup-YYYYMMDD scheduler.js
pm2 restart whatsapp-scheduler
pm2 delete whatsapp-api

# 2. Restore Web UI (on Saadi VPS)
ssh root@192.209.62.48
cd /var/www
rm -rf whatsapp-scheduler
mv whatsapp-scheduler-backup-YYYYMMDD whatsapp-scheduler
cd whatsapp-scheduler
pm2 restart whatsapp-web

# 3. System returns to S3 polling mode
# Max 5 minutes downtime
```

---

## Progress Tracking

**Current Phase:** Pre-Implementation Complete ✅

**Next Step:** Create migration script (`migrate-s3-to-sqlite.js`)

Ready to begin implementation?
