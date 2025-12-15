const AWS = require('aws-sdk');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3();

const TABLE_NAME = process.env.DYNAMODB_TABLE;
const S3_BUCKET = process.env.S3_BUCKET;

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

    // Get existing message to check ownership and get S3 key
    const existingMessage = await dynamodb.get({
      TableName: TABLE_NAME,
      Key: { messageId }
    }).promise();

    if (!existingMessage.Item) {
      return {
        statusCode: 404,
        headers: getCorsHeaders(event),
        body: JSON.stringify({
          error: 'Message not found'
        })
      };
    }

    // Check if user owns this message
    if (existingMessage.Item.userId !== userId) {
      return {
        statusCode: 403,
        headers: getCorsHeaders(event),
        body: JSON.stringify({
          error: 'Access denied'
        })
      };
    }

    // Delete from S3 if media files exist
    if (existingMessage.Item.s3Key) {
      try {
        await s3.deleteObject({
          Bucket: S3_BUCKET,
          Key: existingMessage.Item.s3Key
        }).promise();
        console.log(`Deleted S3 object: ${existingMessage.Item.s3Key}`);
      } catch (s3Error) {
        console.error('Error deleting S3 object:', s3Error);
        // Continue with deletion even if S3 deletion fails
      }
    }

    // Delete from DynamoDB
    await dynamodb.delete({
      TableName: TABLE_NAME,
      Key: { messageId }
    }).promise();

    return {
      statusCode: 200,
      headers: getCorsHeaders(event),
      body: JSON.stringify({
        message: 'Message deleted successfully'
      })
    };

  } catch (error) {
    console.error('Error deleting message:', error);
    
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