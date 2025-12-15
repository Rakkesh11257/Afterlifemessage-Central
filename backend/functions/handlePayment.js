const AWS = require('aws-sdk');
const crypto = require('crypto');
const { getCorsHeaders } = require('../utils/cors');

const dynamodb = new AWS.DynamoDB.DocumentClient();

const TABLE_NAME = process.env.DYNAMODB_TABLE;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: getCorsHeaders(event),
      body: ''
    };
  }
  try {
    // Parse the webhook payload
    const body = JSON.parse(event.body);
    const {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      payload
    } = body;

    // Verify the webhook signature
    const expectedSignature = crypto
      .createHmac('sha256', RAZORPAY_KEY_SECRET)
      .update(JSON.stringify(payload))
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      console.error('Invalid webhook signature');
      return {
        statusCode: 400,
        headers: getCorsHeaders(event),
        body: JSON.stringify({
          error: 'Invalid signature'
        })
      };
    }

    // Extract message ID from the order ID or payload
    const messageId = payload.notes?.messageId || razorpay_order_id;

    if (!messageId) {
      console.error('No message ID found in payment data');
      return {
        statusCode: 400,
        headers: getCorsHeaders(event),
        body: JSON.stringify({
          error: 'No message ID found'
        })
      };
    }

    // Update the message to mark it as paid
    const updateParams = {
      TableName: TABLE_NAME,
      Key: {
        messageId: messageId
      },
      UpdateExpression: 'SET isPaid = :isPaid, #msgStatus = :status, paymentId = :paymentId, paymentDate = :paymentDate, updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#msgStatus': 'status'
      },
      ExpressionAttributeValues: {
        ':isPaid': true,
        ':status': 'pending',
        ':paymentId': razorpay_payment_id,
        ':paymentDate': new Date().toISOString(),
        ':updatedAt': new Date().toISOString()
      },
      ConditionExpression: 'attribute_exists(messageId) AND isPaid = :oldIsPaid',
      ExpressionAttributeValues: {
        ':isPaid': true,
        ':status': 'pending',
        ':paymentId': razorpay_payment_id,
        ':paymentDate': new Date().toISOString(),
        ':updatedAt': new Date().toISOString(),
        ':oldIsPaid': false
      }
    };

    try {
      await dynamodb.update(updateParams).promise();
      
      // NOTE: Do not log sensitive data in production
      console.log(`Message ${messageId} marked as paid successfully`);
      
      return {
        statusCode: 200,
        headers: getCorsHeaders(event),
        body: JSON.stringify({
          message: 'Payment processed successfully',
          messageId: messageId
        })
      };
    } catch (updateError) {
      console.error('Error updating message payment status:', updateError);
      
      if (updateError.code === 'ConditionalCheckFailedException') {
        return {
          statusCode: 409,
          headers: getCorsHeaders(event),
          body: JSON.stringify({
            error: 'Message already paid or not found'
          })
        };
      }
      
      throw updateError;
    }

  } catch (error) {
    console.error('Error processing payment webhook:', error);
    
    return {
      statusCode: 500,
      headers: getCorsHeaders(event),
      body: JSON.stringify({
        error: 'Internal server error'
      })
    };
  }
}; 