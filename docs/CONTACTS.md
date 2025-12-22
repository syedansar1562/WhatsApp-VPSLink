# Contact Management Guide

WhatsApp VPSLink provides tools to manage contacts and create aliases for easier chat access.

## Overview

**Problem:** WhatsApp messages use phone numbers like `447950724774@s.whatsapp.net`

**Solution:** Import contacts and add aliases to use names instead:

```bash
# Instead of this:
node wa.js read 447950724774

# Use this:
node wa.js read Nick
```

## Contact Storage

Contacts are stored in `contacts.json`:

```json
{
  "447950724774": {
    "name": "Nick Smith",
    "alias": "Nick"
  },
  "447779299086": {
    "name": "Syed Ansar",
    "alias": "Ansar"
  }
}
```

## Method 1: Import from VCF (Recommended)

VCF files contain your phone's contact list. This is the easiest method.

### Step 1: Export Contacts from Phone

**iPhone:**
1. Open **Contacts** app
2. Select all contacts (or specific ones)
3. Share → Export vCard
4. AirDrop to Mac or email to yourself

**Android:**
1. Open **Contacts** app
2. Menu → Export → Export to .vcf file
3. Transfer file to Mac (Google Drive, USB, etc.)

### Step 2: Import to WhatsApp VPSLink

```bash
node tools/import-contacts.js /path/to/contacts.vcf
```

Example output:

```
Importing contacts from: /path/to/contacts.vcf
Processing contact: Nick Smith (447950724774)
Processing contact: John Doe (447123456789)
✓ Imported 2 contacts
✓ Contacts saved to contacts.json
```

### Step 3: Verify Import

```bash
node wa.js chats 10
```

You should now see contact names instead of phone numbers.

## Method 2: Manual Contact Management

If you don't have a VCF file, you can manually manage contacts.

### Export to Editable Text File

```bash
node tools/contacts-manager.js export contacts.txt
```

This creates `contacts.txt`:

```
# WhatsApp Contacts
# Format: phone_number|name|alias
# Lines starting with # are ignored

447950724774|Nick Smith|Nick
447779299086|Syed Ansar|Ansar
```

### Edit contacts.txt

Add new contacts or modify existing ones:

```
447950724774|Nick Smith|Nick
447779299086|Syed Ansar|Ansar
447123456789|John Doe|John
447987654321|Jane Smith|Jane
```

**Format:**
- `phone_number`: Without `+` or `@s.whatsapp.net`
- `name`: Full contact name
- `alias`: Short nickname for commands

### Import Edited File

```bash
node tools/import-aliases.js contacts.txt
```

## Method 3: Add Single Contact

Edit `contacts.json` directly:

```bash
nano contacts.json
```

Add contact manually:

```json
{
  "447950724774": {
    "name": "Nick Smith",
    "alias": "Nick"
  },
  "447123456789": {
    "name": "John Doe",
    "alias": "John"
  }
}
```

## Using Aliases in Commands

Once contacts are imported, you can use aliases in all commands:

### Read Messages

```bash
# With alias
node wa.js read Nick

# With phone number (still works)
node wa.js read 447950724774
```

### Download Media

```bash
# Download voice notes from Nick
node wa.js download Nick voice 5

# Download images from Ansar
node wa.js download Ansar image 10
```

### Search Chats

```bash
# Search by alias
node wa.js search Nick
```

### Send Messages

```bash
# Send to alias
node wa.js send Nick "Hey, how are you?"

# Send to phone number
node wa.js send 447950724774 "Hey, how are you?"
```

## Alias Resolution Priority

When you use a command like `node wa.js read Nick`, the system checks:

1. **Exact alias match** in `contacts.json`
2. **Partial name match** (case-insensitive)
3. **Phone number** (if input is numeric)

Example:

```bash
# These all work:
node wa.js read Nick          # Exact alias match
node wa.js read nick          # Case-insensitive
node wa.js read Nick Smith    # Full name match
node wa.js read 447950724774  # Phone number
```

## Bulk Operations

### Import from Multiple VCF Files

```bash
# Import first file
node tools/import-contacts.js contacts1.vcf

# Import second file (merges with existing)
node tools/import-contacts.js contacts2.vcf
```

Duplicate phone numbers are updated with new information.

### Export Current Contacts

```bash
node tools/contacts-manager.js export current-contacts.txt
```

Edit and re-import:

```bash
node tools/import-aliases.js current-contacts.txt
```

## Group Chats

Group chats use a different ID format: `123456789-1234567890@g.us`

### Finding Group IDs

```bash
node wa.js groups
```

Output:

```
Group Chats:

Family Group (120363012345678901@g.us)
- Last message: 2025-12-22 18:30
- 15 messages

Work Team (120363098765432109@g.us)
- Last message: 2025-12-22 17:45
- 42 messages
```

### Adding Group Aliases

Edit `contacts.json`:

```json
{
  "120363012345678901@g.us": {
    "name": "Family Group",
    "alias": "Family"
  }
}
```

Then use:

```bash
node wa.js read Family
node wa.js download Family image 5
```

## Handling Unknown Numbers

If someone messages you who's not in your contacts:

### Step 1: Find Their Number

```bash
node wa.js chats 20
```

Look for unknown numbers like `447123456789`.

### Step 2: Add to Contacts

Quick method - edit `contacts.json`:

```json
{
  "447123456789": {
    "name": "New Contact",
    "alias": "NewPerson"
  }
}
```

Or use the export/import workflow:

```bash
node tools/contacts-manager.js export contacts.txt
# Edit contacts.txt to add: 447123456789|New Contact|NewPerson
node tools/import-aliases.js contacts.txt
```

## Troubleshooting

### "Contact not found"

Check:
1. Alias exists in `contacts.json`
2. Spelling is correct (case-insensitive)
3. Phone number format is correct (no `+` or `@s.whatsapp.net`)

### Invalid VCF Format

Some VCF files use different formats. If import fails:

1. Open VCF in text editor
2. Verify format:

```
BEGIN:VCARD
VERSION:3.0
FN:Nick Smith
TEL;TYPE=CELL:+447950724774
END:VCARD
```

3. If phone number has spaces or dashes, remove them:
   - ❌ `+44 7950 724 774`
   - ✓ `+447950724774`

### Duplicate Contacts

If you import the same contact twice, the last import wins:

```bash
# First import
node tools/import-contacts.js old-contacts.vcf
# Nick Smith -> 447950724774

# Second import (updates)
node tools/import-contacts.js new-contacts.vcf
# Nick Smith -> 447950724774 (updated)
```

### Missing Contacts After Import

Check `contacts.json` exists:

```bash
ls -la contacts.json
```

If missing, re-import:

```bash
node tools/import-contacts.js /path/to/contacts.vcf
```

## Advanced: Programmatic Access

You can use the ContactsManager class in your own scripts:

```javascript
const ContactsManager = require('./tools/contacts-manager.js');

const contacts = new ContactsManager();

// Get phone number from alias
const phone = contacts.getNumber('Nick');
console.log(phone); // 447950724774

// Get name from phone number
const name = contacts.getName('447950724774');
console.log(name); // Nick Smith

// Add new contact
contacts.addContact('447123456789', 'John Doe', 'John');
contacts.save();
```

## Contact Sync Between Mac and VPS

### Manual Sync

When you update contacts on Mac, sync to VPS:

```bash
# From Mac
rsync -avz contacts.json root@your-vps-ip:/root/whatsapp-vpslink/
```

### Automatic Sync (Optional)

Add to your deployment script:

```bash
#!/bin/bash
# deploy.sh

# Deploy code
rsync -avz --exclude 'node_modules' \
  /Users/saadi/Documents/GitHub/whatsapp-vpslink/ \
  root@your-vps-ip:/root/whatsapp-vpslink/

# Restart listener
ssh root@your-vps-ip 'cd /root/whatsapp-vpslink && pm2 restart whatsapp-listener'
```

Run whenever contacts change:

```bash
bash deploy.sh
```

## Best Practices

1. **Use short aliases** - Easier to type in commands
   - ✓ "Nick" (good)
   - ✗ "Nick Smith from Work" (too long)

2. **Unique aliases** - Avoid conflicts
   - ✗ Two people with alias "John"
   - ✓ "John", "JohnW" (unique)

3. **Keep VCF backup** - Store original VCF file safely
   - Allows re-import if `contacts.json` gets corrupted

4. **Regular updates** - Re-import when you add new contacts to phone
   ```bash
   node tools/import-contacts.js ~/Downloads/contacts.vcf
   ```

5. **Version control** - Add to git (optional)
   ```bash
   git add contacts.json
   git commit -m "Update contacts"
   ```

## Next Steps

- See [README.md](../README.md) for general usage
- See [DEPLOYMENT.md](DEPLOYMENT.md) for VPS deployment
- See [S3-SETUP.md](S3-SETUP.md) for S3 configuration
