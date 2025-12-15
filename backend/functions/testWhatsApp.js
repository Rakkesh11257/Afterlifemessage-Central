const axios = require('axios');

async function checkWhatsAppStatus() {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  
  try {
    // Check phone number details
    const phoneResponse = await axios.get(`https://graph.facebook.com/v18.0/${phoneNumberId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    
    console.log('Phone Number Details:', JSON.stringify(phoneResponse.data, null, 2));
    return phoneResponse.data;
  } catch (error) {
    console.error('Error checking phone number:', error.response?.data || error.message);
    return null;
  }
}

async function sendWhatsAppMessage({ to, message, messageType = 'text', accessToken, phoneNumberId }) {
  const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;
  
  console.log('Sending WhatsApp message:', {
    to,
    messageType,
    phoneNumberId
  });
  
  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: {
      body: message
    }
  };

  try {
    console.log('WhatsApp API payload:', JSON.stringify(payload, null, 2));
    
    const response = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('WhatsApp API response:', JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error('WhatsApp API error:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    });
    throw error;
  }
}

exports.handler = async (event) => {
  try {
    console.log('Testing WhatsApp delivery...');
    
    // First, check the WhatsApp Business API account status
    console.log('=== Checking WhatsApp Business API Status ===');
    const phoneDetails = await checkWhatsAppStatus();
    
    if (!phoneDetails) {
      return {
        statusCode: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Content-Type,Authorization",
          "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
        },
        body: JSON.stringify({
          success: false,
          error: 'Could not verify WhatsApp Business API account'
        })
      };
    }
    
    console.log('=== Phone Number Details ===');
    console.log('Verified:', phoneDetails.verified_name);
    console.log('Code Verification Status:', phoneDetails.code_verification_status);
    console.log('Quality Rating:', phoneDetails.quality_rating);
    console.log('Messaging Limits:', phoneDetails.messaging_limits);
    console.log('Display Phone Number:', phoneDetails.display_phone_number);
    
    // Try multiple test numbers
    const testNumbers = [
      '919791084438', // Your number
      '918610767908', // Another number from your logs
      '919876543210'  // Generic test number
    ];
    
    const testMessage = 'Hello! This is a test message from AfterLifeMessage.in to verify WhatsApp delivery is working. 🚀';
    
    const results = [];
    
    for (const testNumber of testNumbers) {
      console.log(`=== Testing Number: ${testNumber} ===`);
      
      try {
        const result = await sendWhatsAppMessage({
          to: testNumber,
          message: testMessage,
          messageType: 'text',
          accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
          phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID
        });
        
        results.push({
          number: testNumber,
          success: true,
          messageId: result.messages?.[0]?.id || 'No message ID',
          response: result
        });
        
        console.log(`✅ Success for ${testNumber}`);
      } catch (error) {
        results.push({
          number: testNumber,
          success: false,
          error: error.message,
          details: error.response?.data
        });
        
        console.log(`❌ Failed for ${testNumber}:`, error.message);
      }
    }
    
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
      },
      body: JSON.stringify({
        success: true,
        message: 'WhatsApp test completed',
        phoneDetails,
        results
      })
    };
    
  } catch (error) {
    console.error('Error testing WhatsApp:', error);
    console.error('Error details:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data
    });
    
    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
      },
      body: JSON.stringify({
        success: false,
        error: error.message,
        details: error.response?.data || error
      })
    };
  }
}; 