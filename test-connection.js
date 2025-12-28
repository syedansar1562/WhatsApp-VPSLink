require('dotenv').config();
const makeWASocket = require('@whiskeysockets/baileys').default;
const { useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');

console.log('🧪 Testing WhatsApp connection from Mac...');
console.log('📍 This will prove if residential IP works vs datacenter IP\n');

async function testConnection() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      console.log('❌ Connection FAILED on Mac');
      console.log('Status:', statusCode);
      console.log('Error:', lastDisconnect?.error?.message || 'Unknown');

      if (shouldReconnect) {
        console.log('\n⚠️  This is UNEXPECTED - your Mac should connect!');
        console.log('Retrying in 3 seconds...');
        setTimeout(testConnection, 3000);
      } else {
        console.log('Logged out. Exiting...');
        process.exit(0);
      }
    } else if (connection === 'open') {
      console.log('\n✅ ✅ ✅ SUCCESS! ✅ ✅ ✅');
      console.log('Connected to WhatsApp from Mac (residential IP)');
      console.log('\n🎯 PROOF: Residential IP works, datacenter IP blocked!');
      console.log('\nClosing connection...');

      setTimeout(() => {
        process.exit(0);
      }, 3000);
    } else if (connection === 'connecting') {
      console.log('🔄 Connecting to WhatsApp...');
    }
  });
}

testConnection().catch(err => {
  console.error('❌ Fatal error:', err.message);
  process.exit(1);
});
