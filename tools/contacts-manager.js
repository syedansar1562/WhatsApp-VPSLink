const fs = require('fs');
const path = require('path');

class ContactsManager {
    constructor() {
        this.contactsPath = path.join(__dirname, 'contacts.json');
        this.contacts = this.load();
    }

    load() {
        try {
            if (fs.existsSync(this.contactsPath)) {
                return JSON.parse(fs.readFileSync(this.contactsPath, 'utf8'));
            }
        } catch (error) {
            console.error('Error loading contacts:', error.message);
        }
        return {};
    }

    save() {
        fs.writeFileSync(this.contactsPath, JSON.stringify(this.contacts, null, 2));
    }

    // Import from VCF and clean
    importFromVCF(vcfPath) {
        const content = fs.readFileSync(vcfPath, 'utf8');
        const vcards = content.split('BEGIN:VCARD').filter(v => v.trim());
        let imported = 0;

        for (const vcard of vcards) {
            // Extract name (strip charset encoding)
            const fnMatch = vcard.match(/FN[^:]*:(.+)/);
            if (!fnMatch) continue;

            const name = fnMatch[1].trim();

            // Extract phone numbers
            const telMatches = vcard.matchAll(/TEL[^:]*:(.+)/g);
            const numbers = [];

            for (const match of telMatches) {
                let number = match[1].trim();
                // Clean: remove spaces, dashes, parentheses
                number = number.replace(/[\s\-\(\)]/g, '');
                // Convert UK numbers: 0 -> 44
                if (number.startsWith('0')) {
                    number = '44' + number.substring(1);
                }
                // Remove leading +
                number = number.replace(/^\+/, '');
                numbers.push(number);
            }

            if (numbers.length > 0) {
                // Use first number as primary
                const primaryNumber = numbers[0];

                if (!this.contacts[primaryNumber]) {
                    this.contacts[primaryNumber] = {
                        name: name,
                        numbers: numbers,
                        aliases: [],
                        notes: ''
                    };
                    imported++;
                }
            }
        }

        this.save();
        return imported;
    }

    // Add alias to contact
    addAlias(numberOrName, alias) {
        const contact = this.findContact(numberOrName);
        if (!contact) {
            return false;
        }

        if (!contact.aliases) {
            contact.aliases = [];
        }

        if (!contact.aliases.includes(alias)) {
            contact.aliases.push(alias);
            this.save();
        }

        return true;
    }

    // Remove alias
    removeAlias(numberOrName, alias) {
        const contact = this.findContact(numberOrName);
        if (!contact || !contact.aliases) {
            return false;
        }

        const index = contact.aliases.indexOf(alias);
        if (index > -1) {
            contact.aliases.splice(index, 1);
            this.save();
            return true;
        }

        return false;
    }

    // Find contact by number, name, or alias
    findContact(query) {
        const queryLower = query.toLowerCase();

        // Direct number match
        if (this.contacts[query]) {
            return this.contacts[query];
        }

        // Search by number, name, or alias
        for (const [number, contact] of Object.entries(this.contacts)) {
            // Check numbers
            if (contact.numbers && contact.numbers.includes(query)) {
                return contact;
            }

            // Check name
            if (contact.name && contact.name.toLowerCase().includes(queryLower)) {
                return contact;
            }

            // Check aliases
            if (contact.aliases) {
                for (const alias of contact.aliases) {
                    if (alias.toLowerCase().includes(queryLower)) {
                        return contact;
                    }
                }
            }
        }

        return null;
    }

    // Get primary number for a contact
    getNumber(query) {
        const contact = this.findContact(query);
        return contact ? contact.numbers[0] : null;
    }

    // Get name for a contact (including aliases)
    getName(query) {
        const contact = this.findContact(query);
        if (!contact) return null;

        let name = contact.name;
        if (contact.aliases && contact.aliases.length > 0) {
            name += ` (${contact.aliases.join(', ')})`;
        }
        return name;
    }

    // List all contacts
    list() {
        return Object.entries(this.contacts).map(([number, contact]) => ({
            number: number,
            name: contact.name,
            aliases: contact.aliases || [],
            allNumbers: contact.numbers || [number]
        }));
    }

    // Search contacts
    search(query) {
        const results = [];
        const queryLower = query.toLowerCase();

        for (const [number, contact] of Object.entries(this.contacts)) {
            let match = false;

            // Check name
            if (contact.name && contact.name.toLowerCase().includes(queryLower)) {
                match = true;
            }

            // Check aliases
            if (contact.aliases) {
                for (const alias of contact.aliases) {
                    if (alias.toLowerCase().includes(queryLower)) {
                        match = true;
                        break;
                    }
                }
            }

            // Check numbers
            if (number.includes(query) || (contact.numbers && contact.numbers.some(n => n.includes(query)))) {
                match = true;
            }

            if (match) {
                results.push({
                    number: number,
                    name: contact.name,
                    aliases: contact.aliases || [],
                    allNumbers: contact.numbers || [number]
                });
            }
        }

        return results;
    }

    // Export to clean text format
    exportToText(outputPath) {
        const lines = [];
        lines.push('WhatsApp Contacts - Text Export');
        lines.push('Generated: ' + new Date().toISOString());
        lines.push('Total Contacts: ' + Object.keys(this.contacts).length);
        lines.push('='.repeat(80));
        lines.push('');

        for (const [number, contact] of Object.entries(this.contacts)) {
            lines.push(`Name: ${contact.name}`);
            lines.push(`Number: ${number}`);

            if (contact.numbers && contact.numbers.length > 1) {
                lines.push(`Other Numbers: ${contact.numbers.slice(1).join(', ')}`);
            }

            if (contact.aliases && contact.aliases.length > 0) {
                lines.push(`Aliases: ${contact.aliases.join(', ')}`);
            }

            if (contact.notes) {
                lines.push(`Notes: ${contact.notes}`);
            }

            lines.push('-'.repeat(80));
        }

        fs.writeFileSync(outputPath, lines.join('\n'));
        return lines.length;
    }

    // Add notes to contact
    addNotes(numberOrName, notes) {
        const contact = this.findContact(numberOrName);
        if (!contact) {
            return false;
        }

        contact.notes = notes;
        this.save();
        return true;
    }
}

module.exports = ContactsManager;

// CLI Interface
if (require.main === module) {
    const manager = new ContactsManager();
    const args = process.argv.slice(2);
    const command = args[0];

    switch(command) {
        case 'import':
            const vcfPath = args[1] || '/Users/saadi/Desktop/contacts.vcf';
            console.log('📱 Importing contacts from VCF...');
            const imported = manager.importFromVCF(vcfPath);
            console.log(`✅ Imported ${imported} contacts`);
            console.log(`📊 Total contacts: ${Object.keys(manager.contacts).length}`);
            break;

        case 'alias':
            if (args.length < 3) {
                console.log('Usage: node contacts-manager.js alias <name/number> <alias>');
                break;
            }
            const target = args[1];
            const alias = args[2];
            if (manager.addAlias(target, alias)) {
                console.log(`✅ Added alias "${alias}" to ${target}`);
            } else {
                console.log(`❌ Contact not found: ${target}`);
            }
            break;

        case 'remove-alias':
            if (args.length < 3) {
                console.log('Usage: node contacts-manager.js remove-alias <name/number> <alias>');
                break;
            }
            if (manager.removeAlias(args[1], args[2])) {
                console.log(`✅ Removed alias "${args[2]}"`);
            } else {
                console.log(`❌ Alias not found`);
            }
            break;

        case 'search':
            if (args.length < 2) {
                console.log('Usage: node contacts-manager.js search <query>');
                break;
            }
            const results = manager.search(args[1]);
            console.log(`\n🔍 Found ${results.length} contacts:\n`);
            results.forEach(c => {
                console.log(`   ${c.name} (${c.number})`);
                if (c.aliases.length > 0) {
                    console.log(`   Aliases: ${c.aliases.join(', ')}`);
                }
                console.log('');
            });
            break;

        case 'list':
            const contacts = manager.list();
            console.log(`\n📋 ${contacts.length} contacts:\n`);
            contacts.forEach(c => {
                console.log(`   ${c.name} - ${c.number}`);
                if (c.aliases.length > 0) {
                    console.log(`   (${c.aliases.join(', ')})`);
                }
            });
            break;

        case 'export':
            const outputPath = args[1] || 'contacts-export.txt';
            const lineCount = manager.exportToText(outputPath);
            console.log(`✅ Exported ${lineCount} lines to ${outputPath}`);
            break;

        case 'notes':
            if (args.length < 3) {
                console.log('Usage: node contacts-manager.js notes <name/number> <notes>');
                break;
            }
            const notesTarget = args[1];
            const notes = args.slice(2).join(' ');
            if (manager.addNotes(notesTarget, notes)) {
                console.log(`✅ Added notes to ${notesTarget}`);
            } else {
                console.log(`❌ Contact not found: ${notesTarget}`);
            }
            break;

        default:
            console.log(`
WhatsApp Contacts Manager

Commands:
  import [vcf-path]              Import contacts from VCF file
  alias <name/number> <alias>    Add nickname/alias to contact
  remove-alias <name> <alias>    Remove alias from contact
  search <query>                 Search contacts by name/alias/number
  list                           List all contacts
  export [output-path]           Export to clean text file
  notes <name/number> <text>     Add notes to contact

Examples:
  node contacts-manager.js import /Users/saadi/Desktop/contacts.vcf
  node contacts-manager.js alias "Susie Ansar" "Sis"
  node contacts-manager.js alias 447950724774 "Nick"
  node contacts-manager.js search Nick
  node contacts-manager.js export contacts.txt
            `);
    }
}
