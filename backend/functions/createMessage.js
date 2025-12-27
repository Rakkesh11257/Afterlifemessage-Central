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
      try {
        console.log('[AUDIO DEBUG] Processing audio:', {
          audioBlobType: typeof requestBody.audioBlob,
          audioBlobLength: typeof requestBody.audioBlob === 'string' ? requestBody.audioBlob.length : 'N/A',
          audioBlobPreview: typeof requestBody.audioBlob === 'string' ? requestBody.audioBlob.substring(0, 50) : 'N/A',
          isS3Key: typeof requestBody.audioBlob === 'string' && requestBody.audioBlob.startsWith('audio/'),
          mediaMimeType: requestBody.mediaMimeType
        });
        
        // Check if audioBlob is an S3 key (from direct upload) or base64 data
        if (typeof requestBody.audioBlob === 'string' && requestBody.audioBlob.startsWith('audio/')) {
          // Already uploaded to S3, use the existing key
          message.s3Key = requestBody.audioBlob;
          message.mediaMimeType = requestBody.mediaMimeType || 'audio/webm';
          // Extract base MIME type (remove codecs) for filename extension
          const baseMimeType = (requestBody.mediaMimeType || 'audio/webm').split(';')[0].trim();
          const extension = baseMimeType.split('/')[1] || 'webm';
          message.mediaFileName = `message-${messageId}.${extension}`;
          console.log('[S3 KEY] Using existing S3 key for audio:', requestBody.audioBlob);
        } else if (typeof requestBody.audioBlob === 'string') {
          // Base64 blob, process and upload
          const mimeType = requestBody.mediaMimeType || 'audio/webm';
          let finalAudioBuffer;
          
          try {
            // Decode base64 audio
            const audioBuffer = Buffer.from(requestBody.audioBlob, 'base64');
            console.log('[AUDIO DEBUG] Decoded base64, buffer size:', audioBuffer.length);
            
            // For now, skip FFmpeg conversion (layer not available)
            // Store audio as-is (encrypted) - can be converted later if needed
            // TODO: Re-enable FFmpeg conversion when layer is available
            finalAudioBuffer = audioBuffer;
            
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
                originalMimeType: mimeType
              }
            }).promise();
            message.s3Key = s3Key;
            message.mediaMimeType = mimeType; // Keep original format
            // Extract base MIME type (remove codecs) for filename extension
            const baseMimeType = mimeType.split(';')[0].trim();
            const extension = baseMimeType.split('/')[1] || 'webm';
            message.mediaFileName = `message-${messageId}.${extension}`;
            console.log(`[S3 UPLOAD] Encrypted audio file stored for message ${messageId} (format: ${mimeType})`);
          } catch (decodeError) {
            console.error('[AUDIO ERROR] Failed to decode base64:', decodeError);
            throw new Error(`Invalid audio data format: ${decodeError.message}`);
          }
        } else {
          // audioBlob is not a string (might be an object or null)
          console.error('[AUDIO ERROR] Invalid audioBlob type:', typeof requestBody.audioBlob, requestBody.audioBlob);
          throw new Error('Audio data must be a base64 string or S3 key');
        }
      } catch (error) {
        console.error('Error processing audio:', error);
        console.error('Error stack:', error.stack);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: 'Failed to process audio file', details: error.message })
        };
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
          // Store full MIME type with codecs if present
          message.mediaMimeType = requestBody.mediaMimeType || 'video/webm';
          // Extract base MIME type (remove codecs) for filename extension
          const baseMimeType = (requestBody.mediaMimeType || 'video/webm').split(';')[0].trim();
          const extension = baseMimeType.split('/')[1] || 'webm';
          message.mediaFileName = `message-${messageId}.${extension}`;
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