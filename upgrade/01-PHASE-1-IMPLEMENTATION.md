# Phase 1 Implementation Guide: MVP Foundation

**Status:** In Progress (30% → 100%)
**Duration:** Week 1
**Goal:** Basic multi-message, multi-recipient support

---

## Phase 1 Features Checklist

- [ ] UI to add/remove multiple message parts
- [ ] UI to select multiple recipients
- [ ] Manual interval setting (seconds between messages)
- [ ] Sequential sending (one recipient at a time)
- [ ] Basic progress tracking
- [ ] Simple retry (3 attempts on failure)

---

## 1. UI Components

### 1.1 New Component: `ScheduleJobModal.tsx`

**Location:** `/web-ui/src/components/ScheduleJobModal.tsx`

**Purpose:** Replace single-message scheduler with multi-part, multi-recipient interface

**Key Features:**
- Message parts editor (add/remove/reorder)
- Multi-recipient selector
- Manual interval configuration
- Preview timeline
- Submit as "job" instead of "scheduled message"

#### Component Structure

```typescript
// /web-ui/src/components/ScheduleJobModal.tsx

import { useState } from 'react';
import type { Contact } from '@/types';

interface MessagePart {
  orderIndex: number;
  text: string;
  delayAfterSeconds: number | null;
}

interface ScheduleJobModalProps {
  contacts: Contact[];
  onClose: () => void;
  onSubmit: (jobData: ScheduleJobData) => Promise<void>;
}

interface ScheduleJobData {
  recipients: string[]; // JIDs
  messageParts: MessagePart[];
  scheduledStartAt: string; // ISO 8601
  config: {
    intervalMode: 'manual';
    recipientGapSeconds: number;
    maxRetries: number;
  };
}

export default function ScheduleJobModal({ contacts, onClose, onSubmit }: ScheduleJobModalProps) {
  const [recipients, setRecipients] = useState<string[]>([]);
  const [messageParts, setMessageParts] = useState<MessagePart[]>([
    { orderIndex: 0, text: '', delayAfterSeconds: 3 }
  ]);
  const [scheduledStartAt, setScheduledStartAt] = useState('');
  const [recipientGapSeconds, setRecipientGapSeconds] = useState(30);
  const [maxRetries, setMaxRetries] = useState(3);

  // Message part handlers
  const addMessagePart = () => {
    setMessageParts([
      ...messageParts,
      {
        orderIndex: messageParts.length,
        text: '',
        delayAfterSeconds: 3
      }
    ]);
  };

  const removeMessagePart = (index: number) => {
    const updated = messageParts.filter((_, i) => i !== index);
    // Re-index
    const reindexed = updated.map((part, i) => ({
      ...part,
      orderIndex: i
    }));
    setMessageParts(reindexed);
  };

  const updateMessagePart = (index: number, field: keyof MessagePart, value: any) => {
    const updated = [...messageParts];
    updated[index] = { ...updated[index], [field]: value };
    setMessageParts(updated);
  };

  // Recipient handlers
  const toggleRecipient = (jid: string) => {
    if (recipients.includes(jid)) {
      setRecipients(recipients.filter(r => r !== jid));
    } else {
      setRecipients([...recipients, jid]);
    }
  };

  // Validation
  const isValid = () => {
    return (
      recipients.length > 0 &&
      messageParts.length > 0 &&
      messageParts.every(p => p.text.trim().length > 0) &&
      scheduledStartAt.length > 0
    );
  };

  // Submit
  const handleSubmit = async () => {
    if (!isValid()) return;

    const jobData: ScheduleJobData = {
      recipients,
      messageParts,
      scheduledStartAt,
      config: {
        intervalMode: 'manual',
        recipientGapSeconds,
        maxRetries
      }
    };

    await onSubmit(jobData);
    onClose();
  };

  // Calculate estimated completion time
  const calculateEstimatedDuration = () => {
    const messagesPerRecipient = messageParts.reduce((sum, part) => {
      return sum + (part.delayAfterSeconds || 0);
    }, 0);

    const totalRecipients = recipients.length;
    const recipientGaps = (totalRecipients - 1) * recipientGapSeconds;
    const totalSeconds = (messagesPerRecipient * totalRecipients) + recipientGaps;

    return totalSeconds;
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4">Schedule Multi-Message Job</h2>

        {/* Recipients Section */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2">
            Recipients ({recipients.length} selected)
          </h3>
          <div className="border rounded p-3 max-h-48 overflow-y-auto">
            {contacts.map(contact => (
              <label key={contact.jid} className="flex items-center gap-2 p-2 hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={recipients.includes(contact.jid)}
                  onChange={() => toggleRecipient(contact.jid)}
                  className="w-4 h-4"
                />
                <span>{contact.displayName || contact.phone}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Message Parts Section */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2">
            Message Sequence ({messageParts.length} parts)
          </h3>

          <div className="space-y-3">
            {messageParts.map((part, index) => (
              <div key={index} className="border rounded p-3 bg-gray-50">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold">
                    {index + 1}
                  </div>

                  <div className="flex-grow">
                    <textarea
                      value={part.text}
                      onChange={(e) => updateMessagePart(index, 'text', e.target.value)}
                      placeholder={`Message part ${index + 1}...`}
                      className="w-full border rounded p-2 mb-2 min-h-[80px]"
                    />

                    <div className="flex items-center gap-3">
                      <label className="text-sm">
                        Delay after (seconds):
                        <input
                          type="number"
                          value={part.delayAfterSeconds || ''}
                          onChange={(e) => updateMessagePart(index, 'delayAfterSeconds', e.target.value ? parseInt(e.target.value) : null)}
                          placeholder="3"
                          min="0"
                          max="60"
                          className="ml-2 border rounded px-2 py-1 w-20"
                        />
                      </label>

                      {index === messageParts.length - 1 && (
                        <span className="text-xs text-gray-500">(Last message - no delay)</span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => removeMessagePart(index)}
                    className="text-red-500 hover:text-red-700"
                    disabled={messageParts.length === 1}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={addMessagePart}
            className="mt-3 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            + Add Message Part
          </button>
        </div>

        {/* Scheduling Section */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2">Schedule</h3>

          <div className="space-y-3">
            <label className="block">
              <span className="text-sm font-medium">Start Time (UK Time):</span>
              <input
                type="datetime-local"
                value={scheduledStartAt}
                onChange={(e) => setScheduledStartAt(e.target.value)}
                className="mt-1 block w-full border rounded p-2"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium">Gap between recipients (seconds):</span>
              <input
                type="number"
                value={recipientGapSeconds}
                onChange={(e) => setRecipientGapSeconds(parseInt(e.target.value))}
                min="0"
                max="300"
                className="mt-1 block w-full border rounded p-2"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium">Max retries on failure:</span>
              <input
                type="number"
                value={maxRetries}
                onChange={(e) => setMaxRetries(parseInt(e.target.value))}
                min="0"
                max="10"
                className="mt-1 block w-full border rounded p-2"
              />
            </label>
          </div>
        </div>

        {/* Preview Section */}
        {recipients.length > 0 && messageParts.length > 0 && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded">
            <h3 className="text-lg font-semibold mb-2">Preview</h3>
            <ul className="text-sm space-y-1">
              <li>📱 <strong>{recipients.length}</strong> recipients</li>
              <li>💬 <strong>{messageParts.length}</strong> message parts each</li>
              <li>📊 <strong>{recipients.length * messageParts.length}</strong> total messages</li>
              <li>⏱️ Estimated duration: <strong>{formatDuration(calculateEstimatedDuration())}</strong></li>
            </ul>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid()}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Schedule Job
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

### 1.2 Update: `page.tsx` (Scheduler Page)

**Location:** `/web-ui/src/app/scheduler/page.tsx`

**Changes Needed:**

1. Import new `ScheduleJobModal` component
2. Add button to trigger modal
3. Implement API call to save job to S3

```typescript
// Add to imports
import ScheduleJobModal from '@/components/ScheduleJobModal';

// Add state
const [showJobModal, setShowJobModal] = useState(false);

// Add handler
const handleScheduleJob = async (jobData: ScheduleJobData) => {
  const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const job = {
    id: jobId,
    createdBy: 'web',
    createdAt: new Date().toISOString(),
    scheduledStartAt: jobData.scheduledStartAt,
    status: 'pending',
    recipients: jobData.recipients,
    messageParts: jobData.messageParts,
    config: jobData.config,
    progress: {
      currentRecipientIndex: 0,
      currentPartIndex: 0,
      recipientsSent: 0,
      recipientsFailed: 0,
      lastSentAt: null
    }
  };

  // Save to S3 via API
  const response = await fetch('/api/scheduler/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(job)
  });

  if (!response.ok) {
    throw new Error('Failed to schedule job');
  }

  // Refresh job list
  await fetchJobs();
};

// Add to JSX (alongside existing "Schedule Message" button)
<button
  onClick={() => setShowJobModal(true)}
  className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
>
  Schedule Multi-Message Job
</button>

{showJobModal && (
  <ScheduleJobModal
    contacts={contacts}
    onClose={() => setShowJobModal(false)}
    onSubmit={handleScheduleJob}
  />
)}
```

---

### 1.3 New Component: `JobsList.tsx`

**Location:** `/web-ui/src/components/JobsList.tsx`

**Purpose:** Display scheduled jobs with progress tracking

```typescript
// /web-ui/src/components/JobsList.tsx

import type { ScheduledJob } from '@/types';

interface JobsListProps {
  jobs: ScheduledJob[];
  onCancel: (jobId: string) => void;
}

export default function JobsList({ jobs, onCancel }: JobsListProps) {
  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleString('en-GB', {
      dateStyle: 'short',
      timeStyle: 'short'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'running': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'cancelled': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-4">
      {jobs.map(job => (
        <div key={job.id} className="border rounded-lg p-4 bg-white shadow-sm">
          <div className="flex justify-between items-start mb-3">
            <div>
              <h3 className="font-semibold text-lg">Job {job.id}</h3>
              <p className="text-sm text-gray-600">
                Scheduled: {formatDate(job.scheduledStartAt)}
              </p>
            </div>

            <span className={`px-3 py-1 rounded text-sm font-medium ${getStatusColor(job.status)}`}>
              {job.status.toUpperCase()}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-3">
            <div>
              <p className="text-sm text-gray-600">Recipients</p>
              <p className="font-semibold">{job.recipients.length}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Message Parts</p>
              <p className="font-semibold">{job.messageParts.length}</p>
            </div>
          </div>

          {(job.status === 'running' || job.status === 'completed') && (
            <div className="mb-3">
              <div className="flex justify-between text-sm mb-1">
                <span>Progress</span>
                <span>
                  {job.progress.recipientsSent}/{job.recipients.length} recipients
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all"
                  style={{
                    width: `${(job.progress.recipientsSent / job.recipients.length) * 100}%`
                  }}
                />
              </div>
              {job.progress.recipientsFailed > 0 && (
                <p className="text-sm text-red-600 mt-1">
                  {job.progress.recipientsFailed} failed
                </p>
              )}
            </div>
          )}

          <div className="border-t pt-3 mt-3">
            <p className="text-sm font-medium mb-2">Message Preview:</p>
            <div className="space-y-1">
              {job.messageParts.slice(0, 2).map((part, i) => (
                <p key={i} className="text-sm text-gray-700 truncate">
                  {i + 1}. {part.text}
                </p>
              ))}
              {job.messageParts.length > 2 && (
                <p className="text-sm text-gray-500">
                  +{job.messageParts.length - 2} more...
                </p>
              )}
            </div>
          </div>

          {job.status === 'pending' && (
            <button
              onClick={() => onCancel(job.id)}
              className="mt-3 px-4 py-2 text-sm bg-red-500 text-white rounded hover:bg-red-600"
            >
              Cancel Job
            </button>
          )}
        </div>
      ))}

      {jobs.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No scheduled jobs yet
        </div>
      )}
    </div>
  );
}
```

---

## 2. API Routes

### 2.1 New Route: `/api/scheduler/jobs`

**Location:** `/web-ui/src/app/api/scheduler/jobs/route.ts`

**Purpose:** CRUD operations for scheduled jobs

```typescript
// /web-ui/src/app/api/scheduler/jobs/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
  region: 'auto',
  endpoint: process.env.B2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.B2_KEY_ID!,
    secretAccessKey: process.env.B2_APP_KEY!
  }
});

const BUCKET = process.env.B2_BUCKET_NAME!;
const JOBS_KEY = 'whatsapp/jobs.json';

// GET - List all jobs
export async function GET() {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET,
      Key: JOBS_KEY
    });

    const response = await s3Client.send(command);
    const bodyString = await response.Body?.transformToString();
    const jobs = JSON.parse(bodyString || '[]');

    return NextResponse.json(jobs);
  } catch (error: any) {
    if (error.name === 'NoSuchKey') {
      return NextResponse.json([]);
    }
    return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 });
  }
}

// POST - Create new job
export async function POST(request: NextRequest) {
  try {
    const newJob = await request.json();

    // Fetch existing jobs
    let jobs = [];
    try {
      const getCommand = new GetObjectCommand({
        Bucket: BUCKET,
        Key: JOBS_KEY
      });
      const response = await s3Client.send(getCommand);
      const bodyString = await response.Body?.transformToString();
      jobs = JSON.parse(bodyString || '[]');
    } catch (error: any) {
      if (error.name !== 'NoSuchKey') throw error;
    }

    // Add new job
    jobs.push(newJob);

    // Save back to S3
    const putCommand = new PutObjectCommand({
      Bucket: BUCKET,
      Key: JOBS_KEY,
      Body: JSON.stringify(jobs, null, 2),
      ContentType: 'application/json'
    });

    await s3Client.send(putCommand);

    return NextResponse.json({ success: true, job: newJob });
  } catch (error) {
    console.error('Error creating job:', error);
    return NextResponse.json({ error: 'Failed to create job' }, { status: 500 });
  }
}

// PATCH - Update job (for progress tracking)
export async function PATCH(request: NextRequest) {
  try {
    const { jobId, updates } = await request.json();

    // Fetch existing jobs
    const getCommand = new GetObjectCommand({
      Bucket: BUCKET,
      Key: JOBS_KEY
    });
    const response = await s3Client.send(getCommand);
    const bodyString = await response.Body?.transformToString();
    const jobs = JSON.parse(bodyString || '[]');

    // Find and update job
    const jobIndex = jobs.findIndex((j: any) => j.id === jobId);
    if (jobIndex === -1) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    jobs[jobIndex] = { ...jobs[jobIndex], ...updates };

    // Save back to S3
    const putCommand = new PutObjectCommand({
      Bucket: BUCKET,
      Key: JOBS_KEY,
      Body: JSON.stringify(jobs, null, 2),
      ContentType: 'application/json'
    });

    await s3Client.send(putCommand);

    return NextResponse.json({ success: true, job: jobs[jobIndex] });
  } catch (error) {
    console.error('Error updating job:', error);
    return NextResponse.json({ error: 'Failed to update job' }, { status: 500 });
  }
}
```

---

## 3. Scheduler Worker Updates

### 3.1 Update: `scheduler.js`

**Location:** `/doodah-vps/scheduler.js`

**Changes Needed:**

1. Add jobs.json polling
2. Implement sequential sending logic
3. Add progress tracking
4. Add retry logic

```javascript
// /doodah-vps/scheduler.js - Add to existing file

const processScheduledJobs = async () => {
  try {
    // Fetch jobs.json from S3
    const jobsData = await s3Client.send(new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: 'whatsapp/jobs.json'
    }));

    const jobsBody = await jobsData.Body.transformToString();
    const jobs = JSON.parse(jobsBody);

    const now = new Date();
    const pendingJobs = jobs.filter(j =>
      j.status === 'pending' &&
      new Date(j.scheduledStartAt) <= now
    );

    for (const job of pendingJobs) {
      await executeJob(job, jobs);
    }
  } catch (error) {
    if (error.name !== 'NoSuchKey') {
      console.error('Error processing jobs:', error);
    }
  }
};

const executeJob = async (job, allJobs) => {
  console.log(`\n[JOB] Starting execution: ${job.id}`);
  console.log(`[JOB] Recipients: ${job.recipients.length}, Parts: ${job.messageParts.length}`);

  // Update status to running
  job.status = 'running';
  await updateJobInS3(job, allJobs);

  // Process recipients sequentially
  for (let recipientIndex = job.progress.currentRecipientIndex; recipientIndex < job.recipients.length; recipientIndex++) {
    const recipientJid = job.recipients[recipientIndex];

    console.log(`[JOB] Recipient ${recipientIndex + 1}/${job.recipients.length}: ${recipientJid}`);

    // Process message parts sequentially
    const startPartIndex = (recipientIndex === job.progress.currentRecipientIndex)
      ? job.progress.currentPartIndex
      : 0;

    let recipientSuccess = true;

    for (let partIndex = startPartIndex; partIndex < job.messageParts.length; partIndex++) {
      const part = job.messageParts[partIndex];

      console.log(`[JOB]   Part ${partIndex + 1}/${job.messageParts.length}: ${part.text.substring(0, 50)}...`);

      // Attempt to send with retries
      let sendSuccess = false;
      for (let attempt = 1; attempt <= job.config.maxRetries; attempt++) {
        try {
          await sock.sendMessage(recipientJid, { text: part.text });
          console.log(`[JOB]   ✅ Sent successfully`);
          sendSuccess = true;
          break;
        } catch (error) {
          console.error(`[JOB]   ❌ Attempt ${attempt}/${job.config.maxRetries} failed:`, error.message);
          if (attempt < job.config.maxRetries) {
            await delay(2000 * attempt); // Exponential backoff
          }
        }
      }

      if (!sendSuccess) {
        console.error(`[JOB]   ❌ Failed after ${job.config.maxRetries} attempts`);
        recipientSuccess = false;
        break; // Skip remaining parts for this recipient
      }

      // Update progress
      job.progress.currentPartIndex = partIndex + 1;
      job.progress.lastSentAt = new Date().toISOString();
      await updateJobInS3(job, allJobs);

      // Delay after message (if specified and not last part)
      if (part.delayAfterSeconds && partIndex < job.messageParts.length - 1) {
        console.log(`[JOB]   ⏱️  Waiting ${part.delayAfterSeconds}s...`);
        await delay(part.delayAfterSeconds * 1000);
      }
    }

    // Update recipient progress
    if (recipientSuccess) {
      job.progress.recipientsSent++;
      console.log(`[JOB] ✅ Recipient completed successfully`);
    } else {
      job.progress.recipientsFailed++;
      console.log(`[JOB] ❌ Recipient failed`);
    }

    job.progress.currentRecipientIndex = recipientIndex + 1;
    job.progress.currentPartIndex = 0; // Reset for next recipient
    await updateJobInS3(job, allJobs);

    // Gap between recipients (if not last recipient)
    if (recipientIndex < job.recipients.length - 1) {
      const gap = job.config.recipientGapSeconds;
      console.log(`[JOB] ⏱️  Gap before next recipient: ${gap}s`);
      await delay(gap * 1000);
    }
  }

  // Mark job as completed
  job.status = 'completed';
  job.completedAt = new Date().toISOString();
  await updateJobInS3(job, allJobs);

  console.log(`[JOB] ✅ Job completed: ${job.id}`);
  console.log(`[JOB] Summary: ${job.progress.recipientsSent} succeeded, ${job.progress.recipientsFailed} failed`);
};

const updateJobInS3 = async (updatedJob, allJobs) => {
  const jobIndex = allJobs.findIndex(j => j.id === updatedJob.id);
  if (jobIndex !== -1) {
    allJobs[jobIndex] = updatedJob;
  }

  await s3Client.send(new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: 'whatsapp/jobs.json',
    Body: JSON.stringify(allJobs, null, 2),
    ContentType: 'application/json'
  }));
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Add to main polling loop (alongside existing processScheduledMessages)
setInterval(async () => {
  if (isReady) {
    await processScheduledMessages(); // Existing
    await processScheduledJobs();      // NEW
  }
}, 10000); // Check every 10 seconds
```

---

## 4. TypeScript Types

### 4.1 Update: `types.ts`

**Location:** `/web-ui/src/types.ts`

```typescript
// Add to existing types.ts

export interface MessagePart {
  orderIndex: number;
  text: string;
  delayAfterSeconds: number | null;
}

export interface JobConfig {
  intervalMode: 'manual' | 'auto';
  recipientGapSeconds: number;
  maxRetries: number;
}

export interface JobProgress {
  currentRecipientIndex: number;
  currentPartIndex: number;
  recipientsSent: number;
  recipientsFailed: number;
  lastSentAt: string | null;
}

export interface ScheduledJob {
  id: string;
  createdBy: string;
  createdAt: string;
  scheduledStartAt: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  recipients: string[]; // JIDs
  messageParts: MessagePart[];
  config: JobConfig;
  progress: JobProgress;
  completedAt?: string;
  error?: string;
}
```

---

## 5. Testing Plan

### 5.1 Manual Test Cases

**Test 1: Single Recipient, Multiple Parts**
```json
{
  "recipients": ["447957189696"],
  "messageParts": [
    {"orderIndex": 0, "text": "Test message 1", "delayAfterSeconds": 3},
    {"orderIndex": 1, "text": "Test message 2", "delayAfterSeconds": 3},
    {"orderIndex": 2, "text": "Test message 3", "delayAfterSeconds": null}
  ],
  "scheduledStartAt": "2025-12-24T18:00:00.000Z",
  "config": {
    "intervalMode": "manual",
    "recipientGapSeconds": 30,
    "maxRetries": 3
  }
}
```

**Expected:**
- ✅ Message 1 sent
- ⏱️ 3 second delay
- ✅ Message 2 sent
- ⏱️ 3 second delay
- ✅ Message 3 sent
- ✅ Job marked completed

---

**Test 2: Multiple Recipients, Single Part**
```json
{
  "recipients": ["447957189696", "447950724774"],
  "messageParts": [
    {"orderIndex": 0, "text": "Hello!", "delayAfterSeconds": null}
  ],
  "scheduledStartAt": "2025-12-24T18:05:00.000Z",
  "config": {
    "intervalMode": "manual",
    "recipientGapSeconds": 10,
    "maxRetries": 3
  }
}
```

**Expected:**
- ✅ Message to Recipient 1
- ⏱️ 10 second gap
- ✅ Message to Recipient 2
- ✅ Job marked completed

---

**Test 3: Retry Logic**
- Disconnect WhatsApp temporarily
- Schedule job
- Verify 3 retry attempts occur
- Reconnect WhatsApp
- Verify eventual success

---

### 5.2 Success Criteria

- [ ] Can create job with 3 message parts
- [ ] Can select 5 recipients
- [ ] Messages send in correct order
- [ ] Delays are respected
- [ ] Progress updates in real-time
- [ ] Failed messages retry 3 times
- [ ] Job completes successfully
- [ ] No duplicate messages sent
- [ ] Backward compatible (old scheduler still works)

---

## 6. Deployment Steps

### 6.1 Web UI (Saadi VPS)

```bash
# SSH to Saadi VPS
ssh root@83.97.73.127

# Navigate to web-ui
cd /root/whatsapp-vpslink/web-ui

# Pull latest code
git pull origin main

# Install dependencies (if new packages added)
npm install

# Build
npm run build

# Restart PM2
pm2 restart whatsapp-web-ui
```

### 6.2 Scheduler (Doodah VPS)

```bash
# SSH to Doodah VPS
ssh root@5.231.56.146

# Navigate to project
cd /root/whatsapp-vpslink

# Pull latest code
git pull origin main

# Restart scheduler
pm2 restart whatsapp-scheduler
```

---

## 7. Rollback Plan

If Phase 1 has issues:

1. **Revert code:**
   ```bash
   git revert HEAD
   git push origin main
   ```

2. **Delete jobs.json from S3:**
   - Prevents scheduler from processing new jobs
   - Old scheduler continues working with scheduled.json

3. **Restart services:**
   ```bash
   pm2 restart all
   ```

4. **Verify old system works:**
   - Schedule a single message via old UI
   - Confirm it sends successfully

---

## 8. Known Limitations (Phase 1)

- ❌ No auto-delay calculation (manual only)
- ❌ No typing indicators
- ❌ No humanisation profiles
- ❌ No quiet hours
- ❌ No pause/resume functionality
- ❌ No estimated completion time accuracy
- ❌ No recipient timezone support

These will be addressed in Phase 2-4.

---

## Next Steps After Phase 1

1. Test thoroughly with real numbers
2. Monitor for WhatsApp bans
3. Gather user feedback
4. Plan Phase 2 (Humanisation)
5. Update documentation with lessons learned

---

**Last Updated:** December 24, 2025
**Status:** Ready for implementation
**Estimated Completion:** End of Week 1
