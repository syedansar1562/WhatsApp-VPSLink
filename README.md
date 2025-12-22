# WhatsApp VPSLink

A WhatsApp message capture system that runs 24/7 on a VPS, storing messages in S3, with on-demand media downloads.

## Features

- **24/7 Message Capture** - Runs on VPS, captures all WhatsApp messages
- **S3 Storage** - Stores message database in Backblaze B2 (S3-compatible)
- **Zero VPS Disk Usage** - Only ~155MB for code/auth, no growing storage
- **On-Demand Media Downloads** - Download voice notes, images, videos from anywhere
- **Contact Management** - Import contacts, add aliases/nicknames
- **Multi-Device Support** - VPS captures, Mac downloads media seamlessly

## Architecture

```
┌─────────────────────┐
│   VPS (24/7)        │
│  - Listens to WA    │
│  - Saves to S3      │
│  - ~155MB disk      │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│   Backblaze B2 S3   │
│  - chats.json       │
│  - 5-10MB           │
│  - Message metadata │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│   Your Mac          │
│  - Download media   │
│  - View chats       │
│  - Manage contacts  │
└─────────────────────┘
```

## Quick Start

### 1. Installation

```bash
git clone https://github.com/yourusername/WhatsApp-VPSLink.git
cd WhatsApp-VPSLink
npm install
```

### 2. Configuration

Create `.env` file:

```bash
cp .env.example .env
```

Edit `.env` with your Backblaze B2 credentials:

```env
# Backblaze B2 S3-Compatible Storage
B2_BUCKET=your-bucket-name
B2_S3_ENDPOINT=https://s3.eu-central-003.backblazeb2.com
B2_ACCESS_KEY_ID=your-access-key-id
B2_SECRET_ACCESS_KEY=your-secret-access-key
B2_PREFIX=whatsapp/

# Storage Mode: 's3' or 'local'
STORAGE_MODE=s3
```

### 3. First Run (QR Code Authentication)

```bash
node wa.js listen
```

Scan the QR code with WhatsApp on your phone. This creates the `auth_info/` session directory.

**Press Ctrl+C after seeing "✓ Connected to WhatsApp!"**

### 4. Deploy to VPS

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for full VPS deployment guide.

Quick deployment:

```bash
# Copy to VPS
rsync -avz --exclude 'node_modules' --exclude 'downloads' \
  ./ root@your-vps-ip:/root/whatsapp-vpslink/

# SSH to VPS
ssh root@your-vps-ip

# Install dependencies
cd /root/whatsapp-vpslink
npm install

# Install PM2
npm install -g pm2

# Start listener
pm2 start wa.js --name whatsapp-listener -- listen

# Enable auto-start on boot
pm2 startup
pm2 save
```

## Usage

### View Chats

```bash
# List recent chats
node wa.js chats 10

# Read specific chat
node wa.js read 447950724774
node wa.js read Nick  # Use alias if configured

# Search chats
node wa.js search John
```

### Download Media

```bash
# Download voice notes
node wa.js download 447950724774 voice 2

# Download images
node wa.js download Nick image 5

# Download all media types
node wa.js download 447950724774 all 10

# Supported types: voice, audio, image, video, document, all
```

### Contact Management

```bash
# Import contacts from VCF
node tools/import-contacts.js /path/to/contacts.vcf

# Export to editable text
node tools/contacts-manager.js export contacts.txt

# Edit contacts.txt to add aliases, then import
node tools/import-aliases.js contacts.txt
```

## Project Structure

```
WhatsApp-VPSLink/
├── wa.js                    # Main CLI tool
├── src/
│   └── chatStore.js         # S3/local storage handler
├── tools/
│   ├── contacts-manager.js  # Contact management
│   ├── import-aliases.js    # Import aliases from text
│   └── import-contacts.js   # Import from VCF
├── scripts/
│   └── upload-to-s3.js      # Migrate local data to S3
├── docs/
│   ├── DEPLOYMENT.md        # VPS deployment guide
│   ├── CONTACTS.md          # Contact management guide
│   └── S3-SETUP.md          # S3 configuration guide
├── auth_info/               # WhatsApp session (gitignored)
├── downloads/               # Downloaded media (gitignored)
├── .env                     # Environment config (gitignored)
└── .env.example             # Template for .env
```

## Commands

### Listener
```bash
node wa.js listen              # Start capturing messages
```

### Chats
```bash
node wa.js chats [limit]       # List recent chats (default: 20)
node wa.js read <contact>      # Read messages from contact
node wa.js search <query>      # Search chats
node wa.js unread              # Show unread messages
node wa.js groups              # List group chats
```

### Media
```bash
node wa.js download <contact> [type] [count]
# Types: voice, audio, image, video, document, all
# Count: number of items (default: 10)
```

### Messaging
```bash
node wa.js send <number> <message>
```

## S3 Storage

### What's Stored in S3

- **chats.json** (~5-10MB)
  - Message text
  - Timestamps
  - Sender info
  - Media metadata (URLs, encryption keys)
  - Raw message objects for media downloads

### What's NOT Stored

- ❌ Actual media files (voice notes, images, videos)
- ❌ These are downloaded on-demand to your local machine

### Storage Modes

**S3 Mode (Production)**
```env
STORAGE_MODE=s3
```
- Reads/writes from Backblaze B2
- No local disk usage
- Perfect for VPS with limited storage

**Local Mode (Development/Testing)**
```env
STORAGE_MODE=local
```
- Uses `backups/chats.json`
- Good for testing without S3

## VPS Management

```bash
# Check status
ssh root@your-vps 'pm2 status'

# View logs
ssh root@your-vps 'pm2 logs whatsapp-listener'

# Restart
ssh root@your-vps 'pm2 restart whatsapp-listener'

# Stop
ssh root@your-vps 'pm2 stop whatsapp-listener'
```

## Security Notes

- **Never commit** `.env` file (contains S3 credentials)
- **Never commit** `auth_info/` directory (contains WhatsApp session keys)
- Keep your VPS secure with:
  - SSH key-only authentication
  - UFW firewall
  - Fail2ban

## Troubleshooting

### "stream errored (conflict)"
This happens when both VPS and your Mac are connected simultaneously. It's harmless - the system handles it gracefully.

### "No media messages with downloadable content found"
Old messages captured before implementing raw message storage can't be downloaded. Only messages captured after the S3 implementation contain downloadable metadata.

### VPS Connection Issues
```bash
# Check if listener is running
ssh root@your-vps 'pm2 status'

# View errors
ssh root@your-vps 'pm2 logs whatsapp-listener --err'
```

## Requirements

- Node.js 18+ (20.x recommended)
- Backblaze B2 account (or any S3-compatible storage)
- VPS with Ubuntu 22.04/24.04 (min 1GB RAM, 10GB disk)

## License

MIT

## Credits

Built with [@whiskeysockets/baileys](https://github.com/WhiskeySockets/Baileys)
