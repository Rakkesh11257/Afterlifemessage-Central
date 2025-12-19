const AWS = require('aws-sdk');
const { getCorsHeaders } = require('../utils/cors');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const cognito = new AWS.CognitoIdentityServiceProvider();

const USERS_TABLE = process.env.USERS_TABLE;
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID;

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
    
    // Helper function to fetch user attributes from Cognito
    // Returns userExists: false if user doesn't exist in Cognito
    const fetchCognitoAttributes = async () => {
      let displayName = null;
      let phoneNumber = null;
      let email = null;
      let userExists = false;
      try {
        if (!USER_POOL_ID) {
          console.error('COGNITO_USER_POOL_ID environment variable is not set');
          return { displayName, phoneNumber, email, userExists: false };
        }
        // Use userId (sub) as username for adminGetUser
        const cognitoUser = await cognito.adminGetUser({
          UserPoolId: USER_POOL_ID,
          Username: userId
        }).promise();
        
        // If we get here without error, user exists in Cognito
        userExists = true;
        
        // adminGetUser returns UserAttributes directly (not nested under User)
        if (cognitoUser && cognitoUser.UserAttributes && Array.isArray(cognitoUser.UserAttributes)) {
          // Find the name attribute
          const nameAttribute = cognitoUser.UserAttributes.find(attr => attr.Name === 'name');
          if (nameAttribute) {
            displayName = nameAttribute.Value;
          }
          // Find the phone_number attribute
          const phoneAttr = cognitoUser.UserAttributes.find(attr => attr.Name === 'phone_number');
          if (phoneAttr) {
            phoneNumber = phoneAttr.Value;
          }
          // Find the email attribute
          const emailAttr = cognitoUser.UserAttributes.find(attr => attr.Name === 'email');
          if (emailAttr) {
            email = emailAttr.Value;
          }
        } else {
          console.error('Invalid Cognito user response structure - UserAttributes missing:', JSON.stringify(cognitoUser));
        }
      } catch (error) {
        console.error('Error getting Cognito user details:', error);
        // Check if error is because user doesn't exist
        if (error.code === 'UserNotFoundException') {
          userExists = false;
        }
      }
      return { displayName, phoneNumber, email, userExists };
    };
    
    if (!result.Item) {
      // User doesn't exist in our table yet
      // First verify the user actually exists in Cognito (to prevent creating records for deleted users)
      const cognitoData = await fetchCognitoAttributes();
      
      // If user doesn't exist in Cognito, return 401 - don't create DynamoDB record
      if (!cognitoData.userExists) {
        console.error('User not found in Cognito, refusing to create DynamoDB record:', userId);
        return {
          statusCode: 401,
          headers: getCorsHeaders(event),
          body: JSON.stringify({ error: 'User not found in Cognito. Please sign in again.' })
        };
      }
      
      // User exists in Cognito, create them in DynamoDB
      const now = new Date().toISOString();
      const createParams = {
        TableName: USERS_TABLE,
        Item: {
          userId: userId,
          email: cognitoData.email || userEmail,
          displayName: cognitoData.displayName,
          phoneNumber: cognitoData.phoneNumber,
          lastActive: now,
          createdAt: now,
          updatedAt: now
        }
      };
      await dynamodb.put(createParams).promise();
      return {
        statusCode: 200,
        headers: getCorsHeaders(event),
        body: JSON.stringify(createParams.Item)
      };
    }

    // If user exists but any fields are missing, try to fetch from Cognito and update
    const cognitoData = await fetchCognitoAttributes();
    
    // If user doesn't exist in Cognito anymore (deleted), return 401
    if (!cognitoData.userExists) {
      console.error('User no longer exists in Cognito, user should sign out:', userId);
      return {
        statusCode: 401,
        headers: getCorsHeaders(event),
        body: JSON.stringify({ error: 'User not found in Cognito. Please sign in again.' })
      };
    }
    
    const { displayName, phoneNumber, email: cognitoEmail } = cognitoData;
    const now = new Date().toISOString();
    const updateExpressions = [];
    const expressionAttributeValues = { ':updatedAt': now };
    let needsUpdate = false;

    // Update email if missing or different from Cognito (for email changes)
    if (cognitoEmail && (result.Item.email !== cognitoEmail)) {
      updateExpressions.push('email = :email');
      expressionAttributeValues[':email'] = cognitoEmail;
      result.Item.email = cognitoEmail;
      needsUpdate = true;
    }

    // Update displayName if missing
    if ((!result.Item.displayName || result.Item.displayName === null || result.Item.displayName === '') && displayName) {
      updateExpressions.push('displayName = :displayName');
      expressionAttributeValues[':displayName'] = displayName;
      result.Item.displayName = displayName;
      needsUpdate = true;
    }

    // Update phoneNumber if missing
    if ((!result.Item.phoneNumber || result.Item.phoneNumber === null || result.Item.phoneNumber === '') && phoneNumber) {
      updateExpressions.push('phoneNumber = :phoneNumber');
      expressionAttributeValues[':phoneNumber'] = phoneNumber;
      result.Item.phoneNumber = phoneNumber;
      needsUpdate = true;
    }

    // Add createdAt if missing
    if (!result.Item.createdAt) {
      updateExpressions.push('createdAt = :createdAt');
      expressionAttributeValues[':createdAt'] = result.Item.createdAt || now;
      result.Item.createdAt = result.Item.createdAt || now;
      needsUpdate = true;
    }

    if (needsUpdate) {
      const updateParams = {
        TableName: USERS_TABLE,
        Key: { userId },
        UpdateExpression: `SET ${updateExpressions.join(', ')}, updatedAt = :updatedAt`,
        ExpressionAttributeValues: expressionAttributeValues
      };
      console.log('Updating user profile with missing fields:', updateParams);
      await dynamodb.update(updateParams).promise();
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