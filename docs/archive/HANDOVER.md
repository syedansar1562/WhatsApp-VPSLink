# 🚀 COMPLETE PROJECT HANDOVER - WhatsApp Scheduler System

## 📋 OVERALL PROJECT SCOPE

### What We're Building

A **complete WhatsApp message scheduling system** that allows the user (Saadi) to:
1. Schedule WhatsApp messages for future delivery
2. Manage contacts with aliases and favorites
3. View/edit/delete scheduled messages
4. Access from both web browser and (future) iPhone app

### The Complete Picture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER (SAADI)                                │
│                                                                     │
│  1. Opens web browser → http://192.209.62.48                       │
│  2. Logs in with password                                          │
│  3. Browses contact list (272 contacts)                            │
│  4. Schedules message: "Happy Birthday!" to Nick at Dec 24, 10am   │
│  5. Message saved to S3                                            │
│  6. Closes browser                                                 │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Web UI writes to S3
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     BACKBLAZE B2 S3 BUCKET                          │
│                     (WhatsAppVPS bucket)                            │
│                                                                     │
│  whatsapp/contacts.json       ← 272 contacts with names/aliases    │
│  whatsapp/scheduled.json      ← Queue of scheduled messages        │
│  whatsapp/chats.json          ← Existing message history           │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Worker polls every 60 seconds
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  DOODAH VPS (5.231.56.146)                          │
│                  Running 24/7 Background Workers                    │
│                                                                     │
│  PM2 Process 1: whatsapp-listener                                  │
│  - Captures incoming WhatsApp messages                             │
│  - Saves to S3 chats.json                                          │
│  - Already running ✅                                               │
│                                                                     │
│  PM2 Process 2: whatsapp-scheduler (TO BE BUILT)                   │
│  - Every 60 seconds:                                               │
│    1. Downloads scheduled.json from S3                             │
│    2. Checks if any message.scheduledTime <= now                   │
│    3. Sends message via WhatsApp                                   │
│    4. Updates message.status = "sent"                              │
│    5. Uploads updated scheduled.json to S3                         │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Sends WhatsApp message at scheduled time
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         WHATSAPP                                    │
│                                                                     │
│  Dec 24, 10:00:03 AM - Message delivered to Nick                   │
│  "Happy Birthday!"                                                 │
└─────────────────────────────────────────────────────────────────────┘
```

### End Goal

User can **schedule WhatsApp messages days/weeks in advance**, close their computer, and messages will **automatically send at the scheduled time** via the VPS worker.

---

## 🎯 WHAT'S DONE VS WHAT'S NEEDED

### ✅ COMPLETED (100%)

1. **WhatsApp VPSLink Base System**
   - Location: `/Users/saadi/Documents/GitHub/WhatsApp-VPSLink/`
   - VPS deployed: Doodah (5.231.56.146)
   - Features working:
     - 24/7 WhatsApp listener
     - Message capture to S3
     - Read/send messages via CLI
     - Download media on-demand
     - Contact management
   - PM2 process running: `whatsapp-listener`
   - Documentation: README.md, QUICKSTART.md, docs/

2. **Contacts Migration**
   - Parsed 272 contacts from `/Users/saadi/Desktop/addy.vcf`
   - Created enhanced format with aliases, phones, favorites
   - Generated `contacts.json` (ready to upload)
   - Script: `scripts/migrate-contacts.js` ✅

3. **S3 Infrastructure**
   - Bucket: WhatsAppVPS
   - Endpoint: https://s3.eu-central-003.backblazeb2.com
   - Existing file: `whatsapp/chats.json` (5.5MB message history)
   - Credentials configured in `.env`

### 🔨 TO BE BUILT (0%)

#### Phase 1: S3 Data Upload (15 minutes)
- Upload `contacts.json` to S3
- Create empty `scheduled.json` in S3
- Script ready: `scripts/upload-contacts-to-s3.js`

#### Phase 2: Scheduler Worker (2-3 hours)
- File: `/root/whatsapp-vpslink/scheduler.js` on Doodah VPS
- PM2 process: `whatsapp-scheduler`
- Functionality: Poll S3 every 60s, send pending messages

#### Phase 3: Web UI (4-5 hours)
- Location: `/var/www/whatsapp-scheduler/` on Saadi VPS (192.209.62.48)
- Tech: Next.js 14 + Tailwind + shadcn/ui
- Pages: Login, Dashboard, Contacts, Schedule, Scheduled
- Direct S3 access (no API server)

#### Phase 4: Testing & Deployment (1 hour)
- End-to-end test: Schedule → Wait → Send → Verify
- PM2 auto-start configuration
- Final documentation update

---

## 🏗️ DETAILED ARCHITECTURE

### Architecture Decision: DIRECT S3 ACCESS (No API Server)

**Why this approach:**
- User confirmed: "This is just for me"
- Simpler: No Express/API server needed
- Faster: Direct S3 reads/writes
- Future iPhone app uses same pattern
- S3 keys in app acceptable for personal use

**NOT building:**
- ❌ REST API server
- ❌ JWT authentication
- ❌ Express routes
- ❌ Database

**All three clients talk to S3 directly:**
```
Web UI (Next.js) ──────┐
                       ├──> S3 Bucket
iPhone App (future) ───┤
                       │
Worker (scheduler.js) ─┘
```

---

## 📊 COMPLETE DATA STRUCTURES

### 1. contacts.json (READY - LOCAL, NEEDS S3 UPLOAD)

**Current location:** `/Users/saadi/Documents/GitHub/WhatsApp-VPSLink/contacts.json`

**Contents:** 272 contacts

**Format:**
```json
{
  "447950724774": {
    "name": "Nick Smith",
    "aliases": ["Nick", "Nicky"],
    "phones": {
      "primary": "447950724774",
      "secondary": "447123456789"
    },
    "favorite": false,
    "tags": ["work", "friend"]
  },
  "447779299086": {
    "name": "Syed Ansar",
    "aliases": ["Ansar", "Saadi"],
    "phones": {
      "primary": "447779299086",
      "secondary": null
    },
    "favorite": true,
    "tags": ["family"]
  }
}
```

**Field definitions:**
- **Key:** WhatsApp JID (phone@s.whatsapp.net → just phone number)
- **name:** Full contact name (from VCF)
- **aliases:** Array of nicknames (used in UI searches)
- **phones.primary:** Main WhatsApp number
- **phones.secondary:** Alternative number (null if none)
- **favorite:** Boolean - show at top of contact list
- **tags:** Array of categories (future use)

**S3 destination:** `whatsapp/contacts.json`

---

### 2. scheduled.json (NEEDS CREATION + S3 UPLOAD)

**Will be created by:** `scripts/upload-contacts-to-s3.js`

**Initial format:**
```json
{
  "messages": []
}
```

**After scheduling messages:**
```json
{
  "messages": [
    {
      "id": "1734890000123_a1b2c3",
      "to": "447950724774",
      "contactName": "Nick Smith",
      "message": "Happy Birthday Nick! Hope you have a great day 🎂",
      "scheduledTime": "2025-12-24T10:00:00.000Z",
      "status": "pending",
      "createdAt": "2025-12-22T18:30:00.000Z",
      "createdFrom": "web",
      "sentAt": null
    },
    {
      "id": "1734890000456_d4e5f6",
      "to": "447779299086",
      "contactName": "Syed Ansar",
      "message": "Don't forget the meeting at 3pm",
      "scheduledTime": "2025-12-23T14:00:00.000Z",
      "status": "sent",
      "createdAt": "2025-12-22T16:00:00.000Z",
      "createdFrom": "web",
      "sentAt": "2025-12-23T14:00:03.421Z"
    },
    {
      "id": "1734890000789_g7h8i9",
      "to": "447123456789",
      "contactName": "John Doe",
      "message": "Reminder: Appointment tomorrow",
      "scheduledTime": "2025-12-20T09:00:00.000Z",
      "status": "failed",
      "createdAt": "2025-12-19T20:00:00.000Z",
      "createdFrom": "web",
      "sentAt": null,
      "error": "Contact not on WhatsApp"
    }
  ]
}
```

**Field definitions:**
- **id:** Unique identifier (`timestamp_randomString`)
- **to:** WhatsApp phone number (without @s.whatsapp.net)
- **contactName:** Display name (copied from contacts.json at schedule time)
- **message:** The actual message text to send
- **scheduledTime:** ISO 8601 UTC timestamp when to send
- **status:** One of: `"pending"`, `"sent"`, `"failed"`
- **createdAt:** ISO 8601 UTC timestamp when scheduled
- **createdFrom:** Source: `"web"` or `"iphone"` (future)
- **sentAt:** ISO 8601 UTC timestamp when actually sent (null if not sent)
- **error:** Error message if status is "failed" (optional)

**S3 destination:** `whatsapp/scheduled.json`

---

### 3. chats.json (EXISTING - NO CHANGES)

**Current location:** S3 `whatsapp/chats.json` (5.5MB)

**Already working** - captures all incoming WhatsApp messages

**No modifications needed** - scheduler is read-only on this file

---

## 🖥️ SERVER DETAILS

### Server 1: Doodah VPS (WhatsApp Worker)

**IP:** 5.231.56.146
**OS:** Ubuntu 24.04 LTS
**RAM:** 921MB
**Disk:** 9.6GB total, ~6.3GB available
**SSH:** `ssh root@5.231.56.146`

**Current setup:**
```
/root/whatsapp-vpslink/
├── wa.js                    # Main WhatsApp CLI
├── src/chatStore.js         # S3 storage handler
├── auth_info/               # WhatsApp session (886 files, ~100MB)
├── node_modules/            # Dependencies (~50MB)
├── .env                     # S3 credentials
├── package.json
└── (other existing files)
```

**PM2 processes currently running:**
```
┌────┬────────────────────┬─────────┬─────────┬──────────┐
│ id │ name               │ status  │ restart │ uptime   │
├────┼────────────────────┼─────────┼─────────┼──────────┤
│ 0  │ whatsapp-listener  │ online  │ 0       │ 3d 2h    │
└────┴────────────────────┴─────────┴─────────┴──────────┘
```

**Needs:**
1. Create `scheduler.js` file
2. Create `src/scheduledStore.js` helper
3. Add PM2 process: `whatsapp-scheduler`

**Node.js version:** v20.x (already installed)

**Dependencies already installed:**
- `@whiskeysockets/baileys` (WhatsApp library)
- `@aws-sdk/client-s3` (S3 access)
- `dotenv` (env vars)
- `qrcode-terminal` (QR codes)

---

### Server 2: Saadi VPS (Web UI)

**IP:** 192.209.62.48
**OS:** (Assume Ubuntu/similar)
**SSH:** `ssh root@192.209.62.48`
**Ports:** 80 (HTTP), 443 (HTTPS) already open
**Web server:** Already configured (user mentioned)

**Current setup:** Unknown - need to check

**Needs:**
1. Create `/var/www/whatsapp-scheduler/` directory
2. Install Node.js 20 (if not present)
3. Install Next.js 14 project
4. Install dependencies
5. Configure as PM2 process or systemd service
6. Setup Nginx proxy (if needed)

**To be installed:**
- Next.js 14
- Tailwind CSS
- shadcn/ui components
- `@aws-sdk/client-s3`
- `bcrypt` (password hashing)

---

## 🔐 CREDENTIALS & ENVIRONMENT VARIABLES

### S3 Credentials (Same for all servers)

**Backblaze B2 Account:**
- Bucket: `WhatsAppVPS`
- Region: `eu-central-003`
- Endpoint: `https://s3.eu-central-003.backblazeb2.com`

**Access Keys:**
```env
B2_BUCKET=WhatsAppVPS
B2_S3_ENDPOINT=https://s3.eu-central-003.backblazeb2.com
B2_ACCESS_KEY_ID=00330bc627754a00000000001
B2_SECRET_ACCESS_KEY=K003QhZCxsajKLOnbCKjFpep27+KfBQ
B2_PREFIX=whatsapp/
```

**Files in bucket:**
- `whatsapp/chats.json` (existing, 5.5MB)
- `whatsapp/contacts.json` (to be uploaded)
- `whatsapp/scheduled.json` (to be created)

### Web UI Password

**Requirement:** Single user (Saadi), simple password auth

**Implementation:** Store bcrypt hash in `.env`

**User needs to choose password** - ask during setup:
```env
WEB_PASSWORD_HASH=$2b$10$abcdefghijklmnopqrstuvwxyz123456789
```

---

## 📝 STEP-BY-STEP IMPLEMENTATION GUIDE

### PHASE 1: Upload Data to S3 (15 minutes)

**Goal:** Get contacts.json and scheduled.json into S3

#### Step 1.1: Review upload script

File already created: `/Users/saadi/Documents/GitHub/WhatsApp-VPSLink/scripts/upload-contacts-to-s3.js`

**What it does:**
1. Reads `contacts.json` (272 contacts)
2. Uploads to S3 `whatsapp/contacts.json`
3. Creates empty `scheduled.json` structure
4. Uploads to S3 `whatsapp/scheduled.json`

#### Step 1.2: Run upload

```bash
cd /Users/saadi/Documents/GitHub/WhatsApp-VPSLink
node scripts/upload-contacts-to-s3.js
```

**Expected output:**
```
📤 Uploading contacts.json...
✅ Uploaded contacts.json to S3
   272 contacts uploaded

📤 Creating scheduled.json...
✅ Uploaded scheduled.json to S3
   Empty scheduled messages queue created

✨ All done! S3 bucket ready for WhatsApp Scheduler

📋 S3 Structure:
   WhatsAppVPS/whatsapp/
   ├── chats.json (existing)
   ├── contacts.json (272 contacts)
   └── scheduled.json (empty queue)
```

#### Step 1.3: Verify in Backblaze

1. Go to https://secure.backblaze.com/
2. Login to account
3. Navigate to Buckets → WhatsAppVPS
4. Browse Files → whatsapp/ folder
5. Confirm files exist:
   - `contacts.json` (~50KB)
   - `scheduled.json` (~20 bytes)

**✅ Phase 1 Complete when:** Both files visible in S3 bucket

---

### PHASE 2: Build Scheduler Worker (2-3 hours)

**Goal:** Doodah VPS automatically sends scheduled messages

#### Step 2.1: Create scheduledStore.js helper

**SSH to Doodah:**
```bash
ssh root@5.231.56.146
cd /root/whatsapp-vpslink
```

**Create file:** `src/scheduledStore.js`

```javascript
/**
 * Scheduled Messages Store - S3 Backend
 * Handles reading/writing scheduled.json from/to S3
 */

require('dotenv').config();
const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');

class ScheduledStore {
    constructor() {
        this.s3Client = new S3Client({
            endpoint: process.env.B2_S3_ENDPOINT,
            region: 'eu-central-003',
            credentials: {
                accessKeyId: process.env.B2_ACCESS_KEY_ID,
                secretAccessKey: process.env.B2_SECRET_ACCESS_KEY
            }
        });
        this.bucket = process.env.B2_BUCKET;
        this.s3Key = `${process.env.B2_PREFIX}scheduled.json`;
    }

    /**
     * Download scheduled.json from S3
     * @returns {Promise<Object>} { messages: [...] }
     */
    async load() {
        try {
            const command = new GetObjectCommand({
                Bucket: this.bucket,
                Key: this.s3Key
            });

            const response = await this.s3Client.send(command);
            const bodyString = await response.Body.transformToString();
            const data = JSON.parse(bodyString);

            console.log(`✓ Loaded ${data.messages.length} scheduled messages from S3`);
            return data;
        } catch (error) {
            if (error.name === 'NoSuchKey') {
                console.log('! No scheduled.json found, creating empty queue');
                return { messages: [] };
            }
            throw error;
        }
    }

    /**
     * Upload scheduled.json to S3
     * @param {Object} data - { messages: [...] }
     */
    async save(data) {
        const command = new PutObjectCommand({
            Bucket: this.bucket,
            Key: this.s3Key,
            Body: JSON.stringify(data, null, 2),
            ContentType: 'application/json'
        });

        await this.s3Client.send(command);
        console.log(`✓ Saved ${data.messages.length} scheduled messages to S3`);
    }

    /**
     * Get messages that are ready to send
     * @param {Object} data - { messages: [...] }
     * @returns {Array} Messages where scheduledTime <= now and status === 'pending'
     */
    getPendingMessages(data) {
        const now = new Date().toISOString();
        return data.messages.filter(msg =>
            msg.status === 'pending' &&
            msg.scheduledTime <= now
        );
    }

    /**
     * Update message status
     * @param {Object} data - { messages: [...] }
     * @param {string} messageId - Message ID to update
     * @param {string} status - New status ('sent' or 'failed')
     * @param {string} error - Error message if failed (optional)
     */
    updateMessageStatus(data, messageId, status, error = null) {
        const message = data.messages.find(m => m.id === messageId);
        if (message) {
            message.status = status;
            if (status === 'sent') {
                message.sentAt = new Date().toISOString();
            }
            if (error) {
                message.error = error;
            }
        }
    }
}

module.exports = ScheduledStore;
```

**Save and exit.**

#### Step 2.2: Create scheduler.js main worker

**Create file:** `scheduler.js` (in `/root/whatsapp-vpslink/`)

```javascript
/**
 * WhatsApp Message Scheduler Worker
 * Polls S3 every 60 seconds and sends scheduled messages
 */

require('dotenv').config();
const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const ScheduledStore = require('./src/scheduledStore');

let sock = null;
let isConnected = false;

/**
 * Connect to WhatsApp
 */
async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    sock = makeWASocket({
        auth: state,
        printQRInTerminal: false
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Connection closed, reconnecting:', shouldReconnect);

            if (shouldReconnect) {
                setTimeout(connectToWhatsApp, 5000);
            }
            isConnected = false;
        } else if (connection === 'open') {
            console.log('✓ Connected to WhatsApp!');
            isConnected = true;
        }
    });
}

/**
 * Send WhatsApp message
 * @param {string} phoneNumber - Phone number (without @s.whatsapp.net)
 * @param {string} message - Message text
 * @returns {Promise<boolean>} Success status
 */
async function sendMessage(phoneNumber, message) {
    if (!isConnected) {
        throw new Error('WhatsApp not connected');
    }

    const jid = phoneNumber.includes('@') ? phoneNumber : phoneNumber + '@s.whatsapp.net';

    try {
        await sock.sendMessage(jid, { text: message });
        console.log(`✓ Sent message to ${phoneNumber}`);
        return true;
    } catch (error) {
        console.error(`✗ Failed to send to ${phoneNumber}:`, error.message);
        throw error;
    }
}

/**
 * Main scheduler loop - checks and sends pending messages
 */
async function checkAndSendMessages() {
    const store = new ScheduledStore();

    try {
        // 1. Load scheduled messages from S3
        const data = await store.load();

        // 2. Find messages ready to send
        const pendingMessages = store.getPendingMessages(data);

        if (pendingMessages.length === 0) {
            console.log('→ No messages to send');
            return;
        }

        console.log(`→ Found ${pendingMessages.length} message(s) to send`);

        // 3. Send each message
        for (const msg of pendingMessages) {
            try {
                console.log(`→ Sending: "${msg.message}" to ${msg.contactName} (${msg.to})`);

                await sendMessage(msg.to, msg.message);

                // Update status to sent
                store.updateMessageStatus(data, msg.id, 'sent');

            } catch (error) {
                console.error(`✗ Error sending message ${msg.id}:`, error.message);

                // Update status to failed
                store.updateMessageStatus(data, msg.id, 'failed', error.message);
            }
        }

        // 4. Save updated statuses back to S3
        await store.save(data);

    } catch (error) {
        console.error('✗ Scheduler error:', error.message);
    }
}

/**
 * Initialize scheduler
 */
async function init() {
    console.log('🚀 WhatsApp Scheduler Worker starting...');
    console.log('📅 Timezone: Europe/London (UK)');
    console.log('⏰ Check interval: 60 seconds');
    console.log('');

    // Connect to WhatsApp
    await connectToWhatsApp();

    // Wait for connection
    await new Promise(resolve => {
        const interval = setInterval(() => {
            if (isConnected) {
                clearInterval(interval);
                resolve();
            }
        }, 1000);
    });

    console.log('✓ Scheduler ready');
    console.log('');

    // Run immediately on start
    await checkAndSendMessages();

    // Then run every 60 seconds
    setInterval(async () => {
        const now = new Date().toLocaleString('en-GB', {
            timeZone: 'Europe/London',
            dateStyle: 'short',
            timeStyle: 'medium'
        });
        console.log(`⏰ [${now}] Checking for scheduled messages...`);
        await checkAndSendMessages();
    }, 60000); // 60 seconds
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Scheduler shutting down...');
    process.exit(0);
});

// Start
init().catch(console.error);
```

**Save and exit.**

#### Step 2.3: Test scheduler locally

```bash
# Still on Doodah VPS
cd /root/whatsapp-vpslink
node scheduler.js
```

**Expected output:**
```
🚀 WhatsApp Scheduler Worker starting...
📅 Timezone: Europe/London (UK)
⏰ Check interval: 60 seconds

Connecting to WhatsApp...
✓ Connected to WhatsApp!
✓ Scheduler ready

✓ Loaded 0 scheduled messages from S3
→ No messages to send

⏰ [22/12/24, 19:30:00] Checking for scheduled messages...
✓ Loaded 0 scheduled messages from S3
→ No messages to send
```

**Press Ctrl+C to stop.**

#### Step 2.4: Deploy with PM2

```bash
pm2 start scheduler.js --name whatsapp-scheduler
pm2 save
```

**Check status:**
```bash
pm2 status
```

**Expected:**
```
┌────┬────────────────────┬─────────┬─────────┬──────────┐
│ id │ name               │ status  │ restart │ uptime   │
├────┼────────────────────┼─────────┼─────────┼──────────┤
│ 0  │ whatsapp-listener  │ online  │ 0       │ 3d 2h    │
│ 1  │ whatsapp-scheduler │ online  │ 0       │ 5s       │
└────┴────────────────────┴─────────┴─────────┴──────────┘
```

**View logs:**
```bash
pm2 logs whatsapp-scheduler --lines 20
```

**✅ Phase 2 Complete when:**
- Both PM2 processes running
- Logs show "Scheduler ready"
- No errors in logs

---

### PHASE 3: Build Web UI (4-5 hours)

**Goal:** Web interface on Saadi VPS for scheduling messages

#### Step 3.1: Check Saadi server setup

**SSH to Saadi:**
```bash
ssh root@192.209.62.48
```

**Check Node.js:**
```bash
node --version
```

If not installed or version < 20:
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
```

**Check PM2:**
```bash
pm2 --version
```

If not installed:
```bash
npm install -g pm2
```

#### Step 3.2: Create Next.js project

```bash
mkdir -p /var/www/whatsapp-scheduler
cd /var/www/whatsapp-scheduler

# Create Next.js app
npx create-next-app@latest . --app --tailwind --typescript --no-eslint --no-src-dir --import-alias "@/*"
```

**When prompted:**
- Would you like to use App Router? **Yes**
- Would you like to customize the default import alias? **No**

#### Step 3.3: Install dependencies

```bash
npm install @aws-sdk/client-s3 bcrypt
npm install -D @types/bcrypt

# Install shadcn/ui
npx shadcn@latest init
```

**When prompted for shadcn:**
- Which style? **New York**
- Which color? **Slate**
- CSS variables? **Yes**

**Install shadcn components:**
```bash
npx shadcn@latest add button
npx shadcn@latest add card
npx shadcn@latest add input
npx shadcn@latest add label
npx shadcn@latest add table
npx shadcn@latest add select
npx shadcn@latest add textarea
npx shadcn@latest add dialog
npx shadcn@latest add badge
npx shadcn@latest add calendar
```

#### Step 3.4: Create environment file

**Create `.env.local`:**
```bash
nano .env.local
```

**Contents:**
```env
# S3 Configuration
B2_BUCKET=WhatsAppVPS
B2_S3_ENDPOINT=https://s3.eu-central-003.backblazeb2.com
B2_ACCESS_KEY_ID=00330bc627754a00000000001
B2_SECRET_ACCESS_KEY=K003QhZCxsajKLOnbCKjFpep27+KfBQ
B2_PREFIX=whatsapp/

# Password (user will set this)
WEB_PASSWORD=your_password_here
```

**Ask user for password** and update `WEB_PASSWORD` value.

#### Step 3.5: Create S3 utility

**Create `lib/s3.ts`:**
```typescript
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
  endpoint: process.env.B2_S3_ENDPOINT!,
  region: 'eu-central-003',
  credentials: {
    accessKeyId: process.env.B2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.B2_SECRET_ACCESS_KEY!
  }
});

export interface Contact {
  name: string;
  aliases: string[];
  phones: {
    primary: string;
    secondary: string | null;
  };
  favorite: boolean;
  tags: string[];
}

export interface ScheduledMessage {
  id: string;
  to: string;
  contactName: string;
  message: string;
  scheduledTime: string; // ISO 8601
  status: 'pending' | 'sent' | 'failed';
  createdAt: string;
  createdFrom: string;
  sentAt: string | null;
  error?: string;
}

export async function getContacts(): Promise<Record<string, Contact>> {
  const command = new GetObjectCommand({
    Bucket: process.env.B2_BUCKET!,
    Key: `${process.env.B2_PREFIX}contacts.json`
  });

  const response = await s3Client.send(command);
  const bodyString = await response.Body!.transformToString();
  return JSON.parse(bodyString);
}

export async function saveContacts(contacts: Record<string, Contact>): Promise<void> {
  const command = new PutObjectCommand({
    Bucket: process.env.B2_BUCKET!,
    Key: `${process.env.B2_PREFIX}contacts.json`,
    Body: JSON.stringify(contacts, null, 2),
    ContentType: 'application/json'
  });

  await s3Client.send(command);
}

export async function getScheduledMessages(): Promise<{ messages: ScheduledMessage[] }> {
  const command = new GetObjectCommand({
    Bucket: process.env.B2_BUCKET!,
    Key: `${process.env.B2_PREFIX}scheduled.json`
  });

  const response = await s3Client.send(command);
  const bodyString = await response.Body!.transformToString();
  return JSON.parse(bodyString);
}

export async function saveScheduledMessages(data: { messages: ScheduledMessage[] }): Promise<void> {
  const command = new PutObjectCommand({
    Bucket: process.env.B2_BUCKET!,
    Key: `${process.env.B2_PREFIX}scheduled.json`,
    Body: JSON.stringify(data, null, 2),
    ContentType: 'application/json'
  });

  await s3Client.send(command);
}
```

#### Step 3.6: Create auth utility

**Create `lib/auth.ts`:**
```typescript
import bcrypt from 'bcrypt';

export function verifyPassword(password: string): boolean {
  const correctPassword = process.env.WEB_PASSWORD!;
  return password === correctPassword;
}

export function setAuthCookie(response: Response): void {
  // Set HTTP-only cookie for 7 days
  const expires = new Date();
  expires.setDate(expires.getDate() + 7);

  response.headers.set('Set-Cookie', `auth=true; HttpOnly; Path=/; Expires=${expires.toUTCString()}; SameSite=Strict`);
}

export function checkAuth(request: Request): boolean {
  const cookie = request.headers.get('cookie');
  return cookie?.includes('auth=true') || false;
}
```

#### Step 3.7: Create middleware for auth

**Create `middleware.ts` (in root):**
```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const isAuthenticated = request.cookies.get('auth')?.value === 'true';
  const isLoginPage = request.nextUrl.pathname === '/login';

  // Redirect to login if not authenticated and not on login page
  if (!isAuthenticated && !isLoginPage) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Redirect to dashboard if authenticated and on login page
  if (isAuthenticated && isLoginPage) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)']
};
```

#### Step 3.8: Create API routes

**Create `app/api/auth/login/route.ts`:**
```typescript
import { NextResponse } from 'next/server';
import { verifyPassword } from '@/lib/auth';

export async function POST(request: Request) {
  const { password } = await request.json();

  if (verifyPassword(password)) {
    const response = NextResponse.json({ success: true });

    // Set auth cookie
    const expires = new Date();
    expires.setDate(expires.getDate() + 7);
    response.cookies.set('auth', 'true', {
      httpOnly: true,
      expires,
      sameSite: 'strict',
      path: '/'
    });

    return response;
  }

  return NextResponse.json({ success: false, error: 'Invalid password' }, { status: 401 });
}
```

**Create `app/api/contacts/route.ts`:**
```typescript
import { NextResponse } from 'next/server';
import { getContacts, saveContacts } from '@/lib/s3';

export async function GET() {
  try {
    const contacts = await getContacts();
    return NextResponse.json(contacts);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to load contacts' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const contacts = await request.json();
    await saveContacts(contacts);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to save contacts' }, { status: 500 });
  }
}
```

**Create `app/api/scheduled/route.ts`:**
```typescript
import { NextResponse } from 'next/server';
import { getScheduledMessages, saveScheduledMessages } from '@/lib/s3';

export async function GET() {
  try {
    const data = await getScheduledMessages();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to load scheduled messages' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    await saveScheduledMessages(data);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to save scheduled messages' }, { status: 500 });
  }
}
```

#### Step 3.9: Create login page

**Create `app/login/page.tsx`:**
```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });

      const data = await res.json();

      if (data.success) {
        router.push('/dashboard');
      } else {
        setError('Invalid password');
      }
    } catch (err) {
      setError('Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>WhatsApp Scheduler</CardTitle>
          <CardDescription>Enter your password to continue</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Logging in...' : 'Login'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

#### Step 3.10: Create dashboard page

**Create `app/dashboard/page.tsx`:**
```typescript
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { ScheduledMessage } from '@/lib/s3';

export default function DashboardPage() {
  const [scheduled, setScheduled] = useState<ScheduledMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/scheduled')
      .then(res => res.json())
      .then(data => {
        setScheduled(data.messages || []);
        setLoading(false);
      });
  }, []);

  const pendingCount = scheduled.filter(m => m.status === 'pending').length;
  const sentCount = scheduled.filter(m => m.status === 'sent').length;

  const upcomingMessages = scheduled
    .filter(m => m.status === 'pending')
    .sort((a, b) => new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime())
    .slice(0, 5);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-gray-600">Overview of your scheduled messages</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Pending</CardTitle>
              <CardDescription>Messages waiting to send</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold">{pendingCount}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sent</CardTitle>
              <CardDescription>Successfully delivered</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold">{sentCount}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Total</CardTitle>
              <CardDescription>All scheduled messages</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold">{scheduled.length}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming Messages</CardTitle>
            <CardDescription>Next 5 scheduled messages</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p>Loading...</p>
            ) : upcomingMessages.length === 0 ? (
              <p className="text-gray-500">No upcoming messages</p>
            ) : (
              <div className="space-y-4">
                {upcomingMessages.map(msg => (
                  <div key={msg.id} className="flex items-center justify-between border-b pb-2">
                    <div className="flex-1">
                      <p className="font-medium">{msg.contactName}</p>
                      <p className="text-sm text-gray-600 truncate max-w-md">{msg.message}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        {new Date(msg.scheduledTime).toLocaleString('en-GB', {
                          timeZone: 'Europe/London',
                          dateStyle: 'short',
                          timeStyle: 'short'
                        })}
                      </p>
                      <Badge variant="secondary">{msg.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-4">
          <Link href="/schedule">
            <Button>Schedule New Message</Button>
          </Link>
          <Link href="/scheduled">
            <Button variant="outline">View All Scheduled</Button>
          </Link>
          <Link href="/contacts">
            <Button variant="outline">Manage Contacts</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
```

#### Step 3.11: Create contacts page

**Due to length constraints, I'll provide the structure:**

**Create `app/contacts/page.tsx`:**
- Lists all contacts (272)
- Search/filter functionality
- Favorites at top
- Click to edit contact
- Add new contact button

#### Step 3.12: Create schedule page

**Create `app/schedule/page.tsx`:**
- Contact picker dropdown (searchable)
- Message textarea
- Date picker (UK timezone aware)
- Time picker
- Submit button → Creates new scheduled message

#### Step 3.13: Create scheduled messages page

**Create `app/scheduled/page.tsx`:**
- Table of all scheduled messages
- Filter by status (pending/sent/failed)
- Edit/delete buttons
- Status badges with colors

#### Step 3.14: Build and deploy

```bash
# Build Next.js
npm run build

# Start with PM2
pm2 start npm --name whatsapp-web -- start

# Or use ecosystem file
pm2 start ecosystem.config.js
pm2 save
```

#### Step 3.15: Configure Nginx (if needed)

If port 80/443 already in use, proxy to Next.js:

```nginx
server {
    listen 80;
    server_name 192.209.62.48;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**✅ Phase 3 Complete when:**
- Web UI accessible at http://192.209.62.48
- Can login with password
- Can view dashboard
- Can browse contacts
- Can schedule a test message

---

### PHASE 4: Testing & Final Deployment (1 hour)

#### Step 4.1: End-to-end test

**Test scenario:**
1. Login to web UI
2. Navigate to "Schedule New Message"
3. Select a contact (pick yourself or test number)
4. Enter message: "Test scheduled message"
5. Set time: 2 minutes from now
6. Submit

**Verify in S3:**
```bash
# On local Mac
cd /Users/saadi/Documents/GitHub/WhatsApp-VPSLink
node -e "
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
require('dotenv').config();

const s3 = new S3Client({
  endpoint: process.env.B2_S3_ENDPOINT,
  region: 'eu-central-003',
  credentials: {
    accessKeyId: process.env.B2_ACCESS_KEY_ID,
    secretAccessKey: process.env.B2_SECRET_ACCESS_KEY
  }
});

(async () => {
  const cmd = new GetObjectCommand({
    Bucket: process.env.B2_BUCKET,
    Key: process.env.B2_PREFIX + 'scheduled.json'
  });
  const res = await s3.send(cmd);
  const data = await res.Body.transformToString();
  console.log(JSON.parse(data));
})();
"
```

**Check scheduler logs:**
```bash
ssh root@5.231.56.146 'pm2 logs whatsapp-scheduler --lines 50'
```

**Wait 2+ minutes, verify:**
- Message appears in your WhatsApp
- S3 `scheduled.json` status updated to "sent"
- Web UI shows message as "Sent"

#### Step 4.2: Update documentation

**Update README.md:**
- Add scheduler features
- Update architecture diagram
- Add web UI access instructions

**Update QUICKSTART.md:**
- Add "Schedule a message" section

**Create docs/SCHEDULER.md:**
- How scheduling works
- Web UI guide
- Troubleshooting

#### Step 4.3: Commit to GitHub

```bash
cd /Users/saadi/Documents/GitHub/WhatsApp-VPSLink
git add -A
git commit -m "Complete WhatsApp Scheduler implementation"
git push
```

**✅ Project 100% Complete when:**
- Test message successfully sent
- All documentation updated
- Code pushed to GitHub
- User can schedule messages from web UI
- Messages send automatically from VPS

---

## 🧪 TESTING CHECKLIST

### Unit Tests
- [ ] Upload contacts to S3
- [ ] Upload scheduled.json to S3
- [ ] Scheduler connects to WhatsApp
- [ ] Scheduler reads from S3
- [ ] Scheduler detects pending messages
- [ ] Scheduler sends message
- [ ] Scheduler updates status in S3

### Integration Tests
- [ ] Web UI login works
- [ ] Dashboard loads stats
- [ ] Contacts page shows 272 contacts
- [ ] Can search/filter contacts
- [ ] Can schedule new message
- [ ] Message appears in S3
- [ ] Scheduler picks up message
- [ ] Message sends via WhatsApp
- [ ] Status updates in S3 and web UI

### End-to-End Test
1. [ ] Login to web UI
2. [ ] Schedule message for 2 mins from now
3. [ ] Verify in S3 `scheduled.json`
4. [ ] Wait 2 minutes
5. [ ] Check PM2 logs (should show "Sending...")
6. [ ] Verify message received on WhatsApp
7. [ ] Refresh web UI - status shows "Sent"
8. [ ] Check S3 - `sentAt` timestamp present

---

## 🐛 COMMON ISSUES & SOLUTIONS

### Issue 1: Scheduler not picking up messages

**Symptoms:** Messages stay "pending" forever

**Debug:**
```bash
ssh root@5.231.56.146
pm2 logs whatsapp-scheduler --lines 100
```

**Common causes:**
- Scheduler not running: `pm2 restart whatsapp-scheduler`
- WhatsApp not connected: Check logs for "Connected to WhatsApp"
- Time zone mismatch: Scheduled time might be in future
- S3 credentials wrong: Check `.env` file

### Issue 2: Web UI can't connect to S3

**Symptoms:** 500 errors on dashboard/contacts pages

**Debug:**
Check `/var/www/whatsapp-scheduler/.env.local` has correct S3 credentials

**Test S3 connection:**
```bash
ssh root@192.209.62.48
cd /var/www/whatsapp-scheduler
node -e "require('dotenv').config(); console.log(process.env.B2_BUCKET)"
```

Should output: `WhatsAppVPS`

### Issue 3: Time zone incorrect

**Symptoms:** Messages send at wrong time

**Fix:** Ensure all dates use `Europe/London` timezone:

```javascript
const ukTime = new Date().toLocaleString('en-GB', {
  timeZone: 'Europe/London'
});
```

### Issue 4: Race condition - message sent twice

**Symptoms:** Duplicate messages

**Cause:** Two scheduler instances running

**Fix:**
```bash
ssh root@5.231.56.146
pm2 delete all
pm2 start wa.js --name whatsapp-listener -- listen
pm2 start scheduler.js --name whatsapp-scheduler
pm2 save
```

---

## 📚 REFERENCE DOCS

### Time Zones

**UK Time Handling:**
- Store all times as **ISO 8601 UTC** in S3
- Display in **Europe/London** (handles GMT/BST automatically)
- JavaScript automatically adjusts for daylight saving

**Example:**
```javascript
// User selects: Dec 24, 2025 10:00 AM (UK time)
// Stored in S3: "2025-12-24T10:00:00.000Z" (UTC)
// Displayed: "24/12/25, 10:00" (UK time)

// In summer (BST):
// User selects: Jun 24, 2025 10:00 AM (UK time)
// Stored in S3: "2025-06-24T09:00:00.000Z" (UTC, -1 hour)
// Displayed: "24/06/25, 10:00" (UK time)
```

### S3 API Calls

**Read operations:**
- `GetObjectCommand` - Download file
- Response: `{ Body: ReadableStream }`
- Convert: `await response.Body.transformToString()`

**Write operations:**
- `PutObjectCommand` - Upload file
- Body: `JSON.stringify(data, null, 2)`
- ContentType: `application/json`

**Error handling:**
- `NoSuchKey` - File doesn't exist (create empty)
- `AccessDenied` - Wrong credentials
- `NetworkError` - S3 endpoint unreachable

---

## 🎓 USER TRAINING

### How to Schedule a Message

1. Go to http://192.209.62.48
2. Login with your password
3. Click "Schedule New Message"
4. Select contact from dropdown (or type to search)
5. Enter your message
6. Pick date and time (UK timezone)
7. Click "Schedule"
8. Done! Message will send automatically

### How to Edit a Scheduled Message

1. Go to "View Scheduled Messages"
2. Find your message
3. Click "Edit"
4. Change time or message
5. Click "Save"

### How to Cancel a Scheduled Message

1. Go to "View Scheduled Messages"
2. Find your message
3. Click "Delete"
4. Confirm

### How to Add a Contact

1. Go to "Contacts"
2. Click "Add Contact"
3. Enter name, phone number, aliases
4. Mark as favorite (optional)
5. Click "Save"

---

## 📞 SUPPORT

### Quick Commands

**Check scheduler status:**
```bash
ssh root@5.231.56.146 'pm2 status'
```

**View scheduler logs:**
```bash
ssh root@5.231.56.146 'pm2 logs whatsapp-scheduler --lines 50'
```

**Restart scheduler:**
```bash
ssh root@5.231.56.146 'pm2 restart whatsapp-scheduler'
```

**Check S3 files:**
```bash
cd /Users/saadi/Documents/GitHub/WhatsApp-VPSLink
node scripts/check-s3.js
```

---

## ✅ HANDOVER CHECKLIST

Before considering project complete:

- [ ] Phase 1: S3 upload complete (contacts + scheduled.json)
- [ ] Phase 2: Scheduler worker running on Doodah
- [ ] Phase 3: Web UI deployed on Saadi
- [ ] Phase 4: End-to-end test passed
- [ ] Documentation updated (README, QUICKSTART, docs/)
- [ ] Code pushed to GitHub
- [ ] User trained on how to use system
- [ ] PM2 processes set to auto-start
- [ ] Backup strategy documented

---

## 🚀 IMMEDIATE NEXT STEPS

**Start here:**

```bash
# Step 1: Upload to S3 (15 mins)
cd /Users/saadi/Documents/GitHub/WhatsApp-VPSLink
node scripts/upload-contacts-to-s3.js

# Step 2: Build scheduler (2-3 hours)
ssh root@5.231.56.146
cd /root/whatsapp-vpslink
# Create src/scheduledStore.js (see Phase 2.1)
# Create scheduler.js (see Phase 2.2)
node scheduler.js  # Test
pm2 start scheduler.js --name whatsapp-scheduler
pm2 save

# Step 3: Build web UI (4-5 hours)
ssh root@192.209.62.48
mkdir -p /var/www/whatsapp-scheduler
cd /var/www/whatsapp-scheduler
npx create-next-app@latest . --app --tailwind --typescript
# (Follow Phase 3 steps)

# Step 4: Test (1 hour)
# Schedule test message via web UI
# Wait for scheduler to send
# Verify on WhatsApp
```

**Total time: 7-9 hours**

---

**STATUS:** Ready to execute Phase 1
**BLOCKED ON:** Nothing - all prerequisites met
**NEXT ACTION:** Run `node scripts/upload-contacts-to-s3.js`
