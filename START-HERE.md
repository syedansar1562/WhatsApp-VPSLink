# START HERE - New Claude Session Guide

**Last Updated:** December 28, 2025
**Token Budget Remaining:** ~20% (continue to next session)

---

## Quick Context

You're inheriting the **WhatsApp VPSLink** project - a simple WhatsApp message scheduler running on a VPS.

**Current Status:** ✅ Working perfectly in production

**Core System:** 3 files, 14 KB of code, deployed on Doodah VPS (5.231.56.146)

---

## Read These Files IN ORDER

### 1. README.md (5 minutes)
**Purpose:** Understand what the system does and how it works

**Key Points:**
- 3-file architecture (whatsapp-listener, scheduler-simple, api-simple)
- SQLite database for message storage
- REST API with 6 endpoints
- Currently running in production

### 2. LESSONS-LEARNED.md (10 minutes)
**Purpose:** Learn from past mistakes - CRITICAL for avoiding same errors

**Key Points:**
- V2 Upgrade failed: 17 files, never deployed
- S3-to-SQLite failed: 25 files, abandoned
- Simple approach succeeded: 3 files, deployed in 3 hours
- 7 key lessons with examples
- Rules for future development

**DO NOT SKIP THIS FILE!**

### 3. HANDOVER.md (15 minutes)
**Purpose:** Detailed technical documentation and current state

**Key Points:**
- Production service status (both running on Doodah)
- Database schema and structure
- API endpoints with examples
- Recent issues and fixes
- Next steps: Connect Web UI to API

---

## Current Mission

**Primary Task:** Connect the Web UI to the new API on Doodah

**Context:**
- Doodah VPS has working API on port 3001
- Currently localhost-only (firewall blocks external access)
- Need to either:
  1. Open port 3001 in firewall, OR
  2. Set up nginx reverse proxy, OR
  3. Run Web UI on Doodah itself

**Before You Start:**
- Understand why previous approaches failed (read LESSONS-LEARNED.md)
- Keep it simple (3-file rule, 1-hour rule)
- Test incrementally
- Deploy early

---

## Project Structure (Simplified)

```
WhatsApp-VPSLink/
├── START-HERE.md          ⭐ YOU ARE HERE
├── README.md              ⭐ What it does, how it works
├── LESSONS-LEARNED.md     ⭐ CRITICAL - Learn from mistakes
├── HANDOVER.md            ⭐ Technical details
│
├── whatsapp-listener.js   ⭐ WhatsApp connection (2.8 KB)
├── scheduler-simple.js     ⭐ Message scheduler (2.7 KB)
├── api-simple.js          ⭐ REST API (8.2 KB)
│
├── data/whatsapp.db       (SQLite database)
├── auth_info/             (WhatsApp session)
│
├── migration/             ⚠️  ABANDONED - Complex approaches that failed
│   ├── v2-upgrade/        (17 files, 150KB, never deployed)
│   └── s3-to-sqlite/      (25 files, 200KB, abandoned)
│
└── docs/                  (Additional documentation)
```

**⭐ = Essential files**
**⚠️ = Learn from these mistakes**

---

## The "Simple First" Philosophy

This project has taught us some hard lessons:

### What DOESN'T Work:
- ❌ Planning elaborate architectures before coding
- ❌ Writing 100+ KB of documentation before deploying
- ❌ Adding authentication/backup/monitoring prematurely
- ❌ Building 17+ files for a "proper" implementation
- ❌ Solving theoretical problems

### What DOES Work:
- ✅ Start with 3 files maximum
- ✅ Get something working in 1 hour
- ✅ Deploy to production first, then improve
- ✅ Copy working code, don't rewrite from scratch
- ✅ Test in isolation
- ✅ Solve real problems only

**Read LESSONS-LEARNED.md for detailed examples**

---

## Production Status

### Doodah VPS (5.231.56.146)

**PM2 Processes:**
```bash
pm2 status

# Should show:
# whatsapp-scheduler  ONLINE  (runs scheduler-simple.js)
# whatsapp-api        ONLINE  (runs api-simple.js on port 3001)
```

**Health Check:**
```bash
# From VPS itself:
curl http://localhost:3001/health

# Expected response:
{
  "status": "ok",
  "database": "connected",
  "messages_count": 1,
  "timestamp": "2025-12-28T18:39:04.061Z"
}
```

**Important Note:**
- Health monitor is checking port 3002 (WRONG)
- API is actually on port 3001 (CORRECT)
- Need to update health monitor URL

---

## Next Steps (For You)

### Step 1: Verify Current State (5 minutes)

```bash
# Check services are running
ssh root@5.231.56.146 "pm2 status"

# Check API works
ssh root@5.231.56.146 "curl http://localhost:3001/health"

# Check logs
ssh root@5.231.56.146 "pm2 logs whatsapp-scheduler --lines 20"
```

### Step 2: Plan Web UI Integration (15 minutes)

**Questions to Answer:**
1. Where is the Web UI code located?
2. Is it on a separate VPS or same as API?
3. Should we expose port 3001 or use nginx proxy?
4. Do we need authentication before exposing it?

**Consult the user before making decisions!**

### Step 3: Implement Simply (1-2 hours)

**Follow These Rules:**
1. **3-File Rule:** Don't create more than 3 new files
2. **1-Hour Rule:** If you can't get it working in 1 hour, simplify
3. **Test Incrementally:** Test each piece before moving forward
4. **Deploy Early:** Get something working in production ASAP
5. **No Premature Optimization:** Don't add features not explicitly requested

**See LESSONS-LEARNED.md for detailed rules**

---

## Common Pitfalls to Avoid

### Pitfall #1: Over-Planning
**DON'T:**
- Spend hours writing migration plans
- Create elaborate documentation before coding
- Design complex architectures on paper

**DO:**
- Write minimal code first
- Test it immediately
- Document what you learned after

### Pitfall #2: Feature Creep
**DON'T:**
- Add authentication "because it's best practice"
- Build backup systems "just in case"
- Create monitoring dashboards "to be safe"

**DO:**
- Only build what's explicitly requested
- Ask "Do we really need this right now?"
- Remember: Features can be added later

### Pitfall #3: Solving Theoretical Problems
**DON'T:**
- Build retry logic before seeing failures
- Add rate limiting before hitting limits
- Create abstraction layers "for future flexibility"

**DO:**
- Solve real problems only
- Wait for actual issues to appear
- Keep it simple until proven necessary

---

## Quick Reference

### Check System Health
```bash
ssh root@5.231.56.146
pm2 status
pm2 logs whatsapp-scheduler --lines 50
curl http://localhost:3001/health
```

### Schedule Test Message
```bash
curl -X POST http://localhost:3001/api/messages \
  -H "Content-Type: application/json" \
  -d '{
    "to_phone": "447779299086",
    "message": "Test",
    "scheduled_at": "'$(date -u -d '+2 minutes' +%Y-%m-%dT%H:%M:%SZ)'"
  }'
```

### View Database
```bash
ssh root@5.231.56.146
cd /root/whatsapp-vpslink
node -e "const db = require('better-sqlite3')('data/whatsapp.db'); \
console.log(db.prepare('SELECT * FROM scheduled_messages').all());"
```

### Restart Services
```bash
ssh root@5.231.56.146
pm2 restart whatsapp-scheduler
pm2 restart whatsapp-api
```

---

## If You Get Stuck

1. **Read LESSONS-LEARNED.md** - Seriously, read it!
2. **Simplify** - Can you cut anything out?
3. **Test in Isolation** - Can you test just this one piece?
4. **Ask the User** - Don't assume requirements
5. **Look at Working Code** - Copy what already works (whatsapp-listener.js is a great example)

---

## Success Criteria

You'll know you're on the right track if:

- ✅ You can explain the whole system in 3 sentences
- ✅ You're working on the actual requested feature (Web UI integration)
- ✅ You're not creating elaborate documentation before coding
- ✅ You can test your changes locally before deploying
- ✅ You're using familiar, boring technology
- ✅ The code is under 20 KB total

You're going down the wrong path if:

- ❌ You're creating more than 3 new files
- ❌ You're writing documentation about "future architecture"
- ❌ You're adding authentication/monitoring/backups
- ❌ You're solving problems that don't exist yet
- ❌ It would take > 2 hours to deploy
- ❌ You can't test it locally

---

## Final Advice

> "The best code is simple code that works. Everything else is just overhead."

**This project has failed twice because of over-complexity. Don't make it three times.**

**Start simple. Stay simple. Ship it.**

---

## Your First 30 Minutes

1. ✅ Read this file (you just did!)
2. ⏰ Read README.md (5 min)
3. ⏰ Read LESSONS-LEARNED.md (10 min) - **DON'T SKIP**
4. ⏰ Read HANDOVER.md sections: Current Status, API Endpoints, Next Steps (10 min)
5. ⏰ SSH to Doodah and verify services are running (5 min)

**Then:** Ask the user about Web UI location and approach before coding anything.

---

**Good luck! Keep it simple!**
