const crypto = require('crypto');

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY; // Must be 32 bytes for AES-256
const IV_LENGTH = 16; // AES block size

// Convert hex string to buffer and ensure it's 32 bytes
let keyBuffer;
if (ENCRYPTION_KEY.length === 32) {
  // If it's 32 characters, treat as hex and pad to 32 bytes
  const hexKey = ENCRYPTION_KEY.padEnd(64, '0'); // Pad to 64 hex chars (32 bytes)
  keyBuffer = Buffer.from(hexKey, 'hex');
} else if (ENCRYPTION_KEY.length === 64) {
  // If it's 64 characters, treat as hex
  keyBuffer = Buffer.from(ENCRYPTION_KEY, 'hex');
} else {
  // Use SHA-256 to create a 32-byte key from the input
  keyBuffer = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
}

// Debug logging
console.log('🔍 DEBUG - Encryption key:', {
  original: ENCRYPTION_KEY,
  length: ENCRYPTION_KEY.length,
  keyBufferLength: keyBuffer.length,
  keyBufferHex: keyBuffer.toString('hex')
});

function encryptText(text) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', keyBuffer, iv);
  let encrypted = cipher.update(text, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  return iv.toString('base64') + ':' + encrypted;
}

function decryptText(encryptedText) {
  const [ivBase64, encrypted] = encryptedText.split(':');
  const iv = Buffer.from(ivBase64, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, iv);
  let decrypted = decipher.update(encrypted, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function encryptBuffer(buffer) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', keyBuffer, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const result = Buffer.concat([iv, encrypted]); // Prepend IV
  
  // Debug logging
  console.log('🔍 DEBUG - Encryption:', {
    originalBufferLength: buffer.length,
    ivLength: iv.length,
    ivHex: iv.toString('hex'),
    encryptedLength: encrypted.length,
    resultLength: result.length,
    resultStart: result.slice(0, 32).toString('hex')
  });
  
  return result;
}

function decryptBuffer(encryptedBuffer) {
  const iv = encryptedBuffer.slice(0, IV_LENGTH);
  const encrypted = encryptedBuffer.slice(IV_LENGTH);
  const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, iv);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  
  // Debug logging
  console.log('🔍 DEBUG - Decryption:', {
    encryptedBufferLength: encryptedBuffer.length,
    ivLength: iv.length,
    ivHex: iv.toString('hex'),
    encryptedLength: encrypted.length,
    decryptedLength: decrypted.length,
    decryptedStart: decrypted.slice(0, 32).toString('hex')
  });
  
  return decrypted;
}

module.exports = { encryptText, decryptText, encryptBuffer, decryptBuffer }; 