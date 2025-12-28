# Garage S3 Integration Guide

**Last Updated:** December 28, 2025
**Status:** ✅ Production - Fully Operational

---

## Overview

This document describes how the WhatsApp VPSLink system is configured to use Garage S3 (self-hosted object storage) running on the ChromeBox server instead of Backblaze B2 cloud storage.

**Why Garage S3?**
- ✅ **Free:** No cloud storage costs
- ✅ **Fast:** LAN speeds for local access, exposed publicly for VPS access
- ✅ **Private:** Data stays on your infrastructure
- ✅ **Flexible:** Easy to switch between Garage and Backblaze using environment variables

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│         VPS SERVERS (Internet)                              │
│                                                              │
│  ┌──────────────────────┐      ┌──────────────────────────┐ │
│  │ Saadi VPS            │      │ Doodah VPS               │ │
│  │ 192.209.62.48        │      │ 5.231.56.146             │ │
│  │                      │      │                          │ │
│  │ - Web UI (Next.js)   │      │ - WhatsApp Scheduler     │ │
│  │ - Port 3000          │      │ - Message Sender         │ │
│  └──────────┬───────────┘      └──────────┬───────────────┘ │
│             │                              │                 │
└─────────────┼──────────────────────────────┼─────────────────┘
              │                              │
              │    HTTP (Public Internet)    │
              │                              │
              └──────────┬───────────────────┘
                         │
                    Port 3900
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│         HOME NETWORK (149.34.177.160)                        │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Router (192.168.1.1)                                 │  │
│  │  Port Forwarding: 3900 → 192.168.1.18:3900           │  │
│  │  UFW Firewall: Allow only 192.209.62.48 & 5.231.56.146│  │
│  └───────────────────┬───────────────────────────────────┘  │
│                      │                                       │
│                      ▼                                       │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  ChromeBox Server (192.168.1.18 / saadiserver)       │  │
│  │                                                        │  │
│  │  ┌──────────────────────────────────────────────────┐ │  │
│  │  │ Garage S3 Service                                │ │  │
│  │  │ - Port: 3900 (S3 API)                           │ │  │
│  │  │ - Bucket: whatsapp-vpslink                      │ │  │
│  │  │ - Storage: /var/lib/garage/                     │ │  │
│  │  │ - Memory: ~5-6 MB (very lightweight!)           │ │  │
│  │  └──────────────────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Network Configuration

### Router Port Forwarding

**Router:** 192.168.1.1
**Public IP:** 149.34.177.160

| Service    | External Port | Internal IP    | Internal Port | Protocol |
|------------|---------------|----------------|---------------|----------|
| Garage S3  | 3900         | 192.168.1.18   | 3900         | TCP      |

### Firewall Rules (UFW on ChromeBox)

```bash
# Allow all traffic from local network (prevents lockout)
ufw allow from 192.168.1.0/24

# Allow Garage S3 ONLY from VPS servers
ufw allow from 192.209.62.48 to any port 3900
ufw allow from 5.231.56.146 to any port 3900

# Default policies
ufw default deny incoming
ufw default allow outgoing
```

**Security:** Only the two VPS servers (plus your local network) can access port 3900. All other internet traffic is blocked.

---

## Garage S3 Configuration

### Connection Details

**For VPS Servers (public access):**
- **Endpoint:** `http://149.34.177.160:3900`
- **Region:** `garage`
- **Force Path Style:** `true`
- **Access Key ID:** `GKd211b1cb6eb2935da1bbd565`
- **Secret Access Key:** `975ed880ab48527fea4c3bcc71c951660c4efaea14088946d0524e112cca094c`
- **Bucket:** `whatsapp-vpslink`

**For Local Access (LAN):**
- **Endpoint:** `http://192.168.1.18:3900`
- (All other settings same as above)

### Bucket Structure

```
s3://whatsapp-vpslink/
└── whatsapp/
    ├── contacts.json            # 272 contacts
    ├── scheduled.json           # Scheduled messages
    ├── scheduled-messages.json  # Message queue
    └── jobs.json                # Scheduler jobs
```

---

## Environment Variables

### Why Environment Variables?

Instead of hardcoding S3 configuration (region, endpoint, etc.) in the code, we use environment variables. This allows you to:
- **Switch between Garage and Backblaze** by changing `.env` files only
- **Test locally** without modifying code
- **Deploy easily** to different environments

### Saadi VPS (Web UI) - `/var/www/whatsapp-scheduler/.env.local`

```bash
# Garage S3 Storage (Self-hosted on ChromeBox - PUBLIC ACCESS)
B2_ENDPOINT=http://149.34.177.160:3900
B2_KEY_ID=GKd211b1cb6eb2935da1bbd565
B2_APP_KEY=975ed880ab48527fea4c3bcc71c951660c4efaea14088946d0524e112cca094c
B2_BUCKET_NAME=whatsapp-vpslink
B2_REGION=garage
B2_FORCE_PATH_STYLE=true

# Password
WEB_PASSWORD=admin123
```

### Doodah VPS (Scheduler) - `/root/whatsapp-vpslink/.env`

```bash
# Garage S3 Storage (Self-hosted on ChromeBox - PUBLIC ACCESS)
B2_BUCKET=whatsapp-vpslink
B2_S3_ENDPOINT=http://149.34.177.160:3900
B2_ACCESS_KEY_ID=GKd211b1cb6eb2935da1bbd565
B2_SECRET_ACCESS_KEY=975ed880ab48527fea4c3bcc71c951660c4efaea14088946d0524e112cca094c
B2_PREFIX=whatsapp/
B2_REGION=garage
B2_FORCE_PATH_STYLE=true

# Storage Mode: s3 or local
STORAGE_MODE=s3
```

### Variable Explanation

| Variable | Purpose | Garage Value | Backblaze Value |
|----------|---------|--------------|-----------------|
| `B2_ENDPOINT` / `B2_S3_ENDPOINT` | S3 API endpoint | `http://149.34.177.160:3900` | `https://s3.eu-central-003.backblazeb2.com` |
| `B2_REGION` | AWS region for signature | `garage` | `eu-central-003` |
| `B2_FORCE_PATH_STYLE` | Path-style URLs | `true` | `false` |
| `B2_BUCKET` / `B2_BUCKET_NAME` | Bucket name | `whatsapp-vpslink` | `WhatsAppVPS` |
| `B2_ACCESS_KEY_ID` / `B2_KEY_ID` | Access key | (Garage key) | (Backblaze key) |
| `B2_SECRET_ACCESS_KEY` / `B2_APP_KEY` | Secret key | (Garage secret) | (Backblaze secret) |

---

## Switching Between Garage and Backblaze

### To Use Garage S3 (Current Setup)

Update `.env` files on both VPS servers with Garage credentials (see above).

### To Switch Back to Backblaze B2

**Saadi VPS:**
```bash
ssh root@192.209.62.48
cat > /var/www/whatsapp-scheduler/.env.local << 'EOF'
# Backblaze B2 S3-Compatible Storage
B2_ENDPOINT=https://s3.eu-central-003.backblazeb2.com
B2_KEY_ID=00330bc627754a00000000001
B2_APP_KEY=K003QhZCxsajKLOnbCKjFpep27+KfBQ
B2_BUCKET_NAME=WhatsAppVPS
B2_REGION=eu-central-003
B2_FORCE_PATH_STYLE=false

# Password
WEB_PASSWORD=admin123
EOF
pm2 restart whatsapp-web --update-env
```

**Doodah VPS:**
```bash
ssh root@5.231.56.146
cat > /root/whatsapp-vpslink/.env << 'EOF'
# Backblaze B2 S3-Compatible Storage
B2_BUCKET=WhatsAppVPS
B2_S3_ENDPOINT=https://s3.eu-central-003.backblazeb2.com
B2_ACCESS_KEY_ID=00330bc627754a00000000001
B2_SECRET_ACCESS_KEY=K003QhZCxsajKLOnbCKjFpep27+KfBQ
B2_PREFIX=whatsapp/
B2_REGION=eu-central-003
B2_FORCE_PATH_STYLE=false

# Storage Mode: s3 or local
STORAGE_MODE=s3
EOF
pm2 restart whatsapp-scheduler --update-env
```

---

## Code Implementation

### How S3 Client is Configured

The S3 client configuration uses environment variables for flexibility:

```javascript
// scheduler.js and scheduledStore.js (Doodah VPS)
const s3Client = new S3Client({
  endpoint: process.env.B2_S3_ENDPOINT,
  region: process.env.B2_REGION || 'garage',
  forcePathStyle: process.env.B2_FORCE_PATH_STYLE === 'true',
  credentials: {
    accessKeyId: process.env.B2_ACCESS_KEY_ID,
    secretAccessKey: process.env.B2_SECRET_ACCESS_KEY
  }
});
```

```typescript
// lib/s3.ts (Saadi VPS Web UI)
const s3Client = new S3Client({
  endpoint: process.env.B2_ENDPOINT!,
  region: process.env.B2_REGION || 'garage',
  forcePathStyle: process.env.B2_FORCE_PATH_STYLE === 'true',
  credentials: {
    accessKeyId: process.env.B2_KEY_ID!,
    secretAccessKey: process.env.B2_APP_KEY!
  }
});
```

**Key Points:**
- `forcePathStyle: true` is required for Garage (uses `endpoint/bucket/key` instead of `bucket.endpoint/key`)
- `region: 'garage'` is Garage's default region name
- All values come from environment variables, making it easy to switch providers

---

## Testing Connectivity

### From VPS Servers

```bash
# Test from Doodah VPS
ssh root@5.231.56.146
curl -v http://149.34.177.160:3900/

# Test from Saadi VPS
ssh root@192.209.62.48
curl -v http://149.34.177.160:3900/
```

**Expected Response:** `403 Forbidden` with message "Garage does not support anonymous access" (this is correct - means connectivity works, authentication required)

### From Local Machine

```bash
# Direct access to ChromeBox
curl http://192.168.1.18:3900/

# Via public IP (if on same network, will hit router)
curl http://149.34.177.160:3900/
```

### Using s3cmd

```bash
# On ChromeBox (already configured)
ssh root@192.168.1.18
s3cmd ls s3://whatsapp-vpslink/
s3cmd ls s3://whatsapp-vpslink/whatsapp/
```

---

## Troubleshooting

### VPS Can't Connect to Garage

**Symptoms:**
- `Connection timeout` or `ECONNREFUSED`

**Solutions:**
1. Check router port forwarding: Ensure port 3900 → 192.168.1.18:3900
2. Check UFW on ChromeBox: `ssh root@192.168.1.18 'ufw status'`
3. Verify Garage is running: `ssh root@192.168.1.18 'systemctl status garage'`
4. Test from VPS: `ssh root@5.231.56.146 'curl -v http://149.34.177.160:3900/'`

### AuthorizationHeaderMalformed Error

**Symptoms:**
- Error: `unexpected scope: 20251228/eu-central-003/s3/aws4_request`

**Cause:** Region is set to `eu-central-003` (Backblaze) instead of `garage`

**Solution:**
1. Verify `.env` has `B2_REGION=garage`
2. Restart service with `--update-env`: `pm2 restart whatsapp-scheduler --update-env`

### NoSuchBucket Error

**Symptoms:**
- Error: `The specified bucket does not exist`

**Solution:**
```bash
ssh root@192.168.1.18
garage -c /etc/garage/garage.toml bucket info whatsapp-vpslink
# If bucket doesn't exist:
garage -c /etc/garage/garage.toml bucket create whatsapp-vpslink
garage -c /etc/garage/garage.toml bucket allow --read --write whatsapp-vpslink --key admin-key
```

### Files Not Appearing in Garage

**Check bucket contents:**
```bash
ssh root@192.168.1.18
s3cmd ls s3://whatsapp-vpslink/whatsapp/
```

**Check service logs:**
```bash
# Web UI logs
ssh root@192.209.62.48 'pm2 logs whatsapp-web --lines 50'

# Scheduler logs
ssh root@5.231.56.146 'pm2 logs whatsapp-scheduler --lines 50'
```

---

## Performance Comparison

| Metric | Garage S3 (Local) | Backblaze B2 (Cloud) |
|--------|-------------------|----------------------|
| **Latency** | ~1-5ms (LAN) | ~50-100ms (Internet) |
| **Upload Speed** | ~100 MB/s | ~10-20 MB/s |
| **Download Speed** | ~100 MB/s | ~10-20 MB/s |
| **Cost** | Free (electricity only) | ~$0.10/month |
| **Reliability** | Single server (no redundancy) | Cloud-hosted (99.9% SLA) |
| **Access** | Requires public IP exposure OR VPN | Accessible from anywhere |

**Recommendation:**
- **For Testing/Development:** Use Garage (faster, free)
- **For Production:** Consider Backblaze (redundancy, reliability)
- **Current Setup:** Garage for cost savings, acceptable for this use case

---

## Security Considerations

### Current Security Measures

✅ **Firewall Protection:**
- UFW restricts port 3900 to only 2 VPS IPs
- All other internet traffic blocked

✅ **Authentication:**
- S3 API requires access keys
- No anonymous access allowed

✅ **Local Network Safety:**
- All traffic from 192.168.1.0/24 allowed (prevents lockout)

### Potential Improvements (Optional)

1. **HTTPS/TLS:**
   - Set up reverse proxy (Nginx/Caddy) with Let's Encrypt
   - Encrypt traffic between VPS and Garage

2. **SSH Key-Only Access:**
   - Disable password authentication on ChromeBox
   - Use SSH keys for management

3. **Fail2Ban:**
   - Auto-ban IPs after failed auth attempts

4. **Backup Strategy:**
   - Regular backups of `/var/lib/garage/` to external drive
   - Or sync to Backblaze for redundancy

---

## Monitoring

### Check Garage Status

```bash
ssh root@192.168.1.18

# Service status
systemctl status garage

# Resource usage
ps aux | grep garage

# Storage usage
du -sh /var/lib/garage/*

# Bucket info
garage -c /etc/garage/garage.toml bucket info whatsapp-vpslink

# List files
s3cmd ls s3://whatsapp-vpslink/whatsapp/
```

### Check VPS Connectivity

```bash
# From your Mac
ssh root@192.209.62.48 'curl -I http://149.34.177.160:3900/'
ssh root@5.231.56.146 'curl -I http://149.34.177.160:3900/'
```

---

## Related Documentation

- **[GARAGE-S3-STORAGE.md](../../../Remote-servers/ChromeBox-Server/GARAGE-S3-STORAGE.md)** - Complete Garage S3 setup guide
- **[S3-SETUP.md](S3-SETUP.md)** - Original S3 setup documentation (Garage + Backblaze)
- **[DEPLOYMENT.md](DEPLOYMENT.md)** - VPS deployment guide
- **[VPS-DETAILS.md](VPS-DETAILS.md)** - VPS server information

---

## Quick Reference

### Common Commands

```bash
# Restart services
ssh root@192.209.62.48 'pm2 restart whatsapp-web --update-env'
ssh root@5.231.56.146 'pm2 restart whatsapp-scheduler --update-env'

# Check Garage status
ssh root@192.168.1.18 'systemctl status garage'

# View bucket contents
ssh root@192.168.1.18 's3cmd ls s3://whatsapp-vpslink/whatsapp/'

# Check UFW rules
ssh root@192.168.1.18 'ufw status numbered'

# View service logs
ssh root@192.209.62.48 'pm2 logs whatsapp-web'
ssh root@5.231.56.146 'pm2 logs whatsapp-scheduler'
```

---

**Status:** ✅ Fully Operational
**Setup Date:** December 28, 2025
**Last Tested:** December 28, 2025
