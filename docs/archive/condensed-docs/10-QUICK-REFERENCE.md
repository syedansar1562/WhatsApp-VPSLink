# Quick Reference Guide

## Overview

This is a one-page quick reference for WhatsApp-VPSLink. Use this for quick lookups of common commands, configurations, and troubleshooting.

---

## System URLs

| Service | URL | Purpose |
|---------|-----|---------|
| **Web UI** | http://192.209.62.48:3000 | Schedule messages, manage contacts |
| **Health API** | http://5.231.56.146:3002/health | Monitor scheduler status |
| **S3 Bucket** | s3://WhatsAppVPS/whatsapp/ | Cloud storage |

---

## SSH Access

```bash
# Saadi VPS (Web UI)
ssh root@192.209.62.48

# Doodah VPS (Scheduler)
ssh root@5.231.56.146
```

---

## PM2 Commands

```bash
# Status
pm2 status

# Logs
pm2 logs whatsapp-scheduler
pm2 logs whatsapp-scheduler --lines 100
pm2 logs whatsapp-scheduler --timestamp

# Restart
pm2 restart whatsapp-scheduler
pm2 restart whatsapp-web

# Stop
pm2 stop whatsapp-scheduler

# Monitor
pm2 monit

# Show details
pm2 show whatsapp-scheduler

# Flush logs
pm2 flush
```

---

## CLI Commands (wa.js)

```bash
# Listen for messages (24/7)
node wa.js listen

# Send one-off message
node wa.js send 447950724774 "Hello!"

# List recent chats
node wa.js chats 20

# Read messages from contact
node wa.js read 447950724774
node wa.js read "Nick"

# Search all messages
node wa.js search "birthday"

# Show unread messages
node wa.js unread

# List groups
node wa.js groups

# Download media
node wa.js download 447950724774 voice 5
node wa.js download "Nick" image 10
```

---

## Contact Management

```bash
# Import VCF file
node tools/contacts-manager.js import contacts.vcf

# Add alias
node tools/contacts-manager.js alias "Reem" "Sister"

# Search contacts
node tools/contacts-manager.js search "reem"

# List all contacts
node tools/contacts-manager.js list

# Import bulk aliases
node tools/import-aliases.js aliases.txt

# Upload contacts to S3
node scripts/upload-contacts-to-s3.js
```

---

## S3 Operations

```bash
# Set environment variables
export B2_S3_ENDPOINT="https://s3.eu-central-003.backblazeb2.com"
export B2_ACCESS_KEY_ID="your_key"
export B2_SECRET_ACCESS_KEY="your_secret"

# List files
aws s3 ls s3://WhatsAppVPS/whatsapp/ --endpoint-url $B2_S3_ENDPOINT

# Download file
aws s3 cp s3://WhatsAppVPS/whatsapp/contacts.json ./contacts.json --endpoint-url $B2_S3_ENDPOINT

# Upload file
aws s3 cp ./scheduled.json s3://WhatsAppVPS/whatsapp/scheduled.json --endpoint-url $B2_S3_ENDPOINT

# Sync directory
aws s3 sync ./backups/ s3://WhatsAppVPS/whatsapp/ --endpoint-url $B2_S3_ENDPOINT
```

---

## File Locations

### Saadi VPS (192.209.62.48)
```
/var/www/whatsapp-scheduler/    # Web UI
├── app/                         # Next.js pages
├── components/                  # React components
├── lib/                         # Utilities
├── .env                         # S3 credentials
└── package.json
```

### Doodah VPS (5.231.56.146)
```
/root/whatsapp-vpslink/          # Scheduler
├── scheduler.js                 # Main scheduler worker
├── health.js                    # Health check API
├── wa.js                        # CLI tool
├── auth_info/                   # WhatsApp session (886 files)
├── .env                         # S3 credentials
└── package.json
```

### S3 (Backblaze B2)
```
WhatsAppVPS/whatsapp/
├── contacts.json     57 KB
├── scheduled.json    1-5 KB
└── chats.json        5.5 MB
```

---

## Data Schemas

### Contact
```json
{
  "447957189696": {
    "name": "Reem",
    "aliases": ["Reemy", "Sister"],
    "phones": {
      "primary": "447957189696",
      "secondary": null
    },
    "favorite": true,
    "tags": ["family"]
  }
}
```

### Scheduled Message
```json
{
  "id": "1735168500123_a1b2c3",
  "to": "447957189696",
  "contactName": "Reem",
  "message": "Happy Birthday!",
  "scheduledTime": "2025-12-24T10:00:00.000Z",
  "status": "pending",
  "createdAt": "2025-12-22T22:15:00.123Z",
  "createdFrom": "web",
  "sentAt": null,
  "error": null
}
```

---

## Environment Variables (.env)

```env
# Backblaze B2 S3 Configuration
B2_BUCKET=WhatsAppVPS
B2_S3_ENDPOINT=https://s3.eu-central-003.backblazeb2.com
B2_ACCESS_KEY_ID=003abc123def456789
B2_SECRET_ACCESS_KEY=K003AbCdEf...
B2_PREFIX=whatsapp/

# Storage Mode
STORAGE_MODE=s3    # or 'local' for development
```

---

## Common Workflows

### Schedule a Message (Web UI)

1. Open http://192.209.62.48:3000
2. Click floating **+** button
3. Search for contact (type name/phone/alias)
4. Enter message text
5. Select date/time
6. Click "Schedule Message"
7. Done! Message will send automatically at scheduled time

---

### Add a New Contact

**Via Web UI:**
1. Go to /contacts page
2. Click "Add Contact"
3. Enter name, phone, aliases
4. Click "Save"

**Via CLI:**
```bash
# Import from VCF
node tools/contacts-manager.js import contacts.vcf

# Or add manually to contacts.json
```

---

### Check Scheduler Status

**Via Health API:**
```bash
curl http://5.231.56.146:3002/health | jq
```

**Via PM2:**
```bash
ssh root@5.231.56.146
pm2 status
pm2 logs whatsapp-scheduler --lines 50
```

**Via Logs:**
```bash
ssh root@5.231.56.146
tail -f ~/.pm2/logs/whatsapp-scheduler-out.log
```

---

### Deploy Update

**Web UI:**
```bash
ssh root@192.209.62.48
cd /var/www/whatsapp-scheduler
git pull origin main
npm install
npm run build
pm2 restart whatsapp-web
pm2 logs whatsapp-web
```

**Scheduler:**
```bash
ssh root@5.231.56.146
cd /root/whatsapp-vpslink
git pull origin main
npm install
pm2 restart whatsapp-scheduler
pm2 logs whatsapp-scheduler
```

---

### Re-authenticate WhatsApp

**Step 1: Local Machine**
```bash
cd /Users/saadi/Documents/GitHub/WhatsApp-VPSLink
rm -rf auth_info/
node wa.js listen
# Scan QR code with WhatsApp app
# Wait for "✓ Connected to WhatsApp!"
# Press Ctrl+C to stop
```

**Step 2: Copy to VPS**
```bash
scp -r auth_info/ root@5.231.56.146:/root/whatsapp-vpslink/
```

**Step 3: Restart Scheduler**
```bash
ssh root@5.231.56.146
cd /root/whatsapp-vpslink
pm2 restart whatsapp-scheduler
pm2 logs whatsapp-scheduler
```

---

### Backup S3 Data

```bash
# Create backup directory
mkdir -p /backups/whatsapp-$(date +%Y%m%d)

# Download all S3 data
aws s3 sync s3://WhatsAppVPS/whatsapp/ /backups/whatsapp-$(date +%Y%m%d)/ \
  --endpoint-url https://s3.eu-central-003.backblazeb2.com

# Verify
ls -lh /backups/whatsapp-$(date +%Y%m%d)/
```

---

### Restore from Backup

```bash
# Upload backup to S3
aws s3 sync /backups/whatsapp-20251220/ s3://WhatsAppVPS/whatsapp/ \
  --endpoint-url https://s3.eu-central-003.backblazeb2.com
```

---

## Troubleshooting

### Scheduler Not Sending Messages

**Check 1: Is PM2 running?**
```bash
ssh root@5.231.56.146
pm2 status
# Expected: whatsapp-scheduler status: online
```

**Check 2: Is WhatsApp connected?**
```bash
pm2 logs whatsapp-scheduler | grep "Connected"
# Expected: "✓ Connected to WhatsApp!"
```

**Check 3: Are messages in S3?**
```bash
aws s3 cp s3://WhatsAppVPS/whatsapp/scheduled.json - --endpoint-url $B2_S3_ENDPOINT | jq
# Check if messages array has pending items
```

**Check 4: Is scheduledTime correct?**
```bash
# Compare scheduledTime with current UTC time
date -u +"%Y-%m-%dT%H:%M:%S.000Z"
# Message sends when scheduledTime <= current time
```

**Fix:**
```bash
pm2 restart whatsapp-scheduler
pm2 logs whatsapp-scheduler --lines 50
```

---

### WhatsApp Disconnected

**Symptoms:**
```
❌ WhatsApp connection close
🔄 Reconnecting in 5 seconds...
```

**Check logs:**
```bash
pm2 logs whatsapp-scheduler | grep "connection"
```

**If logged out:**
```bash
# Re-authenticate (see "Re-authenticate WhatsApp" section above)
```

**If network issue:**
```bash
# Wait for auto-reconnect (5-10 seconds)
# Or restart scheduler
pm2 restart whatsapp-scheduler
```

---

### S3 Access Denied

**Symptoms:**
```
❌ Error: InvalidAccessKeyId
❌ Error: SignatureDoesNotMatch
```

**Check credentials:**
```bash
ssh root@5.231.56.146
cat /root/whatsapp-vpslink/.env | grep B2_
```

**Test credentials:**
```bash
aws s3 ls s3://WhatsAppVPS/whatsapp/ --endpoint-url $B2_S3_ENDPOINT
```

**Fix:**
```bash
# Update .env with correct credentials
nano /root/whatsapp-vpslink/.env
pm2 restart whatsapp-scheduler
```

---

### High Memory Usage

**Check memory:**
```bash
pm2 show whatsapp-scheduler | grep memory
```

**If > 300 MB:**
```bash
# Restart to clear memory
pm2 restart whatsapp-scheduler

# Set memory limit
pm2 restart whatsapp-scheduler --max-memory-restart 300M
```

---

### Disk Full

**Check disk:**
```bash
df -h
```

**Clear PM2 logs:**
```bash
pm2 flush
```

**Clear old backups:**
```bash
find /root -name "*.tar.gz" -mtime +30 -delete
```

**Clear npm cache:**
```bash
npm cache clean --force
```

---

## Key Metrics

### Performance
- **Scheduler polling:** 60 seconds
- **Message send time:** <5 seconds
- **S3 read latency:** 200-500ms
- **S3 write latency:** 300-700ms
- **Web UI load time:** <2 seconds

### Capacity
- **Contacts:** 272 (supports 10,000+)
- **Scheduled messages:** 0-10 (supports 1,000+)
- **Message history:** 5.5 MB (supports 100+ MB)

### Reliability
- **Scheduler uptime:** >99%
- **WhatsApp connection:** >99%
- **Message success rate:** >99%
- **S3 availability:** 99.9%

---

## Important Phone Number Format

**Correct:**
```
447950724774         # UK (no + or 0)
15551234567          # US (no +)
```

**Incorrect:**
```
+447950724774        # ❌ No +
07950724774          # ❌ Use international format
447950724774@s.whatsapp.net  # ❌ No @s.whatsapp.net (CLI handles this)
```

---

## Timezone Handling

**All times in UTC (ISO8601):**
```javascript
"2025-12-24T10:00:00.000Z"  // UTC

// JavaScript conversion
new Date().toISOString()     // Current time in UTC
new Date("2025-12-24T10:00").toISOString()  // Local to UTC
```

**Display in local timezone:**
```javascript
// Browser automatically displays in user's timezone
new Date("2025-12-24T10:00:00.000Z").toLocaleString()
```

---

## Security Checklist

- ✅ Never commit `.env` to Git
- ✅ Never commit `auth_info/` to Git
- ✅ Use SSH keys (not passwords)
- ✅ Set `.env` permissions: `chmod 600 .env`
- ✅ Enable UFW firewall
- ✅ Keep PM2 and Node.js updated
- ✅ Monitor health endpoint
- ✅ Backup S3 data weekly
- ❌ Web UI has no authentication (TODO)

---

## Useful Links

**Project:**
- Local: `/Users/saadi/Documents/GitHub/WhatsApp-VPSLink`
- GitHub: (your repository URL)

**Documentation:**
- Main: `/Users/saadi/Documents/GitHub/WhatsApp-VPSLink/README.md`
- Guides: `/Users/saadi/Documents/GitHub/WhatsApp-VPSLink/docs/guides/`
- Condensed: `/Users/saadi/Documents/GitHub/WhatsApp-VPSLink/condensed-docs/`

**External:**
- Baileys: https://github.com/WhiskeySockets/Baileys
- PM2: https://pm2.keymetrics.io/
- Backblaze B2: https://www.backblaze.com/b2/cloud-storage.html
- Next.js: https://nextjs.org/

---

## Quick Debugging

**Problem: Message not sent**
```bash
# 1. Check scheduler logs
ssh root@5.231.56.146
pm2 logs whatsapp-scheduler --lines 50

# 2. Check S3 scheduled.json
aws s3 cp s3://WhatsAppVPS/whatsapp/scheduled.json - --endpoint-url $B2_S3_ENDPOINT | jq

# 3. Verify WhatsApp connected
pm2 logs whatsapp-scheduler | grep "Connected"

# 4. Check scheduledTime vs current time
date -u
```

**Problem: Can't access Web UI**
```bash
# 1. Check if PM2 running
ssh root@192.209.62.48
pm2 status

# 2. Check Next.js logs
pm2 logs whatsapp-web

# 3. Test locally on VPS
curl http://localhost:3000

# 4. Check firewall
sudo ufw status
```

**Problem: Contact not found**
```bash
# 1. Check S3 contacts
aws s3 cp s3://WhatsAppVPS/whatsapp/contacts.json - --endpoint-url $B2_S3_ENDPOINT | jq

# 2. Search by phone instead of name
node wa.js read 447950724774

# 3. List all contacts
node tools/contacts-manager.js list | grep -i "name"
```

---

## Version Info

**Current:** v2.0.0 (December 23, 2025)
**Status:** ✅ Production Ready
**Dependencies:**
- Node.js: 20.x
- Baileys: 7.0.0-rc.9
- Next.js: 15.5.9
- PM2: Latest
- AWS SDK: 3.956.0

---

## Emergency Contacts

**VPS Provider:** Servitro
**S3 Provider:** Backblaze B2
**Project Owner:** Saadi

**Support Resources:**
- Baileys Issues: https://github.com/WhiskeySockets/Baileys/issues
- PM2 Docs: https://pm2.keymetrics.io/docs/usage/quick-start/
- Next.js Docs: https://nextjs.org/docs

---

## Daily Checklist

**Morning:**
```bash
# 1. Check health endpoint
curl http://5.231.56.146:3002/health | jq

# 2. Check PM2 status
ssh root@5.231.56.146 'pm2 status'

# 3. Check recent logs
ssh root@5.231.56.146 'pm2 logs whatsapp-scheduler --lines 20 --nostream'
```

**Weekly:**
```bash
# 1. Backup S3 data
./backup-s3.sh

# 2. Check disk space
ssh root@5.231.56.146 'df -h'
ssh root@192.209.62.48 'df -h'

# 3. Update system packages
ssh root@5.231.56.146 'apt update && apt upgrade -y'
ssh root@192.209.62.48 'apt update && apt upgrade -y'

# 4. Flush PM2 logs
ssh root@5.231.56.146 'pm2 flush'
ssh root@192.209.62.48 'pm2 flush'
```

---

## Summary

This quick reference covers all essential commands, configurations, and troubleshooting steps for WhatsApp-VPSLink. Bookmark this page for quick access during development and operations.

**Key Takeaways:**
- Web UI: http://192.209.62.48:3000
- Health: http://5.231.56.146:3002/health
- Scheduler: Doodah VPS (5.231.56.146)
- PM2: `pm2 status`, `pm2 logs`, `pm2 restart`
- S3: Backblaze B2 (WhatsAppVPS bucket)
- Auth: auth_info/ directory (886 files)
- Format: Phone numbers without + or @
- Timezone: All UTC (ISO8601)

**For more details, see:**
- 01-SYSTEM-OVERVIEW.md
- 02-WHATSAPP-INTEGRATION.md
- 03-DATA-SCHEMAS.md
- 04-SCHEDULER-SERVICE.md
- 05-WEB-UI-FRONTEND.md
- 06-CONTACT-MANAGEMENT.md
- 07-CLI-COMMANDS.md
- 08-DEPLOYMENT-OPERATIONS.md
- 09-CURRENT-STATE-FEATURES.md
