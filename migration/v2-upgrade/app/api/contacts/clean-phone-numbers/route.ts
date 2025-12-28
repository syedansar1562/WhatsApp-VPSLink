import { NextResponse } from 'next/server';
import { getContacts, saveContacts } from '@/lib/s3';

/**
 * Clean phone number by removing + prefix and whitespace
 */
function cleanPhoneNumber(phone: string | null): string | null {
  if (!phone) return null;
  return phone.replace(/^\+/, '').replace(/\s/g, '');
}

/**
 * POST /api/contacts/clean-phone-numbers
 * Remove + prefix and whitespace from all contact phone numbers
 */
export async function POST() {
  try {
    const contacts = await getContacts();
    let updatedCount = 0;
    const updatedContacts: Record<string, any> = {};

    // Process each contact
    for (const [contactKey, contact] of Object.entries(contacts)) {
      const originalPrimary = contact.phones.primary;
      const originalSecondary = contact.phones.secondary;

      // Clean phone numbers
      const cleanedPrimary = cleanPhoneNumber(originalPrimary);
      const cleanedSecondary = cleanPhoneNumber(originalSecondary);

      // Determine the new contact key (should be the cleaned primary phone)
      const newContactKey = cleanedPrimary || contactKey;

      // Update contact with cleaned phone numbers
      const updatedContact = {
        ...contact,
        phones: {
          primary: cleanedPrimary!,
          secondary: cleanedSecondary,
        },
      };

      // Track if anything changed
      if (
        originalPrimary !== cleanedPrimary ||
        originalSecondary !== cleanedSecondary ||
        contactKey !== newContactKey
      ) {
        updatedCount++;
        console.log(`Cleaned ${contact.name}: ${originalPrimary} → ${cleanedPrimary}`);
      }

      updatedContacts[newContactKey] = updatedContact;
    }

    // Save updated contacts
    await saveContacts(updatedContacts);

    return NextResponse.json({
      success: true,
      message: `Cleaned phone numbers for ${updatedCount} contacts`,
      totalContacts: Object.keys(updatedContacts).length,
      updatedCount,
    });
  } catch (error) {
    console.error('Phone number cleanup error:', error);
    return NextResponse.json(
      { error: 'Failed to clean phone numbers', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
