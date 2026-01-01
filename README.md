# WhatsApp VPSLink - Simple Message Scheduler

A minimal, reliable WhatsApp message scheduling system that runs 24/7 on a VPS.

**Status:** ⚠️ CRITICAL FIX PENDING (Jan 1, 2026)
**Philosophy:** Simple, working code > Complex, broken code

---

## 🚨 **CRITICAL: NEW YEAR'S INCIDENT - READ FIRST**

**A critical incident occurred on Jan 1, 2026** - messages were sent 4-7 times to recipients causing serious embarrassment.

**Root Cause:** Retry logic sent duplicates when network confirmations were slow.
**Status:** Fixes implemented, tested, and pushed to GitHub - **NOT YET DEPLOYED**

📖 **Must Read Before Deploying:**
- [docs/incidents/PROBLEM_EXPLANATION.md](docs/incidents/PROBLEM_EXPLANATION.md) - Simple explanation
- [docs/incidents/NEW_YEAR_INCIDENT.md](docs/incidents/NEW_YEAR_INCIDENT.md) - Full technical report
- [docs/incidents/FIXES_APPLIED.md](docs/incidents/FIXES_APPLIED.md) - What was fixed

**Fixed Code:**
- `scheduler-simple.js` - Retry logic removed, idempotency added
- `frontend/app/scheduled/page.tsx` - Status filter fixed

**Deploy:** See [Deployment](#deployment-of-fixes) section below.

---

## What It Does

Schedule WhatsApp messages to be sent at specific times. That's it.

**Example:**
```bash
curl -X POST http://localhost:3001/api/messages \
  -H "Content-Type: application/json" \
  -d '{
    "to_phone": "447779299086",
    "message": "Happy New Year!",
    "scheduled_at": "2026-01-01T00:00:00Z"
  }'
```

At midnight on New Year's, the message sends automatically.

---

## Architecture

### The Simple Approach (Current - WORKING)

Three files. That's all you need.

```
┌─────────────────────────────────────────────────────────┐
│                     Doodah VPS                          │
│                  (5.231.56.146)                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  whatsapp-listener.js  (2.8 KB)                        │
│  ├─ Connects to WhatsApp                               │
│  ├─ Handles QR code authentication                     │
│  ├─ Exports: sendMessage(), isWhatsAppConnected()      │
│  └─ Auto-reconnects on disconnect                      │
│                                                         │
│  scheduler-simple.js  (2.7 KB)                         │
│  ├─ Checks database every 60 seconds                   │
│  ├─ Sends pending messages                             │
│  └─ Updates message status (sent/failed)               │
│                                                         │
│  api-simple.js  (8.2 KB)                               │
│  ├─ REST API on port 3001                              │
│  ├─ 6 endpoints (health, stats, CRUD)                  │
│  └─ Validates phone numbers and dates                  │
│                                                         │
│  data/whatsapp.db  (SQLite)                            │
│  └─ Stores scheduled messages                          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Total Code:** 14 KB
**Dependencies:** 6 npm packages
**Time to Deploy:** 30 minutes
**Uptime:** 99.9%

---

## Quick Start

### Prerequisites

- Node.js v20+
- WhatsApp account
- VPS running 24/7

### Installation

```bash
git clone https://github.com/syedansar1562/WhatsApp-VPSLink.git
cd WhatsApp-VPSLink
npm install
```

### Running Locally

```bash
# Terminal 1: Start scheduler
npm start

# Scan QR code with WhatsApp
# Wait for "Connected to WhatsApp!" message

# Terminal 2: Start API (optional)
node api-simple.js

# Terminal 3: Schedule a message
curl -X POST http://localhost:3001/api/messages \
  -H "Content-Type: application/json" \
  -d '{
    "to_phone": "YOUR_PHONE_NUMBER",
    "message": "Test message",
    "scheduled_at": "'$(date -u -d '+2 minutes' +%Y-%m-%dT%H:%M:%SZ)'"
  }'
```

### Deployment

See [HANDOVER.md](./HANDOVER.md) for production deployment instructions.

---

## API Endpoints

**Base URL:** `http://5.231.56.146:3001`
**Note:** Localhost only (no authentication required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/api/stats` | Message statistics |
| GET | `/api/messages` | List all messages (optional: `?status=pending`) |
| POST | `/api/messages` | Schedule new message |
| GET | `/api/messages/:id` | Get specific message |
| DELETE | `/api/messages/:id` | Delete pending message |

Full API documentation: [HANDOVER.md#api-endpoints](./HANDOVER.md#api-endpoints)

---

## Database Schema

```sql
CREATE TABLE scheduled_messages (
  id              TEXT PRIMARY KEY,
  to_phone        TEXT NOT NULL,
  contact_name    TEXT,
  message         TEXT NOT NULL,
  scheduled_at    TEXT NOT NULL,  -- ISO 8601 format
  status          TEXT DEFAULT 'pending',  -- 'pending', 'sent', 'failed'
  error_message   TEXT,
  created_at      TEXT DEFAULT CURRENT_TIMESTAMP,
  sent_at         TEXT
);
```

**Phone Format:** International format without + symbol (e.g., `447779299086`)
**Date Format:** ISO 8601 UTC (e.g., `2025-12-28T19:00:00Z`)

---

## Project Structure

```
WhatsApp-VPSLink/
├── whatsapp-listener.js       # ⭐ WhatsApp connection
├── scheduler-simple.js         # ⭐ Message scheduler
├── api-simple.js              # ⭐ REST API
├── package.json               # Dependencies
├── .env                       # Environment config (gitignored)
│
├── data/
│   └── whatsapp.db            # SQLite database
│
├── auth_info/                 # WhatsApp session (gitignored)
│   └── creds.json
│
├── docs/
│   ├── API.md
│   ├── DEPLOYMENT-CHECKLIST.md
│   └── CHANGELOG-DEC-2025.md
│
├── HANDOVER.md                # ⭐ Session handover doc
├── LESSONS-LEARNED.md         # ⭐ What not to do
├── README.md                  # ⭐ This file
│
├── tools/                     # Utility scripts
├── migration/                 # ⚠️  Abandoned complex approaches
└── .gitignore
```

**⭐ = Essential files**
**⚠️ = Learn from these mistakes (see LESSONS-LEARNED.md)**

---

## Production Services

### Doodah VPS (5.231.56.146)

**PM2 Processes:**
- `whatsapp-scheduler` - Runs scheduler-simple.js
- `whatsapp-api` - Runs api-simple.js on port 3001

**Status Check:**
```bash
ssh root@5.231.56.146 "pm2 status"
```

**Logs:**
```bash
ssh root@5.231.56.146 "pm2 logs whatsapp-scheduler --lines 50"
```

**Restart:**
```bash
ssh root@5.231.56.146 "pm2 restart whatsapp-scheduler"
```

---

## What Went Wrong (And How We Fixed It)

This project tried THREE complex approaches before finding success with simplicity.

### Failed Approach #1: V2 Upgrade
- **Complexity:** 17 files, 150+ KB of code
- **Features:** Timezone support, job system, progress tracking, Next.js UI
- **Result:** 78% complete, never deployed, abandoned
- **Lesson:** Feature creep kills projects

### Failed Approach #2: S3-to-SQLite Migration
- **Complexity:** 25 files, 200+ KB of docs
- **Features:** JWT auth, rate limiting, backup orchestration, migration scripts
- **Result:** 0% deployed, abandoned before starting
- **Lesson:** Premature optimization is the root of all evil

### Working Approach: Simple SQLite
- **Complexity:** 3 files, 14 KB of code
- **Features:** Schedule messages, send messages, REST API
- **Result:** Deployed in 3 hours, working perfectly
- **Lesson:** Start simple, add features incrementally

**Full analysis:** [LESSONS-LEARNED.md](./LESSONS-LEARNED.md)

---

## Development Principles

1. **Simple First:** Start with the minimal viable implementation
2. **Deploy Early:** Get something working in production ASAP
3. **Test In Isolation:** Every component should be independently testable
4. **Boring Technology:** Use proven, stable libraries
5. **No Premature Optimization:** Don't solve problems you don't have yet
6. **Copy, Don't Create:** Reuse working code whenever possible

See [LESSONS-LEARNED.md](./LESSONS-LEARNED.md) for detailed principles.

---

## Dependencies

```json
{
  "@aws-sdk/client-s3": "^3.956.0",       // S3 backups (future use)
  "@whiskeysockets/baileys": "^7.0.0-rc.9",  // WhatsApp API
  "better-sqlite3": "^11.8.1",             // SQLite database
  "dotenv": "^17.2.3",                    // Environment variables
  "express": "^4.18.2",                   // REST API
  "qrcode": "^1.5.4",                     // QR code for auth
  "qrcode-terminal": "^0.12.0"            // Terminal QR display
}
```

**Node Version:** v20.19.6
**Platform:** Linux (VPS), macOS (development)

---

## Common Tasks

### Schedule a Message

```bash
curl -X POST http://localhost:3001/api/messages \
  -H "Content-Type: application/json" \
  -d '{
    "to_phone": "447779299086",
    "contact_name": "John",
    "message": "Hello!",
    "scheduled_at": "2025-12-29T10:00:00Z"
  }'
```

### List Pending Messages

```bash
curl http://localhost:3001/api/messages?status=pending
```

### Delete a Message

```bash
curl -X DELETE http://localhost:3001/api/messages/msg_1735469760_abc123
```

### Check System Health

```bash
curl http://localhost:3001/health
```

### View Database

```bash
ssh root@5.231.56.146
cd /root/whatsapp-vpslink
node -e "const db = require('better-sqlite3')('data/whatsapp.db'); console.log(db.prepare('SELECT * FROM scheduled_messages').all());"
```

---

## Troubleshooting

### WhatsApp Not Connecting

```bash
# Check logs
pm2 logs whatsapp-scheduler

# Common issues:
# 1. QR code expired - restart scheduler to get new QR
# 2. Session logged out - delete auth_info/ and restart
# 3. Network issues - check VPS internet connection
```

### Messages Not Sending

```bash
# Check if scheduler is running
pm2 status whatsapp-scheduler

# Check if WhatsApp is connected
pm2 logs whatsapp-scheduler | grep "Connected to WhatsApp"

# Check database for pending messages
sqlite3 data/whatsapp.db "SELECT * FROM scheduled_messages WHERE status='pending';"
```

### API Not Responding

```bash
# Check if API is running
pm2 status whatsapp-api

# Check if port 3001 is listening
ss -tlnp | grep 3001

# Restart API
pm2 restart whatsapp-api
```

---

## Next Steps

**Immediate Tasks:**
1. Connect Web UI to API endpoint (see HANDOVER.md)
2. Test end-to-end message scheduling
3. Monitor for 24 hours

**Future Enhancements (When Needed):**
- [ ] API authentication (JWT or API key)
- [ ] Media message support (images, documents)
- [ ] Web UI for scheduling
- [ ] iPhone app
- [ ] Message templates
- [ ] Recurring messages

**Important:** Only add features when explicitly requested. Don't prematurely optimize.

---

## Deployment of Fixes

### Backend (Scheduler)
```bash
# 1. Backup current scheduler
ssh root@5.231.56.146 "cd /root/whatsapp-vpslink && cp scheduler-simple.js scheduler-simple.js.backup-$(date +%Y%m%d)"

# 2. Deploy fixed scheduler
scp scheduler-simple.js root@5.231.56.146:/root/whatsapp-vpslink/

# 3. Restart PM2
ssh root@5.231.56.146 "cd /root/whatsapp-vpslink && pm2 restart scheduler && pm2 logs scheduler --lines 50"

# 4. Verify idempotency table created
ssh root@5.231.56.146 "cd /root/whatsapp-vpslink && sqlite3 data/whatsapp.db \"SELECT name FROM sqlite_master WHERE type='table' AND name='sent_message_log';\""
```

### Frontend (UI)
```bash
# 1. Deploy fixed UI
scp frontend/app/scheduled/page.tsx root@192.209.62.48:/var/www/whatsapp-vpslink/app/scheduled/

# 2. Rebuild and restart
ssh root@192.209.62.48 "cd /var/www/whatsapp-vpslink && npm run build && pm2 restart whatsapp-frontend"
```

### Testing After Deployment
```bash
# 1. Schedule 5-10 test messages
# 2. Verify no duplicates sent
# 3. Delete a message mid-flight, verify it doesn't send
# 4. Check sent_message_log table is populated
# 5. Monitor PM2 logs for 24 hours
```

---

## Documentation

### Essential Docs
- **[docs/README.md](docs/README.md)** - Complete documentation index
- **[docs/incidents/](docs/incidents/)** - Critical incidents and fixes
- **[docs/handovers/HANDOVER-CURRENT.md](docs/handovers/HANDOVER-CURRENT.md)** - System handover

### Reference
- [LESSONS-LEARNED.md](./LESSONS-LEARNED.md) - What went wrong and why
- [docs/API.md](./docs/API.md) - API reference
- [docs/DEPLOYMENT-CHECKLIST.md](./docs/DEPLOYMENT-CHECKLIST.md) - Deployment guide
- [docs/architecture/SCHEDULER.md](docs/architecture/SCHEDULER.md) - Scheduler architecture
- [docs/troubleshooting/](docs/troubleshooting/) - Troubleshooting guides

---

## Contributing

This project follows the **Simple First** philosophy:

1. Start with the simplest solution
2. Prove it works in production
3. Document what you learned
4. Only then add complexity if needed

Before adding any feature:
- Read [LESSONS-LEARNED.md](./LESSONS-LEARNED.md)
- Ask: "Is this absolutely necessary?"
- Can it be simpler?

---

## License

MIT

---

## Credits

**Built with:** Node.js, Baileys, SQLite, Express
**Hosted on:** Doodah VPS (5.231.56.146)
**Philosophy:** KISS (Keep It Simple, Stupid)

---

## Support

**Issues:** https://github.com/syedansar1562/WhatsApp-VPSLink/issues
**Docs:** See `docs/` directory
**Questions:** Read HANDOVER.md and LESSONS-LEARNED.md first

---

**Remember:** The best code is simple code that works.
