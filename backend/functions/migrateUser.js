const AWS = require('aws-sdk');
const dynamo = new AWS.DynamoDB.DocumentClient();

// Environment variable: process.env.USERS_TABLE

exports.handler = async (event, context) => {
  const userAttributes = event.request.userAttributes;
  const tableName = process.env.USERS_TABLE;

  if (!userAttributes || !userAttributes.sub || !userAttributes.email) {
    console.error('Missing required user attributes:', userAttributes);
    throw new Error('Missing required user attributes');
  }

  const now = new Date().toISOString();
  const userItem = {
    userId: userAttributes.sub,
    email: userAttributes.email,
    displayName: userAttributes.name || null,
    phoneNumber: userAttributes.phone_number || null,
    createdAt: now,
    updatedAt: now,
    lastActive: now,
    // Add any other attributes you want to store
  };

  const params = {
    TableName: tableName,
    Item: userItem,
  };

  try {
    await dynamo.put(params).promise();
    console.log('User written to DynamoDB:', userItem);
  } catch (err) {
    console.error('Error writing user to DynamoDB:', err);
    throw err;
  }

  // Return event for Cognito
  return event;
}; 