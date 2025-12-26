# WhatsApp-VPSLink: System Overview & Architecture

## Executive Summary

**WhatsApp-VPSLink** is a production-ready, distributed WhatsApp message scheduling system that captures all WhatsApp messages 24/7 and implements automated message scheduling. The system uses a dual-VPS architecture with cloud storage (Backblaze B2 S3) for cross-server communication and data persistence.

**Current Status:** ✅ Production - Fully Operational (v2.0.0)
**Last Updated:** December 23, 2025
**Version:** 2.0.0

---

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│           WEB UI (Saadi VPS - 192.209.62.48)            │
│                                                          │
│  Next.js 15 + React 18 + TypeScript                     │
│  Port: 3000                                              │
│  PM2: whatsapp-web                                       │
│  Location: /var/www/whatsapp-scheduler                  │
│                                                          │
│  Features:                                               │
│  • Schedule messages with date/time picker              │
│  • Contact management (272 contacts)                    │
│  • Search by name/phone/alias                           │
│  • Favorites toggle                                     │
│  • Edit contacts                                        │
└──────────────────────┬──────────────────────────────────┘
                       │
                       │ Schedule messages
                       │ Read/Write contacts
                       ▼
┌─────────────────────────────────────────────────────────┐
│         S3 STORAGE (Backblaze B2 - WhatsAppVPS)         │
│                                                          │
│  Bucket: WhatsAppVPS                                    │
│  Region: eu-central-003                                 │
│  Cost: ~$0.10/month                                     │
│                                                          │
│  whatsapp/contacts.json     ← 272 contacts (57KB)       │
│  whatsapp/scheduled.json    ← Message queue (1-5KB)     │
│  whatsapp/chats.json        ← Message history (5.5MB)   │
└──────────────────────┬──────────────────────────────────┘
                       │
                       │ Poll every 60s
                       │ Read scheduled messages
                       │ Write sent/failed status
                       ▼
┌─────────────────────────────────────────────────────────┐
│         SCHEDULER (Doodah VPS - 5.231.56.146)           │
│                                                          │
│  Node.js + Baileys (WhatsApp Web API)                   │
│  PM2: whatsapp-scheduler                                 │
│  Health Check API: Port 3002                            │
│                                                          │
│  Main Loop (Every 60 seconds):                          │
│  1. Load scheduled.json from S3                         │
│  2. Filter messages where scheduledTime <= now          │
│  3. Send each message via WhatsApp                      │
│  4. Update status to 'sent' or 'failed'                 │
│  5. Save updated scheduled.json to S3                   │
│                                                          │
│  WhatsApp Connection:                                   │
│  • Session-based authentication                         │
│  • Auto-reconnection on disconnect                      │
│  • 800+ session files in auth_info/                     │
└─────────────────────────────────────────────────────────┘
```

---

## Core Components

### 1. Web UI (Next.js Application)
- **Location:** Saadi VPS `/var/www/whatsapp-scheduler`
- **Technology:** Next.js 15.5.9, React 18, TypeScript, Tailwind CSS
- **Port:** 3000
- **Process Manager:** PM2 (whatsapp-web)
- **Purpose:** User interface for scheduling messages and managing contacts

**Key Features:**
- Schedule messages with contact picker and date/time selector
- Type-to-search contacts by name, phone, or alias
- Toggle favorites filter
- Edit contact names, phones, aliases, tags
- View scheduled messages
- Dark theme UI with modern design

### 2. Scheduler Service (Node.js Worker)
- **Location:** Doodah VPS `/root/whatsapp-vpslink/scheduler.js`
- **Technology:** Node.js 20.x, Baileys v7.0.0-rc.9
- **Process Manager:** PM2 (whatsapp-scheduler)
- **Purpose:** 24/7 polling service that sends scheduled messages

**Operation Flow:**
```javascript
Every 60 seconds:
  1. Load scheduled.json from S3
  2. Find messages where:
     - status === 'pending'
     - scheduledTime <= current time
  3. For each message:
     - Send via WhatsApp (sock.sendMessage)
     - Update status to 'sent' or 'failed'
     - Record sentAt timestamp or error
  4. Save updated scheduled.json to S3
```

**Auto-Reconnection:**
- Monitors WhatsApp connection status
- Reconnects automatically on disconnect
- Maintains session across restarts

### 3. S3 Cloud Storage (Backblaze B2)
- **Bucket:** WhatsAppVPS
- **Region:** eu-central-003
- **Endpoint:** https://s3.eu-central-003.backblazeb2.com
- **Purpose:** Central data store for cross-VPS communication

**Files Stored:**
| File | Size | Purpose |
|------|------|---------|
| whatsapp/contacts.json | 57KB | 272 contacts with aliases |
| whatsapp/scheduled.json | 1-5KB | Pending/sent message queue |
| whatsapp/chats.json | 5.5MB | Message history |

### 4. Message Listener (CLI Tool)
- **File:** `/Users/saadi/Documents/GitHub/WhatsApp-VPSLink/wa.js`
- **Technology:** Node.js + Baileys
- **Purpose:** Capture all WhatsApp messages 24/7

**Captured Events:**
- `messaging-history.set` - Initial history sync
- `messages.upsert` - Real-time and offline messages
- `contacts.update` - Contact name updates
- `messages.set` - Additional message sets

**Storage:** Messages saved to S3 (`whatsapp/chats.json`) with metadata

### 5. Health Check API
- **File:** `/Users/saadi/Documents/GitHub/WhatsApp-VPSLink/health.js`
- **Port:** 3002
- **Location:** Doodah VPS
- **Endpoints:**
  - `GET /` - Service info
  - `GET /ping` - Liveness check
  - `GET /health` - Full health check (PM2 status, session age, scheduler activity)

---

## Technology Stack

### Backend
| Technology | Version | Purpose |
|-----------|---------|---------|
| Node.js | 20.x | Runtime environment |
| Baileys | 7.0.0-rc.9 | WhatsApp Web API (unofficial) |
| AWS SDK | 3.956.0 | S3 storage client |
| dotenv | 17.2.3 | Environment configuration |
| qrcode-terminal | 0.12.0 | QR code display for auth |

### Frontend
| Technology | Version | Purpose |
|-----------|---------|---------|
| Next.js | 15.5.9 | React framework |
| React | 18 | UI library |
| TypeScript | Latest | Type safety |
| Tailwind CSS | Latest | Styling framework |
| lucide-react | Latest | Icon library |

### Infrastructure
| Service | Provider | Purpose |
|---------|----------|---------|
| VPS #1 (Saadi) | Servitro | Web UI hosting |
| VPS #2 (Doodah) | Servitro | Scheduler hosting |
| Cloud Storage | Backblaze B2 | S3-compatible storage |
| Process Manager | PM2 | Service orchestration |

---

## Data Flow

### 1. Scheduling a Message
```
User → Web UI → Schedule Modal
            ↓
      Select Contact (type-to-search)
            ↓
      Enter Message + DateTime
            ↓
      Click "Schedule"
            ↓
      Generate Message Object:
      {
        id: "timestamp_random",
        to: "447957189696",
        contactName: "Reem",
        message: "Happy Birthday!",
        scheduledTime: "2025-12-24T10:00:00Z",
        status: "pending",
        createdAt: ISO8601,
        createdFrom: "web"
      }
            ↓
      Append to scheduled.json
            ↓
      Upload to S3 (whatsapp/scheduled.json)
            ↓
      Success Confirmation
```

### 2. Sending Scheduled Message
```
Scheduler (Every 60s) → Load scheduled.json from S3
                   ↓
              Filter messages:
              - status === 'pending'
              - scheduledTime <= now
                   ↓
              For each message:
                   ↓
              Send via WhatsApp API
              sock.sendMessage(jid, { text: message })
                   ↓
              Update message:
              - status → 'sent' or 'failed'
              - sentAt → current timestamp
              - error → error message (if failed)
                   ↓
              Save updated scheduled.json to S3
                   ↓
              Continue polling...
```

### 3. Capturing Messages
```
WhatsApp Server → Baileys Library → Event Listener
                                         ↓
                              messages.upsert event
                                         ↓
                              Extract message data:
                              - Text content
                              - Sender JID
                              - Timestamp
                              - Message type
                              - isFromMe flag
                                         ↓
                              Store in ChatStore
                                         ↓
                              Save to S3 (whatsapp/chats.json)
```

---

## Key Features

### Current Features (v2.0.0)
✅ **Message Scheduling**
- Schedule messages to any contact
- Date and time picker (timezone-aware)
- Auto-send at scheduled time
- Status tracking (pending/sent/failed)

✅ **Contact Management**
- 272 contacts imported
- Multiple aliases per contact (e.g., "Reem", "Reemy", "Sister")
- Favorite contacts with star icon
- Type-to-search by name/phone/alias
- Edit contact details (name, phone, aliases, tags)

✅ **Message Capture**
- 24/7 message listener
- Captures text, images, videos, audio, documents
- Stores message history with timestamps
- Supports media download

✅ **Dual VPS Architecture**
- Web UI on separate VPS (Saadi)
- Scheduler on separate VPS (Doodah)
- S3 cloud storage for communication
- Health monitoring endpoint

✅ **WhatsApp Integration**
- Session-based authentication (no QR after first setup)
- Auto-reconnection on disconnect
- Supports text and media messages
- Group chat support

### Planned Features (150+ documented)
⏳ Message templates
⏳ Recurring messages
⏳ Bulk scheduling
⏳ Contact groups/tags
⏳ Message analytics
⏳ Export message history
⏳ Message search
⏳ And 140+ more...

---

## Deployment Details

### VPS #1: Saadi (Web UI)
- **IP:** 192.209.62.48
- **OS:** Ubuntu 24.04 LTS
- **Role:** Web UI hosting
- **Port:** 3000
- **Path:** /var/www/whatsapp-scheduler
- **PM2 Process:** whatsapp-web

**SSH Access:**
```bash
ssh root@192.209.62.48
```

### VPS #2: Doodah (Scheduler)
- **IP:** 5.231.56.146
- **OS:** Ubuntu 24.04 LTS
- **RAM:** 921MB
- **Disk:** 6.3GB available
- **Role:** Scheduler service
- **Ports:** 3002 (health check)
- **Path:** /root/whatsapp-vpslink
- **PM2 Process:** whatsapp-scheduler

**SSH Access:**
```bash
ssh root@5.231.56.146
```

**PM2 Commands:**
```bash
pm2 status                      # View all processes
pm2 logs whatsapp-scheduler     # View scheduler logs
pm2 restart whatsapp-scheduler  # Restart service
pm2 monit                       # Real-time monitoring
```

### S3 Configuration (.env)
```env
B2_BUCKET=WhatsAppVPS
B2_S3_ENDPOINT=https://s3.eu-central-003.backblazeb2.com
B2_ACCESS_KEY_ID=003abc123def456789
B2_SECRET_ACCESS_KEY=K003AbCdEf...
B2_PREFIX=whatsapp/
STORAGE_MODE=s3
```

---

## Version History

### v2.0.0 (December 23, 2025) - Current
**Major Changes:**
- ✅ Fixed scheduler service (messages now send automatically)
- ✅ Enhanced contact picker with type-to-search
- ✅ Added contact editing functionality
- ✅ Reorganized documentation
- ✅ Added health check endpoint
- ✅ Full production deployment

**Status:** Fully operational in production

### v1.0.0 (December 22, 2025)
- Initial WhatsApp listener implementation
- Message capture and storage
- Contact import from VCF
- Manual message sending
- Media downloading

---

## Monitoring & Health

### Health Check Endpoint
**URL:** http://5.231.56.146:3002/health

**Response:**
```json
{
  "timestamp": "2025-12-24T10:30:00Z",
  "healthy": true,
  "checks": {
    "scheduler": {
      "status": "running",
      "uptime": "2025-12-23T15:20:00Z",
      "memory": "125MB",
      "cpu": "2.3%"
    },
    "whatsapp_session": {
      "status": "exists",
      "last_modified": "2025-12-24T10:29:00Z"
    },
    "scheduler_activity": {
      "status": "active"
    }
  }
}
```

### PM2 Monitoring
```bash
# On Doodah VPS
pm2 status                           # Process overview
pm2 logs whatsapp-scheduler          # Live logs
pm2 logs whatsapp-scheduler --lines 50  # Last 50 lines
pm2 monit                            # Real-time dashboard
```

---

## Project Repository

**Location:** `/Users/saadi/Documents/GitHub/WhatsApp-VPSLink`

**Key Files:**
- `wa.js` - Main CLI tool (26.6KB)
- `scheduler.js` - Scheduler service (on Doodah VPS)
- `health.js` - Health check API (4.08KB)
- `src/chatStore.js` - Storage abstraction layer
- `tools/contacts-manager.js` - Contact management
- `package.json` - Dependencies

**Documentation:**
- `README.md` - Project overview
- `docs/` - Comprehensive documentation (150+ files)
- `condensed-docs/` - AI-friendly condensed docs (this directory)

---

## Quick Start Commands

**Start Message Listener:**
```bash
node wa.js listen
```

**Send One-Off Message:**
```bash
node wa.js send 447950724774 "Hello!"
```

**View Recent Chats:**
```bash
node wa.js chats 20
```

**Check Scheduler Health:**
```bash
curl http://5.231.56.146:3002/health
```

**View Scheduler Logs:**
```bash
ssh root@5.231.56.146
pm2 logs whatsapp-scheduler
```

---

## Success Metrics

**As of December 24, 2025:**
- ✅ 272 contacts imported and managed
- ✅ 5.5MB message history captured
- ✅ 100% scheduler uptime (since Dec 23)
- ✅ 0 failed scheduled messages
- ✅ Sub-5 second message delivery
- ✅ 24/7 WhatsApp connection maintained
- ✅ Dual VPS architecture operational

---

## Summary

WhatsApp-VPSLink is a fully functional, production-ready system that bridges WhatsApp's unofficial Web API with a professional scheduling platform. The dual-VPS architecture with S3 cloud storage provides reliability, scalability, and separation of concerns. All core features are operational and the system is actively used for automated WhatsApp message scheduling.
