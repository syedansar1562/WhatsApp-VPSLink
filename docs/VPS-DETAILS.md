# VPS Details and Configuration

This document contains the specific configuration details for the WhatsApp VPSLink deployment.

## VPS Information

**Provider:** Servitro (Doodah VPS)
**Public IP:** `5.231.56.146`
**SSH Port:** `22`
**Operating System:** Ubuntu 24.04 LTS
**Architecture:** x86_64

### Hardware Specs

- **RAM:** 921MB
- **Disk:** 9.6GB total, ~6.3GB available
- **CPU:** Shared vCPU

### Server Location

Based on IP: Europe (exact region varies by provider)

## SSH Access

### Connection Command

```bash
ssh root@5.231.56.146
```

### SSH Key Authentication

If using SSH keys (recommended):

```bash
ssh -i ~/.ssh/your-private-key root@5.231.56.146
```

### First-Time Setup

When connecting for the first time, you'll see:

```
The authenticity of host '5.231.56.146 (5.231.56.146)' can't be established.
ED25519 key fingerprint is SHA256:...
Are you sure you want to continue connecting (yes/no/[fingerprint])? yes
```

Type `yes` to add to known hosts.

## Project Deployment Location

**Full Path:** `/root/whatsapp-vpslink/`

### Directory Structure on VPS

```
/root/whatsapp-vpslink/
├── auth_info/           # WhatsApp session (886 files, ~100MB)
├── node_modules/        # Dependencies (~50MB)
├── src/
│   └── chatStore.js
├── tools/
│   ├── contacts-manager.js
│   ├── import-aliases.js
│   └── import-contacts.js
├── scripts/
│   └── upload-to-s3.js
├── wa.js
├── package.json
├── .env                 # S3 credentials
└── contacts.json        # Contact database

Total: ~155MB
```

## PM2 Process Configuration

### Process Name

```
whatsapp-listener
```

### Start Command

```bash
pm2 start wa.js --name whatsapp-listener -- listen
```

### Current Status

Check with:

```bash
ssh root@5.231.56.146 'pm2 status'
```

Expected output:

```
┌────┬────────────────────┬─────────┬─────────┬──────────┐
│ id │ name               │ status  │ restart │ uptime   │
├────┼────────────────────┼─────────┼─────────┼──────────┤
│ 0  │ whatsapp-listener  │ online  │ 0       │ 2d 5h    │
└────┴────────────────────┴─────────┴─────────┴──────────┘
```

### PM2 Startup Configuration

Auto-start on boot enabled with:

```bash
pm2 startup
pm2 save
```

Systemd service created at: `/etc/systemd/system/pm2-root.service`

## Node.js Version

```bash
ssh root@5.231.56.146 'node --version'
```

**Version:** v20.x.x (Node.js 20 LTS)

Installed via NodeSource repository:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
```

## Firewall Configuration

### UFW Status

```bash
ssh root@5.231.56.146 'ufw status'
```

### Rules

```
To                         Action      From
--                         ------      ----
22/tcp                     ALLOW       Anywhere
22/tcp (v6)                ALLOW       Anywhere (v6)
```

Only SSH access allowed. No HTTP/HTTPS needed (WhatsApp uses WebSocket on their infrastructure).

## Disk Usage

### Current Usage

```bash
ssh root@5.231.56.146 'df -h'
```

Example output:

```
Filesystem      Size  Used Avail Use% Mounted on
/dev/vda1       9.6G  3.3G  6.3G  35% /
```

### Project Directory Size

```bash
ssh root@5.231.56.146 'du -sh /root/whatsapp-vpslink'
```

**Expected:** ~155MB total

Breakdown:
- `auth_info/`: ~100MB (WhatsApp session data - 886 files)
- `node_modules/`: ~50MB (dependencies)
- Code: ~5MB (wa.js, src/, tools/, scripts/)
- No `chats.json` file (stored in S3 instead)

## Memory Usage

### Check Current Memory

```bash
ssh root@5.231.56.146 'free -h'
```

Example output:

```
              total        used        free      shared  buff/cache   available
Mem:          921Mi       320Mi       150Mi       5.0Mi       450Mi       520Mi
Swap:         1.0Gi       0.0Gi       1.0Gi
```

### Node.js Process Memory

```bash
ssh root@5.231.56.146 'pm2 show whatsapp-listener | grep memory'
```

**Expected:** ~50-100MB per WhatsApp listener process

## Network Configuration

### Check Active Connections

```bash
ssh root@5.231.56.146 'netstat -tuln | grep ESTABLISHED'
```

WhatsApp uses WebSocket connections to `web.whatsapp.com`.

### Bandwidth Usage

Minimal bandwidth usage:
- Incoming messages: ~1-5KB per text message
- S3 upload: Once per second (debounced), ~10KB average
- WhatsApp keepalive: ~1KB every few minutes

**Estimated monthly bandwidth:** <1GB

## S3 Configuration

### Environment Variables

Located at: `/root/whatsapp-vpslink/.env`

```env
B2_BUCKET=WhatsAppVPS
B2_S3_ENDPOINT=https://s3.eu-central-003.backblazeb2.com
B2_ACCESS_KEY_ID=00330bc627754a00000000001
B2_SECRET_ACCESS_KEY=K003QhZCxsajKLOnbCKjFpep27+KfBQ
B2_PREFIX=whatsapp/
STORAGE_MODE=s3
```

**Note:** These credentials are also stored locally on Mac at the same path.

### S3 Bucket Details

- **Provider:** Backblaze B2
- **Bucket Name:** WhatsAppVPS
- **Region:** eu-central-003
- **Endpoint:** https://s3.eu-central-003.backblazeb2.com
- **Storage Path:** whatsapp/chats.json
- **Current Size:** ~5.5MB

## Remote Management Commands

### Deploy Code Updates from Mac

```bash
rsync -avz --exclude 'node_modules' --exclude 'downloads' \
  /Users/saadi/Documents/GitHub/WhatsApp-VPSLink/ \
  root@5.231.56.146:/root/whatsapp-vpslink/
```

### Restart Listener

```bash
ssh root@5.231.56.146 'pm2 restart whatsapp-listener'
```

### View Logs

```bash
# Live logs
ssh root@5.231.56.146 'pm2 logs whatsapp-listener'

# Last 100 lines
ssh root@5.231.56.146 'pm2 logs whatsapp-listener --lines 100'

# Errors only
ssh root@5.231.56.146 'pm2 logs whatsapp-listener --err'
```

### Check Process Status

```bash
ssh root@5.231.56.146 'pm2 status'
```

### Stop Listener

```bash
ssh root@5.231.56.146 'pm2 stop whatsapp-listener'
```

### Start Listener

```bash
ssh root@5.231.56.146 'pm2 start whatsapp-listener'
```

### Restart VPS

```bash
ssh root@5.231.56.146 'reboot'
```

PM2 will auto-start the listener after reboot.

## System Updates

### Update System Packages

```bash
ssh root@5.231.56.146 'apt update && apt upgrade -y'
```

**Recommended frequency:** Monthly

### Update Node.js Dependencies

```bash
ssh root@5.231.56.146 'cd /root/whatsapp-vpslink && npm update'
```

### Update Project Code

See "Deploy Code Updates from Mac" section above.

## Monitoring and Health Checks

### Check Listener Uptime

```bash
ssh root@5.231.56.146 'pm2 show whatsapp-listener'
```

Look for:
- **uptime:** How long process has been running
- **restarts:** Should be 0 (or low number)
- **status:** Should be "online"
- **memory:** Should be <100MB

### Check WhatsApp Connection

```bash
ssh root@5.231.56.146 'pm2 logs whatsapp-listener --lines 20'
```

Should see:
```
✓ Connected to WhatsApp!
Listening for incoming messages...
✓ Saved chats.json to S3
```

### Check S3 Connectivity

```bash
ssh root@5.231.56.146 'cd /root/whatsapp-vpslink && node -e "require(\"dotenv\").config(); console.log(\"Bucket:\", process.env.B2_BUCKET)"'
```

Expected output: `Bucket: WhatsAppVPS`

## Troubleshooting

### Listener Not Running

Check PM2 status:

```bash
ssh root@5.231.56.146 'pm2 status'
```

If stopped, check logs for errors:

```bash
ssh root@5.231.56.146 'pm2 logs whatsapp-listener --err --lines 50'
```

Restart:

```bash
ssh root@5.231.56.146 'pm2 restart whatsapp-listener'
```

### Out of Memory

Check memory usage:

```bash
ssh root@5.231.56.146 'free -h'
```

If swap is full, restart listener:

```bash
ssh root@5.231.56.146 'pm2 restart whatsapp-listener'
```

### Disk Full

Check disk usage:

```bash
ssh root@5.231.56.146 'df -h'
```

If >90% full, clean up:

```bash
# Clean package cache
ssh root@5.231.56.146 'apt clean'

# Clean journal logs
ssh root@5.231.56.146 'journalctl --vacuum-time=7d'

# Check for large files
ssh root@5.231.56.146 'du -sh /root/* | sort -h'
```

### WhatsApp Session Expired

Rare, but if it happens:

1. Stop VPS listener:
   ```bash
   ssh root@5.231.56.146 'pm2 stop whatsapp-listener'
   ```

2. Delete auth_info on both Mac and VPS:
   ```bash
   rm -rf /Users/saadi/Documents/GitHub/WhatsApp-VPSLink/auth_info
   ssh root@5.231.56.146 'rm -rf /root/whatsapp-vpslink/auth_info'
   ```

3. Re-authenticate on Mac:
   ```bash
   cd /Users/saadi/Documents/GitHub/WhatsApp-VPSLink
   node wa.js listen
   # Scan QR code, then Ctrl+C
   ```

4. Deploy auth_info to VPS:
   ```bash
   rsync -avz auth_info/ root@5.231.56.146:/root/whatsapp-vpslink/auth_info/
   ```

5. Restart listener:
   ```bash
   ssh root@5.231.56.146 'pm2 restart whatsapp-listener'
   ```

## Security Notes

### SSH Access

Currently using password authentication. **Recommended:** Switch to SSH key-only.

#### Generate SSH Key (if you don't have one)

```bash
ssh-keygen -t ed25519 -C "whatsapp-vps"
```

#### Copy Key to VPS

```bash
ssh-copy-id root@5.231.56.146
```

#### Disable Password Authentication

```bash
ssh root@5.231.56.146 'nano /etc/ssh/sshd_config'
# Set: PasswordAuthentication no
ssh root@5.231.56.146 'systemctl restart sshd'
```

### Firewall

UFW enabled, only SSH port 22 open. No other ports needed.

### Sensitive Files

**Never commit these files:**
- `.env` (contains S3 credentials)
- `auth_info/` (contains WhatsApp session keys)
- `contacts.json` (contains phone numbers)

All are in `.gitignore`.

## Cost Breakdown

### VPS Costs

**Provider:** Servitro (Doodah VPS)
**Monthly Cost:** $3-5/month (estimated)

### S3 Storage Costs

**Provider:** Backblaze B2
**Storage:** 5.5MB chats.json
**Monthly Cost:** ~$0.00003/month (effectively free)

### Total Monthly Cost

**~$3-5/month** for VPS + negligible S3 costs

## Backup Strategy

### What's Backed Up

- **chats.json** → Stored in Backblaze B2 S3 (automatic, real-time)
- **auth_info/** → Stored locally on Mac (manual backup recommended)
- **contacts.json** → Stored locally on Mac (version controlled in git)

### What's NOT Backed Up

- Downloaded media files (`downloads/`) - stored only on Mac, delete after use

### Recommended Backups

1. **Weekly:** Export contacts to VCF and store separately
2. **Monthly:** Download chats.json from S3 to local archive
3. **After re-auth:** Backup entire `auth_info/` directory to encrypted USB/drive

## Related Documentation

- [DEPLOYMENT.md](DEPLOYMENT.md) - Full VPS deployment guide
- [S3-SETUP.md](S3-SETUP.md) - Backblaze B2 configuration
- [CONTACTS.md](CONTACTS.md) - Contact management
- [README.md](../README.md) - Main project documentation

## Quick Reference Commands

```bash
# Check status
ssh root@5.231.56.146 'pm2 status'

# View logs
ssh root@5.231.56.146 'pm2 logs whatsapp-listener --lines 50'

# Restart
ssh root@5.231.56.146 'pm2 restart whatsapp-listener'

# Deploy updates
rsync -avz --exclude 'node_modules' --exclude 'downloads' \
  /Users/saadi/Documents/GitHub/WhatsApp-VPSLink/ \
  root@5.231.56.146:/root/whatsapp-vpslink/ && \
  ssh root@5.231.56.146 'pm2 restart whatsapp-listener'

# Check disk/memory
ssh root@5.231.56.146 'df -h && free -h'
```

---

**Last Updated:** 2025-12-22
**VPS Last Deployed:** 2025-12-22
**WhatsApp Session Created:** 2025-12-22
