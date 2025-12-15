const AWS = require('aws-sdk');
const { decryptText } = require('../utils/encryption');

const dynamodb = new AWS.DynamoDB.DocumentClient();

const TABLE_NAME = process.env.DYNAMODB_TABLE;

// Dynamic CORS headers function
function getCorsHeaders(event) {
  const allowedOriginPatterns = [
    /^http:\/\/localhost:\d+$/, // any localhost port
    /^https?:\/\/afterlifemessage-frontend-(dev|prod)\.s3-website\.ap-south-1\.amazonaws\.com$/
  ];
  
  const origin = event.headers?.origin || event.headers?.Origin;
  const isAllowed = allowedOriginPatterns.some(pattern => pattern.test(origin));
  
  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : "",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent,X-Amzn-Trace-Id",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS,PUT,DELETE"
  };
}

exports.handler = async (event) => {
  // Safe check for authorizer claims
  if (
    !event.requestContext ||
    !event.requestContext.authorizer ||
    !event.requestContext.authorizer.claims
  ) {
    return {
      statusCode: 401,
      headers: getCorsHeaders(event),
      body: JSON.stringify({ error: 'Unauthorized: No authorizer claims found' })
    };
  }
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: getCorsHeaders(event),
      body: ''
    };
  }
  try {
    // Get message ID from path parameters
    const messageId = event.pathParameters?.messageId;
    
    if (!messageId) {
      return {
        statusCode: 400,
        headers: getCorsHeaders(event),
        body: JSON.stringify({
          error: 'Message ID is required'
        })
      };
    }

    // Get user ID from Cognito
    const userId = event.requestContext.authorizer.claims.sub;

    // Get message from DynamoDB
    const result = await dynamodb.get({
      TableName: TABLE_NAME,
      Key: { messageId }
    }).promise();

    if (!result.Item) {
      return {
        statusCode: 404,
        headers: getCorsHeaders(event),
        body: JSON.stringify({
          error: 'Message not found'
        })
      };
    }

    // Check if user owns this message
    if (result.Item.userId !== userId) {
      return {
        statusCode: 403,
        headers: getCorsHeaders(event),
        body: JSON.stringify({
          error: 'Access denied'
        })
      };
    }

    // For text messages, decrypt the content
    let decryptedContent = null;
    if (result.Item.type === 'text' && result.Item.content) {
      try {
        decryptedContent = decryptText(result.Item.content);
      } catch (error) {
        console.error('Error decrypting content:', error);
        decryptedContent = '[Content could not be decrypted]';
      }
    }

    // Format message for frontend
    const message = {
      messageId: result.Item.messageId,
      type: result.Item.type,
      content: decryptedContent,
      recipientEmail: result.Item.recipientEmail,
      recipientMobile: result.Item.recipientMobile,
      deliveryType: result.Item.deliveryType,
      deliveryMethods: result.Item.deliveryMethods,
      triggerValue: result.Item.triggerValue,
      deliveryDate: result.Item.deliveryDate,
      inactivityMonths: result.Item.inactivityMonths, // <-- add this line
      isPaid: result.Item.isPaid,
      delivered: result.Item.delivered,
      status: result.Item.status,
      createdAt: result.Item.createdAt,
      updatedAt: result.Item.updatedAt,
      s3Key: result.Item.s3Key
    };

    return {
      statusCode: 200,
      headers: getCorsHeaders(event),
      body: JSON.stringify({
        message: message
      })
    };

  } catch (error) {
    console.error('Error getting message:', error);
    
    return {
      statusCode: 500,
      headers: getCorsHeaders(event),
      body: JSON.stringify({
        error: 'Internal server error',
        details: error.message
      })
    };
  }
}; 