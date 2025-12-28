/**
 * Simple WhatsApp Listener - Based on proven baileys-test approach
 * Keeps persistent WhatsApp connection and exports sendMessage function
 */

require('dotenv').config();
const makeWASocket = require('@whiskeysockets/baileys').default;
const { useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');

let sock = null;
let isConnected = false;

async function connectToWhatsApp() {
  console.log('🔄 Connecting to WhatsApp...');

  const { state, saveCreds } = await useMultiFileAuthState('auth_info');

  sock = makeWASocket({
    auth: state
  });

  // Save credentials when updated
  sock.ev.on('creds.update', saveCreds);

  // Handle connection updates
  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    // Show QR code if needed
    if (qr) {
      console.log('\n📱 Scan this QR code with WhatsApp:\n');
      qrcode.generate(qr, { small: true });
    }

    // Handle disconnection
    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;

      console.log('❌ Connection closed');
      isConnected = false;

      if (shouldReconnect) {
        console.log('🔄 Reconnecting in 5 seconds...');
        setTimeout(connectToWhatsApp, 5000);
      } else {
        console.log('⚠️  Logged out - please restart and scan QR code');
      }
    }

    // Handle successful connection
    if (connection === 'open') {
      console.log('✅ Connected to WhatsApp!');
      isConnected = true;
    }
  });
}

/**
 * Send a message to a phone number
 * @param {string} phoneNumber - Phone number with country code (e.g., "447779299086")
 * @param {string} message - Message text to send
 * @returns {Promise<boolean>} - True if sent successfully
 */
async function sendMessage(phoneNumber, message) {
  if (!isConnected) {
    throw new Error('WhatsApp not connected');
  }

  if (!sock) {
    throw new Error('WhatsApp socket not initialized');
  }

  // Format phone number to JID
  const jid = phoneNumber.includes('@')
    ? phoneNumber
    : `${phoneNumber}@s.whatsapp.net`;

  try {
    await sock.sendMessage(jid, { text: message });
    console.log(`✅ Message sent to ${phoneNumber}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to send to ${phoneNumber}:`, error.message);
    throw error;
  }
}

/**
 * Check if WhatsApp is connected
 * @returns {boolean}
 */
function isWhatsAppConnected() {
  return isConnected;
}

// Auto-connect when module is loaded
connectToWhatsApp().catch(err => {
  console.error('❌ Failed to connect to WhatsApp:', err);
  process.exit(1);
});

module.exports = {
  sendMessage,
  isWhatsAppConnected
};
