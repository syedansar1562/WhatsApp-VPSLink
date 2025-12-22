const fs = require('fs');
const path = require('path');

// Parse VCF file
function parseVCF(vcfPath) {
    const content = fs.readFileSync(vcfPath, 'utf8');
    const contacts = [];

    const vcards = content.split('BEGIN:VCARD').filter(v => v.trim());

    for (const vcard of vcards) {
        const contact = {};

        // Extract name
        const fnMatch = vcard.match(/FN[^:]*:(.+)/);
        if (fnMatch) {
            contact.name = fnMatch[1].trim();
        }

        // Extract all phone numbers
        const telMatches = vcard.matchAll(/TEL[^:]*:(.+)/g);
        contact.numbers = [];

        for (const match of telMatches) {
            let number = match[1].trim();
            // Remove spaces, dashes, parentheses
            number = number.replace(/[\s\-\(\)]/g, '');
            // Remove leading 0 and add 44 for UK numbers
            if (number.startsWith('0')) {
                number = '44' + number.substring(1);
            }
            // Remove leading + if present
            number = number.replace(/^\+/, '');
            contact.numbers.push(number);
        }

        if (contact.name && contact.numbers.length > 0) {
            contacts.push(contact);
        }
    }

    return contacts;
}

// Load WhatsApp chats
function loadChats() {
    const chatsPath = path.join(__dirname, 'backups', 'chats.json');
    return JSON.parse(fs.readFileSync(chatsPath, 'utf8'));
}

// Save updated chats
function saveChats(chats) {
    const chatsPath = path.join(__dirname, 'backups', 'chats.json');
    fs.writeFileSync(chatsPath, JSON.stringify(chats, null, 2));
}

// Main function
function importContacts(vcfPath) {
    console.log('📱 Parsing contacts from VCF...');
    const contacts = parseVCF(vcfPath);
    console.log(`   Found ${contacts.length} contacts\n`);

    console.log('💬 Loading WhatsApp chats...');
    const chats = loadChats();
    const chatCount = Object.keys(chats).length;
    console.log(`   Found ${chatCount} chats\n`);

    console.log('🔗 Matching contacts to chats...\n');

    let matched = 0;

    for (const contact of contacts) {
        for (const number of contact.numbers) {
            const chatId = `${number}@s.whatsapp.net`;

            if (chats[chatId]) {
                console.log(`   ✓ ${contact.name} → ${number}`);
                chats[chatId].name = contact.name;
                matched++;
            }
        }
    }

    console.log(`\n📊 Results:`);
    console.log(`   Total contacts: ${contacts.length}`);
    console.log(`   Total chats: ${chatCount}`);
    console.log(`   Matched: ${matched}`);
    console.log(`   Unmatched: ${chatCount - matched}\n`);

    console.log('💾 Saving updated chats...');
    saveChats(chats);
    console.log('   ✅ Done!\n');

    console.log('You can now search by name:');
    console.log('   node wa.js search "Susie"');
    console.log('   node wa.js read "Nick"');
}

// Run
const vcfPath = process.argv[2] || '/Users/saadi/Desktop/contacts.vcf';
importContacts(vcfPath);
