const AWS = require('aws-sdk');
const { getCorsHeaders } = require('../utils/cors');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const cognito = new AWS.CognitoIdentityServiceProvider();

const USERS_TABLE = process.env.USERS_TABLE;
const USER_POOL_ID = 'ap-south-1_AYpQVjJlV';

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
    const userEmail = event.requestContext.authorizer.claims.email;

    // Get user profile from DynamoDB
    const getParams = {
      TableName: USERS_TABLE,
      Key: {
        userId: userId
      }
    };

    const result = await dynamodb.get(getParams).promise();
    
    if (!result.Item) {
      // User doesn't exist in our table yet, create them
      const now = new Date().toISOString();
      let displayName = null;
      let phoneNumber = null;
      try {
        const cognitoUser = await cognito.adminGetUser({
          UserPoolId: USER_POOL_ID,
          Username: userId
        }).promise();
        // Find the name attribute
        const nameAttribute = cognitoUser.User.Attributes.find(attr => attr.Name === 'name');
        if (nameAttribute) {
          displayName = nameAttribute.Value;
        }
        // Find the phone_number attribute
        const phoneAttr = cognitoUser.User.Attributes.find(attr => attr.Name === 'phone_number');
        if (phoneAttr) {
          phoneNumber = phoneAttr.Value;
        }
      } catch (error) {
        console.error('Error getting Cognito user details:', error);
      }
      const createParams = {
        TableName: USERS_TABLE,
        Item: {
          userId: userId,
          email: userEmail,
          displayName: displayName,
          phoneNumber: phoneNumber,
          lastActive: now,
          createdAt: now,
          updatedAt: now
        }
      };
      await dynamodb.put(createParams).promise();
      return {
        statusCode: 200,
        headers: getCorsHeaders(event),
        body: JSON.stringify({
          userId: userId,
          email: userEmail,
          displayName: displayName,
          phoneNumber: phoneNumber,
          lastActive: now,
          createdAt: now,
          updatedAt: now
        })
      };
    }

    return {
      statusCode: 200,
      headers: getCorsHeaders(event),
      body: JSON.stringify(result.Item)
    };

  } catch (error) {
    console.error('Error getting user profile:', error);
    
    return {
      statusCode: 500,
      headers: getCorsHeaders(event),
      body: JSON.stringify({
        error: 'Internal server error'
      })
    };
  }
}; 