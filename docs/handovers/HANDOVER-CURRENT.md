# WhatsApp VPSLink - Session Handover Document

**Date:** 2025-12-28
**Session End:** Claude usage at 80%
**Next Task:** Connect Web UI to the new API on Doodah

---

## Current System Status

### Production Services (Doodah VPS: 5.231.56.146)

**Active Services via PM2:**
- `whatsapp-scheduler` (PM2 ID: 0) - ONLINE
  - File: `/root/whatsapp-vpslink/scheduler-simple.js`
  - Checks database every 60 seconds for pending messages
  - Auto-reconnects to WhatsApp on disconnect
  - Uptime: 12m (1 restart)

- `whatsapp-api` (PM2 ID: 2) - ONLINE
  - File: `/root/whatsapp-vpslink/api-simple.js`
  - Listening on port 3001 (localhost only)
  - Provides REST API for message scheduling
  - Uptime: 5m (0 restarts)

**Health Check Issue:**
- Health monitor is checking port 3002 (wrong port)
- API is actually on port 3001 and working correctly
- **ACTION REQUIRED:** Update health monitor to use port 3001
  - URL: `http://5.231.56.146:3001/health`
  - JSON Query: `$.status`
  - Expected Value: `ok`

---

## Architecture Overview

### Core Files (Production)

1. **whatsapp-listener.js** (2,794 bytes)
   - Clean WhatsApp connection module
   - Based on proven baileys-test approach
   - Exports: `sendMessage()`, `isWhatsAppConnected()`
   - Auto-connects on module load
   - Handles QR code display and reconnection

2. **scheduler-simple.js** (2,682 bytes)
   - Checks SQLite database every 60 seconds
   - Sends pending messages via whatsapp-listener
   - Updates message status (sent/failed)
   - Entry point: `npm start`

3. **api-simple.js** (8,229 bytes)
   - Express REST API on port 3001
   - 6 endpoints (see API section below)
   - Full validation and error handling
   - CORS enabled for development

### Database

**Location:** `/root/whatsapp-vpslink/data/whatsapp.db`
**Type:** SQLite (better-sqlite3)

**Schema: `scheduled_messages`**
```sql
id              TEXT PRIMARY KEY
to_phone        TEXT NOT NULL
contact_name    TEXT
message         TEXT NOT NULL
scheduled_at    TEXT NOT NULL  -- ISO 8601 format
status          TEXT DEFAULT 'pending'  -- 'pending', 'sent', 'failed'
error_message   TEXT
created_at      TEXT DEFAULT CURRENT_TIMESTAMP
sent_at         TEXT
```

**Current State:**
- 1 message in database (test message)
- Status: pending (scheduled for 18:42:00Z)

---

## API Endpoints

**Base URL:** `http://5.231.56.146:3001`
**Note:** Port 3001 is localhost only (firewall blocks external access)

### Available Endpoints:

1. **GET /health** - Health check
   ```json
   Response: {
     "status": "ok",
     "database": "connected",
     "messages_count": 1,
     "timestamp": "2025-12-28T18:39:04.061Z"
   }
   ```

2. **GET /api/stats** - Message statistics
   ```json
   Response: {
     "success": true,
     "stats": {
       "total": 1,
       "pending": 1,
       "sent": 0,
       "failed": 0
     }
   }
   ```

3. **GET /api/messages?status=pending** - List messages
   - Optional query param: `status` (pending/sent/failed)
   - Returns all messages ordered by scheduled_at DESC

4. **POST /api/messages** - Schedule new message
   ```json
   Body: {
     "to_phone": "447779299086",
     "contact_name": "Saadi",
     "message": "Test message",
     "scheduled_at": "2025-12-28T19:00:00Z"
   }
   ```
   - Validates phone format (international)
   - Validates ISO 8601 date format
   - Auto-generates unique ID

5. **GET /api/messages/:id** - Get specific message

6. **DELETE /api/messages/:id** - Delete message
   - Only pending messages can be deleted

---

## Project Structure

```
/Users/saadi/Documents/GitHub/WhatsApp-VPSLink/
├── whatsapp-listener.js     ⭐ WhatsApp connection module
├── scheduler-simple.js       ⭐ Main scheduler (npm start)
├── api-simple.js            ⭐ REST API server
├── package.json             ⭐ Dependencies
├── .env                     ⭐ Environment config
│
├── data/
│   └── whatsapp.db          ⭐ SQLite database
│
├── auth_info/               ⭐ WhatsApp session data
│   └── creds.json              (WhatsApp authentication)
│
├── docs/
│   ├── API.md
│   ├── DEPLOYMENT-CHECKLIST.md
│   ├── CHANGELOG-DEC-2025.md
│   └── INDEX.md
│
├── tools/
│   ├── import-contacts.js
│   ├── import-aliases.js
│   └── contacts-manager.js
│
├── migration/               (Old code - can be archived)
│   ├── s3-to-sqlite/
│   └── v2-upgrade/
│
└── Other files:
    ├── health.js            (Old health check - not used)
    ├── test-connection.js   (Testing tool)
    ├── test-scheduler.js    (Testing tool)
    └── web-qr.js           (Web-based QR display)
```

---

## Dependencies

```json
{
  "@aws-sdk/client-s3": "^3.956.0",
  "@whiskeysockets/baileys": "^7.0.0-rc.9",
  "better-sqlite3": "^11.8.1",
  "dotenv": "^17.2.3",
  "express": "^4.18.2",
  "qrcode": "^1.5.4",
  "qrcode-terminal": "^0.12.0"
}
```

**Node.js Version:** v20.19.6 (managed via nvm on VPS)

---

## Recent Issues & Fixes

### Issue 1: Database Column Mismatch
- **Error:** `SqliteError: no such column: scheduled_time`
- **Fix:** Changed all references from `scheduled_time` to `scheduled_at`
- **Location:** scheduler-simple.js:31

### Issue 2: PM2 Running Wrong File
- **Error:** PM2 kept trying to run old `scheduler.js`
- **Fix:** Deleted old file, ran `pm2 delete all && pm2 flush && pm2 kill`
- **Solution:** Fresh start with `pm2 start scheduler-simple.js --name whatsapp-scheduler`

### Issue 3: WhatsApp Spam Messages
- **Error:** User receiving messages every minute
- **Cause:** Old test messages had past scheduled_at times
- **Fix:** Deleted all pending messages from database
- **Prevention:** Scheduler now only sends once per message

### Issue 4: Port 3001 Not Accessible Externally
- **Error:** `curl: (28) Failed to connect to 5.231.56.146 port 3001`
- **Cause:** Firewall blocking external access
- **Solution:** Works fine on localhost - can proxy via nginx if needed

---

## Testing Commands

### Local Testing (from Mac):
```bash
# SSH to VPS
ssh root@5.231.56.146

# Check PM2 status
pm2 status

# Check logs
pm2 logs whatsapp-scheduler --lines 20
pm2 logs whatsapp-api --lines 20

# Test API (on VPS)
curl http://localhost:3001/health
curl http://localhost:3001/api/stats
curl http://localhost:3001/api/messages

# Schedule test message
curl -X POST http://localhost:3001/api/messages \
  -H "Content-Type: application/json" \
  -d '{"to_phone":"447779299086","contact_name":"Test","message":"Hello","scheduled_at":"2025-12-28T19:00:00Z"}'

# Delete message
curl -X DELETE http://localhost:3001/api/messages/msg_1234567890_abc123
```

### Database Queries (on VPS):
```bash
# View all messages
node -e "const db = require('better-sqlite3')('data/whatsapp.db'); console.log(db.prepare('SELECT * FROM scheduled_messages').all());"

# Clear pending messages
node -e "const db = require('better-sqlite3')('data/whatsapp.db'); db.prepare('DELETE FROM scheduled_messages WHERE status = ?').run('pending');"

# Count messages by status
node -e "const db = require('better-sqlite3')('data/whatsapp.db'); console.log(db.prepare('SELECT status, COUNT(*) as count FROM scheduled_messages GROUP BY status').all());"
```

---

## Next Steps (For Next Claude Session)

### Primary Task: Connect Web UI to API

**Goal:** Reconnect the existing Web UI to the new API on Doodah (port 3001)

**Sub-tasks:**
1. Locate existing Web UI files (check if in project or separate repo)
2. Update API endpoint URLs to point to `http://5.231.56.146:3001`
3. Handle CORS if needed (already enabled in api-simple.js)
4. Consider opening port 3001 in firewall OR setting up nginx proxy
5. Test all Web UI functions with new API

**Considerations:**
- Port 3001 is currently localhost-only
- May need to:
  - Open port 3001 in firewall, OR
  - Set up nginx reverse proxy, OR
  - Run Web UI on the VPS itself

**Files to Check:**
- Look for `web/`, `frontend/`, `ui/`, or similar directories
- Check if Web UI is in a separate GitHub repo
- Review `.gitignore` to see if Web UI files are excluded

---

## Important Notes

### WhatsApp Connection
- Auth session stored in `/root/whatsapp-vpslink/auth_info/`
- QR code displayed in terminal if session expires
- Auto-reconnects on disconnect (unless logged out)
- **DO NOT** spam messages to avoid WhatsApp ban

### Phone Number Format
- International format required: `447779299086` (no + symbol in database)
- API accepts with or without + symbol
- Validation regex: `/^\+?[1-9]\d{1,14}$/`

### Date Format
- Must use ISO 8601: `2025-12-28T19:00:00Z`
- Times are in UTC
- Scheduler uses `datetime('now')` for comparisons

### PM2 Management
```bash
# View all processes
pm2 status

# Restart services
pm2 restart whatsapp-scheduler
pm2 restart whatsapp-api

# View logs
pm2 logs

# Save PM2 config
pm2 save

# Setup auto-start on reboot
pm2 startup
```

---

## Git Status

**Branch:** master
**Last Commit:** Added api-simple.js and updated package.json
**Uncommitted Changes:** None (all code committed)

**Ready to Push:**
- All changes committed locally
- Need to push to GitHub before ending session

---

## Environment Variables (.env on VPS)

```bash
# API Configuration
API_PORT=3001

# AWS/S3 (not currently used with SQLite)
AWS_REGION=us-west-004
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
S3_BUCKET=whatsapp-backup
S3_ENDPOINT=https://s3.us-west-004.backblazeb2.com

# Database
DB_PATH=./data/whatsapp.db
```

---

## Known Limitations

1. **Port Access:** API on port 3001 is localhost-only
2. **Authentication:** No API authentication yet (future enhancement)
3. **Media Support:** Only text messages supported (no images/files yet)
4. **Rate Limiting:** No rate limiting on API endpoints
5. **Timezone:** All times in UTC (scheduler displays Europe/London in logs but uses UTC internally)

---

## Quick Reference

### Restart Everything
```bash
ssh root@5.231.56.146
pm2 restart all
pm2 logs
```

### Check If WhatsApp Connected
```bash
ssh root@5.231.56.146
pm2 logs whatsapp-scheduler | grep "Connected to WhatsApp"
```

### Clear Database
```bash
ssh root@5.231.56.146
cd /root/whatsapp-vpslink
node -e "const db = require('better-sqlite3')('data/whatsapp.db'); db.prepare('DELETE FROM scheduled_messages').run(); console.log('All messages deleted');"
```

---

## Questions for User (If Needed)

1. Where is the Web UI code located?
2. Should we open port 3001 externally or use nginx proxy?
3. Do you want API authentication before exposing it?
4. Any specific Web UI features needed?

---

**End of Handover Document**

*Generated: 2025-12-28 at 80% Claude token usage*
