# AfterLifeMessage.in - Cognito Setup Commands

## Prerequisites
1. Install AWS CLI: `npm install -g aws-cli`
2. Configure AWS credentials: `aws configure`

## Step 1: Create User Pool

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
  --username-attributes email \
  --mfa-configuration OFF \
  --account-recovery-setting '{
    "RecoveryMechanisms": [
      {
        "Name": "verified_email",
        "Priority": 1
      }
    ]
  }' \
  --verification-message-template '{
    "DefaultEmailOption": "CONFIRM_WITH_CODE"
  }' \
  --email-configuration '{
    "EmailSendingAccount": "COGNITO_DEFAULT"
  }' \
  --admin-create-user-config '{
    "AllowAdminCreateUserOnly": false
  }' \
  --schema '[
    {
      "Name": "email",
      "AttributeDataType": "String",
      "Required": true,
      "Mutable": true
    }
  ]'
```

**Save the User Pool ID from the response**

## Step 2: Create App Client

```bash
aws cognito-idp create-user-pool-client \
  --user-pool-id YOUR_USER_POOL_ID \
  --client-name "AfterLifeMessage-WebClient" \
  --no-generate-secret \
  --explicit-auth-flows ALLOW_USER_PASSWORD_AUTH ALLOW_REFRESH_TOKEN_AUTH ALLOW_USER_SRP_AUTH \
  --prevent-user-existence-errors ENABLED \
  --read-attributes email \
  --write-attributes email
```

**Save the App Client ID from the response**

## Step 3: Create Identity Pool (Optional)

```bash
aws cognito-identity create-identity-pool \
  --identity-pool-name "AfterLifeMessage-IdentityPool" \
  --allow-unauthenticated-identities false \
  --cognito-identity-providers "ProviderName=cognito-idp.us-east-1.amazonaws.com/YOUR_USER_POOL_ID,ClientId=YOUR_APP_CLIENT_ID,ServerSideTokenCheck=false"
```

**Save the Identity Pool ID from the response**

## Step 4: Update Configuration

Once you have all the IDs, update `src/aws-exports.js`:

```javascript
const awsmobile = {
  "aws_project_region": "us-east-1",
  "aws_cognito_identity_pool_id": "us-east-1:YOUR_IDENTITY_POOL_ID",
  "aws_cognito_region": "us-east-1",
  "aws_user_pools_id": "YOUR_USER_POOL_ID",
  "aws_user_pools_web_client_id": "YOUR_APP_CLIENT_ID",
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

## Quick Setup Script

Or run the PowerShell script I created:

```powershell
.\create-cognito-userpool.ps1
```

This will create everything automatically and save the configuration to `cognito-config.json`. 