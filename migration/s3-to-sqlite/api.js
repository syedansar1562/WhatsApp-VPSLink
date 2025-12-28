/**
 * WhatsApp VPSLink REST API Server
 *
 * Purpose: Unified API for Web UI, iPhone app, and future clients
 * Location: /root/whatsapp-vpslink/api.js
 * Port: 3001
 *
 * Features:
 * - JWT authentication
 * - Rate limiting
 * - Input validation
 * - Database abstraction (SQLite/Postgres)
 * - Scheduler integration (event-driven)
 */

require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const db = require('./src/db');

const app = express();
const PORT = process.env.API_PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-production';
const API_PASSWORD = process.env.WEB_PASSWORD || 'admin123';

// ============================================================================
// MIDDLEWARE
// ============================================================================

// Parse JSON bodies
app.use(express.json());

// CORS (allow Web UI and mobile apps)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*'); // TODO: Restrict in production
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  next();
});

// Rate limiting
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: {
    success: false,
    error: 'Rate limit exceeded',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api/', limiter);

// Request logging
app.use((req, res, next) => {
  console.log(`[API] ${req.method} ${req.path} from ${req.ip}`);
  next();
});

// ============================================================================
// AUTHENTICATION MIDDLEWARE
// ============================================================================

/**
 * Verify JWT token
 */
function authenticateToken(req, res, next) {
  // Skip auth for health endpoint
  if (req.path === '/api/health') {
    return next();
  }

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Missing authentication token',
      code: 'UNAUTHORIZED'
    });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token',
        code: 'UNAUTHORIZED'
      });
    }

    req.user = user;
    next();
  });
}

app.use('/api/', authenticateToken);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate unique ID for messages/jobs
 */
function generateId(prefix) {
  const timestamp = Math.floor(Date.now() / 1000);
  const random = Math.random().toString(36).substr(2, 9);
  return `${prefix}_${timestamp}_${random}`;
}

/**
 * Notify scheduler to refresh state (event-driven trigger)
 */
let schedulerRefreshCallback = null;

function setSchedulerRefreshCallback(callback) {
  schedulerRefreshCallback = callback;
}

function notifyScheduler() {
  if (schedulerRefreshCallback) {
    schedulerRefreshCallback();
    console.log('[API] Scheduler notified to refresh');
  }
}

// ============================================================================
// AUTH ENDPOINTS
// ============================================================================

/**
 * POST /auth/login
 * Login and get JWT token
 */
app.post('/auth/login', (req, res) => {
  const { username, password } = req.body;

  // Simple password check (TODO: Use proper user table in production)
  if (username === 'admin' && password === API_PASSWORD) {
    const token = jwt.sign(
      { userId: 'admin', role: 'admin' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token,
      expiresIn: '7d',
      user: {
        username: 'admin',
        role: 'admin'
      }
    });
  } else {
    res.status(401).json({
      success: false,
      error: 'Invalid credentials',
      code: 'INVALID_CREDENTIALS'
    });
  }
});

/**
 * POST /auth/refresh
 * Refresh JWT token
 */
app.post('/auth/refresh', authenticateToken, (req, res) => {
  const token = jwt.sign(
    { userId: req.user.userId, role: req.user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({
    success: true,
    token,
    expiresIn: '7d'
  });
});

// ============================================================================
// CONTACTS ENDPOINTS
// ============================================================================

/**
 * GET /api/contacts
 * List all contacts
 */
app.get('/api/contacts', (req, res) => {
  try {
    const filters = {
      search: req.query.search,
      favorite: req.query.favorite === 'true',
      limit: parseInt(req.query.limit) || 100,
      offset: parseInt(req.query.offset) || 0
    };

    const contacts = db.getAllContacts(filters);
    const total = db.getContactsCount(filters);

    res.json({
      success: true,
      data: contacts,
      total,
      limit: filters.limit,
      offset: filters.offset
    });
  } catch (error) {
    console.error('[API] Error getting contacts:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * GET /api/contacts/:phone
 * Get a single contact
 */
app.get('/api/contacts/:phone', (req, res) => {
  try {
    const contact = db.getContact(req.params.phone);

    if (!contact) {
      return res.status(404).json({
        success: false,
        error: 'Contact not found',
        code: 'NOT_FOUND',
        details: { phone: req.params.phone }
      });
    }

    res.json({
      success: true,
      data: contact
    });
  } catch (error) {
    console.error('[API] Error getting contact:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * POST /api/contacts
 * Create a new contact
 */
app.post('/api/contacts', (req, res) => {
  try {
    const { phone, name, aliases, tags, is_favorite } = req.body;

    // Validation
    if (!phone || !name) {
      return res.status(400).json({
        success: false,
        error: 'Phone and name are required',
        code: 'VALIDATION_ERROR'
      });
    }

    // Check if contact already exists
    if (db.getContact(phone)) {
      return res.status(409).json({
        success: false,
        error: 'Contact already exists',
        code: 'CONFLICT',
        details: { phone }
      });
    }

    const contact = db.createContact({
      phone,
      name,
      aliases: aliases || [],
      tags: tags || [],
      is_favorite: is_favorite || false
    });

    res.status(201).json({
      success: true,
      data: contact
    });
  } catch (error) {
    console.error('[API] Error creating contact:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * PUT /api/contacts/:phone
 * Update an existing contact
 */
app.put('/api/contacts/:phone', (req, res) => {
  try {
    const { name, aliases, tags, is_favorite } = req.body;

    // Check if contact exists
    if (!db.getContact(req.params.phone)) {
      return res.status(404).json({
        success: false,
        error: 'Contact not found',
        code: 'NOT_FOUND'
      });
    }

    const contact = db.updateContact(req.params.phone, {
      name,
      aliases,
      tags,
      is_favorite
    });

    res.json({
      success: true,
      data: contact
    });
  } catch (error) {
    console.error('[API] Error updating contact:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * DELETE /api/contacts/:phone
 * Delete a contact
 */
app.delete('/api/contacts/:phone', (req, res) => {
  try {
    const deleted = db.deleteContact(req.params.phone);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Contact not found',
        code: 'NOT_FOUND'
      });
    }

    res.json({
      success: true,
      message: 'Contact deleted successfully'
    });
  } catch (error) {
    console.error('[API] Error deleting contact:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

// ============================================================================
// SCHEDULED MESSAGES ENDPOINTS
// ============================================================================

/**
 * GET /api/scheduled
 * List scheduled messages
 */
app.get('/api/scheduled', (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      limit: parseInt(req.query.limit) || 100,
      offset: parseInt(req.query.offset) || 0
    };

    const messages = db.getAllScheduledMessages(filters);

    res.json({
      success: true,
      data: messages,
      total: messages.length,
      limit: filters.limit,
      offset: filters.offset
    });
  } catch (error) {
    console.error('[API] Error getting scheduled messages:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * GET /api/scheduled/:id
 * Get a single scheduled message
 */
app.get('/api/scheduled/:id', (req, res) => {
  try {
    const message = db.getScheduledMessage(req.params.id);

    if (!message) {
      return res.status(404).json({
        success: false,
        error: 'Scheduled message not found',
        code: 'NOT_FOUND'
      });
    }

    res.json({
      success: true,
      data: message
    });
  } catch (error) {
    console.error('[API] Error getting scheduled message:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * POST /api/scheduled
 * Create a scheduled message
 */
app.post('/api/scheduled', (req, res) => {
  try {
    const { to_phone, message, scheduled_at } = req.body;

    // Validation
    if (!to_phone || !message || !scheduled_at) {
      return res.status(400).json({
        success: false,
        error: 'to_phone, message, and scheduled_at are required',
        code: 'VALIDATION_ERROR'
      });
    }

    // Get contact name if exists
    const contact = db.getContact(to_phone);
    const contact_name = contact ? contact.name : null;

    const id = generateId('msg');

    const scheduledMessage = db.createScheduledMessage({
      id,
      to_phone,
      contact_name,
      message,
      scheduled_at
    });

    // Notify scheduler (event-driven refresh)
    notifyScheduler();

    res.status(201).json({
      success: true,
      data: scheduledMessage,
      message: 'Scheduler notified'
    });
  } catch (error) {
    console.error('[API] Error creating scheduled message:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * PUT /api/scheduled/:id
 * Update a scheduled message
 */
app.put('/api/scheduled/:id', (req, res) => {
  try {
    const { message, scheduled_at } = req.body;

    const updated = db.updateScheduledMessage(req.params.id, {
      message,
      scheduled_at
    });

    if (!updated) {
      return res.status(404).json({
        success: false,
        error: 'Message not found or not pending',
        code: 'NOT_FOUND'
      });
    }

    // Notify scheduler
    notifyScheduler();

    res.json({
      success: true,
      data: updated,
      message: 'Scheduler notified'
    });
  } catch (error) {
    console.error('[API] Error updating scheduled message:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * DELETE /api/scheduled/:id
 * Delete a scheduled message
 */
app.delete('/api/scheduled/:id', (req, res) => {
  try {
    const deleted = db.deleteScheduledMessage(req.params.id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Scheduled message not found',
        code: 'NOT_FOUND'
      });
    }

    // Notify scheduler
    notifyScheduler();

    res.json({
      success: true,
      message: 'Scheduled message deleted'
    });
  } catch (error) {
    console.error('[API] Error deleting scheduled message:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

// ============================================================================
// JOBS ENDPOINTS (Multi-Message)
// ============================================================================

/**
 * GET /api/jobs
 * List jobs
 */
app.get('/api/jobs', (req, res) => {
  try {
    const filters = {
      status: req.query.status
    };

    const jobs = db.getAllJobs(filters);

    res.json({
      success: true,
      data: jobs,
      total: jobs.length
    });
  } catch (error) {
    console.error('[API] Error getting jobs:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * GET /api/jobs/:id
 * Get a single job
 */
app.get('/api/jobs/:id', (req, res) => {
  try {
    const job = db.getJob(req.params.id);

    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found',
        code: 'NOT_FOUND'
      });
    }

    res.json({
      success: true,
      data: job
    });
  } catch (error) {
    console.error('[API] Error getting job:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * POST /api/jobs
 * Create a job
 */
app.post('/api/jobs', (req, res) => {
  try {
    const { title, scheduled_start_at, recipients, message_parts, config } = req.body;

    // Validation
    if (!title || !scheduled_start_at || !recipients || !message_parts) {
      return res.status(400).json({
        success: false,
        error: 'title, scheduled_start_at, recipients, and message_parts are required',
        code: 'VALIDATION_ERROR'
      });
    }

    // Convert phone numbers to JIDs
    const recipientJids = recipients.map(phone =>
      phone.includes('@') ? phone : `${phone}@s.whatsapp.net`
    );

    const id = generateId('job');

    const job = db.createJob({
      id,
      title,
      scheduled_start_at,
      config: config || { maxRetries: 3, recipientGapSeconds: 30 },
      message_parts,
      recipients: recipientJids
    });

    // Notify scheduler
    notifyScheduler();

    res.status(201).json({
      success: true,
      data: job,
      message: 'Scheduler notified'
    });
  } catch (error) {
    console.error('[API] Error creating job:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * DELETE /api/jobs/:id
 * Cancel a job
 */
app.delete('/api/jobs/:id', (req, res) => {
  try {
    const deleted = db.deleteJob(req.params.id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Job not found',
        code: 'NOT_FOUND'
      });
    }

    // Notify scheduler
    notifyScheduler();

    res.json({
      success: true,
      message: 'Job cancelled'
    });
  } catch (error) {
    console.error('[API] Error deleting job:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

// ============================================================================
// CHATS ENDPOINTS (Read-Only)
// ============================================================================

/**
 * GET /api/chats
 * List chats
 */
app.get('/api/chats', (req, res) => {
  try {
    const filters = {
      unread: req.query.unread === 'true',
      limit: parseInt(req.query.limit) || 20,
      offset: parseInt(req.query.offset) || 0
    };

    const chats = db.getAllChats(filters);

    res.json({
      success: true,
      data: chats,
      total: chats.length
    });
  } catch (error) {
    console.error('[API] Error getting chats:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * GET /api/chats/:id
 * Get chat with messages
 */
app.get('/api/chats/:id', (req, res) => {
  try {
    const chat = db.getChat(req.params.id);

    if (!chat) {
      return res.status(404).json({
        success: false,
        error: 'Chat not found',
        code: 'NOT_FOUND'
      });
    }

    const limit = parseInt(req.query.limit) || 100;
    const messages = db.getChatMessages(req.params.id, limit);

    res.json({
      success: true,
      data: {
        chat,
        messages
      }
    });
  } catch (error) {
    console.error('[API] Error getting chat:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * PUT /api/chats/:id/read
 * Mark chat as read
 */
app.put('/api/chats/:id/read', (req, res) => {
  try {
    const updated = db.markChatAsRead(req.params.id);

    if (!updated) {
      return res.status(404).json({
        success: false,
        error: 'Chat not found',
        code: 'NOT_FOUND'
      });
    }

    res.json({
      success: true,
      message: 'Chat marked as read'
    });
  } catch (error) {
    console.error('[API] Error marking chat as read:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

// ============================================================================
// SYSTEM ENDPOINTS
// ============================================================================

/**
 * GET /api/health
 * Health check (no auth required)
 */
app.get('/api/health', (req, res) => {
  try {
    const stats = db.getStats();

    res.json({
      success: true,
      status: 'ok',
      whatsapp_connected: global.whatsappConnected || false,
      database: 'sqlite',
      pending_messages: stats.scheduled_messages.pending,
      pending_jobs: stats.jobs.pending,
      uptime: process.uptime(),
      version: '2.0.0'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      status: 'error',
      error: error.message
    });
  }
});

/**
 * GET /api/stats
 * System statistics
 */
app.get('/api/stats', (req, res) => {
  try {
    const stats = db.getStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('[API] Error getting stats:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    code: 'NOT_FOUND',
    path: req.path
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[API] Unhandled error:', err);

  res.status(500).json({
    success: false,
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
    message: err.message
  });
});

// ============================================================================
// START SERVER
// ============================================================================

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('─'.repeat(60));
  console.log('🚀 WhatsApp VPSLink API Server');
  console.log('─'.repeat(60));
  console.log(`✓ Listening on port ${PORT}`);
  console.log(`✓ Database: SQLite`);
  console.log(`✓ JWT Secret: ${JWT_SECRET.substr(0, 10)}...`);
  console.log('');
  console.log('Endpoints:');
  console.log('  POST /auth/login');
  console.log('  GET  /api/health');
  console.log('  GET  /api/contacts');
  console.log('  GET  /api/scheduled');
  console.log('  GET  /api/jobs');
  console.log('  GET  /api/chats');
  console.log('  GET  /api/stats');
  console.log('');
  console.log('Documentation: /docs/deployment/API-DESIGN.md');
  console.log('─'.repeat(60));
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[API] SIGTERM received, closing server...');
  server.close(() => {
    console.log('[API] Server closed');
    db.close();
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('[API] SIGINT received, closing server...');
  server.close(() => {
    console.log('[API] Server closed');
    db.close();
    process.exit(0);
  });
});

// Export for scheduler integration
module.exports = {
  app,
  server,
  setSchedulerRefreshCallback
};
