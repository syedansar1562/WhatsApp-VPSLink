# Deployment & Operations Guide

## Overview

WhatsApp-VPSLink uses a **dual-VPS architecture** with both servers running Ubuntu 24.04 LTS, managed by PM2, and communicating through Backblaze B2 S3 cloud storage.

**VPS Provider:** Servitro
**Operating System:** Ubuntu 24.04 LTS
**Process Manager:** PM2
**Cloud Storage:** Backblaze B2 (S3-compatible)

---

## VPS Infrastructure

### VPS #1: Saadi (Web UI)

**Purpose:** Host Next.js web application

| Property | Value |
|----------|-------|
| **IP Address** | 192.209.62.48 |
| **Hostname** | saadi.servitro.com |
| **OS** | Ubuntu 24.04 LTS |
| **RAM** | Not specified |
| **Disk** | Not specified |
| **Role** | Web UI hosting |
| **Port** | 3000 (HTTP) |
| **PM2 Process** | whatsapp-web |
| **App Location** | /var/www/whatsapp-scheduler |

**SSH Access:**
```bash
ssh root@192.209.62.48
```

**Deployed Services:**
- Next.js 15 application (Port 3000)
- Nginx reverse proxy (optional)

---

### VPS #2: Doodah (Scheduler)

**Purpose:** Run 24/7 scheduler worker and health check API

| Property | Value |
|----------|-------|
| **IP Address** | 5.231.56.146 |
| **Hostname** | doodah.servitro.com |
| **OS** | Ubuntu 24.04 LTS |
| **RAM** | 921 MB |
| **Disk** | 6.3 GB available |
| **Role** | Scheduler worker |
| **Ports** | 3002 (Health API) |
| **PM2 Processes** | whatsapp-scheduler, whatsapp-health |
| **App Location** | /root/whatsapp-vpslink |

**SSH Access:**
```bash
ssh root@5.231.56.146
```

**Deployed Services:**
- Scheduler worker (scheduler.js)
- Health check API (health.js on port 3002)
- WhatsApp session (auth_info/)

---

## Initial Deployment

### Prerequisites

**On Local Machine:**
1. Node.js 20.x installed
2. Git installed
3. WhatsApp account
4. Backblaze B2 account (S3 credentials)

**On VPS:**
1. Ubuntu 24.04 LTS
2. Root or sudo access
3. Internet connection
4. Open ports (3000, 3002)

---

### Step 1: Prepare Local Environment

```bash
# Clone repository
git clone https://github.com/yourusername/whatsapp-vpslink.git
cd whatsapp-vpslink

# Install dependencies
npm install

# Create .env file
cp .env.example .env
nano .env
```

**Edit .env:**
```env
B2_BUCKET=WhatsAppVPS
B2_S3_ENDPOINT=https://s3.eu-central-003.backblazeb2.com
B2_ACCESS_KEY_ID=your_key_id
B2_SECRET_ACCESS_KEY=your_secret_key
B2_PREFIX=whatsapp/
STORAGE_MODE=s3
```

---

### Step 2: Authenticate WhatsApp (First Time)

```bash
# Start listener to generate QR code
node wa.js listen
```

**Output:**
```
🔄 Connecting to WhatsApp...
📱 Scan this QR code with WhatsApp:

█████████████████████████████
█████████████████████████████
███ ▄▄▄▄▄ █▀ █▀▀██ ▄▄▄▄▄ ███
...

Open WhatsApp on your phone:
→ Settings → Linked Devices
→ Link a Device → Scan QR code
```

**After scanning:**
```
✓ Connected to WhatsApp!
✓ Session saved to auth_info/

Session files created:
  auth_info/creds.json
  auth_info/pre-key-*.json (800+ files)
  auth_info/app-state-sync-key-*.json (80+ files)
  auth_info/session-*.json (20+ files)
```

**Important:** Keep `auth_info/` directory secure. It contains your WhatsApp session.

---

### Step 3: Deploy to Saadi VPS (Web UI)

```bash
# 1. SSH to Saadi VPS
ssh root@192.209.62.48

# 2. Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt-get install -y nodejs

# 3. Install PM2 globally
npm install -g pm2

# 4. Create app directory
mkdir -p /var/www/whatsapp-scheduler
cd /var/www/whatsapp-scheduler

# 5. Clone repository
git clone https://github.com/yourusername/whatsapp-vpslink.git .

# 6. Install dependencies
npm install

# 7. Copy .env file
nano .env
# Paste your S3 credentials

# 8. Build Next.js app
npm run build

# 9. Start with PM2
pm2 start npm --name whatsapp-web -- start

# 10. Save PM2 state
pm2 save

# 11. Enable PM2 on boot
pm2 startup
# Run the command it prints

# 12. Check status
pm2 status
pm2 logs whatsapp-web
```

**Verify:**
```bash
# Test locally on VPS
curl http://localhost:3000

# Test from external
curl http://192.209.62.48:3000
```

---

### Step 4: Deploy to Doodah VPS (Scheduler)

```bash
# 1. SSH to Doodah VPS
ssh root@5.231.56.146

# 2. Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt-get install -y nodejs

# 3. Install PM2 globally
npm install -g pm2

# 4. Create app directory
mkdir -p /root/whatsapp-vpslink
cd /root/whatsapp-vpslink

# 5. Clone repository
git clone https://github.com/yourusername/whatsapp-vpslink.git .

# 6. Install dependencies
npm install

# 7. Copy .env file
nano .env
# Paste your S3 credentials

# 8. Copy auth_info/ from local machine
# On local machine:
scp -r auth_info/ root@5.231.56.146:/root/whatsapp-vpslink/

# 9. Start scheduler with PM2
pm2 start scheduler.js --name whatsapp-scheduler

# 10. Start health check API
pm2 start health.js --name whatsapp-health

# 11. Save PM2 state
pm2 save

# 12. Enable PM2 on boot
pm2 startup
# Run the command it prints

# 13. Check status
pm2 status
pm2 logs whatsapp-scheduler
```

**Verify:**
```bash
# Check scheduler logs
pm2 logs whatsapp-scheduler --lines 50

# Test health API
curl http://localhost:3002/health

# Test from external
curl http://5.231.56.146:3002/health
```

---

## PM2 Process Management

### Basic Commands

```bash
# View all processes
pm2 status

# View logs
pm2 logs                          # All processes
pm2 logs whatsapp-scheduler       # Specific process
pm2 logs whatsapp-scheduler --lines 100  # Last 100 lines
pm2 logs --timestamp              # With timestamps

# Restart
pm2 restart whatsapp-scheduler
pm2 restart all

# Stop
pm2 stop whatsapp-scheduler
pm2 stop all

# Delete
pm2 delete whatsapp-scheduler
pm2 delete all

# Show detailed info
pm2 show whatsapp-scheduler

# Monitor (real-time dashboard)
pm2 monit

# Flush logs
pm2 flush
```

### Advanced PM2

```bash
# Start with options
pm2 start scheduler.js \
  --name whatsapp-scheduler \
  --max-memory-restart 300M \
  --max-restarts 10 \
  --min-uptime 10000

# Watch mode (auto-restart on file changes)
pm2 start scheduler.js --name whatsapp-scheduler --watch

# Cluster mode (multiple instances)
pm2 start scheduler.js --name whatsapp-scheduler -i 4

# Environment variables
pm2 start scheduler.js --name whatsapp-scheduler \
  --env production \
  --update-env

# Save current process list
pm2 save

# Resurrect saved processes
pm2 resurrect

# Update PM2
npm install pm2 -g
pm2 update
```

### PM2 Ecosystem File

**Create `ecosystem.config.js`:**
```javascript
module.exports = {
  apps: [
    {
      name: 'whatsapp-scheduler',
      script: 'scheduler.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        STORAGE_MODE: 's3'
      },
      error_file: '/var/log/pm2/whatsapp-scheduler-error.log',
      out_file: '/var/log/pm2/whatsapp-scheduler-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true
    },
    {
      name: 'whatsapp-health',
      script: 'health.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '100M',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
```

**Use ecosystem file:**
```bash
# Start all apps
pm2 start ecosystem.config.js

# Reload all apps
pm2 reload ecosystem.config.js

# Delete all apps
pm2 delete ecosystem.config.js
```

---

## Updates & Deployments

### Update Web UI (Saadi VPS)

```bash
# 1. SSH to Saadi VPS
ssh root@192.209.62.48
cd /var/www/whatsapp-scheduler

# 2. Pull latest code
git pull origin main

# 3. Install new dependencies (if any)
npm install

# 4. Rebuild Next.js app
npm run build

# 5. Restart PM2 process
pm2 restart whatsapp-web

# 6. Monitor logs
pm2 logs whatsapp-web --lines 50

# 7. Verify
curl http://localhost:3000
```

### Update Scheduler (Doodah VPS)

```bash
# 1. SSH to Doodah VPS
ssh root@5.231.56.146
cd /root/whatsapp-vpslink

# 2. Pull latest code
git pull origin main

# 3. Install new dependencies (if any)
npm install

# 4. Restart PM2 process
pm2 restart whatsapp-scheduler

# 5. Monitor logs
pm2 logs whatsapp-scheduler --lines 50

# 6. Verify health
curl http://localhost:3002/health
```

### Zero-Downtime Deployment

**Using PM2 reload:**
```bash
# Reload gracefully (zero downtime)
pm2 reload whatsapp-scheduler

# PM2 will:
# 1. Start new process
# 2. Wait for it to be ready
# 3. Stop old process
# 4. No downtime
```

---

## Monitoring & Health Checks

### Health Check API

**Endpoint:** http://5.231.56.146:3002/health

**Response:**
```json
{
  "timestamp": "2025-12-24T10:30:00.000Z",
  "healthy": true,
  "checks": {
    "scheduler": {
      "status": "running",
      "uptime": "2025-12-23T15:20:00Z",
      "restarts": 0,
      "memory": "125MB",
      "cpu": "2.3%"
    },
    "whatsapp_session": {
      "status": "exists",
      "last_modified": "2025-12-24T10:29:00Z",
      "age_minutes": 1
    },
    "scheduler_activity": {
      "status": "active",
      "last_check": "within last 50 log lines"
    }
  }
}
```

### External Monitoring

**UptimeRobot Setup:**
1. Create account at uptimerobot.com
2. Add monitor:
   - Type: HTTP(s)
   - URL: http://5.231.56.146:3002/health
   - Interval: 5 minutes
3. Set alert contacts (email, SMS, Slack)

**Monitoring Script (cron):**
```bash
# /usr/local/bin/check-scheduler.sh
#!/bin/bash

HEALTH_URL="http://5.231.56.146:3002/health"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" $HEALTH_URL)

if [ "$RESPONSE" != "200" ]; then
    echo "❌ Scheduler health check failed: HTTP $RESPONSE"
    # Send alert (email, Slack, etc.)
    exit 1
fi

echo "✅ Scheduler healthy"
exit 0
```

**Add to crontab:**
```bash
# Run every 5 minutes
*/5 * * * * /usr/local/bin/check-scheduler.sh >> /var/log/scheduler-health.log 2>&1
```

---

## Backup & Recovery

### Backup Strategy

**1. S3 Data (Automatic)**
- S3 itself provides 99.999999999% durability
- Backblaze B2 replicates data across multiple datacenters

**2. Manual S3 Backup (Weekly)**
```bash
# On local machine or dedicated backup server
#!/bin/bash
# backup-s3.sh

DATE=$(date +%Y%m%d)
BACKUP_DIR="/backups/whatsapp-$DATE"

mkdir -p "$BACKUP_DIR"

# Download all S3 data
aws s3 sync s3://WhatsAppVPS/whatsapp/ "$BACKUP_DIR/" \
  --endpoint-url https://s3.eu-central-003.backblazeb2.com

echo "✓ Backup complete: $BACKUP_DIR"
```

**Cron (Weekly on Sunday at 2 AM):**
```bash
0 2 * * 0 /usr/local/bin/backup-s3.sh
```

**3. WhatsApp Session Backup**
```bash
# Backup auth_info/ (weekly)
cd /root/whatsapp-vpslink
tar -czf auth_info-backup-$(date +%Y%m%d).tar.gz auth_info/
scp auth_info-backup-*.tar.gz user@backup-server:/backups/
```

**4. Code Backup**
- Use Git for version control
- Push to GitHub/GitLab regularly
- Tag releases

### Recovery Procedures

**Scenario 1: Scheduler Crashed**
```bash
# Check logs
pm2 logs whatsapp-scheduler --lines 100

# Restart
pm2 restart whatsapp-scheduler

# If session expired:
rm -rf /root/whatsapp-vpslink/auth_info
# Copy auth_info from backup
scp -r user@backup-server:/backups/auth_info-latest.tar.gz ./
tar -xzf auth_info-latest.tar.gz
pm2 restart whatsapp-scheduler
```

**Scenario 2: VPS Destroyed**
```bash
# 1. Provision new VPS
# 2. Install Node.js + PM2
# 3. Clone repository
# 4. Copy .env from backup
# 5. Copy auth_info/ from backup
# 6. Start PM2 processes
# 7. Verify health

# S3 data is safe (not affected by VPS loss)
```

**Scenario 3: S3 Data Corrupted**
```bash
# Restore from weekly backup
aws s3 sync /backups/whatsapp-20251220/ s3://WhatsAppVPS/whatsapp/ \
  --endpoint-url https://s3.eu-central-003.backblazeb2.com
```

---

## Security

### Firewall (UFW)

```bash
# Install UFW
apt-get install -y ufw

# Default policies
ufw default deny incoming
ufw default allow outgoing

# Allow SSH
ufw allow 22/tcp

# Allow Web UI (Saadi VPS only)
ufw allow 3000/tcp

# Allow Health API (Doodah VPS only)
ufw allow 3002/tcp

# Enable firewall
ufw enable

# Check status
ufw status verbose
```

### SSH Hardening

```bash
# Disable root password login
nano /etc/ssh/sshd_config
```

**Edit:**
```
PermitRootLogin prohibit-password
PasswordAuthentication no
```

**Restart SSH:**
```bash
systemctl restart sshd
```

**Use SSH keys only:**
```bash
# On local machine, generate key
ssh-keygen -t ed25519 -C "your_email@example.com"

# Copy to VPS
ssh-copy-id root@192.209.62.48
ssh-copy-id root@5.231.56.146
```

### Environment Variables

**Never commit .env to Git:**
```bash
# .gitignore
.env
.env.local
.env.production
auth_info/
```

**Secure .env permissions:**
```bash
chmod 600 .env
```

---

## Troubleshooting

### Common Issues

**1. PM2 process stopped**
```bash
# Check logs
pm2 logs whatsapp-scheduler --err --lines 100

# Check system resources
free -h
df -h
top

# Restart
pm2 restart whatsapp-scheduler
```

**2. Out of memory**
```bash
# Check memory usage
pm2 show whatsapp-scheduler | grep memory

# Set memory limit
pm2 restart whatsapp-scheduler --max-memory-restart 300M

# Or increase VPS RAM
```

**3. Disk full**
```bash
# Check disk usage
df -h

# Clear PM2 logs
pm2 flush

# Clear old backups
find /root -name "*.tar.gz" -mtime +30 -delete

# Clear npm cache
npm cache clean --force
```

**4. WhatsApp disconnected**
```bash
# Check logs
pm2 logs whatsapp-scheduler | grep "connection"

# If logged out:
# 1. Re-authenticate on local machine
# 2. Copy new auth_info/ to VPS
# 3. Restart scheduler
```

**5. S3 connection failed**
```bash
# Test S3 credentials
aws s3 ls s3://WhatsAppVPS/whatsapp/ \
  --endpoint-url $B2_S3_ENDPOINT

# If fails, check .env
cat .env | grep B2_

# Update credentials if needed
```

---

## File References

**Deployment Documentation:**
- `/Users/saadi/Documents/GitHub/WhatsApp-VPSLink/docs/deployment/DEPLOYMENT.md`
- `/Users/saadi/Documents/GitHub/WhatsApp-VPSLink/docs/deployment/VPS-DETAILS.md`
- `/Users/saadi/Documents/GitHub/WhatsApp-VPSLink/docs/deployment/S3-SETUP.md`

**Health Check:**
- `/Users/saadi/Documents/GitHub/WhatsApp-VPSLink/health.js`

---

## Summary

WhatsApp-VPSLink uses a dual-VPS architecture with PM2 for process management and S3 for data persistence. The deployment process involves setting up Node.js and PM2 on both VPSs, authenticating WhatsApp once, and starting the scheduler and web UI services. Health monitoring and automated backups ensure system reliability.
