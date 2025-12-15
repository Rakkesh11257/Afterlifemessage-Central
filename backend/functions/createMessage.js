const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const { encryptBuffer, encryptText } = require('../utils/encryption');
const { validateToken } = require('../utils/validation');
const { addCorsHeaders } = require('../utils/cors');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3();

exports.handler = async (event) => {
  console.log('Received event:', JSON.stringify(event, null, 2));
  
  try {
    // Add CORS headers
    const headers = addCorsHeaders({});
    
    // Validate JWT token
    const authResult = await validateToken(event);
    if (!authResult.isValid) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Unauthorized' })
      };
    }
    
    const userId = authResult.userId;
    
    // Handle base64 encoded body
    let requestBody;
    if (event.isBase64Encoded) {
      const decodedBody = Buffer.from(event.body, 'base64').toString('utf-8');
      requestBody = JSON.parse(decodedBody);
    } else {
      requestBody = JSON.parse(event.body);
    }
    
    console.log('Received message data:', {
      type: requestBody.type,
      recipientEmail: requestBody.recipientEmail,
      deliveryType: requestBody.deliveryType,
      triggerValue: requestBody.triggerValue,
      hasContent: !!requestBody.content,
      hasAudioBlob: !!requestBody.audioBlob,
      hasVideoBlob: !!requestBody.videoBlob,
      hasFiles: !!requestBody.files,
      fileCount: requestBody.files?.length || 0,
      mediaMimeType: requestBody.mediaMimeType
    });

    // Validate required fields
    if (!requestBody.type || !requestBody.recipientEmail || !requestBody.deliveryType || !requestBody.triggerValue) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required fields' })
      };
    }

    // Validate message type
    const validTypes = ['text', 'audio', 'video', 'files'];
    if (!validTypes.includes(requestBody.type)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid message type' })
      };
    }

    // Validate delivery type
    const validDeliveryTypes = ['date', 'inactivity'];
    if (!validDeliveryTypes.includes(requestBody.deliveryType)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid delivery type' })
      };
    }

    // Validate content based on type
    if (requestBody.type === 'text' && !requestBody.content) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Text message requires content' })
      };
    }

    if (requestBody.type === 'audio' && !requestBody.audioBlob) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Audio message requires audio data' })
      };
    }

    if (requestBody.type === 'video' && !requestBody.videoBlob) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Video message requires video data' })
      };
    }

    if (requestBody.type === 'files' && (!requestBody.files || requestBody.files.length === 0)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Files message requires file data' })
      };
    }

    const messageId = uuidv4();
    const timestamp = new Date().toISOString();
    
    // Create message object
    const message = {
      messageId,
      userId,
      type: requestBody.type,
      content: requestBody.type === 'text' && requestBody.content
        ? encryptText(requestBody.content)
        : requestBody.content || null,
      recipientEmail: requestBody.recipientEmail,
      recipientMobile: requestBody.recipientMobile || null,
      deliveryType: requestBody.deliveryType,
      deliveryMethods: requestBody.deliveryMethods || ['email'],
      triggerValue: requestBody.triggerValue,
      deliveryDate: requestBody.deliveryType === 'date' ? requestBody.triggerValue : null,
      inactivityMonths: requestBody.deliveryType === 'inactivity' ? parseInt(requestBody.triggerValue) : null,
      status: 'pending',
      isPaid: false,
      deliveryStatus: 'pending',
      delivered: false, // <-- add this line
      createdAt: timestamp,
      updatedAt: timestamp,
      message: requestBody.message || `${requestBody.type} message`
    };

    // Handle media encryption and S3 upload
    if (requestBody.type === 'audio' && requestBody.audioBlob) {
      let tempInputPath, tempOutputPath, finalAudioBuffer;
      try {
        // Accept any audio format, convert to MP3 if needed
        const mimeType = requestBody.mediaMimeType || 'audio/webm';
        tempInputPath = `/tmp/input-audio-${messageId}`;
        tempOutputPath = `/tmp/output-audio-${messageId}.mp3`;
        // Write input audio to /tmp
        fs.writeFileSync(tempInputPath, Buffer.from(requestBody.audioBlob, 'base64'));
        if (mimeType !== 'audio/mp3') {
          // Convert to MP3 using FFmpeg Lambda Layer
          console.log(`[FFMPEG] Converting ${mimeType} to MP3 for message ${messageId}`);
          await new Promise((resolve, reject) => {
            const ffmpeg = spawn('/opt/ffmpeg/ffmpeg', [
              '-y',
              '-i', tempInputPath,
              '-f', 'mp3',
              tempOutputPath
            ]);
            ffmpeg.stdout && ffmpeg.stdout.on('data', (data) => console.log(`[FFMPEG STDOUT] ${data}`));
            ffmpeg.stderr && ffmpeg.stderr.on('data', (data) => console.error(`[FFMPEG STDERR] ${data}`));
            ffmpeg.on('close', (code) => code === 0 ? resolve() : reject(new Error('FFmpeg failed with code ' + code)));
          });
          finalAudioBuffer = fs.readFileSync(tempOutputPath);
        } else {
          // Already MP3, no conversion needed
          finalAudioBuffer = fs.readFileSync(tempInputPath);
        }
        // Encrypt and upload to S3
        const encryptedAudio = encryptBuffer(finalAudioBuffer);
        const s3Key = `audio/${messageId}.enc`;
        await s3.putObject({
          Bucket: process.env.S3_BUCKET,
          Key: s3Key,
          Body: encryptedAudio,
          ContentType: 'application/octet-stream',
          Metadata: {
            messageId: messageId,
            type: 'audio',
            originalMimeType: 'audio/mp3'
          }
        }).promise();
        message.s3Key = s3Key;
        message.mediaMimeType = 'audio/mp3';
        message.mediaFileName = `message-${messageId}.mp3`;
        console.log(`[S3 UPLOAD] Encrypted MP3 audio file stored for message ${messageId}`);
      } catch (error) {
        console.error('Error processing audio:', error);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: 'Failed to process audio file', details: error.message })
        };
      } finally {
        // Clean up temp files
        try { if (tempInputPath) fs.unlinkSync(tempInputPath); } catch (e) { console.warn('Failed to clean up input temp file:', e.message); }
        try { if (tempOutputPath && fs.existsSync(tempOutputPath)) fs.unlinkSync(tempOutputPath); } catch (e) { console.warn('Failed to clean up output temp file:', e.message); }
      }
    }

    if (requestBody.type === 'video' && requestBody.videoBlob) {
      try {
        if (typeof requestBody.videoBlob === 'string' && (requestBody.videoBlob.startsWith('audio/') || requestBody.videoBlob.startsWith('video/'))) {
          // S3 key from direct upload
          message.s3Key = requestBody.videoBlob;
          message.mediaMimeType = requestBody.mediaMimeType || 'video/webm';
          message.mediaFileName = `message-${messageId}.${(requestBody.mediaMimeType || 'video/webm').split('/')[1]}`;
          console.log('[S3 KEY] Using existing S3 key for video:', requestBody.videoBlob);
        } else {
          // base64 blob, encrypt and upload
          const videoBuffer = Buffer.from(requestBody.videoBlob, 'base64');
          const encryptedVideo = encryptBuffer(videoBuffer);
          const s3Key = `video/${messageId}.enc`;
          await s3.putObject({
            Bucket: process.env.S3_BUCKET,
            Key: s3Key,
            Body: encryptedVideo,
            ContentType: 'application/octet-stream',
            Metadata: {
              messageId: messageId,
              type: 'video',
              originalMimeType: requestBody.mediaMimeType || 'video/webm'
            }
          }).promise();
          message.s3Key = s3Key;
          message.mediaMimeType = requestBody.mediaMimeType || 'video/webm';
          message.mediaFileName = `message-${messageId}.${(requestBody.mediaMimeType || 'video/webm').split('/')[1]}`;
          console.log('[S3 UPLOAD] Encrypted video file stored', {
            bucket: process.env.S3_BUCKET,
            key: s3Key,
            contentType: 'application/octet-stream',
            size: encryptedVideo.length,
            mediaMimeType: message.mediaMimeType
          });
        }
      } catch (error) {
        console.error('Error processing video:', error);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: 'Failed to process video file' })
        };
      }
    }

    if (requestBody.type === 'files' && requestBody.files && requestBody.files.length > 0) {
      try {
        const filesData = [];
        for (let i = 0; i < requestBody.files.length; i++) {
          const file = requestBody.files[i];
          if (file.s3Key) {
            // Already uploaded to S3
            filesData.push({
              name: file.name,
              s3Key: file.s3Key,
              size: file.size,
              type: file.type
            });
            console.log('[S3 KEY] Using existing S3 key for file:', file.s3Key);
          } else {
            // base64, encrypt and upload
            const fileBuffer = Buffer.from(file.data, 'base64');
            const encryptedFile = encryptBuffer(fileBuffer);
            const fileS3Key = `files/${messageId}/${i}_${file.name}`;
            await s3.putObject({
              Bucket: process.env.S3_BUCKET,
              Key: fileS3Key,
              Body: encryptedFile,
              ContentType: 'application/octet-stream',
              Metadata: {
                messageId: messageId,
                type: 'file',
                fileName: file.name,
                originalMimeType: file.type
              }
            }).promise();
            filesData.push({
              name: file.name,
              s3Key: fileS3Key,
              size: file.size,
              type: file.type
            });
            console.log('[S3 UPLOAD] Encrypted file stored', {
              bucket: process.env.S3_BUCKET,
              key: fileS3Key,
              contentType: 'application/octet-stream',
              size: encryptedFile.length,
              fileName: file.name
            });
          }
        }
        message.files = filesData;
        message.mediaMimeType = 'application/zip';
        message.mediaFileName = `files-${messageId}.zip`;
      } catch (error) {
        console.error('Error processing files:', error);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: 'Failed to process files' })
        };
      }
    }

    // Ensure all required fields are present before saving
    message.delivered = message.delivered ?? false;
    message.isPaid = message.isPaid ?? false;
    message.deliveryStatus = message.deliveryStatus ?? 'pending';
    message.status = message.status ?? 'pending';
    // Save to DynamoDB
    await dynamodb.put({
      TableName: process.env.DYNAMODB_TABLE,
      Item: message
    }).promise();

    console.log('Message created successfully:', messageId);

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        messageId,
        message: 'Message created successfully'
      })
    };

  } catch (error) {
    console.error('Error creating message:', error);
    return {
      statusCode: 500,
      headers: addCorsHeaders({}),
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
}; 