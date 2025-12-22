#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

async function uploadToS3() {
    const localPath = path.join(__dirname, 'backups', 'chats.json');

    if (!fs.existsSync(localPath)) {
        console.log('❌ No local chats.json found at:', localPath);
        process.exit(1);
    }

    const client = new S3Client({
        endpoint: process.env.B2_S3_ENDPOINT,
        region: 'eu-central-003',
        credentials: {
            accessKeyId: process.env.B2_ACCESS_KEY_ID,
            secretAccessKey: process.env.B2_SECRET_ACCESS_KEY
        }
    });

    const fileContent = fs.readFileSync(localPath, 'utf8');
    const fileSizeMB = (Buffer.byteLength(fileContent) / 1024 / 1024).toFixed(2);

    console.log(`📤 Uploading chats.json (${fileSizeMB} MB) to S3...`);

    const command = new PutObjectCommand({
        Bucket: process.env.B2_BUCKET,
        Key: `${process.env.B2_PREFIX}chats.json`,
        Body: fileContent,
        ContentType: 'application/json'
    });

    try {
        await client.send(command);
        console.log(`✅ Successfully uploaded to s3://${process.env.B2_BUCKET}/${process.env.B2_PREFIX}chats.json`);
        console.log(`   Size: ${fileSizeMB} MB`);
    } catch (error) {
        console.error('❌ Upload failed:', error.message);
        process.exit(1);
    }
}

uploadToS3();
