#!/bin/bash
# Sync database from VPS to ChromeBox
# Run this script periodically to keep ChromeBox database up-to-date

set -e

VPS_HOST="root@5.231.56.146"
VPS_DB_PATH="/root/whatsapp-vpslink/data/whatsapp.db"
CHROMEBOX_HOST="root@192.168.1.18"
CHROMEBOX_DB_PATH="/root/whatsapp-scheduler/data/whatsapp.db"
BACKUP_PATH="/root/whatsapp-scheduler/data/backups"

echo "🔄 Syncing database from VPS to ChromeBox..."

# Step 1: Backup current ChromeBox database
echo "📦 Creating backup on ChromeBox..."
ssh $CHROMEBOX_HOST "mkdir -p $BACKUP_PATH && cp $CHROMEBOX_DB_PATH $BACKUP_PATH/whatsapp.db.backup-\$(date +%Y%m%d-%H%M%S) 2>/dev/null || true"

# Step 2: Copy database from VPS to temporary location
echo "⬇️  Downloading from VPS..."
scp $VPS_HOST:$VPS_DB_PATH /tmp/whatsapp-vps.db

# Step 3: Upload to ChromeBox
echo "⬆️  Uploading to ChromeBox..."
scp /tmp/whatsapp-vps.db $CHROMEBOX_HOST:$CHROMEBOX_DB_PATH

# Step 4: Cleanup
rm /tmp/whatsapp-vps.db

# Step 5: Restart scheduler on ChromeBox to pick up new data
echo "🔄 Restarting scheduler on ChromeBox..."
ssh $CHROMEBOX_HOST "pm2 restart whatsapp-scheduler 2>/dev/null || echo 'Scheduler not running yet'"

echo "✅ Database sync complete!"
echo ""
echo "Next steps:"
echo "  - Database synced from VPS to ChromeBox"
echo "  - Scheduler will now use the latest data"
echo "  - You can run this script anytime to refresh the database"
echo ""
echo "To automate this, add to cron:"
echo "  */5 * * * * /Users/saadi/Documents/GitHub/WhatsApp-VPSLink/sync-db-from-vps.sh"
