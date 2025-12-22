const fs = require('fs');
const ContactsManager = require('./contacts-manager');

/**
 * Import aliases from a text file
 *
 * Text file format:
 * Name: John Smith
 * Number: 447950724774
 * Aliases: Nick, Nicky, John
 * ----------------
 */

function importAliasesFromText(textFilePath) {
    const manager = new ContactsManager();
    const content = fs.readFileSync(textFilePath, 'utf8');

    // Split by separator lines
    const entries = content.split(/^-{20,}$/m);

    let processed = 0;
    let aliasesAdded = 0;

    for (const entry of entries) {
        if (!entry.trim()) continue;

        // Extract name
        const nameMatch = entry.match(/^Name:\s*(.+)$/m);
        if (!nameMatch) continue;
        const name = nameMatch[1].trim();

        // Extract number
        const numberMatch = entry.match(/^Number:\s*(.+)$/m);
        if (!numberMatch) continue;
        const number = numberMatch[1].trim();

        // Extract aliases (if present)
        const aliasMatch = entry.match(/^Aliases?:\s*(.+)$/m);
        if (aliasMatch) {
            const aliasesStr = aliasMatch[1].trim();
            const aliases = aliasesStr.split(',').map(a => a.trim()).filter(a => a);

            for (const alias of aliases) {
                if (manager.addAlias(number, alias)) {
                    aliasesAdded++;
                    console.log(`✓ Added alias "${alias}" to ${name} (${number})`);
                }
            }
        }

        processed++;
    }

    console.log(`\n📊 Summary:`);
    console.log(`   Processed: ${processed} contacts`);
    console.log(`   Aliases added: ${aliasesAdded}`);
}

// CLI
const textFile = process.argv[2];

if (!textFile) {
    console.log(`
Import Aliases from Text File

Usage:
  node import-aliases.js <text-file>

Text file format:
  Name: John Smith
  Number: 447950724774
  Aliases: Nick, Nicky, John
  ----------------

  Name: Susie Ansar
  Number: 447985130453
  Aliases: Sis, Susie
  ----------------

Steps:
  1. Export contacts to text:
     node contacts-manager.js export contacts-editable.txt

  2. Edit contacts-editable.txt and add "Aliases: name1, name2" lines

  3. Import back:
     node import-aliases.js contacts-editable.txt

Example:
  node contacts-manager.js export my-contacts.txt
  # Edit my-contacts.txt, add aliases
  node import-aliases.js my-contacts.txt
    `);
    process.exit(1);
}

if (!fs.existsSync(textFile)) {
    console.error(`Error: File not found: ${textFile}`);
    process.exit(1);
}

importAliasesFromText(textFile);
