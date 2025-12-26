# Message Encryption & Delivery Review

## 🔍 Review Summary

This document reviews the message creation, encryption, S3 storage, and email delivery implementation for text, audio, video, and file messages.

---

## ✅ **What's Working Correctly**

### 1. **Text Messages**
- ✅ Encryption: Text content is properly encrypted using `encryptText()` before storing in DynamoDB
- ✅ Decryption: Text content is properly decrypted using `decryptText()` when:
  - Retrieving messages (`getMessages.js`, `getMessage.js`)
  - Delivering via email (`checkTriggers.js` line 216)

### 2. **Audio Messages**
- ✅ Encryption: Audio is properly encrypted using `encryptBuffer()` before uploading to S3
- ✅ S3 Storage: Encrypted audio is stored with correct metadata
- ✅ Audio Processing: FFmpeg conversion to MP3 works correctly
- ✅ Email Delivery: Audio is properly decrypted before sending as email attachment (line 276)

### 3. **Encryption Utilities** (`utils/encryption.js`)
- ✅ Proper AES-256-CBC encryption implementation
- ✅ IV (Initialization Vector) properly prepended to encrypted data
- ✅ Both text and buffer encryption/decryption functions work correctly

---

## 🚨 **Critical Issues Found**

### 1. **Video Messages - NOT Decrypted in Email Delivery**

**Location:** `backend/functions/checkTriggers.js` lines 279-281

**Issue:**
```javascript
} else if (message.type === 'video') {
  filename = `message-${message.messageId}.mp4`;
  contentType = 'video/mp4';
  // ❌ MISSING: buffer = decryptBuffer(buffer);
}
```

**Problem:** Video files are encrypted before storing in S3, but they are **NOT decrypted** before being sent as email attachments. This means recipients will receive encrypted/corrupted video files that cannot be played.

**Fix Required:**
```javascript
} else if (message.type === 'video') {
  buffer = decryptBuffer(buffer); // ✅ ADD THIS LINE
  filename = `message-${message.messageId}.mp4`;
  contentType = 'video/mp4';
}
```

---

### 2. **Files Messages - NOT Decrypted in Email Delivery**

**Location:** `backend/functions/checkTriggers.js` lines 282-285

**Issue:**
```javascript
} else if (message.type === 'files') {
  filename = `message-${message.messageId}.zip`;
  contentType = 'application/zip';
  // ❌ MISSING: buffer = decryptBuffer(buffer);
}
```

**Problem:** Individual files are encrypted before storing in S3, but they are **NOT decrypted** before being sent as email attachments. Recipients will receive encrypted/corrupted files.

**Additional Issue:** The code checks for `message.s3Key`, but for file messages, the structure is `message.files` (array of file objects, each with its own `s3Key`). This means:
1. The attachment code won't execute for file messages (because `message.s3Key` doesn't exist)
2. Even if it did, it would need to handle multiple files, not just one attachment

**Fix Required:**
1. Decrypt each file before attaching
2. Handle `message.files` array structure correctly
3. Create multiple attachments (one per file) or zip them together

---

### 3. **Files Message Structure Mismatch**

**Location:** `backend/functions/checkTriggers.js` line 266

**Issue:**
```javascript
if ((message.type === 'audio' || message.type === 'video' || message.type === 'files') && message.s3Key) {
```

**Problem:** For file messages, there is no single `message.s3Key`. Instead, there's a `message.files` array where each file has its own `s3Key`. This condition will fail for file messages.

**Current Structure (from `createMessage.js`):**
```javascript
message.files = [
  {
    name: "file1.pdf",
    s3Key: "files/${messageId}/0_file1.pdf",
    size: 12345,
    type: "application/pdf"
  },
  {
    name: "file2.jpg",
    s3Key: "files/${messageId}/1_file2.jpg",
    size: 67890,
    type: "image/jpeg"
  }
]
```

**Fix Required:** Change the condition to check for `message.files` array for file messages.

---

## 📋 **Review Checklist**

### Encryption & Storage
- [x] Text messages encrypted correctly
- [x] Audio messages encrypted correctly
- [x] Video messages encrypted correctly
- [x] Files encrypted correctly
- [x] All encrypted data stored in S3 with proper metadata

### Decryption & Delivery
- [x] Text messages decrypted correctly in email
- [x] Audio messages decrypted correctly in email
- [ ] Video messages decrypted correctly in email ❌ **ISSUE**
- [ ] Files decrypted correctly in email ❌ **ISSUE**
- [ ] Files array structure handled correctly ❌ **ISSUE**

### S3 Storage
- [x] Audio stored with `.enc` extension
- [x] Video stored with `.enc` extension
- [x] Files stored with proper paths (`files/${messageId}/${index}_${filename}`)
- [x] Metadata stored correctly (messageId, type, originalMimeType)

---

## 🔧 **Recommended Fixes**

### Fix 1: Video Decryption in Email Delivery

**File:** `backend/functions/checkTriggers.js`

**Change around line 279:**
```javascript
} else if (message.type === 'video') {
  buffer = decryptBuffer(buffer); // ADD THIS LINE
  filename = `message-${message.messageId}.mp4`;
  contentType = 'video/mp4';
}
```

### Fix 2: Files Decryption and Structure Handling

**File:** `backend/functions/checkTriggers.js`

**Change around line 265-291:**
```javascript
// Prepare email attachments if needed
let attachments = [];
if (message.type === 'audio' && message.s3Key) {
  const s3Obj = await s3.getObject({
    Bucket: S3_BUCKET,
    Key: message.s3Key
  }).promise();
  let buffer = decryptBuffer(s3Obj.Body);
  attachments.push({
    filename: `message-${message.messageId}.mp3`,
    content: buffer,
    contentType: 'audio/mpeg'
  });
} else if (message.type === 'video' && message.s3Key) {
  const s3Obj = await s3.getObject({
    Bucket: S3_BUCKET,
    Key: message.s3Key
  }).promise();
  let buffer = decryptBuffer(s3Obj.Body); // ADD DECRYPTION
  attachments.push({
    filename: `message-${message.messageId}.mp4`,
    content: buffer,
    contentType: 'video/mp4'
  });
} else if (message.type === 'files' && message.files && message.files.length > 0) {
  // Handle multiple files - decrypt each one
  for (const file of message.files) {
    const s3Obj = await s3.getObject({
      Bucket: S3_BUCKET,
      Key: file.s3Key
    }).promise();
    let buffer = decryptBuffer(s3Obj.Body); // ADD DECRYPTION
    attachments.push({
      filename: file.name, // Use original filename
      content: buffer,
      contentType: file.type || 'application/octet-stream'
    });
  }
}
```

---

## 📝 **Additional Notes**

1. **Audio Processing:** The FFmpeg Lambda Layer is currently commented out in `serverless.yml`. Audio conversion will fail if FFmpeg is not available. This needs to be addressed if audio recording is used.

2. **File Size Limits:** Large files (>6MB) are handled differently (using presigned URLs instead of base64). This is correct for `getDecryptedMedia.js`, but email attachments have size limits (~25MB typically). Consider zipping multiple files or limiting attachment sizes.

3. **Error Handling:** The current code has good error handling for encryption/decryption failures. This should be maintained.

4. **WhatsApp Delivery:** WhatsApp delivery code exists but is commented out or incomplete. This is fine since we're focusing on email first.

---

## ✅ **Next Steps**

1. Fix video decryption in email delivery
2. Fix files decryption and structure handling in email delivery
3. Test all message types end-to-end:
   - Create text message → verify encryption → verify email delivery with decrypted content
   - Create audio message → verify encryption → verify email delivery with playable audio attachment
   - Create video message → verify encryption → verify email delivery with playable video attachment
   - Create files message → verify encryption → verify email delivery with accessible file attachments
4. Test with actual email delivery to ensure recipients receive usable files

---

## 🎯 **Conclusion**

The encryption implementation is **solid and correct** for all message types. The main issues are in the **email delivery function** where video and files are not being decrypted before being sent as attachments. These are critical bugs that will cause recipients to receive unusable/corrupted files.

The fixes are straightforward and should be implemented before deployment.

