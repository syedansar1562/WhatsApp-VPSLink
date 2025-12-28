# Contact Management System

## Overview

WhatsApp-VPSLink includes a comprehensive contact management system with support for aliases, favorites, tags, and VCF import. The system stores 272 contacts in S3 cloud storage with flexible search capabilities.

**Storage:** S3 (`whatsapp/contacts.json`, 57KB)
**Count:** 272 contacts
**Features:** Aliases, Favorites, Tags, Search, Import/Export

---

## Contact Schema

### Data Structure

```json
{
  "447957189696": {
    "name": "Reem",
    "aliases": ["Reemy", "R", "Sister"],
    "phones": {
      "primary": "447957189696",
      "secondary": null
    },
    "favorite": true,
    "tags": ["family"]
  }
}
```

**Key = Phone Number (no @s.whatsapp.net suffix)**

### Field Specifications

| Field | Type | Required | Description | Default |
|-------|------|----------|-------------|---------|
| `name` | string | ✅ | Display name | Phone number |
| `aliases` | string[] | ❌ | Alternative names | [] |
| `phones.primary` | string | ✅ | Main WhatsApp number | Key |
| `phones.secondary` | string \| null | ❌ | Alternative number | null |
| `favorite` | boolean | ❌ | Star/favorite flag | false |
| `tags` | string[] | ❌ | Categories | [] |

---

## Aliases System

### Purpose

Aliases enable **flexible multi-name search** for contacts. Instead of remembering the exact name, users can search by nicknames, relationships, or any custom identifier.

### Use Cases

**1. Nicknames**
```json
{
  "name": "Nicholas Smith",
  "aliases": ["Nick", "Nicky", "Nic"]
}
```
Search: "nick" → Matches ✅

**2. Relationships**
```json
{
  "name": "Reem Ahmed",
  "aliases": ["Sister", "Reemy"]
}
```
Search: "sister" → Matches ✅

**3. Full Names**
```json
{
  "name": "Bob",
  "aliases": ["Robert Johnson", "Bobby"]
}
```
Search: "robert" → Matches ✅

**4. Business Roles**
```json
{
  "name": "John Doe",
  "aliases": ["Accountant", "CPA", "Tax Guy"]
}
```
Search: "accountant" → Matches ✅

**5. Multiple People (Groups)**
```json
{
  "name": "Marketing Team",
  "aliases": ["Sarah", "Mike", "Lisa"]
}
```
Search: "sarah" → Matches "Marketing Team" ✅

### Adding Aliases

**Via CLI Tool:**
```bash
# Add single alias
node tools/contacts-manager.js alias "Reem" "Sister"

# Add multiple aliases
node tools/contacts-manager.js alias "Nick" "Nicky"
node tools/contacts-manager.js alias "Nick" "Nicholas"
```

**Via Web UI:**
```typescript
// Update contact with new alias
await updateContact("447957189696", {
  aliases: [...existingAliases, "NewAlias"]
});
```

**Bulk Import:**
```bash
# Create aliases.txt:
# Reem: Sister, Reemy, R
# Nick: Nicky, Nicholas, N

node tools/import-aliases.js aliases.txt
```

### Search Implementation

```typescript
function searchContacts(query: string, contacts: Record<string, Contact>) {
  const lowerQuery = query.toLowerCase();

  return Object.entries(contacts).filter(([phone, contact]) => {
    // Search by name
    if (contact.name.toLowerCase().includes(lowerQuery)) return true;

    // Search by phone
    if (phone.includes(query)) return true;

    // Search by alias
    if (contact.aliases?.some(alias =>
      alias.toLowerCase().includes(lowerQuery)
    )) return true;

    return false;
  });
}
```

**Example:**
```typescript
searchContacts("sister", contacts);
// Returns: [{ phone: "447957189696", name: "Reem", ... }]

searchContacts("reemy", contacts);
// Returns: [{ phone: "447957189696", name: "Reem", ... }]

searchContacts("447957", contacts);
// Returns: [{ phone: "447957189696", name: "Reem", ... }]
```

---

## Favorites System

### Purpose

Mark frequently contacted people with a **star icon** for quick access.

### Implementation

**Toggle Favorite:**
```typescript
// Mark as favorite
await updateContact("447957189696", { favorite: true });

// Remove favorite
await updateContact("447957189696", { favorite: false });
```

**Filter Favorites:**
```typescript
function getFavorites(contacts: Record<string, Contact>) {
  return Object.entries(contacts)
    .filter(([_, contact]) => contact.favorite)
    .map(([phone, contact]) => ({ phone, ...contact }));
}
```

**Web UI Toggle:**
```typescript
// ScheduleModal.tsx
const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

const filteredContacts = Object.entries(contacts)
  .filter(([_, contact]) => {
    if (showFavoritesOnly && !contact.favorite) return false;
    return true;
  });
```

**Display:**
```typescript
{contact.favorite && (
  <Star className="w-4 h-4 text-warning fill-warning" />
)}
```

---

## Tags System

### Purpose

**Categorize contacts** for future filtering and bulk operations.

### Common Tags

```typescript
const commonTags = [
  'family',      // Family members
  'friends',     // Personal friends
  'work',        // Work colleagues
  'clients',     // Business clients
  'important',   // VIP contacts
  'group-admin', // WhatsApp group admins
  'business',    // Business contacts
  'personal'     // Personal contacts
];
```

### Multi-Tag Support

```json
{
  "name": "John Smith",
  "tags": ["work", "clients", "important"]
}
```

### Future Use Cases

**Filter by Tag:**
```typescript
function getContactsByTag(tag: string) {
  return Object.entries(contacts)
    .filter(([_, contact]) => contact.tags.includes(tag))
    .map(([phone, contact]) => ({ phone, ...contact }));
}

// Example:
getContactsByTag('family');  // All family members
getContactsByTag('clients'); // All clients
```

**Bulk Message to Tag:**
```typescript
// Send message to all contacts with 'clients' tag
const clients = getContactsByTag('clients');
for (const client of clients) {
  await scheduleMessage({
    to: client.phone,
    contactName: client.name,
    message: "Happy Holidays!",
    scheduledTime: "2025-12-25T10:00:00.000Z"
  });
}
```

**Tag-Based Access Control:**
```typescript
// Only allow scheduling to 'approved' contacts
if (!contact.tags.includes('approved')) {
  throw new Error('Contact not approved for messaging');
}
```

---

## VCF Import

### VCF File Format

**VCF (vCard)** is the standard contact export format used by:
- iPhone Contacts app
- Google Contacts
- Android Contacts
- Outlook
- Mac Contacts

### Sample VCF

```vcf
BEGIN:VCARD
VERSION:3.0
FN:Nick Smith
TEL;TYPE=CELL:+447950724774
END:VCARD

BEGIN:VCARD
VERSION:3.0
FN:Reem Ahmed
TEL;TYPE=CELL:+447957189696
TEL;TYPE=HOME:+447123456780
END:VCARD
```

### Import Process

```bash
# Import VCF file
node tools/import-contacts.js /path/to/contacts.vcf
```

**Implementation:**
```javascript
// tools/import-contacts.js
const fs = require('fs');

function parseVCF(vcfContent) {
  const contacts = {};
  const vcards = vcfContent.split('BEGIN:VCARD');

  for (const vcard of vcards) {
    if (!vcard.trim()) continue;

    let name = '';
    const phones = [];

    // Parse FN (Full Name)
    const fnMatch = vcard.match(/FN:(.*)/);
    if (fnMatch) name = fnMatch[1].trim();

    // Parse TEL (Telephone)
    const telMatches = vcard.matchAll(/TEL[^:]*:(.*)/g);
    for (const match of telMatches) {
      let phone = match[1].trim();
      // Clean phone number
      phone = phone.replace(/[^0-9]/g, '');
      if (phone.startsWith('0')) phone = '44' + phone.substring(1);
      phones.push(phone);
    }

    // Add to contacts
    if (name && phones.length > 0) {
      contacts[phones[0]] = {
        name,
        aliases: [],
        phones: {
          primary: phones[0],
          secondary: phones[1] || null
        },
        favorite: false,
        tags: []
      };
    }
  }

  return contacts;
}

// Read VCF file
const vcfPath = process.argv[2];
const vcfContent = fs.readFileSync(vcfPath, 'utf-8');

// Parse contacts
const newContacts = parseVCF(vcfContent);

// Merge with existing contacts
const existingContacts = require('../contacts.json');
const merged = { ...existingContacts, ...newContacts };

// Save to file
fs.writeFileSync('contacts.json', JSON.stringify(merged, null, 2));

console.log(`✓ Imported ${Object.keys(newContacts).length} contacts`);
```

### Phone Number Normalization

**UK Numbers:**
```javascript
// Input: 07950724774
// Output: 447950724774

let phone = "07950724774";
phone = phone.replace(/[^0-9]/g, '');  // Remove non-digits
if (phone.startsWith('0')) {
  phone = '44' + phone.substring(1);   // Replace 0 with 44
}
// Result: "447950724774"
```

**International Numbers:**
```javascript
// Input: +1 (555) 123-4567
// Output: 15551234567

let phone = "+1 (555) 123-4567";
phone = phone.replace(/[^0-9]/g, '');  // "15551234567"
```

---

## CLI Tools

### contacts-manager.js

**Location:** `tools/contacts-manager.js`

**Commands:**

**1. Import VCF**
```bash
node tools/contacts-manager.js import contacts.vcf
```

**2. Add Alias**
```bash
node tools/contacts-manager.js alias "Reem" "Sister"
```

**3. Search**
```bash
node tools/contacts-manager.js search "reem"
# Output:
# Found 1 contact:
# - Reem (447957189696)
#   Aliases: Reemy, R, Sister
```

**4. List All**
```bash
node tools/contacts-manager.js list
# Output:
# 272 contacts:
# - Reem (447957189696) ⭐
# - Nick Smith (447950724774)
# - ...
```

**5. Export**
```bash
node tools/contacts-manager.js export contacts-backup.txt
# Creates text file with all contacts
```

### import-aliases.js

**Location:** `tools/import-aliases.js`

**Purpose:** Bulk import aliases from text file

**Format:**
```
# aliases.txt
Reem: Sister, Reemy, R
Nick: Nicky, Nicholas
Chris: Christopher, ChrisB
```

**Usage:**
```bash
node tools/import-aliases.js aliases.txt
# Output:
# ✓ Added 3 aliases to Reem
# ✓ Added 2 aliases to Nick
# ✓ Added 2 aliases to Chris
```

### upload-contacts-to-s3.js

**Location:** `scripts/upload-contacts-to-s3.js`

**Purpose:** Upload local contacts.json to S3

```bash
node scripts/upload-contacts-to-s3.js
# Output:
# ✓ Uploaded contacts.json to S3
# URL: s3://WhatsAppVPS/whatsapp/contacts.json
```

---

## Web UI Integration

### Contact Picker Component

```typescript
// components/ContactPicker.tsx
interface ContactPickerProps {
  contacts: Record<string, Contact>;
  onSelect: (contact: Contact) => void;
}

export default function ContactPicker({
  contacts,
  onSelect
}: ContactPickerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  const filteredContacts = Object.entries(contacts)
    .filter(([phone, contact]) => {
      // Favorites filter
      if (showFavoritesOnly && !contact.favorite) return false;

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          contact.name.toLowerCase().includes(query) ||
          phone.includes(query) ||
          contact.aliases?.some(alias =>
            alias.toLowerCase().includes(query)
          )
        );
      }

      return true;
    })
    .map(([phone, contact]) => ({ phone, ...contact }));

  return (
    <div>
      {/* Search Input */}
      <input
        type="text"
        placeholder="Search by name, phone, or alias..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />

      {/* Favorites Toggle */}
      <button onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}>
        <Star className={showFavoritesOnly ? 'fill-warning' : ''} />
      </button>

      {/* Contact List */}
      <div>
        {filteredContacts.map((contact) => (
          <button
            key={contact.phone}
            onClick={() => onSelect(contact)}
          >
            <div>{contact.name}</div>
            <div>{contact.phone}</div>
            {contact.favorite && <Star />}
          </button>
        ))}
      </div>
    </div>
  );
}
```

### Contact Editor

```typescript
// components/ContactEditor.tsx
interface ContactEditorProps {
  contact: Contact;
  onSave: (updates: Partial<Contact>) => void;
}

export default function ContactEditor({
  contact,
  onSave
}: ContactEditorProps) {
  const [name, setName] = useState(contact.name);
  const [aliases, setAliases] = useState(contact.aliases.join(', '));
  const [favorite, setFavorite] = useState(contact.favorite);
  const [tags, setTags] = useState(contact.tags.join(', '));

  const handleSave = () => {
    onSave({
      name,
      aliases: aliases.split(',').map(a => a.trim()).filter(Boolean),
      favorite,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean)
    });
  };

  return (
    <div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name"
      />

      <input
        value={aliases}
        onChange={(e) => setAliases(e.target.value)}
        placeholder="Aliases (comma-separated)"
      />

      <label>
        <input
          type="checkbox"
          checked={favorite}
          onChange={(e) => setFavorite(e.target.checked)}
        />
        Favorite
      </label>

      <input
        value={tags}
        onChange={(e) => setTags(e.target.value)}
        placeholder="Tags (comma-separated)"
      />

      <button onClick={handleSave}>Save</button>
    </div>
  );
}
```

---

## S3 Operations

### Load Contacts

```typescript
// lib/s3.ts
export async function loadContacts(): Promise<Record<string, Contact>> {
  try {
    const command = new GetObjectCommand({
      Bucket: process.env.B2_BUCKET!,
      Key: `${process.env.B2_PREFIX}contacts.json`
    });

    const response = await s3Client.send(command);
    const bodyString = await streamToString(response.Body);
    return JSON.parse(bodyString);
  } catch (error: any) {
    if (error.name === 'NoSuchKey') {
      return {};  // No contacts yet
    }
    throw error;
  }
}
```

### Save Contacts

```typescript
export async function saveContacts(contacts: Record<string, Contact>) {
  const command = new PutObjectCommand({
    Bucket: process.env.B2_BUCKET!,
    Key: `${process.env.B2_PREFIX}contacts.json`,
    Body: JSON.stringify(contacts, null, 2),
    ContentType: 'application/json'
  });

  await s3Client.send(command);
}
```

### Update Single Contact

```typescript
export async function updateContact(
  phone: string,
  updates: Partial<Contact>
): Promise<Contact> {
  const contacts = await loadContacts();

  if (!contacts[phone]) {
    throw new Error(`Contact not found: ${phone}`);
  }

  contacts[phone] = {
    ...contacts[phone],
    ...updates
  };

  await saveContacts(contacts);
  return contacts[phone];
}
```

### Delete Contact

```typescript
export async function deleteContact(phone: string) {
  const contacts = await loadContacts();

  if (!contacts[phone]) {
    throw new Error(`Contact not found: ${phone}`);
  }

  delete contacts[phone];
  await saveContacts(contacts);
}
```

---

## Contact Statistics

### Current Stats

```json
{
  "totalContacts": 272,
  "withAliases": 156,
  "favorites": 23,
  "tagged": 89,
  "storageSize": "57 KB"
}
```

### Generate Stats

```typescript
function getContactStats(contacts: Record<string, Contact>) {
  return {
    totalContacts: Object.keys(contacts).length,
    withAliases: Object.values(contacts).filter(c => c.aliases.length > 0).length,
    favorites: Object.values(contacts).filter(c => c.favorite).length,
    tagged: Object.values(contacts).filter(c => c.tags.length > 0).length,
    tagDistribution: getTagDistribution(contacts),
    mostCommonTags: getMostCommonTags(contacts, 5)
  };
}

function getTagDistribution(contacts: Record<string, Contact>) {
  const tagCounts: Record<string, number> = {};

  for (const contact of Object.values(contacts)) {
    for (const tag of contact.tags) {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    }
  }

  return tagCounts;
}
```

---

## Best Practices

### Naming Conventions

✅ **Good Names:**
- "Reem Ahmed" (Full name)
- "Nick Smith" (First + Last)
- "Marketing Team" (Descriptive)

❌ **Bad Names:**
- "447950724774" (Phone number)
- "Contact 1" (Generic)
- "???" (Unclear)

### Alias Guidelines

✅ **Good Aliases:**
- Nicknames: "Nicky", "Bob"
- Relationships: "Sister", "Boss"
- Roles: "Accountant", "Landlord"

❌ **Bad Aliases:**
- Phone numbers: "07950724774"
- Duplicate names: "Nick", "nick", "NICK"
- Too generic: "Person", "Friend"

### Tag Conventions

✅ **Good Tags:**
- Lowercase: "family", "work"
- Hyphens for multi-word: "group-admin", "high-priority"
- Specific: "clients", "vendors"

❌ **Bad Tags:**
- Mixed case: "Work", "Family"
- Spaces: "high priority"
- Too generic: "people", "contacts"

---

## File References

**CLI Tools:**
- `/Users/saadi/Documents/GitHub/WhatsApp-VPSLink/tools/contacts-manager.js`
- `/Users/saadi/Documents/GitHub/WhatsApp-VPSLink/tools/import-contacts.js`
- `/Users/saadi/Documents/GitHub/WhatsApp-VPSLink/tools/import-aliases.js`

**Scripts:**
- `/Users/saadi/Documents/GitHub/WhatsApp-VPSLink/scripts/upload-contacts-to-s3.js`

**Documentation:**
- `/Users/saadi/Documents/GitHub/WhatsApp-VPSLink/docs/guides/CONTACTS.md`

---

## Summary

The contact management system provides flexible search through aliases, quick access via favorites, and categorization through tags. VCF import enables easy migration from phone contacts, while S3 storage ensures cross-VPS accessibility. The system currently manages 272 contacts with comprehensive CLI tools and Web UI integration.
