#!/bin/bash

# ============================================================================
# Setup Backup Cron Job
# ============================================================================
# Location: /root/whatsapp-vpslink/setup-backup-cron.sh
# Purpose: Configure automatic backups based on .env.backup settings
# Usage: sudo ./setup-backup-cron.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "[ERROR] Please run as root (use sudo)"
    exit 1
fi

# Load backup configuration
if [ ! -f "$SCRIPT_DIR/.env.backup" ]; then
    echo "[ERROR] Missing .env.backup configuration file"
    echo ""
    echo "Copy the example file and configure it:"
    echo "  cp .env.backup.example .env.backup"
    echo "  nano .env.backup"
    exit 1
fi

source "$SCRIPT_DIR/.env.backup"

# Get interval from config
INTERVAL_MINUTES="${BACKUP_INTERVAL_MINUTES:-60}"
BACKUP_PROVIDER="${BACKUP_PROVIDER:-garage}"

echo "─────────────────────────────────────────────────"
echo "WhatsApp VPSLink - Backup Cron Setup"
echo "─────────────────────────────────────────────────"
echo ""
echo "Configuration:"
echo "  Provider: $BACKUP_PROVIDER"
echo "  Interval: $INTERVAL_MINUTES minutes"
echo "  Script: $SCRIPT_DIR/backup.sh"
echo ""

# ============================================================================
# CALCULATE CRON SCHEDULE
# ============================================================================

# Convert interval to cron syntax
case $INTERVAL_MINUTES in
    15)
        CRON_SCHEDULE="*/15 * * * *"
        DESCRIPTION="Every 15 minutes"
        ;;
    30)
        CRON_SCHEDULE="*/30 * * * *"
        DESCRIPTION="Every 30 minutes"
        ;;
    60)
        CRON_SCHEDULE="0 * * * *"
        DESCRIPTION="Every hour"
        ;;
    120)
        CRON_SCHEDULE="0 */2 * * *"
        DESCRIPTION="Every 2 hours"
        ;;
    180)
        CRON_SCHEDULE="0 */3 * * *"
        DESCRIPTION="Every 3 hours"
        ;;
    240)
        CRON_SCHEDULE="0 */4 * * *"
        DESCRIPTION="Every 4 hours"
        ;;
    360)
        CRON_SCHEDULE="0 */6 * * *"
        DESCRIPTION="Every 6 hours"
        ;;
    720)
        CRON_SCHEDULE="0 */12 * * *"
        DESCRIPTION="Every 12 hours"
        ;;
    1440)
        CRON_SCHEDULE="0 0 * * *"
        DESCRIPTION="Daily at midnight"
        ;;
    *)
        # Custom interval - use */N syntax (may not work for all values)
        CRON_SCHEDULE="*/$INTERVAL_MINUTES * * * *"
        DESCRIPTION="Every $INTERVAL_MINUTES minutes"
        echo "[WARNING] Custom interval detected. Cron syntax may not work for all values."
        echo "          Recommended intervals: 15, 30, 60, 120, 240, 360, 720, 1440"
        ;;
esac

echo "Cron Schedule: $CRON_SCHEDULE ($DESCRIPTION)"
echo ""

# ============================================================================
# MAKE BACKUP SCRIPT EXECUTABLE
# ============================================================================

chmod +x "$SCRIPT_DIR/backup.sh"
echo "✓ Made backup.sh executable"

# ============================================================================
# REMOVE OLD CRON JOBS
# ============================================================================

# Remove any existing WhatsApp backup cron jobs
crontab -l 2>/dev/null | grep -v "whatsapp-vpslink/backup.sh" | crontab - || true
echo "✓ Removed old cron jobs (if any)"

# ============================================================================
# ADD NEW CRON JOB
# ============================================================================

CRON_JOB="$CRON_SCHEDULE $SCRIPT_DIR/backup.sh >> $SCRIPT_DIR/logs/backup.log 2>&1"

# Add to crontab
(crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
echo "✓ Added new cron job"

# ============================================================================
# VERIFY CRON JOB
# ============================================================================

echo ""
echo "Current crontab:"
echo "─────────────────────────────────────────────────"
crontab -l | grep "whatsapp-vpslink/backup.sh"
echo "─────────────────────────────────────────────────"
echo ""

# ============================================================================
# TEST BACKUP
# ============================================================================

read -p "Run a test backup now? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "Running test backup..."
    echo "─────────────────────────────────────────────────"
    "$SCRIPT_DIR/backup.sh"
    echo ""
    echo "✅ Test backup completed successfully!"
else
    echo "Skipping test backup"
fi

# ============================================================================
# NEXT STEPS
# ============================================================================

echo ""
echo "─────────────────────────────────────────────────"
echo "✅ Backup Cron Job Setup Complete!"
echo "─────────────────────────────────────────────────"
echo ""
echo "Next scheduled backup: $DESCRIPTION"
echo ""
echo "Useful commands:"
echo ""
echo "  # View backup logs"
echo "  tail -f $SCRIPT_DIR/logs/backup.log"
echo ""
echo "  # List current cron jobs"
echo "  crontab -l"
echo ""
echo "  # Run manual backup"
echo "  $SCRIPT_DIR/backup.sh"
echo ""
echo "  # Change backup interval"
echo "  nano $SCRIPT_DIR/.env.backup"
echo "  $SCRIPT_DIR/setup-backup-cron.sh"
echo ""
echo "  # Switch to Backblaze"
echo "  nano $SCRIPT_DIR/.env.backup  # Change BACKUP_PROVIDER=backblaze"
echo "  # (No need to reconfigure cron, will use new provider automatically)"
echo ""
echo "─────────────────────────────────────────────────"
