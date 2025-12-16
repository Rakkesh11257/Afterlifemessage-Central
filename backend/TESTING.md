# 🧪 Backend API Testing Guide

## Base URL
```
https://kk9hsbofeh.execute-api.ap-south-1.amazonaws.com/dev
```

## Prerequisites

1. **AWS Cognito Token** (for authenticated endpoints)
   - You'll need to set up Cognito User Pool first
   - Get an authentication token after login

2. **Test Tools**
   - `curl` (command line)
   - Postman or Insomnia (GUI)
   - Browser (for GET requests)

---

## 1. Test Simple Endpoints (No Auth Required)

### Test WhatsApp Integration

```bash
curl -X POST https://kk9hsbofeh.execute-api.ap-south-1.amazonaws.com/dev/test-whatsapp \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+1234567890",
    "message": "Test message from AfterLifeMessage"
  }'
```

**Expected**: Should return success if WhatsApp credentials are configured correctly.

---

### Get Upload URL (for file uploads)

```bash
curl -X POST https://kk9hsbofeh.execute-api.ap-south-1.amazonaws.com/dev/upload-url \
  -H "Content-Type: application/json" \
  -d '{
    "fileName": "test-audio.mp3",
    "fileType": "audio/mpeg",
    "messageId": "test-message-id"
  }'
```

**Expected**: Returns a pre-signed S3 URL for uploading files.

---

## 2. Test Message Endpoints (May Require Auth)

### Create a Message

```bash
curl -X POST https://kk9hsbofeh.execute-api.ap-south-1.amazonaws.com/dev/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_COGNITO_TOKEN" \
  -d '{
    "type": "text",
    "content": "This is a test message",
    "recipientEmail": "test@example.com",
    "deliveryType": "date",
    "triggerValue": "2025-12-31",
    "isPaid": false
  }'
```

**Expected**: Returns message ID and confirmation.

---

### Get All Messages

```bash
curl -X GET https://kk9hsbofeh.execute-api.ap-south-1.amazonaws.com/dev/messages \
  -H "Authorization: Bearer YOUR_COGNITO_TOKEN"
```

**Expected**: Returns list of messages for the authenticated user.

---

### Get Single Message

```bash
curl -X GET https://kk9hsbofeh.execute-api.ap-south-1.amazonaws.com/dev/messages/MESSAGE_ID \
  -H "Authorization: Bearer YOUR_COGNITO_TOKEN"
```

Replace `MESSAGE_ID` with an actual message ID from your database.

---

## 3. Test User Profile Endpoints

### Get User Profile

```bash
curl -X GET https://kk9hsbofeh.execute-api.ap-south-1.amazonaws.com/dev/user/profile \
  -H "Authorization: Bearer YOUR_COGNITO_TOKEN"
```

**Expected**: Returns user profile information.

---

### Update User Profile

```bash
curl -X PUT https://kk9hsbofeh.execute-api.ap-south-1.amazonaws.com/dev/user/profile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_COGNITO_TOKEN" \
  -d '{
    "displayName": "John Doe",
    "phoneNumber": "+1234567890"
  }'
```

---

## 4. Test Activity Tracking

```bash
curl -X POST https://kk9hsbofeh.execute-api.ap-south-1.amazonaws.com/dev/activity \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_COGNITO_TOKEN" \
  -d '{}'
```

**Expected**: Updates user's last activity timestamp.

---

## 5. Test Payment Endpoints

### Create Payment

```bash
curl -X POST https://kk9hsbofeh.execute-api.ap-south-1.amazonaws.com/dev/payment/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_COGNITO_TOKEN" \
  -d '{
    "messageId": "message-id-here",
    "amount": 99
  }'
```

**Expected**: Returns payment order details (Razorpay integration).

---

## 6. Testing with Postman

1. **Import Collection**:
   - Create a new collection in Postman
   - Set base URL: `https://kk9hsbofeh.execute-api.ap-south-1.amazonaws.com/dev`

2. **Set Authorization**:
   - Go to Collection settings → Authorization
   - Type: Bearer Token
   - Token: `YOUR_COGNITO_TOKEN`

3. **Create Requests**:
   - Add each endpoint as a new request
   - Set method (GET, POST, PUT, DELETE)
   - Add request body for POST/PUT requests

---

## 7. Check CloudWatch Logs

View function logs to debug issues:

```bash
# View logs for a specific function
aws logs tail /aws/lambda/afterlifemessage-backend-dev-testWhatsApp --follow --region ap-south-1

# View logs for checkTriggers
aws logs tail /aws/lambda/afterlifemessage-backend-dev-checkTriggers --follow --region ap-south-1
```

---

## 8. Common Test Scenarios

### ✅ Health Check
Test if API Gateway is responding:

```bash
curl -X GET https://kk9hsbofeh.execute-api.ap-south-1.amazonaws.com/dev/messages
```

**Expected**: Should return an error (401/403) if no auth, but confirms API is working.

---

### ✅ CORS Check
Test from browser console:

```javascript
fetch('https://kk9hsbofeh.execute-api.ap-south-1.amazonaws.com/dev/messages', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN'
  }
})
.then(r => r.json())
.then(console.log)
```

---

## 9. Expected Response Formats

### Success Response
```json
{
  "statusCode": 200,
  "body": {
    "message": "Success",
    "data": {...}
  }
}
```

### Error Response
```json
{
  "statusCode": 400,
  "body": {
    "error": "Error message",
    "details": "..."
  }
}
```

---

## 10. Troubleshooting

### Issue: 401 Unauthorized
- **Cause**: Missing or invalid Cognito token
- **Fix**: Set up Cognito User Pool and authenticate first

### Issue: 403 Forbidden
- **Cause**: Token valid but user doesn't have permission
- **Fix**: Check IAM roles and Cognito groups

### Issue: 500 Internal Server Error
- **Cause**: Lambda function error
- **Fix**: Check CloudWatch logs for the specific function

### Issue: Parameter not found (SSM)
- **Cause**: Missing secrets in SSM Parameter Store
- **Fix**: Run `./setup-secrets.sh dev` to store all secrets

---

## 11. Quick Test Script

Save this as `test-api.sh`:

```bash
#!/bin/bash

BASE_URL="https://kk9hsbofeh.execute-api.ap-south-1.amazonaws.com/dev"
TOKEN="YOUR_COGNITO_TOKEN_HERE"

echo "Testing WhatsApp endpoint..."
curl -X POST "$BASE_URL/test-whatsapp" \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "+1234567890", "message": "Test"}'

echo -e "\n\nTesting messages endpoint..."
curl -X GET "$BASE_URL/messages" \
  -H "Authorization: Bearer $TOKEN"
```

Make it executable:
```bash
chmod +x test-api.sh
./test-api.sh
```

---

## Next Steps

1. ✅ **Set up Cognito User Pool** (for authentication)
2. ✅ **Create DynamoDB tables** (for data storage)
3. ✅ **Create S3 bucket** (for file storage)
4. ✅ **Test with real authentication tokens**
5. ✅ **Test end-to-end message creation flow**

