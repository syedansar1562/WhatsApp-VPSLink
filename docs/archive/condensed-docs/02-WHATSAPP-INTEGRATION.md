# WhatsApp Integration: Technical Deep Dive

## Overview

WhatsApp-VPSLink uses the **Baileys** library (@whiskeysockets/baileys v7.0.0-rc.9) to interface with WhatsApp Web. This is an unofficial, reverse-engineered implementation of the WhatsApp Web API that connects using the same protocol as the official web client.

**Important:** This is NOT the official WhatsApp Business API. It's a client-side implementation that mimics the WhatsApp Web browser interface.

---

## Baileys Library

### What is Baileys?

Baileys is a lightweight, TypeScript-based WhatsApp Web API implementation that:
- Connects to WhatsApp servers using WebSocket
- Implements end-to-end encryption (Signal Protocol)
- Supports multi-device mode
- Maintains session persistence
- Handles message sync and history
- No official API key required

**GitHub:** https://github.com/WhiskeySockets/Baileys
**Version Used:** 7.0.0-rc.9 (Release Candidate)

### Why Baileys?

**Pros:**
✅ Free (no API costs)
✅ No approval process (unlike WhatsApp Business API)
✅ Full WhatsApp Web feature parity
✅ Multi-device support
✅ Active development and community
✅ TypeScript support
✅ Session persistence

**Cons:**
❌ Unofficial (not supported by Meta/WhatsApp)
❌ Potential for breaking changes if WhatsApp protocol changes
❌ Rate limiting (WhatsApp may ban if used improperly)
❌ No business features (like message templates with variables)
❌ Relies on reverse-engineering

---

## Authentication Flow

### Initial Setup (First Time)

```javascript
// wa.js:128-145
async function connectToWhatsApp() {
    // Load or create session
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    // Create WhatsApp socket
    const sock = makeWASocket({
        auth: state,
        browser: Browsers.macOS('Desktop'),
        syncFullHistory: true,
        connectTimeoutMs: 120000,
        defaultQueryTimeoutMs: 120000,
        printQRInTerminal: true
    });

    // Save credentials when updated
    sock.ev.on('creds.update', saveCreds);

    return sock;
}
```

**Step-by-Step Process:**

1. **First Run** (no existing session):
```bash
$ node wa.js listen
🔄 Connecting to WhatsApp...
📱 Scan this QR code with WhatsApp:

█████████████████████████████
█████████████████████████████
███ ▄▄▄▄▄ █▀ █▀▀██ ▄▄▄▄▄ ███
███ █   █ █▀ ▀ ▄▄█ █   █ ███
███ █▄▄▄█ ██▀▀▄ ▀█ █▄▄▄█ ███
█████████████████████████████

Open WhatsApp on your phone
→ Settings → Linked Devices
→ Link a Device → Scan QR code
```

2. **QR Code Scanned:**
- WhatsApp app sends credentials to web client
- Baileys receives and saves session data
- Connection established

3. **Session Saved:**
```
auth_info/
├── creds.json              # Main credentials (1.5KB)
├── app-state-sync-key-*.json   # 80+ sync keys
├── pre-key-*.json          # 800+ encryption keys
└── session-*.json          # 20+ session files
```

4. **Subsequent Runs:**
- Baileys loads session from `auth_info/`
- No QR code needed
- Instant connection

### Session Persistence

**Storage:** `auth_info/` directory (886 files total)

**Key Files:**

1. **creds.json** - Core Authentication
```json
{
  "noiseKey": {
    "private": "base64-encoded-key",
    "public": "base64-encoded-key"
  },
  "signedIdentityKey": {
    "private": "base64-encoded-key",
    "public": "base64-encoded-key"
  },
  "signedPreKey": {
    "keyPair": { ... },
    "keyId": 1234567
  },
  "registrationId": 1234567,
  "advSecretKey": "base64-encoded-key",
  "me": {
    "id": "447123456789:1@s.whatsapp.net",
    "name": "Saadi"
  },
  "account": {
    "details": "base64-encoded-account-data"
  }
}
```

2. **app-state-sync-key-*.json** - State Sync Keys
- Critical/regular/low importance keys
- Used for syncing app state across devices
- ~80 files total

3. **pre-key-*.json** - Pre-keys for Encryption
- Signal Protocol pre-keys
- Used for establishing encrypted sessions
- ~800 files total
- Format: `pre-key-1.json`, `pre-key-2.json`, etc.

4. **session-*.json** - Device Sessions
- Encrypted session data for each chat/device
- ~20 files
- Format: `session-447950724774.0.json`

**Session Lifespan:**
- Sessions persist indefinitely (until logged out)
- No need to re-authenticate unless:
  - Session manually deleted
  - WhatsApp account logged out from phone
  - Multi-device limit reached (max 4 linked devices)

---

## Connection Management

### Socket Connection

```javascript
// wa.js:128
const sock = makeWASocket({
    auth: state,
    browser: Browsers.macOS('Desktop'),  // Browser identity
    syncFullHistory: true,                // Sync all message history
    connectTimeoutMs: 120000,             // 2 minute connection timeout
    defaultQueryTimeoutMs: 120000,        // 2 minute query timeout
    printQRInTerminal: true               // Show QR in CLI
});
```

**Connection Parameters Explained:**

| Parameter | Value | Purpose |
|-----------|-------|---------|
| `auth` | Session state | Loaded from auth_info/ |
| `browser` | macOS Desktop | Identifies as macOS WhatsApp Web |
| `syncFullHistory` | true | Download all message history on connect |
| `connectTimeoutMs` | 120000 | Max time to establish connection (2 min) |
| `defaultQueryTimeoutMs` | 120000 | Max time for queries to complete |
| `printQRInTerminal` | true | Display QR code in terminal (first time) |

### Connection Events

```javascript
// wa.js:170-193
sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
        // QR code available (first time setup)
        console.log('📱 Scan this QR code with WhatsApp:');
        qrcode.generate(qr, { small: true });
    } else if (connection === 'open') {
        // Connected successfully
        console.log('✓ Connected to WhatsApp!');
        isConnected = true;
    } else if (connection === 'close') {
        // Disconnected
        const shouldReconnect =
            lastDisconnect?.error?.output?.statusCode !==
            DisconnectReason.loggedOut;

        if (shouldReconnect) {
            console.log('🔄 Reconnecting in 5 seconds...');
            setTimeout(() => connectToWhatsApp(), 5000);
        } else {
            console.log('❌ Logged out. Delete auth_info/ and restart.');
        }
    }
});
```

**Connection States:**

1. **`connecting`** - Establishing connection
2. **`open`** - Connected and ready
3. **`close`** - Disconnected

**Disconnect Reasons:**

| Reason | Code | Should Reconnect? | Action |
|--------|------|-------------------|--------|
| Network error | 500 | ✅ Yes | Auto-reconnect after 5s |
| Timeout | 408 | ✅ Yes | Auto-reconnect after 5s |
| Logged out | 401 | ❌ No | Delete auth_info/ and re-scan QR |
| Banned | 403 | ❌ No | Use different number |
| Protocol change | Various | ⚠️ Maybe | Update Baileys version |

### Auto-Reconnection

**Implementation:**
```javascript
// scheduler.js (Doodah VPS)
async function init() {
    while (true) {
        try {
            const sock = await connectToWhatsApp();
            await schedulerLoop(sock);
        } catch (error) {
            console.error('❌ Scheduler error:', error);
            console.log('🔄 Restarting in 10 seconds...');
            await new Promise(resolve => setTimeout(resolve, 10000));
        }
    }
}
```

**Features:**
- Automatic reconnection on disconnect
- 5-10 second delay between reconnection attempts
- Infinite retry loop
- Maintains connection 24/7

---

## Message Event Listeners

### Event Types

Baileys emits several message-related events:

1. **`messaging-history.set`** - Initial message history sync
2. **`messages.set`** - Additional message sets
3. **`messages.upsert`** - New/updated messages (real-time)
4. **`contacts.update`** - Contact information updates

### 1. messaging-history.set

**Purpose:** Sync initial message history when connecting

```javascript
// wa.js:199-214
sock.ev.on('messaging-history.set', ({ chats, messages, isLatest }) => {
    console.log(`Received ${messages.length} messages from ${chats.length} chats`);

    messages.forEach(msg => {
        const jid = msg.key.remoteJid;
        const text = extractMessageText(msg.message);
        const timestamp = msg.messageTimestamp;
        const isFromMe = msg.key.fromMe;

        if (text) {
            chatStore.addMessage(jid, text, timestamp, isFromMe,
                                 getMessageType(msg.message), msg);
        }
    });

    if (isLatest) {
        console.log('✓ History sync complete');
    }
});
```

**When it fires:**
- On first connection after QR scan
- When `syncFullHistory: true` is set
- Syncs messages from last 90 days (WhatsApp default)

**Data structure:**
```javascript
{
  chats: [
    {
      id: "447950724774@s.whatsapp.net",
      conversationTimestamp: 1766427969,
      unreadCount: 2
    }
  ],
  messages: [
    {
      key: {
        remoteJid: "447950724774@s.whatsapp.net",
        fromMe: false,
        id: "3EB0C1234567890ABCDEF"
      },
      message: {
        conversation: "Hey, how are you?"
      },
      messageTimestamp: 1766427969,
      status: "SERVER_ACK"
    }
  ],
  isLatest: true
}
```

### 2. messages.upsert

**Purpose:** Capture new messages in real-time

```javascript
// wa.js:237-268
sock.ev.on('messages.upsert', (m) => {
    // m.type can be: 'notify', 'append', 'prepend'
    console.log(`Received ${m.messages.length} messages (type: ${m.type})`);

    m.messages.forEach(msg => {
        const jid = msg.key.remoteJid;
        const text = extractMessageText(msg.message);
        const timestamp = msg.messageTimestamp;
        const isFromMe = msg.key.fromMe;

        if (text) {
            chatStore.addMessage(jid, text, timestamp, isFromMe,
                                 getMessageType(msg.message), msg);
        }
    });
});
```

**Message Types:**

| Type | When it Fires | Use Case |
|------|---------------|----------|
| `notify` | Real-time message received | New incoming message |
| `append` | Offline messages synced | Messages received while offline |
| `prepend` | Historical messages | Loading older messages |

**Message Structure:**
```javascript
{
  type: "notify",
  messages: [
    {
      key: {
        remoteJid: "447950724774@s.whatsapp.net",
        fromMe: false,
        id: "3EB0C1234567890ABCDEF",
        participant: undefined  // Set for group messages
      },
      message: {
        conversation: "Hello!"  // Text message
        // OR
        imageMessage: { ... }   // Image
        // OR
        videoMessage: { ... }   // Video
        // OR
        audioMessage: { ... }   // Audio/Voice
        // OR
        documentMessage: { ... }  // Document
      },
      messageTimestamp: 1766427969,
      pushName: "Nick",
      status: "SERVER_ACK"
    }
  ]
}
```

### 3. contacts.update

**Purpose:** Update contact names when changed on phone

```javascript
// wa.js:216-235
sock.ev.on('contacts.update', (contacts) => {
    console.log(`Received ${contacts.length} contact updates`);

    contacts.forEach(contact => {
        const jid = contact.id;
        const name = contact.notify || contact.name ||
                     jid.split('@')[0];

        chatStore.setName(jid, name);
    });
});
```

**Contact Structure:**
```javascript
{
  id: "447950724774@s.whatsapp.net",
  notify: "Nick Smith",  // Display name
  name: "Nick",          // Contact name on phone
  verifiedName: null
}
```

---

## Message Parsing

### Extracting Message Text

```javascript
// wa.js:52-81
function extractMessageText(message) {
    if (!message) return null;

    // Text message
    if (message.conversation) {
        return message.conversation;
    }

    // Extended text (with preview/links)
    if (message.extendedTextMessage?.text) {
        return message.extendedTextMessage.text;
    }

    // Image with caption
    if (message.imageMessage?.caption) {
        return `[Image] ${message.imageMessage.caption}`;
    }

    // Video with caption
    if (message.videoMessage?.caption) {
        return `[Video] ${message.videoMessage.caption}`;
    }

    // Document
    if (message.documentMessage) {
        return `[Document: ${message.documentMessage.fileName}]`;
    }

    // Audio/Voice
    if (message.audioMessage) {
        return message.audioMessage.ptt ? '[Voice Note]' : '[Audio]';
    }

    // Contact card
    if (message.contactMessage) {
        return `[Contact: ${message.contactMessage.displayName}]`;
    }

    return '[Unknown Message Type]';
}
```

### Message Types

```javascript
// wa.js:83-96
function getMessageType(message) {
    if (!message) return 'other';
    if (message.conversation || message.extendedTextMessage) return 'text';
    if (message.imageMessage) return 'image';
    if (message.videoMessage) return 'video';
    if (message.audioMessage) return 'audio';
    if (message.documentMessage) return 'document';
    return 'other';
}
```

**Supported Types:**
- `text` - Regular text messages
- `image` - Image messages (with optional caption)
- `video` - Video messages (with optional caption)
- `audio` - Audio files and voice notes
- `document` - PDF, Word, Excel, etc.
- `other` - Stickers, locations, contacts, polls, etc.

---

## Sending Messages

### Basic Text Message

```javascript
// scheduler.js (Doodah VPS)
async function sendMessage(phoneNumber, message) {
    try {
        // Format phone number as JID
        const jid = phoneNumber.includes('@')
            ? phoneNumber
            : phoneNumber + '@s.whatsapp.net';

        // Send message
        await sock.sendMessage(jid, { text: message });

        console.log(`✓ Sent message to ${phoneNumber}`);
        return true;
    } catch (error) {
        console.error(`❌ Failed to send to ${phoneNumber}:`, error);
        return false;
    }
}
```

### JID Format

**JID (Jabber ID):** WhatsApp's internal identifier format

**Formats:**
- Personal chats: `447950724774@s.whatsapp.net`
- Group chats: `123456789-1234567890@g.us`
- Broadcast lists: `123456789-1234567890@broadcast`

**Conversion:**
```javascript
// Phone number → JID
const jid = phoneNumber + '@s.whatsapp.net';

// JID → Phone number
const phoneNumber = jid.split('@')[0];
```

### Message Options

```javascript
// Text message
await sock.sendMessage(jid, {
    text: "Hello!"
});

// Text with mentions
await sock.sendMessage(jid, {
    text: "Hey @447950724774!",
    mentions: ["447950724774@s.whatsapp.net"]
});

// Reply to message
await sock.sendMessage(jid, {
    text: "Thanks!",
    quoted: originalMessage  // Message object to reply to
});

// Send image
await sock.sendMessage(jid, {
    image: { url: "https://example.com/image.jpg" },
    caption: "Check this out!"
});

// Send document
await sock.sendMessage(jid, {
    document: { url: "https://example.com/doc.pdf" },
    mimetype: "application/pdf",
    fileName: "document.pdf"
});
```

---

## Media Handling

### Downloading Media

```javascript
// wa.js:443-510
async function downloadMedia(contact, type = 'all', count = 10) {
    const chat = findChat(contact);
    if (!chat) {
        console.log(`❌ Chat not found for ${contact}`);
        return;
    }

    const mediaMessages = chat.messages.filter(msg => {
        if (type === 'voice') return msg.messageType === 'audio' &&
                                       msg.rawMessage?.message?.audioMessage?.ptt;
        if (type === 'audio') return msg.messageType === 'audio' &&
                                       !msg.rawMessage?.message?.audioMessage?.ptt;
        if (type === 'image') return msg.messageType === 'image';
        if (type === 'video') return msg.messageType === 'video';
        if (type === 'document') return msg.messageType === 'document';
        return ['audio', 'image', 'video', 'document'].includes(msg.messageType);
    });

    const toDownload = mediaMessages.slice(0, count);

    for (const msg of toDownload) {
        try {
            const buffer = await downloadMediaMessage(
                msg.rawMessage,
                'buffer',
                {},
                {
                    logger: console,
                    reuploadRequest: sock.updateMediaMessage
                }
            );

            // Save to downloads/ directory
            const fileName = `${Date.now()}_${msg.messageType}.${getExtension(msg)}`;
            fs.writeFileSync(`downloads/${fileName}`, buffer);
            console.log(`✓ Downloaded: ${fileName}`);
        } catch (error) {
            console.error(`❌ Failed to download media:`, error);
        }
    }
}
```

**Media Types Supported:**
- **Voice notes** (`ptt: true`) - WhatsApp voice recordings
- **Audio files** (`ptt: false`) - Music, audio files
- **Images** - JPEG, PNG, WebP
- **Videos** - MP4, MKV
- **Documents** - PDF, DOCX, XLSX, etc.

### Media Message Structure

**Audio Message:**
```javascript
{
  audioMessage: {
    url: "https://mmg.whatsapp.net/...",
    mimetype: "audio/ogg; codecs=\"opus\"",
    fileSha256: "base64-hash",
    fileLength: "12345",
    seconds: 15,
    ptt: true,  // Voice note
    mediaKey: "encrypted-key",
    fileEncSha256: "encrypted-hash"
  }
}
```

**Image Message:**
```javascript
{
  imageMessage: {
    url: "https://mmg.whatsapp.net/...",
    mimetype: "image/jpeg",
    caption: "Check this out!",
    fileSha256: "base64-hash",
    fileLength: "234567",
    height: 1920,
    width: 1080,
    mediaKey: "encrypted-key",
    fileEncSha256: "encrypted-hash",
    jpegThumbnail: "base64-thumbnail"
  }
}
```

---

## Rate Limiting & Best Practices

### WhatsApp Rate Limits

**Unofficial Limits (observed):**
- Max ~50 messages per day to non-contacts
- Max ~200 messages per day to contacts
- Max ~20 messages per minute
- Violations may result in temporary or permanent ban

**Best Practices:**
✅ Add recipients to contacts before messaging
✅ Implement delays between messages (5-10 seconds minimum)
✅ Don't send identical messages to multiple recipients
✅ Respect user opt-outs
✅ Don't use for spam or marketing
✅ Monitor for "Message not sent" errors

### Error Handling

```javascript
// scheduler.js error handling
try {
    await sock.sendMessage(jid, { text: message });
    messageObj.status = 'sent';
    messageObj.sentAt = new Date().toISOString();
} catch (error) {
    console.error(`❌ Failed to send message:`, error);
    messageObj.status = 'failed';
    messageObj.error = error.message;

    // Common errors:
    // - "not-authorized" - Session expired
    // - "recipient-not-found" - Invalid number
    // - "rate-limit-exceeded" - Too many messages
}
```

---

## Security & Privacy

### End-to-End Encryption

**Signal Protocol Implementation:**
- Baileys implements the Signal Protocol (same as WhatsApp)
- All messages are E2E encrypted
- Encryption keys stored in `auth_info/pre-key-*.json`
- Server cannot read message content

### Session Security

**Best Practices:**
✅ Keep `auth_info/` directory secure (contains credentials)
✅ Don't commit `auth_info/` to git (.gitignore it)
✅ Set proper file permissions (chmod 600)
✅ Don't share `creds.json` or session files
✅ Use environment variables for sensitive data
✅ Regularly monitor linked devices in WhatsApp app

### Logged Out Detection

```javascript
if (lastDisconnect?.error?.output?.statusCode === DisconnectReason.loggedOut) {
    console.log('❌ Logged out from another device');
    console.log('🗑️  Delete auth_info/ and restart to re-authenticate');
    process.exit(1);
}
```

**Causes:**
- Logged out from WhatsApp phone app
- Device limit exceeded (max 4 linked devices)
- Session manually revoked

---

## Troubleshooting

### Common Issues

**1. QR Code Not Displaying**
```bash
# Solution: Install qrcode-terminal
npm install qrcode-terminal
```

**2. Connection Timeout**
```javascript
// Increase timeout in makeWASocket
connectTimeoutMs: 180000,  // 3 minutes
defaultQueryTimeoutMs: 180000
```

**3. Session Expired**
```bash
# Delete auth_info and re-scan QR
rm -rf auth_info/
node wa.js listen
# Scan new QR code
```

**4. Messages Not Sending**
- Check WhatsApp connection status
- Verify phone number format
- Check for rate limiting
- Ensure scheduler service is running

**5. Missing Messages**
```javascript
// Enable full history sync
syncFullHistory: true
```

---

## File References

**Main Integration Code:**
- `/Users/saadi/Documents/GitHub/WhatsApp-VPSLink/wa.js:128-268` - Connection & event listeners
- `/Users/saadi/Documents/GitHub/WhatsApp-VPSLink/wa.js:52-96` - Message parsing
- `/Users/saadi/Documents/GitHub/WhatsApp-VPSLink/wa.js:443-510` - Media download

**Scheduler Implementation:**
- `/root/whatsapp-vpslink/scheduler.js` (Doodah VPS) - Message sending

**Session Storage:**
- `/Users/saadi/Documents/GitHub/WhatsApp-VPSLink/auth_info/` - 886 session files

**Documentation:**
- Package: https://www.npmjs.com/package/@whiskeysockets/baileys
- GitHub: https://github.com/WhiskeySockets/Baileys

---

## Summary

WhatsApp-VPSLink uses Baileys to provide a robust, free WhatsApp integration without requiring official API access. The session-based authentication provides persistent connections, while event listeners capture all message activity. The scheduler service sends messages programmatically at scheduled times. With proper rate limiting and error handling, the system maintains 24/7 WhatsApp connectivity for automated message scheduling.
