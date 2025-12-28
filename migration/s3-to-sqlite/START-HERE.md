# 🚀 Implementation Guide - Start Here

**Status:** Ready to implement
**Time Required:** 4-6 hours
**Risk Level:** Medium (good rollback plan)

---

## What You're About to Do

Transform your WhatsApp VPSLink system from:
- ❌ S3 as hot storage (polling every 60s)
- ❌ 1,440+ S3 reads/day
- ❌ Hitting Backblaze caps

To:
- ✅ SQLite as hot storage (event-driven)
- ✅ 95% fewer reads
- ✅ Full REST API for Web UI + iPhone app
- ✅ S3 as backups only (Garage or Backblaze - your choice)

**Zero visible changes to end users!**

---

## Files You've Created

All files are in `/Users/saadi/Documents/GitHub/WhatsApp-VPSLink/change-s3-to-sql/`:

### Documentation
- ✅ **MIGRATION-PLAN.md** - Complete migration guide
- ✅ **API-DESIGN.md** - Full REST API specification
- ✅ **BACKUP-SWITCHING-GUIDE.md** - How to switch between Garage/Backblaze
- ✅ **IMPLEMENTATION-CHECKLIST.md** - Step-by-step checklist
- ✅ **START-HERE.md** - This file

### Implementation Files
- ✅ **schema.sql** - SQLite database schema
- ✅ **src/db.js** - Database abstraction layer
- ✅ **api.js** - Full REST API server
- ✅ **migrate-s3-to-sqlite.js** - Migration script
- ✅ **backup.sh** - Smart backup script (Garage/Backblaze)
- ✅ **setup-backup-cron.sh** - Automated backup setup
- ✅ **package.json** - Dependencies
- ✅ **backup-config.env.example** - Backup configuration template

---

## Quick Start (Step by Step)

### Step 1: Install Dependencies (2 minutes)

```bash
cd /Users/saadi/Documents/GitHub/WhatsApp-VPSLink/change-s3-to-sql
npm install
```

This installs:
- `better-sqlite3` - Fast SQLite database
- `express` - REST API server
- `jsonwebtoken` - JWT authentication
- `express-rate-limit` - API rate limiting
- `dotenv` - Environment variables

---

### Step 2: Download S3 Data (5 minutes)

Download your current data from Garage S3:

```bash
# Create temp directory
mkdir -p /tmp/s3-migration

# Download files (using s3cmd configured for Garage)
s3cmd get s3://whatsapp-vpslink/whatsapp/contacts.json /tmp/s3-migration/
s3cmd get s3://whatsapp-vpslink/whatsapp/scheduled.json /tmp/s3-migration/ || \
s3cmd get s3://whatsapp-vpslink/whatsapp/scheduled-messages.json /tmp/s3-migration/
s3cmd get s3://whatsapp-vpslink/whatsapp/jobs.json /tmp/s3-migration/
s3cmd get s3://whatsapp-vpslink/whatsapp/chats.json /tmp/s3-migration/

# Verify files
ls -lh /tmp/s3-migration/
```

**Expected output:**
```
contacts.json           (272 contacts)
scheduled.json          (pending messages)
jobs.json              (multi-message jobs)
chats.json             (message history)
```

---

### Step 3: Run Migration (2 minutes)

Convert JSON files to SQLite:

```bash
cd /Users/saadi/Documents/GitHub/WhatsApp-VPSLink/change-s3-to-sql

node migrate-s3-to-sqlite.js \
  --input /tmp/s3-migration \
  --output whatsapp.db
```

**Expected output:**
```
[MIGRATE] Setting up SQLite database...
[MIGRATE] ✓ Database created
[MIGRATE] Creating schema...
[MIGRATE] ✓ Schema created

──────────────────────────────────────────────────────────
MIGRATING CONTACTS
──────────────────────────────────────────────────────────
[MIGRATE] ✓ Migrated 272 contacts

──────────────────────────────────────────────────────────
MIGRATING SCHEDULED MESSAGES
──────────────────────────────────────────────────────────
[MIGRATE] ✓ Migrated X scheduled messages

──────────────────────────────────────────────────────────
VERIFICATION
──────────────────────────────────────────────────────────
[MIGRATE] Contacts:            272
[MIGRATE] Scheduled messages:  X
[MIGRATE] Jobs:                X
[MIGRATE] Chats:               X
[MIGRATE] Messages:            X
[MIGRATE] Database size:       XX.XX MB

──────────────────────────────────────────────────────────
✅ MIGRATION COMPLETE
──────────────────────────────────────────────────────────
```

---

### Step 4: Verify Database (1 minute)

Test the SQLite database:

```bash
# Check contacts count
sqlite3 whatsapp.db "SELECT COUNT(*) FROM contacts;"
# Should output: 272

# List first 5 contacts
sqlite3 whatsapp.db "SELECT name, phone FROM contacts LIMIT 5;"

# Check pending messages
sqlite3 whatsapp.db "SELECT COUNT(*) FROM scheduled_messages WHERE status='pending';"

# View database schema
sqlite3 whatsapp.db ".schema"
```

If all looks good, proceed!

---

### Step 5: Test API Locally (Optional but Recommended - 10 minutes)

Before deploying to Doodah, test the API locally:

```bash
cd /Users/saadi/Documents/GitHub/WhatsApp-VPSLink/change-s3-to-sql

# Start API server
node api.js
```

**Expected output:**
```
────────────────────────────────────────────────────────
🚀 WhatsApp VPSLink API Server
────────────────────────────────────────────────────────
✓ Listening on port 3001
✓ Database: SQLite
✓ JWT Secret: change-thi...

Endpoints:
  POST /auth/login
  GET  /api/health
  GET  /api/contacts
  GET  /api/scheduled
  GET  /api/jobs
  GET  /api/chats
  GET  /api/stats

Documentation: /docs/deployment/API-DESIGN.md
────────────────────────────────────────────────────────
```

**In another terminal, test endpoints:**

```bash
# Health check (no auth required)
curl http://localhost:3001/api/health

# Login
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Copy the token from response, then:
TOKEN="<paste-token-here>"

# Get contacts
curl http://localhost:3001/api/contacts \
  -H "Authorization: Bearer $TOKEN"

# Get stats
curl http://localhost:3001/api/stats \
  -H "Authorization: Bearer $TOKEN"
```

If all works, **press Ctrl+C** to stop the server.

---

## Deployment to Doodah VPS

### Step 6: Backup Current System (5 minutes)

**IMPORTANT:** Always backup before making changes!

```bash
# SSH to Doodah
ssh root@5.231.56.146

# Backup entire directory
cd /root
tar -czf whatsapp-vpslink-backup-$(date +%Y%m%d).tar.gz whatsapp-vpslink/

# Backup scheduler code specifically
cd whatsapp-vpslink
cp scheduler.js scheduler.js.backup-$(date +%Y%m%d)

# Verify backup exists
ls -lh /root/whatsapp-vpslink-backup-*.tar.gz

# Exit SSH
exit
```

---

### Step 7: Upload Files to Doodah (10 minutes)

```bash
# From your Mac, upload all new files
cd /Users/saadi/Documents/GitHub/WhatsApp-VPSLink/change-s3-to-sql

# Upload database
scp whatsapp.db root@5.231.56.146:/root/whatsapp-vpslink/data/

# Upload source files
scp -r src root@5.231.56.146:/root/whatsapp-vpslink/

# Upload API server
scp api.js root@5.231.56.146:/root/whatsapp-vpslink/

# Upload backup scripts
scp backup.sh root@5.231.56.146:/root/whatsapp-vpslink/
scp setup-backup-cron.sh root@5.231.56.146:/root/whatsapp-vpslink/
scp backup-config.env.example root@5.231.56.146:/root/whatsapp-vpslink/

# Upload package.json
scp package.json root@5.231.56.146:/root/whatsapp-vpslink/
```

---

### Step 8: Install Dependencies on Doodah (3 minutes)

```bash
ssh root@5.231.56.146
cd /root/whatsapp-vpslink

# Install new dependencies
npm install better-sqlite3 express jsonwebtoken express-rate-limit

# Verify installation
npm list | grep -E "sqlite|express|jwt"
```

---

### Step 9: Configure Backups (5 minutes)

```bash
# Still on Doodah VPS
cd /root/whatsapp-vpslink

# Copy backup config example
cp backup-config.env.example .env.backup

# Edit backup config
nano .env.backup
```

**Set these values:**
```env
# Use Garage S3 (free, self-hosted)
BACKUP_PROVIDER=garage

# Hourly backups
BACKUP_INTERVAL_MINUTES=60

# Garage S3 settings (already configured in GARAGE-S3-INTEGRATION.md)
GARAGE_ENDPOINT=http://149.34.177.160:3900
GARAGE_ACCESS_KEY_ID=GKd211b1cb6eb2935da1bbd565
GARAGE_SECRET_ACCESS_KEY=975ed880ab48527fea4c3bcc71c951660c4efaea14088946d0524e112cca094c
GARAGE_BUCKET=whatsapp-vpslink
GARAGE_REGION=garage
GARAGE_FORCE_PATH_STYLE=true
GARAGE_PREFIX=backups/

# Retention
BACKUP_RETAIN_HOURLY_HOURS=24
BACKUP_RETAIN_DAILY_DAYS=7
```

**Save and exit** (Ctrl+X, Y, Enter)

---

### Step 10: Setup Backup Cron Job (2 minutes)

```bash
# Make scripts executable
chmod +x backup.sh setup-backup-cron.sh

# Run setup script
sudo ./setup-backup-cron.sh

# When prompted "Run a test backup now?", answer: y
```

**Expected output:**
```
────────────────────────────────────────────────────────
WhatsApp VPSLink - Backup Cron Setup
────────────────────────────────────────────────────────

Configuration:
  Provider: garage
  Interval: 60 minutes
  Script: /root/whatsapp-vpslink/backup.sh

Cron Schedule: 0 * * * * (Every hour)

✓ Made backup.sh executable
✓ Removed old cron jobs (if any)
✓ Added new cron job

Current crontab:
────────────────────────────────────────────────────────
0 * * * * /root/whatsapp-vpslink/backup.sh >> /root/whatsapp-vpslink/logs/backup.log 2>&1
────────────────────────────────────────────────────────

Run a test backup now? (y/n) y

[BACKUP] Starting backup to garage S3...
[BACKUP] Created backup: whatsapp_20251228_160000.db (12.5 MB)
[BACKUP] Compressing backup...
[BACKUP] Compressed to: 3.2 MB
[BACKUP] Uploading to s3://whatsapp-vpslink/backups/...
[BACKUP] Upload complete

────────────────────────────────────────────────────────
✅ BACKUP COMPLETED SUCCESSFULLY
────────────────────────────────────────────────────────
```

**Verify backup on ChromeBox:**
```bash
ssh root@192.168.1.18 's3cmd ls s3://whatsapp-vpslink/backups/'
```

---

### Step 11: Start API Server (2 minutes)

```bash
# Still on Doodah VPS
cd /root/whatsapp-vpslink

# Start API with PM2
pm2 start api.js --name whatsapp-api

# Save PM2 configuration
pm2 save

# Check status
pm2 status

# View logs
pm2 logs whatsapp-api --lines 20
```

**Expected output:**
```
────────────────────────────────────────────────────────
🚀 WhatsApp VPSLink API Server
────────────────────────────────────────────────────────
✓ Listening on port 3001
✓ Database: SQLite
...
```

---

### Step 12: Configure UFW Firewall (1 minute)

```bash
# Allow Saadi VPS to access API
ufw allow from 192.209.62.48 to any port 3001

# Verify rule
ufw status | grep 3001
```

**Expected output:**
```
3001                       ALLOW       192.209.62.48
```

---

### Step 13: Test API from Your Mac (2 minutes)

```bash
# From your Mac, test API
curl http://5.231.56.146:3001/api/health

# Should return JSON with status "ok"
```

---

## Next: Update Web UI

Now that Doodah is ready, you need to update the Web UI to use the API instead of direct S3 access.

**Full instructions in:** [IMPLEMENTATION-CHECKLIST.md](./IMPLEMENTATION-CHECKLIST.md#phase-4-web-ui-updates-30-mins)

**Quick summary:**
1. SSH to Saadi VPS
2. Create `lib/doodah-api.ts` API client
3. Update `.env.local` with Doodah API URL and secret
4. Update schedule creation code to call API
5. Rebuild and restart

---

## Monitoring & Verification

### Check API Status
```bash
ssh root@5.231.56.146 'pm2 logs whatsapp-api --lines 50'
```

### Check Backups
```bash
ssh root@5.231.56.146 'tail -f /root/whatsapp-vpslink/logs/backup.log'
```

### Check Database Size
```bash
ssh root@5.231.56.146 'du -sh /root/whatsapp-vpslink/data/'
```

### Test Scheduler Integration
```bash
# Schedule a test message via API
TOKEN=$(curl -s -X POST http://5.231.56.146:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' \
  | jq -r '.token')

curl -X POST http://5.231.56.146:3001/api/scheduled \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "to_phone": "447779299086",
    "message": "Test message from new API",
    "scheduled_at": "'$(date -u -d '+2 minutes' +%Y-%m-%dT%H:%M:%SZ)'"
  }'
```

Watch scheduler logs to verify it picked up the message.

---

## Rollback Plan (If Needed)

If anything goes wrong:

```bash
ssh root@5.231.56.146
cd /root/whatsapp-vpslink

# Stop new API
pm2 delete whatsapp-api

# Restore old code
cp scheduler.js.backup-YYYYMMDD scheduler.js

# Restart old scheduler
pm2 restart whatsapp-scheduler

# System returns to old S3 polling mode
```

Maximum downtime: **5 minutes**

---

## What's Different After Migration

### For You (Developer)
- ✅ 95% fewer S3 reads
- ✅ Sub-millisecond database queries
- ✅ Full REST API for building apps
- ✅ Easy to switch backup providers
- ✅ Predictable costs (nearly zero)

### For End Users
- **Nothing!** Same Web UI, same scheduling workflow, messages send identically

---

## Troubleshooting

### Database file not found
```bash
ls -lh /root/whatsapp-vpslink/data/whatsapp.db
# If missing, re-upload from Mac
```

### API won't start
```bash
pm2 logs whatsapp-api --err
# Check for missing dependencies or port conflicts
```

### Backup fails
```bash
tail -50 /root/whatsapp-vpslink/logs/backup.log
# Check Garage S3 connectivity and credentials
```

### Can't connect to API from Mac
```bash
# Check UFW
ssh root@5.231.56.146 'ufw status | grep 3001'

# Check API is running
ssh root@5.231.56.146 'pm2 status whatsapp-api'
```

---

## Documentation Reference

- **[MIGRATION-PLAN.md](./MIGRATION-PLAN.md)** - Complete migration guide
- **[API-DESIGN.md](./API-DESIGN.md)** - Full API documentation
- **[BACKUP-SWITCHING-GUIDE.md](./BACKUP-SWITCHING-GUIDE.md)** - Switch Garage ↔ Backblaze
- **[IMPLEMENTATION-CHECKLIST.md](./IMPLEMENTATION-CHECKLIST.md)** - Detailed checklist

---

## Ready?

✅ Dependencies installed (`npm install`)
✅ S3 data downloaded
✅ Migration script tested
✅ Database created and verified
✅ Ready to deploy to Doodah

**Let's do it!** Start with Step 6 (Backup Current System).

Good luck! 🚀
