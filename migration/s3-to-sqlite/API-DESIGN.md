# Doodah REST API Design

**Created:** December 28, 2025
**Purpose:** Full REST API for Web UI, iPhone App, and future clients
**Location:** `/root/whatsapp-vpslink/api.js`

---

## Overview

The Doodah REST API is the **single source of truth** for all clients (Web UI, iPhone app, etc.).

**Key principles:**
- 🔒 Secure: JWT authentication + UFW firewall
- 🚀 Fast: Local SQLite queries (<1ms)
- 📱 Universal: Same API for Web UI, iPhone, Android, Desktop
- 🔄 Event-driven: Notifies scheduler on changes
- 🛡️ Database-agnostic: Can swap SQLite → Postgres with zero client changes

---

## Architecture

```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   Web UI     │  │  iPhone App  │  │ Android App  │  │ Desktop App  │
│  (Next.js)   │  │ (React Nat.) │  │   (Future)   │  │   (Future)   │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                 │                 │                 │
       └─────────────────┴─────────────────┴─────────────────┘
                             │
                    HTTPS REST API (port 3001)
                    JWT Authentication
                    UFW: Allow only authorized IPs
                             │
                ┌────────────▼────────────┐
                │   Doodah VPS API        │
                │   (Express.js)          │
                │                         │
                │   Routes:               │
                │   - /api/contacts       │
                │   - /api/scheduled      │
                │   - /api/jobs           │
                │   - /api/chats          │
                │   - /auth/login         │
                └────────────┬────────────┘
                             │
                    Direct SQL queries
                             │
                ┌────────────▼────────────┐
                │   SQLite Database       │
                │   (or Postgres later)   │
                └─────────────────────────┘
```

---

## Authentication

### JWT-Based Authentication

**Login flow:**
```
1. Client → POST /auth/login {username, password}
2. Server validates credentials
3. Server → JWT token (expires in 7 days)
4. Client stores token (localStorage or Keychain)
5. Client sends token in all requests: Authorization: Bearer <token>
```

**Token payload:**
```json
{
  "userId": "admin",
  "role": "admin",
  "iat": 1735392000,
  "exp": 1735996800
}
```

### Endpoints

#### `POST /auth/login`
**Request:**
```json
{
  "username": "admin",
  "password": "admin123"
}
```

**Response (Success):**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": "7d",
  "user": {
    "username": "admin",
    "role": "admin"
  }
}
```

**Response (Failure):**
```json
{
  "success": false,
  "error": "Invalid credentials"
}
```

#### `POST /auth/refresh`
**Headers:**
```
Authorization: Bearer <old-token>
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": "7d"
}
```

---

## API Endpoints

All endpoints require `Authorization: Bearer <token>` header.

### Contacts

#### `GET /api/contacts`
List all contacts with optional filtering.

**Query Parameters:**
- `search` (string): Search by name, phone, or alias
- `favorite` (boolean): Filter favorites only
- `limit` (number): Max results (default: 100)
- `offset` (number): Pagination offset

**Example:**
```
GET /api/contacts?search=nick&favorite=true&limit=20
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "phone": "447779299086",
      "name": "Nick",
      "aliases": ["Nicholas", "Nicky"],
      "tags": ["friend", "london"],
      "is_favorite": 1,
      "created_at": "2025-12-23T10:00:00Z",
      "updated_at": "2025-12-28T15:30:00Z"
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0
}
```

#### `GET /api/contacts/:phone`
Get a single contact.

**Example:**
```
GET /api/contacts/447779299086
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "phone": "447779299086",
    "name": "Nick",
    "aliases": ["Nicholas", "Nicky"],
    "tags": ["friend", "london"],
    "is_favorite": 1,
    "created_at": "2025-12-23T10:00:00Z",
    "updated_at": "2025-12-28T15:30:00Z"
  }
}
```

#### `POST /api/contacts`
Create a new contact.

**Request:**
```json
{
  "phone": "447950724774",
  "name": "Payal",
  "aliases": ["Payal Shah"],
  "tags": ["family", "uk"],
  "is_favorite": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 2,
    "phone": "447950724774",
    "name": "Payal",
    "aliases": ["Payal Shah"],
    "tags": ["family", "uk"],
    "is_favorite": 1,
    "created_at": "2025-12-28T16:00:00Z",
    "updated_at": "2025-12-28T16:00:00Z"
  }
}
```

#### `PUT /api/contacts/:phone`
Update an existing contact.

**Request:**
```json
{
  "name": "Nick Smith",
  "is_favorite": false,
  "tags": ["friend", "london", "developer"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "phone": "447779299086",
    "name": "Nick Smith",
    "aliases": ["Nicholas", "Nicky"],
    "tags": ["friend", "london", "developer"],
    "is_favorite": 0,
    "updated_at": "2025-12-28T16:05:00Z"
  }
}
```

#### `DELETE /api/contacts/:phone`
Delete a contact.

**Response:**
```json
{
  "success": true,
  "message": "Contact deleted successfully"
}
```

---

### Scheduled Messages

#### `GET /api/scheduled`
List scheduled messages.

**Query Parameters:**
- `status` (string): Filter by status (pending|sent|failed)
- `limit` (number): Max results
- `offset` (number): Pagination offset

**Example:**
```
GET /api/scheduled?status=pending&limit=50
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "msg_1735392000_abc",
      "to_phone": "447779299086",
      "contact_name": "Nick",
      "message": "Happy New Year!",
      "scheduled_at": "2025-12-31T23:59:00Z",
      "status": "pending",
      "created_at": "2025-12-28T16:00:00Z",
      "sent_at": null,
      "error_message": null
    }
  ],
  "total": 1,
  "limit": 50,
  "offset": 0
}
```

#### `GET /api/scheduled/:id`
Get a single scheduled message.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "msg_1735392000_abc",
    "to_phone": "447779299086",
    "contact_name": "Nick",
    "message": "Happy New Year!",
    "scheduled_at": "2025-12-31T23:59:00Z",
    "status": "pending",
    "created_at": "2025-12-28T16:00:00Z"
  }
}
```

#### `POST /api/scheduled`
Create a scheduled message.

**Request:**
```json
{
  "to_phone": "447779299086",
  "message": "Happy New Year!",
  "scheduled_at": "2025-12-31T23:59:00Z"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "msg_1735392000_abc",
    "to_phone": "447779299086",
    "contact_name": "Nick",
    "message": "Happy New Year!",
    "scheduled_at": "2025-12-31T23:59:00Z",
    "status": "pending",
    "created_at": "2025-12-28T16:10:00Z"
  },
  "message": "Scheduler notified"
}
```

**Note:** This endpoint automatically triggers scheduler refresh.

#### `PUT /api/scheduled/:id`
Update a scheduled message (only if status is pending).

**Request:**
```json
{
  "message": "Happy New Year 2026!",
  "scheduled_at": "2025-12-31T23:58:00Z"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "msg_1735392000_abc",
    "message": "Happy New Year 2026!",
    "scheduled_at": "2025-12-31T23:58:00Z",
    "updated_at": "2025-12-28T16:15:00Z"
  },
  "message": "Scheduler notified"
}
```

#### `DELETE /api/scheduled/:id`
Delete a scheduled message (cancel).

**Response:**
```json
{
  "success": true,
  "message": "Scheduled message deleted"
}
```

---

### Jobs (Multi-Message)

#### `GET /api/jobs`
List jobs.

**Query Parameters:**
- `status` (string): Filter by status (pending|running|completed|failed)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "job_1735392000_xyz",
      "title": "Christmas Greetings 2025",
      "status": "pending",
      "scheduled_start_at": "2025-12-25T09:00:00Z",
      "recipient_count": 10,
      "message_parts_count": 3,
      "created_at": "2025-12-20T10:00:00Z",
      "progress": {
        "recipients_sent": 0,
        "recipients_failed": 0
      }
    }
  ],
  "total": 1
}
```

#### `GET /api/jobs/:id`
Get a single job with full details.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "job_1735392000_xyz",
    "title": "Christmas Greetings 2025",
    "status": "running",
    "scheduled_start_at": "2025-12-25T09:00:00Z",
    "created_at": "2025-12-20T10:00:00Z",
    "completed_at": null,
    "config": {
      "maxRetries": 3,
      "recipientGapSeconds": 30
    },
    "message_parts": [
      {
        "text": "Merry Christmas! 🎄",
        "delayAfterSeconds": 3
      },
      {
        "text": "Hope you have an amazing day!",
        "delayAfterSeconds": 5
      }
    ],
    "recipients": [
      "447779299086@s.whatsapp.net",
      "447950724774@s.whatsapp.net"
    ],
    "progress": {
      "current_recipient_index": 1,
      "current_part_index": 2,
      "recipients_sent": 1,
      "recipients_failed": 0,
      "last_sent_at": "2025-12-25T09:05:00Z"
    }
  }
}
```

#### `POST /api/jobs`
Create a multi-message job.

**Request:**
```json
{
  "title": "New Year Wishes 2026",
  "scheduled_start_at": "2025-12-31T23:59:00Z",
  "recipients": ["447779299086", "447950724774"],
  "message_parts": [
    {
      "text": "Happy New Year! 🎉",
      "delayAfterSeconds": 3
    },
    {
      "text": "Wishing you all the best for 2026!",
      "delayAfterSeconds": 0
    }
  ],
  "config": {
    "maxRetries": 3,
    "recipientGapSeconds": 60
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "job_1735689540_abc",
    "title": "New Year Wishes 2026",
    "status": "pending",
    "scheduled_start_at": "2025-12-31T23:59:00Z",
    "created_at": "2025-12-28T16:20:00Z"
  },
  "message": "Scheduler notified"
}
```

#### `DELETE /api/jobs/:id`
Cancel a job (only if pending or running).

**Response:**
```json
{
  "success": true,
  "message": "Job cancelled"
}
```

---

### Chats (Read-Only)

#### `GET /api/chats`
List recent chats.

**Query Parameters:**
- `limit` (number): Max results (default: 20)
- `unread` (boolean): Filter unread only

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "447779299086@s.whatsapp.net",
      "name": "Nick",
      "is_group": false,
      "unread_count": 3,
      "last_message_time": 1735392000,
      "last_message_text": "See you tomorrow!",
      "last_message_type": "text"
    }
  ],
  "total": 1
}
```

#### `GET /api/chats/:id`
Get chat with messages.

**Query Parameters:**
- `limit` (number): Max messages (default: 100)

**Response:**
```json
{
  "success": true,
  "data": {
    "chat": {
      "id": "447779299086@s.whatsapp.net",
      "name": "Nick",
      "is_group": false,
      "unread_count": 3
    },
    "messages": [
      {
        "id": 1,
        "message": "Hey, how are you?",
        "timestamp": 1735392000,
        "is_from_me": false,
        "message_type": "text",
        "created_at": "2025-12-28T16:00:00Z"
      },
      {
        "id": 2,
        "message": "I'm good! You?",
        "timestamp": 1735392060,
        "is_from_me": true,
        "message_type": "text",
        "created_at": "2025-12-28T16:01:00Z"
      }
    ]
  }
}
```

#### `PUT /api/chats/:id/read`
Mark chat as read.

**Response:**
```json
{
  "success": true,
  "message": "Chat marked as read"
}
```

---

### System

#### `GET /api/health`
Health check (no auth required).

**Response:**
```json
{
  "success": true,
  "status": "ok",
  "whatsapp_connected": true,
  "database": "sqlite",
  "pending_messages": 5,
  "pending_jobs": 1,
  "uptime": 86400,
  "version": "2.0.0"
}
```

#### `GET /api/stats`
System statistics.

**Response:**
```json
{
  "success": true,
  "data": {
    "contacts": 272,
    "scheduled_messages": {
      "pending": 5,
      "sent": 150,
      "failed": 2
    },
    "jobs": {
      "pending": 1,
      "running": 0,
      "completed": 10
    },
    "chats": 50,
    "messages": 5000,
    "database_size_mb": 12
  }
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {}
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid token |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Invalid request data |
| `CONFLICT` | 409 | Resource already exists |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |

**Example:**
```json
{
  "success": false,
  "error": "Contact not found",
  "code": "NOT_FOUND",
  "details": {
    "phone": "447000000000"
  }
}
```

---

## Rate Limiting

**Default limits:**
- 100 requests per minute per IP
- 1000 requests per hour per IP

**Response when exceeded:**
```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "code": "RATE_LIMIT_EXCEEDED",
  "details": {
    "retry_after": 60
  }
}
```

**Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1735392060
```

---

## Security

### UFW Firewall Rules

```bash
# Allow Web UI (Saadi VPS)
ufw allow from 192.209.62.48 to any port 3001

# Allow iPhone app (via home network - optional)
# ufw allow from 149.34.177.160 to any port 3001

# Or allow from anywhere (if using proper JWT auth)
# ufw allow 3001/tcp
```

### HTTPS (Recommended for Production)

Use reverse proxy (Nginx or Caddy) with Let's Encrypt:

```nginx
server {
    listen 443 ssl;
    server_name api.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## Database Abstraction

The API uses `src/db.js` which abstracts database operations.

**Current:** SQLite via `better-sqlite3`
**Future:** Postgres via `pg` (zero API changes)

**Example:**
```javascript
// src/db.js
class Database {
  getAllContacts() {
    // SQLite implementation
    return this.db.prepare('SELECT * FROM contacts').all();

    // Future Postgres implementation (same interface)
    // return await this.pool.query('SELECT * FROM contacts').rows;
  }
}
```

**Switching databases:**
```env
# .env
DATABASE_TYPE=sqlite  # or postgres
DATABASE_URL=postgresql://user:pass@localhost/whatsapp  # for postgres
```

**Web UI, iPhone app: ZERO CHANGES NEEDED**

---

## Next Steps

1. Implement API server (`api.js`)
2. Update Web UI to use API instead of direct S3
3. Test all endpoints
4. Build iPhone app using same API
5. (Future) Migrate to Postgres if needed

**The API is designed to be database-agnostic and client-agnostic from day one.**
