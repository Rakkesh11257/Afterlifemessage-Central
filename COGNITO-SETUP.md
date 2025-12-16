# 🔐 Cognito User Pool Setup Guide

## Quick Setup (Automated)

Run the setup script:

```bash
cd backend
./setup-cognito.sh dev
```

This will:
1. ✅ Create User Pool
2. ✅ Create App Client
3. ✅ Create Identity Pool (optional)
4. ✅ Display configuration details

---

## Manual Setup (Step-by-Step)

### Step 1: Create User Pool

```bash
aws cognito-idp create-user-pool \
  --pool-name afterlifemessage-users-dev \
  --region ap-south-1 \
  --auto-verified-attributes email \
  --username-attributes email \
  --policies "PasswordPolicy={MinimumLength=8,RequireUppercase=true,RequireLowercase=true,RequireNumbers=true,RequireSymbols=false}" \
  --schema \
    Name=email,AttributeDataType=String,Required=true,Mutable=true \
    Name=name,AttributeDataType=String,Required=false,Mutable=true \
    Name=phone_number,AttributeDataType=String,Required=false,Mutable=true
```

**Save the User Pool ID** from the output (looks like: `ap-south-1_XXXXXXXXX`)

---

### Step 2: Create App Client

```bash
aws cognito-idp create-user-pool-client \
  --user-pool-id YOUR_USER_POOL_ID \
  --client-name afterlifemessage-web-client-dev \
  --region ap-south-1 \
  --explicit-auth-flows ALLOW_USER_PASSWORD_AUTH ALLOW_REFRESH_TOKEN_AUTH ALLOW_USER_SRP_AUTH \
  --generate-secret \
  --prevent-user-existence-errors ENABLED
```

**Save the Client ID** from the output

---

### Step 3: Create Identity Pool (Optional - for S3 access)

```bash
aws cognito-identity create-identity-pool \
  --identity-pool-name afterlifemessage-identity-dev \
  --region ap-south-1 \
  --allow-unauthenticated-identities \
  --cognito-identity-providers "ProviderName=cognito-idp.ap-south-1.amazonaws.com/YOUR_USER_POOL_ID,ClientId=YOUR_CLIENT_ID"
```

**Save the Identity Pool ID** from the output

---

## Update Frontend Configuration

After creating the User Pool, update these files:

### 1. `src/config/development.js`

```javascript
Auth: {
  region: 'ap-south-1',
  userPoolId: 'YOUR_USER_POOL_ID',  // Replace this
  userPoolWebClientId: 'YOUR_CLIENT_ID',  // Replace this
  identityPoolId: 'YOUR_IDENTITY_POOL_ID',  // Replace this (if created)
  // ... rest of config
}
```

### 2. `src/aws-config.js`

```javascript
Auth: {
  region: 'ap-south-1',
  userPoolId: 'YOUR_USER_POOL_ID',  // Replace this
  userPoolWebClientId: 'YOUR_CLIENT_ID',  // Replace this
  // ... rest of config
}
```

---

## Test User Creation

### Create a test user via AWS CLI

```bash
aws cognito-idp admin-create-user \
  --user-pool-id YOUR_USER_POOL_ID \
  --username test@example.com \
  --user-attributes Name=email,Value=test@example.com Name=email_verified,Value=true \
  --temporary-password TempPass123! \
  --message-action SUPPRESS \
  --region ap-south-1
```

### Set permanent password

```bash
aws cognito-idp admin-set-user-password \
  --user-pool-id YOUR_USER_POOL_ID \
  --username test@example.com \
  --password YourNewPassword123! \
  --permanent \
  --region ap-south-1
```

---

## Test Authentication

### Via AWS CLI

```bash
aws cognito-idp initiate-auth \
  --auth-flow USER_PASSWORD_AUTH \
  --client-id YOUR_CLIENT_ID \
  --auth-parameters USERNAME=test@example.com,PASSWORD=YourNewPassword123! \
  --region ap-south-1
```

### Via Frontend

1. Start frontend: `npm start`
2. Open `http://localhost:3000`
3. Try to sign up or login with the test user

---

## Store in SSM (Optional)

Store Cognito IDs in SSM for reference:

```bash
aws ssm put-parameter \
  --name "/afterlifemessage/dev/cognito-user-pool-id" \
  --value "YOUR_USER_POOL_ID" \
  --type String \
  --region ap-south-1

aws ssm put-parameter \
  --name "/afterlifemessage/dev/cognito-client-id" \
  --value "YOUR_CLIENT_ID" \
  --type String \
  --region ap-south-1
```

---

## Troubleshooting

### Error: User Pool already exists
- **Fix**: Use existing pool or delete and recreate
- **List pools**: `aws cognito-idp list-user-pools --max-results 10 --region ap-south-1`

### Error: Invalid client configuration
- **Fix**: Ensure `ALLOW_USER_PASSWORD_AUTH` is in explicit-auth-flows

### Error: CORS issues
- **Fix**: Add your frontend domain to User Pool's "App integration" → "Domain" settings

### Error: User not found
- **Fix**: Create user first using `admin-create-user` command

---

## Next Steps

After Cognito is set up:

1. ✅ Update frontend config files
2. ✅ Create a test user
3. ✅ Test login from frontend
4. ✅ Test message creation (requires DynamoDB tables)
5. ✅ Test file uploads (requires S3 bucket)

---

## Production Setup

For production, repeat the same steps with `prod` stage:

```bash
./setup-cognito.sh prod
```

Then update `src/config/production.js` with production Cognito IDs.

