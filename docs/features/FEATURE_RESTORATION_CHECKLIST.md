# Feature Restoration Checklist - WhatsApp VPSLink Dark Theme UI

> Complete checklist of ALL features that need to be restored in the new dark theme UI

## PHASE 1: CRITICAL PAGES & LAYOUTS

### Authentication & Core Pages
- [ ] Create `/app/login/page.tsx` - Password authentication
- [ ] Create `/app/dashboard/page.tsx` - Stats overview
- [ ] Create `/app/contacts/page.tsx` - Contact management
- [ ] Create `/app/schedule/page.tsx` - Schedule new message or modal
- [ ] Create `/app/scheduled/page.tsx` - View all scheduled messages

### Layout Components
- [ ] Implement Sidebar navigation (fixed 240px left)
- [ ] Implement Floating "+ New Message" button (top-right)
- [ ] Implement Main Layout wrapper with Sidebar + Content
- [ ] Implement Modal/Dialog component system
- [ ] Implement Dark theme styling (#0a0a0a background, #1a1a1a surface)

---

## PHASE 2: CONTACT MANAGEMENT

### Contact Display
- [ ] List all 272 contacts in table format
- [ ] Sort contacts alphabetically
- [ ] Mark favorite contacts with ★ star
- [ ] Display visual hierarchy (bold name, gray phone, small italic aliases)
- [ ] Display secondary phone with "Alt:" prefix
- [ ] Show aliases under contact name

### Contact Search & Filtering
- [ ] Add search input field (real-time filtering)
- [ ] Search by name (case-insensitive, partial match)
- [ ] Search by phone number
- [ ] Search by aliases
- [ ] Add "All Contacts" filter tab
- [ ] Add "Favorites Only" filter tab
- [ ] Show count in filter tabs ("All Contacts (272)")

### Contact Editing
- [ ] Add "Edit" button for each contact
- [ ] Create edit modal with form
- [ ] Edit contact name field
- [ ] Edit primary phone field
- [ ] Edit secondary phone field
- [ ] Edit aliases field (comma-separated)
- [ ] Save button with S3 persistence
- [ ] Cancel button to close modal
- [ ] Handle validation errors

### Contact Favorites
- [ ] Add ★ star icon to each contact row
- [ ] Toggle favorite status on click
- [ ] Visual feedback (filled/empty star)
- [ ] Real-time S3 update
- [ ] Sort favorites to top of list
- [ ] Refresh all pages when favorite changed

### Contact Advanced Features
- [ ] Display contact notes (if present)
- [ ] Display contact tags (if present)
- [ ] Add notes editor to edit modal
- [ ] Add tags editor to edit modal

---

## PHASE 3: CONTACT IMPORT/EXPORT

### Import Features
- [ ] Add "Import VCF" button in contacts page
- [ ] Create file upload interface
- [ ] Parse VCF files (FN, TEL extraction)
- [ ] Auto-detect UK numbers (convert 0 to 44)
- [ ] Merge with existing contacts
- [ ] Show progress indicator
- [ ] Show confirmation message

### Export Features
- [ ] Add "Export Contacts" button
- [ ] Export to CSV format
- [ ] Export to readable text format
- [ ] Download file to user's computer
- [ ] Show confirmation message

### Bulk Operations
- [ ] Bulk add tags to multiple contacts
- [ ] Bulk mark as favorites
- [ ] Bulk delete contacts (with confirmation)

---

## PHASE 4: MESSAGE SCHEDULING

### Schedule Page/Modal
- [ ] Create schedule interface (page or modal)
- [ ] Contact picker dropdown (searchable)
- [ ] Type-to-search contact selection
- [ ] Search by name, alias, or phone
- [ ] Show favorites in favorites tab
- [ ] Show all contacts in all tab
- [ ] Display selected contact with details
- [ ] Message textarea input
- [ ] Date picker (UK timezone aware)
- [ ] Time picker (UK timezone aware)
- [ ] Timezone indicator display
- [ ] Schedule button to save
- [ ] Cancel button
- [ ] Form validation

### Scheduled Messages Page
- [ ] List all scheduled messages in table
- [ ] Display contact name
- [ ] Display message preview (truncated)
- [ ] Display scheduled time (UK format)
- [ ] Display status badge (pending/sent/failed)
- [ ] Status colors (orange/green/red)
- [ ] Edit button for each message
- [ ] Delete button for each message
- [ ] Filter tabs: All/Pending/Sent/Failed
- [ ] Search/filter messages
- [ ] Show message count for each status

### Message Editing
- [ ] Edit modal for scheduled message
- [ ] Change recipient contact
- [ ] Change message text
- [ ] Change scheduled time
- [ ] Save changes to S3
- [ ] Cancel without saving

### Message Deletion
- [ ] Delete button on each message
- [ ] Confirmation dialog before delete
- [ ] Remove from S3
- [ ] Update UI

### Message Status Tracking
- [ ] Display status badge (pending/sent/failed)
- [ ] Color coded (orange/green/red)
- [ ] Show sent timestamp
- [ ] Show error message if failed
- [ ] Update status when scheduler sends

---

## PHASE 5: DASHBOARD & ANALYTICS

### Dashboard Page
- [ ] Create dashboard page
- [ ] Display pending count card
- [ ] Display sent count card
- [ ] Display total count card
- [ ] Update statistics in real-time
- [ ] Show last updated timestamp

### Upcoming Messages Widget
- [ ] List next 5 scheduled messages
- [ ] Show contact name
- [ ] Show message preview
- [ ] Show scheduled time
- [ ] Show status badge
- [ ] Sort by scheduled time
- [ ] Link to view all scheduled

### Dashboard Stats
- [ ] Calculate pending count from API
- [ ] Calculate sent count from API
- [ ] Calculate total count from API
- [ ] Format numbers with commas if needed
- [ ] Update when navigating to dashboard

---

## PHASE 6: UI/UX POLISH

### Dark Theme Colors
- [ ] Implement background color (#0a0a0a)
- [ ] Implement surface color (#1a1a1a)
- [ ] Implement elevated surface (#2d2d2d)
- [ ] Implement text colors (#ffffff, #a3a3a3, #737373)
- [ ] Implement accent blue (#3b82f6)
- [ ] Implement status colors (green/orange/red)
- [ ] Implement border color (#404040)

### Animations & Transitions
- [ ] Fade-in animation for modals
- [ ] Slide-up animation for modals
- [ ] Hover transitions (150ms) for interactive elements
- [ ] Page transitions (200ms)
- [ ] Button click animation (scale 95%)
- [ ] Status badge color transitions

### Responsive Design
- [ ] Mobile layout (< 640px)
  - [ ] Sidebar collapse to hamburger menu
  - [ ] + button move to bottom-right
  - [ ] Stack stats cards vertically
  - [ ] Table to card list conversion
- [ ] Tablet layout (640-1024px)
  - [ ] Sidebar stays visible
  - [ ] Content adjusts width
  - [ ] 2-column layouts where appropriate
- [ ] Desktop layout (> 1024px)
  - [ ] Full sidebar visible
  - [ ] Multi-column layouts
  - [ ] Large table displays

### Accessibility
- [ ] ARIA labels on all interactive elements
- [ ] Keyboard navigation (Tab order)
- [ ] Escape to close modals
- [ ] Enter to submit forms
- [ ] Focus states on inputs/buttons
- [ ] Screen reader support
- [ ] Semantic HTML (nav, main, section, etc.)

---

## PHASE 7: AUTHENTICATION & SECURITY

### Login Page
- [ ] Password input field
- [ ] Submit button
- [ ] Error message display
- [ ] Redirect to dashboard on success
- [ ] Prevent access to other pages without login

### Session Management
- [ ] Set auth cookie on login
- [ ] Check auth cookie on page load
- [ ] Middleware to protect routes
- [ ] Logout button in sidebar
- [ ] Clear session on logout
- [ ] Redirect to login after logout

### API Integration
- [ ] POST /api/auth/login endpoint
- [ ] Verify password from environment
- [ ] Set secure cookie
- [ ] Handle invalid password

---

## PHASE 8: DATA PERSISTENCE

### S3 Integration
- [ ] Read contacts from S3 on page load
- [ ] Write contacts to S3 on edit/save
- [ ] Read scheduled messages from S3
- [ ] Write scheduled messages to S3
- [ ] Handle S3 errors gracefully
- [ ] Show loading indicators during fetch
- [ ] Show error messages on failure
- [ ] Optimistic UI updates

### API Routes
- [ ] POST /api/auth/login - Login
- [ ] GET /api/contacts - Fetch all contacts
- [ ] POST /api/contacts - Save contacts
- [ ] GET /api/scheduled - Fetch scheduled messages
- [ ] POST /api/scheduled - Save scheduled messages
- [ ] (Optional) PUT /api/contacts/:id - Update single contact
- [ ] (Optional) DELETE /api/scheduled/:id - Delete message

### Error Handling
- [ ] Network error messages
- [ ] S3 connection errors
- [ ] Invalid form data messages
- [ ] Duplicate contact handling
- [ ] Retry on transient failures

---

## PHASE 9: SETTINGS

### Settings Page (Optional)
- [ ] Timezone setting (Europe/London)
- [ ] Password change form
- [ ] Display preferences
- [ ] Notification settings
- [ ] Account info display

### User Profile
- [ ] Display user name/avatar in sidebar
- [ ] Logout button in profile section
- [ ] Link to settings

---

## PHASE 10: ADVANCED FEATURES (Lower Priority)

### Contact Advanced
- [ ] Recent contacts filter
  - [ ] Parse chats.json
  - [ ] Show last 20 contacted people
  - [ ] Sort by last message date
- [ ] Contact groups/categories
  - [ ] Display tags on contacts
  - [ ] Filter by tag
  - [ ] Edit tags in modal
- [ ] Bulk operations
  - [ ] Select multiple contacts
  - [ ] Bulk tag assignment
  - [ ] Bulk favorite toggle
  - [ ] Bulk delete

### Scheduled Messages Advanced
- [ ] Recurring messages (Daily/Weekly/Monthly)
  - [ ] Add frequency selector to schedule form
  - [ ] Cron-like syntax support
  - [ ] Show next 5 occurrences
- [ ] Retry failed messages
  - [ ] Show retry button for failed messages
  - [ ] Automatic retry with backoff
  - [ ] Retry count display
- [ ] Message templates
  - [ ] Save message templates
  - [ ] Load template on schedule
  - [ ] Edit template list

### Analytics & Reports (Future)
- [ ] Messages sent per day/week/month chart
- [ ] Top contacted people chart
- [ ] Message delivery success rate
- [ ] Export analytics report
- [ ] Date range filter for stats

---

## REFERENCE MATERIALS TO USE

### Documentation
```
/docs/UI-DESIGN.md                   - Complete design specification (534 lines)
/docs/MISSING_CONTACT_FEATURES.md    - Contact features (486 lines)
/docs/guides/UI-IMPROVEMENTS.md      - UI improvements (402 lines)
/docs/archive/HANDOVER.md            - Full handover (1722 lines)
/docs/architecture/SCHEDULER.md      - Scheduler docs (753 lines)
/docs/CONTACTS.md                    - Contact guide
```

### Component References
```
/docs/ui-components/README.md        - Component guide
/docs/ui-components/Sidebar.tsx      - Sidebar component (example)
/docs/ui-components/ScheduleButton.tsx - FAB button (example)
/docs/ui-components/ScheduleModal.tsx  - Modal component (example)
/docs/ui-components/Layout.tsx       - Layout wrapper (example)
```

### Backend APIs
```
/lib/s3.ts                           - S3 utilities
POST /api/auth/login                 - Login endpoint
GET /api/contacts                    - Get contacts
POST /api/contacts                   - Save contacts
GET /api/scheduled                   - Get scheduled messages
POST /api/scheduled                  - Save scheduled messages
```

### Data Structures
```
contacts.json:
{
  "447957189696": {
    "name": "Reem",
    "aliases": ["Reemy", "R", "Sister"],
    "phones": {
      "primary": "447957189696",
      "secondary": null
    },
    "favorite": true,
    "tags": ["family"],
    "notes": "..."
  }
}

scheduled.json:
{
  "messages": [
    {
      "id": "1735168500123_a1b2c3",
      "to": "447957189696",
      "contactName": "Reem",
      "message": "Happy Birthday!",
      "scheduledTime": "2025-12-24T10:00:00.000Z",
      "status": "pending|sent|failed",
      "createdAt": "2025-12-22T22:15:00.000Z",
      "sentAt": null,
      "error": null
    }
  ]
}
```

---

## ESTIMATED EFFORT

| Phase | Feature | Hours | Priority |
|-------|---------|-------|----------|
| 1 | Core Pages & Layouts | 8 | CRITICAL |
| 2 | Contact Management | 12 | CRITICAL |
| 3 | Import/Export | 6 | HIGH |
| 4 | Message Scheduling | 10 | CRITICAL |
| 5 | Dashboard & Analytics | 6 | HIGH |
| 6 | UI/UX Polish | 8 | MEDIUM |
| 7 | Auth & Security | 4 | CRITICAL |
| 8 | Data Persistence | 4 | CRITICAL |
| 9 | Settings | 3 | LOW |
| 10 | Advanced Features | 12 | LOW |
| **Total** | | **73 hours** | |

**Critical Path (Minimum viable):** Phases 1, 2, 4, 7, 8 = ~38 hours
**Full Restoration:** All phases = ~73 hours

---

## NOTES

- All backend APIs and data structures are 100% ready
- Design specification is complete in `/docs/UI-DESIGN.md`
- Component examples available in `/docs/ui-components/`
- No new backend development needed - only frontend restoration
- S3 credentials and connections already configured
- Database/contacts already populated (272 contacts)
- Scheduler worker already running on VPS

---

**Created:** December 23, 2025
**Status:** Ready for implementation
**Backend Status:** 92% complete
**Frontend Status:** 0% - needs full restoration
