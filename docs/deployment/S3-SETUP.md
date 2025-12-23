# S3 Storage Setup Guide

This guide covers setting up Backblaze B2 (S3-compatible storage) for WhatsApp VPSLink.

## Why S3 Storage?

**Problem:** VPS servers have limited disk space. Storing WhatsApp messages locally would eventually fill up the disk.

**Solution:** Store the `chats.json` database in S3-compatible cloud storage.

**Benefits:**
- VPS uses only ~155MB disk (code + auth)
- Unlimited message history (5-10MB currently, can grow indefinitely)
- Access chats from anywhere (VPS captures, Mac downloads)
- Automatic backups (S3 handles redundancy)
- Cost: ~$0.005/GB/month (effectively free for 10MB)

## What Gets Stored in S3?

The `chats.json` file contains:

```json
{
  "447950724774@s.whatsapp.net": {
    "name": "Nick",
    "alias": "Nick",
    "messages": [
      {
        "id": "BAE5F3D4...",
        "timestamp": 1766427969,
        "from": "447950724774@s.whatsapp.net",
        "text": "Hey, how are you?",
        "fromMe": false,
        "messageType": "text",
        "rawMessage": null
      },
      {
        "id": "BAE5F3D5...",
        "timestamp": 1766428123,
        "from": "me",
        "text": null,
        "fromMe": true,
        "messageType": "image",
        "rawMessage": {
          "key": {...},
          "message": {
            "imageMessage": {
              "url": "https://mmg.whatsapp.net/...",
              "mediaKey": "encrypted-base64-key",
              "mimetype": "image/jpeg",
              "fileEncSha256": "...",
              "fileSha256": "...",
              "fileLength": "123456"
            }
          }
        }
      }
    ]
  }
}
```

**Text Messages:** ~500 bytes each
**Media Messages:** ~2KB each (metadata + encryption keys, NOT the actual file)

**Current Size:** 5.5MB (thousands of messages)
**Growth Rate:** ~1MB per month of active chatting

## What's NOT Stored in S3?

- ❌ Actual media files (voice notes, images, videos)
- ❌ WhatsApp session authentication (stored locally in `auth_info/`)
- ❌ Downloaded media files (stored locally in `downloads/`)

Media files are downloaded on-demand to your Mac using the `node wa.js download` command.

## Backblaze B2 Setup

Backblaze B2 is S3-compatible storage that's cheaper than AWS S3.

### Step 1: Create Backblaze Account

1. Go to https://www.backblaze.com/b2/sign-up.html
2. Sign up for free account (10GB free, then $0.005/GB/month)

### Step 2: Create Bucket

1. Log in to Backblaze B2
2. Go to **Buckets** → **Create a Bucket**
3. Settings:
   - **Bucket Name:** `WhatsAppVPS` (or any unique name)
   - **Files in Bucket:** Private
   - **Object Lock:** Disabled
   - **Default Encryption:** Disabled (we're not storing sensitive media)

### Step 3: Create Application Key

1. Go to **App Keys** → **Add a New Application Key**
2. Settings:
   - **Name:** `WhatsApp-VPSLink`
   - **Allow access to Bucket(s):** Select `WhatsAppVPS`
   - **Type of Access:** Read and Write
   - **Allow List All Bucket Names:** ✓
   - **File name prefix:** Leave empty
   - **Duration:** (leave blank for no expiration)

3. Click **Create New Key**

4. **IMPORTANT:** Copy these values immediately (they're only shown once):
   - **keyID** → This is your `B2_ACCESS_KEY_ID`
   - **applicationKey** → This is your `B2_SECRET_ACCESS_KEY`

### Step 4: Get S3 Endpoint

1. Go to **Buckets** → Click your bucket name
2. Find **Endpoint** section
3. Copy the **S3 Compatible API** endpoint

Example: `https://s3.eu-central-003.backblazeb2.com`

## Configure WhatsApp VPSLink

### Step 1: Create .env File

Copy the example:

```bash
cp .env.example .env
```

### Step 2: Edit .env

```bash
nano .env
```

Fill in your Backblaze credentials:

```env
# Backblaze B2 S3-Compatible Storage
B2_BUCKET=WhatsAppVPS
B2_S3_ENDPOINT=https://s3.eu-central-003.backblazeb2.com
B2_ACCESS_KEY_ID=003abc123def456789
B2_SECRET_ACCESS_KEY=K003AbCdEfGhIjKlMnOpQrStUvWxYz
B2_PREFIX=whatsapp/

# Storage Mode: 's3' or 'local'
STORAGE_MODE=s3
```

**Explanation:**
- `B2_BUCKET`: Your bucket name from Step 2
- `B2_S3_ENDPOINT`: S3 endpoint from Step 4
- `B2_ACCESS_KEY_ID`: keyID from Step 3
- `B2_SECRET_ACCESS_KEY`: applicationKey from Step 3
- `B2_PREFIX`: Folder path inside bucket (optional, recommended)
- `STORAGE_MODE`: Set to `s3` for production, `local` for testing

### Step 3: Test S3 Connection

```bash
node wa.js listen
```

You should see:

```
Connecting to WhatsApp...
✓ Connected to WhatsApp!
✓ Saved chats.json to S3
```

Press Ctrl+C to stop.

### Step 4: Verify Upload

Go to Backblaze B2 → Buckets → WhatsAppVPS → Browse Files

You should see: `whatsapp/chats.json`

## Migrating Existing Local Data to S3

If you have an existing `backups/chats.json` file, migrate it:

```bash
node scripts/upload-to-s3.js
```

This uploads your existing database to S3.

## Storage Modes

### S3 Mode (Production)

```env
STORAGE_MODE=s3
```

- Reads from S3 on startup
- Writes to S3 every second (debounced)
- No local `chats.json` file created
- Perfect for VPS with limited disk

**Use when:**
- Deploying to VPS
- Want cloud backup
- Need access from multiple machines

### Local Mode (Development/Testing)

```env
STORAGE_MODE=local
```

- Reads from `backups/chats.json`
- Writes to `backups/chats.json` every second
- Never touches S3
- Good for testing changes

**Use when:**
- Testing new features locally
- Don't have S3 credentials yet
- Want offline-only operation

## How S3 Storage Works Internally

### On Listener Startup

```javascript
// Load chats.json from S3
const command = new GetObjectCommand({
  Bucket: 'WhatsAppVPS',
  Key: 'whatsapp/chats.json'
});
const response = await s3Client.send(command);
const chats = JSON.parse(await response.Body.transformToString());
```

### On New Message

```javascript
// 1. Add message to in-memory chats object
chatStore.addMessage(chatId, messageData);

// 2. Mark as dirty (needs save)
chatStore.isDirty = true;

// 3. Debounced save (once per second max)
setTimeout(() => {
  if (chatStore.isDirty) {
    const command = new PutObjectCommand({
      Bucket: 'WhatsAppVPS',
      Key: 'whatsapp/chats.json',
      Body: JSON.stringify(chats, null, 2)
    });
    await s3Client.send(command);
  }
}, 1000);
```

**Why debounced?** If 10 messages arrive in one second, we only save once to S3, not 10 times.

### When Downloading Media

```javascript
// 1. Read chats.json from S3
const store = await new ChatStore().init();

// 2. Find message with media
const msg = store.getMessageById(messageId);

// 3. Use rawMessage to download
const buffer = await downloadMediaMessage(msg.rawMessage, 'buffer');

// 4. Save locally
fs.writeFileSync('downloads/image.jpg', buffer);
```

## S3 Costs (Backblaze B2)

**Storage:** $0.005 per GB per month

Examples:
- 10MB chats.json = $0.00005/month (free tier)
- 100MB chats.json = $0.0005/month
- 1GB chats.json = $0.005/month

**API Calls:**
- First 2,500 downloads/day: Free
- First 2,500 uploads/day: Free
- After that: $0.004 per 1,000 calls

**Bandwidth:**
- First 1GB/day: Free
- After that: $0.01 per GB

**Our Usage:**
- Upload chats.json once per second max = 86,400 uploads/day (over free tier)
- Download chats.json once per Mac session = ~10/day (free)
- Bandwidth: ~10MB/day (free)

**Estimated Cost:** $0.10/month (uploads) + $0.00005/month (storage) = **~$0.10/month total**

## Alternative S3 Providers

### AWS S3

```env
B2_S3_ENDPOINT=https://s3.us-east-1.amazonaws.com
B2_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
B2_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
```

**Cost:** ~$0.023/GB/month (5x more expensive than Backblaze)

### Wasabi

```env
B2_S3_ENDPOINT=https://s3.us-east-1.wasabisys.com
B2_ACCESS_KEY_ID=your-wasabi-key
B2_SECRET_ACCESS_KEY=your-wasabi-secret
```

**Cost:** $0.0059/GB/month (minimum $5.99/month)

### Cloudflare R2

```env
B2_S3_ENDPOINT=https://your-account.r2.cloudflarestorage.com
B2_ACCESS_KEY_ID=your-r2-key
B2_SECRET_ACCESS_KEY=your-r2-secret
```

**Cost:** $0.015/GB/month, but 0 egress fees

**Recommendation:** Stick with Backblaze B2 - it's the cheapest and most straightforward.

## Security Best Practices

### Never Commit .env File

The `.gitignore` already excludes it:

```gitignore
.env
```

### Limit Application Key Scope

- Only grant access to the specific bucket
- Use Read/Write permissions, not Delete
- Set expiration date if you want extra security

### Rotate Keys Periodically

1. Create new Application Key in Backblaze
2. Update `.env` with new credentials
3. Test connection: `node wa.js listen`
4. Delete old Application Key in Backblaze

## Troubleshooting

### "AccessDenied" Error

Check:
- `B2_ACCESS_KEY_ID` is correct (starts with `003...`)
- `B2_SECRET_ACCESS_KEY` is correct (starts with `K003...`)
- Application Key has Read/Write permissions
- Bucket name matches exactly (case-sensitive)

### "InvalidAccessKeyId" Error

- Wrong `B2_ACCESS_KEY_ID`
- Copy from Backblaze App Keys page

### "SignatureDoesNotMatch" Error

- Wrong `B2_SECRET_ACCESS_KEY`
- Ensure no extra spaces in `.env` file

### "NoSuchBucket" Error

- Wrong `B2_BUCKET` name
- Check bucket exists in Backblaze

### Connection Timeout

- Wrong `B2_S3_ENDPOINT`
- Check region matches your bucket's region

## Monitoring S3 Usage

### Backblaze Dashboard

Go to **Buckets** → **WhatsAppVPS** → **Lifecycle Settings**

You can see:
- Total storage used
- Number of files
- API calls (uploads/downloads)

### Check S3 from Command Line

```bash
# List all files in bucket
aws s3 ls s3://WhatsAppVPS/whatsapp/ \
  --endpoint-url https://s3.eu-central-003.backblazeb2.com

# Download chats.json manually
aws s3 cp s3://WhatsAppVPS/whatsapp/chats.json ./chats-backup.json \
  --endpoint-url https://s3.eu-central-003.backblazeb2.com
```

Requires AWS CLI with credentials in `~/.aws/credentials`:

```ini
[default]
aws_access_key_id = 003abc123def456789
aws_secret_access_key = K003AbCdEfGhIjKlMnOpQrStUvWxYz
```

## Next Steps

See [DEPLOYMENT.md](DEPLOYMENT.md) for deploying to VPS with S3 storage.
