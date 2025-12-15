# Deployment Workflow Guide

## Overview
This guide explains how to manage deployments for both development and production environments.

## Environment Setup

### Development Environment
- **Stage**: `dev`
- **S3 Bucket**: `afterlifemessage-dev`
- **API URL**: `https://27berxipfh.execute-api.ap-south-1.amazonaws.com/dev`
- **Configuration**: `env.development`

### Production Environment
- **Stage**: `prod`
- **S3 Bucket**: `afterlifemessage-prod`
- **API URL**: `https://27berxipfh.execute-api.ap-south-1.amazonaws.com/prod`
- **Configuration**: `env.production`

## Development Workflow

### 1. Local Development
```bash
# Start development server
npm start
```

### 2. Testing Changes
```bash
# Run tests
npm test

# Build for development testing
npm run build:dev
```

### 3. Deploy to Development
```bash
# Deploy backend to dev
npm run deploy:backend:dev

# Deploy frontend to dev
npm run deploy:dev

# Or deploy both together
npm run deploy:full:dev
```

## Production Deployment Workflow

### Prerequisites
1. All changes have been tested in development environment
2. Code review is complete
3. All tests pass

### Deployment Steps

#### Step 1: Deploy Backend to Production
```bash
# Deploy backend with prod stage
npm run deploy:backend:prod
```

#### Step 2: Deploy Frontend to Production
```bash
# Deploy frontend to production
npm run deploy:prod
```

#### Step 3: Deploy Both Together
```bash
# Deploy both backend and frontend to production
npm run deploy:full:prod
```

## Available Scripts

### Build Scripts
- `npm run build:dev` - Build for development environment
- `npm run build:prod` - Build for production environment

### Deployment Scripts
- `npm run deploy:dev` - Deploy frontend to development
- `npm run deploy:prod` - Deploy frontend to production
- `npm run deploy:backend:dev` - Deploy backend to development
- `npm run deploy:backend:prod` - Deploy backend to production
- `npm run deploy:full:dev` - Deploy both frontend and backend to development
- `npm run deploy:full:prod` - Deploy both frontend and backend to production

## Environment Configuration

### Development Environment Variables
```
REACT_APP_API_URL=https://27berxipfh.execute-api.ap-south-1.amazonaws.com/dev
REACT_APP_COGNITO_USER_POOL_ID=ap-south-1_STYxHAQAP
REACT_APP_COGNITO_CLIENT_ID=141mio422kgemdtpunrvfib9io
REACT_APP_S3_BUCKET=afterlifemessage-dev
REACT_APP_REGION=ap-south-1
REACT_APP_STAGE=dev
```

### Production Environment Variables
```
REACT_APP_API_URL=https://27berxipfh.execute-api.ap-south-1.amazonaws.com/prod
REACT_APP_COGNITO_USER_POOL_ID=ap-south-1_STYxHAQAP
REACT_APP_COGNITO_CLIENT_ID=141mio422kgemdtpunrvfib9io
REACT_APP_S3_BUCKET=afterlifemessage-prod
REACT_APP_REGION=ap-south-1
REACT_APP_STAGE=prod
```

## Best Practices

### 1. Always Test in Development First
- Make changes locally
- Test thoroughly in development environment
- Ensure all functionality works as expected

### 2. Use Feature Branches
- Create feature branches for new development
- Test changes in development before merging to main
- Use pull requests for code review

### 3. Monitor Deployments
- Check CloudWatch logs after deployment
- Verify API endpoints are working
- Test critical user flows

### 4. Rollback Plan
If issues are discovered in production:
1. Identify the problematic deployment
2. Revert to previous working version
3. Deploy the rollback using the same scripts

## Troubleshooting

### Common Issues

#### 1. Build Failures
```bash
# Clear cache and rebuild
rm -rf node_modules package-lock.json
npm install
npm run build:dev
```

#### 2. Deployment Failures
```bash
# Check AWS credentials
aws sts get-caller-identity

# Verify S3 bucket exists
aws s3 ls s3://afterlifemessage-dev
aws s3 ls s3://afterlifemessage-prod
```

#### 3. Environment Issues
- Ensure environment files are correctly configured
- Verify API Gateway URLs are correct
- Check Cognito configuration

## Security Considerations

### 1. Environment Variables
- Never commit sensitive information to version control
- Use AWS Secrets Manager for production secrets
- Rotate keys regularly

### 2. Access Control
- Use IAM roles with minimal required permissions
- Enable CloudTrail for audit logging
- Monitor access patterns

### 3. Data Protection
- Ensure encryption at rest and in transit
- Implement proper authentication and authorization
- Regular security audits

## Monitoring and Alerts

### 1. Set up CloudWatch Alarms
- API Gateway errors
- Lambda function errors
- S3 access patterns

### 2. Application Monitoring
- User experience metrics
- Performance monitoring
- Error tracking

### 3. Cost Monitoring
- AWS cost alerts
- Resource utilization
- Optimization opportunities 