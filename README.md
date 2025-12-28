# WhatsApp VPSLink - Scheduled Message System

**Version:** 2.0.0 (SQLite + REST API)
**Last Updated:** December 28, 2025
**Status:** ✅ Production Ready

---

## Overview

A complete WhatsApp message scheduling system with:
- **REST API** for programmatic access (JWT authentication)
- **SQLite database** for fast, efficient storage
- **Automated scheduler** that sends messages at specified times
- **260 contacts, 19K+ messages** in production database
- **Professional dark theme** Web UI
- **Searchable contact picker** with favorites
- **Full contact management** (edit, add aliases/tags, toggle favorites)
- **Multi-message jobs** with retry logic and progress tracking

---

## Quick Start

### Access the System

**REST API:**
🌐 `http://192.209.62.48:3001` (from Saadi VPS)
🔑 JWT Authentication required
📖 [Full API Documentation](docs/API.md)

**Web UI** (being migrated to use REST API):
🌐 http://192.209.62.48:3000
🔑 Password: `admin123`

**Features:**
- Schedule messages to any contact via API or Web UI
- Manage 260+ contacts
- View scheduled/sent/failed messages
- Edit contacts (names, phones, aliases, tags)
- Create multi-message jobs with retry logic
- Search and filter contacts

### Using the REST API

```bash
# 1. Login
curl -X POST http://192.209.62.48:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"password":"your-password"}'
# Returns: {"token":"eyJhbGci...","expiresIn":"24h"}

# 2. Get contacts
curl http://192.209.62.48:3001/api/contacts \
  -H "Authorization: Bearer YOUR_TOKEN"

# 3. Schedule a message
curl -X POST http://192.209.62.48:3001/api/scheduled \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "to_phone": "447779299086",
    "message": "Happy New Year!",
    "scheduled_at": "2025-12-31T23:59:00.000Z"
  }'
```

See [docs/API.md](docs/API.md) for complete API reference.

---

## Documentation Index

### 🚀 Getting Started
- **[README.md](README.md)** - This file (start here)
- **[docs/API.md](docs/API.md)** - REST API documentation (NEW)
- **[PROJECT-STRUCTURE.md](PROJECT-STRUCTURE.md)** - Project organization guide (NEW)

### 🏗️ Architecture
- **[migration/s3-to-sqlite/](migration/s3-to-sqlite/)** - SQLite migration files
- **[migration/s3-to-sqlite/schema.sql](migration/s3-to-sqlite/schema.sql)** - Database schema
- **[migration/s3-to-sqlite/SECURITY-AUDIT.md](migration/s3-to-sqlite/SECURITY-AUDIT.md)** - Security audit report (NEW)

### 🚢 Deployment
- **[docs/DEPLOYMENT-CHECKLIST.md](docs/DEPLOYMENT-CHECKLIST.md)** - Deployment checklist (NEW)
- **[docs/deployment/DEPLOYMENT.md](docs/deployment/DEPLOYMENT.md)** - Full deployment guide
- **[docs/deployment/VPS-DETAILS.md](docs/deployment/VPS-DETAILS.md)** - Server credentials & setup

### 📚 Legacy Documentation
- **[docs/archive/](docs/archive/)** - Old S3-based system documentation

---

## System Architecture

### NEW (v2.0.0): SQLite + REST API

```
┌─────────────────────────────────────────────────────────┐
│           WEB UI (Saadi VPS - 192.209.62.48)            │
│                                                          │
│  Next.js 15 + React 18 + TypeScript                     │
│  Port: 3000 (being migrated to use REST API)            │
│  PM2: whatsapp-web                                       │
└──────────────────────┬──────────────────────────────────┘
                       │
                       │ HTTP/JWT (future)
                       ▼
┌─────────────────────────────────────────────────────────┐
│          REST API (Doodah VPS - 5.231.56.146)           │
│                                                          │
│  Express.js + JWT Authentication                         │
│  Port: 3001 (restricted to Saadi VPS by firewall)      │
│  PM2: whatsapp-api                                       │
│                                                          │
│  Endpoints: /auth, /api/contacts, /api/scheduled,      │
│             /api/jobs, /api/chats, /api/stats           │
└──────────────────────┬──────────────────────────────────┘
                       │
                       │ better-sqlite3
                       ▼
┌─────────────────────────────────────────────────────────┐
│           SQLITE DB (Doodah VPS - 5.231.56.146)         │
│                                                          │
│  Location: /root/whatsapp-vpslink/data/whatsapp.db     │
│  Size: 3.76 MB | WAL mode enabled                       │
│                                                          │
│  Tables: contacts (260), scheduled_messages (19),       │
│          jobs (16), chats (104), messages (19,033)      │
└──────────────────────┬──────────────────────────────────┘
                       │
                       │ Read every 60s
                       ▼
┌─────────────────────────────────────────────────────────┐
│         SCHEDULER (Doodah VPS - 5.231.56.146)           │
│                                                          │
│  Node.js + Baileys (WhatsApp Web)                       │
│  PM2: whatsapp-scheduler                                 │
│                                                          │
│  • Queries SQLite every 60 seconds                      │
│  • Sends messages at scheduled time                     │
│  • Updates status to sent/failed in SQLite              │
│  • Handles multi-message jobs with retry logic          │
│  • Auto-reconnects to WhatsApp                          │
└─────────────────────────────────────────────────────────┘

                       ┌──────────────┐
                       │  BACKUP      │
                       │  (Hourly)    │
                       │              │
                       │  Garage S3   │
                       │  (Self-      │
                       │   hosted)    │
                       └──────────────┘
```

### Key Improvements in v2.0.0

**Old System (S3):**
- Polled S3 every 60s → 1,440+ API calls/day → Hit transaction limits
- Network latency on every read/write
- Expensive for frequent operations
- Single JSON file locking issues

**New System (SQLite + S3 Backup):**
- Local SQLite → No network overhead → Instant queries
- S3 only for hourly backups → 24 API calls/day → 98% cost reduction
- WAL mode → Concurrent reads while writing
- Proper database indexes → Fast queries
- REST API → Easy integration with Web UI and future iPhone app

---

## Project Structure

```
WhatsApp-VPSLink/
├── README.md                    # Main entry point (this file)
├── PROJECT-STRUCTURE.md         # Detailed project organization guide
├── docs/                        # Documentation
│   ├── API.md                  # REST API documentation (NEW)
│   ├── DEPLOYMENT-CHECKLIST.md # Deployment checklist (NEW)
│   ├── deployment/             # Deployment guides
│   └── archive/                # Old S3-based system docs
├── migration/                   # Migration files (NEW)
│   ├── s3-to-sqlite/           # S3 to SQLite migration
│   │   ├── api.js              # REST API server
│   │   ├── scheduler-new.js    # New SQLite scheduler
│   │   ├── schema.sql          # Database schema
│   │   ├── migrate-s3-to-sqlite.js  # Migration script
│   │   ├── src/                # Source code
│   │   │   ├── db.js           # SQLite wrapper
│   │   │   ├── auth.js         # JWT authentication
│   │   │   └── backup.js       # S3 backup system
│   │   ├── test-api.js         # API testing
│   │   ├── package.json        # New system dependencies
│   │   └── SECURITY-AUDIT.md   # Security audit report
│   └── v2-upgrade/             # v1→v2 upgrade docs
├── old-system/                  # Legacy S3-based files (ARCHIVED)
│   ├── wa.js                   # Old WhatsApp client
│   └── contacts.json           # Old contacts file
├── auth_info/                   # WhatsApp authentication (Baileys)
├── scripts/                     # Utility scripts
├── tools/                       # CLI tools
└── package.json                 # Dependencies

PRODUCTION (Doodah VPS - 5.231.56.146):
/root/whatsapp-vpslink/
├── api.js                      # REST API (from migration/s3-to-sqlite/)
├── scheduler.js                # Scheduler (from migration/s3-to-sqlite/)
├── src/db.js                   # Database wrapper
├── data/whatsapp.db            # SQLite database (3.76 MB)
└── auth_info/                  # WhatsApp auth
```

See [PROJECT-STRUCTURE.md](PROJECT-STRUCTURE.md) for detailed explanation.

---

## Key Features

### ✅ Message Scheduling
- Schedule messages to any contact
- Set date and time (Europe/London timezone)
- Automatic sending via scheduler (checks every 60 seconds)
- Status tracking (pending/sent/failed)
- Delete scheduled messages
- Filter by status

### ✅ Contact Management
- 272 contacts stored in S3
- **Search** by name, phone, or alias
- **Filter** by favorites
- **Edit contacts** with modal
- **Toggle favorite** with star icon
- View all contact details

### ✅ Enhanced Contact Picker
- **Type to search** by name/phone/alias
- **Favorites toggle** to show only starred contacts
- **Live dropdown** with results filtering
- **Visual confirmation** of selected contact

### ✅ Professional Dark Theme
- Clean, modern dark UI
- Apple-style aesthetic
- Responsive layout
- Smooth animations

---

## Tech Stack

### REST API (Doodah VPS)
- Node.js 20.x
- Express.js 4.18
- better-sqlite3 9.2 (SQLite driver)
- jsonwebtoken 9.0 (JWT auth)
- express-rate-limit 7.1
- PM2

### Scheduler (Doodah VPS)
- Node.js 20.x
- @whiskeysockets/baileys 6.7 (WhatsApp Web API)
- better-sqlite3 9.2
- PM2

### Database
- SQLite 3 with WAL mode
- Size: 3.76 MB
- Location: `/root/whatsapp-vpslink/data/whatsapp.db`
- Tables: contacts, scheduled_messages, jobs, chats, messages

### Backup Storage
- Garage S3 (self-hosted S3-compatible)
- Frequency: Hourly cron job
- Includes: database + auth_info/

---

## Server Details

### Saadi VPS (192.209.62.48)
- **Purpose:** Web UI hosting (+ future API client)
- **PM2 Processes:**
  - `whatsapp-web` (Next.js Web UI on port 3000)
- **Location:** `/var/www/whatsapp-scheduler`

### Doodah VPS (5.231.56.146)
- **Purpose:** REST API + Scheduler + Database
- **PM2 Processes:**
  - `whatsapp-api` (REST API on port 3001)
  - `whatsapp-scheduler` (Message scheduler)
  - `whatsapp-health` (Health monitor on port 3002)
- **Location:** `/root/whatsapp-vpslink`
- **Firewall:** UFW - ports 3001/3002 restricted to 192.209.62.48

---

## Common Tasks

### Check System Status

```bash
# Web UI status
ssh root@192.209.62.48
pm2 status

# Scheduler status
ssh root@5.231.56.146
pm2 status
```

### Restart Services

```bash
# Restart web UI
ssh root@192.209.62.48
pm2 restart whatsapp-web

# Restart scheduler
ssh root@5.231.56.146
pm2 restart whatsapp-scheduler
```

### Rebuild Web UI

```bash
ssh root@192.209.62.48
cd /var/www/whatsapp-scheduler
npm run build
pm2 restart whatsapp-web
```

---

## Recent Changes

### 🚀 v2.0.0 - SQLite + REST API Migration (December 28, 2025)

**Major Architecture Change:**
- ✅ Migrated from S3 JSON to SQLite database
- ✅ Built REST API with JWT authentication
- ✅ Deployed new scheduler using SQLite
- ✅ Set up hourly S3 backups (Garage S3)
- ✅ Reduced S3 API calls by 98% (1,440→24/day)
- ✅ Eliminated network latency on reads/writes
- ✅ Security audit completed and documented

**Database Migration:**
- 260 contacts migrated
- 19 scheduled messages migrated
- 16 jobs migrated
- 104 chats + 19,033 messages migrated
- Final DB size: 3.76 MB

**New Features:**
- REST API with 20+ endpoints ([docs/API.md](docs/API.md))
- Multi-message jobs with retry logic
- Progress tracking for long-running jobs
- JWT token authentication
- Rate limiting (100 req/15min)
- Comprehensive API testing script

**Documentation:**
- Complete API documentation
- Security audit report
- Deployment checklist
- Project structure guide
- Migration guide

**See:** [migration/s3-to-sqlite/](migration/s3-to-sqlite/) for all migration files

---

### v1.x - S3-Based System (December 23, 2025)

- Fixed scheduler service
- Enhanced contact picker
- Contact editing
- Documentation organization

See [docs/archive/](docs/archive/) for v1.x documentation

---

## Future Enhancements

**Top Priority:**
- Migrate Web UI to use REST API
- Fix WhatsApp authentication on scheduler
- Calendar default date fix
- iPhone app using REST API
- Message templates
- Recurring message scheduler
- Analytics dashboard

---

## Support

**Access:**
- Web UI: http://192.209.62.48:3000
- Saadi VPS: `root@192.209.62.48`
- Doodah VPS: `root@5.231.56.146`

**Documentation:**
- Start with [QUICKSTART.md](docs/guides/QUICKSTART.md)
- For issues, see [troubleshooting/](docs/troubleshooting/)

---

## Version History

| Version | Date | Major Changes |
|---------|------|---------------|
| **2.0.0** | Dec 28, 2025 | SQLite migration, REST API, 98% cost reduction |
| **1.x** | Dec 23, 2025 | S3-based system, scheduler fixes, contact editing |
| **1.0** | Dec 22, 2025 | Initial implementation |

---

**Last Updated:** December 28, 2025
**Status:** ✅ Production - v2.0.0 (SQLite + REST API)
