#!/bin/bash

# Setup script for WhatsApp Scheduler on ChromeBox
# This script installs Node.js, copies files, and sets up the scheduler

set -e  # Exit on any error

echo "================================================"
echo "WhatsApp Scheduler Setup for ChromeBox"
echo "================================================"
echo ""

# Check if we're running as root
if [ "$EUID" -ne 0 ]; then
   echo "Please run as root (or use: sudo bash setup-chromebox-scheduler.sh)"
   exit 1
fi

echo "Step 1: Installing Node.js 20.x..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
    echo "✓ Node.js installed: $(node --version)"
else
    echo "✓ Node.js already installed: $(node --version)"
fi

echo ""
echo "Step 2: Creating directory structure..."
mkdir -p /root/whatsapp-scheduler
mkdir -p /root/whatsapp-scheduler/src
mkdir -p /root/whatsapp-scheduler/auth_info
mkdir -p /root/whatsapp-scheduler/data
echo "✓ Directories created"

echo ""
echo "Step 3: Installing npm dependencies..."
cd /root/whatsapp-scheduler

# Create package.json
cat > package.json << 'EOF'
{
  "name": "whatsapp-scheduler-chromebox",
  "version": "2.0.0",
  "description": "WhatsApp scheduler running on ChromeBox with residential IP",
  "main": "scheduler.js",
  "scripts": {
    "start": "node scheduler.js"
  },
  "dependencies": {
    "@whiskeysockets/baileys": "^6.7.0",
    "better-sqlite3": "^9.2.2",
    "dotenv": "^16.3.1",
    "qrcode-terminal": "^0.12.0"
  }
}
EOF

npm install
echo "✓ Dependencies installed"

echo ""
echo "Step 4: Creating .env configuration..."
cat > .env << 'EOF'
# Database path (local copy synced from VPS)
DB_PATH=/root/whatsapp-scheduler/data/whatsapp.db

# VPS database backup location
VPS_DB_PATH=root@5.231.56.146:/root/whatsapp-vpslink/data/whatsapp.db

# Timezone
TZ=Europe/London
EOF
echo "✓ Configuration created"

echo ""
echo "================================================"
echo "Setup Complete!"
echo "================================================"
echo ""
echo "Next steps (run these manually):"
echo ""
echo "1. Copy scheduler files from VPS:"
echo "   scp root@5.231.56.146:/root/whatsapp-vpslink/scheduler.js /root/whatsapp-scheduler/"
echo "   scp root@5.231.56.146:/root/whatsapp-vpslink/src/db.js /root/whatsapp-scheduler/src/"
echo ""
echo "2. Copy auth_info from Mac:"
echo "   scp -r saadi@YOUR_MAC_IP:/Users/saadi/Documents/GitHub/WhatsApp-VPSLink/auth_info /root/whatsapp-scheduler/"
echo ""
echo "3. Copy database from VPS:"
echo "   scp root@5.231.56.146:/root/whatsapp-vpslink/data/whatsapp.db /root/whatsapp-scheduler/data/"
echo ""
echo "4. Test the scheduler:"
echo "   cd /root/whatsapp-scheduler"
echo "   node scheduler.js"
echo ""
