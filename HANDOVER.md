# 🔄 Project Handover: WhatsApp Scheduler

## Current Status

We're building a **WhatsApp message scheduler** system on top of the existing WhatsApp VPSLink project.

### What's Done ✅

1. **WhatsApp VPSLink** - Fully operational
   - VPS listener running 24/7 on Doodah (5.231.56.146)
   - Captures all WhatsApp messages
   - Stores in S3 (Backblaze B2)
   - Can read/send messages, download media
   - Deployed and documented

2. **Contacts Migration**
   - Created `/scripts/migrate-contacts.js` to parse VCF files
   - Successfully parsed 272 contacts from `/Users/saadi/Desktop/addy.vcf`
   - Generated `contacts.json` with enhanced format:
     ```json
     {
       "447950724774": {
         "name": "Nick Smith",
         "aliases": ["Nick"],
         "phones": {
           "primary": "447950724774",
           "secondary": null
         },
         "favorite": false,
         "tags": []
       }
     }
     ```

3. **Created upload script** (not yet run)
   - `/scripts/upload-contacts-to-s3.js` ready to execute

### What's Next ⏳

1. **Upload to S3** (15 mins)
   - Run `node scripts/upload-contacts-to-s3.js`
   - Creates `contacts.json` in S3
   - Creates `scheduled.json` in S3

2. **Build Scheduler Worker** (1-2 hours)
   - Create `/root/whatsapp-vpslink/scheduler.js` on Doodah VPS
   - Checks S3 every 1 minute for pending messages
   - Sends messages via WhatsApp when time matches
   - Updates status to "sent"

3. **Build Web UI** (3-4 hours)
   - Next.js 14 + Tailwind + shadcn/ui
   - Deploy on Saadi VPS (192.209.62.48)
   - Pages: login, dashboard, contacts, schedule, scheduled
   - Direct S3 access (no API server needed)

4. **Test Complete System** (1 hour)

---

## Architecture Decision

**IMPORTANT:** We chose **Option A: Direct S3 Access**

```
┌─────────────────────────────────────┐
│        Backblaze B2 S3              │
│  - contacts.json (272 contacts)     │
│  - scheduled.json (message queue)   │
│  - chats.json (existing)            │
└────────┬────────────────────────────┘
         │
         │ All clients access S3 directly
         │
    ┌────┴─────────────────────┬──────────────┐
    │                          │              │
┌───▼────┐              ┌──────▼───┐   ┌──────▼───────┐
│iPhone  │              │ Web UI   │   │ Doodah VPS   │
│ App    │              │(Next.js) │   │ (Worker)     │
│(future)│              │          │   │              │
└────────┘              └──────────┘   └──────────────┘
```

**Why?**
- Simpler architecture
- No API server needed
- Faster (direct S3)
- User said "just for me" - security acceptable
- iPhone app can use same approach later

**NOT using:**
- ❌ REST API server
- ❌ JWT authentication
- ❌ Express/middleware

---

## S3 Data Structures

### contacts.json (DONE - ready to upload)
```json
{
  "447950724774": {
    "name": "Nick Smith",
    "aliases": ["Nick", "Nicky"],
    "phones": {
      "primary": "447950724774",
      "secondary": null
    },
    "favorite": false,
    "tags": []
  }
}
```

### scheduled.json (needs to be created)
```json
{
  "messages": [
    {
      "id": "1703001234567_abc123",
      "to": "447950724774",
      "contactName": "Nick Smith",
      "message": "Hey Nick!",
      "scheduledTime": "2025-12-24T10:30:00.000Z",
      "status": "pending",
      "createdAt": "2025-12-22T15:45:00.000Z",
      "createdFrom": "web"
    }
  ]
}
```

**Statuses:** `pending`, `sent`, `failed`

---

## Server Details

### Doodah VPS (5.231.56.146)
- **Purpose:** WhatsApp worker
- **Access:** `ssh root@5.231.56.146`
- **Location:** `/root/whatsapp-vpslink/`
- **Running:** PM2 process `whatsapp-listener` (24/7)
- **Needs:** Add `scheduler.js` as second PM2 process

### Saadi VPS (192.209.62.48)
- **Purpose:** Web UI (future)
- **Access:** `ssh root@192.209.62.48`
- **Location:** TBD (create `/var/www/whatsapp-scheduler/`)
- **Needs:** Next.js app deployment

---

## Environment Variables

Both servers use same S3 credentials:

```env
B2_BUCKET=WhatsAppVPS
B2_S3_ENDPOINT=https://s3.eu-central-003.backblazeb2.com
B2_ACCESS_KEY_ID=00330bc627754a00000000001
B2_SECRET_ACCESS_KEY=K003QhZCxsajKLOnbCKjFpep27+KfBQ
B2_PREFIX=whatsapp/
```

---

## Next Steps (In Order)

### Step 1: Upload to S3 ✅
```bash
cd /Users/saadi/Documents/GitHub/WhatsApp-VPSLink
node scripts/upload-contacts-to-s3.js
```

Should create:
- `whatsapp/contacts.json` (272 contacts)
- `whatsapp/scheduled.json` (empty array)

### Step 2: Build Scheduler Worker (Doodah)

Create `/root/whatsapp-vpslink/scheduler.js`:

**What it does:**
1. Every 60 seconds:
   - Download `scheduled.json` from S3
   - Find messages where `scheduledTime <= now` AND `status === "pending"`
   - Send via WhatsApp (reuse `wa.js` send logic)
   - Update message `status` to `"sent"`, add `sentAt` timestamp
   - Upload updated `scheduled.json` to S3

**Dependencies:**
- `@aws-sdk/client-s3` (already installed)
- `dotenv` (already installed)

**Deploy:**
```bash
ssh root@5.231.56.146
cd /root/whatsapp-vpslink
# Create scheduler.js (see below for code structure)
pm2 start scheduler.js --name whatsapp-scheduler
pm2 save
```

**Scheduler code structure:**
```javascript
// scheduler.js pseudo-code
const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
// ... reuse WhatsApp send logic from wa.js

async function checkAndSendMessages() {
  // 1. Download scheduled.json from S3
  // 2. Filter messages: scheduledTime <= now && status === 'pending'
  // 3. For each message:
  //    - Send via WhatsApp
  //    - Update status to 'sent', add sentAt
  // 4. Upload updated scheduled.json to S3
}

// Run every 60 seconds
setInterval(checkAndSendMessages, 60000);
```

### Step 3: Build Web UI (Saadi)

**Tech stack:**
- Next.js 14 (App Router)
- Tailwind CSS
- shadcn/ui components
- Direct S3 access via `@aws-sdk/client-s3`

**Pages:**
1. `/login` - Password auth (single user)
2. `/dashboard` - Overview
3. `/contacts` - Browse/edit contacts
4. `/schedule` - Create new scheduled message
5. `/scheduled` - View/edit/delete scheduled messages

**All pages:**
- Download JSON from S3
- Display in UI
- Upload back to S3 on changes

**Install:**
```bash
ssh root@192.209.62.48
mkdir -p /var/www/whatsapp-scheduler
cd /var/www/whatsapp-scheduler
npx create-next-app@latest . --app --tailwind --typescript
npm install @aws-sdk/client-s3
npx shadcn-ui@latest init
```

### Step 4: Test Complete Flow

1. **Schedule a message** via web UI
2. **Check S3** - `scheduled.json` has new entry
3. **Wait for scheduled time** (or manually set time to past)
4. **Check Doodah logs** - `pm2 logs whatsapp-scheduler`
5. **Verify message sent** on WhatsApp
6. **Check S3** - status updated to `"sent"`

---

## Time Zone Handling

**Requirement:** UK time (GMT/BST) with automatic daylight saving

**Implementation:**
```javascript
// All times stored as ISO 8601 UTC in S3
const scheduledTime = new Date(userInput).toISOString();

// Display in UK time
const ukTime = new Date(isoString).toLocaleString('en-GB', {
  timeZone: 'Europe/London'
});

// Scheduler checks
const now = new Date().toISOString();
if (msg.scheduledTime <= now && msg.status === 'pending') {
  // Send
}
```

---

## Files Created So Far

```
/Users/saadi/Documents/GitHub/WhatsApp-VPSLink/
├── contacts.json                          # ✅ 272 contacts parsed
├── scripts/
│   ├── migrate-contacts.js                # ✅ VCF parser
│   └── upload-contacts-to-s3.js          # ✅ Ready to run
└── HANDOVER.md                            # ✅ This file
```

---

## User Preferences

- **Authentication:** Single user, simple password
- **Scheduling:** One-time sends (no recurring)
- **Time zone:** UK (GMT/BST with DST)
- **Architecture:** Direct S3 (no API server)
- **Future:** iPhone app (same S3 approach)

---

## Important Notes

1. **Race conditions:** Acceptable for single user. Last-write-wins if concurrent edits.
2. **S3 keys in code:** User accepted this for personal use.
3. **1-minute polling:** Scheduler checks every 60 seconds, messages may send up to 60s late.
4. **No authentication for scheduler:** Doodah worker runs without auth (internal process).

---

## Questions to Ask User

None - all design decisions confirmed:
- ✅ Tech stack approved (Next.js + Tailwind + shadcn)
- ✅ Architecture chosen (direct S3)
- ✅ One-time sends only
- ✅ UK timezone
- ✅ Single user password auth

---

## Repository

**GitHub:** https://github.com/syedansar1562/WhatsApp-VPSLink

**Current branch:** `master`

**Last commit:** Quick start guide

---

## Immediate Next Command

```bash
cd /Users/saadi/Documents/GitHub/WhatsApp-VPSLink
node scripts/upload-contacts-to-s3.js
```

This will upload contacts and create scheduled.json in S3. Then proceed to building scheduler.js.

---

## Contact Info

**User:** Saadi
**VPS Provider:** Servitro
**S3 Provider:** Backblaze B2
**Project:** WhatsApp message scheduler for personal use

---

**Status:** Ready to continue from Step 1 (upload to S3)
**Estimated time remaining:** 6-8 hours total
