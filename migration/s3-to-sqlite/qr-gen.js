const makeWASocket = require('@whiskeysockets/baileys').default;
const { useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');

async function connect() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');

  const sock = makeWASocket({
    auth: state
  });

  sock.ev.on('connection.update', (update) => {
    const { connection, qr } = update;

    if (qr) {
      console.log('\n📱 Scan this QR code with WhatsApp:\n');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'open') {
      console.log('\n✅ Connected to WhatsApp!');
      console.log('Auth files saved to auth_info/');
      process.exit(0);
    }
  });

  sock.ev.on('creds.update', saveCreds);
}

connect();
