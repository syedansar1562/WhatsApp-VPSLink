# S3 to SQLite Migration

**Created:** December 28, 2025
**Purpose:** Move WhatsApp VPSLink from S3-as-live-storage to SQLite-as-hot-storage with Garage S3 backups

---

## Quick Summary

### What This Is

A complete architectural migration that:
- Moves hot data from S3 → SQLite on Doodah VPS
- Changes from polling (every 60s) → event-driven (push notifications)
- Reduces S3 API calls by 95%
- Eliminates Backblaze transaction caps
- Adds hourly compressed backups to Garage S3 (your ChromeBox server)

### Why This Matters

**Current Problem:**
- Scheduler polls S3 every 60 seconds (1,440 reads/day)
- Every CLI command downloads full JSON files
- Hitting Backblaze free tier caps
- 50-100ms latency per S3 call
- 164 MB stored (mostly historical versions)

**After Migration:**
- Scheduler loads once at startup, refreshes on Web UI changes
- CLI commands read local SQLite (<1ms)
- Zero cloud costs (using Garage S3)
- Sub-millisecond latency
- Predictable storage (~300 MB)

---

## Files in This Directory

| File | Purpose |
|------|---------|
| **MIGRATION-PLAN.md** | Complete migration guide (read this first!) |
| **schema.sql** | SQLite database schema with indexes and views |
| **README.md** | This file - quick reference |

---

## Migration Steps (High-Level)

1. **Read the plan:** [MIGRATION-PLAN.md](./MIGRATION-PLAN.md)
2. **Create SQLite database** using `schema.sql`
3. **Write migration script** to convert S3 JSON → SQLite
4. **Test locally** before deploying
5. **Deploy to Doodah VPS**
6. **Update scheduler code** to use SQLite
7. **Create API endpoint** for Web UI integration
8. **Update Web UI** to call Doodah API
9. **Setup hourly backups** to Garage S3
10. **Monitor for 7 days** before decommissioning S3 polling

---

## Architecture Change

### Before (S3 Polling)

```
Web UI (Saadi VPS)
        ↓
    S3 (Backblaze)  ←── SOURCE OF TRUTH
        ↑
        Poll every 60s
        ↑
Scheduler (Doodah VPS)
```

**Issues:**
- High S3 read volume
- API transaction caps
- Latency
- No caching

### After (SQLite + Event-Driven)

```
Web UI (Saadi VPS)
        ↓
    Doodah API (push notification)
        ↓
SQLite on Doodah VPS  ←── SOURCE OF TRUTH
        ↓
    Scheduler (in-memory state)
        ↓
    Hourly backup → Garage S3 (ChromeBox)
```

**Benefits:**
- 95% fewer S3 reads
- Event-driven (instant updates)
- <1ms local reads
- Zero cloud costs
- Predictable storage

---

## Key Technical Details

### SQLite Database

**Location:** `/root/whatsapp-vpslink/data/whatsapp.db`

**Tables:**
- `contacts` - 272 contacts with names, aliases, tags, favorites
- `scheduled_messages` - Single scheduled messages (old system)
- `jobs` - Multi-message, multi-recipient jobs (new system)
- `chats` - Chat metadata
- `messages` - Individual messages within chats

**Features:**
- WAL mode (Write-Ahead Logging) for concurrency
- Foreign keys with CASCADE
- Indexes for common queries
- Views for complex queries
- Triggers for auto-updating timestamps

### Backup Strategy

**Frequency:** Hourly
**Location:** Garage S3 on ChromeBox (`s3://whatsapp-vpslink/backups/`)
**Format:** Compressed SQLite dumps (`.db.gz`)
**Retention:**
- Hourly: 24 hours
- Daily (00:00): 7 days
- Weekly (Sunday): 4 weeks
- Monthly (1st): 12 months

**Max Data Loss:** 1 hour (from last backup)

### Web UI → Doodah Integration

**Method:** REST API over HTTP
**Endpoint:** `http://5.231.56.146:3001/scheduler/refresh`
**Authentication:** Shared secret in `X-API-Secret` header
**Firewall:** UFW allows only Saadi VPS IP (192.209.62.48)

**Trigger:** Web UI calls API after creating/updating/deleting scheduled messages

---

## Storage Estimates

### Current (S3)
- **Active data:** ~50 MB
- **Total stored:** 164 MB (includes versions)
- **Growth:** Unpredictable (versioning)

### After (SQLite + Garage S3)
- **Hot data (SQLite):** 50-100 MB initially, ~300 MB long-term
- **Backups (Garage S3):** ~50 MB/day compressed
- **Available space on Doodah:** 6 GB (plenty of headroom)

---

## Performance Comparison

| Metric | Before (S3) | After (SQLite) | Improvement |
|--------|-------------|----------------|-------------|
| Scheduler reads/day | 1,440 | ~100 | 93% reduction |
| Read latency | 50-100ms | <1ms | 99% faster |
| Write latency | 50-100ms | <5ms | 95% faster |
| API costs | $0 (hitting caps) | $0 | No caps |
| Polling interval | 60s | 15 min (safety) | Event-driven |

---

## Rollback Plan

If anything goes wrong:

### Immediate Rollback (<5 minutes)
1. Restore old scheduler code from backup
2. Restore old Web UI from backup
3. Restart PM2 services
4. System returns to S3 polling mode

### Data Recovery
1. Download latest backup from Garage S3
2. Decompress and restore SQLite database
3. Restart scheduler
4. Max 1 hour data loss

---

## Security

### API Endpoint Security
- **Firewall:** UFW restricts port 3001 to Saadi VPS only
- **Authentication:** Shared secret header
- **No public access:** Not exposed to internet

### Backup Security
- **Network:** Garage S3 on private ChromeBox server
- **Access:** Only Doodah VPS can write backups
- **UFW:** ChromeBox firewall allows only Doodah and Saadi VPS

---

## Testing Checklist

Before deploying to production:

- [ ] Test migration script locally
- [ ] Verify all 272 contacts migrated
- [ ] Verify scheduled messages migrated
- [ ] Test SQLite CRUD operations
- [ ] Test backup and restore
- [ ] Test API endpoint security
- [ ] Test Web UI → Doodah communication
- [ ] Test scheduler event-driven refresh
- [ ] Load test (schedule 50 messages)
- [ ] Verify no duplicate messages
- [ ] Test rollback procedure

---

## Monitoring

### Daily
- Check backup logs: `/root/whatsapp-vpslink/logs/backup.log`
- Check disk usage: `du -sh /root/whatsapp-vpslink/data/`

### Weekly
- Verify backups on Garage S3
- Test restore from latest backup
- Review scheduler logs for errors

### Monthly
- Optimize SQLite: `VACUUM`
- Review retention policy
- Check Garage S3 disk usage

---

## Next Steps

1. Read [MIGRATION-PLAN.md](./MIGRATION-PLAN.md) in full
2. Create migration script (convert S3 JSON → SQLite)
3. Create database wrapper module (`src/db.js`)
4. Create API endpoint (`api.js`)
5. Create backup scripts
6. Test everything locally
7. Deploy to production
8. Monitor for 7 days
9. Decommission S3 polling (optional)

---

## Support

**Documentation:**
- Full plan: [MIGRATION-PLAN.md](./MIGRATION-PLAN.md)
- Schema: [schema.sql](./schema.sql)
- Main README: [/README.md](../README.md)

**Backup Location:**
- Garage S3: `http://149.34.177.160:3900` (s3://whatsapp-vpslink/backups/)
- See: [GARAGE-S3-INTEGRATION.md](../docs/deployment/GARAGE-S3-INTEGRATION.md)

---

**Status:** Planning Complete - Ready for Implementation
**Risk:** Medium (good rollback plan)
**Effort:** 4-6 hours
**Downtime:** <5 minutes
