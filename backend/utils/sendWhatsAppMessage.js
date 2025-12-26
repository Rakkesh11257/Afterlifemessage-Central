const twilio = require('twilio');
const AWS = require('aws-sdk');

// Lazy initialization of Twilio client (only when needed and credentials are available)
let twilioClient = null;
const twilioWhatsAppNumber = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886'; // Default to sandbox

function getTwilioClient() {
  if (!twilioClient) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    
    // Only initialize if credentials are provided
    if (accountSid && authToken && accountSid.startsWith('AC')) {
      twilioClient = twilio(accountSid, authToken);
    } else {
      // Return null if credentials are not available
      return null;
    }
  }
  return twilioClient;
}

const s3 = new AWS.S3();
const S3_BUCKET = process.env.S3_BUCKET;

/**
 * Generate a public S3 pre-signed URL for WhatsApp media delivery
 * @param {string} key - S3 object key
 * @param {number} expiresIn - Expiry in seconds (default: 1 hour)
 * @returns {string} Pre-signed URL
 */
function generatePresignedUrl(key, expiresIn = 3600) {
  return s3.getSignedUrl('getObject', {
    Bucket: S3_BUCKET,
    Key: key,
    Expires: expiresIn,
    ResponseContentDisposition: 'inline',
    ResponseContentType: undefined // Let S3 infer
  });
}

/**
 * Send WhatsApp message via Twilio
 * @param {Object} options
 * @param {string} options.to - Recipient WhatsApp number (with country code, e.g., whatsapp:+919791084438)
 * @param {string} [options.body] - Text message body
 * @param {string} [options.mediaUrl] - Publicly accessible media URL (image, pdf, audio, etc.)
 * @param {string} [options.template] - Optional: Twilio Content Template SID
 * @param {Object} [options.templateVars] - Optional: Variables for template
 */
async function sendWhatsAppMessage({ to, body, mediaUrl, template, templateVars }) {
  const client = getTwilioClient();
  
  // If Twilio is not configured, skip WhatsApp delivery
  if (!client) {
    console.warn('Twilio credentials not configured. Skipping WhatsApp delivery.');
    return { success: false, error: 'Twilio not configured' };
  }
  
  if (!to.startsWith('whatsapp:')) {
    to = 'whatsapp:' + to.replace(/^\+/, '');
  }

  const messageOptions = {
    from: twilioWhatsAppNumber,
    to,
  };

  if (template && templateVars) {
    // Use Twilio Content API template
    messageOptions.contentSid = template;
    messageOptions.contentVariables = JSON.stringify(templateVars);
  } else if (mediaUrl) {
    // Send media message
    messageOptions.body = body || 'You have received a media message from AfterLifeMessage.in';
    messageOptions.mediaUrl = mediaUrl;
  } else {
    // Send beautiful text message
    messageOptions.body =
      body ||
      `🌹 *AfterLifeMessage.in* 🌹\n\nYou have received a heartfelt message.\n\nCherish the memories, embrace the love.\n\n_This message was delivered by AfterLifeMessage.in_`;
  }

  try {
    const result = await client.messages.create(messageOptions);
    console.log('Twilio WhatsApp API response:', result);
    return result;
  } catch (error) {
    console.error('Twilio WhatsApp API error:', error);
    throw error;
  }
}

module.exports = { sendWhatsAppMessage, generatePresignedUrl }; 