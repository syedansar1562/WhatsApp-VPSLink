#!/usr/bin/env node

const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, downloadMediaMessage } = require('@whiskeysockets/baileys');
const ChatStore = require('./src/chatStore');
const ContactsManager = require('./contacts-manager');
const fs = require('fs');
const path = require('path');

// CLI Arguments
const command = process.argv[2];
const args = process.argv.slice(3);

// Help text
const help = `
WhatsApp CLI Tool (Baileys)

Usage: node wa.js <command> [options]

Commands:
  listen                     Start listening and storing messages
  send <number> <message>    Send a message (e.g., 447779299086)
  chats [limit]              List recent chats (default: 20)
  read <number|name>         Read messages from a specific chat
  search <query>             Search chats by name or number
  unread                     Show chats with unread messages
  groups                     List all group chats
  download <number|name> [type] [count]  Download media from chat (type: voice/audio/image/video/document/all, default: all, count: default 10)
  help                       Show this help message

Examples:
  node wa.js listen
  node wa.js send 447779299086 "Hello!"
  node wa.js chats 10
  node wa.js read 447779299086
  node wa.js read Nick
  node wa.js search Nick
  node wa.js unread
  node wa.js groups
  node wa.js download 447435152066 voice 2
  node wa.js download Payal all 10
  node wa.js download Nick image 5
`;

// Connection helper with enhanced configuration
async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const { Browsers } = require('@whiskeysockets/baileys');
    const sock = makeWASocket({
        auth: state,
        browser: Browsers.macOS('Desktop'),
        syncFullHistory: true,

        // Enhanced configuration for history sync
        markOnlineOnConnect: false,      // Don't rush to online state
        fireInitQueries: true,            // Ensure initialization queries fire
        connectTimeoutMs: 120000,         // 2 min timeout (vs default 20s)
        defaultQueryTimeoutMs: 120000,    // 2 min for queries
        keepAliveIntervalMs: 30000,       // Stability improvement
        retryRequestDelayMs: 500,         // Reduce server hammering
    });
    sock.ev.on('creds.update', saveCreds);
    return sock;
}

// Extract message text and type
function extractMessageInfo(msg) {
    let text = '';
    let type = 'text';

    if (msg.message.conversation) {
        text = msg.message.conversation;
        type = 'text';
    } else if (msg.message.extendedTextMessage) {
        text = msg.message.extendedTextMessage.text;
        type = 'text';
    } else if (msg.message.imageMessage) {
        text = '[Image]' + (msg.message.imageMessage.caption || '');
        type = 'image';
    } else if (msg.message.videoMessage) {
        text = '[Video]' + (msg.message.videoMessage.caption || '');
        type = 'video';
    } else if (msg.message.audioMessage) {
        text = msg.message.audioMessage.ptt ? '[Voice Note]' : '[Audio]';
        type = 'audio';
    } else if (msg.message.documentMessage) {
        text = '[Document] ' + msg.message.documentMessage.fileName;
        type = 'document';
    } else {
        text = '[Other message type]';
        type = 'other';
    }

    return { text, type };
}

// Extract message text (backward compatibility)
function extractMessageText(msg) {
    return extractMessageInfo(msg).text;
}

// Command: Listen and store messages
async function listen() {
    console.log('📱 Starting WhatsApp listener with message storage...\n');
    const sock = await connectToWhatsApp();
    const store = await new ChatStore().init();

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        // Handle QR code
        if (qr) {
            console.log('\n📱 Scan this QR code with WhatsApp:\n');
            const qrcode = require('qrcode-terminal');
            qrcode.generate(qr, { small: true });
            console.log('\n');
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Connection closed. Reconnecting:', shouldReconnect);
            if (shouldReconnect) listen();
        } else if (connection === 'open') {
            console.log('✓ Connected to WhatsApp!');
            console.log('Listening and storing messages...\n');
            console.log('Syncing message history...');

            // Try to fetch additional history
            try {
                if (typeof sock.fetchMessageHistory === 'function') {
                    console.log('Requesting additional message history...');
                    await sock.fetchMessageHistory(50, undefined, undefined);
                }
            } catch (err) {
                console.log('Note: Could not fetch additional history:', err.message);
            }
        }
    });

    // Handle history sync - PRIMARY EVENT
    sock.ev.on('messaging-history.set', async ({ chats, contacts, messages, isLatest }) => {
        console.log(`\n🎯 [MESSAGING-HISTORY.SET] ${chats.length} chats, ${messages.length} messages`);
        console.log(`   isLatest: ${isLatest}`);

        // Store contacts
        contacts.forEach(contact => {
            if (contact.id && contact.name) {
                store.setName(contact.id, contact.name);
            }
        });

        // Store messages
        messages.forEach(msg => {
            if (!msg.message) return;

            const from = msg.key.remoteJid;
            const isFromMe = msg.key.fromMe;
            const timestamp = msg.messageTimestamp;
            const { text, type } = extractMessageInfo(msg);

            // Pass raw message for media types
            store.addMessage(from, text, timestamp, isFromMe, type, type !== 'text' ? msg : null);
        });

        console.log(`✅ History synced: ${messages.length} messages stored\n`);
    });

    // Additional sync events (may fire separately)
    sock.ev.on('chats.set', ({ chats }) => {
        console.log(`📁 [CHATS.SET] ${chats.length} chats received`);
        // Chat metadata may arrive separately from messages
    });

    sock.ev.on('messages.set', ({ messages }) => {
        console.log(`📨 [MESSAGES.SET] ${messages.length} messages received`);

        // Store these messages too
        messages.forEach(msg => {
            if (!msg.message) return;
            const from = msg.key.remoteJid;
            const isFromMe = msg.key.fromMe;
            const timestamp = msg.messageTimestamp;
            const { text, type } = extractMessageInfo(msg);
            store.addMessage(from, text, timestamp, isFromMe, type, type !== 'text' ? msg : null);
        });
    });

    sock.ev.on('messages.upsert', async (m) => {
        // Log the type to detect offline sync vs real-time
        console.log(`📬 [MESSAGES.UPSERT] type="${m.type}", count=${m.messages.length}`);

        for (const msg of m.messages) {
            if (!msg.message) continue;

            const from = msg.key.remoteJid;
            const isFromMe = msg.key.fromMe;
            const timestamp = msg.messageTimestamp;
            const { text, type } = extractMessageInfo(msg);

            // Store ALL messages regardless of type (with raw message for media)
            store.addMessage(from, text, timestamp, isFromMe, type, type !== 'text' ? msg : null);

            // Display based on type
            if (m.type === 'notify' && !isFromMe) {
                // Real-time incoming message
                const time = new Date(timestamp * 1000).toLocaleString();
                console.log(`\n[${time}] NEW MESSAGE`);
                console.log(`From: ${from}`);
                console.log(`Message: ${text}`);
                console.log('---');
            } else if (m.type === 'append') {
                // Offline sync / historical message
                console.log(`   ↳ 📥 [OFFLINE SYNC] ${from.split('@')[0]}: ${text.substring(0, 40)}...`);
            } else if (m.type === 'prepend') {
                // Historical message prepended
                console.log(`   ↳ 📜 [HISTORY] ${from.split('@')[0]}: ${text.substring(0, 40)}...`);
            }

            // OPTIONAL: Try fetchMessageHistory after first real message
            // This is commented out for initial test - uncomment if needed
            /*
            if (m.type === 'notify' && !isFromMe) {
                try {
                    console.log(`   Attempting fetchMessageHistory for ${from}...`);
                    // Note: This triggers events, doesn't return data directly
                    await sock.fetchMessageHistory(50, msg.key, timestamp);
                    console.log(`   ✓ History request sent (watch for events above)`);
                } catch (err) {
                    console.log(`   ✗ fetchMessageHistory failed: ${err.message}`);
                }
            }
            */
        }
    });

    // Handle contact updates
    sock.ev.on('contacts.update', (contacts) => {
        contacts.forEach(contact => {
            if (contact.id && contact.notify) {
                store.setName(contact.id, contact.notify);
            }
        });
    });
}

// Command: Send message
async function sendMessage(number, message) {
    if (!number || !message) {
        console.error('Error: Please provide number and message');
        console.log('Usage: node wa.js send <number> <message>');
        process.exit(1);
    }

    console.log(`Sending message to ${number}...`);
    const sock = await connectToWhatsApp();

    sock.ev.on('connection.update', async (update) => {
        const { connection } = update;
        if (connection === 'open') {
            try {
                const jid = number.includes('@') ? number : `${number}@s.whatsapp.net`;
                await sock.sendMessage(jid, { text: message });
                console.log('✓ Message sent successfully!');
                process.exit(0);
            } catch (error) {
                console.error('Error sending message:', error.message);
                process.exit(1);
            }
        }
    });
}

// Command: List chats
async function listChats(limit = 20) {
    const store = await new ChatStore().init();
    const contacts = new ContactsManager();
    const chats = store.getAllChats().slice(0, limit);

    if (chats.length === 0) {
        console.log('No chats found. Run "node wa.js listen" to start capturing messages.');
        return;
    }

    console.log(`\n📋 Recent Chats (${chats.length}):\n`);

    chats.forEach((chat, index) => {
        // Try to get name from contacts manager (includes aliases)
        const phoneNumber = chat.id.split('@')[0];
        const contactName = contacts.getName(phoneNumber);
        const name = contactName || chat.name || chat.id;

        const lastMsg = chat.messages[chat.messages.length - 1];
        const time = new Date(lastMsg.timestamp * 1000).toLocaleString();
        const unread = chat.unreadCount > 0 ? ` [${chat.unreadCount} unread]` : '';
        const type = chat.isGroup ? ' 👥' : '';
        const preview = lastMsg.message.substring(0, 50) + (lastMsg.message.length > 50 ? '...' : '');

        console.log(`${index + 1}. ${name}${type}${unread}`);
        console.log(`   ${preview}`);
        console.log(`   ${time}\n`);
    });
}

// Command: Read specific chat
async function readChat(query) {
    const store = await new ChatStore().init();
    const contacts = new ContactsManager();
    let chat = null;

    // Try to resolve via contacts manager (supports aliases)
    const phoneNumber = contacts.getNumber(query);
    if (phoneNumber) {
        chat = store.getChat(phoneNumber + '@s.whatsapp.net');
    }

    // Try exact ID match
    if (!chat) {
        chat = store.getChat(query + '@s.whatsapp.net');
    }

    // If not found, search by name or partial match
    if (!chat) {
        const results = store.searchChats(query);
        if (results.length === 0) {
            console.log(`No chat found for: ${query}`);
            console.log('Try: node wa.js search <name> to find the exact match');
            return;
        }
        if (results.length > 1) {
            console.log(`Multiple chats found for "${query}":`);
            results.forEach((c, i) => {
                const phoneNum = c.id.split('@')[0];
                const contactName = contacts.getName(phoneNum);
                console.log(`  ${i + 1}. ${contactName || c.name || c.id}`);
            });
            console.log('\nPlease be more specific or use the full number.');
            return;
        }
        chat = results[0];
    }

    const phoneNum = chat.id.split('@')[0];
    const contactName = contacts.getName(phoneNum);
    const name = contactName || chat.name || chat.id;

    console.log(`\n💬 Chat with ${name}${chat.isGroup ? ' (Group)' : ''}`);
    console.log(`Total messages: ${chat.messages.length}\n`);
    console.log('─'.repeat(60));

    chat.messages.forEach(msg => {
        const time = new Date(msg.timestamp * 1000).toLocaleString();
        const sender = msg.isFromMe ? 'You' : name;
        console.log(`[${time}] ${sender}:`);
        console.log(`${msg.message}\n`);
    });

    console.log('─'.repeat(60));

    // Mark as read
    store.markAsRead(chat.id);
    console.log(`\n✓ Marked as read\n`);
}

// Command: Search chats
async function searchChats(query) {
    const store = await new ChatStore().init();
    const results = store.searchChats(query);

    if (results.length === 0) {
        console.log(`No chats found for: ${query}`);
        return;
    }

    console.log(`\n🔍 Search results for "${query}" (${results.length}):\n`);

    results.forEach((chat, index) => {
        const name = chat.name || chat.id;
        const lastMsg = chat.messages[chat.messages.length - 1];
        const time = new Date(lastMsg.timestamp * 1000).toLocaleString();
        const unread = chat.unreadCount > 0 ? ` [${chat.unreadCount} unread]` : '';
        const type = chat.isGroup ? ' 👥' : '';

        console.log(`${index + 1}. ${name}${type}${unread}`);
        console.log(`   Last: ${time}`);
        console.log(`   ID: ${chat.id}\n`);
    });
}

// Command: Show unread
async function showUnread() {
    const store = await new ChatStore().init();
    const unread = store.getUnreadChats();

    if (unread.length === 0) {
        console.log('✓ No unread messages');
        return;
    }

    console.log(`\n📬 Unread Messages (${unread.length}):\n`);

    unread.forEach((chat, index) => {
        const name = chat.name || chat.id;
        const type = chat.isGroup ? ' 👥' : '';
        const time = new Date(chat.lastMessageTime * 1000).toLocaleString();

        console.log(`${index + 1}. ${name}${type}`);
        console.log(`   ${chat.unreadCount} unread messages`);
        console.log(`   Last message: ${time}\n`);
    });
}

// Command: List groups
async function listGroups() {
    const store = await new ChatStore().init();
    const groups = store.getAllChats().filter(chat => chat.isGroup);

    if (groups.length === 0) {
        console.log('No group chats found');
        return;
    }

    console.log(`\n👥 Group Chats (${groups.length}):\n`);

    groups.forEach((chat, index) => {
        const name = chat.name || chat.id;
        const unread = chat.unreadCount > 0 ? ` [${chat.unreadCount} unread]` : '';
        const time = new Date(chat.lastMessageTime * 1000).toLocaleString();

        console.log(`${index + 1}. ${name}${unread}`);
        console.log(`   Last activity: ${time}\n`);
    });
}

// Command: Download media (voice notes, audio, images, videos, documents)
async function downloadMedia(query, mediaType = 'all', count = 10) {
    const store = await new ChatStore().init();
    const contacts = new ContactsManager();

    // Resolve contact query to JID
    let chatId = null;

    // Try to resolve via contacts manager (supports aliases)
    const phoneNumber = contacts.getNumber(query);
    if (phoneNumber) {
        chatId = phoneNumber + '@s.whatsapp.net';
    } else if (query.includes('@')) {
        chatId = query;
    } else {
        chatId = query + '@s.whatsapp.net';
    }

    const phoneNum = chatId.split('@')[0];
    const contactName = contacts.getName(phoneNum);
    const name = contactName || query;

    const typeLabel = mediaType === 'all' ? 'all media' : mediaType;
    console.log(`📥 Downloading ${typeLabel} from ${name} (${phoneNum})...`);
    console.log(`Connecting to WhatsApp...\n`);

    const sock = await connectToWhatsApp();

    sock.ev.on('connection.update', async (update) => {
        const { connection, qr } = update;

        if (qr) {
            console.log('\n📱 Scan this QR code with WhatsApp:\n');
            const qrcode = require('qrcode-terminal');
            qrcode.generate(qr, { small: true });
            console.log('\n');
        }

        if (connection === 'open') {
            try {
                console.log('✓ Connected! Fetching messages...\n');

                // Fetch message history using fetchMessageHistory
                // This will trigger messaging-history.set events
                let collectedMessages = [];

                // Set up temporary event listener to collect messages
                const messageCollector = (data) => {
                    if (data.messages) {
                        collectedMessages.push(...data.messages);
                    }
                };

                sock.ev.on('messaging-history.set', messageCollector);

                // Request history
                try {
                    await sock.fetchMessageHistory(count * 20, undefined, undefined);
                } catch (err) {
                    console.log('Note: fetchMessageHistory not available, using stored messages from database');
                }

                // Wait a bit for messages to arrive
                await new Promise(resolve => setTimeout(resolve, 2000));

                sock.ev.off('messaging-history.set', messageCollector);

                // If no messages collected via events, try to filter from our chatStore
                if (collectedMessages.length === 0) {
                    console.log('Using stored messages from database...');
                    const chat = store.getChat(chatId);
                    if (!chat || chat.messages.length === 0) {
                        console.log('No messages found in this chat.');
                        process.exit(0);
                    }

                    // Extract raw message objects from stored messages
                    collectedMessages = chat.messages
                        .filter(m => m.rawMessage)
                        .map(m => m.rawMessage);

                    if (collectedMessages.length === 0) {
                        console.log('Warning: No media messages with downloadable content found.');
                        console.log('Voice notes were captured as text "[Voice Note]" but raw message data is not available.');
                        console.log('\nTo download voice notes, restart the listener and have new voice notes sent.');
                        process.exit(1);
                    }

                    console.log(`Found ${collectedMessages.length} media messages in database.`);
                }

                // Filter media by type
                let filteredMedia = [];

                if (mediaType === 'all') {
                    filteredMedia = collectedMessages.filter(msg =>
                        msg.message?.audioMessage ||
                        msg.message?.imageMessage ||
                        msg.message?.videoMessage ||
                        msg.message?.documentMessage
                    );
                } else if (mediaType === 'voice') {
                    filteredMedia = collectedMessages.filter(msg =>
                        msg.message?.audioMessage?.ptt === true
                    );
                } else if (mediaType === 'audio') {
                    filteredMedia = collectedMessages.filter(msg =>
                        msg.message?.audioMessage && !msg.message.audioMessage.ptt
                    );
                } else if (mediaType === 'image') {
                    filteredMedia = collectedMessages.filter(msg =>
                        msg.message?.imageMessage
                    );
                } else if (mediaType === 'video') {
                    filteredMedia = collectedMessages.filter(msg =>
                        msg.message?.videoMessage
                    );
                } else if (mediaType === 'document') {
                    filteredMedia = collectedMessages.filter(msg =>
                        msg.message?.documentMessage
                    );
                }

                filteredMedia = filteredMedia.slice(-count); // Get last N items

                if (filteredMedia.length === 0) {
                    console.log(`No ${mediaType === 'all' ? 'media' : mediaType} found in message history.`);
                    process.exit(0);
                }

                console.log(`Found ${filteredMedia.length} ${mediaType === 'all' ? 'media file(s)' : mediaType + '(s)'}. Downloading...\n`);

                // Create downloads directory
                const downloadsDir = path.join(__dirname, 'downloads');
                if (!fs.existsSync(downloadsDir)) {
                    fs.mkdirSync(downloadsDir, { recursive: true });
                }

                // Download each media file
                for (let i = 0; i < filteredMedia.length; i++) {
                    const msg = filteredMedia[i];
                    const timestamp = msg.messageTimestamp;
                    const date = new Date(timestamp * 1000);
                    const dateStr = date.toISOString().replace(/:/g, '-').split('.')[0];

                    try {
                        // Determine file type and extension
                        let fileType = 'unknown';
                        let extension = 'bin';
                        let caption = '';

                        if (msg.message.audioMessage) {
                            fileType = msg.message.audioMessage.ptt ? 'voicenote' : 'audio';
                            extension = 'ogg';
                        } else if (msg.message.imageMessage) {
                            fileType = 'image';
                            extension = 'jpg';
                            caption = msg.message.imageMessage.caption || '';
                        } else if (msg.message.videoMessage) {
                            fileType = 'video';
                            extension = 'mp4';
                            caption = msg.message.videoMessage.caption || '';
                        } else if (msg.message.documentMessage) {
                            fileType = 'document';
                            const originalName = msg.message.documentMessage.fileName || 'document';
                            extension = originalName.split('.').pop() || 'pdf';
                        }

                        console.log(`[${i + 1}/${filteredMedia.length}] Downloading ${fileType} from ${date.toLocaleString()}...`);
                        if (caption) console.log(`   Caption: ${caption.substring(0, 60)}${caption.length > 60 ? '...' : ''}`);

                        const buffer = await downloadMediaMessage(msg, 'buffer', {});

                        const filename = `${fileType}_${phoneNum}_${dateStr}.${extension}`;
                        const filepath = path.join(downloadsDir, filename);

                        fs.writeFileSync(filepath, buffer);

                        const sizeMB = (buffer.length / 1024 / 1024).toFixed(2);
                        console.log(`   ✓ Saved: ${filename} (${sizeMB} MB)`);

                    } catch (err) {
                        console.error(`   ✗ Failed to download: ${err.message}`);
                    }
                }

                console.log(`\n✅ Download complete! Files saved to: ${downloadsDir}\n`);
                process.exit(0);

            } catch (error) {
                console.error('Error downloading voice notes:', error.message);
                process.exit(1);
            }
        }
    });
}

// Main command router
(async () => {
    switch (command) {
        case 'listen':
            await listen();
            break;
        case 'send':
            await sendMessage(args[0], args.slice(1).join(' '));
            break;
        case 'chats':
            await listChats(parseInt(args[0]) || 20);
            break;
        case 'read':
            if (!args[0]) {
                console.log('Usage: node wa.js read <number|name>');
                process.exit(1);
            }
            await readChat(args.join(' '));
            break;
        case 'search':
            if (!args[0]) {
                console.log('Usage: node wa.js search <query>');
                process.exit(1);
            }
            await searchChats(args.join(' '));
            break;
        case 'unread':
            await showUnread();
            break;
        case 'groups':
            await listGroups();
            break;
    case 'download':
        if (!args[0]) {
            console.log('Usage: node wa.js download <number|name> [type] [count]');
            console.log('Types: voice, audio, image, video, document, all (default: all)');
            console.log('Count: default 10');
            console.log('\nExamples:');
            console.log('  node wa.js download 447435152066 voice 2');
            console.log('  node wa.js download Payal all 10');
            console.log('  node wa.js download Nick image 5');
            process.exit(1);
        }
        const mediaType = args[1] || 'all';
        const mediaCount = parseInt(args[2]) || 10;

        // Validate media type
        const validTypes = ['voice', 'audio', 'image', 'video', 'document', 'all'];
        if (!validTypes.includes(mediaType)) {
            console.log(`Invalid media type: ${mediaType}`);
            console.log(`Valid types: ${validTypes.join(', ')}`);
            process.exit(1);
        }

        await downloadMedia(args[0], mediaType, mediaCount);
            break;
        case 'help':
        default:
            console.log(help);
            process.exit(0);
    }
})();
