import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
  endpoint: process.env.B2_ENDPOINT!,
  region: 'eu-central-003',
  credentials: {
    accessKeyId: process.env.B2_KEY_ID!,
    secretAccessKey: process.env.B2_APP_KEY!
  }
});

export interface Contact {
  name: string;
  aliases: string[];
  phones: {
    primary: string;
    secondary: string | null;
  };
  defaultPhone: 'primary' | 'secondary';
  favorite: boolean;
  tags: string[];
  timezone?: string; // IANA timezone (e.g., 'Europe/London', 'Asia/Dubai')
}

export interface ScheduledMessage {
  id: string;
  to: string;
  contactName: string;
  message: string;
  scheduledTime: string; // UTC ISO string
  status: 'pending' | 'sent' | 'failed';
  createdAt: string;
  createdFrom: string;
  sentAt: string | null;
  error?: string;
  // Timezone metadata for display
  recipientTimezone?: string; // IANA timezone
  recipientLocalTime?: string; // Original local time string
  scheduledInTimezone?: string; // Which timezone was used for scheduling
}

export async function getContacts(): Promise<Record<string, Contact>> {
  const command = new GetObjectCommand({
    Bucket: process.env.B2_BUCKET_NAME!,
    Key: 'whatsapp/contacts.json'
  });

  const response = await s3Client.send(command);
  const bodyString = await response.Body!.transformToString();
  return JSON.parse(bodyString);
}

export async function saveContacts(contacts: Record<string, Contact>): Promise<void> {
  const command = new PutObjectCommand({
    Bucket: process.env.B2_BUCKET_NAME!,
    Key: 'whatsapp/contacts.json',
    Body: JSON.stringify(contacts, null, 2),
    ContentType: 'application/json'
  });

  await s3Client.send(command);
}

export async function getScheduledMessages(): Promise<{ messages: ScheduledMessage[] }> {
  try {
    const command = new GetObjectCommand({
      Bucket: process.env.B2_BUCKET_NAME!,
      Key: 'whatsapp/scheduled-messages.json'
    });

    const response = await s3Client.send(command);
    const bodyString = await response.Body!.transformToString();
    return JSON.parse(bodyString);
  } catch (error: any) {
    if (error.name === 'NoSuchKey') {
      return { messages: [] };
    }
    throw error;
  }
}

export async function saveScheduledMessages(data: { messages: ScheduledMessage[] }): Promise<void> {
  const command = new PutObjectCommand({
    Bucket: process.env.B2_BUCKET_NAME!,
    Key: 'whatsapp/scheduled-messages.json',
    Body: JSON.stringify(data, null, 2),
    ContentType: 'application/json'
  });

  await s3Client.send(command);
}
