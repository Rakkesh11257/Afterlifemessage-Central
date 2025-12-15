const CryptoJS = require('crypto-js');

// Rate limiting storage (in production, use Redis or DynamoDB)
const rateLimitStore = new Map();

// JWT token validation
const validateToken = async (event) => {
  try {
    // Check for Authorization header
    const authHeader = event.headers?.Authorization || event.headers?.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { isValid: false, error: 'Missing or invalid Authorization header' };
    }

    const token = authHeader.replace('Bearer ', '');
    
    // For Cognito JWT tokens, we can decode and validate the structure
    // In production, you should verify the token signature with Cognito
    const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    
    // Check if token is expired
    const currentTime = Math.floor(Date.now() / 1000);
    if (decoded.exp && decoded.exp < currentTime) {
      return { isValid: false, error: 'Token expired' };
    }

    // Extract user ID from token
    const userId = decoded.sub;
    if (!userId) {
      return { isValid: false, error: 'Invalid token: missing user ID' };
    }

    return { isValid: true, userId };
  } catch (error) {
    console.error('Token validation error:', error);
    return { isValid: false, error: 'Invalid token format' };
  }
};

// Input validation and sanitization
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
};

const validateMessageType = (type) => {
  const validTypes = ['text', 'audio', 'video', 'files'];
  return validTypes.includes(type);
};

const validateDeliveryType = (deliveryType) => {
  const validDeliveryTypes = ['date', 'inactivity'];
  return validDeliveryTypes.includes(deliveryType);
};

const validateContent = (content, type) => {
  if (type === 'text') {
    // Text content validation
    if (!content || typeof content !== 'string') {
      return { valid: false, error: 'Text content is required' };
    }
    if (content.length > 10000) {
      return { valid: false, error: 'Text content too long (max 10,000 characters)' };
    }
    // Check for potentially harmful content
    const harmfulPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi
    ];
    
    for (const pattern of harmfulPatterns) {
      if (pattern.test(content)) {
        return { valid: false, error: 'Content contains potentially harmful elements' };
      }
    }
    
    return { valid: true };
  }
  
  if (type === 'audio' || type === 'video') {
    // Media content validation
    if (!content) {
      return { valid: false, error: `${type} content is required` };
    }
    
    // Check file size (base64 encoded)
    const sizeInBytes = Math.ceil((content.length * 3) / 4);
    const maxSize = type === 'audio' ? 50 * 1024 * 1024 : 250 * 1024 * 1024; // 50MB for audio, 250MB for video
    
    if (sizeInBytes > maxSize) {
      return { valid: false, error: `${type} file too large (max ${maxSize / (1024 * 1024)}MB)` };
    }
    
    return { valid: true };
  }
  
  if (type === 'files') {
    // Files content validation - files are handled separately in the main function
    return { valid: true };
  }
  
  return { valid: false, error: 'Invalid content type' };
};

const validateTriggerValue = (triggerValue, deliveryType) => {
  if (deliveryType === 'date') {
    const date = new Date(triggerValue);
    if (isNaN(date.getTime())) {
      return { valid: false, error: 'Invalid date format' };
    }
    
    const now = new Date();
    const minDate = new Date(now.getTime() + 30 * 60 * 1000); // 30 minutes from now (for testing)
    if (date < minDate) {
      return { valid: false, error: 'Delivery date must be at least 30 minutes in the future' };
    }
    
    const maxDate = new Date(now.getTime() + 10 * 365 * 24 * 60 * 60 * 1000); // 10 years
    if (date > maxDate) {
      return { valid: false, error: 'Delivery date cannot be more than 10 years in the future' };
    }
    
    return { valid: true };
  }
  
  if (deliveryType === 'inactivity') {
    const months = parseInt(triggerValue);
    if (isNaN(months) || months < 1 || months > 120) {
      return { valid: false, error: 'Inactivity period must be between 1 and 120 months' };
    }
    return { valid: true };
  }
  
  return { valid: false, error: 'Invalid trigger value' };
};

// Rate limiting
const checkRateLimit = (userId, action, limit = 10, windowMs = 60000) => {
  const key = `${userId}:${action}`;
  const now = Date.now();
  const windowStart = now - windowMs;
  
  if (!rateLimitStore.has(key)) {
    rateLimitStore.set(key, []);
  }
  
  const requests = rateLimitStore.get(key);
  const recentRequests = requests.filter(timestamp => timestamp > windowStart);
  
  if (recentRequests.length >= limit) {
    return { allowed: false, remaining: 0, resetTime: windowStart + windowMs };
  }
  
  recentRequests.push(now);
  rateLimitStore.set(key, recentRequests);
  
  return { 
    allowed: true, 
    remaining: limit - recentRequests.length,
    resetTime: windowStart + windowMs
  };
};

// Input sanitization
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  
  // Remove null bytes and control characters
  let sanitized = input.replace(/[\x00-\x1F\x7F]/g, '');
  
  // Trim whitespace
  sanitized = sanitized.trim();
  
  // Limit length
  if (sanitized.length > 1000) {
    sanitized = sanitized.substring(0, 1000);
  }
  
  return sanitized;
};

// Comprehensive validation for message creation
const validateMessageCreation = (body) => {
  const errors = [];
  
  // Required fields
  if (!body.type) errors.push('Message type is required');
  if (!body.recipientEmail) errors.push('Recipient email is required');
  if (!body.deliveryType) errors.push('Delivery type is required');

  // Delivery type specific required fields
  if (body.deliveryType === 'date') {
    if (!body.deliveryDate) errors.push('Delivery date is required');
  } else if (body.deliveryType === 'inactivity') {
    if (!body.triggerValue) errors.push('Trigger value is required');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Validate email
  if (!validateEmail(body.recipientEmail)) {
    errors.push('Invalid recipient email format');
  }

  // Validate message type
  if (!validateMessageType(body.type)) {
    errors.push('Invalid message type');
  }

  // Validate delivery type
  if (!validateDeliveryType(body.deliveryType)) {
    errors.push('Invalid delivery type');
  }

  // Validate content based on type
  if (body.type === 'files') {
    // For files type, check if files array exists and has content
    if (!body.files || !Array.isArray(body.files) || body.files.length === 0) {
      errors.push('Files are required for files message type');
    }
  } else {
    const contentValidation = validateContent(body.content || body.audioBlob || body.videoBlob, body.type);
    if (!contentValidation.valid) {
      errors.push(contentValidation.error);
    }
  }

  // Validate delivery date or trigger value
  if (body.deliveryType === 'date') {
    // Validate deliveryDate format and logic
    const date = new Date(body.deliveryDate);
    if (isNaN(date.getTime())) {
      errors.push('Invalid delivery date format');
    } else {
      const now = new Date();
      const minDate = new Date(now.getTime() + 30 * 60 * 1000); // 30 minutes from now
      if (date < minDate) {
        errors.push('Delivery date must be at least 30 minutes in the future');
      }
      const maxDate = new Date(now.getTime() + 10 * 365 * 24 * 60 * 60 * 1000); // 10 years
      if (date > maxDate) {
        errors.push('Delivery date cannot be more than 10 years in the future');
      }
    }
  } else if (body.deliveryType === 'inactivity') {
    const months = parseInt(body.triggerValue);
    if (isNaN(months) || months < 1 || months > 120) {
      errors.push('Inactivity period must be between 1 and 120 months');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitizedData: {
      type: body.type,
      content: sanitizeInput(body.content),
      recipientEmail: body.recipientEmail.toLowerCase().trim(),
      deliveryType: body.deliveryType,
      deliveryDate: body.deliveryDate,
      triggerValue: body.triggerValue,
      audioBlob: body.audioBlob,
      videoBlob: body.videoBlob,
      files: body.files,
      s3Key: body.s3Key
    }
  };
};

// Security headers
const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
};

module.exports = {
  validateToken,
  validateEmail,
  validateMessageType,
  validateDeliveryType,
  validateContent,
  validateTriggerValue,
  checkRateLimit,
  sanitizeInput,
  validateMessageCreation,
  securityHeaders
}; 