# Scheduler Service: Technical Documentation

## Overview

The **Scheduler Service** is a 24/7 background worker that polls S3 cloud storage every 60 seconds, finds pending scheduled messages, and sends them via WhatsApp at the specified time. It runs on the Doodah VPS (5.231.56.146) and is managed by PM2.

**Status:** ✅ Fully operational since December 23, 2025
**Location:** `/root/whatsapp-vpslink/scheduler.js` (Doodah VPS)
**Process:** whatsapp-scheduler (PM2)
**Polling Interval:** 60 seconds
**Uptime:** 24/7

---

## Architecture

### System Diagram

```
┌────────────────────────────────────────────┐
│       Doodah VPS (5.231.56.146)            │
│                                             │
│  ┌──────────────────────────────────────┐  │
│  │   PM2 Process: whatsapp-scheduler    │  │
│  │   Script: scheduler.js               │  │
│  │   Auto-restart: Enabled              │  │
│  └──────────────────────────────────────┘  │
│                    │                        │
│                    │ Every 60 seconds       │
│                    ▼                        │
│  ┌──────────────────────────────────────┐  │
│  │  Main Loop: checkAndSendMessages()   │  │
│  │                                       │  │
│  │  1. Load scheduled.json from S3      │  │
│  │  2. Filter pending messages          │  │
│  │  3. Send via WhatsApp                │  │
│  │  4. Update status                    │  │
│  │  5. Save to S3                       │  │
│  └──────────────────────────────────────┘  │
│                    │                        │
│                    │ WhatsApp connection    │
│                    ▼                        │
│  ┌──────────────────────────────────────┐  │
│  │   Baileys WhatsApp Socket            │  │
│  │   Session: auth_info/ (886 files)    │  │
│  │   Auto-reconnect: Enabled            │  │
│  └──────────────────────────────────────┘  │
└────────────────────────────────────────────┘
                     │
                     │ S3 API calls
                     ▼
┌────────────────────────────────────────────┐
│   Backblaze B2 S3 (WhatsAppVPS bucket)     │
│                                             │
│   whatsapp/scheduled.json                  │
│   - Read pending messages                  │
│   - Write sent/failed status               │
└────────────────────────────────────────────┘
                     │
                     │ WhatsApp Web Protocol
                     ▼
┌────────────────────────────────────────────┐
│         WhatsApp Servers                   │
│         (Message delivery)                 │
└────────────────────────────────────────────┘
```

---

## Scheduler Implementation

### Main Loop

```javascript
// scheduler.js (Doodah VPS: /root/whatsapp-vpslink/scheduler.js)

// Import dependencies
const { makeWASocket, useMultiFileAuthState, Browsers } = require('@whiskeysockets/baileys');
const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
require('dotenv').config();

// S3 client setup
const s3Client = new S3Client({
    endpoint: process.env.B2_S3_ENDPOINT,
    region: 'eu-central-003',
    credentials: {
        accessKeyId: process.env.B2_ACCESS_KEY_ID,
        secretAccessKey: process.env.B2_SECRET_ACCESS_KEY
    }
});

// Global WhatsApp socket
let sock;

// Main initialization
async function init() {
    console.log('🚀 WhatsApp Scheduler Worker starting...');
    console.log('📅 Timezone: Europe/London (UK)');
    console.log('⏰ Check interval: 60 seconds\n');

    // Connect to WhatsApp
    sock = await connectToWhatsApp();

    // Start scheduler loop
    setInterval(async () => {
        try {
            await checkAndSendMessages();
        } catch (error) {
            console.error('❌ Error in scheduler loop:', error);
        }
    }, 60000);  // Every 60 seconds

    console.log('✓ Scheduler ready\n');
}

init();
```

### WhatsApp Connection

```javascript
async function connectToWhatsApp() {
    // Load session from auth_info/
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    // Create WhatsApp socket
    const sock = makeWASocket({
        auth: state,
        browser: Browsers.macOS('Desktop'),
        syncFullHistory: false,  // Don't sync history (scheduler only sends)
        connectTimeoutMs: 120000,
        defaultQueryTimeoutMs: 120000,
        printQRInTerminal: false  // No QR (session already exists)
    });

    // Save credentials when updated
    sock.ev.on('creds.update', saveCreds);

    // Connection event handler
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'open') {
            console.log('✓ Connected to WhatsApp!');
        } else if (connection === 'close') {
            const shouldReconnect =
                lastDisconnect?.error?.output?.statusCode !== 401;  // Not logged out

            if (shouldReconnect) {
                console.log('🔄 Reconnecting to WhatsApp...');
                setTimeout(() => {
                    connectToWhatsApp().then(newSock => {
                        sock = newSock;
                    });
                }, 5000);
            } else {
                console.error('❌ WhatsApp logged out. Please re-authenticate.');
                process.exit(1);
            }
        }
    });

    return sock;
}
```

### Message Checking & Sending

```javascript
async function checkAndSendMessages() {
    const now = new Date();
    const timestamp = now.toLocaleString('en-GB', {
        timeZone: 'Europe/London',
        hour12: false
    });

    console.log(`⏰ [${timestamp}] Checking for scheduled messages...`);

    // 1. Load scheduled messages from S3
    const data = await loadScheduledFromS3();
    if (!data || !data.messages) {
        console.log('→ No scheduled messages found\n');
        return;
    }

    console.log(`✓ Loaded ${data.messages.length} scheduled messages from S3`);

    // 2. Filter messages that should be sent now
    const currentTime = new Date().toISOString();
    const toSend = data.messages.filter(msg =>
        msg.status === 'pending' &&
        msg.scheduledTime <= currentTime
    );

    if (toSend.length === 0) {
        console.log('→ No messages to send\n');
        return;
    }

    console.log(`→ Found ${toSend.length} message(s) to send`);

    // 3. Send each message
    for (const msg of toSend) {
        console.log(`→ Sending: "${msg.message}" to ${msg.contactName} (${msg.to})`);

        const success = await sendMessage(msg.to, msg.message);

        if (success) {
            msg.status = 'sent';
            msg.sentAt = new Date().toISOString();
            console.log(`✓ Sent message to ${msg.to}`);
        } else {
            msg.status = 'failed';
            msg.error = 'Failed to send via WhatsApp';
            console.error(`❌ Failed to send message to ${msg.to}`);
        }
    }

    // 4. Save updated messages to S3
    await saveScheduledToS3(data);
    console.log(`✓ Saved ${data.messages.length} scheduled messages to S3\n`);
}
```

### Sending Messages

```javascript
async function sendMessage(phoneNumber, message) {
    try {
        // Format phone number as JID
        const jid = phoneNumber.includes('@')
            ? phoneNumber
            : phoneNumber + '@s.whatsapp.net';

        // Send message via WhatsApp
        await sock.sendMessage(jid, { text: message });

        return true;
    } catch (error) {
        console.error(`Error sending message:`, error.message);
        return false;
    }
}
```

### S3 Operations

```javascript
// Load scheduled messages from S3
async function loadScheduledFromS3() {
    try {
        const command = new GetObjectCommand({
            Bucket: process.env.B2_BUCKET,
            Key: `${process.env.B2_PREFIX}scheduled.json`
        });

        const response = await s3Client.send(command);
        const bodyString = await streamToString(response.Body);
        return JSON.parse(bodyString);
    } catch (error) {
        if (error.name === 'NoSuchKey') {
            return { messages: [] };  // File doesn't exist yet
        }
        throw error;
    }
}

// Save scheduled messages to S3
async function saveScheduledToS3(data) {
    const command = new PutObjectCommand({
        Bucket: process.env.B2_BUCKET,
        Key: `${process.env.B2_PREFIX}scheduled.json`,
        Body: JSON.stringify(data, null, 2),
        ContentType: 'application/json'
    });

    await s3Client.send(command);
}

// Helper: Convert stream to string
async function streamToString(stream) {
    const chunks = [];
    return new Promise((resolve, reject) => {
        stream.on('data', chunk => chunks.push(Buffer.from(chunk)));
        stream.on('error', reject);
        stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    });
}
```

---

## Scheduler Logic Flow

### Detailed Step-by-Step

```
┌─────────────────────────────────────────────────┐
│ 1. Timer Trigger (Every 60 seconds)            │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│ 2. Load scheduled.json from S3                  │
│    - Bucket: WhatsAppVPS                        │
│    - Key: whatsapp/scheduled.json               │
│    - Parse JSON                                 │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│ 3. Filter Messages                              │
│                                                 │
│    currentTime = new Date().toISOString()       │
│                                                 │
│    toSend = messages.filter(msg =>              │
│        msg.status === 'pending' &&              │
│        msg.scheduledTime <= currentTime         │
│    )                                            │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
         ┌───────┴───────┐
         │ toSend.length │
         └───────┬───────┘
                 │
        ┌────────┴─────────┐
        │                  │
        ▼                  ▼
    === 0              > 0
        │                  │
        │                  │
        ▼                  ▼
┌───────────────┐  ┌──────────────────────────────┐
│ Log: No msgs  │  │ 4. For Each Message to Send  │
│ to send       │  │                               │
│               │  │    a. Format JID              │
│ Exit          │  │    b. Send via WhatsApp       │
└───────────────┘  │    c. Update status           │
                   │       - success → 'sent'      │
                   │       - failure → 'failed'    │
                   │    d. Set sentAt/error        │
                   └───────────┬──────────────────┘
                               │
                               ▼
                   ┌─────────────────────────────┐
                   │ 5. Save updated messages    │
                   │    back to S3               │
                   │                             │
                   │    - All status changes     │
                   │    - sentAt timestamps      │
                   │    - Error messages         │
                   └───────────┬─────────────────┘
                               │
                               ▼
                   ┌─────────────────────────────┐
                   │ 6. Wait 60 seconds          │
                   │    (setInterval)            │
                   └───────────┬─────────────────┘
                               │
                               │ Loop back to step 1
                               ▼
```

---

## Timezone Handling

### UTC Standardization

**All times stored in UTC (ISO8601):**

```javascript
// Example scheduled message
{
  "scheduledTime": "2025-12-24T10:00:00.000Z",  // UTC
  "createdAt": "2025-12-23T14:30:00.123Z",       // UTC
  "sentAt": "2025-12-24T10:00:05.789Z"           // UTC
}
```

### Time Comparison

```javascript
// Current time in UTC
const currentTime = new Date().toISOString();
// "2025-12-24T10:00:05.000Z"

// Scheduled time in UTC
const scheduledTime = "2025-12-24T10:00:00.000Z";

// String comparison works because ISO8601 is sortable
if (scheduledTime <= currentTime) {
    // Time to send!
}
```

### Display Time (Logging)

```javascript
// Log in UK timezone for human readability
const timestamp = new Date().toLocaleString('en-GB', {
    timeZone: 'Europe/London',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
});
// "24/12/2025, 10:00:05"

console.log(`⏰ [${timestamp}] Checking for scheduled messages...`);
```

---

## PM2 Process Management

### Starting the Scheduler

```bash
# SSH into Doodah VPS
ssh root@5.231.56.146

# Navigate to project directory
cd /root/whatsapp-vpslink

# Start scheduler with PM2
pm2 start scheduler.js --name whatsapp-scheduler

# Save PM2 process list (persist across reboots)
pm2 save

# Enable PM2 startup script
pm2 startup
```

### Monitoring

```bash
# View all PM2 processes
pm2 status

# Output:
# ┌────┬────────────────────────┬──────────┬──────┬───────────┬──────────┐
# │ id │ name                   │ mode     │ ↺    │ status    │ cpu      │
# ├────┼────────────────────────┼──────────┼──────┼───────────┼──────────┤
# │ 0  │ whatsapp-scheduler     │ fork     │ 0    │ online    │ 2.3%     │
# └────┴────────────────────────┴──────────┴──────┴───────────┴──────────┘

# View live logs
pm2 logs whatsapp-scheduler

# View last 100 lines
pm2 logs whatsapp-scheduler --lines 100

# View logs with timestamp
pm2 logs whatsapp-scheduler --timestamp

# Real-time monitoring dashboard
pm2 monit
```

### Process Control

```bash
# Restart scheduler
pm2 restart whatsapp-scheduler

# Stop scheduler
pm2 stop whatsapp-scheduler

# Delete from PM2
pm2 delete whatsapp-scheduler

# View detailed process info
pm2 show whatsapp-scheduler

# Flush logs
pm2 flush
```

### Auto-Restart Configuration

**PM2 automatically restarts on:**
- Process crash
- Unhandled exception
- Out of memory
- Server reboot (if `pm2 startup` configured)

**Restart Limits:**
```bash
# Limit restarts to prevent crash loop
pm2 start scheduler.js --name whatsapp-scheduler \
    --max-restarts 10 \
    --min-uptime 10000  # Min 10s uptime before considering stable
```

---

## Logging

### Log Format

```
🚀 WhatsApp Scheduler Worker starting...
📅 Timezone: Europe/London (UK)
⏰ Check interval: 60 seconds

✓ Connected to WhatsApp!
✓ Scheduler ready

⏰ [24/12/2025, 10:00:00] Checking for scheduled messages...
✓ Loaded 3 scheduled messages from S3
→ Found 1 message(s) to send
→ Sending: "Happy Birthday! 🎂" to Reem (447957189696)
✓ Sent message to 447957189696
✓ Saved 3 scheduled messages to S3

⏰ [24/12/2025, 10:01:00] Checking for scheduled messages...
✓ Loaded 3 scheduled messages from S3
→ No messages to send

⏰ [24/12/2025, 10:02:00] Checking for scheduled messages...
✓ Loaded 3 scheduled messages from S3
→ No messages to send
```

### Log Levels

**Info (Standard):**
```javascript
console.log('✓ Loaded 3 scheduled messages from S3');
console.log('→ Found 1 message(s) to send');
console.log('✓ Sent message to 447957189696');
```

**Warnings:**
```javascript
console.warn('⚠️ WhatsApp connection unstable, retrying...');
console.warn('⚠️ S3 request throttled, backing off...');
```

**Errors:**
```javascript
console.error('❌ Failed to send message to 447950724774');
console.error('❌ WhatsApp logged out. Please re-authenticate.');
console.error('❌ Error in scheduler loop:', error);
```

### Log Storage

**PM2 Log Files:**
```bash
# Default location
~/.pm2/logs/

# Scheduler logs
~/.pm2/logs/whatsapp-scheduler-out.log   # stdout
~/.pm2/logs/whatsapp-scheduler-error.log # stderr
```

**Log Rotation:**
```bash
# Install PM2 log rotation module
pm2 install pm2-logrotate

# Configure rotation
pm2 set pm2-logrotate:max_size 10M      # Max 10MB per file
pm2 set pm2-logrotate:retain 7          # Keep 7 rotated files
pm2 set pm2-logrotate:compress true     # Compress old logs
```

---

## Error Handling

### Connection Errors

```javascript
sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;

        switch (statusCode) {
            case 401:  // Logged out
                console.error('❌ WhatsApp logged out. Re-authenticate required.');
                process.exit(1);
                break;

            case 403:  // Banned
                console.error('❌ WhatsApp account banned.');
                process.exit(1);
                break;

            case 408:  // Timeout
            case 500:  // Server error
            default:
                console.log('🔄 Connection lost. Reconnecting in 5s...');
                setTimeout(() => {
                    connectToWhatsApp().then(newSock => {
                        sock = newSock;
                    });
                }, 5000);
                break;
        }
    }
});
```

### S3 Errors

```javascript
try {
    const data = await loadScheduledFromS3();
} catch (error) {
    if (error.name === 'NoSuchKey') {
        // File doesn't exist (first run)
        console.log('ℹ️ No scheduled.json found, creating new file');
        return { messages: [] };
    } else if (error.name === 'NetworkingError') {
        // Internet connection lost
        console.error('❌ Network error: Cannot connect to S3');
        return null;
    } else if (error.name === 'InvalidAccessKeyId') {
        // Wrong S3 credentials
        console.error('❌ Invalid S3 credentials in .env');
        process.exit(1);
    } else {
        // Unknown error
        console.error('❌ S3 error:', error);
        throw error;
    }
}
```

### Message Send Errors

```javascript
async function sendMessage(phoneNumber, message) {
    try {
        const jid = phoneNumber.includes('@')
            ? phoneNumber
            : phoneNumber + '@s.whatsapp.net';

        await sock.sendMessage(jid, { text: message });
        return true;

    } catch (error) {
        // Log specific error type
        if (error.message.includes('not-authorized')) {
            console.error('❌ Session expired. Re-scan QR code.');
        } else if (error.message.includes('recipient-not-found')) {
            console.error(`❌ Invalid phone number: ${phoneNumber}`);
        } else if (error.message.includes('rate-limit')) {
            console.error('❌ Rate limit exceeded. Slow down.');
        } else {
            console.error(`❌ Send error: ${error.message}`);
        }

        return false;
    }
}
```

### Graceful Shutdown

```javascript
// Handle SIGTERM (PM2 stop/restart)
process.on('SIGTERM', async () => {
    console.log('\n🛑 Received SIGTERM. Shutting down gracefully...');

    // Close WhatsApp connection
    if (sock) {
        sock.end();
    }

    // Exit cleanly
    process.exit(0);
});

// Handle SIGINT (Ctrl+C)
process.on('SIGINT', async () => {
    console.log('\n🛑 Received SIGINT. Shutting down gracefully...');

    if (sock) {
        sock.end();
    }

    process.exit(0);
});
```

---

## Performance Optimization

### Polling Interval

**Current:** 60 seconds

**Trade-offs:**

| Interval | Pros | Cons |
|----------|------|------|
| 10s | ✅ Near real-time delivery | ❌ High S3 API costs<br>❌ Increased CPU usage |
| 30s | ✅ Good responsiveness<br>✅ Lower costs | ⚠️ Up to 30s delay |
| 60s | ✅ Low S3 costs<br>✅ Low CPU usage | ⚠️ Up to 60s delay |
| 120s | ✅ Very low costs | ❌ Up to 2min delay |

**Recommendation:** 60s is optimal for non-time-critical scheduling

### S3 Request Optimization

**Conditional Reads (Future):**
```javascript
// Use ETag to avoid downloading unchanged files
const command = new GetObjectCommand({
    Bucket: process.env.B2_BUCKET,
    Key: `${process.env.B2_PREFIX}scheduled.json`,
    IfNoneMatch: lastETag  // Only download if changed
});
```

**Gzip Compression:**
```javascript
// Compress large files
const command = new PutObjectCommand({
    Bucket: process.env.B2_BUCKET,
    Key: `${process.env.B2_PREFIX}scheduled.json`,
    Body: gzipSync(JSON.stringify(data)),
    ContentEncoding: 'gzip',
    ContentType: 'application/json'
});
```

---

## Health Monitoring

### Health Check API

**Endpoint:** http://5.231.56.146:3002/health

**Implementation:** See `health.js` documentation

**Monitored Metrics:**
1. **Scheduler Process Status** - PM2 running/stopped
2. **WhatsApp Session Health** - Session file age
3. **Recent Activity** - Log entries in last 50 lines

### Monitoring Integration

**Uptime Monitoring:**
```bash
# Ping health endpoint every 5 minutes
*/5 * * * * curl -f http://5.231.56.146:3002/health || echo "Scheduler down"
```

**External Services:**
- UptimeRobot (free tier)
- Pingdom
- StatusCake
- Custom monitoring script

---

## Deployment

### Initial Deployment

```bash
# 1. SSH to Doodah VPS
ssh root@5.231.56.146

# 2. Clone/upload code
cd /root
git clone https://github.com/yourusername/whatsapp-vpslink.git
cd whatsapp-vpslink

# 3. Install dependencies
npm install

# 4. Copy environment variables
cp .env.example .env
nano .env  # Edit with S3 credentials

# 5. Copy auth_info/ from another server
scp -r user@other-server:/path/to/auth_info/ ./

# 6. Start scheduler
pm2 start scheduler.js --name whatsapp-scheduler

# 7. Save PM2 state
pm2 save

# 8. Enable auto-start on boot
pm2 startup
# Run the command it prints

# 9. Check status
pm2 status
pm2 logs whatsapp-scheduler
```

### Updates

```bash
# 1. SSH to Doodah VPS
ssh root@5.231.56.146
cd /root/whatsapp-vpslink

# 2. Pull latest code
git pull origin main

# 3. Install any new dependencies
npm install

# 4. Restart scheduler
pm2 restart whatsapp-scheduler

# 5. Monitor logs
pm2 logs whatsapp-scheduler
```

---

## Troubleshooting

### Scheduler Not Sending Messages

**Checklist:**
1. ✅ Is PM2 process running? `pm2 status`
2. ✅ Is WhatsApp connected? `pm2 logs whatsapp-scheduler | grep "Connected"`
3. ✅ Are messages in S3? Check `scheduled.json` has `status: "pending"`
4. ✅ Is scheduledTime in the past? Compare with current UTC time
5. ✅ Are S3 credentials valid? Test with `aws s3 ls s3://WhatsAppVPS/whatsapp/`

### WhatsApp Connection Lost

**Solution:**
```bash
# Check logs
pm2 logs whatsapp-scheduler | grep "close"

# If logged out:
# 1. Delete auth_info/
rm -rf /root/whatsapp-vpslink/auth_info

# 2. Re-authenticate on main machine
node wa.js listen  # Scan QR code

# 3. Copy auth_info/ to Doodah VPS
scp -r ./auth_info/ root@5.231.56.146:/root/whatsapp-vpslink/

# 4. Restart scheduler
pm2 restart whatsapp-scheduler
```

### High Memory Usage

```bash
# Check memory
pm2 show whatsapp-scheduler

# Restart to clear memory
pm2 restart whatsapp-scheduler

# Set memory limit (auto-restart if exceeded)
pm2 start scheduler.js --name whatsapp-scheduler --max-memory-restart 300M
```

---

## File References

**Main Scheduler Code:**
- `/root/whatsapp-vpslink/scheduler.js` (Doodah VPS)

**Configuration:**
- `/root/whatsapp-vpslink/.env` (S3 credentials)
- `/root/whatsapp-vpslink/auth_info/` (WhatsApp session)

**Logs:**
- `~/.pm2/logs/whatsapp-scheduler-out.log`
- `~/.pm2/logs/whatsapp-scheduler-error.log`

**Related Documentation:**
- `/Users/saadi/Documents/GitHub/WhatsApp-VPSLink/docs/architecture/SCHEDULER.md`
- `/Users/saadi/Documents/GitHub/WhatsApp-VPSLink/docs/troubleshooting/WHY_CHRIS_MESSAGE_DIDNT_SEND.md`

---

## Summary

The Scheduler Service is a robust, 24/7 background worker that polls S3 every 60 seconds to send scheduled WhatsApp messages. It uses PM2 for process management, Baileys for WhatsApp connectivity, and S3 for cross-VPS communication. The service includes automatic reconnection, comprehensive error handling, and detailed logging for monitoring and troubleshooting.
