# WhatsApp Scheduler Worker - Technical Documentation

## Overview

The scheduler worker is a Node.js process that runs 24/7 on the Doodah VPS, polling S3 every 60 seconds to check for pending messages and sending them at their scheduled times.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  SCHEDULER WORKER PROCESS                    │
│                  (PM2: whatsapp-scheduler)                   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  1. Initialize                                       │    │
│  │     - Load environment variables                     │    │
│  │     - Connect to WhatsApp                            │    │
│  │     - Wait for connection confirmation               │    │
│  └──────────────────┬───────────────────────────────────┘    │
│                     │                                         │
│  ┌──────────────────▼───────────────────────────────────┐    │
│  │  2. Main Loop (Every 60 seconds)                     │    │
│  │                                                       │    │
│  │  A. Load scheduled.json from S3                      │    │
│  │  B. Filter pending messages (scheduledTime <= now)   │    │
│  │  C. For each pending message:                        │    │
│  │     - Send via WhatsApp                              │    │
│  │     - Update status to "sent"                        │    │
│  │     - Record sentAt timestamp                        │    │
│  │  D. Save updated scheduled.json to S3                │    │
│  └──────────────────┬───────────────────────────────────┘    │
│                     │                                         │
│                     └─────► Repeat every 60s                  │
└─────────────────────────────────────────────────────────────┘
```

---

## File Structure

### Doodah VPS (/root/whatsapp-vpslink/)

```
whatsapp-vpslink/
├── scheduler.js              # Main scheduler worker
├── src/
│   └── scheduledStore.js     # S3 interface for scheduled messages
├── auth_info/                # WhatsApp session (886 files)
├── .env                      # Environment configuration
├── package.json              # Dependencies
└── node_modules/             # Node packages
```

---

## scheduler.js - Main Worker

### Key Functions

#### 1. `connectToWhatsApp()`

```javascript
async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');

  sock = makeWASocket({
    auth: state,
    printQRInTerminal: false
  });

  // Event: Save credentials when updated
  sock.ev.on('creds.update', saveCreds);

  // Event: Handle connection status
  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === 'close') {
      // Auto-reconnect logic
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;

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
```

**Purpose:** Establishes and maintains WhatsApp Web connection

**Features:**
- Uses `auth_info/` session directory (no QR code needed after first setup)
- Auto-reconnects if disconnected
- Saves credentials automatically
- Sets `isConnected` flag for message sending

---

#### 2. `sendMessage(phoneNumber, message)`

```javascript
async function sendMessage(phoneNumber, message) {
  if (!isConnected) {
    throw new Error('WhatsApp not connected');
  }

  // Convert phone to JID format (e.g., 447950724774@s.whatsapp.net)
  const jid = phoneNumber.includes('@')
    ? phoneNumber
    : phoneNumber + '@s.whatsapp.net';

  try {
    await sock.sendMessage(jid, { text: message });
    console.log(`✓ Sent message to ${phoneNumber}`);
    return true;
  } catch (error) {
    console.error(`✗ Failed to send to ${phoneNumber}:`, error.message);
    throw error;
  }
}
```

**Purpose:** Sends WhatsApp message to specified phone number

**Parameters:**
- `phoneNumber`: Phone number with country code (e.g., "447950724774")
- `message`: Text message to send

**Returns:** `true` on success, throws error on failure

---

#### 3. `checkAndSendMessages()`

```javascript
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
```

**Purpose:** Main scheduler loop - checks S3 and sends pending messages

**Flow:**
1. Load `scheduled.json` from S3
2. Filter messages where `scheduledTime <= now` and `status === "pending"`
3. Send each message via WhatsApp
4. Update status to "sent" (or "failed" if error)
5. Save updated data back to S3

---

#### 4. `init()`

```javascript
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
```

**Purpose:** Initialize scheduler and start main loop

**Steps:**
1. Connect to WhatsApp
2. Wait for connection confirmation
3. Run `checkAndSendMessages()` immediately
4. Schedule `checkAndSendMessages()` to run every 60 seconds
5. Log current UK time on each check

---

## src/scheduledStore.js - S3 Interface

### Class: ScheduledStore

#### Constructor

```javascript
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
```

**Purpose:** Initialize S3 client with Backblaze B2 credentials

---

#### Methods

##### `load()`

```javascript
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
```

**Returns:** `{ messages: [ ... ] }`

**Error Handling:** Creates empty queue if file doesn't exist

---

##### `save(data)`

```javascript
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
```

**Parameters:** `data` - Object with `messages` array

**Purpose:** Upload updated `scheduled.json` to S3

---

##### `getPendingMessages(data)`

```javascript
getPendingMessages(data) {
  const now = new Date().toISOString();
  return data.messages.filter(msg =>
    msg.status === 'pending' &&
    msg.scheduledTime <= now
  );
}
```

**Returns:** Array of messages ready to send

**Logic:**
- `status === "pending"` - Not yet sent/failed
- `scheduledTime <= now` - Time has arrived

---

##### `updateMessageStatus(data, messageId, status, error = null)`

```javascript
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
```

**Parameters:**
- `data` - Full scheduled data object
- `messageId` - Unique message ID
- `status` - "sent" or "failed"
- `error` - Error message (optional, for failed messages)

**Updates:**
- Sets `status` field
- Sets `sentAt` timestamp if status is "sent"
- Adds `error` field if provided

---

## Time Handling

### Timezone: Europe/London (UK)

All time comparisons use **ISO 8601 UTC** format:

```javascript
const now = new Date().toISOString();
// Example: "2025-12-22T22:15:30.123Z"

// Compare with scheduled time
if (msg.scheduledTime <= now) {
  // Message is ready to send
}
```

### Display Format

```javascript
const now = new Date().toLocaleString('en-GB', {
  timeZone: 'Europe/London',
  dateStyle: 'short',
  timeStyle: 'medium'
});
// Output: "22/12/25, 22:15:30"
```

---

## PM2 Deployment

### Starting the Scheduler

```bash
ssh root@5.231.56.146
cd /root/whatsapp-vpslink
pm2 start scheduler.js --name whatsapp-scheduler
pm2 save
```

### Monitoring

```bash
# View status
pm2 status

# View logs (live)
pm2 logs whatsapp-scheduler

# View last 50 lines
pm2 logs whatsapp-scheduler --lines 50 --nostream

# Monitor with dashboard
pm2 monit
```

### Management Commands

```bash
# Restart
pm2 restart whatsapp-scheduler

# Stop
pm2 stop whatsapp-scheduler

# Delete
pm2 delete whatsapp-scheduler

# View detailed info
pm2 show whatsapp-scheduler
```

---

## Error Handling

### WhatsApp Connection Errors

**Conflict Error:**
```
Error: Stream Errored (conflict)
```

**Cause:** Multiple WhatsApp connections (e.g., listener + scheduler)

**Solution:** Only run ONE process connecting to WhatsApp

**Auto-Recovery:** Scheduler auto-reconnects after 5 seconds

---

### S3 Errors

**NoSuchKey:**
- File doesn't exist in S3
- Handled gracefully (creates empty queue)

**AccessDenied:**
- Invalid S3 credentials
- Check `.env` file

**NetworkError:**
- S3 endpoint unreachable
- Check internet connection

---

## Performance

### Metrics

- **Check Interval:** 60 seconds (fixed)
- **S3 Read Time:** ~200-500ms
- **S3 Write Time:** ~300-600ms
- **WhatsApp Send Time:** ~1-2 seconds per message
- **Total Loop Time:** ~3-5 seconds (with messages)

### Resource Usage

- **CPU:** <5%
- **RAM:** ~100MB
- **Network:** ~1KB/minute (idle), ~10KB/minute (active)
- **Disk:** ~150MB (code + auth_info)

---

## Logging

### Log Levels

```
🚀  - Startup
✓   - Success
→   - Information
✗   - Error
!   - Warning
⏰  - Scheduled check
```

### Example Log Output

```
🚀 WhatsApp Scheduler Worker starting...
📅 Timezone: Europe/London (UK)
⏰ Check interval: 60 seconds

✓ Connected to WhatsApp!
✓ Scheduler ready

✓ Loaded 0 scheduled messages from S3
→ No messages to send

⏰ [22/12/25, 22:15:00] Checking for scheduled messages...
✓ Loaded 2 scheduled messages from S3
→ Found 1 message(s) to send
→ Sending: "hi reem. test message" to Reem (447957189696)
✓ Sent message to 447957189696
✓ Saved 2 scheduled messages to S3
```

---

## Environment Variables

Required in `.env` file:

```env
# S3 Configuration
B2_BUCKET=WhatsAppVPS
B2_S3_ENDPOINT=https://s3.eu-central-003.backblazeb2.com
B2_ACCESS_KEY_ID=your_access_key_id
B2_SECRET_ACCESS_KEY=your_secret_access_key
B2_PREFIX=whatsapp/
```

---

## Dependencies

From `package.json`:

```json
{
  "dependencies": {
    "@whiskeysockets/baileys": "^6.x.x",
    "@aws-sdk/client-s3": "^3.x.x",
    "dotenv": "^17.x.x"
  }
}
```

---

## Troubleshooting

### Scheduler Not Sending

**Check 1: PM2 Status**
```bash
pm2 status
```
Ensure `whatsapp-scheduler` is "online"

**Check 2: Logs**
```bash
pm2 logs whatsapp-scheduler --lines 50
```
Look for "✓ Connected to WhatsApp!"

**Check 3: S3 Data**
```bash
# From local machine
node -e "
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
require('dotenv').config();
// ... check scheduled.json
"
```

**Check 4: Time Comparison**
```bash
# On VPS
date -u  # UTC time
# Compare with message scheduledTime
```

---

### High Resource Usage

If CPU/RAM is high:

```bash
# Check process stats
pm2 show whatsapp-scheduler

# Restart
pm2 restart whatsapp-scheduler

# Check for memory leaks
pm2 logs whatsapp-scheduler --err
```

---

## Security Considerations

### Credentials

- ✅ S3 credentials in `.env` (not committed to Git)
- ✅ WhatsApp session in `auth_info/` (not committed)
- ✅ VPS accessible only via SSH key

### Best Practices

- 🔒 Regular S3 credential rotation
- 🔒 UFW firewall enabled on VPS
- 🔒 PM2 running as root (for stability)
- 🔒 Logs rotate automatically (PM2)

---

## Future Improvements

### Potential Enhancements

1. **Retry Logic**
   - Retry failed messages 3 times
   - Exponential backoff

2. **Rate Limiting**
   - Delay between messages
   - Prevent WhatsApp spam detection

3. **Recurring Messages**
   - Daily/weekly schedules
   - Cron-like syntax

4. **Multiple Timezones**
   - Support for multiple regions
   - Auto-detect user timezone

5. **Message Queue**
   - Process messages in batches
   - Priority queue

6. **Webhooks**
   - Notify external API on send
   - Integration with other systems

---

## Code Flow Diagram

```
┌─────────────────────┐
│   Start Process     │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Load .env vars     │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Connect WhatsApp    │
│  (auth_info/)       │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Wait for           │
│  isConnected=true   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Check S3           │
│  (immediate)        │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Schedule Interval  │
│  (every 60s)        │
└──────────┬──────────┘
           │
           ▼
    ┌──────┴──────┐
    │             │
    ▼             ▼
┌────────┐   ┌────────┐
│ Load   │   │ Wait   │
│ S3     │   │ 60s    │
└───┬────┘   └────┬───┘
    │             │
    ▼             │
┌────────┐        │
│Filter  │        │
│Pending │        │
└───┬────┘        │
    │             │
    ▼             │
┌────────┐        │
│ Send   │        │
│Messages│        │
└───┬────┘        │
    │             │
    ▼             │
┌────────┐        │
│Update  │        │
│Status  │        │
└───┬────┘        │
    │             │
    ▼             │
┌────────┐        │
│ Save   │        │
│ to S3  │        │
└───┬────┘        │
    │             │
    └─────────────┘
          │
          └──► Loop forever
```

---

**Last Updated:** December 22, 2025
**Version:** 2.0.0
**Status:** Production
