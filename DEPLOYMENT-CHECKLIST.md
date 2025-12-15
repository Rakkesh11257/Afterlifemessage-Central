# AfterLifeMessage.in Deployment Checklist

## ✅ Completed
- [x] User Pool ID: `ap-south-1_STYxHAQAP`
- [x] Updated environment variables with correct region (ap-south-1)
- [x] Updated serverless.yml with correct region
- [x] Updated aws-config.js with User Pool ID
- [x] All Lambda functions ready
- [x] React frontend ready

## ⏳ In Progress
- [ ] User Pool creation (waiting for completion)
- [ ] App Client creation (waiting for User Pool)
- [ ] Identity Pool creation (waiting for App Client)

## 🔄 Next Steps (After Cognito Setup)

### 1. AWS Credentials Setup
- [ ] Configure AWS CLI credentials
- [ ] Set up AWS profile for deployment
- [ ] Verify AWS permissions

### 2. Razorpay Integration
- [ ] Get Razorpay API keys
- [ ] Configure payment webhook
- [ ] Test payment flow

### 3. Backend Deployment
- [ ] Install serverless framework
- [ ] Deploy Lambda functions
- [ ] Create DynamoDB tables
- [ ] Set up S3 bucket
- [ ] Configure SES
- [ ] Set up EventBridge rules

### 4. Frontend Configuration
- [ ] Update App Client ID in aws-config.js
- [ ] Update API Gateway URL
- [ ] Test authentication flow
- [ ] Test message creation

### 5. Testing
- [ ] Test user registration/login
- [ ] Test message creation
- [ ] Test payment flow
- [ ] Test email delivery
- [ ] Test inactivity triggers

## 📋 Required Information
- [ ] App Client ID (after User Pool creation)
- [ ] Identity Pool ID (after App Client creation)
- [ ] Razorpay Key ID and Secret
- [ ] AWS API Gateway URL (after deployment)
- [ ] S3 bucket name (after deployment)

## 🚀 Deployment Commands
```bash
# Backend deployment
cd backend
npm install
serverless deploy

# Frontend deployment
npm start
```

## 📞 Support
- AWS Cognito: User authentication
- AWS Lambda: Backend logic
- AWS DynamoDB: Data storage
- AWS S3: File storage
- AWS SES: Email delivery
- AWS EventBridge: Scheduling
- Razorpay: Payment processing 