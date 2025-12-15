const AWS = require('aws-sdk');
const { validateToken } = require('../utils/validation');
const { addCorsHeaders } = require('../utils/cors');

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
    
    const { messageId, mediaType, fileName, contentType } = requestBody;
    
    console.log('Generate upload URL:', {
      messageId,
      mediaType,
      fileName,
      contentType,
      userId
    });

    // Validate required parameters
    if (!messageId || !mediaType || !fileName || !contentType) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required parameters' })
      };
    }

    // Generate S3 key based on media type
    let s3Key;
    switch (mediaType) {
      case 'audio':
        s3Key = `audio/${messageId}.enc`;
        break;
      case 'video':
        s3Key = `video/${messageId}.enc`;
        break;
      case 'files':
        s3Key = `files/${messageId}/${fileName}`;
        break;
      default:
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid media type' })
        };
    }

    // Generate presigned URL for upload
    const presignedUrl = await s3.getSignedUrlPromise('putObject', {
      Bucket: process.env.S3_BUCKET,
      Key: s3Key,
      ContentType: contentType,
      Expires: 3600, // 1 hour
      Metadata: {
        messageId: messageId,
        userId: userId,
        type: mediaType,
        originalFileName: fileName
      }
    });

    console.log('[S3 PRESIGNED URL] Generated:', {
      bucket: process.env.S3_BUCKET,
      key: s3Key,
      mediaType,
      fileName
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        uploadUrl: presignedUrl,
        s3Key: s3Key,
        messageId: messageId
      })
    };

  } catch (error) {
    console.error('Error generating upload URL:', error);
    return {
      statusCode: 500,
      headers: addCorsHeaders({}),
      body: JSON.stringify({ error: 'Failed to generate upload URL' })
    };
  }
}; 