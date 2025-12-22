#!/usr/bin/env node

/**
 * Upload contacts.json and create scheduled.json in S3
 * Part of Phase 1 - S3 Data Upload
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

async function uploadContactsToS3() {
    // Initialize S3 client
    const client = new S3Client({
        endpoint: process.env.B2_S3_ENDPOINT,
        region: 'eu-central-003',
        credentials: {
            accessKeyId: process.env.B2_ACCESS_KEY_ID,
            secretAccessKey: process.env.B2_SECRET_ACCESS_KEY
        }
    });

    console.log('🚀 Starting S3 upload process...\n');

    // 1. Upload contacts.json
    const contactsPath = path.join(__dirname, '..', 'contacts.json');

    if (!fs.existsSync(contactsPath)) {
        console.log('❌ contacts.json not found at:', contactsPath);
        process.exit(1);
    }

    const contactsContent = fs.readFileSync(contactsPath, 'utf8');
    const contacts = JSON.parse(contactsContent);
    const contactCount = Object.keys(contacts).length;
    const contactsSizeKB = (Buffer.byteLength(contactsContent) / 1024).toFixed(2);

    console.log(`📤 Uploading contacts.json...`);
    console.log(`   ${contactCount} contacts, ${contactsSizeKB} KB`);

    try {
        const contactsCommand = new PutObjectCommand({
            Bucket: process.env.B2_BUCKET,
            Key: `${process.env.B2_PREFIX}contacts.json`,
            Body: contactsContent,
            ContentType: 'application/json'
        });

        await client.send(contactsCommand);
        console.log(`✅ Uploaded contacts.json to S3`);
        console.log(`   ${contactCount} contacts uploaded\n`);
    } catch (error) {
        console.error('❌ Failed to upload contacts.json:', error.message);
        process.exit(1);
    }

    // 2. Create and upload scheduled.json
    console.log(`📤 Creating scheduled.json...`);

    const scheduledData = {
        messages: []
    };

    const scheduledContent = JSON.stringify(scheduledData, null, 2);

    try {
        const scheduledCommand = new PutObjectCommand({
            Bucket: process.env.B2_BUCKET,
            Key: `${process.env.B2_PREFIX}scheduled.json`,
            Body: scheduledContent,
            ContentType: 'application/json'
        });

        await client.send(scheduledCommand);
        console.log(`✅ Uploaded scheduled.json to S3`);
        console.log(`   Empty scheduled messages queue created\n`);
    } catch (error) {
        console.error('❌ Failed to upload scheduled.json:', error.message);
        process.exit(1);
    }

    // Success summary
    console.log('✨ All done! S3 bucket ready for WhatsApp Scheduler\n');
    console.log('📋 S3 Structure:');
    console.log(`   ${process.env.B2_BUCKET}/${process.env.B2_PREFIX}`);
    console.log('   ├── chats.json (existing)');
    console.log(`   ├── contacts.json (${contactCount} contacts)`);
    console.log('   └── scheduled.json (empty queue)\n');
}

uploadContactsToS3().catch(error => {
    console.error('❌ Error:', error.message);
    process.exit(1);
});
