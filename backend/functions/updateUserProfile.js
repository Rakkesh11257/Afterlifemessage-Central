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
    // Get user ID from Cognito
    const userId = event.requestContext.authorizer.claims.sub;

    // Robustly parse the request body
    let body;
    if (typeof event.body === 'string') {
      try {
        body = JSON.parse(event.body);
      } catch (parseError) {
        console.error('Malformed JSON body:', event.body);
        return {
          statusCode: 400,
          headers: getCorsHeaders(event),
          body: JSON.stringify({
            error: 'Malformed JSON in request body',
            details: parseError.message
          })
        };
      }
    } else if (typeof event.body === 'object' && event.body !== null) {
      body = event.body;
    } else {
      body = {};
    }
    console.log('Parsed body:', body);
    const { displayName, phoneNumber, preferences } = body;

    // Check if user exists
    const getParams = {
      TableName: USERS_TABLE,
      Key: { userId }
    };
    const userResult = await dynamodb.get(getParams).promise();
    if (!userResult.Item) {
      // User doesn't exist, create them with all available fields
      const now = new Date().toISOString();
      const userEmail = event.requestContext.authorizer.claims.email;
      const newUser = {
        userId,
        email: userEmail,
        displayName: displayName || null,
        name: displayName || null, // Store as both displayName and name
        phoneNumber: phoneNumber || null,
        lastActive: now,
        createdAt: now,
        updatedAt: now
      };
      await dynamodb.put({ TableName: USERS_TABLE, Item: newUser }).promise();
      return {
        statusCode: 200,
        headers: getCorsHeaders(event),
        body: JSON.stringify(newUser)
      };
    }

    // Update user profile
    const updateParams = {
      TableName: USERS_TABLE,
      Key: { userId },
      UpdateExpression: 'SET updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':updatedAt': new Date().toISOString()
      }
    };

    // Add optional fields if provided
    if (displayName) {
      updateParams.UpdateExpression += ', displayName = :displayName';
      updateParams.ExpressionAttributeValues[':displayName'] = displayName;
    }

    if (phoneNumber) {
      updateParams.UpdateExpression += ', phoneNumber = :phoneNumber';
      updateParams.ExpressionAttributeValues[':phoneNumber'] = phoneNumber;
    }

    if (preferences) {
      updateParams.UpdateExpression += ', preferences = :preferences';
      updateParams.ExpressionAttributeValues[':preferences'] = preferences;
    }
    console.log('Final updateParams:', updateParams);

    await dynamodb.update(updateParams).promise();

    return {
      statusCode: 200,
      headers: getCorsHeaders(event),
      body: JSON.stringify({
        message: 'User profile updated successfully'
      })
    };

  } catch (error) {
    console.error('Error updating user profile:', error);
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