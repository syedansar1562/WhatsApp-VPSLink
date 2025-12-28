# WhatsApp VPSLink - Project Structure

**Last Updated**: December 28, 2025
**Version**: 2.0.0 (SQLite + REST API)

This document explains the organization of the WhatsApp VPSLink project after the S3-to-SQLite migration.

---

## Directory Structure

```
WhatsApp-VPSLink/
├── auth_info/                    # WhatsApp authentication (Baileys auth state)
├── docs/                         # Documentation
│   ├── API.md                   # REST API documentation
│   ├── ARCHITECTURE.md          # System architecture
│   └── archive/                 # Old documentation
│       ├── README.old.md
│       └── condensed-docs/
├── migration/                    # Migration-related files and scripts
│   ├── s3-to-sqlite/           # S3 to SQLite migration
│   │   ├── api.js              # New REST API server
│   │   ├── scheduler-new.js    # New SQLite-based scheduler
│   │   ├── schema.sql          # SQLite database schema
│   │   ├── migrate-s3-to-sqlite.js  # Migration script
│   │   ├── src/                # Source code
│   │   │   ├── db.js           # SQLite database wrapper
│   │   │   ├── auth.js         # JWT authentication
│   │   │   └── backup.js       # S3 backup system
│   │   ├── test-api.js         # API testing script
│   │   ├── package.json        # Dependencies (new system)
│   │   └── SECURITY-AUDIT.md   # Security audit report
│   └── v2-upgrade/             # Version 2 upgrade process
│       ├── migration-plan.md
│       └── deployment-steps.md
├── old-system/                   # Legacy files (pre-SQLite)
│   ├── wa.js                    # Old WhatsApp client
│   └── contacts.json            # Old contacts file
├── scripts/                      # Utility scripts
│   ├── backup.sh               # Manual backup script
│   └── qr.js                   # QR code generator for WhatsApp login
├── src/                          # Source code (old system - being phased out)
│   ├── scheduledStore.js       # Old S3-based scheduler (deprecated)
│   └── s3Client.js             # Old S3 client (deprecated)
├── tools/                        # Development tools
│   └── db-explorer.js          # SQLite database explorer
├── downloads/                    # Downloaded media files
├── .env                          # Environment variables (not in git)
├── .env.example                 # Environment variable template
├── .gitignore                   # Git ignore rules
├── package.json                 # Dependencies (main project)
├── health.js                    # Health check endpoint
├── PROJECT-STRUCTURE.md         # This file
└── README.md                    # Main project documentation
```

---

## Key Directories Explained

### `/migration/s3-to-sqlite/`
**Purpose**: Contains all code and scripts for the S3-to-SQLite migration

**Key Files**:
- `api.js` - New REST API server (port 3001)
- `scheduler-new.js` - New scheduler using SQLite
- `schema.sql` - SQLite database schema
- `migrate-s3-to-sqlite.js` - Migration script from S3 JSON to SQLite
- `src/db.js` - SQLite database wrapper with all database operations
- `SECURITY-AUDIT.md` - Security audit report for production server

**Status**: ACTIVE - This is the current production system

**Deployment**: These files are deployed to `/root/whatsapp-vpslink/` on Doodah VPS (5.231.56.146)

---

### `/migration/v2-upgrade/`
**Purpose**: Documentation and scripts for upgrading from v1 (S3) to v2 (SQLite)

**Contents**:
- Migration planning documents
- Deployment checklists
- Rollback procedures
- Comparison of old vs new architecture

**Status**: REFERENCE - Historical record of upgrade process

---

### `/old-system/`
**Purpose**: Archived legacy code from S3-based system

**What's here**:
- `wa.js` - Original WhatsApp client (used S3 for storage)
- `contacts.json` - Old contacts file (migrated to SQLite)

**Status**: ARCHIVED - Kept for reference, not used in production

---

### `/docs/`
**Purpose**: All project documentation

**Structure**:
- `API.md` - REST API endpoint documentation
- `ARCHITECTURE.md` - System architecture diagrams and explanations
- `archive/` - Old documentation kept for historical reference

**Status**: ACTIVE - Continuously updated

---

### `/auth_info/`
**Purpose**: WhatsApp authentication state (Baileys library)

**Contents**:
- `creds.json` - Main credentials file
- `app-state-sync-*.json` - WhatsApp state synchronization
- `pre-key-*.json` - Encryption pre-keys
- Various device and session files

**Important**:
- This directory is NOT in git (listed in `.gitignore`)
- Backed up to S3 hourly
- Required for WhatsApp connection persistence
- If deleted, will need to re-scan QR code

**Status**: CRITICAL - Do not delete or modify manually

---

### `/src/` (Old)
**Purpose**: Legacy source code from S3-based system

**Status**: DEPRECATED - Being phased out

**Migration**:
- Most functionality moved to `/migration/s3-to-sqlite/src/`
- Some files still used by old system during transition
- Will be removed once migration is 100% complete

---

### `/scripts/`
**Purpose**: Utility scripts for maintenance and operations

**Key Files**:
- `backup.sh` - Manual backup script
- `qr.js` - Generate QR code for WhatsApp login

**Status**: ACTIVE - Used for operational tasks

---

## Production Deployment

### Doodah VPS (5.231.56.146)
**Location**: `/root/whatsapp-vpslink/`

**Deployed Files**:
```
/root/whatsapp-vpslink/
├── api.js              (from migration/s3-to-sqlite/)
├── scheduler.js        (from migration/s3-to-sqlite/scheduler-new.js)
├── health.js
├── src/
│   ├── db.js
│   ├── auth.js
│   └── backup.js
├── data/
│   └── whatsapp.db     (SQLite database)
├── auth_info/          (WhatsApp authentication)
├── .env                (Environment variables)
└── package.json
```

**PM2 Services**:
- `whatsapp-api` - REST API server (port 3001)
- `whatsapp-scheduler` - Message scheduler
- `whatsapp-health` - Health monitoring (port 3002)

---

## File Organization Philosophy

### Active Development
Files actively used in the current system are in:
- `/migration/s3-to-sqlite/` - New SQLite-based system
- Root directory - Configuration and main files

### Reference & History
Files kept for reference but not actively used:
- `/old-system/` - Legacy code
- `/migration/v2-upgrade/` - Upgrade documentation
- `/docs/archive/` - Old documentation

### Utility & Tools
Helper scripts and tools:
- `/scripts/` - Operational scripts
- `/tools/` - Development tools

---

## Migration Status

### ✅ Completed
- SQLite database schema created
- S3 data migrated to SQLite (260 contacts, 19 messages, 16 jobs, 104 chats, 19,033 messages)
- REST API implemented and deployed
- Scheduler migrated to SQLite
- API tested and working
- Backup system configured (hourly to Garage S3)
- Security audit completed

### 🚧 In Progress
- Web UI migration to use REST API (currently uses S3)
- Documentation completion
- Calendar default date fix

### ⏳ Pending
- End-to-end testing with Web UI
- WhatsApp authentication fix on scheduler
- Final cleanup of old S3-based code

---

## Next Steps

1. Update Web UI to use REST API instead of S3
2. Fix calendar default date issue
3. Complete comprehensive documentation
4. Test end-to-end: Web UI → API → SQLite → Scheduler → WhatsApp
5. Clean up deprecated files in `/src/`
6. Push all changes to GitHub

---

## Notes for Future Developers

- **Primary Language**: JavaScript (Node.js)
- **Database**: SQLite with better-sqlite3
- **WhatsApp Library**: @whiskeysockets/baileys
- **API Framework**: Express.js with JWT authentication
- **Process Manager**: PM2
- **Backup**: S3-compatible (Garage S3 or Backblaze B2)

**Architecture Shift**:
- **Old**: Polling S3 every 60 seconds → High transaction costs
- **New**: SQLite hot storage + event-driven API → Efficient and fast

**Key Design Decisions**:
- SQLite for local storage (fast, no network overhead)
- S3 only for backups (reduced costs)
- REST API for Web UI and future iPhone app
- JWT authentication for security
- PM2 for process management and auto-restart
