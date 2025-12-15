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
      headers: {
        "Access-Control-Allow-Origin": event.headers?.origin || "*",
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent,X-Amzn-Trace-Id",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS,PUT,DELETE"
      },
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
    // Get user ID from Cognito
    const userId = event.requestContext.authorizer.claims.sub;

    // Query messages for this user
    const queryParams = {
      TableName: TABLE_NAME,
      IndexName: 'UserIdIndex',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      }
    };

    let result;
    try {
      result = await dynamodb.query(queryParams).promise();
    } catch (error) {
      console.error('Error querying messages:', error);
      
      // If GSI is not ready, try scanning (fallback)
      if (error.code === 'ResourceNotFoundException' || error.message.includes('Index')) {
        console.log('GSI not ready, trying scan...');
        const scanParams = {
          TableName: TABLE_NAME,
          FilterExpression: 'userId = :userId',
          ExpressionAttributeValues: {
            ':userId': userId
          }
        };
        result = await dynamodb.scan(scanParams).promise();
      } else {
        throw error;
      }
    }
    
    // Format messages for frontend (remove sensitive data)
    const messages = result.Items.map(message => {
      let decryptedContent = null;
      
      // Decrypt text content if it exists
      if (message.type === 'text' && message.content) {
        try {
          decryptedContent = decryptText(message.content);
        } catch (error) {
          console.error('Error decrypting content:', error);
          decryptedContent = '[Content could not be decrypted]';
        }
      }
      
      return {
        messageId: message.messageId,
        type: message.type,
        content: decryptedContent,
        recipientEmail: message.recipientEmail,
        recipientMobile: message.recipientMobile,
        deliveryType: message.deliveryType,
        deliveryMethods: message.deliveryMethods,
        triggerValue: message.triggerValue,
        deliveryDate: message.deliveryDate,
        isPaid: message.isPaid,
        delivered: message.delivered,
        status: message.status,
        createdAt: message.createdAt,
        updatedAt: message.updatedAt,
        s3Key: message.s3Key // Keep for media access
      };
    });

    return {
      statusCode: 200,
      headers: getCorsHeaders(event),
      body: JSON.stringify({
        messages: messages
      })
    };

  } catch (error) {
    console.error('Error getting messages:', error);
    
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