# VPS Deployment Guide

This guide walks through deploying WhatsApp VPSLink to a VPS server for 24/7 message capture.

## Prerequisites

- VPS with Ubuntu 22.04 or 24.04 (minimum 1GB RAM, 10GB disk)
- SSH access to VPS
- Backblaze B2 bucket configured (see [S3-SETUP.md](S3-SETUP.md))
- WhatsApp account authenticated locally (QR code scan)

## Architecture Overview

```
┌─────────────────────┐
│   Your Mac          │
│  - Initial QR scan  │
│  - Download media   │
│  - View chats       │
└─────────┬───────────┘
          │
          │ rsync auth_info/
          │
          ▼
┌─────────────────────┐
│   VPS (24/7)        │
│  - Runs listener    │
│  - Saves to S3      │
│  - ~155MB disk      │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│   Backblaze B2 S3   │
│  - chats.json       │
│  - Message metadata │
└─────────────────────┘
```

## Step 1: Initial Setup (Local Mac)

### 1.1 Authenticate WhatsApp

Run the listener locally to generate authentication:

```bash
node wa.js listen
```

Scan the QR code with WhatsApp on your phone. Wait for:

```
✓ Connected to WhatsApp!
✓ Saved chats.json to S3
```

**Press Ctrl+C** to stop the listener.

This creates the `auth_info/` directory containing your WhatsApp session keys.

### 1.2 Verify S3 Configuration

Ensure your `.env` file has correct S3 credentials and `STORAGE_MODE=s3`:

```env
B2_BUCKET=WhatsAppVPS
B2_S3_ENDPOINT=https://s3.eu-central-003.backblazeb2.com
B2_ACCESS_KEY_ID=your-access-key-id
B2_SECRET_ACCESS_KEY=your-secret-access-key
B2_PREFIX=whatsapp/
STORAGE_MODE=s3
```

## Step 2: VPS Preparation

### 2.1 Install Node.js 20

SSH to your VPS:

```bash
ssh root@your-vps-ip
```

Install Node.js 20 from NodeSource:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
```

Verify installation:

```bash
node --version  # Should show v20.x.x
npm --version
```

### 2.2 Create Project Directory

```bash
mkdir -p /root/whatsapp-vpslink
```

### 2.3 Install PM2 Process Manager

PM2 keeps the listener running 24/7 and auto-restarts on crashes:

```bash
npm install -g pm2
```

## Step 3: Deploy to VPS

### 3.1 Copy Files from Mac

From your Mac, run:

```bash
rsync -avz --exclude 'node_modules' --exclude 'downloads' --exclude 'backups' \
  /Users/saadi/Documents/GitHub/whatsapp-baileys-test/ \
  root@your-vps-ip:/root/whatsapp-vpslink/
```

This copies:
- Code files (wa.js, src/, tools/, scripts/)
- Authentication (auth_info/ directory)
- Configuration (.env file)

**Important:** The `.env` file contains S3 credentials - ensure it's copied.

### 3.2 Install Dependencies on VPS

SSH to VPS and install packages:

```bash
ssh root@your-vps-ip
cd /root/whatsapp-vpslink
npm install
```

### 3.3 Test Listener

Before running with PM2, test the listener works:

```bash
node wa.js listen
```

You should see:

```
Connecting to WhatsApp...
✓ Connected to WhatsApp!
Using auth state from auth_info
Listening for incoming messages...
```

**Press Ctrl+C** after verifying connection.

## Step 4: Start 24/7 Listener with PM2

### 4.1 Start Listener

```bash
pm2 start wa.js --name whatsapp-listener -- listen
```

### 4.2 Configure Auto-Start on Boot

```bash
pm2 startup
```

This displays a command to run (copy and execute it). Then:

```bash
pm2 save
```

### 4.3 Verify Status

```bash
pm2 status
```

You should see:

```
┌────┬────────────────────┬─────────┬─────────┬──────────┐
│ id │ name               │ status  │ restart │ uptime   │
├────┼────────────────────┼─────────┼─────────┼──────────┤
│ 0  │ whatsapp-listener  │ online  │ 0       │ 10s      │
└────┴────────────────────┴─────────┴─────────┴──────────┘
```

## Step 5: Monitor and Manage

### View Logs

```bash
# Live logs
pm2 logs whatsapp-listener

# Last 100 lines
pm2 logs whatsapp-listener --lines 100

# Errors only
pm2 logs whatsapp-listener --err
```

### Restart Listener

```bash
pm2 restart whatsapp-listener
```

### Stop Listener

```bash
pm2 stop whatsapp-listener
```

### Check from Mac

```bash
# View status
ssh root@your-vps-ip 'pm2 status'

# View logs
ssh root@your-vps-ip 'pm2 logs whatsapp-listener --lines 50'
```

## Step 6: Verify Message Capture

From your Mac, send yourself a WhatsApp message, then:

```bash
# View recent chats (pulls from S3)
node wa.js chats 5

# Read your own messages
node wa.js read <your-number>
```

## Disk Usage

The VPS will use minimal disk space:

```bash
ssh root@your-vps-ip 'du -sh /root/whatsapp-vpslink'
```

Expected: ~155MB total
- ~50MB node_modules
- ~100MB auth_info (WhatsApp session data)
- ~5MB code

**No chats.json** - stored in S3 instead!

## Troubleshooting

### Connection Issues

**Error:** "stream errored (conflict)"

This happens when both VPS and Mac are connected simultaneously. It's harmless - WhatsApp handles it gracefully.

### PM2 Not Starting

Check logs:

```bash
pm2 logs whatsapp-listener --err
```

Common issues:
- Missing `.env` file
- Incorrect S3 credentials
- Missing auth_info/ directory

### Out of Memory

If VPS has <1GB RAM, increase swap:

```bash
fallocate -l 1G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

### Session Expired

If WhatsApp session expires (rare), you'll need to re-authenticate:

1. Stop VPS listener: `pm2 stop whatsapp-listener`
2. Delete `auth_info/` on both Mac and VPS
3. Run `node wa.js listen` on Mac, scan QR code
4. Rsync auth_info/ to VPS again
5. Restart listener: `pm2 restart whatsapp-listener`

## Security Best Practices

### SSH Hardening

```bash
# Disable password authentication (use SSH keys only)
nano /etc/ssh/sshd_config
# Set: PasswordAuthentication no
systemctl restart sshd
```

### Firewall Setup

```bash
# Allow only SSH
ufw allow 22/tcp
ufw enable
```

### Regular Updates

```bash
# Update VPS packages monthly
apt update && apt upgrade -y
```

## Updating Code on VPS

When you make changes to code on your Mac:

```bash
# From Mac
rsync -avz --exclude 'node_modules' --exclude 'downloads' \
  /Users/saadi/Documents/GitHub/whatsapp-vpslink/ \
  root@your-vps-ip:/root/whatsapp-vpslink/

# SSH to VPS
ssh root@your-vps-ip

# Restart listener to apply changes
cd /root/whatsapp-vpslink
pm2 restart whatsapp-listener
```

## Cost Estimate

- **VPS:** $3-5/month (1GB RAM, 10GB disk)
- **Backblaze B2 Storage:** ~$0.005/GB/month
  - 10MB chats.json = $0.00005/month
  - Effectively free
- **Total:** ~$3-5/month

## Next Steps

See [CONTACTS.md](CONTACTS.md) for contact management and aliases.
