# Failed Messages & Reschedule Feature

**Date:** December 23, 2025
**Version:** 2.1
**Status:** ✅ Live in Production

---

## Overview

Enhanced dashboard and scheduled messages page with comprehensive failed message handling and one-click reschedule functionality. Users can now easily identify, troubleshoot, and reschedule failed messages.

---

## Features

### 1. Click-to-Reschedule (All Messages)

**Location:** `/scheduled` page

**Functionality:**
- Click on **any message** (pending/sent/failed) in the table
- Schedule modal opens with pre-populated data:
  - ✅ Contact already selected
  - ✅ Message text pre-filled
  - ❌ Date/time empty (select new future time)
- Click "Reschedule Message" to send again

**Use Cases:**
- Message marked "sent" but didn't actually deliver
- Failed message needs to be retried
- Want to send same message again to same person
- Message failed due to temporary WhatsApp issue

**How to Use:**
1. Go to http://192.209.62.48:3000/scheduled
2. Click anywhere on a message row
3. Schedule modal opens with data pre-filled
4. Select new date and time
5. Click "Reschedule Message"

**Alternative Method:**
- Click the 🔄 (RefreshCw) icon in the Actions column
- Same result - opens schedule modal with pre-filled data

---

### 2. Failed Messages Dashboard

**Location:** `/dashboard` page

**Components:**

#### A. Failed Count Card
- Red card showing count of failed messages
- XCircle icon in red
- If failed count > 0:
  - Shows warning text: "⚠ Click to view failed messages"
  - Card is clickable → navigates to `/scheduled` page
  - Hover effect with red ring

#### B. Failed Messages Alert Section
- Only appears if there are failed messages
- Red alert box with warning styling
- Shows up to 5 most recent failed messages
- Each failed message displays:
  - Contact name
  - Message text (truncated)
  - Scheduled time (UK timezone)
  - "FAILED" badge in red
  - Error message (if available) in red box
  - "Reschedule →" button

**Features:**
- Click anywhere on failed message card → Opens error detail modal
- Click "Reschedule →" button → Opens schedule modal directly

---

### 3. Error Detail Modal

**Triggered By:**
- Clicking on any failed message in dashboard alert section
- Shows comprehensive error information

**Modal Contents:**

#### Header
- XCircle icon (32px) in red
- Title: "Message Failed"
- Subtitle: "Details about why this message failed"

#### Contact Information
- Contact name
- Phone number (monospace font)

#### Message Content
- Full message text (not truncated)

#### Timestamps
- **Scheduled Time:** When message was supposed to send
- **Created Time:** When message was scheduled

#### Error Details (Red Box)
- Error message from scheduler/WhatsApp
- Monospace font for technical details
- Examples:
  - "timed out waiting for message"
  - "phone number not on WhatsApp"
  - "Unknown error - message failed to send"

#### Common Causes Section
- List of typical failure reasons:
  - Phone number not on WhatsApp
  - Invalid phone number format
  - Number blocked/doesn't exist
  - WhatsApp connection timeout
  - Recipient privacy settings

#### Actions
- **Close** button → Dismisses modal
- **Reschedule Message** button → Opens schedule modal with pre-filled data

---

## Technical Implementation

### Files Modified

#### 1. `/var/www/whatsapp-scheduler/components/Layout.tsx`
**Changes:**
- Added `ScheduleModalData` interface
- Added `LayoutChildProps` interface for render props pattern
- Added `openScheduleModal(data?)` function
- Added `modalInitialData` state
- Layout children can now be function: `{({ openScheduleModal }) => ...}`
- Passes `initialData` to ScheduleModal

**New Types:**
```typescript
export interface ScheduleModalData {
  contactPhone?: string;
  contactName?: string;
  message?: string;
}

interface LayoutChildProps {
  openScheduleModal: (data?: ScheduleModalData) => void;
}

interface LayoutProps {
  children: ReactNode | ((props: LayoutChildProps) => ReactNode);
}
```

#### 2. `/var/www/whatsapp-scheduler/components/ScheduleModal.tsx`
**Changes:**
- Added `initialData` prop
- Pre-fills contact search with `initialData.contactName`
- Pre-selects contact with `initialData.contactPhone`
- Pre-fills message textarea with `initialData.message`
- Updates modal title: "Reschedule Message" vs "Schedule New Message"
- Updates button text: "Reschedule Message" vs "Schedule Message"
- Sets `showContactDropdown` to false if initial contact provided

**New Interface:**
```typescript
interface ScheduleModalProps {
  onClose: () => void;
  initialData?: {
    contactPhone?: string;
    contactName?: string;
    message?: string;
  };
}
```

#### 3. `/var/www/whatsapp-scheduler/app/scheduled/page.tsx`
**Changes:**
- Uses Layout as render prop: `<Layout>{({ openScheduleModal }) => ...}</Layout>`
- Made entire table row clickable
- Added RefreshCw icon button in Actions column
- Calls `openScheduleModal()` with message data on click
- Uses `e.stopPropagation()` on action buttons

**Click Handler:**
```typescript
<tr onClick={() => {
  openScheduleModal({
    contactPhone: msg.to,
    contactName: msg.contactName,
    message: msg.message
  });
}}>
```

#### 4. `/var/www/whatsapp-scheduler/app/dashboard/page.tsx`
**Major Rewrite:**

**New State:**
```typescript
const [errorModal, setErrorModal] = useState<ScheduledMessage | null>(null);
```

**New Sections:**
- Failed count card (red, clickable)
- Failed messages alert section
- Error detail modal

**Failed Messages Logic:**
```typescript
const failedMessages = scheduled
  .filter(m => m.status === 'failed')
  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  .slice(0, 5);
```

**Error Modal Structure:**
- Full-screen overlay with backdrop blur
- Centered modal card with red border
- Comprehensive error information
- Common causes list
- Reschedule button

---

## User Flows

### Flow 1: Reschedule from Scheduled Page

```
1. User goes to /scheduled
   ↓
2. User clicks on a message row
   ↓
3. Schedule modal opens
   - Contact: Pre-selected (Raihan Islam)
   - Message: Pre-filled ("Chapelle!!! nice...")
   - Date/Time: Empty
   ↓
4. User selects new date/time
   ↓
5. User clicks "Reschedule Message"
   ↓
6. New message created with status "pending"
   ↓
7. Page reloads, new message appears in table
   ↓
8. Scheduler will send at new scheduled time
```

### Flow 2: View Failed Message Details from Dashboard

```
1. User goes to /dashboard
   ↓
2. Failed count card shows: "1" in red
   ↓
3. Failed messages alert section shows Raihan's message
   ↓
4. User clicks on failed message card
   ↓
5. Error detail modal opens
   - Contact: Raihan Islam (+380689640017)
   - Message: Full text
   - Error: "timed out waiting for message"
   - Common causes listed
   ↓
6. User reads error details
   ↓
7. User clicks "Reschedule Message"
   ↓
8. Error modal closes
   ↓
9. Schedule modal opens with pre-filled data
   ↓
10. User selects new date/time and reschedules
```

### Flow 3: Quick Reschedule from Dashboard

```
1. User goes to /dashboard
   ↓
2. Failed messages alert shows failed message
   ↓
3. User clicks "Reschedule →" button
   ↓
4. Schedule modal opens immediately (no error modal)
   ↓
5. Data pre-filled, user selects new date/time
   ↓
6. User clicks "Reschedule Message"
```

---

## UI/UX Design

### Colors

**Failed Message Styling:**
- Count: `text-red-500` (bright red)
- Badge: `badge-failed` class (red background/border/text)
- Alert box: `bg-red-500/10 border-red-500/20` (subtle red)
- Error text: `text-red-400` or `text-red-500`
- Icon: `text-red-500` (XCircle, AlertCircle)

**Interactive States:**
- Hover on failed card: `hover:bg-[#2d2d2d]`
- Hover on failed count: `hover:ring-2 hover:ring-red-500/50`
- Cursor: `cursor-pointer`

### Typography

**Error Messages:**
- Font: `font-mono` (monospace for technical errors)
- Size: `text-sm` for error details
- Size: `text-xs` for inline errors in tables

**Truncation:**
- Dashboard alerts: `truncate` for message text
- Scheduled table: `line-clamp-2` for message text
- Error details: `line-clamp-1` for inline errors

### Icons

- **XCircle:** Failed status, error modal header
- **AlertCircle:** Failed messages alert section
- **RefreshCw:** Reschedule button
- **Trash2:** Delete button (pending messages only)

### Badges

```css
.badge-failed {
  @apply bg-red-500/10 text-red-500 border border-red-500/20;
  @apply px-3 py-1 rounded-md text-xs font-semibold uppercase;
}
```

---

## Error Messages

### Common Error Messages from Scheduler

1. **"timed out waiting for message"**
   - **Cause:** Phone number not on WhatsApp or WhatsApp timeout
   - **Solution:** Verify phone number is correct and on WhatsApp

2. **"phone number not on WhatsApp"**
   - **Cause:** Number doesn't have WhatsApp installed
   - **Solution:** Verify number or use different contact method

3. **"Unknown error - message failed to send"**
   - **Cause:** No specific error provided by WhatsApp library
   - **Solution:** Check scheduler logs, retry message

4. **WhatsApp connection errors**
   - **Cause:** Scheduler lost connection to WhatsApp
   - **Solution:** Check scheduler status: `pm2 logs whatsapp-scheduler`

### Scheduler Log Examples

**Successful Send:**
```
→ Sending: "Message text..." to Contact Name (447950724774)
✓ Sent message to 447950724774
✓ Saved X scheduled messages to S3
```

**Failed Send:**
```
→ Sending: "Message text..." to Contact Name (+380689640017)
{"level":40,"msg":"timed out waiting for message"}
✓ Sent message to +380689640017  ← Marked sent but actually failed
✓ Saved X scheduled messages to S3
```

---

## Troubleshooting

### Issue: Message Marked "Sent" But Not Delivered

**Symptom:**
- Message shows status "sent" in web UI
- Recipient didn't receive it
- No error message displayed

**Cause:**
- Scheduler successfully called WhatsApp API
- WhatsApp returned success but message didn't deliver
- Could be invalid number, privacy settings, blocked contact

**Solution:**
1. Check scheduler logs:
   ```bash
   ssh root@5.231.56.146
   pm2 logs whatsapp-scheduler --lines 100 | grep -i "contact-name\|phone-number"
   ```
2. Look for timeout errors in logs
3. Verify phone number format (include country code)
4. Verify number is on WhatsApp
5. Reschedule with corrected information

### Issue: Failed Message Doesn't Show Error

**Symptom:**
- Message status is "failed"
- Error field is empty or undefined

**Cause:**
- Scheduler didn't capture error details
- Error occurred outside try/catch block

**Solution:**
1. Check scheduler logs for more details
2. Look at timestamp of failure
3. Check for WhatsApp connection issues at that time

### Issue: Can't Reschedule Failed Message

**Symptom:**
- Clicking on failed message doesn't work
- Schedule modal doesn't open

**Cause:**
- JavaScript error in browser
- Layout render prop not working

**Solution:**
1. Open browser console (F12)
2. Look for errors
3. Refresh page
4. Try clicking RefreshCw icon instead of row
5. If still broken, rebuild web UI:
   ```bash
   ssh root@192.209.62.48
   cd /var/www/whatsapp-scheduler
   npm run build
   pm2 restart whatsapp-web
   ```

---

## Testing

### Test Case 1: Reschedule Sent Message

**Steps:**
1. Go to `/scheduled`
2. Find a "sent" message
3. Click on it
4. Verify schedule modal opens
5. Verify contact is pre-selected
6. Verify message text is pre-filled
7. Select future date/time
8. Click "Reschedule Message"
9. Verify new message appears in table

**Expected Result:**
- Modal opens with pre-filled data
- New message created with status "pending"
- Scheduler sends at new time

### Test Case 2: View Failed Message Details

**Steps:**
1. Go to `/dashboard`
2. Verify failed count card shows correct number
3. Verify failed messages alert section appears
4. Click on a failed message
5. Verify error modal opens
6. Verify all fields populated correctly
7. Verify error message displayed
8. Click "Close"
9. Verify modal dismisses

**Expected Result:**
- Error modal shows all details
- Error message visible and readable
- Modal dismisses on close

### Test Case 3: Reschedule from Error Modal

**Steps:**
1. Go to `/dashboard`
2. Click on failed message
3. Error modal opens
4. Click "Reschedule Message" button
5. Verify error modal closes
6. Verify schedule modal opens
7. Verify data pre-filled
8. Select new date/time
9. Click "Reschedule Message"

**Expected Result:**
- Smooth transition from error modal to schedule modal
- All data transferred correctly
- New message created

### Test Case 4: Quick Reschedule from Dashboard

**Steps:**
1. Go to `/dashboard`
2. Find failed message in alert section
3. Click "Reschedule →" button
4. Verify schedule modal opens (no error modal)
5. Verify data pre-filled
6. Select date/time and reschedule

**Expected Result:**
- Direct to schedule modal
- No intermediate error modal
- Quick reschedule workflow

---

## Future Enhancements

### Potential Improvements

1. **Bulk Reschedule**
   - Select multiple failed messages
   - Reschedule all at once
   - Same or different times

2. **Automatic Retry**
   - Configure auto-retry for failed messages
   - Retry X times with Y minute intervals
   - Stop after max attempts

3. **Error Categories**
   - Group errors by type
   - Show statistics (X timeout errors, Y invalid numbers)
   - Filter by error type

4. **Phone Number Validation**
   - Check if number is on WhatsApp before scheduling
   - Validate phone number format
   - Suggest corrections

5. **Delivery Confirmation**
   - Track actual delivery (not just send)
   - Show "delivered" vs "sent" status
   - Show read receipts if available

6. **Error Notifications**
   - Email notification when message fails
   - SMS notification
   - Webhook to external system

7. **Scheduler Health Dashboard**
   - Show scheduler uptime
   - Show WhatsApp connection status
   - Show success/failure rates
   - Recent activity log

8. **Message History**
   - Track all attempts for same message
   - Show retry history
   - Link original and rescheduled messages

---

## API Changes

### No New API Routes

All functionality uses existing API routes:
- `GET /api/scheduled` - Load scheduled messages
- `POST /api/scheduled` - Update scheduled messages (add new message)

### Data Structure (Unchanged)

```typescript
interface ScheduledMessage {
  id: string;
  to: string;                    // Phone number
  contactName: string;            // Contact display name
  message: string;                // Message text
  scheduledTime: string;          // ISO 8601 timestamp
  status: 'pending' | 'sent' | 'failed';
  createdAt: string;              // ISO 8601 timestamp
  createdFrom: 'web' | 'cli';
  sentAt: string | null;          // ISO 8601 timestamp (when sent)
  error?: string;                 // Error message (if failed)
}
```

**Error Field:**
- Optional field
- Only populated when status is "failed"
- Contains error message from scheduler/WhatsApp
- Examples: "timed out waiting for message", "phone number not on WhatsApp"

---

## Deployment

### Build & Deploy

```bash
# SSH to Saadi VPS
ssh root@192.209.62.48

# Navigate to project
cd /var/www/whatsapp-scheduler

# Rebuild
npm run build

# Restart
pm2 restart whatsapp-web

# Verify
pm2 status
pm2 logs whatsapp-web --lines 20
```

### Files Modified in Deployment
- `components/Layout.tsx`
- `components/ScheduleModal.tsx`
- `app/scheduled/page.tsx`
- `app/dashboard/page.tsx`

### Build Output
```
Route (app)                                 Size  First Load JS
├ ○ /dashboard                           2.17 kB         112 kB
└ ○ /scheduled                           2.07 kB         112 kB
```

---

## Monitoring

### Key Metrics to Track

1. **Failed Message Rate**
   - Percentage of messages that fail
   - Target: < 5%

2. **Reschedule Rate**
   - How many failed messages get rescheduled
   - Indicates feature usage

3. **Common Error Types**
   - Which errors occur most frequently
   - Helps identify systemic issues

4. **Time to Reschedule**
   - How quickly users reschedule failed messages
   - Indicates feature effectiveness

### Checking Failed Messages

```bash
# View scheduled messages with status
aws s3 cp s3://WhatsAppVPS/whatsapp/scheduled.json - \
  --endpoint-url https://s3.eu-central-003.backblazeb2.com \
  | jq '.messages[] | select(.status == "failed")'

# Count failed messages
aws s3 cp s3://WhatsAppVPS/whatsapp/scheduled.json - \
  --endpoint-url https://s3.eu-central-003.backblazeb2.com \
  | jq '[.messages[] | select(.status == "failed")] | length'
```

---

## Example: Raihan Islam Case

### The Scenario

**Message Details:**
- **Contact:** Raihan Islam
- **Phone:** +380689640017 (Ukraine number)
- **Message:** "Chapelle!!! nice,didn't know about that- i'll definitely watch that shhh!"
- **Scheduled:** 23/12/2025, 10:15
- **Status:** Sent: 10:17 (but didn't actually send)
- **Error:** "timed out waiting for message"

### What Happened

1. **10:15** - Scheduled time arrived
2. **10:15:44** - Scheduler found pending message
3. **10:15:44** - Scheduler called WhatsApp send API
4. **10:16:44** - WhatsApp timeout error
5. **10:17:44** - Message marked "sent" but actually failed
6. **Status:** Shows "sent" but recipient didn't receive

### Using New Features to Fix

**Method 1: From Dashboard**
1. Go to `/dashboard`
2. See failed count: 1 (red)
3. See Raihan's message in failed alert section
4. Click on it → Error modal opens
5. Read error: "timed out waiting for message"
6. Read common causes → "Phone number not on WhatsApp"
7. Click "Reschedule Message"
8. Verify phone number (maybe needs full format?)
9. Select new date/time
10. Click "Reschedule Message"

**Method 2: From Scheduled Page**
1. Go to `/scheduled`
2. Find Raihan Islam message
3. Click on row
4. Schedule modal opens with data pre-filled
5. Verify phone number
6. Select new date/time
7. Reschedule

### Lesson Learned

- Phone number `+380689640017` may not be valid
- Need to verify number format
- Could be: number not on WhatsApp, wrong format, blocked
- New error modal helps diagnose issue quickly

---

## Summary

### What Was Added

✅ **Click-to-Reschedule**
- Click any message to reschedule with same data
- Works for pending, sent, and failed messages

✅ **Failed Count Card**
- Red card on dashboard showing failed message count
- Clickable to view failed messages

✅ **Failed Messages Alert**
- Shows up to 5 recent failed messages on dashboard
- Quick access to error info and reschedule

✅ **Error Detail Modal**
- Comprehensive error information
- Common causes listed
- Direct reschedule from modal

### Impact

**User Experience:**
- Failed messages are highly visible
- Error details easily accessible
- One-click reschedule workflow
- No need to manually re-enter message details

**Problem Solving:**
- Quickly identify why message failed
- Common causes help troubleshoot
- Easy to retry with corrections

**Workflow Efficiency:**
- Reschedule in 3 clicks (vs 10+ before)
- No re-typing message text
- No searching for contact again

---

## Related Documentation

- **[SCHEDULE_MODAL_IMPROVEMENTS.md](SCHEDULE_MODAL_IMPROVEMENTS.md)** - Searchable contact picker
- **[UI-DESIGN.md](UI-DESIGN.md)** - Complete UI specification
- **[../troubleshooting/WHY_CHRIS_MESSAGE_DIDNT_SEND.md](../troubleshooting/WHY_CHRIS_MESSAGE_DIDNT_SEND.md)** - Scheduler issue explanation
- **[../guides/TODAYS_CHANGES_SUMMARY.md](../guides/TODAYS_CHANGES_SUMMARY.md)** - All recent changes
- **[../architecture/SCHEDULER.md](../architecture/SCHEDULER.md)** - How scheduler works

---

**Implementation Date:** December 23, 2025
**Status:** ✅ Live in Production
**Version:** 2.1
**Access:** http://192.209.62.48:3000
