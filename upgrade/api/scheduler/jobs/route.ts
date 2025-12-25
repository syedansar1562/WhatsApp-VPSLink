// route.ts
// Location on Saadi VPS: /var/www/whatsapp-scheduler/app/api/scheduler/jobs/route.ts
//
// Purpose: CRUD API for scheduled jobs (multi-message, multi-recipient)
// Created: December 24, 2025

import { NextRequest, NextResponse } from 'next/server';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';

// Initialize S3 client
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

/**
 * GET /api/scheduler/jobs
 * Fetch all scheduled jobs
 */
export async function GET() {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET,
      Key: JOBS_KEY
    });

    const response = await s3Client.send(command);
    const bodyString = await response.Body?.transformToString();
    const jobs = JSON.parse(bodyString || '[]');

    // Sort by scheduledStartAt (newest first)
    jobs.sort((a: any, b: any) => {
      return new Date(b.scheduledStartAt).getTime() - new Date(a.scheduledStartAt).getTime();
    });

    return NextResponse.json(jobs);
  } catch (error: any) {
    if (error.name === 'NoSuchKey') {
      // File doesn't exist yet - return empty array
      return NextResponse.json([]);
    }

    console.error('Error fetching jobs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch jobs', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/scheduler/jobs
 * Create a new scheduled job
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.recipients || !Array.isArray(body.recipients) || body.recipients.length === 0) {
      return NextResponse.json(
        { error: 'At least one recipient is required' },
        { status: 400 }
      );
    }

    if (!body.messageParts || !Array.isArray(body.messageParts) || body.messageParts.length === 0) {
      return NextResponse.json(
        { error: 'At least one message part is required' },
        { status: 400 }
      );
    }

    if (!body.scheduledStartAt) {
      return NextResponse.json(
        { error: 'scheduledStartAt is required' },
        { status: 400 }
      );
    }

    // Create job object
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const now = new Date().toISOString();

    const newJob = {
      id: jobId,
      createdBy: 'web',
      createdAt: now,
      scheduledStartAt: body.scheduledStartAt,
      status: 'pending',
      recipients: body.recipients,
      messageParts: body.messageParts,
      config: {
        intervalMode: body.config?.intervalMode || 'manual',
        recipientGapSeconds: body.config?.recipientGapSeconds || 30,
        maxRetries: body.config?.maxRetries || 3
      },
      progress: {
        currentRecipientIndex: 0,
        currentPartIndex: 0,
        recipientsSent: 0,
        recipientsFailed: 0,
        lastSentAt: null
      },
      // Preserve timezone metadata for editing
      timezoneMetadata: body.timezoneMetadata || {}
    };

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
      if (error.name !== 'NoSuchKey') {
        throw error;
      }
      // File doesn't exist - that's okay, we'll create it
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

    console.log(`[API] Created new job: ${jobId}`);
    console.log(`[API]   Recipients: ${newJob.recipients.length}`);
    console.log(`[API]   Message Parts: ${newJob.messageParts.length}`);
    console.log(`[API]   Scheduled for: ${newJob.scheduledStartAt}`);

    return NextResponse.json({
      success: true,
      job: newJob
    });
  } catch (error: any) {
    console.error('Error creating job:', error);
    return NextResponse.json(
      { error: 'Failed to create job', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/scheduler/jobs
 * Update an existing job (used for progress tracking by scheduler worker)
 */
export async function PATCH(request: NextRequest) {
  try {
    const { jobId, updates } = await request.json();

    if (!jobId) {
      return NextResponse.json(
        { error: 'jobId is required' },
        { status: 400 }
      );
    }

    // Fetch existing jobs
    const getCommand = new GetObjectCommand({
      Bucket: BUCKET,
      Key: JOBS_KEY
    });

    const response = await s3Client.send(getCommand);
    const bodyString = await response.Body?.transformToString();
    const jobs = JSON.parse(bodyString || '[]');

    // Find job to update
    const jobIndex = jobs.findIndex((j: any) => j.id === jobId);
    if (jobIndex === -1) {
      return NextResponse.json(
        { error: `Job ${jobId} not found` },
        { status: 404 }
      );
    }

    // Update job
    jobs[jobIndex] = {
      ...jobs[jobIndex],
      ...updates
    };

    // Save back to S3
    const putCommand = new PutObjectCommand({
      Bucket: BUCKET,
      Key: JOBS_KEY,
      Body: JSON.stringify(jobs, null, 2),
      ContentType: 'application/json'
    });

    await s3Client.send(putCommand);

    return NextResponse.json({
      success: true,
      job: jobs[jobIndex]
    });
  } catch (error: any) {
    console.error('Error updating job:', error);
    return NextResponse.json(
      { error: 'Failed to update job', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/scheduler/jobs
 * Cancel a pending job
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      return NextResponse.json(
        { error: 'jobId query parameter is required' },
        { status: 400 }
      );
    }

    // Fetch existing jobs
    const getCommand = new GetObjectCommand({
      Bucket: BUCKET,
      Key: JOBS_KEY
    });

    const response = await s3Client.send(getCommand);
    const bodyString = await response.Body?.transformToString();
    const jobs = JSON.parse(bodyString || '[]');

    // Find job
    const jobIndex = jobs.findIndex((j: any) => j.id === jobId);
    if (jobIndex === -1) {
      return NextResponse.json(
        { error: `Job ${jobId} not found` },
        { status: 404 }
      );
    }

    // Only allow cancellation of pending jobs
    if (jobs[jobIndex].status !== 'pending') {
      return NextResponse.json(
        { error: `Cannot cancel job with status: ${jobs[jobIndex].status}` },
        { status: 400 }
      );
    }

    // Update status to cancelled
    jobs[jobIndex].status = 'cancelled';
    jobs[jobIndex].cancelledAt = new Date().toISOString();

    // Save back to S3
    const putCommand = new PutObjectCommand({
      Bucket: BUCKET,
      Key: JOBS_KEY,
      Body: JSON.stringify(jobs, null, 2),
      ContentType: 'application/json'
    });

    await s3Client.send(putCommand);

    console.log(`[API] Cancelled job: ${jobId}`);

    return NextResponse.json({
      success: true,
      job: jobs[jobIndex]
    });
  } catch (error: any) {
    console.error('Error cancelling job:', error);
    return NextResponse.json(
      { error: 'Failed to cancel job', details: error.message },
      { status: 500 }
    );
  }
}
