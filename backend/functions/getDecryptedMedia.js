const AWS = require('aws-sdk');
const { decryptBuffer } = require('../utils/encryption');
const { validateToken } = require('../utils/validation');
const { addCorsHeaders } = require('../utils/cors');
const jwt = require('jsonwebtoken');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3();

const LARGE_FILE_THRESHOLD = 5 * 1024 * 1024; // 5MB
const MAX_API_GATEWAY_RESPONSE_SIZE = 6 * 1024 * 1024; // 6MB

exports.handler = async (event) => {
  console.log('Received event:', JSON.stringify(event, null, 2));
  
  try {
    // Add CORS headers
    const headers = addCorsHeaders({});
    
    // Token-based public access for media links
    let userId;
    let messageId;
    let type;
    if (event.queryStringParameters && event.queryStringParameters.token) {
      // Token-based access
      const token = event.queryStringParameters.token;
      try {
        const decoded = jwt.verify(token, process.env.MEDIA_JWT_SECRET || 'media-secret-key');
        messageId = decoded.messageId;
        type = decoded.type;
        userId = null; // Public access, skip user check
        console.log('🔍 DEBUG - Token-based access for media:', { messageId, type });
      } catch (err) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ error: 'Invalid or expired token' })
        };
      }
    } else {
      // Validate JWT token (normal user access)
      const authResult = await validateToken(event);
      if (!authResult.isValid) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ error: 'Unauthorized' })
        };
      }
      userId = authResult.userId;
      messageId = (event.pathParameters || {}).messageId;
      type = (event.queryStringParameters || {}).type;
    }
    
    console.log('Query params:', { messageId, type });
    console.log('Headers:', event.headers);

    // Validate required parameters
    if (!messageId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Message ID is required' })
      };
    }

    if (!type) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Media type is required' })
      };
    }

    // Validate media type
    const validTypes = ['audio', 'video', 'files'];
    if (!validTypes.includes(type)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid media type' })
      };
    }

    // Get message from DynamoDB
    const messageResult = await dynamodb.get({
      TableName: process.env.DYNAMODB_TABLE,
      Key: { messageId }
    }).promise();

    if (!messageResult.Item) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Message not found' })
      };
    }

    const message = messageResult.Item;

    // Check if user owns this message
    if (userId && message.userId !== userId) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'Access denied' })
      };
    }

    // Check if message has the requested media type
    if (message.type !== type) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: `Message is not a ${type} message` })
      };
    }

    // Check if message has S3 key
    if (!message.s3Key) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Media not found' })
      };
    }

    // Download file from S3 (get metadata too)
    const s3Object = await s3.getObject({
      Bucket: process.env.S3_BUCKET,
      Key: message.s3Key
    }).promise();

    const fileBuffer = s3Object.Body;
    const metadata = s3Object.Metadata || {};
    let isUnencrypted = metadata.unencrypted === 'true';
    let base64Data;
    let usedDecryption = false;
    let presignedUrl = null;
    let decryptedBuffer = null; // <-- add this

    // If file is unencrypted, always return presigned URL (never base64)
    if (isUnencrypted) {
      presignedUrl = s3.getSignedUrl('getObject', {
        Bucket: process.env.S3_BUCKET,
        Key: message.s3Key,
        Expires: 60 * 10 // 10 minutes
      });
      usedDecryption = false;
      console.log('🔍 DEBUG - File marked as unencrypted in metadata, returning presigned URL.');
    } else {
      // Try to decrypt, but if it fails with 'wrong final block length', treat as unencrypted
      try {
        decryptedBuffer = decryptBuffer(fileBuffer);
        usedDecryption = true;
        console.log('🔍 DEBUG - Successfully decrypted media.');
        if (decryptedBuffer.length > LARGE_FILE_THRESHOLD) {
          // Upload decrypted file to temp S3 location
          const ext = (message.mediaFileName || '').split('.').pop() || getDefaultExtension(type);
          const tempKey = `temp-decrypted/${messageId}-${Date.now()}.${ext}`;
          await s3.putObject({
            Bucket: process.env.S3_BUCKET,
            Key: tempKey,
            Body: decryptedBuffer,
            ContentType: message.mediaMimeType || getDefaultMimeType(type),
            Metadata: {
              decrypted: 'true',
              originalmessageid: messageId
            }
          }).promise();
          presignedUrl = s3.getSignedUrl('getObject', {
            Bucket: process.env.S3_BUCKET,
            Key: tempKey,
            Expires: 60 * 10 // 10 minutes
          });
          console.log('🔍 DEBUG - Large decrypted file uploaded to temp S3, returning presigned URL.');
        } else {
          base64Data = decryptedBuffer.toString('base64');
        }
      } catch (err) {
        if (err.message && err.message.includes('wrong final block length')) {
          // Not encrypted, use presigned URL
          presignedUrl = s3.getSignedUrl('getObject', {
            Bucket: process.env.S3_BUCKET,
            Key: message.s3Key,
            Expires: 60 * 10 // 10 minutes
          });
          usedDecryption = false;
          console.log('🔍 DEBUG - File not encrypted, returning presigned URL.');
        } else {
          throw err;
        }
      }
    }

    // Handle download=true for direct file download
    if (event.queryStringParameters && event.queryStringParameters.download === 'true') {
      let downloadBuffer;
      let mimeType = message.mediaMimeType || getDefaultMimeType(type);
      let fileName = message.mediaFileName || `message-${messageId}.${getDefaultExtension(type)}`;

      // If the file is unencrypted (by metadata or by decryption error), immediately redirect for large files
      if (isUnencrypted && fileBuffer.length > MAX_API_GATEWAY_RESPONSE_SIZE) {
        const s3DownloadUrl = s3.getSignedUrl('getObject', {
          Bucket: process.env.S3_BUCKET,
          Key: message.s3Key,
          Expires: 60 * 10, // 10 minutes
          ResponseContentDisposition: `attachment; filename=\"${fileName}\"`
        });
        return {
          statusCode: 302,
          headers: {
            Location: s3DownloadUrl,
            ...headers
          },
          body: ''
        };
      }

      try {
        downloadBuffer = isUnencrypted ? fileBuffer : (usedDecryption ? decryptedBuffer : decryptBuffer(fileBuffer));
        // If the file is encrypted, decryption succeeded, and decrypted buffer is large, upload to temp S3 and redirect
        if (!isUnencrypted && usedDecryption && decryptedBuffer && decryptedBuffer.length > MAX_API_GATEWAY_RESPONSE_SIZE) {
          const ext = (message.mediaFileName || '').split('.').pop() || getDefaultExtension(type);
          const tempKey = `temp-decrypted/${messageId}-download-${Date.now()}.${ext}`;
          await s3.putObject({
            Bucket: process.env.S3_BUCKET,
            Key: tempKey,
            Body: decryptedBuffer,
            ContentType: mimeType,
            Metadata: {
              decrypted: 'true',
              originalmessageid: messageId
            }
          }).promise();
          const presignedDownloadUrl = s3.getSignedUrl('getObject', {
            Bucket: process.env.S3_BUCKET,
            Key: tempKey,
            Expires: 60 * 10,
            ResponseContentDisposition: `attachment; filename=\"${fileName}\"`
          });
          return {
            statusCode: 302,
            headers: {
              Location: presignedDownloadUrl,
              ...headers
            },
            body: ''
          };
        }
      } catch (err) {
        console.error('Error in download decryption:', err);
        if (err.message && err.message.includes('wrong final block length')) {
          // Treat as unencrypted
          isUnencrypted = true;
          // Immediately redirect for large files
          if (fileBuffer.length > MAX_API_GATEWAY_RESPONSE_SIZE) {
            const s3DownloadUrl = s3.getSignedUrl('getObject', {
              Bucket: process.env.S3_BUCKET,
              Key: message.s3Key,
              Expires: 60 * 10, // 10 minutes
              ResponseContentDisposition: `attachment; filename=\"${fileName}\"`
            });
            return {
              statusCode: 302,
              headers: {
                Location: s3DownloadUrl,
                ...headers
              },
              body: ''
            };
          }
          // For small files, return as base64
          return {
            statusCode: 200,
            headers: {
              ...headers,
              'Content-Type': mimeType,
              'Content-Disposition': `attachment; filename="${fileName}"`
            },
            isBase64Encoded: true,
            body: fileBuffer.toString('base64')
          };
        } else {
          throw err;
        }
      }

      // For small files, return as base64
      return {
        statusCode: 200,
        headers: {
          ...headers,
          'Content-Type': mimeType,
          'Content-Disposition': `attachment; filename="${fileName}"`
        },
        isBase64Encoded: true,
        body: downloadBuffer.toString('base64')
      };
    }

    // Return the media
    if (presignedUrl) {
      // Redirect for browser requests
      const acceptHeader = (event.headers && (event.headers.Accept || event.headers.accept)) || '';
      if (acceptHeader.includes('text/html')) {
        return {
          statusCode: 302,
          headers: {
            Location: presignedUrl,
            ...headers
          },
          body: ''
        };
      }
      // Default: return JSON for API clients
      return {
        statusCode: 200,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          presignedUrl,
          mediaMimeType: message.mediaMimeType || getDefaultMimeType(type),
          mediaFileName: message.mediaFileName || `message-${messageId}.${getDefaultExtension(type)}`,
          decrypted: usedDecryption
        })
      };
    } else {
      // Only for small, decrypted files
      return {
        statusCode: 200,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          mediaData: base64Data,
          mediaMimeType: message.mediaMimeType || getDefaultMimeType(type),
          mediaFileName: message.mediaFileName || `message-${messageId}.${getDefaultExtension(type)}`,
          decrypted: usedDecryption
        })
      };
    }

  } catch (error) {
    console.error('Error getting decrypted media:', error);
    if (error && error.stack) {
      console.error('Stack trace:', error.stack);
    }
    return {
      statusCode: 500,
      headers: addCorsHeaders({}),
      body: JSON.stringify({ error: 'Internal server error', details: error.message, stack: error.stack })
    };
  }
};

// Helper functions
function getDefaultMimeType(type) {
  switch (type) {
    case 'audio':
      return 'audio/webm';
    case 'video':
      return 'video/webm';
    case 'files':
      return 'application/zip';
    default:
      return 'application/octet-stream';
  }
}

function getDefaultExtension(type) {
  switch (type) {
    case 'audio':
      return 'webm';
    case 'video':
      return 'webm';
    case 'files':
      return 'zip';
    default:
      return 'bin';
  }
} 