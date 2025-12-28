require('dotenv').config();
const makeWASocket = require('@whiskeysockets/baileys').default;
const { useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');

async function generateQR() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');

  const sock = makeWASocket({
    auth: state
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('\n\n=======================================================');
      console.log('SCAN THIS QR CODE WITH YOUR WHATSAPP');
      console.log('=======================================================\n');
      qrcode.generate(qr, { small: true });
      console.log('\n=======================================================\n');
    }

    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;

      if (shouldReconnect) {
        console.log('Connection closed, reconnecting...');
        setTimeout(generateQR, 3000);
      } else {
        console.log('Logged out. Please run this script again.');
        process.exit(0);
      }
    } else if (connection === 'open') {
      console.log('\n\n=======================================================');
      console.log('✅ SUCCESSFULLY CONNECTED TO WHATSAPP!');
      console.log('=======================================================\n');
      console.log('You can now close this and restart the scheduler with:');
      console.log('pm2 restart whatsapp-scheduler');
      console.log('\n');

      setTimeout(() => {
        console.log('Auth saved. Closing connection...');
        process.exit(0);
      }, 5000);
    }
  });
}

generateQR().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
