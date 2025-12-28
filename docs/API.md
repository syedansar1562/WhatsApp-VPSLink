# WhatsApp VPSLink - REST API Documentation

**Version**: 2.0.0
**Base URL**: `http://192.209.62.48:3001` (from Saadi VPS) or `http://localhost:3001` (local)
**Authentication**: JWT Bearer Token

---

## Table of Contents

1. [Authentication](#authentication)
2. [Contacts](#contacts)
3. [Scheduled Messages](#scheduled-messages)
4. [Jobs (Multi-Message)](#jobs-multi-message)
5. [Chats & Messages](#chats--messages)
6. [Statistics](#statistics)
7. [Error Handling](#error-handling)
8. [Rate Limiting](#rate-limiting)

---

## Authentication

All API endpoints (except `/auth/login`) require a valid JWT token in the Authorization header.

### Login

Get a JWT token for API access.

**Endpoint**: `POST /auth/login`

**Request Body**:
```json
{
  "password": "your-api-password"
}
```

**Response** (200 OK):
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": "24h"
}
```

**Response** (401 Unauthorized):
```json
{
  "error": "Invalid credentials"
}
```

**Usage**:
```bash
# Get token
curl -X POST http://192.209.62.48:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"password":"your-password"}'

# Use token in subsequent requests
curl http://192.209.62.48:3001/api/contacts \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Contacts

### Get All Contacts

**Endpoint**: `GET /api/contacts`

**Headers**:
```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Query Parameters**:
- `favorite` (optional): Filter by favorite status (`true` or `false`)

**Response** (200 OK):
```json
[
  {
    "id": 1,
    "phone": "447779299086",
    "name": "Nick",
    "aliases": ["Nicholas", "Nicky"],
    "tags": ["friend", "london"],
    "is_favorite": 1,
    "created_at": "2025-12-27T10:00:00.000Z",
    "updated_at": "2025-12-27T10:00:00.000Z"
  },
  ...
]
```

**Example**:
```bash
# Get all contacts
curl http://192.209.62.48:3001/api/contacts \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Get only favorites
curl "http://192.209.62.48:3001/api/contacts?favorite=true" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

### Search Contacts

**Endpoint**: `GET /api/contacts/search`

**Headers**:
```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Query Parameters**:
- `q` (required): Search query (searches name, phone, aliases)

**Response** (200 OK):
```json
[
  {
    "id": 1,
    "phone": "447779299086",
    "name": "Nick",
    "aliases": ["Nicholas"],
    "tags": ["friend"],
    "is_favorite": 1
  }
]
```

**Example**:
```bash
curl "http://192.209.62.48:3001/api/contacts/search?q=nick" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

### Get Single Contact

**Endpoint**: `GET /api/contacts/:id`

**Headers**:
```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Response** (200 OK):
```json
{
  "id": 1,
  "phone": "447779299086",
  "name": "Nick",
  "aliases": ["Nicholas"],
  "tags": ["friend"],
  "is_favorite": 1,
  "created_at": "2025-12-27T10:00:00.000Z",
  "updated_at": "2025-12-27T10:00:00.000Z"
}
```

**Response** (404 Not Found):
```json
{
  "error": "Contact not found"
}
```

**Example**:
```bash
curl http://192.209.62.48:3001/api/contacts/1 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

### Create Contact

**Endpoint**: `POST /api/contacts`

**Headers**:
```
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json
```

**Request Body**:
```json
{
  "phone": "447779299086",
  "name": "Nick",
  "aliases": ["Nicholas", "Nicky"],  // optional
  "tags": ["friend", "london"],      // optional
  "is_favorite": true                // optional, default: false
}
```

**Response** (201 Created):
```json
{
  "id": 1,
  "phone": "447779299086",
  "name": "Nick",
  "aliases": ["Nicholas", "Nicky"],
  "tags": ["friend", "london"],
  "is_favorite": 1
}
```

**Response** (400 Bad Request):
```json
{
  "error": "Phone and name are required"
}
```

**Example**:
```bash
curl -X POST http://192.209.62.48:3001/api/contacts \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "447779299086",
    "name": "Nick",
    "aliases": ["Nicholas"],
    "tags": ["friend"],
    "is_favorite": true
  }'
```

---

### Update Contact

**Endpoint**: `PUT /api/contacts/:id`

**Headers**:
```
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json
```

**Request Body** (all fields optional):
```json
{
  "phone": "447779299086",
  "name": "Nicholas",
  "aliases": ["Nick", "Nicky"],
  "tags": ["friend", "family"],
  "is_favorite": false
}
```

**Response** (200 OK):
```json
{
  "id": 1,
  "phone": "447779299086",
  "name": "Nicholas",
  "aliases": ["Nick", "Nicky"],
  "tags": ["friend", "family"],
  "is_favorite": 0
}
```

**Example**:
```bash
curl -X PUT http://192.209.62.48:3001/api/contacts/1 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Nicholas", "is_favorite": true}'
```

---

### Delete Contact

**Endpoint**: `DELETE /api/contacts/:id`

**Headers**:
```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Response** (200 OK):
```json
{
  "message": "Contact deleted successfully"
}
```

**Example**:
```bash
curl -X DELETE http://192.209.62.48:3001/api/contacts/1 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Scheduled Messages

### Get All Scheduled Messages

**Endpoint**: `GET /api/scheduled`

**Headers**:
```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Query Parameters**:
- `status` (optional): Filter by status (`pending`, `sent`, `failed`)

**Response** (200 OK):
```json
[
  {
    "id": "msg_1735157600_abc",
    "to_phone": "447779299086",
    "contact_name": "Nick",
    "message": "Happy New Year!",
    "scheduled_at": "2025-12-31T23:59:00.000Z",
    "status": "pending",
    "created_at": "2025-12-27T10:00:00.000Z",
    "sent_at": null,
    "error_message": null
  },
  ...
]
```

**Example**:
```bash
# Get all scheduled messages
curl http://192.209.62.48:3001/api/scheduled \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Get only pending messages
curl "http://192.209.62.48:3001/api/scheduled?status=pending" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

### Create Scheduled Message

**Endpoint**: `POST /api/scheduled`

**Headers**:
```
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json
```

**Request Body**:
```json
{
  "to_phone": "447779299086",
  "message": "Happy New Year!",
  "scheduled_at": "2025-12-31T23:59:00.000Z"
}
```

**Response** (201 Created):
```json
{
  "id": "msg_1735689540_xyz",
  "to_phone": "447779299086",
  "contact_name": "Nick",
  "message": "Happy New Year!",
  "scheduled_at": "2025-12-31T23:59:00.000Z",
  "status": "pending"
}
```

**Response** (400 Bad Request):
```json
{
  "error": "to_phone, message, and scheduled_at are required"
}
```

**Example**:
```bash
curl -X POST http://192.209.62.48:3001/api/scheduled \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "to_phone": "447779299086",
    "message": "Happy New Year!",
    "scheduled_at": "2025-12-31T23:59:00.000Z"
  }'
```

---

### Update Scheduled Message

**Endpoint**: `PUT /api/scheduled/:id`

**Headers**:
```
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json
```

**Request Body** (all fields optional):
```json
{
  "message": "Happy New Year 2026!",
  "scheduled_at": "2026-01-01T00:00:00.000Z",
  "status": "pending"
}
```

**Response** (200 OK):
```json
{
  "id": "msg_1735689540_xyz",
  "to_phone": "447779299086",
  "contact_name": "Nick",
  "message": "Happy New Year 2026!",
  "scheduled_at": "2026-01-01T00:00:00.000Z",
  "status": "pending"
}
```

**Example**:
```bash
curl -X PUT http://192.209.62.48:3001/api/scheduled/msg_1735689540_xyz \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "Updated message"}'
```

---

### Delete Scheduled Message

**Endpoint**: `DELETE /api/scheduled/:id`

**Headers**:
```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Response** (200 OK):
```json
{
  "message": "Scheduled message deleted successfully"
}
```

**Example**:
```bash
curl -X DELETE http://192.209.62.48:3001/api/scheduled/msg_1735689540_xyz \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Jobs (Multi-Message)

Jobs allow sending multiple message parts to multiple recipients with configurable delays.

### Get All Jobs

**Endpoint**: `GET /api/jobs`

**Headers**:
```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Query Parameters**:
- `status` (optional): Filter by status (`pending`, `running`, `completed`, `failed`, `cancelled`)

**Response** (200 OK):
```json
[
  {
    "id": "job_1735157600_xyz",
    "title": "New Year Campaign",
    "status": "pending",
    "scheduled_start_at": "2025-12-31T20:00:00.000Z",
    "created_at": "2025-12-27T10:00:00.000Z",
    "completed_at": null,
    "current_recipient_index": 0,
    "current_part_index": 0,
    "recipients_sent": 0,
    "recipients_failed": 0,
    "last_sent_at": null,
    "config": {
      "maxRetries": 3,
      "recipientGapSeconds": 30
    },
    "message_parts": [
      {
        "text": "Happy New Year!",
        "delayAfterSeconds": 5
      },
      {
        "text": "Wishing you all the best in 2026!",
        "delayAfterSeconds": 0
      }
    ],
    "recipients": [
      "447779299086@s.whatsapp.net",
      "447786688707@s.whatsapp.net"
    ]
  },
  ...
]
```

**Example**:
```bash
# Get all jobs
curl http://192.209.62.48:3001/api/jobs \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Get only pending jobs
curl "http://192.209.62.48:3001/api/jobs?status=pending" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

### Create Job

**Endpoint**: `POST /api/jobs`

**Headers**:
```
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json
```

**Request Body**:
```json
{
  "title": "New Year Campaign",
  "scheduled_start_at": "2025-12-31T20:00:00.000Z",
  "config": {
    "maxRetries": 3,               // Max send attempts per message
    "recipientGapSeconds": 30      // Delay between recipients
  },
  "message_parts": [
    {
      "text": "Happy New Year!",
      "delayAfterSeconds": 5       // Wait 5s before next part
    },
    {
      "text": "Wishing you all the best!",
      "delayAfterSeconds": 0       // No delay after last part
    }
  ],
  "recipients": [
    "447779299086@s.whatsapp.net",
    "447786688707@s.whatsapp.net"
  ]
}
```

**Response** (201 Created):
```json
{
  "id": "job_1735689540_xyz",
  "title": "New Year Campaign",
  "status": "pending",
  "scheduled_start_at": "2025-12-31T20:00:00.000Z",
  "config": {...},
  "message_parts": [...],
  "recipients": [...]
}
```

**Response** (400 Bad Request):
```json
{
  "error": "title, scheduled_start_at, message_parts, and recipients are required"
}
```

**Example**:
```bash
curl -X POST http://192.209.62.48:3001/api/jobs \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Campaign",
    "scheduled_start_at": "2025-12-31T20:00:00.000Z",
    "config": {"maxRetries": 3, "recipientGapSeconds": 30},
    "message_parts": [
      {"text": "Part 1", "delayAfterSeconds": 5},
      {"text": "Part 2", "delayAfterSeconds": 0}
    ],
    "recipients": ["447779299086@s.whatsapp.net"]
  }'
```

---

### Get Single Job

**Endpoint**: `GET /api/jobs/:id`

**Headers**:
```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Response** (200 OK): Same structure as Get All Jobs (single object)

**Example**:
```bash
curl http://192.209.62.48:3001/api/jobs/job_1735689540_xyz \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

### Cancel Job

**Endpoint**: `DELETE /api/jobs/:id`

**Headers**:
```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Response** (200 OK):
```json
{
  "message": "Job cancelled successfully"
}
```

**Note**: Only pending or running jobs can be cancelled. Completed jobs cannot be cancelled.

**Example**:
```bash
curl -X DELETE http://192.209.62.48:3001/api/jobs/job_1735689540_xyz \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Chats & Messages

### Get All Chats

**Endpoint**: `GET /api/chats`

**Headers**:
```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Query Parameters**:
- `limit` (optional): Number of chats to return (default: 50)

**Response** (200 OK):
```json
[
  {
    "id": "447779299086@s.whatsapp.net",
    "name": "Nick",
    "is_group": 0,
    "unread_count": 3,
    "last_message_time": 1735689540,
    "created_at": "2025-12-27T10:00:00.000Z",
    "updated_at": "2025-12-27T15:30:00.000Z"
  },
  ...
]
```

**Example**:
```bash
# Get recent 50 chats
curl http://192.209.62.48:3001/api/chats \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Get recent 100 chats
curl "http://192.209.62.48:3001/api/chats?limit=100" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

### Get Chat Messages

**Endpoint**: `GET /api/chats/:chatId/messages`

**Headers**:
```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Query Parameters**:
- `limit` (optional): Number of messages to return (default: 100)

**Response** (200 OK):
```json
[
  {
    "id": 1,
    "chat_id": "447779299086@s.whatsapp.net",
    "message": "Hello!",
    "timestamp": 1735689540,
    "is_from_me": 1,
    "message_type": "text",
    "raw_message": null,
    "created_at": "2025-12-27T15:30:00.000Z"
  },
  ...
]
```

**Example**:
```bash
# Get recent 100 messages
curl http://192.209.62.48:3001/api/chats/447779299086@s.whatsapp.net/messages \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Get recent 500 messages
curl "http://192.209.62.48:3001/api/chats/447779299086@s.whatsapp.net/messages?limit=500" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Statistics

### Get System Statistics

**Endpoint**: `GET /api/stats`

**Headers**:
```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Response** (200 OK):
```json
{
  "contacts": {
    "total": 260,
    "favorites": 12
  },
  "scheduled_messages": {
    "total": 19,
    "pending": 15,
    "sent": 3,
    "failed": 1
  },
  "jobs": {
    "total": 16,
    "pending": 10,
    "running": 1,
    "completed": 5,
    "failed": 0
  },
  "chats": {
    "total": 104,
    "groups": 15,
    "individual": 89
  },
  "messages": {
    "total": 19033
  },
  "database": {
    "size_mb": 3.76,
    "path": "/root/whatsapp-vpslink/data/whatsapp.db"
  }
}
```

**Example**:
```bash
curl http://192.209.62.48:3001/api/stats \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Error Handling

All API errors follow this format:

```json
{
  "error": "Human-readable error message"
}
```

### HTTP Status Codes

- `200 OK` - Request successful
- `201 Created` - Resource created successfully
- `400 Bad Request` - Invalid request (missing fields, validation error)
- `401 Unauthorized` - Missing or invalid JWT token
- `404 Not Found` - Resource not found
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error

---

## Rate Limiting

**Default Limit**: 100 requests per 15 minutes per IP

**Rate Limit Headers**:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1735690200
```

**Rate Limit Exceeded** (429):
```json
{
  "error": "Too many requests, please try again later."
}
```

---

## Code Examples

### JavaScript (fetch)

```javascript
// Login
const loginResponse = await fetch('http://192.209.62.48:3001/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ password: 'your-password' })
});
const { token } = await loginResponse.json();

// Get contacts
const contactsResponse = await fetch('http://192.209.62.48:3001/api/contacts', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const contacts = await contactsResponse.json();

// Create scheduled message
const scheduleResponse = await fetch('http://192.209.62.48:3001/api/scheduled', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    to_phone: '447779299086',
    message: 'Hello!',
    scheduled_at: '2025-12-31T23:59:00.000Z'
  })
});
const scheduled = await scheduleResponse.json();
```

### Python (requests)

```python
import requests

# Login
login_response = requests.post(
    'http://192.209.62.48:3001/auth/login',
    json={'password': 'your-password'}
)
token = login_response.json()['token']

# Get contacts
contacts_response = requests.get(
    'http://192.209.62.48:3001/api/contacts',
    headers={'Authorization': f'Bearer {token}'}
)
contacts = contacts_response.json()

# Create scheduled message
schedule_response = requests.post(
    'http://192.209.62.48:3001/api/scheduled',
    headers={'Authorization': f'Bearer {token}'},
    json={
        'to_phone': '447779299086',
        'message': 'Hello!',
        'scheduled_at': '2025-12-31T23:59:00.000Z'
    }
)
scheduled = schedule_response.json()
```

---

## Testing the API

Use the included test script:

```bash
cd migration/s3-to-sqlite
node test-api.js
```

Or test manually with curl:

```bash
# 1. Login
TOKEN=$(curl -s -X POST http://192.209.62.48:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"password":"your-password"}' \
  | jq -r '.token')

# 2. Test endpoints
curl http://192.209.62.48:3001/api/stats \
  -H "Authorization: Bearer $TOKEN"

curl http://192.209.62.48:3001/api/contacts \
  -H "Authorization: Bearer $TOKEN"
```

---

## Support

For issues or questions:
- GitHub Issues: https://github.com/yourusername/WhatsApp-VPSLink/issues
- Documentation: See `/docs/` directory in repository
