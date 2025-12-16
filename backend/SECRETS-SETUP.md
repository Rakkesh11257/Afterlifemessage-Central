# 🔐 Secrets Setup Guide

This guide explains how to securely store secrets in AWS SSM Parameter Store before deploying the backend.

## Why SSM Parameter Store?

- ✅ **Secure**: Secrets are encrypted at rest in AWS
- ✅ **No hardcoding**: Secrets never appear in code or Git
- ✅ **Stage-specific**: Separate secrets for `dev` and `prod`
- ✅ **Easy rotation**: Update secrets in AWS Console without redeploying code
- ✅ **Cost-effective**: Free for standard parameters (up to 10,000)

## Prerequisites

1. AWS CLI installed and configured
2. IAM permissions to create SSM parameters
3. Your actual secret values ready (ZeptoMail, WhatsApp, etc.)

## Step 1: Store Secrets in SSM

### Option A: Interactive Script (Recommended)

Run the setup script and enter secrets when prompted:

```bash
cd backend
./setup-secrets.sh dev
```

For production:

```bash
./setup-secrets.sh prod
```

### Option B: Manual AWS CLI Commands

Store each secret individually:

```bash
# Set AWS region
export AWS_REGION=ap-south-1

# ZeptoMail
aws ssm put-parameter \
  --name "/afterlifemessage/dev/zepto-password" \
  --value "your-actual-password" \
  --type "SecureString" \
  --overwrite

aws ssm put-parameter \
  --name "/afterlifemessage/dev/zepto-from-email" \
  --value "noreply@your-domain.com" \
  --type "String" \
  --overwrite

# WhatsApp
aws ssm put-parameter \
  --name "/afterlifemessage/dev/whatsapp-access-token" \
  --value "your-access-token" \
  --type "SecureString" \
  --overwrite

aws ssm put-parameter \
  --name "/afterlifemessage/dev/whatsapp-phone-number-id" \
  --value "your-phone-number-id" \
  --type "String" \
  --overwrite

# Encryption Key (32-byte hex)
aws ssm put-parameter \
  --name "/afterlifemessage/dev/encryption-key" \
  --value "your-32-byte-hex-key" \
  --type "SecureString" \
  --overwrite

# Twilio (if used)
aws ssm put-parameter \
  --name "/afterlifemessage/dev/twilio-account-sid" \
  --value "your-sid" \
  --type "SecureString" \
  --overwrite

aws ssm put-parameter \
  --name "/afterlifemessage/dev/twilio-auth-token" \
  --value "your-token" \
  --type "SecureString" \
  --overwrite

aws ssm put-parameter \
  --name "/afterlifemessage/dev/twilio-whatsapp-number" \
  --value "whatsapp:+1XXXXXXXXXX" \
  --type "String" \
  --overwrite
```

## Step 2: Verify Secrets Are Stored

List all secrets for your stage:

```bash
aws ssm get-parameters-by-path \
  --path "/afterlifemessage/dev" \
  --recursive \
  --query "Parameters[*].[Name,Type]" \
  --output table
```

## Step 3: Deploy Backend

After secrets are stored, deploy your backend:

```bash
cd backend
serverless deploy --stage dev
```

The `serverless.yml` will automatically read secrets from SSM Parameter Store.

## Step 4: Update API Gateway ID (After First Deployment)

After the first deployment, get your API Gateway ID and store it:

```bash
# Get API Gateway ID
API_ID=$(aws apigateway get-rest-apis \
  --query "items[?name=='afterlifemessage-backend-dev'].id" \
  --output text)

# Store it in SSM
aws ssm put-parameter \
  --name "/afterlifemessage/dev/api-gateway-id" \
  --value "$API_ID" \
  --type "String" \
  --overwrite
```

## Secret Path Structure

All secrets follow this pattern:

```
/afterlifemessage/{stage}/{secret-name}
```

Examples:
- `/afterlifemessage/dev/zepto-password`
- `/afterlifemessage/prod/whatsapp-access-token`

## Updating Secrets

To update a secret without redeploying:

```bash
aws ssm put-parameter \
  --name "/afterlifemessage/dev/zepto-password" \
  --value "new-password" \
  --type "SecureString" \
  --overwrite
```

**Note**: Lambda functions cache environment variables. After updating a secret, you may need to:
1. Update the Lambda function's environment variable (redeploy), OR
2. Restart the Lambda function to pick up the new value

## Security Best Practices

1. ✅ **Never commit secrets** to Git
2. ✅ **Use different secrets** for `dev` and `prod`
3. ✅ **Rotate secrets regularly** (especially API keys)
4. ✅ **Use least privilege IAM** - only Lambda functions that need secrets should have SSM read permissions
5. ✅ **Monitor secret access** via CloudTrail

## Troubleshooting

### Error: "Parameter not found"

- Check the parameter path matches exactly: `/afterlifemessage/{stage}/{name}`
- Verify the stage matches your deployment stage (`dev` or `prod`)
- List parameters: `aws ssm get-parameters-by-path --path "/afterlifemessage/dev" --recursive`

### Error: "Access Denied"

- Ensure your IAM user/role has `ssm:PutParameter` permission
- Ensure Lambda execution role has `ssm:GetParameter` permission (already in `serverless.yml`)

### Lambda can't read secrets

- Check Lambda execution role has SSM permissions (see `iamRoleStatements` in `serverless.yml`)
- Verify parameter path matches exactly
- Check CloudWatch logs for specific error messages

