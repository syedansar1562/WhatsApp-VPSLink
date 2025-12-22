#!/usr/bin/env node

/**
 * Migrate VCF contacts to enhanced JSON format for S3
 * Usage: node scripts/migrate-contacts.js /path/to/contacts.vcf
 */

const fs = require('fs');
const path = require('path');

function parseVCF(vcfContent) {
  const contacts = {};
  const cards = vcfContent.split('BEGIN:VCARD');

  for (const card of cards) {
    if (!card.trim()) continue;

    let name = '';
    let phones = [];

    const lines = card.split('\n');

    for (const line of lines) {
      const trimmedLine = line.trim();

      // Parse full name
      if (trimmedLine.startsWith('FN:')) {
        name = trimmedLine.substring(3).trim();
      }

      // Parse phone numbers
      if (trimmedLine.startsWith('TEL') || trimmedLine.includes('TEL')) {
        // Extract phone number (handle various formats)
        const phoneMatch = trimmedLine.match(/:([\d\s\+\-\(\)]+)$/);
        if (phoneMatch) {
          let phone = phoneMatch[1].replace(/[\s\-\(\)]/g, ''); // Remove spaces, dashes, parentheses

          // Normalize UK numbers
          if (phone.startsWith('+44')) {
            phone = '44' + phone.substring(3);
          } else if (phone.startsWith('0')) {
            phone = '44' + phone.substring(1);
          }

          phones.push(phone);
        }
      }
    }

    // Add to contacts if we have both name and phone
    if (name && phones.length > 0) {
      const primaryPhone = phones[0];

      // Generate alias from first name
      const alias = name.split(' ')[0];

      contacts[primaryPhone] = {
        name: name,
        aliases: [alias],
        phones: {
          primary: primaryPhone,
          secondary: phones[1] || null
        },
        favorite: false,
        tags: []
      };
    }
  }

  return contacts;
}

// Main execution
const vcfPath = process.argv[2] || '/Users/saadi/Desktop/addy.vcf';

if (!fs.existsSync(vcfPath)) {
  console.error(`❌ File not found: ${vcfPath}`);
  process.exit(1);
}

console.log(`📖 Reading VCF file: ${vcfPath}`);
const vcfContent = fs.readFileSync(vcfPath, 'utf8');

console.log('🔄 Parsing contacts...');
const contacts = parseVCF(vcfContent);

const contactCount = Object.keys(contacts).length;
console.log(`✅ Parsed ${contactCount} contacts`);

// Save to contacts.json
const outputPath = path.join(__dirname, '..', 'contacts.json');
fs.writeFileSync(outputPath, JSON.stringify(contacts, null, 2));

console.log(`💾 Saved to: ${outputPath}`);
console.log('\n📊 Sample contacts:');
console.log(JSON.stringify(Object.fromEntries(Object.entries(contacts).slice(0, 3)), null, 2));

console.log(`\n✨ Done! ${contactCount} contacts ready for S3.`);
