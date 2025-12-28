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

app.listen(PORT, () => {
  console.log('');
  console.log('🚀 WhatsApp Scheduler API');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✓ Server running on port ${PORT}`);
  console.log(`✓ Database: ${dbPath}`);
  console.log('');
  console.log('Available endpoints:');
  console.log('  GET    /health');
  console.log('  GET    /api/stats');
  console.log('  GET    /api/messages');
  console.log('  POST   /api/messages');
  console.log('  GET    /api/messages/:id');
  console.log('  DELETE /api/messages/:id');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
});
