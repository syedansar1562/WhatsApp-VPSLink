#!/bin/bash

# ============================================================================
# WhatsApp VPSLink SQLite Backup Script
# ============================================================================
# Location: /root/whatsapp-vpslink/backup.sh
# Purpose: Backup SQLite database to S3 (Garage or Backblaze)
# Created: December 28, 2025
# Usage: ./backup.sh [--force]

set -e  # Exit on error

# ============================================================================
# CONFIGURATION
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB_PATH="$SCRIPT_DIR/data/whatsapp.db"
BACKUP_DIR="$SCRIPT_DIR/backups"
LOG_FILE="$SCRIPT_DIR/logs/backup.log"

# Load backup configuration
if [ -f "$SCRIPT_DIR/.env.backup" ]; then
    source "$SCRIPT_DIR/.env.backup"
else
    echo "[ERROR] Missing .env.backup configuration file"
    exit 1
fi

# Defaults if not set in .env.backup
BACKUP_PROVIDER="${BACKUP_PROVIDER:-garage}"
BACKUP_COMPRESS="${BACKUP_COMPRESS:-true}"
BACKUP_COMPRESSION_LEVEL="${BACKUP_COMPRESSION_LEVEL:-6}"
BACKUP_ENABLE_LOGGING="${BACKUP_ENABLE_LOGGING:-true}"

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

log() {
    local message="[$(date '+%Y-%m-%d %H:%M:%S')] $1"
    echo "$message"
    if [ "$BACKUP_ENABLE_LOGGING" = "true" ]; then
        echo "$message" >> "$LOG_FILE"
    fi
}

error() {
    log "[ERROR] $1"
    if [ "$BACKUP_NOTIFY_ON_FAILURE" = "true" ] && [ -n "$BACKUP_WEBHOOK_URL" ]; then
        notify_failure "$1"
    fi
    exit 1
}

notify_failure() {
    local message="$1"
    if [ -n "$BACKUP_WEBHOOK_URL" ]; then
        curl -X POST "$BACKUP_WEBHOOK_URL" \
            -H "Content-Type: application/json" \
            -d "{\"content\": \"🔴 Backup Failed: $message\"}" \
            --silent --show-error || true
    fi
}

# ============================================================================
# CHECK PREREQUISITES
# ============================================================================

# Create directories if they don't exist
mkdir -p "$BACKUP_DIR"
mkdir -p "$(dirname "$LOG_FILE")"

# Check if database exists
if [ ! -f "$DB_PATH" ]; then
    error "Database not found at $DB_PATH"
fi

# Check if s3cmd is installed
if ! command -v s3cmd &> /dev/null; then
    error "s3cmd is not installed. Install with: apt-get install s3cmd"
fi

# ============================================================================
# DETERMINE S3 PROVIDER SETTINGS
# ============================================================================

if [ "$BACKUP_PROVIDER" = "garage" ]; then
    S3_ENDPOINT="$GARAGE_ENDPOINT"
    S3_ACCESS_KEY="$GARAGE_ACCESS_KEY_ID"
    S3_SECRET_KEY="$GARAGE_SECRET_ACCESS_KEY"
    S3_BUCKET="$GARAGE_BUCKET"
    S3_REGION="$GARAGE_REGION"
    S3_PREFIX="$GARAGE_PREFIX"
    log "[INFO] Using Garage S3 (self-hosted)"
elif [ "$BACKUP_PROVIDER" = "backblaze" ]; then
    S3_ENDPOINT="$BACKBLAZE_ENDPOINT"
    S3_ACCESS_KEY="$BACKBLAZE_ACCESS_KEY_ID"
    S3_SECRET_KEY="$BACKBLAZE_SECRET_ACCESS_KEY"
    S3_BUCKET="$BACKBLAZE_BUCKET"
    S3_REGION="$BACKBLAZE_REGION"
    S3_PREFIX="$BACKBLAZE_PREFIX"
    log "[INFO] Using Backblaze B2 (cloud)"
else
    error "Invalid BACKUP_PROVIDER: $BACKUP_PROVIDER (must be 'garage' or 'backblaze')"
fi

# ============================================================================
# CREATE BACKUP
# ============================================================================

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/whatsapp_$TIMESTAMP.db"

log "[BACKUP] Starting backup to $BACKUP_PROVIDER S3..."
log "[BACKUP] Database: $DB_PATH"

# SQLite hot backup (safe even while database is in use)
if ! sqlite3 "$DB_PATH" ".backup $BACKUP_FILE"; then
    error "SQLite backup failed"
fi

BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
log "[BACKUP] Created backup: $BACKUP_FILE ($BACKUP_SIZE)"

# Check backup size
BACKUP_SIZE_MB=$(du -m "$BACKUP_FILE" | cut -f1)
if [ "$BACKUP_SIZE_MB" -gt "${BACKUP_MAX_SIZE_MB:-500}" ]; then
    log "[WARNING] Backup size ($BACKUP_SIZE_MB MB) exceeds threshold (${BACKUP_MAX_SIZE_MB:-500} MB)"
fi

# ============================================================================
# COMPRESS BACKUP
# ============================================================================

if [ "$BACKUP_COMPRESS" = "true" ]; then
    log "[BACKUP] Compressing backup..."

    if ! gzip -"$BACKUP_COMPRESSION_LEVEL" "$BACKUP_FILE"; then
        error "Compression failed"
    fi

    BACKUP_FILE="$BACKUP_FILE.gz"
    COMPRESSED_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    log "[BACKUP] Compressed to: $COMPRESSED_SIZE"
fi

# ============================================================================
# UPLOAD TO S3
# ============================================================================

S3_PATH="s3://$S3_BUCKET/${S3_PREFIX}$(basename "$BACKUP_FILE")"

log "[BACKUP] Uploading to $S3_PATH..."

# Create s3cmd config on the fly (avoids storing credentials in ~/.s3cfg)
S3CMD_CONFIG=$(mktemp)
cat > "$S3CMD_CONFIG" <<EOF
[default]
access_key = $S3_ACCESS_KEY
secret_key = $S3_SECRET_KEY
host_base = ${S3_ENDPOINT#http*://}
host_bucket = ${S3_ENDPOINT#http*://}
use_https = $(echo "$S3_ENDPOINT" | grep -q "https" && echo "True" || echo "False")
EOF

# Upload to S3
if ! s3cmd -c "$S3CMD_CONFIG" put "$BACKUP_FILE" "$S3_PATH" --no-progress 2>&1 | tee -a "$LOG_FILE"; then
    rm -f "$S3CMD_CONFIG"
    error "S3 upload failed"
fi

# Cleanup temp config
rm -f "$S3CMD_CONFIG"

log "[BACKUP] Upload complete: $S3_PATH"

# ============================================================================
# CLEANUP LOCAL BACKUPS
# ============================================================================

RETENTION_HOURS="${BACKUP_LOCAL_RETENTION_HOURS:-24}"

if [ "$RETENTION_HOURS" -eq 0 ]; then
    log "[CLEANUP] Deleting local backup immediately"
    rm -f "$BACKUP_FILE"
else
    log "[CLEANUP] Local retention: $RETENTION_HOURS hours"

    # Delete backups older than retention period
    find "$BACKUP_DIR" -name "whatsapp_*.db*" -type f -mmin "+$((RETENTION_HOURS * 60))" -delete

    REMAINING=$(find "$BACKUP_DIR" -name "whatsapp_*.db*" -type f | wc -l)
    log "[CLEANUP] Local backups remaining: $REMAINING"
fi

# ============================================================================
# VERIFY BACKUP
# ============================================================================

log "[VERIFY] Checking backup integrity on S3..."

# Create temporary s3cmd config again
S3CMD_CONFIG=$(mktemp)
cat > "$S3CMD_CONFIG" <<EOF
[default]
access_key = $S3_ACCESS_KEY
secret_key = $S3_SECRET_KEY
host_base = ${S3_ENDPOINT#http*://}
host_bucket = ${S3_ENDPOINT#http*://}
use_https = $(echo "$S3_ENDPOINT" | grep -q "https" && echo "True" || echo "False")
EOF

# Check if file exists on S3
if s3cmd -c "$S3CMD_CONFIG" info "$S3_PATH" > /dev/null 2>&1; then
    S3_SIZE=$(s3cmd -c "$S3CMD_CONFIG" ls "$S3_PATH" | awk '{print $3}')
    log "[VERIFY] Backup verified on S3 (size: $S3_SIZE bytes)"
else
    rm -f "$S3CMD_CONFIG"
    error "Backup verification failed - file not found on S3"
fi

rm -f "$S3CMD_CONFIG"

# ============================================================================
# SUMMARY
# ============================================================================

log "─────────────────────────────────────────────────"
log "✅ BACKUP COMPLETED SUCCESSFULLY"
log "   Provider: $BACKUP_PROVIDER"
log "   Database: $BACKUP_SIZE"
log "   Compressed: $([ "$BACKUP_COMPRESS" = "true" ] && echo "Yes ($COMPRESSED_SIZE)" || echo "No")"
log "   S3 Path: $S3_PATH"
log "   Local: $([ "$RETENTION_HOURS" -eq 0 ] && echo "Deleted" || echo "Retained for $RETENTION_HOURS hours")"
log "─────────────────────────────────────────────────"

exit 0
