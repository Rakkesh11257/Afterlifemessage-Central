const AWS = require('aws-sdk');
const Razorpay = require('razorpay');
const { getCorsHeaders } = require('../utils/cors');

const dynamodb = new AWS.DynamoDB.DocumentClient();

const TABLE_NAME = process.env.DYNAMODB_TABLE;
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

const razorpay = new Razorpay({
  key_id: RAZORPAY_KEY_ID,
  key_secret: RAZORPAY_KEY_SECRET
});

// Calculate amount based on message type
const getAmountForMessageType = (messageType) => {
  switch (messageType) {
    case 'video':
      return 19900; // ₹199 in paise
    case 'audio':
    case 'text':
    default:
      return 9900; // ₹99 in paise
  }
};

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
    // Parse the request body
    const body = JSON.parse(event.body);
    const { messageId, messageType } = body;

    // Get user ID from Cognito authorizer
    const userId = event.requestContext.authorizer.claims.sub;

    // Validate required fields
    if (!messageId || !messageType) {
      return {
        statusCode: 400,
        headers: getCorsHeaders(event),
        body: JSON.stringify({
          error: 'Missing required fields'
        })
      };
    }

    // Get the message to verify it exists and belongs to the user
    const getMessageParams = {
      TableName: TABLE_NAME,
      Key: {
        messageId: messageId
      }
    };

    const messageResult = await dynamodb.get(getMessageParams).promise();
    
    if (!messageResult.Item) {
      return {
        statusCode: 404,
        headers: getCorsHeaders(event),
        body: JSON.stringify({
          error: 'Message not found'
        })
      };
    }

    if (messageResult.Item.userId !== userId) {
      return {
        statusCode: 403,
        headers: getCorsHeaders(event),
        body: JSON.stringify({
          error: 'Unauthorized access to message'
        })
      };
    }

    if (messageResult.Item.isPaid) {
      return {
        statusCode: 409,
        headers: getCorsHeaders(event),
        body: JSON.stringify({
          error: 'Message already paid'
        })
      };
    }

    // Calculate amount based on message type
    const amount = getAmountForMessageType(messageType);

    // Create Razorpay order
    const orderOptions = {
      amount: amount,
      currency: 'INR',
      receipt: messageId,
      notes: {
        messageId: messageId,
        messageType: messageType,
        userId: userId
      }
    };

    const order = await razorpay.orders.create(orderOptions);

    return {
      statusCode: 200,
      headers: getCorsHeaders(event),
      body: JSON.stringify({
        orderId: order.id,
        amount: amount,
        currency: 'INR',
        messageId: messageId,
        messageType: messageType
      })
    };

  } catch (error) {
    console.error('Error creating payment:', error);
    
    return {
      statusCode: 500,
      headers: getCorsHeaders(event),
      body: JSON.stringify({
        error: 'Internal server error'
      })
    };
  }
}; 