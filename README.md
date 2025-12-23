# WhatsApp VPSLink - Scheduled Message System

**Version:** 2.0  
**Last Updated:** December 23, 2025  
**Status:** ✅ Production Ready

---

## Overview

A complete WhatsApp message scheduling system with:
- **Web UI** for scheduling messages and managing contacts
- **Automated scheduler** that sends messages at specified times
- **272 contacts** stored in S3
- **Professional dark theme** UI
- **Searchable contact picker** with favorites
- **Full contact management** (edit, add aliases/tags, toggle favorites)

---

## Quick Start

### Access the System

**Web UI:**  
🌐 http://192.209.62.48:3000  
🔑 Password: `admin123`

**Features:**
- Schedule messages to any contact
- Manage 272 contacts
- View scheduled/sent/failed messages
- Edit contacts (names, phones, aliases, tags)
- Search and filter contacts

### Schedule a Message

1. Go to http://192.209.62.48:3000
2. Click the blue **+** button (top-right)
3. Search for a contact by typing name/phone/alias
4. Toggle **"Favs"** to filter favorites
5. Select contact, enter message, date, and time
6. Click **"Schedule Message"**
7. Message will send automatically at scheduled time

---

## Documentation Index

### 🚀 Getting Started
- **[README.md](README.md)** - This file (start here)
- **[docs/guides/QUICKSTART.md](docs/guides/QUICKSTART.md)** - Quick start guide
- **[docs/guides/TODAYS_CHANGES_SUMMARY.md](docs/guides/TODAYS_CHANGES_SUMMARY.md)** - Latest updates (Dec 23, 2025)

### 🏗️ Architecture
- **[docs/architecture/SCHEDULER.md](docs/architecture/SCHEDULER.md)** - How the scheduler works
- **[docs/architecture/DATA-STRUCTURES.md](docs/architecture/DATA-STRUCTURES.md)** - JSON data formats

### 🚢 Deployment
- **[docs/deployment/DEPLOYMENT.md](docs/deployment/DEPLOYMENT.md)** - Full deployment guide
- **[docs/deployment/VPS-DETAILS.md](docs/deployment/VPS-DETAILS.md)** - Server credentials & setup
- **[docs/deployment/S3-SETUP.md](docs/deployment/S3-SETUP.md)** - Backblaze B2 configuration

### ✨ Features
- **[docs/features/UI-DESIGN.md](docs/features/UI-DESIGN.md)** - Complete UI/UX specification
- **[docs/features/SCHEDULE_MODAL_IMPROVEMENTS.md](docs/features/SCHEDULE_MODAL_IMPROVEMENTS.md)** - Enhanced contact picker
- **[docs/features/MISSING_FEATURES_SUMMARY.md](docs/features/MISSING_FEATURES_SUMMARY.md)** - Future enhancements (150+ features)

### 📚 Guides
- **[docs/guides/CONTACTS.md](docs/guides/CONTACTS.md)** - Contact management guide
- **[docs/guides/UI-IMPROVEMENTS.md](docs/guides/UI-IMPROVEMENTS.md)** - UI improvement guide

### 🔧 Troubleshooting
- **[docs/troubleshooting/WHY_CHRIS_MESSAGE_DIDNT_SEND.md](docs/troubleshooting/WHY_CHRIS_MESSAGE_DIDNT_SEND.md)** - Scheduler issue explanation & fix

### 🎨 UI Components
- **[docs/ui-components/README.md](docs/ui-components/README.md)** - Component documentation

---

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│           WEB UI (Saadi VPS - 192.209.62.48)            │
│                                                          │
│  Next.js 15 + React 18 + TypeScript                     │
│  Port: 3000                                              │
│  PM2: whatsapp-web                                       │
│                                                          │
│  Pages: /dashboard, /contacts, /scheduled, /login       │
└──────────────────────┬──────────────────────────────────┘
                       │
                       │ HTTP API
                       ▼
┌─────────────────────────────────────────────────────────┐
│         S3 STORAGE (Backblaze B2 - WhatsAppVPS)         │
│                                                          │
│  whatsapp/contacts.json     ← 272 contacts              │
│  whatsapp/scheduled.json    ← Scheduled messages        │
│  whatsapp/chats.json        ← Message history           │
└──────────────────────┬──────────────────────────────────┘
                       │
                       │ Check every 60s
                       ▼
┌─────────────────────────────────────────────────────────┐
│         SCHEDULER (Doodah VPS - 5.231.56.146)           │
│                                                          │
│  Node.js + Baileys (WhatsApp Web)                       │
│  PM2: whatsapp-scheduler                                 │
│                                                          │
│  • Checks S3 every 60 seconds                           │
│  • Sends messages at scheduled time                     │
│  • Updates status to sent/failed                        │
│  • Auto-reconnects to WhatsApp                          │
└─────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
WhatsApp-VPSLink/
├── README.md                    # Main entry point (this file)
├── docs/                        # All documentation
│   ├── architecture/            # System architecture
│   ├── deployment/              # Deployment & infrastructure
│   ├── features/                # Feature documentation
│   ├── guides/                  # User guides
│   ├── troubleshooting/         # Troubleshooting docs
│   ├── ui-components/           # React component examples
│   └── archive/                 # Old documentation
├── src/                         # Source code
├── scripts/                     # Utility scripts
├── tools/                       # CLI tools
├── wa.js                        # WhatsApp CLI
└── package.json                 # Dependencies
```

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

### Web UI (Saadi VPS)
- Next.js 15.5.9
- TypeScript + React 18
- Tailwind CSS (dark theme)
- lucide-react icons
- AWS SDK for S3
- PM2

### Scheduler (Doodah VPS)
- Node.js 20.x
- @whiskeysockets/baileys
- AWS SDK for S3
- PM2

### Storage
- Backblaze B2 (S3-compatible)
- Bucket: WhatsAppVPS
- Region: eu-central-003

---

## Server Details

### Saadi VPS (192.209.62.48)
- **Purpose:** Web UI hosting
- **PM2 Process:** whatsapp-web
- **Location:** `/var/www/whatsapp-scheduler`

### Doodah VPS (5.231.56.146)
- **Purpose:** WhatsApp scheduler
- **PM2 Process:** whatsapp-scheduler
- **Location:** `/root/whatsapp-vpslink`

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

## Recent Changes (December 23, 2025)

### 🐛 Fixed: Scheduler Not Running
- **Issue:** Messages stuck as "pending", never sent
- **Fix:** Created scheduler service on Doodah VPS
- **Result:** Scheduler now runs 24/7
- **Details:** [WHY_CHRIS_MESSAGE_DIDNT_SEND.md](docs/troubleshooting/WHY_CHRIS_MESSAGE_DIDNT_SEND.md)

### ✨ Enhanced: Schedule Modal Contact Picker
- Type to search (name/phone/alias)
- Favorites toggle button
- Live filtering dropdown
- Visual selection confirmation
- **Details:** [SCHEDULE_MODAL_IMPROVEMENTS.md](docs/features/SCHEDULE_MODAL_IMPROVEMENTS.md)

### ✨ Added: Contact Editing
- Edit contact modal
- Edit name, phones, aliases, tags
- Toggle favorites
- All changes persist to S3

### 📚 Documentation Organized
- Proper directory structure
- Comprehensive guides
- Architecture docs
- Troubleshooting guides

---

## Future Enhancements

See [docs/features/MISSING_FEATURES_SUMMARY.md](docs/features/MISSING_FEATURES_SUMMARY.md) for complete list.

**Top Priority:**
- Recurring message scheduler
- Message templates
- Bulk operations
- VCF file import UI
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

**v2.0** (December 23, 2025)
- Fixed scheduler service
- Enhanced contact picker
- Added contact editing
- Organized documentation
- Professional dark theme

**v1.0** (December 22, 2025)
- Initial implementation

---

**Last Updated:** December 23, 2025  
**Status:** ✅ Production - Fully Operational
