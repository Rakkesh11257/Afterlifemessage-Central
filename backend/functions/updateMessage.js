const AWS = require('aws-sdk');
const { encryptBuffer } = require('../utils/encryption');
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
    const { messageId } = event.pathParameters || {};
    
    // Handle base64 encoded body
    let requestBody;
    if (event.isBase64Encoded) {
      const decodedBody = Buffer.from(event.body, 'base64').toString('utf-8');
      requestBody = JSON.parse(decodedBody);
    } else {
      requestBody = JSON.parse(event.body);
    }
    
    console.log('Update message data:', {
      messageId,
      type: requestBody.type,
      recipientEmail: requestBody.recipientEmail,
      deliveryType: requestBody.deliveryType,
      triggerValue: requestBody.triggerValue,
      hasContent: !!requestBody.content,
      hasAudioBlob: !!requestBody.audioBlob,
      hasVideoBlob: !!requestBody.videoBlob,
      mediaMimeType: requestBody.mediaMimeType
    });

    // Validate required parameters
    if (!messageId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Message ID is required' })
      };
    }

    // Get existing message
    const existingMessageResult = await dynamodb.get({
      TableName: process.env.DYNAMODB_TABLE,
      Key: { messageId }
    }).promise();

    if (!existingMessageResult.Item) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Message not found' })
      };
    }

    const existingMessage = existingMessageResult.Item;

    // Check if user owns this message
    if (existingMessage.userId !== userId) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'Access denied' })
      };
    }

    // Validate required fields
    if (!requestBody.recipientEmail || !requestBody.deliveryType || !requestBody.triggerValue) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required fields' })
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

    // Prepare update data
    const updateData = {
      recipientEmail: requestBody.recipientEmail,
      recipientMobile: requestBody.recipientMobile || null,
      deliveryType: requestBody.deliveryType,
      deliveryMethods: requestBody.deliveryMethods || ['email'],
      triggerValue: requestBody.triggerValue,
      deliveryDate: requestBody.deliveryType === 'date' ? requestBody.triggerValue : null,
      inactivityMonths: requestBody.deliveryType === 'inactivity' ? parseInt(requestBody.triggerValue) : null,
      updatedAt: new Date().toISOString(),
      // Always retain these important fields
      delivered: existingMessage.delivered ?? false,
      isPaid: existingMessage.isPaid ?? false,
      deliveryStatus: existingMessage.deliveryStatus ?? 'pending',
      status: existingMessage.status ?? 'pending'
    };

    // Handle content updates for text messages
    if (existingMessage.type === 'text') {
      if (!requestBody.content) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Text message requires content' })
        };
      }
      updateData.content = requestBody.content;
      updateData.message = requestBody.content;
    }

    // Handle media updates
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
        updateData.s3Key = s3Key;
        updateData.mediaMimeType = 'audio/mp3';
        updateData.mediaFileName = `message-${messageId}.mp3`;
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

    if (existingMessage.type === 'video' && requestBody.videoBlob) {
      try {
        // Check if it's a base64 blob or S3 key
        if (requestBody.videoBlob.startsWith('audio/') || requestBody.videoBlob.startsWith('video/')) {
          // It's an S3 key from direct upload
          updateData.s3Key = requestBody.videoBlob;
          updateData.mediaMimeType = requestBody.mediaMimeType || 'video/webm';
          updateData.mediaFileName = `message-${messageId}.${(requestBody.mediaMimeType || 'video/webm').split('/')[1]}`;
          
          console.log('[S3 KEY] Using existing S3 key for video:', requestBody.videoBlob);
        } else {
          // It's a base64 blob, encrypt and upload
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

          updateData.s3Key = s3Key;
          updateData.mediaMimeType = requestBody.mediaMimeType || 'video/webm';
          updateData.mediaFileName = `message-${messageId}.${(requestBody.mediaMimeType || 'video/webm').split('/')[1]}`;

          console.log('[S3 UPLOAD] Updated encrypted video file', {
            bucket: process.env.S3_BUCKET,
            key: s3Key,
            size: encryptedVideo.length,
            mediaMimeType: updateData.mediaMimeType
          });
        }
      } catch (error) {
        console.error('Error processing video update:', error);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: 'Failed to process video file' })
        };
      }
    }



    // Update message in DynamoDB
    const updateExpression = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};

    Object.keys(updateData).forEach((key, index) => {
      const attrName = `#attr${index}`;
      const attrValue = `:val${index}`;
      
      updateExpression.push(`${attrName} = ${attrValue}`);
      expressionAttributeNames[attrName] = key;
      expressionAttributeValues[attrValue] = updateData[key];
    });

    await dynamodb.update({
      TableName: process.env.DYNAMODB_TABLE,
      Key: { messageId },
      UpdateExpression: `SET ${updateExpression.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues
    }).promise();

    console.log('Message updated successfully:', messageId);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        messageId,
        message: 'Message updated successfully'
      })
    };

  } catch (error) {
    console.error('Error updating message:', error);
    return {
      statusCode: 500,
      headers: addCorsHeaders({}),
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};