// app/api/settings/route.ts
// Settings API for global job configuration

import { NextResponse } from 'next/server';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
  region: 'eu-central-003',
  endpoint: process.env.B2_S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.B2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.B2_SECRET_ACCESS_KEY!
  }
});

const BUCKET = process.env.B2_BUCKET!;
const SETTINGS_KEY = process.env.B2_PREFIX + 'settings.json';

// Default settings
const DEFAULT_SETTINGS = {
  jobs: {
    automaticMode: true,
    defaultMessageDelay: 3, // seconds between message parts
    defaultRecipientGap: 30, // seconds between recipients
    maxRetries: 3,
    humanization: {
      enabled: true,
      minDelay: 2,
      maxDelay: 8,
      typingSpeed: 50 // chars per second
    }
  },
  ui: {
    theme: 'dark',
    notifications: true
  },
  updatedAt: new Date().toISOString()
};

/**
 * GET /api/settings
 * Fetch current settings
 */
export async function GET() {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET,
      Key: SETTINGS_KEY
    });

    const response = await s3Client.send(command);
    const bodyString = await response.Body?.transformToString();
    const settings = JSON.parse(bodyString || '{}');

    return NextResponse.json(settings);
  } catch (error: any) {
    if (error.name === 'NoSuchKey') {
      // Settings don't exist yet, return defaults
      return NextResponse.json(DEFAULT_SETTINGS);
    }

    console.error('Error fetching settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/settings
 * Update settings
 */
export async function PUT(request: Request) {
  try {
    const body = await request.json();

    // Validate settings
    if (body.jobs) {
      if (typeof body.jobs.defaultMessageDelay !== 'number' || body.jobs.defaultMessageDelay < 0) {
        return NextResponse.json(
          { error: 'defaultMessageDelay must be a positive number' },
          { status: 400 }
        );
      }

      if (typeof body.jobs.defaultRecipientGap !== 'number' || body.jobs.defaultRecipientGap < 0) {
        return NextResponse.json(
          { error: 'defaultRecipientGap must be a positive number' },
          { status: 400 }
        );
      }

      if (typeof body.jobs.maxRetries !== 'number' || body.jobs.maxRetries < 1) {
        return NextResponse.json(
          { error: 'maxRetries must be at least 1' },
          { status: 400 }
        );
      }
    }

    // Add timestamp
    body.updatedAt = new Date().toISOString();

    // Save to S3
    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: SETTINGS_KEY,
      Body: JSON.stringify(body, null, 2),
      ContentType: 'application/json'
    });

    await s3Client.send(command);

    return NextResponse.json({ success: true, settings: body });
  } catch (error: any) {
    console.error('Error updating settings:', error);
    return NextResponse.json(
      { error: 'Failed to update settings', details: error.message },
      { status: 500 }
    );
  }
}
