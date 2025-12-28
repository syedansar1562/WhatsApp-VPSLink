# S3 Backup Provider Switching Guide

**Created:** December 28, 2025
**Purpose:** Easy switching between Garage S3 and Backblaze B2 for backups ONLY

---

## Important: S3 is Now Backup ONLY

**Old Architecture:**
- S3 was the **source of truth** (hot storage)
- Scheduler polled S3 every 60 seconds
- Web UI wrote directly to S3

**New Architecture:**
- SQLite on Doodah is the **source of truth** (hot storage)
- S3 is **backup only** (cold storage)
- Backups run on a configurable schedule
- You can easily switch between Garage and Backblaze for backups

---

## Quick Switch Between Providers

### Switch to Garage S3 (Self-Hosted, Free)

```bash
ssh root@5.231.56.146
cd /root/whatsapp-vpslink
nano .env.backup
```

Change:
```env
BACKUP_PROVIDER=garage
BACKUP_INTERVAL_MINUTES=60  # Hourly backups
```

That's it! Next backup will use Garage automatically.

### Switch to Backblaze (Cloud, Reliable)

```bash
ssh root@5.231.56.146
cd /root/whatsapp-vpslink
nano .env.backup
```

Change:
```env
BACKUP_PROVIDER=backblaze
BACKUP_INTERVAL_MINUTES=360  # Every 6 hours (less frequent for cloud)
```

Next backup will use Backblaze automatically.

**No need to restart anything!** The backup script reads `.env.backup` on every run.

---

## Backup Frequency Options

Change `BACKUP_INTERVAL_MINUTES` in `.env.backup`:

| Interval | Description | Recommended For |
|----------|-------------|-----------------|
| `15` | Every 15 minutes | Testing, paranoid mode |
| `30` | Every 30 minutes | High-value data |
| `60` | Hourly | **Default, balanced** |
| `120` | Every 2 hours | Garage S3 |
| `240` | Every 4 hours | Moderate use |
| `360` | Every 6 hours | Backblaze (cost-conscious) |
| `720` | Every 12 hours | Low-frequency changes |
| `1440` | Daily | Archival/testing environments |

**After changing interval:**
```bash
sudo ./setup-backup-cron.sh
```

This updates your cron job to the new schedule.

---

## Configuration File Reference

**File:** `/root/whatsapp-vpslink/.env.backup`

### Garage S3 Configuration

```env
# Provider selection
BACKUP_PROVIDER=garage

# Garage S3 settings (ChromeBox server)
GARAGE_ENDPOINT=http://149.34.177.160:3900
GARAGE_ACCESS_KEY_ID=GKd211b1cb6eb2935da1bbd565
GARAGE_SECRET_ACCESS_KEY=975ed880ab48527fea4c3bcc71c951660c4efaea14088946d0524e112cca094c
GARAGE_BUCKET=whatsapp-vpslink
GARAGE_REGION=garage
GARAGE_FORCE_PATH_STYLE=true
GARAGE_PREFIX=backups/

# Schedule
BACKUP_INTERVAL_MINUTES=60
```

### Backblaze B2 Configuration

```env
# Provider selection
BACKUP_PROVIDER=backblaze

# Backblaze B2 settings
BACKBLAZE_ENDPOINT=https://s3.eu-central-003.backblazeb2.com
BACKBLAZE_ACCESS_KEY_ID=00330bc627754a00000000001
BACKBLAZE_SECRET_ACCESS_KEY=K003QhZCxsajKLOnbCKjFpep27+KfBQ
BACKBLAZE_BUCKET=WhatsAppVPS
BACKBLAZE_REGION=eu-central-003
BACKBLAZE_FORCE_PATH_STYLE=false
BACKBLAZE_PREFIX=backups/

# Schedule (less frequent for cloud to save costs)
BACKUP_INTERVAL_MINUTES=360
```

---

## Common Scenarios

### Scenario 1: Daily Use with Garage

**Best for:** Normal development, testing, free hosting

```env
BACKUP_PROVIDER=garage
BACKUP_INTERVAL_MINUTES=60
BACKUP_RETAIN_HOURLY_HOURS=24
BACKUP_RETAIN_DAILY_DAYS=7
BACKUP_LOCAL_RETENTION_HOURS=24
```

**Cost:** Free
**Max data loss:** 1 hour
**Storage:** ~1-2 GB/week on Garage

### Scenario 2: Production with Backblaze

**Best for:** Critical data, off-site backup

```env
BACKUP_PROVIDER=backblaze
BACKUP_INTERVAL_MINUTES=360  # Every 6 hours
BACKUP_RETAIN_DAILY_DAYS=14
BACKUP_RETAIN_WEEKLY_WEEKS=8
BACKUP_LOCAL_RETENTION_HOURS=0  # Delete local after upload
```

**Cost:** ~$0.05-0.10/month
**Max data loss:** 6 hours
**Storage:** ~500 MB/month on Backblaze

### Scenario 3: Dual Backup (Paranoid)

Run backups to **both** providers simultaneously:

**Garage backup (frequent):**
```bash
# .env.backup
BACKUP_PROVIDER=garage
BACKUP_INTERVAL_MINUTES=60
```

**Backblaze backup (less frequent):**
```bash
# .env.backup.backblaze
BACKUP_PROVIDER=backblaze
BACKUP_INTERVAL_MINUTES=720  # Twice daily
```

**Setup two cron jobs:**
```bash
# Hourly to Garage
0 * * * * /root/whatsapp-vpslink/backup.sh >> /root/whatsapp-vpslink/logs/backup-garage.log 2>&1

# Twice daily to Backblaze (uses .env.backup.backblaze)
0 */12 * * * BACKUP_ENV=/root/whatsapp-vpslink/.env.backup.backblaze /root/whatsapp-vpslink/backup.sh >> /root/whatsapp-vpslink/logs/backup-backblaze.log 2>&1
```

### Scenario 4: Cost-Conscious Backblaze

**Best for:** Minimal cloud costs, acceptable data loss window

```env
BACKUP_PROVIDER=backblaze
BACKUP_INTERVAL_MINUTES=1440  # Daily only
BACKUP_RETAIN_DAILY_DAYS=7
BACKUP_LOCAL_RETENTION_HOURS=0
```

**Cost:** ~$0.01/month
**Max data loss:** 24 hours

---

## Testing Your Backup Configuration

### Test Garage S3 Backup

```bash
ssh root@5.231.56.146
cd /root/whatsapp-vpslink

# Edit config
nano .env.backup
# Set BACKUP_PROVIDER=garage

# Run test backup
./backup.sh

# Verify on ChromeBox
ssh root@192.168.1.18 's3cmd ls s3://whatsapp-vpslink/backups/'
```

### Test Backblaze Backup

```bash
ssh root@5.231.56.146
cd /root/whatsapp-vpslink

# Edit config
nano .env.backup
# Set BACKUP_PROVIDER=backblaze

# Run test backup
./backup.sh

# Verify on Backblaze web UI
# Go to https://secure.backblaze.com/b2_buckets.htm
# Click WhatsAppVPS → Browse Files → backups/
```

---

## Troubleshooting

### Backup fails with "Access Denied" (Garage)

**Check:**
```bash
# Verify Garage is running
ssh root@192.168.1.18 'systemctl status garage'

# Verify bucket exists
ssh root@192.168.1.18 'garage bucket info whatsapp-vpslink'

# Test connectivity from Doodah
ssh root@5.231.56.146 'curl -v http://149.34.177.160:3900/'
```

**Fix:**
```bash
# Verify UFW allows Doodah VPS
ssh root@192.168.1.18 'ufw status | grep 5.231.56.146'

# Add rule if missing
ssh root@192.168.1.18 'ufw allow from 5.231.56.146 to any port 3900'
```

### Backup fails with "Access Denied" (Backblaze)

**Check credentials:**
```bash
ssh root@5.231.56.146
cd /root/whatsapp-vpslink
cat .env.backup | grep BACKBLAZE
```

**Verify on Backblaze:**
1. Go to https://secure.backblaze.com/app_keys.htm
2. Check Application Key has Read/Write permissions
3. Verify bucket name matches exactly (case-sensitive)

### Backups are too large

**Check database size:**
```bash
ssh root@5.231.56.146
du -sh /root/whatsapp-vpslink/data/whatsapp.db
```

**Optimize database:**
```bash
sqlite3 /root/whatsapp-vpslink/data/whatsapp.db "VACUUM;"
```

**Enable compression:**
```bash
nano .env.backup
# Set BACKUP_COMPRESS=true
```

### Cron job not running

**Check cron status:**
```bash
systemctl status cron
```

**View cron logs:**
```bash
grep CRON /var/log/syslog | tail -20
```

**Check backup logs:**
```bash
tail -50 /root/whatsapp-vpslink/logs/backup.log
```

**Reconfigure cron:**
```bash
sudo ./setup-backup-cron.sh
```

---

## Monitoring

### Check Last Backup

**Garage S3:**
```bash
ssh root@192.168.1.18 's3cmd ls s3://whatsapp-vpslink/backups/ | tail -5'
```

**Backblaze:**
```bash
# Via web UI
https://secure.backblaze.com/b2_buckets.htm

# Or via API
aws s3 ls s3://WhatsAppVPS/backups/ --endpoint-url https://s3.eu-central-003.backblazeb2.com | tail -5
```

### Check Backup Logs

```bash
ssh root@5.231.56.146
tail -f /root/whatsapp-vpslink/logs/backup.log
```

### Storage Usage

**Garage S3:**
```bash
ssh root@192.168.1.18
du -sh /var/lib/garage/data/
```

**Backblaze:**
- Go to web UI → Buckets → WhatsAppVPS → Lifecycle Settings

---

## Cost Comparison

### Garage S3 (Self-Hosted)

**Setup cost:** $0 (already running on ChromeBox)
**Monthly cost:** $0 (electricity only)
**Backup frequency:** As often as you want
**Storage limit:** ChromeBox disk space (~100 GB available)

**Recommended for:**
- Testing/development
- Frequent backups
- LAN access
- Cost-conscious users

### Backblaze B2

**Setup cost:** $0
**Monthly cost:** ~$0.05-0.10/month (typical usage)
**Backup frequency:** Every 6 hours (recommended)
**Storage limit:** Unlimited

**Recommended for:**
- Production systems
- Off-site redundancy
- Internet-accessible backups
- Disaster recovery

---

## Migration Between Providers

### Migrating Existing Backups: Garage → Backblaze

```bash
# Download backups from Garage
ssh root@192.168.1.18
s3cmd get --recursive s3://whatsapp-vpslink/backups/ /tmp/garage-backups/

# Upload to Backblaze
ssh root@5.231.56.146
aws s3 cp /tmp/garage-backups/ s3://WhatsAppVPS/backups/ \
  --recursive \
  --endpoint-url https://s3.eu-central-003.backblazeb2.com
```

### Migrating Existing Backups: Backblaze → Garage

```bash
# Download from Backblaze
ssh root@5.231.56.146
aws s3 cp s3://WhatsAppVPS/backups/ /tmp/backblaze-backups/ \
  --recursive \
  --endpoint-url https://s3.eu-central-003.backblazeb2.com

# Upload to Garage
ssh root@192.168.1.18
s3cmd put --recursive /tmp/backblaze-backups/ s3://whatsapp-vpslink/backups/
```

---

## Summary

✅ **Switching providers:** Edit `BACKUP_PROVIDER` in `.env.backup`
✅ **Changing frequency:** Edit `BACKUP_INTERVAL_MINUTES`, run `setup-backup-cron.sh`
✅ **No downtime:** Changes take effect on next backup
✅ **No code changes:** Everything is configuration-driven
✅ **Dual backups:** Run two cron jobs pointing to different `.env.backup` files

**Remember:** S3 is now **backup only**, not the source of truth. You can switch between Garage and Backblaze anytime without affecting the running system.
