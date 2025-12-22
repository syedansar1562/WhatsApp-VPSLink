const fs = require('fs');
const path = require('path');
require('dotenv').config();

// S3 client (only loaded if S3 mode is enabled)
let S3Client, GetObjectCommand, PutObjectCommand;
if (process.env.STORAGE_MODE === 's3') {
    const AWS = require('@aws-sdk/client-s3');
    S3Client = AWS.S3Client;
    GetObjectCommand = AWS.GetObjectCommand;
    PutObjectCommand = AWS.PutObjectCommand;
}

class ChatStore {
    constructor() {
        this.storageMode = process.env.STORAGE_MODE || 'local';
        this.storePath = path.join(__dirname, '..', 'backups', 'chats.json');

        // S3 configuration
        if (this.storageMode === 's3') {
            this.s3Client = new S3Client({
                endpoint: process.env.B2_S3_ENDPOINT,
                region: 'eu-central-003', // Backblaze region
                credentials: {
                    accessKeyId: process.env.B2_ACCESS_KEY_ID,
                    secretAccessKey: process.env.B2_SECRET_ACCESS_KEY
                }
            });
            this.bucket = process.env.B2_BUCKET;
            this.s3Key = `${process.env.B2_PREFIX}chats.json`;
        }

        this.chats = {};
        this.saveTimeout = null;
        this.isDirty = false;
        this.initialized = false;
    }

    async init() {
        if (!this.initialized) {
            this.chats = await this.load();
            this.initialized = true;
        }
        return this;
    }

    async load() {
        if (this.storageMode === 's3') {
            return await this.loadFromS3();
        } else {
            return this.loadFromLocal();
        }
    }

    loadFromLocal() {
        try {
            if (fs.existsSync(this.storePath)) {
                const data = fs.readFileSync(this.storePath, 'utf8');
                return JSON.parse(data);
            }
        } catch (error) {
            console.error('Error loading chat store from local:', error.message);
        }
        return {};
    }

    async loadFromS3() {
        try {
            const command = new GetObjectCommand({
                Bucket: this.bucket,
                Key: this.s3Key
            });

            const response = await this.s3Client.send(command);
            const data = await response.Body.transformToString();
            console.log('✓ Loaded chats.json from S3');
            return JSON.parse(data);
        } catch (error) {
            if (error.name === 'NoSuchKey') {
                console.log('⚠ chats.json not found in S3, starting fresh');
                return {};
            }
            console.error('Error loading chat store from S3:', error.message);
            return {};
        }
    }

    async save() {
        if (this.storageMode === 's3') {
            await this.saveToS3();
        } else {
            this.saveToLocal();
        }
    }

    saveToLocal() {
        try {
            const dir = path.dirname(this.storePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(this.storePath, JSON.stringify(this.chats, null, 2));
            this.isDirty = false;
        } catch (error) {
            console.error('Error saving chat store to local:', error.message);
        }
    }

    async saveToS3() {
        try {
            const command = new PutObjectCommand({
                Bucket: this.bucket,
                Key: this.s3Key,
                Body: JSON.stringify(this.chats, null, 2),
                ContentType: 'application/json'
            });

            await this.s3Client.send(command);
            this.isDirty = false;
            console.log('✓ Saved chats.json to S3');
        } catch (error) {
            console.error('Error saving chat store to S3:', error.message);
        }
    }

    // Debounced save - batches rapid saves
    debouncedSave() {
        this.isDirty = true;
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }
        this.saveTimeout = setTimeout(() => {
            if (this.isDirty) {
                this.save();
            }
        }, 1000); // Save once per second max
    }

    addMessage(chatId, message, timestamp, isFromMe, messageType = 'text', rawMessage = null) {
        if (!this.chats[chatId]) {
            this.chats[chatId] = {
                id: chatId,
                messages: [],
                lastMessageTime: timestamp,
                unreadCount: 0,
                name: null,
                isGroup: chatId.includes('@g.us')
            };
        }

        const msgData = {
            message,
            timestamp,
            isFromMe,
            messageType,
            date: new Date(timestamp * 1000).toISOString()
        };

        // Store raw message object for media messages (voice notes, images, etc.)
        if (rawMessage && (messageType === 'audio' || messageType === 'image' || messageType === 'video' || messageType === 'document')) {
            msgData.rawMessage = rawMessage;
        }

        this.chats[chatId].messages.push(msgData);

        this.chats[chatId].lastMessageTime = timestamp;

        if (!isFromMe) {
            this.chats[chatId].unreadCount++;
        }

        this.debouncedSave(); // Use debounced save instead of immediate
    }

    markAsRead(chatId) {
        if (this.chats[chatId]) {
            this.chats[chatId].unreadCount = 0;
            this.save();
        }
    }

    setName(chatId, name) {
        if (this.chats[chatId]) {
            this.chats[chatId].name = name;
            this.save();
        }
    }

    getAllChats() {
        return Object.values(this.chats).sort((a, b) =>
            b.lastMessageTime - a.lastMessageTime
        );
    }

    getChat(chatId) {
        return this.chats[chatId];
    }

    searchChats(query) {
        const lowerQuery = query.toLowerCase();
        return Object.values(this.chats).filter(chat => {
            const nameMatch = chat.name && chat.name.toLowerCase().includes(lowerQuery);
            const idMatch = chat.id.includes(query);
            return nameMatch || idMatch;
        });
    }

    getUnreadChats() {
        return Object.values(this.chats)
            .filter(chat => chat.unreadCount > 0)
            .sort((a, b) => b.lastMessageTime - a.lastMessageTime);
    }
}

module.exports = ChatStore;
