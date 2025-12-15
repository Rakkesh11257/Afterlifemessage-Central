# AfterLifeMessage.in

A digital legacy platform that allows users to create heartfelt messages that will be delivered to their loved ones after they're gone or become inactive.

## 🎯 Project Overview

AfterLifeMessage.in is a secure, encrypted platform where users can:
- Write or record personal messages for loved ones
- Set delivery triggers (specific date or inactivity period)
- Pay ₹99 for lifetime message storage and delivery
- Have messages automatically delivered via email when conditions are met

## 🏗️ Architecture

### Frontend (React)
- **Hosting**: AWS S3 + CloudFront
- **Authentication**: AWS Cognito
- **UI**: React + Tailwind CSS
- **State Management**: React Context + Hooks

### Backend (AWS Serverless)
- **API**: AWS Lambda + API Gateway
- **Database**: DynamoDB
- **Storage**: S3 (encrypted messages)
- **Email**: Amazon SES
- **Scheduler**: EventBridge (daily trigger checks)
- **Payment**: Razorpay integration

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- AWS CLI configured
- Razorpay account
- Domain name (optional)

### 1. Frontend Setup

```bash
# Install dependencies
npm install

# Start development server
npm start
```

### 2. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Deploy to AWS
npm run deploy
```

### 3. AWS Configuration

1. **Create Cognito User Pool**
   - Go to AWS Cognito Console
   - Create User Pool with email sign-in
   - Create App Client
   - Update `src/aws-exports.js` with your pool details

2. **Configure SES**
   - Verify your domain in SES
   - Request production access if needed
   - Update environment variables

3. **Set up Razorpay**
   - Create Razorpay account
   - Get API keys
   - Set environment variables:
     ```bash
     export RAZORPAY_KEY_ID=your_key_id
     export RAZORPAY_KEY_SECRET=your_key_secret
     ```

### 4. Environment Variables

Create `.env` file in root directory:

```env
REACT_APP_API_URL=https://your-api-gateway-url.execute-api.us-east-1.amazonaws.com/dev
REACT_APP_COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
REACT_APP_COGNITO_CLIENT_ID=XXXXXXXXXXXXXXXXXXXXXXXXXX
REACT_APP_S3_BUCKET=afterlifemessage-dev
```

## 📁 Project Structure

```
afterlifemessage/
├── src/                     # React frontend source (active)
├── public/                  # Frontend static assets
├── backend/                 # AWS Lambda + API Gateway backend (active)
│   ├── functions/           # Lambda handlers
│   ├── utils/               # Shared backend utilities
│   ├── serverless.yml       # Serverless configuration (single source of truth)
│   └── package.json         # Backend dependencies & scripts
├── archive/                 # Legacy / inactive code (kept for reference)
│   └── ec2-backend/         # Old EC2-based backend (no longer deployed)
├── build/                   # Frontend build artifacts
├── *.md                     # Documentation (deployment, setup, checklists)
└── README.md                # This file
```

> **Note:** Only `backend/serverless.yml` is used for backend deployment now.  
> The code under `archive/` is not part of the live system and should not be modified for new features.

## 🔧 Development

### Frontend Development
```bash
# Start development server
npm start

# Build for production
npm run build

# Deploy to S3
aws s3 sync build/ s3://your-bucket-name
```

### Backend Development
```bash
# Deploy to AWS
cd backend
npm run deploy

# Deploy to production
npm run deploy:prod
```

## 🔐 Security Features

- **AES-256 Encryption**: All messages encrypted before storage
- **S3 Server-Side Encryption**: Additional layer for file storage
- **Cognito Authentication**: Secure user management
- **IAM Roles**: Least privilege access
- **HTTPS Only**: All communications encrypted

## 💰 Pricing Model

- **Basic Message**: ₹99 (one-time)
  - 1 message to 1 recipient
  - Text or voice message
  - Lifetime storage
  - Email delivery

## 📧 Email Delivery

Messages are delivered via Amazon SES with:
- Professional HTML templates
- Audio file links (7-day expiry)
- Responsive design
- Branded styling

## 🔄 Daily Trigger System

The system runs daily checks for:
1. **Date-based delivery**: Messages scheduled for specific dates
2. **Inactivity-based delivery**: Messages triggered by user inactivity
3. **Automatic email sending**: Secure delivery to recipients

## 🛠️ AWS Services Used

| Service | Purpose |
|---------|---------|
| S3 | Static hosting + encrypted file storage |
| CloudFront | CDN for frontend |
| Cognito | User authentication |
| Lambda | Backend functions |
| API Gateway | REST API endpoints |
| DynamoDB | Message and user data |
| SES | Email delivery |
| EventBridge | Daily trigger scheduler |
| Route 53 | DNS management |
| ACM | SSL certificates |

## 📊 Database Schema

### Messages Table
```json
{
  "messageId": "UUID",
  "userId": "Cognito User ID",
  "type": "text|audio",
  "content": "encrypted_text",
  "s3Key": "audio_file_path",
  "recipientEmail": "email@example.com",
  "deliveryType": "date|inactivity",
  "triggerValue": "date_or_months",
  "deliveryDate": "YYYY-MM-DD",
  "isPaid": "boolean",
  "delivered": "boolean",
  "createdAt": "ISO timestamp",
  "updatedAt": "ISO timestamp"
}
```

### Users Table
```json
{
  "userId": "Cognito User ID",
  "email": "user@example.com",
  "lastActive": "ISO timestamp",
  "createdAt": "ISO timestamp",
  "updatedAt": "ISO timestamp"
}
```

## 🚀 Deployment Checklist

### Frontend
- [ ] Build React app
- [ ] Upload to S3 bucket
- [ ] Configure CloudFront distribution
- [ ] Set up custom domain (optional)
- [ ] Configure SSL certificate

### Backend
- [ ] Deploy Lambda functions
- [ ] Configure API Gateway
- [ ] Set up DynamoDB tables
- [ ] Configure SES
- [ ] Set up EventBridge rules
- [ ] Configure Razorpay webhook

### Security
- [ ] Update Cognito configuration
- [ ] Set encryption keys
- [ ] Configure IAM roles
- [ ] Enable CloudWatch logging
- [ ] Set up monitoring alerts

## 📈 Monitoring & Analytics

- **CloudWatch Logs**: Lambda function logs
- **CloudWatch Metrics**: API Gateway metrics
- **SES Delivery Reports**: Email delivery tracking
- **Custom Analytics**: Message creation and delivery stats

## 🔧 Troubleshooting

### Common Issues

1. **Cognito Authentication Fails**
   - Check user pool configuration
   - Verify app client settings
   - Check CORS settings

2. **Lambda Functions Not Working**
   - Check CloudWatch logs
   - Verify IAM permissions
   - Check environment variables

3. **Email Not Delivering**
   - Verify SES configuration
   - Check recipient email format
   - Review SES sending limits

4. **Payment Issues**
   - Verify Razorpay webhook URL
   - Check webhook signature
   - Review payment logs

## 📞 Support

For technical support or questions:
- Email: support@afterlifemessage.in
- GitHub Issues: [Create an issue](https://github.com/your-repo/issues)

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- AWS for serverless infrastructure
- Razorpay for payment processing
- React and Tailwind CSS for frontend
- The open-source community

---

**AfterLifeMessage.in** - Preserving your legacy, one message at a time. ❤️ 

# SECURITY NOTE

**Never commit `.env`, `.env.production`, or any secret files to version control. Use AWS SSM/Secrets Manager for all production secrets.** 