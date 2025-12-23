# Contact Management Features - Restoration Implementation Guide

## Quick Reference: All Missing Features

### Backend Code Location
- **Main Manager:** `/Users/saadi/Documents/GitHub/WhatsApp-VPSLink/tools/contacts-manager.js`
- **Import Tools:** `/tools/import-contacts.js`, `/tools/import-aliases.js`
- **CLI Interface:** Built into ContactsManager class

### Frontend Files That Need Creation/Restoration
- **Contacts Page:** `/var/www/whatsapp-vpslink/app/contacts/page.tsx` (MISSING)
- **Schedule Page:** `/var/www/whatsapp-vpslink/app/schedule/page.tsx` (Needs restore)
- **Contact Edit Modal:** Should be component in above files

### Data Files
- **S3 Location:** `whatsapp/contacts.json` in WhatsAppVPS bucket
- **Local Backup:** `/Users/saadi/Documents/GitHub/WhatsApp-VPSLink/contacts.json`

---

## Feature 1: Contact Editing

### Backend Support: FULLY IMPLEMENTED

```javascript
// From tools/contacts-manager.js
const manager = new ContactsManager();
const contact = manager.findContact('Nick');
// Returns: { name, numbers, aliases, notes }
```

### Frontend Component Needed:

**File:** `app/contacts/page.tsx`

```typescript
'use client';
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Contact } from '@/lib/s3';

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Record<string, Contact>>({});
  const [editingPhone, setEditingPhone] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Contact | null>(null);

  const handleEdit = (phone: string, contact: Contact) => {
    setEditingPhone(phone);
    setEditForm({ ...contact });
  };

  const handleSave = async () => {
    if (!editingPhone || !editForm) return;
    
    const updated = { ...contacts };
    updated[editingPhone] = editForm;
    
    // Save to S3
    const response = await fetch('/api/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated)
    });
    
    if (response.ok) {
      setContacts(updated);
      setEditingPhone(null);
      setEditForm(null);
    }
  };

  return (
    <>
      {/* Contact List */}
      <div className="space-y-4">
        {Object.entries(contacts).map(([phone, contact]) => (
          <div key={phone} className="flex justify-between items-center p-4 bg-dark-surface rounded">
            <div>
              <p className="font-bold text-white">{contact.name}</p>
              <p className="text-sm text-gray-400">{contact.phones.primary}</p>
              {contact.aliases.length > 0 && (
                <p className="text-xs text-gray-500 italic">{contact.aliases.join(', ')}</p>
              )}
            </div>
            <Button onClick={() => handleEdit(phone, contact)}>Edit</Button>
          </div>
        ))}
      </div>

      {/* Edit Modal */}
      <Dialog open={!!editingPhone} onOpenChange={() => setEditingPhone(null)}>
        <DialogContent className="dark">
          <DialogHeader>
            <DialogTitle>Edit Contact</DialogTitle>
          </DialogHeader>
          
          {editForm && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Name</label>
                <Input
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Primary Phone</label>
                <Input
                  value={editForm.phones.primary}
                  onChange={(e) => setEditForm({
                    ...editForm,
                    phones: { ...editForm.phones, primary: e.target.value }
                  })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Secondary Phone (Optional)</label>
                <Input
                  value={editForm.phones.secondary || ''}
                  onChange={(e) => setEditForm({
                    ...editForm,
                    phones: { ...editForm.phones, secondary: e.target.value || null }
                  })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Aliases (comma-separated)</label>
                <Input
                  value={editForm.aliases.join(', ')}
                  onChange={(e) => setEditForm({
                    ...editForm,
                    aliases: e.target.value.split(',').map(a => a.trim()).filter(a => a)
                  })}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingPhone(null)}>Cancel</Button>
            <Button onClick={handleSave}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

---

## Feature 2: Contact Creation/Adding

### Backend Support: PARTIAL

**CLI Command:**
```bash
node tools/contacts-manager.js alias "New Contact" "Alias"
```

**To Add New Contact Programmatically:**

```javascript
const manager = new ContactsManager();
// Load contacts
const contacts = manager.contacts;

// Add new contact
contacts['447123456789'] = {
  name: 'John Doe',
  numbers: ['447123456789'],
  aliases: ['John'],
  notes: ''
};

// Save
manager.save();
```

### Frontend Needed:

Add "Add Contact" button to contacts page:

```typescript
const [showAddForm, setShowAddForm] = useState(false);
const [newContact, setNewContact] = useState({
  name: '',
  primary: '',
  secondary: '',
  aliases: []
});

const handleAddContact = async () => {
  const phone = newContact.primary;
  const updated = { ...contacts };
  
  updated[phone] = {
    name: newContact.name,
    aliases: newContact.aliases,
    phones: {
      primary: phone,
      secondary: newContact.secondary || null
    },
    favorite: false,
    tags: []
  };
  
  const response = await fetch('/api/contacts', {
    method: 'POST',
    body: JSON.stringify(updated)
  });
  
  if (response.ok) {
    setContacts(updated);
    setShowAddForm(false);
  }
};
```

---

## Feature 3: Contact Deletion

### Backend Support: PARTIAL

**No direct delete method, but can remove from object:**

```javascript
const manager = new ContactsManager();
const contacts = manager.contacts;

// Delete contact
delete contacts['447950724774'];

// Save
manager.save();
```

### Frontend Implementation:

```typescript
const handleDeleteContact = async (phone: string) => {
  if (!confirm('Delete this contact?')) return;
  
  const updated = { ...contacts };
  delete updated[phone];
  
  const response = await fetch('/api/contacts', {
    method: 'POST',
    body: JSON.stringify(updated)
  });
  
  if (response.ok) {
    setContacts(updated);
  }
};
```

---

## Feature 4: Favorite Toggle

### Backend Support: NONE (Data structure ready)

**Data is stored but no backend method:**

```javascript
// contacts.json structure supports this:
{
  "447950724774": {
    "name": "Nick Smith",
    "favorite": true  // ← Can toggle this
  }
}
```

### Frontend Implementation:

```typescript
const toggleFavorite = async (phone: string) => {
  const updated = { ...contacts };
  updated[phone].favorite = !updated[phone].favorite;
  
  const response = await fetch('/api/contacts', {
    method: 'POST',
    body: JSON.stringify(updated)
  });
  
  if (response.ok) {
    setContacts(updated);
  }
};

// In UI:
<button onClick={() => toggleFavorite(phone)}>
  {contact.favorite ? '★' : '☆'} Favorite
</button>
```

---

## Feature 5: Phone Number Editing

### Backend Support: FULLY IMPLEMENTED

```javascript
// Update phone in contact object
const contact = contacts['447950724774'];
contact.numbers = ['447950724774', '447123456789']; // Add secondary
contact.phones.secondary = '447123456789';
manager.save();
```

### Frontend: Already Covered in Edit Modal (Feature 1)

---

## Feature 6: Alias Management

### Backend Support: FULLY IMPLEMENTED

**Add Alias:**
```bash
node tools/contacts-manager.js alias "Nick Smith" "Nicky"
```

**Remove Alias:**
```bash
node tools/contacts-manager.js remove-alias "Nick Smith" "Nicky"
```

**In Code:**
```javascript
const manager = new ContactsManager();
manager.addAlias('Nick Smith', 'Nicky');
manager.removeAlias('Nick Smith', 'Nicky');
manager.save();
```

### Frontend: Already Covered in Edit Modal (Feature 1)

---

## Feature 7: Tag Management

### Backend Support: PARTIAL

**Data Structure Ready:**
```javascript
contact.tags = ['work', 'friend', 'family'];
```

**No CLI commands yet:**
```javascript
// Programmatic:
const contact = contacts[phone];
contact.tags.push('family');
manager.save();
```

### Frontend Implementation:

```typescript
<div>
  <label className="block text-sm font-medium mb-2">Tags (comma-separated)</label>
  <Input
    value={editForm.tags.join(', ')}
    onChange={(e) => setEditForm({
      ...editForm,
      tags: e.target.value.split(',').map(t => t.trim()).filter(t => t)
    })}
  />
</div>
```

---

## Feature 8: Contact Search/Filter

### Backend Support: FULLY IMPLEMENTED

```javascript
// CLI
node tools/contacts-manager.js search Nick

// Programmatic
const results = manager.search('Nick');
// Returns: [{ number, name, aliases, allNumbers }, ...]
```

### Frontend Implementation:

```typescript
const [searchQuery, setSearchQuery] = useState('');

const filteredContacts = useMemo(() => {
  if (!searchQuery) return contacts;
  
  const query = searchQuery.toLowerCase();
  return Object.fromEntries(
    Object.entries(contacts).filter(([phone, contact]) => {
      return (
        contact.name.toLowerCase().includes(query) ||
        phone.includes(searchQuery) ||
        contact.aliases.some(a => a.toLowerCase().includes(query))
      );
    })
  );
}, [contacts, searchQuery]);

// In UI:
<Input
  placeholder="Search by name, phone, or alias..."
  value={searchQuery}
  onChange={(e) => setSearchQuery(e.target.value)}
/>
```

---

## Feature 9: Contact Sorting

### Backend Support: NONE

**Implement in Frontend:**

```typescript
const sortedContacts = useMemo(() => {
  return Object.entries(contacts).sort(([, a], [, b]) => {
    // Favorites first
    if (a.favorite && !b.favorite) return -1;
    if (!a.favorite && b.favorite) return 1;
    
    // Then alphabetical
    return a.name.localeCompare(b.name);
  });
}, [contacts]);
```

---

## Feature 10: Schedule Page - Searchable Contact Picker

### Backend Support: FULLY IMPLEMENTED (via search method)

### Frontend Implementation:

```typescript
'use client';
import { useState, useMemo } from 'react';
import { Contact } from '@/lib/s3';

export default function SchedulePage() {
  const [contacts, setContacts] = useState<Record<string, Contact>>({});
  const [selectedPhone, setSelectedPhone] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  const filteredContacts = useMemo(() => {
    if (!searchQuery) {
      // Show favorites only by default
      return Object.entries(contacts)
        .filter(([, c]) => c.favorite)
        .sort((a, b) => a[1].name.localeCompare(b[1].name));
    }

    const query = searchQuery.toLowerCase();
    return Object.entries(contacts)
      .filter(([phone, contact]) => {
        return (
          contact.name.toLowerCase().includes(query) ||
          phone.includes(searchQuery) ||
          contact.aliases.some(a => a.toLowerCase().includes(query))
        );
      })
      .sort((a, b) => {
        // Favorites first in filtered results
        if (a[1].favorite && !b[1].favorite) return -1;
        if (!a[1].favorite && b[1].favorite) return 1;
        return a[1].name.localeCompare(b[1].name);
      });
  }, [contacts, searchQuery]);

  const selectedContact = selectedPhone ? contacts[selectedPhone] : null;

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium mb-2">Select Contact</label>
        <div className="relative">
          <input
            type="text"
            placeholder="Type to search..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(true)}
            className="w-full p-3 bg-dark-surface border border-dark-border rounded focus:outline-none focus:border-blue-500"
          />

          {showDropdown && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-dark-surface border border-dark-border rounded shadow-lg max-h-96 overflow-y-auto z-50">
              {filteredContacts.length === 0 ? (
                <p className="p-3 text-gray-500">No contacts found</p>
              ) : (
                filteredContacts.map(([phone, contact]) => (
                  <div
                    key={phone}
                    onClick={() => {
                      setSelectedPhone(phone);
                      setShowDropdown(false);
                      setSearchQuery('');
                    }}
                    className="p-3 hover:bg-dark-elevated cursor-pointer border-b border-dark-border last:border-b-0"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">
                          {contact.favorite && '★ '}
                          {contact.name}
                        </p>
                        <p className="text-sm text-gray-400">{phone}</p>
                        {contact.aliases.length > 0 && (
                          <p className="text-xs text-gray-500">
                            {contact.aliases.join(', ')}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {selectedContact && (
          <div className="mt-3 p-3 bg-blue-500/20 border border-blue-500 rounded">
            <p className="font-medium">{selectedContact.name}</p>
            <p className="text-sm text-gray-400">{selectedPhone}</p>
          </div>
        )}
      </div>

      {/* Rest of schedule form... */}
    </div>
  );
}
```

---

## Import/Export Features (Working)

### Import Contacts from VCF:

```bash
node tools/import-contacts.js /Users/saadi/Desktop/contacts.vcf
```

**Output:**
```
Importing contacts from: /Users/saadi/Desktop/contacts.vcf
Processing contact: Nick Smith (447950724774)
✓ Imported 272 contacts
```

### Import Aliases from Text:

**Create text file format:**
```
Name: Nick Smith
Number: 447950724774
Aliases: Nick, Nicky
----------------

Name: John Doe
Number: 447987654321
Aliases: John, Johnny
----------------
```

**Import:**
```bash
node tools/import-aliases.js contacts-editable.txt
```

### Export Contacts:

```bash
node tools/contacts-manager.js export my-contacts.txt
```

---

## Testing Checklist

Before considering restoration complete:

### Contact Edit Feature
- [ ] Edit button appears on each contact
- [ ] Modal opens with all fields populated
- [ ] Name field editable
- [ ] Primary phone editable
- [ ] Secondary phone editable
- [ ] Aliases editable (comma-separated)
- [ ] Changes save to S3
- [ ] Modal closes after save
- [ ] Contact list updates

### Favorite Toggle
- [ ] Star icon appears on each contact
- [ ] Click toggles favorite status
- [ ] Visual feedback (filled/empty star)
- [ ] Changes save to S3 immediately
- [ ] Favorites filter works

### Search/Filter
- [ ] Search input filters by name
- [ ] Search filters by phone
- [ ] Search filters by alias
- [ ] Search is case-insensitive
- [ ] Results appear instantly

### Schedule Page
- [ ] Contact dropdown appears
- [ ] Can type to search
- [ ] Results include name, phone, aliases
- [ ] Favorites marked with star
- [ ] Can select contact
- [ ] Selected contact displays
- [ ] Selected phone passed to schedule API

---

## File Locations

**Backend Files (All Exist):**
- `/Users/saadi/Documents/GitHub/WhatsApp-VPSLink/tools/contacts-manager.js` - Main class
- `/Users/saadi/Documents/GitHub/WhatsApp-VPSLink/tools/import-contacts.js` - VCF importer
- `/Users/saadi/Documents/GitHub/WhatsApp-VPSLink/tools/import-aliases.js` - Alias importer
- `/Users/saadi/Documents/GitHub/WhatsApp-VPSLink/lib/s3.ts` - S3 utilities

**Frontend Files (Missing):**
- `/var/www/whatsapp-vpslink/app/contacts/page.tsx` - Contacts management
- `/var/www/whatsapp-vpslink/app/schedule/page.tsx` - Schedule with contact picker

**Documentation:**
- `/Users/saadi/Documents/GitHub/WhatsApp-VPSLink/docs/CONTACTS.md` - Full contact docs
- `/Users/saadi/Documents/GitHub/WhatsApp-VPSLink/docs/guides/UI-IMPROVEMENTS.md` - Feature specs
- `/Users/saadi/Documents/GitHub/WhatsApp-VPSLink/docs/archive/HANDOVER.md` - Complete handover

---

## Summary

All backend infrastructure exists. Only frontend React components need to be rebuilt to:

1. Display contacts in a table
2. Open edit modal
3. Save changes to S3
4. Toggle favorites
5. Search/filter contacts
6. Sort by name and favorites

Total restoration time: 2-3 hours for a developer familiar with React/TypeScript.
