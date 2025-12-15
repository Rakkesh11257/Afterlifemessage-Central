const AWS = require('aws-sdk');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const { sendWhatsAppMessage, generatePresignedUrl } = require('../utils/sendWhatsAppMessage');
const { decryptText, decryptBuffer } = require('../utils/encryption');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3();

// Zepto Mail configuration
const ZEPTO_SMTP_SERVER = 'smtp.zeptomail.in';
const ZEPTO_PORT = 587;
const ZEPTO_USERNAME = 'emailapikey';
const ZEPTO_PASSWORD = process.env.ZEPTO_PASSWORD;
const ZEPTO_FROM_EMAIL = process.env.ZEPTO_FROM_EMAIL || 'noreply@afterlifemessage.in';

const MESSAGES_TABLE = process.env.DYNAMODB_TABLE;
const USERS_TABLE = process.env.USERS_TABLE;
const S3_BUCKET = process.env.S3_BUCKET;
const SES_FROM_EMAIL = process.env.SES_FROM_EMAIL;
const MEDIA_JWT_SECRET = process.env.MEDIA_JWT_SECRET || 'media-secret-key';

// Helper: generate signed token for media access
function generateMediaToken(messageId, type) {
  return jwt.sign(
    { messageId, type },
    process.env.MEDIA_JWT_SECRET || 'media-secret-key',
    { expiresIn: '1h' }
  );
}

// Helper: generate media URL
function generateMediaUrl(messageId, type) {
  const token = generateMediaToken(messageId, type);
  return `${process.env.MEDIA_STREAM_BASE_URL}/media/${messageId}?token=${token}&type=${type}`;
}

// Helper: generate download URL
function generateDownloadUrl(messageId, type) {
  const token = generateMediaToken(messageId, type);
  return `${process.env.MEDIA_STREAM_BASE_URL}/media/${messageId}?token=${token}&type=${type}&download=true`;
}

exports.handler = async (event) => {
  try {
    console.log('Starting daily trigger check...');
    
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const deliveredMessages = [];
    const failedMessages = [];

    // Get all messages that are paid but not delivered
    const scanParams = {
      TableName: MESSAGES_TABLE,
      FilterExpression: 'isPaid = :isPaid AND delivered = :delivered',
      ExpressionAttributeValues: {
        ':isPaid': true,
        ':delivered': false
      }
    };

    const messages = await dynamodb.scan(scanParams).promise();
    console.log(`Found ${messages.Items.length} pending messages to check`);
    console.log('Today:', today);
    console.log('Tomorrow:', tomorrow);
    console.log('Messages found:', messages.Items.map(m => ({
      messageId: m.messageId,
      deliveryType: m.deliveryType,
      triggerValue: m.triggerValue,
      isPaid: m.isPaid,
      delivered: m.delivered
    })));

    for (const message of messages.Items) {
      try {
        let shouldDeliver = false;
        console.log(`Processing message ${message.messageId}:`, {
          deliveryType: message.deliveryType,
          triggerValue: message.triggerValue,
          today: today,
          tomorrow: tomorrow,
          comparison: message.triggerValue === tomorrow
        });

        // Check date-based delivery
        if (message.deliveryType === 'date' && message.triggerValue) {
          if (message.triggerValue === tomorrow) {
            shouldDeliver = true;
            console.log(`Message ${message.messageId} should be delivered (date-based) - scheduled for tomorrow (2:30 AM IST)`);
          } else if (message.triggerValue < tomorrow) {
            shouldDeliver = true;
            console.log(`Message ${message.messageId} should be delivered (date-based) - overdue`);
          } else {
            console.log(`Message ${message.messageId} not ready for delivery yet`);
          }
        }
        // Check inactivity-based delivery
        else if (message.deliveryType === 'inactivity') {
          const user = await getUserById(message.userId);
          if (user && user.lastActive) {
            const lastActiveDate = new Date(user.lastActive);
            const monthsSinceActive = getMonthsDifference(lastActiveDate, new Date());
            
            if (monthsSinceActive >= parseInt(message.triggerValue)) {
              shouldDeliver = true;
            }
          }
        }

        if (shouldDeliver) {
          console.log(`Delivering message ${message.messageId} to ${message.recipientEmail}`);
          
          const deliveryResult = await deliverMessage(message);
          
          if (deliveryResult.success) {
            deliveredMessages.push(message.messageId);
            
            // Update message status
            await dynamodb.update({
              TableName: MESSAGES_TABLE,
              Key: { messageId: message.messageId },
              UpdateExpression: 'SET delivered = :delivered, #msgStatus = :status, deliveredAt = :deliveredAt, updatedAt = :updatedAt',
              ExpressionAttributeNames: {
                '#msgStatus': 'status'
              },
              ExpressionAttributeValues: {
                ':delivered': true,
                ':status': 'delivered',
                ':deliveredAt': new Date().toISOString(),
                ':updatedAt': new Date().toISOString()
              }
            }).promise();
            
            console.log(`Message ${message.messageId} delivered successfully`);
          } else {
            failedMessages.push({
              messageId: message.messageId,
              error: deliveryResult.error
            });
            console.error(`Failed to deliver message ${message.messageId}:`, deliveryResult.error);
          }
        }
      } catch (error) {
        console.error(`Error processing message ${message.messageId}:`, error);
        failedMessages.push({
          messageId: message.messageId,
          error: error.message
        });
      }
    }

    console.log(`Trigger check completed. Delivered: ${deliveredMessages.length}, Failed: ${failedMessages.length}`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Trigger check completed',
        delivered: deliveredMessages.length,
        failed: failedMessages.length,
        deliveredMessages,
        failedMessages
      })
    };

  } catch (error) {
    console.error('Error in trigger check:', error);
    throw error;
  }
};

async function getUserById(userId) {
  try {
    const result = await dynamodb.get({
      TableName: USERS_TABLE,
      Key: { userId }
    }).promise();
    
    return result.Item;
  } catch (error) {
    console.error('Error getting user:', error);
    return null;
  }
}

function getMonthsDifference(date1, date2) {
  const yearDiff = date2.getFullYear() - date1.getFullYear();
  const monthDiff = date2.getMonth() - date1.getMonth();
  return yearDiff * 12 + monthDiff;
}

async function deliverMessage(message) {
  try {
    let decryptedContent = '';
    let audioUrl = null;
    let videoUrl = null;
    let audioDownloadUrl = null;
    let videoDownloadUrl = null;
    let filesDownloadUrl = null;
    let senderName = 'Someone who cares about you';

    // Get sender information
    try {
      const user = await getUserById(message.userId);
      if (user && user.displayName) {
        senderName = user.displayName;
      } else if (user && user.email) {
        senderName = user.email.split('@')[0]; // Use email prefix as fallback
      }
    } catch (error) {
      console.error('Error getting sender info:', error);
    }

    // Decrypt the message content
    if (message.type === 'text' && message.content) {
      decryptedContent = decryptText(message.content);
    } else if (message.type === 'audio' && message.s3Key) {
      audioUrl = generateMediaUrl(message.messageId, 'audio');
      audioDownloadUrl = generateDownloadUrl(message.messageId, 'audio');
    } else if (message.type === 'video' && message.s3Key) {
      videoUrl = generateMediaUrl(message.messageId, 'video');
      videoDownloadUrl = generateDownloadUrl(message.messageId, 'video');
    } else if (message.type === 'files' && message.s3Key) {
      filesDownloadUrl = generateDownloadUrl(message.messageId, 'files');
    }

    // Twilio WhatsApp delivery
    if (message.deliveryMethods && message.deliveryMethods.includes('whatsapp') && message.recipientMobile) {
      try {
        let formattedPhone = message.recipientMobile;
        formattedPhone = formattedPhone.replace(/[+\s]/g, '');
        if (!formattedPhone.startsWith('91')) {
          if (formattedPhone.startsWith('0')) {
            formattedPhone = '91' + formattedPhone.substring(1);
          } else if (formattedPhone.length === 10) {
            formattedPhone = '91' + formattedPhone;
          }
        }
        formattedPhone = 'whatsapp:+' + formattedPhone;

        let twilioBody = '';
        if (message.type === 'text' && decryptedContent) {
          twilioBody = decryptedContent;
        } else if ((message.type === 'audio' || message.type === 'video' || message.type === 'files') && message.s3Key) {
          let downloadUrl = '';
          if (message.type === 'audio') downloadUrl = audioDownloadUrl;
          else if (message.type === 'video') downloadUrl = videoDownloadUrl;
          else downloadUrl = filesDownloadUrl;
          twilioBody = `Download here: ${downloadUrl}`;
        } else {
          twilioBody = 'You have received a message from AfterLifeMessage.in';
        }

        await sendWhatsAppMessage({
          to: formattedPhone,
          body: twilioBody
        });
        console.log(`Twilio WhatsApp message sent successfully to ${formattedPhone}`);
      } catch (waErr) {
        console.error('Error sending Twilio WhatsApp message:', waErr);
      }
    }

    // Prepare email attachments if needed
    let attachments = [];
    if ((message.type === 'audio' || message.type === 'video' || message.type === 'files') && message.s3Key) {
      const s3Obj = await s3.getObject({
        Bucket: S3_BUCKET,
        Key: message.s3Key
      }).promise();
      let buffer = s3Obj.Body;
      let filename = '';
      let contentType = 'application/octet-stream';
      if (message.type === 'audio') {
        // Decrypt the buffer for audio
        buffer = decryptBuffer(buffer);
        filename = `message-${message.messageId}.mp3`;
        contentType = 'audio/mpeg';
      } else if (message.type === 'video') {
        filename = `message-${message.messageId}.mp4`;
        contentType = 'video/mp4';
      } else if (message.type === 'files') {
        filename = `message-${message.messageId}.zip`;
        contentType = 'application/zip';
      }
      attachments.push({
        filename,
        content: buffer,
        contentType
      });
    }
    // For text messages, use plain text
    // (Removed buggy block that overwrites decryptedContent)

    // Send email via Zepto Mail SMTP
    const transporter = nodemailer.createTransport({
      host: ZEPTO_SMTP_SERVER,
      port: ZEPTO_PORT,
      secure: false, // true for 465, false for other ports
      auth: {
        user: ZEPTO_USERNAME,
        pass: ZEPTO_PASSWORD
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    const mailOptions = {
      from: `"AfterLifeMessage" <${ZEPTO_FROM_EMAIL}>`,
      to: message.recipientEmail,
      subject: `You have received a message from ${senderName} via AfterLifeMessage.in`,
      html: generateEmailHtml(decryptedContent, audioUrl, videoUrl, audioDownloadUrl, videoDownloadUrl, filesDownloadUrl, message.type, senderName),
      text: generateEmailText(decryptedContent, audioUrl, videoUrl, audioDownloadUrl, videoDownloadUrl, filesDownloadUrl, message.type, senderName),
      attachments
    };

    await transporter.sendMail(mailOptions);
    
    return { success: true };
  } catch (error) {
    console.error('Error delivering message:', error);
    return { success: false, error: error.message };
  }
}

function generateEmailHtml(content, audioUrl, videoUrl, audioDownloadUrl, videoDownloadUrl, filesDownloadUrl, type, senderName) {
  const baseHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Message from AfterLifeMessage.in</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #dc2626; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .message { background: white; padding: 20px; margin: 20px 0; border-left: 4px solid #dc2626; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        .button { background: #dc2626; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 10px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>AfterLifeMessage.in</h1>
          <p>A message has been delivered to you</p>
        </div>
        <div class="content">
          <p>You have received a heartfelt message from ${senderName} on AfterLifeMessage.in</p>
          <div class="message">
            ${type === 'text' ? `<p>${content}</p>` : ''}
            ${type === 'audio' && audioUrl ? `
              <p>You have received a voice message from ${senderName}. Click the link below to listen:</p>
              <a href="${audioUrl}" class="button">Listen to Voice Message</a>
              <p>Or download the audio file: <a href="${audioDownloadUrl}">Download Audio</a></p>
            ` : ''}
            ${type === 'video' && videoUrl ? `
              <p>You have received a video message from ${senderName}. Click the link below to watch:</p>
              <a href="${videoUrl}" class="button">Watch Video Message</a>
              <p>Or download the video file: <a href="${videoDownloadUrl}">Download Video</a></p>
            ` : ''}
            ${type === 'files' && filesDownloadUrl ? `
              <p>You have received files from ${senderName}. Click the link below to download:</p>
              <a href="${filesDownloadUrl}" class="button">Download Files</a>
            ` : ''}
          </div>
        </div>
        <div class="footer">
          <p>This message was delivered by AfterLifeMessage.in</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  return baseHtml;
}

function generateEmailText(content, audioUrl, videoUrl, audioDownloadUrl, videoDownloadUrl, filesDownloadUrl, type, senderName) {
  let text = `You have received a message from ${senderName} on AfterLifeMessage.in\n\n`;
  
  if (type === 'text') {
    text += `Message: ${content}\n\n`;
  } else if (type === 'audio') {
    text += `You have received a voice message from ${senderName}.\n`;
    text += `Please check the email for the link to listen to the message.\n`;
    text += `Audio download link: ${audioDownloadUrl}\n\n`;
  } else if (type === 'video') {
    text += `You have received a video message from ${senderName}.\n`;
    text += `Please check the email for the link to watch the message.\n`;
    text += `Video download link: ${videoDownloadUrl}\n\n`;
  } else if (type === 'files') {
    text += `You have received files from ${senderName}.\n`;
    text += `Please check the email for the link to download the files.\n`;
    text += `Files download link: ${filesDownloadUrl}\n\n`;
  }
  
  text += `This message was delivered by AfterLifeMessage.in`;
  return text;
} 