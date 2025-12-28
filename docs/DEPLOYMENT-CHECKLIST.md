# Deployment Checklist

**Purpose**: Standardized checklist for deploying WhatsApp VPSLink updates to production

**Server**: Doodah VPS (5.231.56.146)
**User**: root
**Path**: `/root/whatsapp-vpslink/`

---

## Pre-Deployment

### 1. Local Testing
- [ ] All changes tested locally
- [ ] API endpoints tested with `test-api.js`
- [ ] No errors in console/logs
- [ ] Database schema changes tested (if applicable)
- [ ] Dependencies updated in `package.json`

### 2. Code Review
- [ ] Code reviewed for security issues
- [ ] No hardcoded credentials or secrets
- [ ] Environment variables properly used
- [ ] Error handling implemented
- [ ] Logging added for debugging

### 3. Documentation
- [ ] README updated (if applicable)
- [ ] API documentation updated (if applicable)
- [ ] CHANGELOG updated with changes
- [ ] Comments added to complex code

### 4. Version Control
- [ ] All changes committed to git
- [ ] Commit messages are descriptive
- [ ] Tagged with version number (if major release)
- [ ] Pushed to GitHub

---

## Backup

### 5. Create Backup
- [ ] SSH into Doodah VPS
- [ ] Create manual backup of current database
- [ ] Create backup of current code
- [ ] Verify backup file size is reasonable

```bash
# SSH to server
ssh root@5.231.56.146

# Backup database
cp /root/whatsapp-vpslink/data/whatsapp.db \
   /root/whatsapp-vpslink/data/whatsapp.db.backup.$(date +%Y%m%d_%H%M%S)

# Backup code
cd /root
tar -czf whatsapp-vpslink-backup-$(date +%Y%m%d_%H%M%S).tar.gz \
  whatsapp-vpslink/

# Verify backups
ls -lh /root/whatsapp-vpslink/data/whatsapp.db.backup.*
ls -lh /root/whatsapp-vpslink-backup-*.tar.gz
```

---

## Deployment

### 6. Upload Files
- [ ] Upload changed files to server
- [ ] Verify file permissions (644 for files, 755 for directories)
- [ ] Check file ownership (should be root:root)

```bash
# From local machine
cd /Users/saadi/Documents/GitHub/WhatsApp-VPSLink/migration/s3-to-sqlite

# Upload specific files (replace as needed)
scp api.js root@5.231.56.146:/root/whatsapp-vpslink/
scp scheduler-new.js root@5.231.56.146:/root/whatsapp-vpslink/scheduler.js
scp src/db.js root@5.231.56.146:/root/whatsapp-vpslink/src/
scp package.json root@5.231.56.146:/root/whatsapp-vpslink/

# Or upload entire directory
rsync -avz --exclude 'node_modules' --exclude 'data' \
  /Users/saadi/Documents/GitHub/WhatsApp-VPSLink/migration/s3-to-sqlite/ \
  root@5.231.56.146:/root/whatsapp-vpslink/
```

### 7. Install Dependencies
- [ ] SSH into server
- [ ] Run `npm install` (if package.json changed)
- [ ] Verify no errors during installation
- [ ] Check installed package versions

```bash
ssh root@5.231.56.146
cd /root/whatsapp-vpslink
npm install
npm list --depth=0  # Verify installed packages
```

### 8. Database Migration (if applicable)
- [ ] Run database migration script (if schema changed)
- [ ] Verify migration completed successfully
- [ ] Check database integrity

```bash
# Example migration
node migrate-schema-v2.js

# Verify
sqlite3 /root/whatsapp-vpslink/data/whatsapp.db "PRAGMA integrity_check;"
```

---

## Service Restart

### 9. Restart Services
- [ ] Restart API server
- [ ] Restart scheduler
- [ ] Restart health monitor (if changed)
- [ ] Verify all services started successfully
- [ ] Check for any immediate errors in logs

```bash
ssh root@5.231.56.146

# Restart individual services
pm2 restart whatsapp-api
pm2 restart whatsapp-scheduler
pm2 restart whatsapp-health

# Or restart all
pm2 restart all

# Check status
pm2 status

# Check logs for errors
pm2 logs whatsapp-api --lines 50 --nostream
pm2 logs whatsapp-scheduler --lines 50 --nostream
pm2 logs whatsapp-health --lines 20 --nostream
```

---

## Post-Deployment Testing

### 10. Smoke Tests
- [ ] API is responding (test with curl)
- [ ] Authentication working
- [ ] Database queries working
- [ ] Health endpoint responding
- [ ] Scheduler is running without errors
- [ ] WhatsApp connection is active

```bash
# From Saadi VPS (192.209.62.48)
ssh root@192.209.62.48

# Test API health
curl http://5.231.56.146:3002/health

# Test API login
curl -X POST http://5.231.56.146:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"password":"your-password"}'

# Test API endpoint (use token from login)
curl http://5.231.56.146:3001/api/stats \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 11. Integration Tests
- [ ] Create test contact via API
- [ ] Create test scheduled message
- [ ] Verify message appears in database
- [ ] Check scheduler picks up message
- [ ] Delete test data

```bash
# Run integration test script
node test-api.js
```

### 12. Monitor Services
- [ ] Check PM2 status after 5 minutes
- [ ] Verify no unexpected restarts
- [ ] Check memory usage is normal
- [ ] Check CPU usage is normal
- [ ] Review logs for warnings/errors

```bash
ssh root@5.231.56.146

# Monitor PM2
pm2 status
pm2 monit  # Interactive monitoring

# Check system resources
htop
df -h  # Disk space

# Review logs
pm2 logs --lines 100
```

---

## Rollback Plan (If Needed)

### 13. Rollback Procedure
If deployment fails or causes issues:

```bash
ssh root@5.231.56.146

# Stop services
pm2 stop all

# Restore database backup
cd /root/whatsapp-vpslink/data
cp whatsapp.db.backup.YYYYMMDD_HHMMSS whatsapp.db

# Restore code backup
cd /root
tar -xzf whatsapp-vpslink-backup-YYYYMMDD_HHMMSS.tar.gz
cp -r whatsapp-vpslink /root/whatsapp-vpslink-old
mv whatsapp-vpslink-backup-YYYYMMDD_HHMMSS /root/whatsapp-vpslink

# Restart services
pm2 restart all

# Verify rollback
pm2 status
pm2 logs --lines 50
```

---

## Final Steps

### 14. Cleanup
- [ ] Remove old backup files (keep last 3)
- [ ] Clean up temporary files
- [ ] Update deployment log

```bash
ssh root@5.231.56.146

# Remove old backups (keep last 3)
cd /root/whatsapp-vpslink/data
ls -t whatsapp.db.backup.* | tail -n +4 | xargs rm -f

cd /root
ls -t whatsapp-vpslink-backup-*.tar.gz | tail -n +4 | xargs rm -f
```

### 15. Documentation
- [ ] Update deployment log with details
- [ ] Note any issues encountered
- [ ] Document any manual steps taken
- [ ] Update version in package.json

```bash
# Create deployment log entry
echo "$(date): Deployed version X.X.X - Description of changes" >> /root/deployment.log
```

### 16. Communication
- [ ] Notify stakeholders of deployment
- [ ] Share any breaking changes
- [ ] Update status page (if applicable)

---

## Deployment Log Template

Copy this template for each deployment:

```
=====================================================
DEPLOYMENT LOG
=====================================================
Date: YYYY-MM-DD HH:MM:SS
Version: X.X.X
Deployed by: [Your Name]
Server: Doodah VPS (5.231.56.146)

CHANGES:
- Change 1
- Change 2
- Change 3

BACKUP CREATED:
- Database: /root/whatsapp-vpslink/data/whatsapp.db.backup.YYYYMMDD_HHMMSS
- Code: /root/whatsapp-vpslink-backup-YYYYMMDD_HHMMSS.tar.gz

SERVICES RESTARTED:
- whatsapp-api: [status]
- whatsapp-scheduler: [status]
- whatsapp-health: [status]

POST-DEPLOYMENT TESTS:
- API health: [PASS/FAIL]
- Authentication: [PASS/FAIL]
- Database queries: [PASS/FAIL]
- Scheduler running: [PASS/FAIL]

ISSUES ENCOUNTERED:
- [None / List issues]

RESOLUTION TIME:
- Started: HH:MM
- Completed: HH:MM
- Duration: X minutes

NOTES:
- [Any additional notes]
=====================================================
```

---

## Quick Reference Commands

### Check Service Status
```bash
pm2 status
pm2 logs whatsapp-api --lines 20
```

### Restart All Services
```bash
pm2 restart all
```

### Check Database Size
```bash
du -h /root/whatsapp-vpslink/data/whatsapp.db
```

### Check Disk Space
```bash
df -h
```

### View Recent Logs
```bash
pm2 logs --lines 100 --nostream
```

### Monitor System Resources
```bash
htop
```

---

## Emergency Contacts

- **Server Provider**: Contabo
- **DNS/Domain**: Cloudflare
- **S3 Backup**: Garage S3 (self-hosted)
- **Support Email**: [your-email]

---

## Version History

| Version | Date | Changes | Deployed By |
|---------|------|---------|-------------|
| 2.0.0 | 2025-12-28 | S3 to SQLite migration, REST API | Claude/Saadi |
| 1.0.0 | 2024-XX-XX | Initial S3-based system | Saadi |
