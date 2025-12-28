# Data Schemas & Storage Architecture

## Overview

WhatsApp-VPSLink uses **Backblaze B2 S3-compatible cloud storage** as the primary data store for cross-VPS communication and persistence. The system stores three main JSON files that define contacts, scheduled messages, and chat history.

**Storage Provider:** Backblaze B2
**Bucket:** WhatsAppVPS
**Region:** eu-central-003
**Cost:** ~$0.10/month
**Total Storage:** ~6MB

---

## Storage Architecture

### Dual-Mode Storage

```javascript
// src/chatStore.js
const STORAGE_MODE = process.env.STORAGE_MODE || 'local';

if (STORAGE_MODE === 's3') {
    // Production: Use Backblaze B2 S3
    // - Read/write from cloud bucket
    // - Cross-VPS data sharing
    // - Automatic backup
} else {
    // Development: Use local file
    // - Read/write from backups/chats.json
    // - Faster for testing
    // - No internet required
}
```

**Modes:**
- **`s3`** (Production) - All data in Backblaze B2 cloud
- **`local`** (Development) - All data in local `backups/` directory

### S3 Configuration

**Environment Variables (.env):**
```env
B2_BUCKET=WhatsAppVPS
B2_S3_ENDPOINT=https://s3.eu-central-003.backblazeb2.com
B2_ACCESS_KEY_ID=003abc123def456789
B2_SECRET_ACCESS_KEY=K003AbCdEfGhIjKlMnOpQrStUvWxYz
B2_PREFIX=whatsapp/
STORAGE_MODE=s3
```

**S3 Client Setup:**
```javascript
// src/chatStore.js
const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');

const s3Client = new S3Client({
    endpoint: process.env.B2_S3_ENDPOINT,
    region: 'eu-central-003',
    credentials: {
        accessKeyId: process.env.B2_ACCESS_KEY_ID,
        secretAccessKey: process.env.B2_SECRET_ACCESS_KEY
    }
});
```

### Files in S3 Bucket

```
WhatsAppVPS (Bucket)
└── whatsapp/
    ├── contacts.json       57 KB   272 contacts with aliases
    ├── scheduled.json      1-5 KB  Pending/sent message queue
    └── chats.json          5.5 MB  Full message history
```

---

## 1. Contacts Schema

**File:** `whatsapp/contacts.json`
**Size:** 57 KB
**Count:** 272 contacts
**Purpose:** Contact directory with aliases for search

### Schema Structure

```json
{
  "447957189696": {
    "name": "Reem",
    "aliases": ["Reemy", "R", "Sister"],
    "phones": {
      "primary": "447957189696",
      "secondary": null
    },
    "favorite": true,
    "tags": ["family"]
  },
  "447950724774": {
    "name": "Nick Smith",
    "aliases": ["Nick", "Nicky"],
    "phones": {
      "primary": "447950724774",
      "secondary": null
    },
    "favorite": false,
    "tags": ["friends"]
  },
  "447123456789": {
    "name": "Business Contact",
    "aliases": ["BC", "BusinessGuy"],
    "phones": {
      "primary": "447123456789",
      "secondary": "447987654321"
    },
    "favorite": false,
    "tags": ["work", "clients"]
  }
}
```

### Field Definitions

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| **Key** | string | ✅ | Phone number (without @s.whatsapp.net) | "447957189696" |
| `name` | string | ✅ | Display name | "Reem" |
| `aliases` | string[] | ❌ | Alternative names for search | ["Reemy", "Sister"] |
| `phones.primary` | string | ✅ | Main WhatsApp number | "447957189696" |
| `phones.secondary` | string \| null | ❌ | Alternative phone | "447123456780" |
| `favorite` | boolean | ❌ | Star/favorite flag | true |
| `tags` | string[] | ❌ | Categories (for future use) | ["family", "important"] |

### Contact Key Format

**Key = Phone Number (no prefix)**
```javascript
// Correct
"447957189696": { ... }

// Incorrect
"447957189696@s.whatsapp.net": { ... }  ❌
"+447957189696": { ... }                 ❌
```

### Aliases Array

**Purpose:** Enable flexible search by multiple names

**Examples:**
```json
{
  "447957189696": {
    "name": "Reem",
    "aliases": [
      "Reemy",      // Nickname
      "R",          // Short name
      "Sister",     // Relationship
      "Reem Ahmed"  // Full name
    ]
  }
}
```

**Search behavior:**
- Search "reem" → Matches
- Search "reemy" → Matches
- Search "sister" → Matches
- Search "r" → Matches (but may return multiple results)

### Tags Array

**Purpose:** Categorization for future filtering

**Common Tags:**
```json
{
  "tags": [
    "family",      // Family members
    "friends",     // Personal friends
    "work",        // Work colleagues
    "clients",     // Business clients
    "important",   // VIP contacts
    "group-admin"  // WhatsApp group admins
  ]
}
```

**Future Use Cases:**
- Filter contacts by tag
- Bulk message to tag group
- Tag-based access control
- Analytics by tag

### API Operations

**Read Contacts (from S3):**
```javascript
// Web UI or scheduler
const contacts = await loadContactsFromS3();
// Returns: { "447957189696": { name: "Reem", ... }, ... }
```

**Add Contact:**
```javascript
contacts["447123456789"] = {
    name: "New Contact",
    aliases: [],
    phones: {
        primary: "447123456789",
        secondary: null
    },
    favorite: false,
    tags: []
};
await saveContactsToS3(contacts);
```

**Update Contact:**
```javascript
contacts["447957189696"].name = "Reem Ahmed";
contacts["447957189696"].aliases.push("Reemy");
contacts["447957189696"].favorite = true;
await saveContactsToS3(contacts);
```

**Delete Contact:**
```javascript
delete contacts["447123456789"];
await saveContactsToS3(contacts);
```

**Search Contacts:**
```javascript
function searchContacts(query) {
    const lowerQuery = query.toLowerCase();
    return Object.entries(contacts).filter(([phone, contact]) => {
        return contact.name.toLowerCase().includes(lowerQuery) ||
               phone.includes(query) ||
               contact.aliases.some(alias =>
                   alias.toLowerCase().includes(lowerQuery)
               );
    });
}
```

---

## 2. Scheduled Messages Schema

**File:** `whatsapp/scheduled.json`
**Size:** 1-5 KB (varies with queue size)
**Purpose:** Message queue for scheduler worker

### Schema Structure

```json
{
  "messages": [
    {
      "id": "1735168500123_a1b2c3",
      "to": "447957189696",
      "contactName": "Reem",
      "message": "Happy Birthday! Hope you have an amazing day! 🎂",
      "scheduledTime": "2025-12-24T10:00:00.000Z",
      "status": "pending",
      "createdAt": "2025-12-22T22:15:00.123Z",
      "createdFrom": "web",
      "sentAt": null,
      "error": null
    },
    {
      "id": "1735168700456_x9y8z7",
      "to": "447950724774",
      "contactName": "Nick",
      "message": "How are you?",
      "scheduledTime": "2025-12-25T14:30:00.000Z",
      "status": "sent",
      "createdAt": "2025-12-23T09:45:00.000Z",
      "createdFrom": "web",
      "sentAt": "2025-12-25T14:30:05.789Z",
      "error": null
    },
    {
      "id": "1735169000789_p1q2r3",
      "to": "447123456789",
      "contactName": "Chris",
      "message": "Meeting reminder",
      "scheduledTime": "2025-12-23T15:00:00.000Z",
      "status": "failed",
      "createdAt": "2025-12-23T14:00:00.000Z",
      "createdFrom": "web",
      "sentAt": null,
      "error": "not-authorized: Session expired"
    }
  ]
}
```

### Field Definitions

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `id` | string | ✅ | Unique ID: `timestamp_random` | "1735168500123_a1b2c3" |
| `to` | string | ✅ | Phone number (no @s.whatsapp.net) | "447957189696" |
| `contactName` | string | ✅ | Display name (for UI) | "Reem" |
| `message` | string | ✅ | Message text (max 65536 chars) | "Happy Birthday!" |
| `scheduledTime` | ISO8601 | ✅ | When to send (UTC timezone) | "2025-12-24T10:00:00.000Z" |
| `status` | enum | ✅ | "pending" \| "sent" \| "failed" | "pending" |
| `createdAt` | ISO8601 | ✅ | When scheduled | "2025-12-22T22:15:00.123Z" |
| `createdFrom` | string | ✅ | Source: "web" \| "api" \| "cli" | "web" |
| `sentAt` | ISO8601 \| null | ❌ | When actually sent | "2025-12-24T10:00:05.789Z" |
| `error` | string \| null | ❌ | Error message if failed | "rate-limit-exceeded" |

### ID Generation

**Format:** `timestamp_random`

**Implementation:**
```javascript
function generateMessageId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${timestamp}_${random}`;
}

// Example: "1735168500123_a1b2c3"
//          └─ Unix timestamp (ms) └─ 6-char random
```

**Uniqueness:**
- Timestamp ensures chronological ordering
- Random suffix prevents collisions if created simultaneously

### Status Flow

```
┌─────────┐
│ pending │ ← Initial state when scheduled
└────┬────┘
     │
     │ Scheduler checks every 60s
     │
     │ scheduledTime <= now?
     ├─ Yes → Send message
     │
     ▼
┌─────────┐    Success    ┌──────┐
│ sending │ ─────────────→ │ sent │
└─────────┘                └──────┘
     │
     │ Failure
     ▼
┌────────┐
│ failed │
└────────┘
```

**Status Descriptions:**

| Status | Description | Scheduler Action |
|--------|-------------|------------------|
| `pending` | Not yet sent, waiting for scheduled time | Check if scheduledTime <= now |
| `sent` | Successfully sent | Skip (already processed) |
| `failed` | Send attempt failed | Skip (already processed) |

### Timezone Handling

**All timestamps in UTC (ISO8601 format):**

```javascript
// User schedules for Dec 24, 10:00 AM London time
// UI converts to UTC:
scheduledTime: "2025-12-24T10:00:00.000Z"

// Scheduler runs in UTC:
const now = new Date().toISOString();  // "2025-12-24T10:00:05.000Z"
if (msg.scheduledTime <= now) {
    // Send message
}
```

**Time Conversion:**
```javascript
// Browser (local timezone) → UTC
const localTime = new Date("2025-12-24T10:00");
const utcTime = localTime.toISOString();
// "2025-12-24T10:00:00.000Z"

// UTC → Browser (local timezone)
const utcTime = "2025-12-24T10:00:00.000Z";
const localTime = new Date(utcTime);
// Displays in user's local timezone
```

### Scheduler Worker Logic

**Polling Loop (every 60 seconds):**

```javascript
// scheduler.js (Doodah VPS)
async function checkAndSendMessages() {
    // 1. Load scheduled messages from S3
    const data = await loadScheduledFromS3();
    const messages = data.messages || [];

    // 2. Filter pending messages due to send
    const now = new Date().toISOString();
    const toSend = messages.filter(msg =>
        msg.status === 'pending' &&
        msg.scheduledTime <= now
    );

    console.log(`→ Found ${toSend.length} message(s) to send`);

    // 3. Send each message
    for (const msg of toSend) {
        const success = await sendMessage(msg.to, msg.message);

        if (success) {
            msg.status = 'sent';
            msg.sentAt = new Date().toISOString();
            console.log(`✓ Sent: "${msg.message}" to ${msg.contactName}`);
        } else {
            msg.status = 'failed';
            msg.error = 'Failed to send via WhatsApp';
            console.error(`❌ Failed: ${msg.contactName}`);
        }
    }

    // 4. Save updated messages to S3
    await saveScheduledToS3(data);
}

// Run every 60 seconds
setInterval(checkAndSendMessages, 60000);
```

### Error Handling

**Common Errors:**

| Error | Cause | Resolution |
|-------|-------|------------|
| `not-authorized` | Session expired | Re-authenticate (scan QR) |
| `recipient-not-found` | Invalid phone number | Verify number format |
| `rate-limit-exceeded` | Too many messages | Wait and retry |
| `message-too-long` | Message > 65536 chars | Split into multiple messages |
| `network-error` | Internet connection lost | Auto-reconnect |

**Error Storage:**
```json
{
  "id": "1735169000789_p1q2r3",
  "status": "failed",
  "error": "not-authorized: Session expired. Please re-scan QR code.",
  "sentAt": null
}
```

---

## 3. Chat History Schema

**File:** `whatsapp/chats.json`
**Size:** 5.5 MB
**Purpose:** Store all WhatsApp message history

### Schema Structure

```json
{
  "447950724774@s.whatsapp.net": {
    "id": "447950724774@s.whatsapp.net",
    "messages": [
      {
        "message": "Hey, how are you?",
        "timestamp": 1766427969,
        "isFromMe": false,
        "messageType": "text",
        "date": "2025-12-23T15:32:49.000Z",
        "rawMessage": null
      },
      {
        "message": "I'm good, thanks! How about you?",
        "timestamp": 1766428123,
        "isFromMe": true,
        "messageType": "text",
        "date": "2025-12-23T15:35:23.000Z",
        "rawMessage": null
      },
      {
        "message": "[Voice Note]",
        "timestamp": 1766428456,
        "isFromMe": false,
        "messageType": "audio",
        "date": "2025-12-23T15:40:56.000Z",
        "rawMessage": {
          "key": {
            "remoteJid": "447950724774@s.whatsapp.net",
            "fromMe": false,
            "id": "3EB0C1234567890ABCDEF"
          },
          "message": {
            "audioMessage": {
              "url": "https://mmg.whatsapp.net/...",
              "mediaKey": "encrypted-base64-key==",
              "mimetype": "audio/ogg; codecs=\"opus\"",
              "fileEncSha256": "base64-hash==",
              "fileSha256": "base64-hash==",
              "fileLength": "12345",
              "seconds": 15,
              "ptt": true
            }
          },
          "messageTimestamp": 1766428456,
          "status": "SERVER_ACK"
        }
      },
      {
        "message": "[Image] Check this out!",
        "timestamp": 1766428789,
        "isFromMe": false,
        "messageType": "image",
        "date": "2025-12-23T15:46:29.000Z",
        "rawMessage": {
          "key": { ... },
          "message": {
            "imageMessage": {
              "url": "https://mmg.whatsapp.net/...",
              "caption": "Check this out!",
              "mimetype": "image/jpeg",
              "width": 1080,
              "height": 1920,
              "fileLength": "234567"
            }
          }
        }
      }
    ],
    "lastMessageTime": 1766428789,
    "unreadCount": 0,
    "name": "Nick",
    "isGroup": false
  },
  "120363123456789012@g.us": {
    "id": "120363123456789012@g.us",
    "messages": [
      {
        "message": "Hey everyone!",
        "timestamp": 1766429000,
        "isFromMe": false,
        "messageType": "text",
        "date": "2025-12-23T15:50:00.000Z",
        "rawMessage": null
      }
    ],
    "lastMessageTime": 1766429000,
    "unreadCount": 2,
    "name": "Family Group",
    "isGroup": true
  }
}
```

### Chat Object Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| **Key (JID)** | string | WhatsApp JID (includes @s.whatsapp.net or @g.us) | "447950724774@s.whatsapp.net" |
| `id` | string | Same as key | "447950724774@s.whatsapp.net" |
| `messages` | array | Array of message objects | [...] |
| `lastMessageTime` | number | Unix timestamp of last message (seconds) | 1766428789 |
| `unreadCount` | number | Number of unread messages | 0 |
| `name` | string | Contact/group name | "Nick" |
| `isGroup` | boolean | Whether this is a group chat | false |

### Message Object Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `message` | string | Display text | "Hey, how are you?" |
| `timestamp` | number | Unix timestamp (seconds) | 1766427969 |
| `isFromMe` | boolean | Whether sent by me | false |
| `messageType` | enum | "text" \| "image" \| "video" \| "audio" \| "document" \| "other" | "text" |
| `date` | ISO8601 | Formatted date/time | "2025-12-23T15:32:49.000Z" |
| `rawMessage` | object \| null | Full Baileys message object (for media) | {...} |

### Message Types

**Text Messages:**
```json
{
  "message": "Hey, how are you?",
  "messageType": "text",
  "rawMessage": null
}
```

**Image Messages:**
```json
{
  "message": "[Image] Check this out!",
  "messageType": "image",
  "rawMessage": {
    "message": {
      "imageMessage": {
        "url": "https://mmg.whatsapp.net/...",
        "caption": "Check this out!",
        "mimetype": "image/jpeg"
      }
    }
  }
}
```

**Voice Notes:**
```json
{
  "message": "[Voice Note]",
  "messageType": "audio",
  "rawMessage": {
    "message": {
      "audioMessage": {
        "url": "https://mmg.whatsapp.net/...",
        "ptt": true,  // Push-to-talk (voice note)
        "seconds": 15
      }
    }
  }
}
```

**Documents:**
```json
{
  "message": "[Document: report.pdf]",
  "messageType": "document",
  "rawMessage": {
    "message": {
      "documentMessage": {
        "url": "https://mmg.whatsapp.net/...",
        "fileName": "report.pdf",
        "mimetype": "application/pdf"
      }
    }
  }
}
```

### JID Format

**Personal Chats:**
```
447950724774@s.whatsapp.net
└─ Phone number └─ WhatsApp server domain
```

**Group Chats:**
```
120363123456789012@g.us
└─ Group ID └─ Group domain
```

**Broadcast Lists:**
```
123456789-1234567890@broadcast
```

### ChatStore Operations

**Add Message:**
```javascript
// src/chatStore.js
function addMessage(jid, text, timestamp, isFromMe, messageType, rawMessage) {
    if (!chats[jid]) {
        chats[jid] = {
            id: jid,
            messages: [],
            lastMessageTime: 0,
            unreadCount: 0,
            name: jid.split('@')[0],
            isGroup: jid.endsWith('@g.us')
        };
    }

    chats[jid].messages.push({
        message: text,
        timestamp: timestamp,
        isFromMe: isFromMe,
        messageType: messageType || 'text',
        date: new Date(timestamp * 1000).toISOString(),
        rawMessage: rawMessage || null
    });

    chats[jid].lastMessageTime = timestamp;

    if (!isFromMe) {
        chats[jid].unreadCount++;
    }

    debouncedSave();  // Save to S3 (max 1 save/second)
}
```

**Update Contact Name:**
```javascript
function setName(jid, name) {
    if (chats[jid]) {
        chats[jid].name = name;
        debouncedSave();
    }
}
```

**Mark as Read:**
```javascript
function markAsRead(jid) {
    if (chats[jid]) {
        chats[jid].unreadCount = 0;
        debouncedSave();
    }
}
```

**Get Chat:**
```javascript
function getChat(jid) {
    return chats[jid] || null;
}
```

**Search Messages:**
```javascript
function searchMessages(query) {
    const results = [];
    for (const [jid, chat] of Object.entries(chats)) {
        const matches = chat.messages.filter(msg =>
            msg.message.toLowerCase().includes(query.toLowerCase())
        );
        if (matches.length > 0) {
            results.push({ jid, chat: chat.name, messages: matches });
        }
    }
    return results;
}
```

---

## 4. Local Contacts Schema (CLI Tools)

**File:** `tools/contacts.json`
**Purpose:** Used by CLI tools for alias management

### Schema Structure

```json
{
  "447950724774": {
    "name": "Nick Smith",
    "numbers": ["447950724774"],
    "aliases": ["Nick", "Nicky", "Nicholas"],
    "notes": ""
  },
  "447957189696": {
    "name": "Reem Ahmed",
    "numbers": ["447957189696", "447123456780"],
    "aliases": ["Reem", "Reemy", "Sister"],
    "notes": "Birthday: Jan 15"
  }
}
```

**Note:** This schema is separate from the main S3 contacts.json and is only used by CLI tools like `contacts-manager.js`.

---

## S3 Operations

### Read from S3

```javascript
// src/chatStore.js
async function loadFromS3(key) {
    try {
        const command = new GetObjectCommand({
            Bucket: process.env.B2_BUCKET,
            Key: `${process.env.B2_PREFIX}${key}`
        });

        const response = await s3Client.send(command);
        const bodyString = await streamToString(response.Body);
        return JSON.parse(bodyString);
    } catch (error) {
        if (error.name === 'NoSuchKey') {
            return null;  // File doesn't exist
        }
        throw error;
    }
}

// Example usage
const contacts = await loadFromS3('contacts.json');
const scheduled = await loadFromS3('scheduled.json');
const chats = await loadFromS3('chats.json');
```

### Write to S3

```javascript
async function saveToS3(key, data) {
    const command = new PutObjectCommand({
        Bucket: process.env.B2_BUCKET,
        Key: `${process.env.B2_PREFIX}${key}`,
        Body: JSON.stringify(data, null, 2),
        ContentType: 'application/json'
    });

    await s3Client.send(command);
    console.log(`✓ Saved ${key} to S3`);
}

// Example usage
await saveToS3('contacts.json', contacts);
await saveToS3('scheduled.json', { messages: [...] });
await saveToS3('chats.json', chats);
```

### Debounced Save (Chat History)

**Problem:** Message events fire rapidly (10-100 messages/second during sync)
**Solution:** Debounce saves to max 1 save per second

```javascript
// src/chatStore.js
let saveTimeout = null;

function debouncedSave() {
    if (saveTimeout) {
        clearTimeout(saveTimeout);
    }

    saveTimeout = setTimeout(async () => {
        await saveToS3('chats.json', chats);
        console.log('✓ Saved chat history to S3');
    }, 1000);  // Wait 1 second after last change
}
```

---

## Data Consistency

### Cross-VPS Synchronization

**Problem:** Web UI and Scheduler run on separate VPSs
**Solution:** S3 as single source of truth

```
Web UI (Saadi VPS):
  1. User schedules message
  2. Read scheduled.json from S3
  3. Append new message
  4. Write scheduled.json to S3

Scheduler (Doodah VPS):
  1. Poll every 60s
  2. Read scheduled.json from S3
  3. Send messages
  4. Update status
  5. Write scheduled.json to S3
```

**Race Condition Handling:**
- Scheduler only modifies messages it sends (by ID)
- Web UI only creates new messages
- No concurrent edits to same message

### Backup Strategy

**Automated Backups:**
```bash
# Cron job (daily at 2 AM)
0 2 * * * aws s3 sync s3://WhatsAppVPS/whatsapp/ /backups/whatsapp-$(date +\%Y\%m\%d)/
```

**Manual Backup:**
```bash
# Download all data
aws s3 sync s3://WhatsAppVPS/whatsapp/ ./local-backup/

# Or using scripts
node scripts/upload-to-s3.js          # Upload chats
node scripts/upload-contacts-to-s3.js  # Upload contacts
```

---

## File Size Monitoring

**Current Sizes:**
- contacts.json: 57 KB (272 contacts)
- scheduled.json: 1-5 KB (0-50 messages typically)
- chats.json: 5.5 MB (growing over time)

**Growth Estimates:**
- Contacts: +200 bytes per contact
- Scheduled: +200 bytes per message (temporary)
- Chats: +500 bytes per text message, +5KB per media reference

**Optimization:**
- Archive old messages (>90 days) to separate file
- Compress media message rawMessage fields
- Prune sent/failed scheduled messages periodically

---

## Summary

WhatsApp-VPSLink uses a clean, JSON-based schema for all data storage. The S3-based architecture enables cross-VPS communication while maintaining data consistency. All timestamps use ISO8601 UTC format for consistency. The debounced save mechanism prevents excessive S3 writes during high-frequency message capture. Contact aliases enable flexible search, while the scheduled message queue provides robust status tracking for the scheduler worker.
