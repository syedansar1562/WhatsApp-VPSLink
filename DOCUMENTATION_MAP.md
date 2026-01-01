# Documentation Map

**Complete guide to finding the right documentation quickly.**

---

## 🚨 START HERE (By Role)

### I'm New To This Project
1. [README.md](README.md) - Project overview
2. [START-HERE.md](START-HERE.md) - System architecture
3. [docs/guides/QUICKSTART.md](docs/guides/QUICKSTART.md) - Get up and running
4. [docs/handovers/HANDOVER-CURRENT.md](docs/handovers/HANDOVER-CURRENT.md) - Current state

### I'm Debugging An Issue
1. [docs/incidents/](docs/incidents/) - Known incidents and fixes
2. [docs/troubleshooting/](docs/troubleshooting/) - Troubleshooting guides
3. [LESSONS-LEARNED.md](LESSONS-LEARNED.md) - Common mistakes

### I'm Deploying To Production
1. [docs/deployment/DEPLOYMENT-CHECKLIST.md](docs/deployment/DEPLOYMENT-CHECKLIST.md) - Deployment checklist
2. [docs/deployment/VPS-DETAILS.md](docs/deployment/VPS-DETAILS.md) - Server credentials
3. [README.md#deployment-of-fixes](README.md#deployment-of-fixes) - Current deployment steps

### I'm Understanding The Code
1. [docs/architecture/SCHEDULER.md](docs/architecture/SCHEDULER.md) - How scheduler works
2. [docs/architecture/DATA-STRUCTURES.md](docs/architecture/DATA-STRUCTURES.md) - Database schemas
3. [docs/API.md](docs/API.md) - API endpoints

---

## 📂 DIRECTORY STRUCTURE

```
WhatsApp-VPSLink/
│
├── 📄 ROOT LEVEL DOCS (Start Here)
│   ├── README.md                    ⭐ Project overview and quick start
│   ├── START-HERE.md                ⭐ System architecture overview
│   ├── DOCUMENTATION_MAP.md         ⭐ This file - navigation guide
│   ├── PROJECT-STRUCTURE.md         📁 Detailed file structure
│   ├── LESSONS-LEARNED.md           📖 What went wrong and why
│   └── gemini_security.md           🔒 Security considerations
│
├── 📁 docs/ (Organized Documentation)
│   │
│   ├── README.md                    📋 Documentation index
│   ├── INDEX.md                     🔍 Alphabetical index
│   ├── API.md                       🔌 API reference
│   ├── CHANGELOG-DEC-2025.md        📝 December 2025 changes
│   ├── DEPLOYMENT-CHECKLIST.md      ✅ Pre-deployment checklist
│   │
│   ├── 🚨 incidents/                (Critical Issues)
│   │   ├── README.md                - Incident overview
│   │   ├── NEW_YEAR_INCIDENT.md     ⚠️ Jan 1, 2026 duplicate messages
│   │   ├── FIXES_APPLIED.md         🔧 Line-by-line fixes
│   │   ├── PROBLEM_EXPLANATION.md   📖 Simple explanation
│   │   └── NEW_YEAR_LOG.md          📊 Full investigation log
│   │
│   ├── 🏗️ architecture/             (System Design)
│   │   ├── SCHEDULER.md             - How scheduler works
│   │   └── DATA-STRUCTURES.md       - Database schemas
│   │
│   ├── 🚀 deployment/               (Production Deployment)
│   │   ├── DEPLOYMENT.md            - Deployment guide
│   │   ├── VPS-DETAILS.md           - Server access & credentials
│   │   ├── S3-SETUP.md              - S3 configuration
│   │   └── GARAGE-S3-INTEGRATION.md - Garage S3 setup
│   │
│   ├── ✨ features/                 (Feature Documentation)
│   │   ├── MISSING_FEATURES_INDEX.md    - Feature status
│   │   ├── UI-DESIGN.md                 - UI/UX design
│   │   ├── CONTACTS.md                  - Contact management
│   │   ├── SCHEDULE_MODAL_IMPROVEMENTS.md
│   │   ├── timezone-support.md
│   │   ├── message-detail-view.md
│   │   └── FAILED_MESSAGES_AND_RESCHEDULE.md
│   │
│   ├── 📚 guides/                   (User & Developer Guides)
│   │   ├── QUICKSTART.md            ⚡ Get started quickly
│   │   ├── CONTACTS.md              - Managing contacts
│   │   ├── UI-IMPROVEMENTS.md       - UI features
│   │   └── TODAYS_CHANGES_SUMMARY.md - Recent changes
│   │
│   ├── 🤝 handovers/                (Knowledge Transfer)
│   │   ├── README.md                - Handover guide
│   │   ├── HANDOVER-CURRENT.md      ⚡ Current handover doc
│   │   └── HANDOVER-2025-12-28.md   - December 28 handover
│   │
│   ├── 🔧 troubleshooting/          (Problem Solving)
│   │   ├── README.md                - Troubleshooting index
│   │   └── WHY_CHRIS_MESSAGE_DIDNT_SEND.md - Specific issue
│   │
│   ├── 🎨 ui-components/            (UI Component Docs)
│   │   └── README.md
│   │
│   └── 📦 archive/                  (Old Documentation)
│       ├── HANDOVER.md              - Original handover
│       ├── README.old.md            - Old README
│       └── condensed-docs/          - Condensed system docs
│           ├── 01-SYSTEM-OVERVIEW.md
│           ├── 02-WHATSAPP-INTEGRATION.md
│           ├── 03-DATA-SCHEMAS.md
│           ├── 04-SCHEDULER-SERVICE.md
│           ├── 05-WEB-UI-FRONTEND.md
│           ├── 06-CONTACT-MANAGEMENT.md
│           ├── 07-CLI-COMMANDS.md
│           ├── 08-DEPLOYMENT-OPERATIONS.md
│           ├── 09-CURRENT-STATE-FEATURES.md
│           └── 10-QUICK-REFERENCE.md
│
├── 🔄 migration/ (Migration Documentation)
│   ├── s3-to-sqlite/               (S3 to SQLite migration)
│   │   ├── START-HERE.md
│   │   ├── MIGRATION-PLAN.md
│   │   ├── IMPLEMENTATION-CHECKLIST.md
│   │   ├── API-DESIGN.md
│   │   ├── BACKUP-SWITCHING-GUIDE.md
│   │   └── SECURITY-AUDIT.md
│   │
│   └── v2-upgrade/                 (V2 upgrade docs)
│       ├── 00-OVERVIEW.md
│       ├── 01-PHASE-1-IMPLEMENTATION.md
│       ├── 05-DATA-SCHEMAS.md
│       ├── DEPLOYMENT-SUMMARY.md
│       ├── README-FOR-NEXT-CLAUDE.md
│       ├── TIMEZONE_IMPLEMENTATION_RESUME.md
│       └── TIMEZONE-DEPLOYMENT-GUIDE.md
│
└── 💻 frontend/ (Frontend Code & Docs)
    └── app/
        └── scheduled/
            └── page.tsx            (Scheduled messages page - FIXED)
```

---

## 🔍 FIND DOCUMENTATION BY TOPIC

### Architecture & Design
- [docs/architecture/SCHEDULER.md](docs/architecture/SCHEDULER.md) - Scheduler architecture
- [docs/architecture/DATA-STRUCTURES.md](docs/architecture/DATA-STRUCTURES.md) - Database schemas
- [START-HERE.md](START-HERE.md) - System overview
- [docs/archive/condensed-docs/01-SYSTEM-OVERVIEW.md](docs/archive/condensed-docs/01-SYSTEM-OVERVIEW.md) - Old system overview

### API & Integration
- [docs/API.md](docs/API.md) - API endpoints and usage
- [docs/archive/condensed-docs/02-WHATSAPP-INTEGRATION.md](docs/archive/condensed-docs/02-WHATSAPP-INTEGRATION.md) - WhatsApp integration

### Deployment & Operations
- [docs/deployment/DEPLOYMENT.md](docs/deployment/DEPLOYMENT.md) - Deployment guide
- [docs/deployment/VPS-DETAILS.md](docs/deployment/VPS-DETAILS.md) - Server credentials
- [docs/DEPLOYMENT-CHECKLIST.md](docs/DEPLOYMENT-CHECKLIST.md) - Pre-deployment checklist
- [docs/deployment/S3-SETUP.md](docs/deployment/S3-SETUP.md) - S3 configuration

### Features & UI
- [docs/features/MISSING_FEATURES_INDEX.md](docs/features/MISSING_FEATURES_INDEX.md) - Feature status
- [docs/features/UI-DESIGN.md](docs/features/UI-DESIGN.md) - UI design
- [docs/guides/UI-IMPROVEMENTS.md](docs/guides/UI-IMPROVEMENTS.md) - UI improvements

### Contact Management
- [docs/guides/CONTACTS.md](docs/guides/CONTACTS.md) - Contact guide
- [docs/features/CONTACT_RESTORATION_GUIDE.md](docs/features/CONTACT_RESTORATION_GUIDE.md) - Contact restoration
- [docs/features/README_CONTACT_FEATURES.md](docs/features/README_CONTACT_FEATURES.md) - Contact features

### Scheduling
- [docs/architecture/SCHEDULER.md](docs/architecture/SCHEDULER.md) - How it works
- [docs/features/SCHEDULE_MODAL_IMPROVEMENTS.md](docs/features/SCHEDULE_MODAL_IMPROVEMENTS.md) - Modal improvements
- [docs/features/timezone-support.md](docs/features/timezone-support.md) - Timezone handling
- [docs/features/FAILED_MESSAGES_AND_RESCHEDULE.md](docs/features/FAILED_MESSAGES_AND_RESCHEDULE.md) - Failed messages

### Incidents & Debugging
- [docs/incidents/NEW_YEAR_INCIDENT.md](docs/incidents/NEW_YEAR_INCIDENT.md) - Jan 1 2026 incident
- [docs/incidents/FIXES_APPLIED.md](docs/incidents/FIXES_APPLIED.md) - Applied fixes
- [docs/incidents/PROBLEM_EXPLANATION.md](docs/incidents/PROBLEM_EXPLANATION.md) - Simple explanation
- [docs/troubleshooting/WHY_CHRIS_MESSAGE_DIDNT_SEND.md](docs/troubleshooting/WHY_CHRIS_MESSAGE_DIDNT_SEND.md) - Specific debug

### Migration & History
- [migration/s3-to-sqlite/START-HERE.md](migration/s3-to-sqlite/START-HERE.md) - S3 migration
- [migration/v2-upgrade/00-OVERVIEW.md](migration/v2-upgrade/00-OVERVIEW.md) - V2 upgrade
- [docs/CHANGELOG-DEC-2025.md](docs/CHANGELOG-DEC-2025.md) - Recent changes
- [LESSONS-LEARNED.md](LESSONS-LEARNED.md) - Project lessons

### Handovers & Knowledge Transfer
- [docs/handovers/HANDOVER-CURRENT.md](docs/handovers/HANDOVER-CURRENT.md) - Current handover
- [docs/handovers/HANDOVER-2025-12-28.md](docs/handovers/HANDOVER-2025-12-28.md) - December 28 handover
- [docs/archive/HANDOVER.md](docs/archive/HANDOVER.md) - Original handover

---

## 📊 DOCUMENTATION BY STATUS

### ✅ Current & Active
- README.md
- START-HERE.md
- docs/incidents/ (all)
- docs/architecture/ (all)
- docs/deployment/ (all)
- docs/guides/QUICKSTART.md
- docs/handovers/HANDOVER-CURRENT.md

### 📦 Archive (Historical Reference)
- docs/archive/
- migration/s3-to-sqlite/
- migration/v2-upgrade/
- docs/handovers/HANDOVER-2025-12-28.md

### ⚠️ Needs Update (Post-Incident)
- docs/architecture/SCHEDULER.md (should reflect no-retry policy)
- docs/deployment/DEPLOYMENT.md (should include idempotency table)

---

## 🎯 COMMON SCENARIOS

### Scenario: "I need to deploy the fixed code"
1. [README.md#deployment-of-fixes](README.md#deployment-of-fixes)
2. [docs/incidents/FIXES_APPLIED.md](docs/incidents/FIXES_APPLIED.md)
3. [docs/deployment/DEPLOYMENT-CHECKLIST.md](docs/deployment/DEPLOYMENT-CHECKLIST.md)

### Scenario: "Why are messages duplicating?"
1. [docs/incidents/PROBLEM_EXPLANATION.md](docs/incidents/PROBLEM_EXPLANATION.md)
2. [docs/incidents/NEW_YEAR_INCIDENT.md](docs/incidents/NEW_YEAR_INCIDENT.md)
3. [docs/incidents/FIXES_APPLIED.md](docs/incidents/FIXES_APPLIED.md)

### Scenario: "How do I schedule a message?"
1. [docs/guides/QUICKSTART.md](docs/guides/QUICKSTART.md)
2. [docs/API.md](docs/API.md)
3. [README.md#common-tasks](README.md#common-tasks)

### Scenario: "WhatsApp won't connect"
1. [README.md#troubleshooting](README.md#troubleshooting)
2. [docs/troubleshooting/](docs/troubleshooting/)
3. [docs/deployment/VPS-DETAILS.md](docs/deployment/VPS-DETAILS.md)

### Scenario: "I'm taking over this project"
1. [README.md](README.md)
2. [START-HERE.md](START-HERE.md)
3. [docs/handovers/HANDOVER-CURRENT.md](docs/handovers/HANDOVER-CURRENT.md)
4. [docs/incidents/NEW_YEAR_INCIDENT.md](docs/incidents/NEW_YEAR_INCIDENT.md) (critical to understand)
5. [LESSONS-LEARNED.md](LESSONS-LEARNED.md)

### Scenario: "I need server credentials"
1. [docs/deployment/VPS-DETAILS.md](docs/deployment/VPS-DETAILS.md)

### Scenario: "What changed in December?"
1. [docs/CHANGELOG-DEC-2025.md](docs/CHANGELOG-DEC-2025.md)
2. [docs/handovers/HANDOVER-2025-12-28.md](docs/handovers/HANDOVER-2025-12-28.md)

---

## 📝 DOCUMENTATION CONVENTIONS

### File Naming
- **ALL_CAPS.md** - Important top-level docs
- **Title-Case.md** - Feature/guide docs
- **lowercase.md** - Component/specific docs
- **01-PREFIX.md** - Sequential/numbered docs

### Directory Purpose
- `/docs/` - All organized documentation
- `/docs/incidents/` - Critical issues and fixes
- `/docs/architecture/` - System design
- `/docs/deployment/` - Production deployment
- `/docs/features/` - Feature documentation
- `/docs/guides/` - User & developer guides
- `/docs/handovers/` - Knowledge transfer
- `/docs/troubleshooting/` - Problem solving
- `/docs/archive/` - Historical reference
- `/migration/` - Migration documentation

### Emoji Guide
- ⭐ Essential/must-read
- ⚡ Quick start/fast
- ⚠️ Warning/critical
- 🚨 Urgent/incident
- 📖 Detailed explanation
- 🔧 Fix/solution
- 📊 Data/analysis
- 🔒 Security
- 📁 Structure/organization
- ✅ Checklist/action items

---

## 🔗 EXTERNAL LINKS

- **GitHub:** https://github.com/syedansar1562/WhatsApp-VPSLink
- **Frontend Server:** http://192.209.62.48
- **Backend API:** http://5.231.56.146:3001

---

Last updated: January 1, 2026
