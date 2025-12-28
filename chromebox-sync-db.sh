#!/bin/bash
# Database sync script for ChromeBox
# Syncs database from VPS to ChromeBox every minute

VPS_HOST="root@5.231.56.146"
VPS_DB_PATH="/root/whatsapp-vpslink/data/whatsapp.db"
LOCAL_DB_PATH="/root/whatsapp-scheduler/data/whatsapp.db"
BACKUP_DIR="/root/whatsapp-scheduler/data/backups"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Download database from VPS using rsync (faster, only transfers changes)
rsync -az --timeout=10 "$VPS_HOST:$VPS_DB_PATH" "$LOCAL_DB_PATH" 2>/dev/null

# Exit with success
exit 0
