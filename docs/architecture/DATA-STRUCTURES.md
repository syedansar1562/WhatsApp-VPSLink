# Data Structures - S3 Schema Documentation

## S3 Bucket: WhatsAppVPS

### File: `whatsapp/contacts.json`

**Size:** ~57KB
**Count:** 272 contacts

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

**Key:** Phone number (WhatsApp JID without @s.whatsapp.net)
**Fields:**
- `name` (string) - Display name
- `aliases` (string[]) - Alternative names for search
- `phones.primary` (string) - Main WhatsApp number
- `phones.secondary` (string|null) - Alternative number
- `favorite` (boolean) - Star/favorite flag
- `tags` (string[]) - Categories (for future use)

---

### File: `whatsapp/scheduled.json`

**Size:** ~1-5KB
**Purpose:** Message queue for scheduler

```json
{
  "messages": [
    {
      "id": "1735168500123_a1b2c3",
      "to": "447957189696",
      "contactName": "Reem",
      "message": "Happy Birthday!",
      "scheduledTime": "2025-12-24T10:00:00.000Z",
      "status": "pending",
      "createdAt": "2025-12-22T22:15:00.000Z",
      "createdFrom": "web",
      "sentAt": null,
      "error": null
    }
  ]
}
```

**Fields:**
- `id` (string) - Unique: `timestamp_random`
- `to` (string) - Phone number
- `contactName` (string) - Contact display name
- `message` (string) - Message text
- `scheduledTime` (ISO 8601) - When to send (UTC)
- `status` ("pending"|"sent"|"failed")
- `createdAt` (ISO 8601) - When scheduled
- `createdFrom` ("web"|"api") - Source
- `sentAt` (ISO 8601|null) - When actually sent
- `error` (string|null) - Error if failed

**Status Flow:**
```
pending → sent
        ↘ failed
```

---

### File: `whatsapp/chats.json`

**Size:** ~5.5MB
**Purpose:** Message history (legacy)

Contains all captured WhatsApp messages with metadata for media downloads.

---

**Last Updated:** December 22, 2025
