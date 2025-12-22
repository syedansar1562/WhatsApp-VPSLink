# Quick Start Guide

Simple, friendly instructions for using WhatsApp VPSLink.

## What This Does

Your VPS captures all WhatsApp messages 24/7 and stores them in the cloud (S3). You can then read messages and download media from your Mac anytime.

## Daily Usage

### View Recent Chats

```bash
node wa.js chats 10
```

Shows your 10 most recent conversations.

### Read Messages from Someone

```bash
node wa.js read Nick
```

Replace `Nick` with their name/alias or phone number.

### Download Media

```bash
# Download last 5 voice notes from Nick
node wa.js download Nick voice 5

# Download last 10 images from someone
node wa.js download 447950724774 image 10

# Download everything (voice, images, videos)
node wa.js download Nick all 20
```

Files save to `downloads/` folder.

**Media types:** `voice`, `audio`, `image`, `video`, `document`, `all`

### Search Chats

```bash
node wa.js search John
```

Finds all chats mentioning "John".

### Send a Message

```bash
node wa.js send 447950724774 "Hey, how are you?"
```

## Making Changes to the Code

### 1. Edit Files Locally

Make your changes to any file in `/Users/saadi/Documents/GitHub/WhatsApp-VPSLink/`

### 2. Deploy to VPS

```bash
rsync -avz --exclude 'node_modules' --exclude 'downloads' \
  /Users/saadi/Documents/GitHub/WhatsApp-VPSLink/ \
  root@5.231.56.146:/root/whatsapp-vpslink/ && \
  ssh root@5.231.56.146 'pm2 restart whatsapp-listener'
```

Done! Takes ~10 seconds.

### 3. Check It's Working

```bash
ssh root@5.231.56.146 'pm2 logs whatsapp-listener --lines 20'
```

Should see: `✓ Connected to WhatsApp!`

## Common Tasks

### Check VPS Status

```bash
ssh root@5.231.56.146 'pm2 status'
```

Should show `online` and low restart count.

### View VPS Logs

```bash
ssh root@5.231.56.146 'pm2 logs whatsapp-listener --lines 50'
```

### Restart VPS Listener

```bash
ssh root@5.231.56.146 'pm2 restart whatsapp-listener'
```

### Add New Contact Alias

Edit `contacts.json`:

```json
{
  "447950724774": {
    "name": "Nick Smith",
    "alias": "Nick"
  }
}
```

Now you can use `node wa.js read Nick` instead of the phone number.

## Troubleshooting

### "Contact not found"

Add them to `contacts.json` (see above).

### "No media messages found"

Only messages captured after deployment contain downloadable media. Old messages can't be downloaded.

### VPS Listener Not Running

```bash
ssh root@5.231.56.146 'pm2 restart whatsapp-listener'
```

### Need to Re-authenticate WhatsApp

Rare, but if session expires:

```bash
# 1. Stop VPS
ssh root@5.231.56.146 'pm2 stop whatsapp-listener'

# 2. Delete old auth
rm -rf /Users/saadi/Documents/GitHub/WhatsApp-VPSLink/auth_info

# 3. Re-authenticate locally
node wa.js listen
# Scan QR code, then press Ctrl+C

# 4. Deploy new auth to VPS
rsync -avz auth_info/ root@5.231.56.146:/root/whatsapp-vpslink/auth_info/

# 5. Restart VPS
ssh root@5.231.56.146 'pm2 restart whatsapp-listener'
```

## Costs

- **VPS:** ~$3-5/month
- **S3 Storage:** Effectively free (~$0.10/month)

## Need More Help?

- **Full Documentation:** See [README.md](README.md)
- **VPS Details:** See [docs/VPS-DETAILS.md](docs/VPS-DETAILS.md)
- **Deployment Guide:** See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- **Contact Management:** See [docs/CONTACTS.md](docs/CONTACTS.md)
- **S3 Setup:** See [docs/S3-SETUP.md](docs/S3-SETUP.md)
