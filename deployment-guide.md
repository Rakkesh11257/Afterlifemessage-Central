# AfterLifeMessage.in - AWS Deployment Guide

This guide will walk you through deploying the complete AfterLifeMessage.in infrastructure on AWS.

## 🎯 Prerequisites

1. **AWS Account** with appropriate permissions
2. **AWS CLI** installed and configured
3. **Node.js 18+** installed
4. **Serverless Framework** installed globally
5. **Domain name** (optional but recommended)

## 📋 Step-by-Step Deployment

### Step 1: AWS Infrastructure Setup

#### 1.1 Create S3 Bucket for Frontend
```bash
aws s3 mb s3://afterlifemessage-frontend
aws s3 website --index-document index.html --error-document index.html s3://afterlifemessage-frontend
```

#### 1.2 Create S3 Bucket for Encrypted Messages
```bash
aws s3 mb s3://afterlifemessage-encrypted-messages
```

#### 1.3 Configure S3 Bucket Encryption
```bash
aws s3api put-bucket-encryption \
  --bucket afterlifemessage-encrypted-messages \
  --server-side-encryption-configuration '{
    "Rules": [
      {
        "ApplyServerSideEncryptionByDefault": {
          "SSEAlgorithm": "AES256"
        }
      }
    ]
  }'
```

### Step 2: AWS Cognito Setup

#### 2.1 Create User Pool
```bash
aws cognito-idp create-user-pool \
  --pool-name "AfterLifeMessage-Users" \
  --policies '{
    "PasswordPolicy": {
      "MinimumLength": 8,
      "RequireUppercase": true,
      "RequireLowercase": true,
      "RequireNumbers": true,
      "RequireSymbols": false
    }
  }' \
  --auto-verified-attributes email \
  --username-attributes email
```

#### 2.2 Create App Client
```bash
aws cognito-idp create-user-pool-client \
  --user-pool-id YOUR_USER_POOL_ID \
  --client-name "AfterLifeMessage-WebClient" \
  --no-generate-secret \
  --explicit-auth-flows ALLOW_USER_PASSWORD_AUTH ALLOW_REFRESH_TOKEN_AUTH
```

#### 2.3 Create Identity Pool
```bash
aws cognito-identity create-identity-pool \
  --identity-pool-name "AfterLifeMessage-IdentityPool" \
  --allow-unauthenticated-identities false \
  --cognito-identity-providers ProviderName="cognito-idp.us-east-1.amazonaws.com/YOUR_USER_POOL_ID",ClientId="YOUR_CLIENT_ID",ServerSideTokenCheck=false
```

### Step 3: Amazon SES Configuration

#### 3.1 Verify Domain
```bash
aws ses verify-domain-identity --domain afterlifemessage.in
```

#### 3.2 Create Email Template
```bash
aws ses create-template \
  --template '{
    "TemplateName": "AfterLifeMessage-Delivery",
    "SubjectPart": "You have received a message from AfterLifeMessage.in",
    "HtmlPart": "<!DOCTYPE html><html><head><title>Message from AfterLifeMessage.in</title></head><body><h1>You have received a heartfelt message</h1><p>{{message}}</p></body></html>",
    "TextPart": "You have received a message from AfterLifeMessage.in\n\n{{message}}"
  }'
```

### Step 4: DynamoDB Tables

#### 4.1 Create Messages Table
```bash
aws dynamodb create-table \
  --table-name afterlifemessage-messages-dev \
  --attribute-definitions AttributeName=messageId,AttributeType=S AttributeName=userId,AttributeType=S AttributeName=deliveryDate,AttributeType=S \
  --key-schema AttributeName=messageId,KeyType=HASH \
  --global-secondary-indexes '[
    {
      "IndexName": "UserIdIndex",
      "KeySchema": [{"AttributeName": "userId", "KeyType": "HASH"}],
      "Projection": {"ProjectionType": "ALL"}
    },
    {
      "IndexName": "DeliveryDateIndex",
      "KeySchema": [{"AttributeName": "deliveryDate", "KeyType": "HASH"}],
      "Projection": {"ProjectionType": "ALL"}
    }
  ]' \
  --billing-mode PAY_PER_REQUEST
```

#### 4.2 Create Users Table
```bash
aws dynamodb create-table \
  --table-name afterlifemessage-users-dev \
  --attribute-definitions AttributeName=userId,AttributeType=S AttributeName=email,AttributeType=S \
  --key-schema AttributeName=userId,KeyType=HASH \
  --global-secondary-indexes '[
    {
      "IndexName": "EmailIndex",
      "KeySchema": [{"AttributeName": "email", "KeyType": "HASH"}],
      "Projection": {"ProjectionType": "ALL"}
    }
  ]' \
  --billing-mode PAY_PER_REQUEST
```

### Step 5: Backend Deployment

#### 5.1 Install Serverless Framework
```bash
npm install -g serverless
```

#### 5.2 Configure Environment Variables
```bash
export RAZORPAY_KEY_ID=your_razorpay_key_id
export RAZORPAY_KEY_SECRET=your_razorpay_key_secret
export ENCRYPTION_KEY=your_secure_encryption_key
```

#### 5.3 Deploy Backend
```bash
cd backend
npm install
serverless deploy --stage dev
```

### Step 6: Frontend Deployment

#### 6.1 Build React App
```bash
npm install
npm run build
```

#### 6.2 Deploy to S3
```bash
aws s3 sync build/ s3://afterlifemessage-frontend
```

#### 6.3 Configure CloudFront
```bash
# Create CloudFront distribution
aws cloudfront create-distribution \
  --distribution-config '{
    "CallerReference": "afterlifemessage-frontend",
    "Origins": {
      "Quantity": 1,
      "Items": [
        {
          "Id": "S3-afterlifemessage-frontend",
          "DomainName": "afterlifemessage-frontend.s3-website-us-east-1.amazonaws.com",
          "S3OriginConfig": {
            "OriginAccessIdentity": ""
          }
        }
      ]
    },
    "DefaultCacheBehavior": {
      "TargetOriginId": "S3-afterlifemessage-frontend",
      "ViewerProtocolPolicy": "redirect-to-https",
      "TrustedSigners": {
        "Enabled": false,
        "Quantity": 0
      },
      "ForwardedValues": {
        "QueryString": false,
        "Cookies": {
          "Forward": "none"
        }
      },
      "MinTTL": 0
    },
    "Enabled": true
  }'
```

### Step 7: Domain and SSL Setup

#### 7.1 Request SSL Certificate
```bash
aws acm request-certificate \
  --domain-name afterlifemessage.in \
  --subject-alternative-names "*.afterlifemessage.in" \
  --validation-method DNS
```

#### 7.2 Configure Route 53
```bash
# Create hosted zone
aws route53 create-hosted-zone --name afterlifemessage.in --caller-reference $(date +%s)

# Add DNS records for CloudFront
aws route53 change-resource-record-sets \
  --hosted-zone-id YOUR_HOSTED_ZONE_ID \
  --change-batch '{
    "Changes": [
      {
        "Action": "CREATE",
        "ResourceRecordSet": {
          "Name": "afterlifemessage.in",
          "Type": "A",
          "AliasTarget": {
            "HostedZoneId": "Z2FDTNDATAQYW2",
            "DNSName": "YOUR_CLOUDFRONT_DOMAIN",
            "EvaluateTargetHealth": false
          }
        }
      }
    ]
  }'
```

### Step 8: EventBridge Setup

#### 8.1 Create Daily Trigger Rule
```bash
aws events put-rule \
  --name "AfterLifeMessage-DailyTrigger" \
  --schedule-expression "rate(1 day)" \
  --description "Daily trigger check for message delivery"
```

#### 8.2 Add Lambda Target
```bash
aws events put-targets \
  --rule "AfterLifeMessage-DailyTrigger" \
  --targets '[
    {
      "Id": "CheckTriggersLambda",
      "Arn": "YOUR_LAMBDA_FUNCTION_ARN",
      "Input": "{}"
    }
  ]'
```

### Step 9: Razorpay Integration

#### 9.1 Configure Webhook
1. Go to Razorpay Dashboard
2. Navigate to Settings > Webhooks
3. Add webhook URL: `https://your-api-gateway-url.execute-api.us-east-1.amazonaws.com/dev/payment/webhook`
4. Select events: `payment.captured`

#### 9.2 Test Payment Flow
```bash
# Test webhook locally
curl -X POST https://your-api-gateway-url.execute-api.us-east-1.amazonaws.com/dev/payment/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "razorpay_payment_id": "pay_test123",
    "razorpay_order_id": "order_test123",
    "razorpay_signature": "test_signature",
    "payload": {
      "notes": {
        "messageId": "test-message-id"
      }
    }
  }'
```

## 🔧 Configuration Files

### Update AWS Configuration
Update `src/aws-exports.js` with your actual values:

```javascript
const awsmobile = {
  "aws_project_region": "us-east-1",
  "aws_cognito_identity_pool_id": "us-east-1:YOUR_IDENTITY_POOL_ID",
  "aws_cognito_region": "us-east-1",
  "aws_user_pools_id": "us-east-1_YOUR_USER_POOL_ID",
  "aws_user_pools_web_client_id": "YOUR_CLIENT_ID",
  "oauth": {},
  "aws_cloud_logic_custom": [
    {
      "name": "AfterLifeMessageAPI",
      "endpoint": "https://YOUR_API_GATEWAY_URL.execute-api.us-east-1.amazonaws.com/dev",
      "region": "us-east-1"
    }
  ],
  "aws_user_files_s3_bucket": "afterlifemessage-encrypted-messages",
  "aws_user_files_s3_region": "us-east-1"
};
```

### Environment Variables
Create `.env` file:

```env
REACT_APP_API_URL=https://YOUR_API_GATEWAY_URL.execute-api.us-east-1.amazonaws.com/dev
REACT_APP_COGNITO_USER_POOL_ID=us-east-1_YOUR_USER_POOL_ID
REACT_APP_COGNITO_CLIENT_ID=YOUR_CLIENT_ID
REACT_APP_S3_BUCKET=afterlifemessage-encrypted-messages
```

## 🧪 Testing

### 1. Test Authentication
```bash
# Test user registration
curl -X POST https://your-api-gateway-url.execute-api.us-east-1.amazonaws.com/dev/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "TestPassword123"}'
```

### 2. Test Message Creation
```bash
# Test message creation (with auth token)
curl -X POST https://your-api-gateway-url.execute-api.us-east-1.amazonaws.com/dev/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{
    "type": "text",
    "content": "Test message",
    "recipientEmail": "recipient@example.com",
    "deliveryType": "date",
    "triggerValue": "2025-01-01"
  }'
```

### 3. Test Email Delivery
```bash
# Test SES email sending
aws ses send-email \
  --from "noreply@afterlifemessage.in" \
  --destination "ToAddresses=test@example.com" \
  --message '{
    "Subject": {
      "Data": "Test Message"
    },
    "Body": {
      "Text": {
        "Data": "This is a test message"
      }
    }
  }'
```

## 📊 Monitoring Setup

### 1. CloudWatch Dashboards
```bash
# Create dashboard for monitoring
aws cloudwatch put-dashboard \
  --dashboard-name "AfterLifeMessage-Monitoring" \
  --dashboard-body '{
    "widgets": [
      {
        "type": "metric",
        "properties": {
          "metrics": [
            ["AWS/Lambda", "Invocations", "FunctionName", "afterlifemessage-backend-dev-createMessage"]
          ],
          "period": 300,
          "stat": "Sum",
          "region": "us-east-1",
          "title": "Message Creation"
        }
      }
    ]
  }'
```

### 2. Set up Alarms
```bash
# Create alarm for failed deliveries
aws cloudwatch put-metric-alarm \
  --alarm-name "AfterLifeMessage-FailedDeliveries" \
  --alarm-description "Alarm for failed message deliveries" \
  --metric-name "Errors" \
  --namespace "AWS/Lambda" \
  --statistic "Sum" \
  --period 300 \
  --threshold 1 \
  --comparison-operator "GreaterThanThreshold" \
  --evaluation-periods 1 \
  --dimensions "Name=FunctionName,Value=afterlifemessage-backend-dev-checkTriggers"
```

## 🔐 Security Hardening

### 1. Enable CloudTrail
```bash
aws cloudtrail create-trail \
  --name "AfterLifeMessage-Trail" \
  --s3-bucket-name "afterlifemessage-logs" \
  --include-global-service-events
```

### 2. Configure WAF (Optional)
```bash
# Create WAF web ACL for API Gateway
aws wafv2 create-web-acl \
  --name "AfterLifeMessage-WAF" \
  --scope REGIONAL \
  --default-action '{"Allow": {}}' \
  --description "WAF for AfterLifeMessage API"
```

## 🚀 Production Deployment

### 1. Deploy to Production
```bash
# Deploy backend to production
cd backend
serverless deploy --stage production

# Deploy frontend to production
npm run build
aws s3 sync build/ s3://afterlifemessage-frontend-prod
```

### 2. Update DNS
```bash
# Update Route 53 for production
aws route53 change-resource-record-sets \
  --hosted-zone-id YOUR_HOSTED_ZONE_ID \
  --change-batch '{
    "Changes": [
      {
        "Action": "UPSERT",
        "ResourceRecordSet": {
          "Name": "afterlifemessage.in",
          "Type": "A",
          "AliasTarget": {
            "HostedZoneId": "Z2FDTNDATAQYW2",
            "DNSName": "YOUR_PRODUCTION_CLOUDFRONT_DOMAIN",
            "EvaluateTargetHealth": false
          }
        }
      }
    ]
  }'
```

## 📞 Support and Troubleshooting

### Common Issues:

1. **CORS Errors**: Check API Gateway CORS settings
2. **Authentication Failures**: Verify Cognito configuration
3. **Lambda Timeouts**: Increase timeout in serverless.yml
4. **SES Bounces**: Check email verification status

### Useful Commands:

```bash
# Check Lambda logs
aws logs tail /aws/lambda/afterlifemessage-backend-dev-createMessage --follow

# Test API Gateway
aws apigateway test-invoke-method \
  --rest-api-id YOUR_API_ID \
  --resource-id YOUR_RESOURCE_ID \
  --http-method POST \
  --path-with-query-string "/messages" \
  --body "{\"type\":\"text\",\"content\":\"test\"}"

# Monitor DynamoDB
aws dynamodb scan --table-name afterlifemessage-messages-dev --limit 10
```

---

**AfterLifeMessage.in** - Your complete AWS deployment guide! 🚀 