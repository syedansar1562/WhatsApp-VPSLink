# Data Schemas: Multi-Message Sequential Sending

**Last Updated:** December 24, 2025
**Status:** Phase 1 Design

---

## Overview

This document defines the data schemas for the multi-message sequential sending feature. We're introducing a new `jobs.json` file while maintaining backward compatibility with the existing `scheduled.json`.

---

## S3 File Structure

### Current State
```
whatsapp/
├── contacts.json       # Contact list
├── scheduled.json      # Single-message scheduler (EXISTING)
├── chats.json          # Chat history
└── session/            # WhatsApp session data
```

### After Phase 1
```
whatsapp/
├── contacts.json       # Contact list (unchanged)
├── scheduled.json      # Single-message scheduler (STILL WORKS)
├── jobs.json           # Multi-message jobs (NEW)
├── chats.json          # Chat history (unchanged)
└── session/            # WhatsApp session data (unchanged)
```

**Key Point:** Both systems coexist. The scheduler worker checks both files.

---

## 1. Scheduled Job Schema (`jobs.json`)

### 1.1 Complete Schema

```typescript
interface ScheduledJob {
  // Identification
  id: string;                    // Format: "job_{timestamp}_{random}"
  createdBy: string;             // "web" | "cli" | "api"
  createdAt: string;             // ISO 8601 timestamp

  // Scheduling
  scheduledStartAt: string;      // ISO 8601 timestamp (when to start)

  // Status
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

  // Recipients
  recipients: string[];          // Array of JIDs (e.g., "447957189696@s.whatsapp.net")

  // Message Content
  messageParts: MessagePart[];   // Ordered array of message parts

  // Configuration
  config: JobConfig;

  // Progress Tracking
  progress: JobProgress;

  // Completion
  completedAt?: string;          // ISO 8601 timestamp (when job finished)
  error?: string;                // Error message if failed
}
```

### 1.2 MessagePart Schema

```typescript
interface MessagePart {
  orderIndex: number;            // 0-based index (determines send order)
  text: string;                  // Message content
  delayAfterSeconds: number | null; // Delay after THIS message (null = no delay)
}
```

**Example:**
```json
{
  "orderIndex": 0,
  "text": "Hey! Merry Christmas! 🎄",
  "delayAfterSeconds": 3
}
```

**Validation Rules:**
- `orderIndex` must be sequential (0, 1, 2, ...)
- `text` must not be empty
- `delayAfterSeconds` can be:
  - `null` (no delay, typically for last message)
  - `0` (instant next message, not recommended)
  - `1-60` (reasonable delays)
  - `>60` (allowed but discouraged)

---

### 1.3 JobConfig Schema

```typescript
interface JobConfig {
  intervalMode: 'manual' | 'auto';    // Phase 1: Only 'manual' supported
  recipientGapSeconds: number;        // Delay between recipients (default: 30)
  maxRetries: number;                 // Retry attempts per message (default: 3)
}
```

**Phase 1 Defaults:**
```json
{
  "intervalMode": "manual",
  "recipientGapSeconds": 30,
  "maxRetries": 3
}
```

**Phase 2 Additions (Future):**
```typescript
interface JobConfig {
  // Phase 1
  intervalMode: 'manual' | 'auto';
  recipientGapSeconds: number;
  maxRetries: number;

  // Phase 2
  humanisationProfileId?: string;     // Reference to profile
  enableTypingIndicator?: boolean;    // Show "typing..." before send
  quietHoursStart?: string;           // "23:00" (local time)
  quietHoursEnd?: string;             // "08:00" (local time)
}
```

---

### 1.4 JobProgress Schema

```typescript
interface JobProgress {
  currentRecipientIndex: number;      // 0-based index of current recipient
  currentPartIndex: number;           // 0-based index of current message part
  recipientsSent: number;             // Count of successfully completed recipients
  recipientsFailed: number;           // Count of failed recipients
  lastSentAt: string | null;          // ISO 8601 timestamp of last message sent
}
```

**Initial State (when job created):**
```json
{
  "currentRecipientIndex": 0,
  "currentPartIndex": 0,
  "recipientsSent": 0,
  "recipientsFailed": 0,
  "lastSentAt": null
}
```

**During Execution:**
```json
{
  "currentRecipientIndex": 1,
  "currentPartIndex": 2,
  "recipientsSent": 1,
  "recipientsFailed": 0,
  "lastSentAt": "2025-12-25T10:05:32.123Z"
}
```

**After Completion:**
```json
{
  "currentRecipientIndex": 3,
  "currentPartIndex": 0,
  "recipientsSent": 3,
  "recipientsFailed": 0,
  "lastSentAt": "2025-12-25T10:12:45.789Z"
}
```

---

## 2. Complete Job Examples

### 2.1 Simple Job (1 Recipient, 3 Parts)

```json
{
  "id": "job_1735132800000_abc123",
  "createdBy": "web",
  "createdAt": "2025-12-24T16:00:00.000Z",
  "scheduledStartAt": "2025-12-25T10:00:00.000Z",
  "status": "pending",

  "recipients": [
    "447957189696@s.whatsapp.net"
  ],

  "messageParts": [
    {
      "orderIndex": 0,
      "text": "Hey! Merry Christmas! 🎄",
      "delayAfterSeconds": 3
    },
    {
      "orderIndex": 1,
      "text": "Hope you have an amazing day with family!",
      "delayAfterSeconds": 5
    },
    {
      "orderIndex": 2,
      "text": "Let's catch up in the new year! 🎉",
      "delayAfterSeconds": null
    }
  ],

  "config": {
    "intervalMode": "manual",
    "recipientGapSeconds": 30,
    "maxRetries": 3
  },

  "progress": {
    "currentRecipientIndex": 0,
    "currentPartIndex": 0,
    "recipientsSent": 0,
    "recipientsFailed": 0,
    "lastSentAt": null
  }
}
```

**Expected Timeline:**
```
10:00:00 - Message 1 sent to Reem
10:00:03 - Message 2 sent to Reem
10:00:08 - Message 3 sent to Reem
10:00:08 - Job completed
```

---

### 2.2 Bulk Job (5 Recipients, 2 Parts)

```json
{
  "id": "job_1735132800000_xyz789",
  "createdBy": "web",
  "createdAt": "2025-12-24T16:15:00.000Z",
  "scheduledStartAt": "2025-12-25T10:00:00.000Z",
  "status": "pending",

  "recipients": [
    "447957189696@s.whatsapp.net",
    "447950724774@s.whatsapp.net",
    "447123456789@s.whatsapp.net",
    "447987654321@s.whatsapp.net",
    "447555555555@s.whatsapp.net"
  ],

  "messageParts": [
    {
      "orderIndex": 0,
      "text": "Merry Christmas from our family to yours! 🎄",
      "delayAfterSeconds": 4
    },
    {
      "orderIndex": 1,
      "text": "Wishing you joy and happiness this holiday season!",
      "delayAfterSeconds": null
    }
  ],

  "config": {
    "intervalMode": "manual",
    "recipientGapSeconds": 45,
    "maxRetries": 3
  },

  "progress": {
    "currentRecipientIndex": 0,
    "currentPartIndex": 0,
    "recipientsSent": 0,
    "recipientsFailed": 0,
    "lastSentAt": null
  }
}
```

**Expected Timeline:**
```
10:00:00 - Message 1 to Recipient 1
10:00:04 - Message 2 to Recipient 1
10:00:49 - Message 1 to Recipient 2 (45s gap)
10:00:53 - Message 2 to Recipient 2
10:01:38 - Message 1 to Recipient 3 (45s gap)
10:01:42 - Message 2 to Recipient 3
10:02:27 - Message 1 to Recipient 4 (45s gap)
10:02:31 - Message 2 to Recipient 4
10:03:16 - Message 1 to Recipient 5 (45s gap)
10:03:20 - Message 2 to Recipient 5
10:03:20 - Job completed
```

**Total Duration:** ~3 minutes 20 seconds

---

### 2.3 Job in Progress (Running State)

```json
{
  "id": "job_1735132800000_xyz789",
  "createdBy": "web",
  "createdAt": "2025-12-24T16:15:00.000Z",
  "scheduledStartAt": "2025-12-25T10:00:00.000Z",
  "status": "running",

  "recipients": [
    "447957189696@s.whatsapp.net",
    "447950724774@s.whatsapp.net",
    "447123456789@s.whatsapp.net"
  ],

  "messageParts": [
    {
      "orderIndex": 0,
      "text": "Message 1",
      "delayAfterSeconds": 3
    },
    {
      "orderIndex": 1,
      "text": "Message 2",
      "delayAfterSeconds": null
    }
  ],

  "config": {
    "intervalMode": "manual",
    "recipientGapSeconds": 30,
    "maxRetries": 3
  },

  "progress": {
    "currentRecipientIndex": 1,
    "currentPartIndex": 1,
    "recipientsSent": 1,
    "recipientsFailed": 0,
    "lastSentAt": "2025-12-25T10:01:33.456Z"
  }
}
```

**Status Interpretation:**
- ✅ Recipient 0 completed (all parts sent)
- 🔄 Recipient 1 in progress (on part 1 of 2)
- ⏳ Recipient 2 pending

---

### 2.4 Completed Job

```json
{
  "id": "job_1735132800000_xyz789",
  "createdBy": "web",
  "createdAt": "2025-12-24T16:15:00.000Z",
  "scheduledStartAt": "2025-12-25T10:00:00.000Z",
  "status": "completed",
  "completedAt": "2025-12-25T10:03:20.789Z",

  "recipients": [
    "447957189696@s.whatsapp.net",
    "447950724774@s.whatsapp.net",
    "447123456789@s.whatsapp.net"
  ],

  "messageParts": [
    {
      "orderIndex": 0,
      "text": "Message 1",
      "delayAfterSeconds": 3
    },
    {
      "orderIndex": 1,
      "text": "Message 2",
      "delayAfterSeconds": null
    }
  ],

  "config": {
    "intervalMode": "manual",
    "recipientGapSeconds": 30,
    "maxRetries": 3
  },

  "progress": {
    "currentRecipientIndex": 3,
    "currentPartIndex": 0,
    "recipientsSent": 3,
    "recipientsFailed": 0,
    "lastSentAt": "2025-12-25T10:03:20.456Z"
  }
}
```

---

### 2.5 Failed Job (Partial Completion)

```json
{
  "id": "job_1735132800000_xyz789",
  "createdBy": "web",
  "createdAt": "2025-12-24T16:15:00.000Z",
  "scheduledStartAt": "2025-12-25T10:00:00.000Z",
  "status": "completed",
  "completedAt": "2025-12-25T10:02:15.123Z",

  "recipients": [
    "447957189696@s.whatsapp.net",
    "447999999999@s.whatsapp.net",
    "447123456789@s.whatsapp.net"
  ],

  "messageParts": [
    {
      "orderIndex": 0,
      "text": "Message 1",
      "delayAfterSeconds": 3
    },
    {
      "orderIndex": 1,
      "text": "Message 2",
      "delayAfterSeconds": null
    }
  ],

  "config": {
    "intervalMode": "manual",
    "recipientGapSeconds": 30,
    "maxRetries": 3
  },

  "progress": {
    "currentRecipientIndex": 3,
    "currentPartIndex": 0,
    "recipientsSent": 2,
    "recipientsFailed": 1,
    "lastSentAt": "2025-12-25T10:02:15.789Z"
  },

  "error": "Recipient 447999999999@s.whatsapp.net failed after 3 retry attempts"
}
```

**Note:** Job continues to next recipient even if one fails.

---

## 3. Backward Compatibility: Old Scheduler Schema

### 3.1 Existing `scheduled.json` Schema (Unchanged)

```json
[
  {
    "id": "1735168500123_a1b2c3",
    "to": "447957189696@s.whatsapp.net",
    "contactName": "Reem",
    "message": "Happy Birthday!",
    "scheduledTime": "2025-12-24T10:00:00.000Z",
    "status": "pending",
    "createdAt": "2025-12-22T22:15:00.123Z",
    "createdFrom": "web",
    "sentAt": null,
    "error": null
  }
]
```

**Key Differences from Jobs:**

| Feature | Old Scheduler | New Jobs |
|---------|---------------|----------|
| Recipients | 1 (string) | Many (array) |
| Messages | 1 (string) | Many (array) |
| Delays | None | Configurable |
| Progress | None | Detailed tracking |
| Retry | Basic | Configurable |

---

### 3.2 Scheduler Worker Logic (Both Systems)

```javascript
// Pseudocode for scheduler.js

setInterval(async () => {
  // Process old system (single messages)
  await processScheduledMessages(); // Existing function - unchanged

  // Process new system (multi-message jobs)
  await processScheduledJobs();     // New function
}, 10000);
```

**No conflicts:** Both systems run independently.

---

## 4. Migration Strategy

### 4.1 Phase 1: Coexistence (Current)

- ✅ Old scheduler works as before
- ✅ New job system works alongside
- ✅ Users can use both
- ✅ No data migration required

### 4.2 Phase 2-4: Gradual Transition

- Users naturally adopt new system
- Old system kept for simple one-off messages
- Consider deprecation after 6 months

### 4.3 Future: Unified System (Optional)

Convert old scheduled messages to jobs:

```javascript
// Migration script (future consideration)
const convertOldToNew = (oldMessage) => {
  return {
    id: `job_migrated_${oldMessage.id}`,
    createdBy: oldMessage.createdFrom,
    createdAt: oldMessage.createdAt,
    scheduledStartAt: oldMessage.scheduledTime,
    status: oldMessage.status,
    recipients: [oldMessage.to],
    messageParts: [
      {
        orderIndex: 0,
        text: oldMessage.message,
        delayAfterSeconds: null
      }
    ],
    config: {
      intervalMode: 'manual',
      recipientGapSeconds: 0,
      maxRetries: 3
    },
    progress: {
      currentRecipientIndex: 0,
      currentPartIndex: 0,
      recipientsSent: 0,
      recipientsFailed: 0,
      lastSentAt: null
    }
  };
};
```

---

## 5. Validation Rules

### 5.1 Job Validation

```typescript
const validateJob = (job: ScheduledJob): string[] => {
  const errors: string[] = [];

  // ID
  if (!job.id || !job.id.startsWith('job_')) {
    errors.push('Invalid job ID format');
  }

  // Recipients
  if (!job.recipients || job.recipients.length === 0) {
    errors.push('At least one recipient required');
  }

  if (job.recipients.some(r => !r.includes('@s.whatsapp.net') && !r.includes('@g.us'))) {
    errors.push('Invalid recipient JID format');
  }

  // Message Parts
  if (!job.messageParts || job.messageParts.length === 0) {
    errors.push('At least one message part required');
  }

  if (job.messageParts.some(p => !p.text || p.text.trim().length === 0)) {
    errors.push('All message parts must have text');
  }

  // Order indices must be sequential
  const indices = job.messageParts.map(p => p.orderIndex).sort((a, b) => a - b);
  for (let i = 0; i < indices.length; i++) {
    if (indices[i] !== i) {
      errors.push('Message part indices must be sequential (0, 1, 2, ...)');
      break;
    }
  }

  // Scheduled time
  const scheduledTime = new Date(job.scheduledStartAt);
  if (isNaN(scheduledTime.getTime())) {
    errors.push('Invalid scheduledStartAt timestamp');
  }

  // Config
  if (job.config.recipientGapSeconds < 0 || job.config.recipientGapSeconds > 3600) {
    errors.push('recipientGapSeconds must be between 0 and 3600');
  }

  if (job.config.maxRetries < 0 || job.config.maxRetries > 10) {
    errors.push('maxRetries must be between 0 and 10');
  }

  return errors;
};
```

---

## 6. S3 Operations

### 6.1 Read Jobs

```javascript
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

const readJobs = async () => {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: 'whatsapp/jobs.json'
    });

    const response = await s3Client.send(command);
    const bodyString = await response.Body.transformToString();
    return JSON.parse(bodyString);
  } catch (error) {
    if (error.name === 'NoSuchKey') {
      return []; // File doesn't exist yet
    }
    throw error;
  }
};
```

### 6.2 Write Jobs

```javascript
import { PutObjectCommand } from '@aws-sdk/client-s3';

const writeJobs = async (jobs) => {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: 'whatsapp/jobs.json',
    Body: JSON.stringify(jobs, null, 2),
    ContentType: 'application/json'
  });

  await s3Client.send(command);
};
```

### 6.3 Update Single Job

```javascript
const updateJob = async (jobId, updates) => {
  const jobs = await readJobs();
  const index = jobs.findIndex(j => j.id === jobId);

  if (index === -1) {
    throw new Error(`Job ${jobId} not found`);
  }

  jobs[index] = { ...jobs[index], ...updates };
  await writeJobs(jobs);

  return jobs[index];
};
```

---

## 7. File Size Estimates

### 7.1 Average Job Size

**Simple Job (1 recipient, 3 parts):** ~600 bytes
**Bulk Job (50 recipients, 5 parts):** ~4 KB

### 7.2 jobs.json Growth

| Active Jobs | File Size |
|-------------|-----------|
| 10 | ~6 KB |
| 100 | ~60 KB |
| 1000 | ~600 KB |

**Recommendation:** Archive completed jobs after 30 days to keep file size manageable.

---

## 8. Future Schema Extensions

### 8.1 Phase 2 Additions

```typescript
interface ScheduledJob {
  // ... existing fields ...

  // Phase 2
  humanisationProfile?: {
    id: string;
    name: string;
    snapshot: HumanisationProfileSnapshot;
  };

  estimatedCompletionAt?: string;  // Calculated duration
}
```

### 8.2 Phase 3 Additions

```typescript
interface ScheduledJob {
  // ... existing fields ...

  // Phase 3
  quietHours?: {
    enabled: boolean;
    startTime: string;    // "23:00"
    endTime: string;      // "08:00"
    timezone: string;     // "Europe/London"
  };

  timeline?: {
    estimatedEvents: TimelineEvent[];
  };
}
```

### 8.3 Phase 4 Additions

```typescript
interface ScheduledJob {
  // ... existing fields ...

  // Phase 4
  executionLog?: ExecutionLogEntry[];

  monitoring?: {
    alertOnFailure: boolean;
    alertRecipient: string;
  };

  recipientTimezones?: {
    [jid: string]: string;  // e.g., "Europe/London"
  };
}
```

---

## 9. Testing Data

### 9.1 Test Job (Small)

```json
{
  "id": "job_test_small",
  "createdBy": "test",
  "createdAt": "2025-12-24T17:00:00.000Z",
  "scheduledStartAt": "2025-12-24T18:00:00.000Z",
  "status": "pending",
  "recipients": ["447957189696@s.whatsapp.net"],
  "messageParts": [
    {
      "orderIndex": 0,
      "text": "Test message 1",
      "delayAfterSeconds": 2
    },
    {
      "orderIndex": 1,
      "text": "Test message 2",
      "delayAfterSeconds": null
    }
  ],
  "config": {
    "intervalMode": "manual",
    "recipientGapSeconds": 5,
    "maxRetries": 3
  },
  "progress": {
    "currentRecipientIndex": 0,
    "currentPartIndex": 0,
    "recipientsSent": 0,
    "recipientsFailed": 0,
    "lastSentAt": null
  }
}
```

---

## Summary

- ✅ New `jobs.json` file for multi-message jobs
- ✅ Backward compatible with existing `scheduled.json`
- ✅ Detailed progress tracking
- ✅ Flexible configuration
- ✅ Clear validation rules
- ✅ Room for future enhancements

**Next Steps:**
1. Implement UI components using these schemas
2. Update scheduler worker to process jobs
3. Test with sample data
4. Deploy to production

---

**Last Updated:** December 24, 2025
**Status:** Complete (Phase 1 Schema)
