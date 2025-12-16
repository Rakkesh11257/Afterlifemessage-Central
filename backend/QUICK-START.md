# 🚀 Quick Start: Deploy Backend with Secrets

## Step 1: Store Secrets in AWS SSM

Before deploying, store all secrets in AWS SSM Parameter Store:

```bash
cd backend
./setup-secrets.sh dev
```

This will prompt you for:
- ZeptoMail password and email
- WhatsApp access token and phone number ID
- Encryption key (32-byte hex)
- Twilio credentials (optional)
- Razorpay credentials (optional)

**Or** set them as environment variables:

```bash
export ZEPTO_PASSWORD="your-password"
export WHATSAPP_ACCESS_TOKEN="your-token"
# ... etc
./setup-secrets.sh dev
```

## Step 2: Deploy Backend

```bash
cd backend
serverless deploy --stage dev
```

## Step 3: Update API Gateway URL (After First Deployment)

After deployment, get your API Gateway URL and store it:

```bash
# Get the API Gateway URL from deployment output
# It will look like: https://abc123xyz.execute-api.ap-south-1.amazonaws.com

# Store it in SSM
aws ssm put-parameter \
  --name "/afterlifemessage/dev/api-gateway-url" \
  --value "https://YOUR_API_ID.execute-api.ap-south-1.amazonaws.com" \
  --type "String" \
  --overwrite
```

## Step 4: Redeploy (to pick up API Gateway URL)

```bash
serverless deploy --stage dev
```

## Production Deployment

Repeat for production:

```bash
# Store production secrets
./setup-secrets.sh prod

# Deploy
serverless deploy --stage prod

# Store production API Gateway URL
aws ssm put-parameter \
  --name "/afterlifemessage/prod/api-gateway-url" \
  --value "https://YOUR_PROD_API_ID.execute-api.ap-south-1.amazonaws.com" \
  --type "String" \
  --overwrite

# Redeploy
serverless deploy --stage prod
```

## Verify Secrets

List all stored secrets:

```bash
aws ssm get-parameters-by-path \
  --path "/afterlifemessage/dev" \
  --recursive \
  --query "Parameters[*].Name" \
  --output table
```

## Troubleshooting

- **"Parameter not found"**: Run `./setup-secrets.sh dev` first
- **"Access denied"**: Check your AWS credentials and IAM permissions
- See `SECRETS-SETUP.md` for detailed troubleshooting

