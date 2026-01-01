# Incident Reports & Post-Mortems

**Critical incidents, debugging sessions, and their resolutions.**

---

## 🚨 CRITICAL INCIDENTS

### Jan 1, 2026: New Year's Message Duplication Disaster

**Status:** FIXED (awaiting deployment)
**Severity:** CRITICAL
**Impact:** Messages sent 4-7 times to recipients, severe embarrassment

#### Documents:
1. **[NEW_YEAR_INCIDENT.md](NEW_YEAR_INCIDENT.md)** - Complete incident report with technical details
2. **[FIXES_APPLIED.md](FIXES_APPLIED.md)** - Line-by-line code fixes documentation
3. **[PROBLEM_EXPLANATION.md](PROBLEM_EXPLANATION.md)** - Simple explanation for non-technical review
4. **[NEW_YEAR_LOG.md](NEW_YEAR_LOG.md)** - Full investigation log with evidence

#### Quick Summary:
- **Problem**: Retry logic sent messages multiple times when network confirmations were slow
- **Root Cause**: Aggressive retry loop without idempotency checks
- **Fix**: Removed all retries, added idempotency tracking, added status re-checks
- **Lessons**: Network retries are dangerous in distributed systems

---

## 🔍 SPECIFIC ISSUE INVESTIGATIONS

### Why Chris's Message Didn't Send
**File:** [../troubleshooting/WHY_CHRIS_MESSAGE_DIDNT_SEND.md](../troubleshooting/WHY_CHRIS_MESSAGE_DIDNT_SEND.md)

Investigation into a specific message delivery failure.

---

## 📊 INCIDENT SUMMARY

| Date | Incident | Severity | Status | Documents |
|------|----------|----------|--------|-----------|
| Jan 1, 2026 | Duplicate Messages | CRITICAL | Fixed (not deployed) | [NEW_YEAR_INCIDENT.md](NEW_YEAR_INCIDENT.md) |
| Dec 2025 | Chris Message Failure | Minor | Resolved | [WHY_CHRIS_MESSAGE_DIDNT_SEND.md](../troubleshooting/WHY_CHRIS_MESSAGE_DIDNT_SEND.md) |

---

## 🛡️ PREVENTION MEASURES

Based on incidents, we've implemented:

1. **Idempotency Tracking** - Track every message sent to prevent duplicates
2. **No Retries** - Single send attempts only, trust WhatsApp's infrastructure
3. **Status Re-Checks** - Always verify status before sending
4. **Intermediate States** - "sending" status prevents concurrent sends
5. **Comprehensive Logging** - All send attempts logged with outcomes

---

## 📝 INCIDENT REPORT TEMPLATE

When documenting a new incident, include:

1. **Executive Summary**
   - What happened
   - Impact on users
   - Current status

2. **Timeline**
   - When incident started
   - When discovered
   - When resolved

3. **Technical Investigation**
   - Log analysis
   - Code review
   - Root cause identification

4. **Root Cause**
   - What exactly went wrong
   - Why the bug existed
   - Why it wasn't caught earlier

5. **Fixes Applied**
   - Code changes
   - Configuration changes
   - Process changes

6. **Prevention Measures**
   - How to prevent recurrence
   - Monitoring improvements
   - Testing improvements

7. **Lessons Learned**
   - Technical lessons
   - Process lessons
   - Communication lessons

---

## 🔗 RELATED DOCUMENTATION

- [CHANGELOG-DEC-2025.md](../CHANGELOG-DEC-2025.md) - All changes made in December
- [LESSONS-LEARNED.md](../../LESSONS-LEARNED.md) - Project-wide lessons learned
- [troubleshooting/](../troubleshooting/) - General troubleshooting guides

---

Last updated: January 1, 2026
