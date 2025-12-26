import { NextResponse } from 'next/server';
import { getContacts, saveContacts } from '@/lib/s3';

export async function GET() {
  try {
    const contacts = await getContacts();
    return NextResponse.json(contacts);
  } catch (error) {
    console.error('Error fetching contacts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch contacts', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const contacts = await request.json();
    await saveContacts(contacts);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving contacts:', error);
    return NextResponse.json(
      { error: 'Failed to save contacts', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
