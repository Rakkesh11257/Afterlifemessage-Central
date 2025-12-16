# 🧪 Frontend + Backend Testing Guide

## ✅ Backend Status
- **API Base URL**: `https://kk9hsbofeh.execute-api.ap-south-1.amazonaws.com/dev`
- **Status**: ✅ Deployed and running
- **Region**: `ap-south-1`

## 📋 Prerequisites Checklist

Before testing, ensure you have:

- [ ] **Cognito User Pool** created and configured
- [ ] **DynamoDB Tables** created:
  - `afterlifemessage-backend-users-dev`
  - `afterlifemessage-backend-messages-dev`
- [ ] **S3 Bucket** created: `afterlifemessage-dev`
- [ ] **Secrets stored** in SSM Parameter Store (already done ✅)

---

## 🚀 Option 1: Test Frontend Locally (Recommended for Development)

### Step 1: Install Frontend Dependencies

```bash
cd /Users/rakkeshraja/Downloads/Afterlifemessege
npm install
```

### Step 2: Create Environment File

Create `.env.development` in the root directory:

```bash
cat > .env.development << 'EOF'
REACT_APP_API_URL=https://kk9hsbofeh.execute-api.ap-south-1.amazonaws.com/dev
REACT_APP_COGNITO_USER_POOL_ID=YOUR_USER_POOL_ID
REACT_APP_COGNITO_CLIENT_ID=YOUR_CLIENT_ID
REACT_APP_S3_BUCKET=afterlifemessage-dev
REACT_APP_REGION=ap-south-1
REACT_APP_ENV=development
EOF
```

**Replace**:
- `YOUR_USER_POOL_ID` - Your Cognito User Pool ID
- `YOUR_CLIENT_ID` - Your Cognito App Client ID

### Step 3: Update Cognito Config

Update `src/config/development.js` with your actual Cognito details:

```javascript
Auth: {
  region: 'ap-south-1',
  userPoolId: 'YOUR_USER_POOL_ID',  // Replace this
  userPoolWebClientId: 'YOUR_CLIENT_ID',  // Replace this
  // ... rest of config
}
```

### Step 4: Start Frontend

```bash
npm start
```

The app will open at `http://localhost:3000`

---

## 🌐 Option 2: Deploy Frontend to S3 (For Testing in Browser)

### Step 1: Build Frontend

```bash
npm run build:dev
```

### Step 2: Deploy to S3

```bash
aws s3 sync build/ s3://afterlifemessage-frontend-dev --delete --region ap-south-1
```

### Step 3: Enable Static Website Hosting

```bash
aws s3 website s3://afterlifemessage-frontend-dev \
  --index-document index.html \
  --error-document index.html \
  --region ap-south-1
```

### Step 4: Access Frontend

Visit: `http://afterlifemessage-frontend-dev.s3-website.ap-south-1.amazonaws.com`

---

## 🔐 Step-by-Step: Set Up Cognito (If Not Done)

### 1. Create Cognito User Pool

```bash
aws cognito-idp create-user-pool \
  --pool-name afterlifemessage-users-dev \
  --region ap-south-1 \
  --auto-verified-attributes email
```

**Note**: This will output a User Pool ID. Save it!

### 2. Create App Client

```bash
aws cognito-idp create-user-pool-client \
  --user-pool-id YOUR_USER_POOL_ID \
  --client-name afterlifemessage-web-client \
  --region ap-south-1 \
  --generate-secret \
  --explicit-auth-flows ALLOW_USER_PASSWORD_AUTH ALLOW_REFRESH_TOKEN_AUTH
```

**Note**: This will output a Client ID. Save it!

### 3. Update Frontend Config

Update `src/config/development.js` with the IDs from above.

---

## 🗄️ Step-by-Step: Create DynamoDB Tables

### 1. Create Users Table

```bash
aws dynamodb create-table \
  --table-name afterlifemessage-backend-users-dev \
  --attribute-definitions \
    AttributeName=userId,AttributeType=S \
  --key-schema \
    AttributeName=userId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region ap-south-1
```

### 2. Create Messages Table

```bash
aws dynamodb create-table \
  --table-name afterlifemessage-backend-messages-dev \
  --attribute-definitions \
    AttributeName=messageId,AttributeType=S \
    AttributeName=userId,AttributeType=S \
  --key-schema \
    AttributeName=messageId,KeyType=HASH \
  --global-secondary-indexes \
    IndexName=userId-index,KeySchema=[{AttributeName=userId,KeyType=HASH}],Projection={ProjectionType=ALL} \
  --billing-mode PAY_PER_REQUEST \
  --region ap-south-1
```

---

## 🪣 Step-by-Step: Create S3 Bucket

```bash
# Create bucket
aws s3 mb s3://afterlifemessage-dev --region ap-south-1

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket afterlifemessage-dev \
  --versioning-configuration Status=Enabled \
  --region ap-south-1

# Set CORS (use backend/s3-cors.json)
aws s3api put-bucket-cors \
  --bucket afterlifemessage-dev \
  --cors-configuration file://backend/s3-cors.json \
  --region ap-south-1
```

---

## 🧪 Testing Workflow

### 1. Test Backend API First

```bash
cd backend
./test-api.sh
```

**Expected**: Should see API responses (may have auth errors, which is normal).

### 2. Test Frontend Locally

```bash
# Terminal 1: Start frontend
npm start

# Terminal 2: Watch backend logs
aws logs tail /aws/lambda/afterlifemessage-backend-dev-createMessage --follow --region ap-south-1
```

### 3. Test End-to-End Flow

1. **Open browser**: `http://localhost:3000`
2. **Sign up/Login**: Use Cognito authentication
3. **Create message**: Test message creation flow
4. **Check backend logs**: Verify Lambda functions are being called
5. **Check DynamoDB**: Verify data is being stored

---

## 🔍 Debugging Tips

### Check Backend Logs

```bash
# View all Lambda logs
aws logs tail /aws/lambda/afterlifemessage-backend-dev-createMessage --follow --region ap-south-1

# View API Gateway logs
aws logs tail /aws/apigateway/afterlifemessage-backend-dev --follow --region ap-south-1
```

### Check Frontend Console

Open browser DevTools (F12) and check:
- **Console**: For JavaScript errors
- **Network**: For API request/response details
- **Application**: For Cognito tokens

### Common Issues

#### ❌ CORS Error
- **Fix**: Check `backend/s3-cors.json` and ensure CORS is configured on API Gateway

#### ❌ 401 Unauthorized
- **Fix**: Verify Cognito User Pool ID and Client ID are correct
- **Fix**: Check if user is logged in (check browser localStorage)

#### ❌ 500 Internal Server Error
- **Fix**: Check CloudWatch logs for the specific Lambda function
- **Fix**: Verify DynamoDB tables exist
- **Fix**: Verify SSM secrets are stored correctly

#### ❌ API Not Found
- **Fix**: Verify API URL in `src/services/api.js` matches deployed backend
- **Fix**: Check API Gateway stage name (`/dev`)

---

## 📊 Quick Test Checklist

- [ ] Backend API responds to `/test-whatsapp`
- [ ] Frontend loads without errors
- [ ] User can sign up/login via Cognito
- [ ] User can create a message
- [ ] Message appears in DynamoDB
- [ ] File upload to S3 works
- [ ] User can view their messages
- [ ] User can update/delete messages

---

## 🎯 Next Steps After Testing

1. ✅ Fix any bugs found during testing
2. ✅ Set up production environment (`prod` stage)
3. ✅ Configure custom domain for frontend
4. ✅ Set up CloudFront for CDN
5. ✅ Enable monitoring and alerts

---

## 📝 Notes

- **API URL**: Already updated in `src/services/api.js` and `src/config/development.js`
- **Cognito**: You'll need to create/configure this if not already done
- **DynamoDB**: Tables need to be created before messages can be stored
- **S3**: Bucket needs to be created for file uploads

