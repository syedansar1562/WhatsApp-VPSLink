# CLI Commands & Tools Reference

## Overview

WhatsApp-VPSLink provides a comprehensive command-line interface through `wa.js` for message management, chat operations, and media downloads. The CLI is the primary tool for local development and manual WhatsApp operations.

**Main CLI:** `wa.js` (26.6KB)
**Location:** `/Users/saadi/Documents/GitHub/WhatsApp-VPSLink/wa.js`

---

## Main Commands (wa.js)

### listen - Start Message Listener

**Purpose:** Start 24/7 WhatsApp listener to capture all messages

```bash
node wa.js listen
```

**Output:**
```
🔄 Connecting to WhatsApp...
✓ Connected to WhatsApp!
📱 Listening for messages...

Received 150 messages from 25 chats
✓ History sync complete

[New message received]
From: Nick (447950724774)
Message: Hey, how are you?
Type: text
Time: 2025-12-24 10:30:45
```

**What it does:**
1. Connects to WhatsApp using Baileys
2. Loads session from `auth_info/`
3. Syncs message history (if `syncFullHistory: true`)
4. Listens for 4 events:
   - `messaging-history.set` - Initial history
   - `messages.set` - Additional messages
   - `messages.upsert` - Real-time messages
   - `contacts.update` - Contact updates
5. Saves messages to S3 (if `STORAGE_MODE=s3`) or local file
6. Runs until stopped (Ctrl+C)

**First Run:**
```bash
node wa.js listen
# Displays QR code → Scan with WhatsApp app
# Session saved to auth_info/
# Subsequent runs don't need QR
```

**Use Cases:**
- Development: Capture messages for testing
- Production: Run on VPS 24/7 to log all messages
- Backup: Archive all WhatsApp conversations

---

### send - Send One-Off Message

**Purpose:** Send a message immediately (not scheduled)

```bash
node wa.js send <phone_number> <message>
```

**Examples:**
```bash
# Send to UK number
node wa.js send 447950724774 "Hello!"

# Send to US number
node wa.js send 15551234567 "Hi there"

# Send multi-word message (quote it)
node wa.js send 447950724774 "This is a longer message with spaces"

# Send with JID format (optional)
node wa.js send 447950724774@s.whatsapp.net "Hello"
```

**Output:**
```
🔄 Connecting to WhatsApp...
✓ Connected to WhatsApp!
📤 Sending message to 447950724774...
✓ Message sent successfully!
```

**Error Cases:**
```bash
node wa.js send 999999999 "Test"
# ❌ Error: recipient-not-found

node wa.js send 447950724774 ""
# ❌ Error: Message cannot be empty
```

**Use Cases:**
- Quick manual messages
- Testing WhatsApp connection
- One-time notifications
- Debug message sending

---

### chats - List Recent Chats

**Purpose:** Display recent conversations

```bash
node wa.js chats [limit]
```

**Examples:**
```bash
# List last 20 chats (default)
node wa.js chats

# List last 50 chats
node wa.js chats 50

# List all chats
node wa.js chats 1000
```

**Output:**
```
Recent Chats (Last 20):

1. Nick Smith (447950724774)
   Last: "Thanks!" (2025-12-24 10:30:45)
   Messages: 156 | Unread: 2

2. Reem (447957189696)
   Last: "See you tomorrow" (2025-12-23 22:15:00)
   Messages: 523 | Unread: 0 | ⭐ Favorite

3. Family Group (120363123456789012@g.us) [Group]
   Last: "Dinner at 7pm" (2025-12-23 18:45:00)
   Messages: 1234 | Unread: 15

...
```

**Sorting:** By `lastMessageTime` (most recent first)

**Use Cases:**
- Quick overview of recent conversations
- Find unread message counts
- Identify active chats

---

### read - Read Messages from Chat

**Purpose:** Display message history for specific contact/group

```bash
node wa.js read <contact_identifier> [limit]
```

**Examples:**
```bash
# Read by phone number
node wa.js read 447950724774

# Read by name
node wa.js read "Nick"

# Read by alias
node wa.js read "Sister"

# Read last 100 messages
node wa.js read 447950724774 100

# Read group chat
node wa.js read "Family Group"
```

**Output:**
```
Chat with Nick Smith (447950724774)
Total messages: 156

[2025-12-24 10:30:45] Nick: Hey, how are you?
[2025-12-24 10:31:02] Me: I'm good, thanks!
[2025-12-24 10:31:15] Nick: Want to grab lunch?
[2025-12-24 10:31:30] Me: Sure, when?
[2025-12-24 10:31:45] Nick: 1pm work?
[2025-12-24 10:32:00] Me: Perfect!

[2025-12-23 15:20:00] Nick: [Voice Note]
[2025-12-23 14:15:00] Me: [Image] Check this out!
[2025-12-23 13:10:00] Nick: [Document: report.pdf]

...
```

**Message Types Display:**
- Text: Full message
- Voice: `[Voice Note]`
- Audio: `[Audio]`
- Image: `[Image]` or `[Image] caption`
- Video: `[Video]` or `[Video] caption`
- Document: `[Document: filename.pdf]`

**Use Cases:**
- Review conversation history
- Search for specific message
- Export chat transcript

---

### search - Search All Chats

**Purpose:** Find messages containing specific text

```bash
node wa.js search <query>
```

**Examples:**
```bash
# Search for keyword
node wa.js search "birthday"

# Search for phrase
node wa.js search "happy birthday"

# Search for partial match
node wa.js search "birth"

# Case-insensitive
node wa.js search "BIRTHDAY"  # Matches "birthday", "Birthday", etc.
```

**Output:**
```
Search results for "birthday":

Found 5 messages across 3 chats:

Nick Smith (447950724774):
  [2025-12-20 15:30:00] Nick: Don't forget mom's birthday next week
  [2025-12-15 10:00:00] Me: Happy birthday Nick!

Reem (447957189696):
  [2025-12-24 09:00:00] Me: Happy birthday! 🎂
  [2025-01-15 10:00:00] Reem: Thanks for the birthday wishes!

Family Group:
  [2025-12-24 08:00:00] Sarah: Happy birthday Reem!
```

**Search Algorithm:**
- Case-insensitive substring match
- Searches message text only (not sender names)
- Returns all matches (no limit)

**Use Cases:**
- Find old messages
- Locate specific information
- Track recurring topics

---

### unread - Show Unread Messages

**Purpose:** Display all chats with unread messages

```bash
node wa.js unread
```

**Output:**
```
Unread Messages:

1. Nick Smith (447950724774) - 2 unread
   [2025-12-24 10:30:45] Hey, how are you?
   [2025-12-24 10:31:00] Want to grab lunch?

2. Family Group - 15 unread
   [2025-12-23 18:45:00] Sarah: Dinner at 7pm
   [2025-12-23 19:00:00] Mike: I'll be there
   ... (13 more)

3. Work Team - 5 unread
   [2025-12-23 16:00:00] Boss: Meeting at 3pm
   ... (4 more)

Total: 22 unread messages across 3 chats
```

**Use Cases:**
- Check missed messages
- Prioritize responses
- Quick inbox overview

---

### groups - List Group Chats

**Purpose:** Display all WhatsApp group chats

```bash
node wa.js groups
```

**Output:**
```
Group Chats (5 total):

1. Family Group (120363123456789012@g.us)
   Members: 12
   Last message: 2025-12-23 18:45:00
   Unread: 15

2. Work Team (120363234567890123@g.us)
   Members: 8
   Last message: 2025-12-23 16:00:00
   Unread: 5

3. Friends (120363345678901234@g.us)
   Members: 25
   Last message: 2025-12-22 20:00:00
   Unread: 0

...
```

**Use Cases:**
- View all group memberships
- Find group JIDs
- Track group activity

---

### download - Download Media

**Purpose:** Download images, videos, audio, documents from chat

```bash
node wa.js download <contact> [type] [count]
```

**Parameters:**
- `contact` - Phone number or name
- `type` (optional) - Media type filter
  - `voice` - Voice notes only
  - `audio` - Audio files only
  - `image` - Images only
  - `video` - Videos only
  - `document` - Documents only
  - `all` - All media types (default)
- `count` (optional) - Max files to download (default: 10)

**Examples:**
```bash
# Download last 10 media files from Nick
node wa.js download 447950724774

# Download last 5 voice notes
node wa.js download 447950724774 voice 5

# Download last 20 images
node wa.js download "Nick" image 20

# Download all documents
node wa.js download 447950724774 document 100

# Download all media types
node wa.js download 447950724774 all 50
```

**Output:**
```
Downloading media from Nick Smith (447950724774)...

Found 15 media messages (type: all, limit: 10)

[1/10] Downloading voice note... ✓ 1735168500_audio.ogg (125 KB)
[2/10] Downloading image... ✓ 1735168600_image.jpg (2.3 MB)
[3/10] Downloading video... ✓ 1735168700_video.mp4 (15.7 MB)
[4/10] Downloading document... ✓ 1735168800_document.pdf (450 KB)
[5/10] Downloading image... ✓ 1735168900_image.png (1.8 MB)
...

✓ Downloaded 10 files to downloads/
Total size: 45.2 MB
```

**Download Location:** `downloads/` directory

**File Naming:** `{timestamp}_{type}.{extension}`

**Media Decryption:**
- Baileys automatically decrypts WhatsApp E2E encrypted media
- Downloads original file (not compressed)

**Use Cases:**
- Backup media files
- Archive important documents
- Export voice notes/images

---

## Contact Management Tools

### contacts-manager.js

**Location:** `tools/contacts-manager.js`

**Import Contacts:**
```bash
node tools/contacts-manager.js import contacts.vcf
```

**Add Alias:**
```bash
node tools/contacts-manager.js alias "Reem" "Sister"
```

**Search Contacts:**
```bash
node tools/contacts-manager.js search "reem"
```

**List All Contacts:**
```bash
node tools/contacts-manager.js list
```

**Export Contacts:**
```bash
node tools/contacts-manager.js export contacts-backup.txt
```

---

### import-contacts.js

**Location:** `tools/import-contacts.js`

**Purpose:** Import contacts from VCF file

```bash
node tools/import-contacts.js /path/to/contacts.vcf
```

**Output:**
```
Parsing VCF file...
✓ Found 150 contacts

Merging with existing contacts...
✓ Added 120 new contacts
✓ Updated 30 existing contacts

Saving to contacts.json...
✓ Saved 272 contacts

Upload to S3? (y/n): y
✓ Uploaded to S3
```

---

### import-aliases.js

**Location:** `tools/import-aliases.js`

**Purpose:** Bulk import aliases from text file

**Format:**
```
Reem: Sister, Reemy, R
Nick: Nicky, Nicholas
Chris: Christopher, ChrisB
```

```bash
node tools/import-aliases.js aliases.txt
```

**Output:**
```
Reading aliases.txt...
✓ Found 3 contacts with aliases

Adding aliases...
✓ Added 3 aliases to Reem (447957189696)
✓ Added 2 aliases to Nick (447950724774)
✓ Added 2 aliases to Chris (447123456789)

Saving to contacts.json...
✓ Saved

Upload to S3? (y/n): y
✓ Uploaded to S3
```

---

## Utility Scripts

### upload-to-s3.js

**Location:** `scripts/upload-to-s3.js`

**Purpose:** Upload local chat history to S3

```bash
node scripts/upload-to-s3.js
```

**Output:**
```
Reading backups/chats.json...
✓ Loaded 5.5 MB

Uploading to S3...
  Bucket: WhatsAppVPS
  Key: whatsapp/chats.json

✓ Upload complete
  URL: s3://WhatsAppVPS/whatsapp/chats.json
```

---

### upload-contacts-to-s3.js

**Location:** `scripts/upload-contacts-to-s3.js`

**Purpose:** Upload local contacts to S3

```bash
node scripts/upload-contacts-to-s3.js
```

**Output:**
```
Reading contacts.json...
✓ Loaded 272 contacts (57 KB)

Uploading to S3...
  Bucket: WhatsAppVPS
  Key: whatsapp/contacts.json

✓ Upload complete
```

---

### migrate-contacts.js

**Location:** `scripts/migrate-contacts.js`

**Purpose:** Migrate contacts between schema versions

```bash
node scripts/migrate-contacts.js
```

---

## Development Commands

### Run Listener Locally

```bash
# Set storage mode to local
export STORAGE_MODE=local

# Start listener
node wa.js listen
```

**Saves to:** `backups/chats.json`

---

### Test S3 Connection

```bash
# Load environment variables
source .env

# Test AWS CLI
aws s3 ls s3://WhatsAppVPS/whatsapp/ \
  --endpoint-url $B2_S3_ENDPOINT

# Expected output:
# 2025-12-23 15:30:00      57344 contacts.json
# 2025-12-24 10:00:00       2048 scheduled.json
# 2025-12-24 10:30:00    5767168 chats.json
```

---

### View Raw S3 Files

```bash
# Download contacts.json
aws s3 cp s3://WhatsAppVPS/whatsapp/contacts.json ./contacts.json \
  --endpoint-url $B2_S3_ENDPOINT

# Download scheduled.json
aws s3 cp s3://WhatsAppVPS/whatsapp/scheduled.json ./scheduled.json \
  --endpoint-url $B2_S3_ENDPOINT

# Download chats.json
aws s3 cp s3://WhatsAppVPS/whatsapp/chats.json ./chats.json \
  --endpoint-url $B2_S3_ENDPOINT
```

---

## Error Handling

### Common Errors

**1. "Cannot find module '@whiskeysockets/baileys'"**
```bash
# Solution: Install dependencies
npm install
```

**2. "QR code timeout"**
```bash
# Solution: Increase timeout in wa.js
connectTimeoutMs: 180000  # 3 minutes
```

**3. "Session expired"**
```bash
# Solution: Delete auth_info and re-authenticate
rm -rf auth_info/
node wa.js listen
# Scan new QR code
```

**4. "S3 access denied"**
```bash
# Solution: Check .env credentials
cat .env | grep B2_

# Test credentials
aws s3 ls s3://WhatsAppVPS/ --endpoint-url $B2_S3_ENDPOINT
```

**5. "Contact not found"**
```bash
# Solution: Search by phone number instead of name
node wa.js read 447950724774

# Or update contacts.json with correct name
```

---

## Best Practices

### Phone Number Format

**Correct:**
```bash
node wa.js send 447950724774 "Hello"      # UK number (no +)
node wa.js send 15551234567 "Hello"       # US number (no +)
```

**Incorrect:**
```bash
node wa.js send +447950724774 "Hello"     # ❌ Don't use +
node wa.js send 07950724774 "Hello"       # ❌ Use international format
```

### Message Quoting

**Single word:**
```bash
node wa.js send 447950724774 Hello
```

**Multiple words:**
```bash
node wa.js send 447950724774 "Hello there"
node wa.js send 447950724774 'Hello there'
```

**Special characters:**
```bash
node wa.js send 447950724774 "Don't forget!"
node wa.js send 447950724774 'Message with "quotes" inside'
```

### Storage Mode

**Production (S3):**
```bash
export STORAGE_MODE=s3
node wa.js listen
```

**Development (Local):**
```bash
export STORAGE_MODE=local
node wa.js listen
```

---

## File References

**Main CLI:**
- `/Users/saadi/Documents/GitHub/WhatsApp-VPSLink/wa.js:1-600`

**Tools:**
- `/Users/saadi/Documents/GitHub/WhatsApp-VPSLink/tools/contacts-manager.js`
- `/Users/saadi/Documents/GitHub/WhatsApp-VPSLink/tools/import-contacts.js`
- `/Users/saadi/Documents/GitHub/WhatsApp-VPSLink/tools/import-aliases.js`

**Scripts:**
- `/Users/saadi/Documents/GitHub/WhatsApp-VPSLink/scripts/upload-to-s3.js`
- `/Users/saadi/Documents/GitHub/WhatsApp-VPSLink/scripts/upload-contacts-to-s3.js`
- `/Users/saadi/Documents/GitHub/WhatsApp-VPSLink/scripts/migrate-contacts.js`

---

## Summary

The CLI provides comprehensive command-line access to all WhatsApp operations. The `wa.js` script handles message capture, sending, and chat management, while utility tools manage contacts and S3 synchronization. All commands support both phone numbers and contact names for flexibility.
