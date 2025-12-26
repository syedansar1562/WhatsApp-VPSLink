# 🌍 Timezone Support Feature

**Implementation Date:** December 24, 2025
**Status:** ✅ Deployed to Production
**Version:** 1.0.0

---

## Overview

The Timezone Support feature enables users to schedule WhatsApp messages in recipients' local timezones, ensuring messages arrive at appropriate times regardless of where contacts are located globally.

## Features Implemented

### 1. **Timezone Library** (`lib/timezones.ts`)
- 240+ country code-to-timezone mappings
- IANA timezone identifiers with automatic DST handling
- 24 common timezones for manual selection
- Phone number-to-timezone auto-detection
- Display formatting utilities

### 2. **Contact Timezone Management** (`app/contacts/page.tsx`)
- Timezone field added to Contact interface
- Dropdown selector with 24 common timezones
- Auto-detection hint based on phone country code
- Globe icon display in contacts table
- Persistent timezone storage in S3

### 3. **Schedule Modal Enhancement** (`components/ScheduleModal.tsx`)
- Timezone dropdown selector (UK Time / Their Time)
- Dynamic timezone display
- Automatic timezone conversion on scheduling
- Metadata storage for both single and multi-part messages

### 4. **Dashboard Dual Time Display** (`app/dashboard/page.tsx`)
- Shows UK time + recipient timezone (when different)
- Globe icon for international times
- Displayed in both upcoming messages and failed messages sections
- Contact name resolution for multi-part messages

### 5. **Scheduled Page Dual Time Display** (`app/scheduled/page-unified.tsx`)
- Dual time display in table view
- Timezone metadata support for all message types
- Click-to-view message details

### 6. **Migration Endpoint** (`app/api/contacts/migrate-timezones/route.ts`)
- One-time auto-assignment of timezones to existing contacts
- Based on phone number country codes
- Successfully migrated 272 contacts

###  7. **Message Detail Modal** (`components/MessageDetailModal.tsx`)
- Comprehensive message information view
- Recipient details with contact name and phone
- Dual timezone display (UK + recipient local time)
- Message content preview
- Status indicators
- Edit button for pending messages
- Click-to-open from dashboard and scheduled pages

---

## Technical Implementation

### Data Structures

#### Contact Interface (lib/s3.ts)
```typescript
interface Contact {
  name: string;
  phones: {
    primary: string;
    secondary: string | null;
  };
  defaultPhone: 'primary' | 'secondary';
  aliases: string[];
  favorite: boolean;
  tags: string[];
  timezone: string; // IANA timezone identifier (e.g., "Asia/Dubai")
}
```

#### ScheduledMessage Metadata
```typescript
interface ScheduledMessage {
  // ... existing fields
  recipientTimezone?: string; // IANA timezone
  recipientLocalTime?: string; // Display string
  scheduledInTimezone?: string; // Which timezone user scheduled in
}
```

#### Job Timezone Metadata
```typescript
interface Job {
  // ... existing fields
  timezoneMetadata?: {
    recipientTimezone: string;
    recipientLocalTime: string;
    scheduledInTimezone: string;
  };
}
```

### Timezone Conversion Logic

1. **User schedules message**:
   - Selects either "UK Time" or "Their Time" from dropdown
   - Picks date and time
   - System converts to UTC for storage

2. **Storage**:
   - All times stored in UTC in S3
   - Timezone metadata stored alongside for display

3. **Display**:
   - UK time: Convert UTC → Europe/London
   - Recipient time: Convert UTC → Contact's timezone
   - Uses browser's `Intl.DateTimeFormat` API

### Phone-to-Timezone Mapping

```typescript
const PHONE_TO_TIMEZONE: Record<string, string> = {
  '1': 'America/New_York',    // USA/Canada
  '44': 'Europe/London',       // UK
  '91': 'Asia/Kolkata',        // India
  '971': 'Asia/Dubai',         // UAE
  '880': 'Asia/Dhaka',         // Bangladesh
  // ... 240+ mappings
};
```

---

## User Interface

### Contact Timezone Selection
![Contact Timezone Dropdown]
- Dropdown shows "UTC+XX City, Country" format
- Auto-detection hint: "Detected from +971: Dubai"
- Globe icon (🌍) in contacts table

### Schedule Modal
![Schedule Modal Timezone Selector]
- Dropdown with two options:
  - "UK Time (UTC+00 London, UK)"
  - "Their Time (UTC+XX City, Country)"
- Disabled when no contact selected

### Dashboard Display
```
Nick Woolliams
hey nick, merry xmas dude. Hope you guys are alright.

🇬🇧 UK: 25/12/2024, 10:00
🌍 Their time: 25/12/2024, 14:00 (Asia/Dubai)
```

### Message Detail Modal
```
┌─────────────────────────────────────┐
│ Message Details                  ✕  │
├─────────────────────────────────────┤
│ 👤 Recipient                        │
│ Nick Woolliams                      │
│ +971501234567                       │
│                                     │
│ 🕒 Scheduled Time                   │
│ 🇬🇧 UK Time                         │
│ Tuesday, 25 December 2024, 10:00   │
│ ─────────────────────────────      │
│ 🌍 Recipient Local Time             │
│ Tuesday, 25 December 2024, 14:00   │
│                                     │
│ 💬 Message                          │
│ hey nick, merry xmas dude...       │
│                                     │
│ ⏳ Status: Pending                  │
├─────────────────────────────────────┤
│ [Edit Message]        [Close]      │
└─────────────────────────────────────┘
```

---

## API Endpoints

### POST `/api/contacts/migrate-timezones`
Auto-assigns timezones to existing contacts based on phone numbers.

**Response:**
```json
{
  "success": true,
  "totalContacts": 272,
  "updatedCount": 272,
  "message": "Successfully assigned timezones to 272 contacts"
}
```

---

## Files Modified/Created

### New Files
```
lib/timezones.ts                           # Timezone utilities library
app/api/contacts/migrate-timezones/        # Migration endpoint
  └── route.ts
components/MessageDetailModal.tsx          # Message detail view component
```

### Modified Files
```
lib/s3.ts                                  # Updated Contact interface
app/contacts/page.tsx                      # Added timezone field
components/ScheduleModal.tsx               # Added timezone dropdown
app/dashboard/page.tsx                     # Added dual time display
app/scheduled/page-unified.tsx             # Added dual time display
```

---

## Configuration

### Common Timezones (24 total)
1. UTC+00 London, UK
2. UTC+01 Paris, France
3. UTC+01 Berlin, Germany
4. UTC+03 Istanbul, Turkey
5. UTC+04 Dubai, UAE
6. UTC+05 Karachi, Pakistan
7. UTC+05:30 Mumbai, India
8. UTC+06 Dhaka, Bangladesh
9. UTC+07 Bangkok, Thailand
10. UTC+08 Singapore
11. UTC+08 Hong Kong
12. UTC+09 Tokyo, Japan
13. UTC+10 Sydney, Australia
14. UTC+12 Auckland, New Zealand
15. UTC-05 New York, USA Eastern
16. UTC-06 Chicago, USA Central
17. UTC-07 Denver, USA Mountain
18. UTC-08 Los Angeles, USA Pacific
19. UTC-05 Toronto, Canada
20. UTC-06 Mexico City
21. UTC-03 São Paulo, Brazil
22. UTC+02 Cairo, Egypt
23. UTC+02 Johannesburg, South Africa
24. UTC+01 Lagos, Nigeria

---

## Usage Examples

### Scheduling a Message in Recipient's Timezone
1. Go to Contacts page
2. Verify contact has timezone assigned (auto-detected from phone)
3. Click "+" to schedule new message
4. Select contact
5. Select "Their Time (UTC+04 Dubai, UAE)" from dropdown
6. Choose 12:00 PM
7. Message will be sent at 12:00 PM Dubai time (8:00 AM UK time)

### Viewing Message Details
1. Go to Dashboard or Scheduled page
2. Click on any message card
3. Message Detail Modal opens showing:
   - Full recipient information
   - Both UK and local times
   - Complete message content
   - Current status
   - Edit button (if pending)

---

## Default Behavior

- **New contacts**: Default to UK timezone unless manually changed
- **Schedule modal**: Defaults to "UK Time" unless user toggles
- **Storage**: All times stored in UTC in S3
- **Display**: Conversions happen client-side using browser's Intl API
- **DST changes**: Handled automatically by IANA timezone system

---

## Migration Notes

### Initial Deployment (Dec 24, 2025)
- All 272 existing contacts successfully assigned timezones
- Auto-detection based on phone number country codes
- No manual intervention required

### Future Enhancements

#### Optional Features
1. **Bulk timezone update** - Update multiple contacts at once
2. **Timezone sync with phone number** - Auto-update when phone changes
3. **Time preview** - "This will be 10:00 PM their time" before scheduling
4. **Conflict warnings** - Warn if scheduling outside business hours
5. **Timezone history** - Track when timezones were changed

---

## Maintenance

### Phone-to-Timezone Mapping Updates
If new countries are added or timezone mappings change:
1. Edit `lib/timezones.ts`
2. Update `PHONE_TO_TIMEZONE` object
3. Deploy to VPS
4. Run migration endpoint if needed

### Common Timezones List Updates
To add more timezones to the dropdown:
1. Edit `lib/timezones.ts`
2. Add to `COMMON_TIMEZONES` array
3. Deploy to VPS

---

## Troubleshooting

### Issue: Contact shows no timezone
**Cause:** Migration not run or contact added before migration
**Fix:** Edit contact and manually select timezone

### Issue: Times don't convert correctly
**Cause:** Browser timezone vs server timezone mismatch
**Fix:** All times stored in UTC, conversions happen client-side using Intl API

### Issue: Wrong timezone auto-detected
**Cause:** Phone number country code ambiguous (e.g., +1 for US/Canada)
**Fix:** Manually select correct timezone in contact edit form

---

## Success Criteria

✅ Contacts have timezones assigned automatically based on phone numbers
✅ Users can manually override timezone in contact form
✅ Schedule modal allows choosing UK time or recipient's timezone
✅ Dashboard and scheduled page show both UK and recipient times
✅ Messages scheduled for correct local time in recipient's timezone
✅ DST changes handled automatically
✅ No breaking changes to existing functionality
✅ Message details accessible via click on any message

---

## Related Documentation

- [Contact Management](./contact-management.md)
- [Message Scheduling](./message-scheduling.md)
- [Dashboard Overview](./dashboard.md)
- [API Reference](../architecture/api-reference.md)
