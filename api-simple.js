/**
 * Simple WhatsApp Scheduler REST API
 * Clean, minimal implementation with proper error handling
 */

require('dotenv').config();
const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const PORT = process.env.API_PORT || 3001;

// Database connection
const dbPath = path.join(__dirname, 'data', 'whatsapp.db');
const db = new Database(dbPath);

// Middleware
app.use(express.json());

// Enable CORS for development
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  next();
});

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// ============================================================================
// API ENDPOINTS
// ============================================================================

/**
 * Health check
 */
app.get('/health', (req, res) => {
  try {
    // Test database connection
    const result = db.prepare('SELECT COUNT(*) as count FROM scheduled_messages').get();

    res.json({
      status: 'ok',
      database: 'connected',
      messages_count: result.count,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

/**
 * Get all scheduled messages
 * Query params: status (optional) - 'pending', 'sent', 'failed'
 */
app.get('/api/messages', (req, res) => {
  try {
    const { status } = req.query;

    let query = 'SELECT * FROM scheduled_messages';
    let params = [];

    if (status) {
      query += ' WHERE status = ?';
      params.push(status);
    }

    query += ' ORDER BY scheduled_at DESC';

    const messages = db.prepare(query).all(...params);

    res.json({
      success: true,
      count: messages.length,
      messages
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Schedule a new message
 * POST /api/messages
 * Body: { to_phone, message, scheduled_at, contact_name? }
 */
app.post('/api/messages', (req, res) => {
  try {
    const { to_phone, message, scheduled_at, contact_name } = req.body;

    // Validation
    if (!to_phone) {
      return res.status(400).json({
        success: false,
        error: 'to_phone is required'
      });
    }

    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'message is required'
      });
    }

    if (!scheduled_at) {
      return res.status(400).json({
        success: false,
        error: 'scheduled_at is required (ISO 8601 format)'
      });
    }

    // Validate phone number format (basic check)
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    const cleanPhone = to_phone.replace(/\s+/g, '');
    if (!phoneRegex.test(cleanPhone)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid phone number format. Use international format (e.g., 447779299086)'
      });
    }

    // Validate scheduled_at is a valid date
    const scheduledDate = new Date(scheduled_at);
    if (isNaN(scheduledDate.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid scheduled_at format. Use ISO 8601 (e.g., 2025-12-28T18:30:00Z)'
      });
    }

    // Generate unique ID
    const id = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Insert into database
    const query = `
      INSERT INTO scheduled_messages
      (id, to_phone, contact_name, message, scheduled_at, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'pending', datetime('now'))
    `;

    db.prepare(query).run(
      id,
      cleanPhone,
      contact_name || null,
      message,
      scheduled_at
    );

    // Fetch the created message
    const created = db.prepare('SELECT * FROM scheduled_messages WHERE id = ?').get(id);

    res.status(201).json({
      success: true,
      message: 'Message scheduled successfully',
      data: created
    });

  } catch (error) {
    console.error('Error scheduling message:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get a specific message by ID
 */
app.get('/api/messages/:id', (req, res) => {
  try {
    const { id } = req.params;

    const message = db.prepare('SELECT * FROM scheduled_messages WHERE id = ?').get(id);

    if (!message) {
      return res.status(404).json({
        success: false,
        error: 'Message not found'
      });
    }

    res.json({
      success: true,
      data: message
    });
  } catch (error) {
    console.error('Error fetching message:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Delete a scheduled message (only if status is 'pending')
 */
app.delete('/api/messages/:id', (req, res) => {
  try {
    const { id } = req.params;

    // Check if message exists and is pending
    const message = db.prepare('SELECT * FROM scheduled_messages WHERE id = ?').get(id);

    if (!message) {
      return res.status(404).json({
        success: false,
        error: 'Message not found'
      });
    }

    if (message.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: `Cannot delete message with status '${message.status}'. Only pending messages can be deleted.`
      });
    }

    // Delete the message
    db.prepare('DELETE FROM scheduled_messages WHERE id = ?').run(id);

    res.json({
      success: true,
      message: 'Message deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get statistics
 */
app.get('/api/stats', (req, res) => {
  try {
    const stats = {
      total: db.prepare('SELECT COUNT(*) as count FROM scheduled_messages').get().count,
      pending: db.prepare('SELECT COUNT(*) as count FROM scheduled_messages WHERE status = ?').get('pending').count,
      sent: db.prepare('SELECT COUNT(*) as count FROM scheduled_messages WHERE status = ?').get('sent').count,
      failed: db.prepare('SELECT COUNT(*) as count FROM scheduled_messages WHERE status = ?').get('failed').count
    };

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

// 404 handler
app.get('/api/jobs', (req, res) => {
  try {
    const jobs = db.prepare(`
      SELECT id, job_data, status, scheduled_at, created_at, updated_at
      FROM scheduled_jobs
      ORDER BY created_at DESC
    `).all();

    const parsedJobs = jobs.map(job => {
      const jobData = JSON.parse(job.job_data);
      return {
        ...jobData,
        id: job.id,
        status: job.status,
        scheduledStartAt: job.scheduled_at,
        createdAt: job.created_at,
        updatedAt: job.updated_at
      };
    });

    res.json(parsedJobs);
  } catch (error) {
    console.error('Error fetching jobs:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/jobs - Create new job
app.post('/api/jobs', (req, res) => {
  try {
    const { recipients, messageParts, scheduledStartAt, config } = req.body;

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ success: false, error: 'At least one recipient is required' });
    }

    if (!messageParts || !Array.isArray(messageParts) || messageParts.length === 0) {
      return res.status(400).json({ success: false, error: 'At least one message part is required' });
    }

    if (!scheduledStartAt) {
      return res.status(400).json({ success: false, error: 'scheduledStartAt is required' });
    }

    const jobId = 'job_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    const now = new Date().toISOString();

    const jobData = {
      recipients,
      messageParts,
      config: config || { intervalMode: 'automatic', recipientGapSeconds: 30, maxRetries: 3 },
      createdBy: 'web',
      progress: { currentRecipientIndex: 0, currentPartIndex: 0, recipientsSent: 0, recipientsFailed: 0, sentCount: 0, failedCount: 0, totalCount: recipients.length * messageParts.length }
    };

    db.prepare(`
      INSERT INTO scheduled_jobs (id, job_data, status, scheduled_at, created_at, updated_at)
      VALUES (?, ?, 'pending', ?, ?, ?)
    `).run(jobId, JSON.stringify(jobData), scheduledStartAt, now, now);

    res.status(201).json({
      success: true,
      message: 'Job created successfully',
      data: { id: jobId, ...jobData, status: 'pending', scheduledStartAt, createdAt: now, updatedAt: now }
    });
  } catch (error) {
    console.error('Error creating job:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// DELETE /api/jobs/:id - Delete/cancel job
app.delete('/api/jobs/:id', (req, res) => {
  try {
    const result = db.prepare(`
      UPDATE scheduled_jobs
      SET status = 'cancelled', updated_at = ?
      WHERE id = ? AND status = 'pending'
    `).run(new Date().toISOString(), req.params.id);

    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Job not found or already completed' });
    }

    res.json({ success: true, message: 'Job cancelled successfully' });
  } catch (error) {
    console.error('Error deleting job:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log('API server running on port ' + PORT);
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// ============================================================================
// START SERVER
// ============================================================================

  console.log('API server running on port ' + PORT);
});

// ==================== CONTACTS ENDPOINTS ====================

// GET /api/contacts - List all contacts
app.get('/api/contacts', (req, res) => {
  try {
    const contacts = db.prepare(`
      SELECT id, phone, name, aliases, tags, is_favorite, created_at, updated_at
      FROM contacts
      ORDER BY name ASC
    `).all();

    //Convert to Web UI format (key-value with phone as key)
    const contactsObj = {};
    contacts.forEach(contact => {
      const phone = contact.phone;
      contactsObj[phone] = {
        name: contact.name,
        aliases: JSON.parse(contact.aliases || '[]'),
        phones: {
          primary: contact.phone,
          secondary: null
        },
        defaultPhone: 'primary',
        favorite: contact.is_favorite === 1,
        tags: JSON.parse(contact.tags || '[]'),
        timezone: null
      };
    });

    res.json(contactsObj);
  } catch (error) {
    console.error('Error fetching contacts:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/contacts - Save all contacts (replaces existing)
app.post('/api/contacts', (req, res) => {
  try {
    const contacts = req.body;
    
    // Delete all existing contacts
    db.prepare('DELETE FROM contacts').run();
    
    // Insert new contacts
    const insert = db.prepare(`
      INSERT INTO contacts (phone, name, aliases, tags, is_favorite)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    Object.entries(contacts).forEach(([phone, contact]) => {
      insert.run(
        contact.phones.primary,
        contact.name,
        JSON.stringify(contact.aliases || []),
        JSON.stringify(contact.tags || []),
        contact.favorite ? 1 : 0
      );
    });
    
    res.json({ success: true, message: 'Contacts saved successfully' });
  } catch (error) {
    console.error('Error saving contacts:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});


// Start server
