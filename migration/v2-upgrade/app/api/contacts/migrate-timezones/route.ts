import { NextResponse } from 'next/server';
import { getContacts, saveContacts } from '@/lib/s3';
import { getTimezoneFromPhone } from '@/lib/timezones';

/**
 * POST /api/contacts/migrate-timezones
 * Auto-assign timezones to all contacts based on their phone numbers
 */
export async function POST() {
  try {
    const contacts = await getContacts();
    let updatedCount = 0;

    // Iterate through all contacts and assign timezone if missing
    for (const [phone, contact] of Object.entries(contacts)) {
      if (!contact.timezone) {
        const autoTimezone = getTimezoneFromPhone(contact.phones.primary);
        contact.timezone = autoTimezone;
        updatedCount++;
        console.log(`Assigned ${autoTimezone} to ${contact.name} (${contact.phones.primary})`);
      }
    }

    // Save updated contacts
    await saveContacts(contacts);

    return NextResponse.json({
      success: true,
      totalContacts: Object.keys(contacts).length,
      updatedCount,
      message: `Successfully assigned timezones to ${updatedCount} contacts`
    });
  } catch (error: any) {
    console.error('Migration error:', error);
    return NextResponse.json(
      { error: 'Failed to migrate timezones', details: error.message },
      { status: 500 }
    );
  }
}
