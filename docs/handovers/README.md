# Handover Documents

**Knowledge transfer documents for new developers joining the project.**

---

## 📋 CURRENT HANDOVER

**[HANDOVER-CURRENT.md](HANDOVER-CURRENT.md)** - Most up-to-date handover document

This is the document you should read when taking over this project.

---

## 📅 HISTORICAL HANDOVERS

- **[HANDOVER-2025-12-28.md](HANDOVER-2025-12-28.md)** - December 28, 2025 handover

---

## 🗺️ WHAT TO READ

### For New Developers

1. **Start Here:**
   - [../../START-HERE.md](../../START-HERE.md) - System overview
   - [HANDOVER-CURRENT.md](HANDOVER-CURRENT.md) - Current state and context

2. **Then Read:**
   - [../README.md](../README.md) - Documentation index
   - [../QUICKSTART.md](../guides/QUICKSTART.md) - Get system running locally
   - [../deployment/VPS-DETAILS.md](../deployment/VPS-DETAILS.md) - Server access

3. **Architecture:**
   - [../architecture/SCHEDULER.md](../architecture/SCHEDULER.md) - Scheduler architecture
   - [../architecture/DATA-STRUCTURES.md](../architecture/DATA-STRUCTURES.md) - Database schemas
   - [../API.md](../API.md) - API documentation

4. **Recent Issues:**
   - [../incidents/NEW_YEAR_INCIDENT.md](../incidents/NEW_YEAR_INCIDENT.md) - Critical incident to understand
   - [../../LESSONS-LEARNED.md](../../LESSONS-LEARNED.md) - Project lessons

---

## ⚠️ CRITICAL KNOWLEDGE

Things every new developer MUST know:

1. **NO RETRIES** - Message sending uses single attempts only (learned the hard way)
2. **Two Servers** - Frontend (192.209.62.48) and Backend/WhatsApp (5.231.56.146)
3. **SQLite Database** - Located at `/root/whatsapp-vpslink/data/whatsapp.db` on backend
4. **PM2 Processes** - `whatsapp-listener`, `scheduler`, `api-simple` on backend
5. **Idempotency** - System tracks all sent messages to prevent duplicates

---

## 🔗 RELATED DOCS

- [../../PROJECT-STRUCTURE.md](../../PROJECT-STRUCTURE.md) - Project organization
- [../deployment/DEPLOYMENT-CHECKLIST.md](../deployment/DEPLOYMENT-CHECKLIST.md) - Deployment steps
- [../CHANGELOG-DEC-2025.md](../CHANGELOG-DEC-2025.md) - Recent changes

---

Last updated: January 1, 2026
