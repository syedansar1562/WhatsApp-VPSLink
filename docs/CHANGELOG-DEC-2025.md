# Changelog - December 2025

All notable changes made to the WhatsApp VPSLink project during December 2025.

---

## [2.0.0] - December 24, 2025

### 🌍 Timezone Support Feature

#### Added
- **Timezone utilities library** (`lib/timezones.ts`)
  - 240+ country code to timezone mappings
  - IANA timezone identifiers
  - Automatic DST handling
  - 24 common timezones for manual selection
  - Phone number to timezone auto-detection
  - Display formatting utilities

- **Contact timezone management** (`app/contacts/page.tsx`)
  - Timezone field in Contact interface
  - Timezone dropdown with 24 common options
  - Auto-detection hint from phone country code
  - Globe icon display in contacts table
  - Fixed Add Contact button overlap issue
  - Responsive header layout for mobile devices

- **Schedule modal timezone selector** (`components/ScheduleModal.tsx`)
  - Changed from toggle buttons to clean dropdown
  - "UK Time" and "Their Time" options
  - Dynamic timezone display
  - Automatic timezone conversion
  - Metadata storage for single and multi-part messages

- **Dashboard dual time display** (`app/dashboard/page.tsx`)
  - UK time + recipient timezone (when different)
  - Globe icon for international times
  - Contact name resolution for multi-part messages
  - Displays in upcoming and failed messages sections

- **Scheduled page dual time display** (`app/scheduled/page-unified.tsx`)
  - Dual time display in table view
  - Timezone metadata support
  - Works with all message types

- **Migration endpoint** (`app/api/contacts/migrate-timezones/route.ts`)
  - Auto-assigns timezones to existing contacts
  - Based on phone number country codes
  - Successful migration of 272 contacts

#### Changed
- Contact interface now includes optional `timezone` field
- ScheduledMessage interface includes timezone metadata
- All times stored in UTC in S3
- Display conversions happen client-side

#### Migration
- Ran timezone migration on Dec 24, 2025
- All 272 contacts assigned timezones based on phone numbers
- Endpoint: `POST /api/contacts/migrate-timezones`

---

### 📋 Message Detail View Feature

#### Added
- **MessageDetailModal component** (`components/MessageDetailModal.tsx`)
  - Comprehensive message information display
  - Recipient details (name + phone)
  - Dual timezone display (UK + local)
  - Full message content preview
  - Status indicators with timestamps
  - Edit button for pending messages
  - Error details for failed messages
  - Responsive design with dark theme

- **Click-to-view functionality**
  - Dashboard: Click any message to view details
  - Scheduled page: Click table row to view details
  - Replaces confusing "click to schedule" behavior

- **Contact name resolution for multi-part messages**
  - Loads contacts on dashboard mount
  - Resolves phone numbers to contact names
  - No more generic "Multi-part message" text

#### Changed
- Dashboard now loads contacts alongside messages
- Upcoming messages click handler opens detail modal
- Failed messages click handler opens detail modal (unified with success modal)
- Scheduled page table rows are clickable

#### Fixed
- Multi-part messages now show actual recipient names
- Improved user experience with comprehensive message views
- Better error information display

---

### 🔧 UI Improvements

#### Fixed
- **Add Contact button overlap** (`app/contacts/page.tsx`)
  - Fixed overlapping with floating schedule button
  - Added `hideScheduleButton` prop to Layout
  - Contacts page now hides floating "+" button
  - Improved responsive header layout
  - Added flex-shrink-0 to prevent button compression

- **Schedule timezone selector** (`components/ScheduleModal.tsx`)
  - Changed from two large toggle buttons to dropdown
  - Cleaner UI that saves screen space
  - Better mobile experience

#### Added
- **Dhaka timezone** to COMMON_TIMEZONES list
  - Added "UTC+06 Dhaka, Bangladesh"
  - Total of 24 common timezones available

#### Changed
- Layout component now accepts `hideScheduleButton` prop
- Search and favorites section now stacks vertically on mobile
- Improved button whitespace handling

---

### 📁 Files Created

```
lib/timezones.ts
app/api/contacts/migrate-timezones/route.ts
components/MessageDetailModal.tsx
components/Layout.tsx (copied from VPS)
components/ScheduleButton.tsx (copied from VPS)
components/Sidebar.tsx (copied from VPS)
docs/features/timezone-support.md
docs/features/message-detail-view.md
docs/CHANGELOG-DEC-2025.md
```

### 📝 Files Modified

```
lib/s3.ts - Updated Contact and ScheduledMessage interfaces
app/contacts/page.tsx - Added timezone field and fixed layout
components/ScheduleModal.tsx - Changed to dropdown, added timezone logic
app/dashboard/page.tsx - Added dual time display and detail modal
app/scheduled/page-unified.tsx - Added dual time display and detail modal
```

---

## Deployment Details

### Production Deployment
- **Date**: December 24, 2025
- **VPS**: 192.209.62.48 (Saadi VPS)
- **Process**: whatsapp-web (PM2)
- **Build**: Successful
- **Status**: ✅ Live

### Build Output
```
Route (app)                                 Size  First Load JS
├ ○ /contacts                            3.43 kB         118 kB
├ ○ /dashboard                           3.78 kB         118 kB
├ ○ /scheduled                            2.7 kB         117 kB
```

### Migration Results
```json
{
  "success": true,
  "totalContacts": 272,
  "updatedCount": 272,
  "message": "Successfully assigned timezones to 272 contacts"
}
```

---

## Technical Specifications

### Dependencies
- No new npm packages required
- Uses browser's native `Intl.DateTimeFormat` API
- IANA timezone database (built into browsers)

### Browser Compatibility
- Chrome 24+
- Firefox 29+
- Safari 10+
- Edge 12+

### Performance Impact
- Minimal: Client-side timezone conversions
- Contact loading: +~50ms on dashboard mount
- No additional server requests
- Modal renders on-demand only

---

## Testing Completed

### Timezone Feature
- [x] Contacts show timezone column with globe icon
- [x] Timezone dropdown works in contact form
- [x] Auto-detection hint displays correctly
- [x] Schedule modal timezone dropdown functions
- [x] UK and recipient times display on dashboard
- [x] Scheduled page shows dual times
- [x] Messages scheduled for correct local time
- [x] Migration endpoint works correctly

### Message Detail View
- [x] Click message on dashboard opens modal
- [x] Click message on scheduled page opens modal
- [x] Modal shows correct information
- [x] Edit button works for pending messages
- [x] Close actions work (button, ESC, outside click)
- [x] Multi-part messages show contact names
- [x] Failed messages show error details
- [x] Responsive on all screen sizes

### UI Fixes
- [x] Add Contact button no longer overlaps
- [x] Timezone dropdown cleaner than toggles
- [x] Mobile responsive layouts work
- [x] Dhaka appears in timezone list

---

## Breaking Changes

None. All changes are backwards compatible.

---

## Known Issues

None currently identified.

---

## Future Enhancements

### Potential Improvements
1. Bulk timezone updates
2. Timezone change history tracking
3. Business hours conflict warnings
4. Time preview before scheduling
5. Message history in detail modal
6. Delete from detail modal
7. WhatsApp delivery status integration

---

## Documentation

### New Documentation
- `docs/features/timezone-support.md` - Complete timezone feature guide
- `docs/features/message-detail-view.md` - Message modal documentation
- `docs/CHANGELOG-DEC-2025.md` - This changelog

### Updated Documentation
- Feature index updated with new features
- Architecture diagrams to be updated (pending)

---

## Contributors

- Claude AI (Anthropic)
- Saadi (Product Owner)

---

## Notes

### Development Environment
- Local development: `/Users/saadi/Documents/GitHub/WhatsApp-VPSLink/upgrade`
- Production: `/var/www/whatsapp-scheduler/` on VPS

### Upgrade Folder Status
The `/upgrade` folder contains all development work for these features.
Files have been deployed to production VPS.
Folder can be archived or removed after documentation is complete.

---

## Version History

- **2.0.0** (Dec 24, 2025) - Timezone support + Message detail view
- **1.0.0** (Earlier) - Initial WhatsApp scheduler system

---

**End of Changelog**
