const AWS = require('aws-sdk');

const dynamodb = new AWS.DynamoDB.DocumentClient();

const USERS_TABLE = process.env.USERS_TABLE;

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
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: getCorsHeaders(event),
      body: ''
    };
  }

  // Support both API Gateway and Cognito PostConfirmation events
  let userId, userEmail;
  if (
    event.requestContext &&
    event.requestContext.authorizer &&
    event.requestContext.authorizer.claims
  ) {
    // API Gateway event
    userId = event.requestContext.authorizer.claims.sub;
    userEmail = event.requestContext.authorizer.claims.email;
  } else if (
    event.request &&
    event.request.userAttributes
  ) {
    // Cognito PostConfirmation event
    userId = event.request.userAttributes.sub;
    userEmail = event.request.userAttributes.email;
  } else {
    return {
      statusCode: 401,
      headers: getCorsHeaders(event),
      body: JSON.stringify({ error: 'Unauthorized: No user identity found' })
    };
  }

  const now = new Date().toISOString();

  // Update user's last activity
  const updateParams = {
    TableName: USERS_TABLE,
    Key: {
      userId: userId
    },
    UpdateExpression: 'SET lastActive = :lastActive, updatedAt = :updatedAt',
    ExpressionAttributeValues: {
      ':lastActive': now,
      ':updatedAt': now
    }
  };

  // If user doesn't exist, create the record
  try {
    await dynamodb.update(updateParams).promise();
  } catch (error) {
    if (error.code === 'ValidationException') {
      // User doesn't exist, create new user record
      const createParams = {
        TableName: USERS_TABLE,
        Item: {
          userId: userId,
          email: userEmail,
          lastActive: now,
          createdAt: now,
          updatedAt: now
        }
      };
      await dynamodb.put(createParams).promise();
    } else {
      throw error;
    }
  }

  return {
    statusCode: 200,
    headers: getCorsHeaders(event),
    body: JSON.stringify({
      message: 'User activity updated successfully',
      lastActive: now
    })
  };

}; 