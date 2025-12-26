const express = require('express');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const app = express();
const PORT = 3002;

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const health = {
      timestamp: new Date().toISOString(),
      healthy: true,
      checks: {}
    };

    // Check if scheduler process is running
    try {
      const { stdout: pm2List } = await execPromise('pm2 jlist');
      const processes = JSON.parse(pm2List);
      const schedulerProcess = processes.find(p => p.name === 'whatsapp-scheduler');

      if (schedulerProcess) {
        health.checks.scheduler = {
          status: schedulerProcess.pm2_env.status === 'online' ? 'running' : 'stopped',
          uptime: schedulerProcess.pm2_env.pm_uptime,
          restarts: schedulerProcess.pm2_env.restart_time,
          memory: `${Math.round(schedulerProcess.monit.memory / 1024 / 1024)}MB`,
          cpu: `${schedulerProcess.monit.cpu}%`
        };

        if (schedulerProcess.pm2_env.status !== 'online') {
          health.healthy = false;
        }
      } else {
        health.checks.scheduler = { status: 'not_found' };
        health.healthy = false;
      }
    } catch (error) {
      health.checks.scheduler = { status: 'error', message: error.message };
      health.healthy = false;
    }

    // Check WhatsApp connection status by reading session file
    try {
      const fs = require('fs');
      const sessionPath = '/root/whatsapp-vpslink/auth_info_baileys/creds.json';

      if (fs.existsSync(sessionPath)) {
        const stats = fs.statSync(sessionPath);
        const lastModified = stats.mtime;
        const ageMinutes = Math.round((Date.now() - lastModified.getTime()) / 1000 / 60);

        health.checks.whatsapp_session = {
          status: 'exists',
          last_modified: lastModified.toISOString(),
          age_minutes: ageMinutes
        };

        // If session file hasn't been modified in over 24 hours, might be stale
        if (ageMinutes > 1440) {
          health.checks.whatsapp_session.warning = 'Session file older than 24 hours';
        }
      } else {
        health.checks.whatsapp_session = { status: 'missing' };
        health.healthy = false;
      }
    } catch (error) {
      health.checks.whatsapp_session = { status: 'error', message: error.message };
    }

    // Check last scheduler activity from logs
    try {
      const { stdout: logs } = await execPromise('pm2 logs whatsapp-scheduler --nostream --lines 50');

      // Look for recent "Checking for scheduled messages" log entries
      const checkPattern = /Checking for scheduled messages/;
      const recentCheck = logs.split('\n').find(line => checkPattern.test(line));

      if (recentCheck) {
        health.checks.scheduler_activity = {
          status: 'active',
          last_check: 'within last 50 log lines'
        };
      } else {
        health.checks.scheduler_activity = {
          status: 'inactive',
          warning: 'No recent scheduler activity found in logs'
        };
      }
    } catch (error) {
      health.checks.scheduler_activity = { status: 'error', message: error.message };
    }

    res.status(health.healthy ? 200 : 503).json(health);
  } catch (error) {
    res.status(500).json({
      timestamp: new Date().toISOString(),
      healthy: false,
      error: error.message
    });
  }
});

// Simple ping endpoint
app.get('/ping', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// Root endpoint with info
app.get('/', (req, res) => {
  res.json({
    service: 'WhatsApp Scheduler Health Monitor',
    version: '1.0.0',
    endpoints: {
      health: '/health - Full health check',
      ping: '/ping - Simple availability check'
    }
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Health monitor running on port ${PORT}`);
  console.log(`Health endpoint: http://0.0.0.0:${PORT}/health`);
  console.log(`Ping endpoint: http://0.0.0.0:${PORT}/ping`);
});
