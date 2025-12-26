# Testing Message Delivery Guide

## ✅ Function Deployed Successfully!

The `checkTriggers` function has been deployed and is working. However, it found 0 messages to deliver.

## 🔍 What to Check:

### 1. **Message Requirements in DynamoDB:**

Your message must have:
- ✅ `isPaid = true` (boolean)
- ✅ `delivered = false` (boolean)
- ✅ `deliveryType = "inactivity"` (string)
- ✅ `triggerValue = "6"` or `6` (string or number)
- ✅ `type = "text"` (or "audio", "video", "files")
- ✅ `content` = encrypted text (for text messages)
- ✅ `recipientEmail` = valid email address

### 2. **User Requirements in DynamoDB:**

Your user must have:
- ✅ `lastActive` = ISO date string from 6+ months ago
  - Example: `"2024-06-01T00:00:00.000Z"` (if today is Dec 2024)
  - Format: `YYYY-MM-DDTHH:mm:ss.sssZ`

### 3. **How to Verify in DynamoDB:**

```bash
# Check your message
aws dynamodb get-item \
  --table-name afterlifemessage-backend-messages-dev \
  --key '{"messageId": {"S": "YOUR_MESSAGE_ID"}}'

# Check your user
aws dynamodb get-item \
  --table-name afterlifemessage-backend-users-dev \
  --key '{"userId": {"S": "YOUR_USER_ID"}}'
```

### 4. **Calculate 6 Months Ago:**

```javascript
// In browser console or Node.js
const sixMonthsAgo = new Date();
sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
console.log(sixMonthsAgo.toISOString());
// Use this value for user.lastActive
```

### 5. **Check CloudWatch Logs:**

After running `checkTriggers`, check CloudWatch logs to see:
- How many messages were found
- Why messages were skipped
- The inactivity calculation details

```bash
# View recent logs
aws logs tail /aws/lambda/afterlifemessage-backend-dev-checkTriggers --follow
```

## 🧪 Testing Steps:

1. **Verify Message in DynamoDB:**
   - `isPaid = true`
   - `delivered = false`
   - `deliveryType = "inactivity"`
   - `triggerValue = "6"` or `6`

2. **Set User's lastActive:**
   - Calculate date 6 months ago
   - Update user's `lastActive` field in DynamoDB

3. **Run checkTriggers:**
   ```bash
   cd backend
   serverless invoke -f checkTriggers --stage dev
   ```

4. **Check Results:**
   - If `delivered: 1` → Success! Check recipient's email
   - If `delivered: 0` → Check CloudWatch logs for details

## 📧 What Happens When Delivered:

1. Message content is **decrypted**
2. Email is sent via **ZeptoMail REST API**
3. For text: Decrypted content in email body
4. For audio/video/files: Decrypted attachments included
5. Message status updated to `delivered = true`

## 🐛 Troubleshooting:

- **"delivered: 0"** → Check message/user requirements above
- **"failed: 1"** → Check CloudWatch logs for error details
- **Email not received** → Check ZeptoMail dashboard for delivery status

