#!/bin/bash

# Script to create Cognito User Pool for AfterLifeMessage
# Usage: ./setup-cognito.sh [dev|prod]

STAGE=${1:-dev}
REGION="ap-south-1"
POOL_NAME="afterlifemessage-users-${STAGE}"

echo "🔐 Setting up Cognito User Pool for stage: $STAGE"
echo "Region: $REGION"
echo ""

# Step 1: Create User Pool
echo "1️⃣  Creating Cognito User Pool..."
POOL_OUTPUT=$(aws cognito-idp create-user-pool \
  --pool-name "$POOL_NAME" \
  --region $REGION \
  --auto-verified-attributes email \
  --username-attributes email \
  --policies "PasswordPolicy={MinimumLength=8,RequireUppercase=true,RequireLowercase=true,RequireNumbers=true,RequireSymbols=false}" \
  --schema \
    Name=email,AttributeDataType=String,Required=true,Mutable=true \
    Name=name,AttributeDataType=String,Required=false,Mutable=true \
    Name=phone_number,AttributeDataType=String,Required=false,Mutable=true \
  --query 'UserPool.{Id:Id,Name:Name}' \
  --output json 2>&1)

if [ $? -eq 0 ]; then
    USER_POOL_ID=$(echo $POOL_OUTPUT | jq -r '.Id')
    echo "✅ User Pool created: $USER_POOL_ID"
else
    echo "❌ Error creating User Pool:"
    echo "$POOL_OUTPUT"
    exit 1
fi

echo ""

# Step 2: Create App Client
echo "2️⃣  Creating App Client..."
CLIENT_OUTPUT=$(aws cognito-idp create-user-pool-client \
  --user-pool-id "$USER_POOL_ID" \
  --client-name "afterlifemessage-web-client-${STAGE}" \
  --region $REGION \
  --explicit-auth-flows ALLOW_USER_PASSWORD_AUTH ALLOW_REFRESH_TOKEN_AUTH ALLOW_USER_SRP_AUTH \
  --prevent-user-existence-errors ENABLED \
  --query 'UserPoolClient.{ClientId:ClientId,ClientName:ClientName}' \
  --output json 2>&1)

if [ $? -eq 0 ]; then
    CLIENT_ID=$(echo $CLIENT_OUTPUT | jq -r '.ClientId')
    echo "✅ App Client created: $CLIENT_ID"
else
    echo "❌ Error creating App Client:"
    echo "$CLIENT_OUTPUT"
    exit 1
fi

echo ""

# Step 3: Create Identity Pool (optional, for S3 access)
echo "3️⃣  Creating Identity Pool..."
IDENTITY_POOL_NAME="afterlifemessage-identity-${STAGE}"
IDENTITY_OUTPUT=$(aws cognito-identity create-identity-pool \
  --identity-pool-name "$IDENTITY_POOL_NAME" \
  --region $REGION \
  --allow-unauthenticated-identities \
  --cognito-identity-providers "ProviderName=cognito-idp.${REGION}.amazonaws.com/${USER_POOL_ID},ClientId=${CLIENT_ID}" \
  --query 'IdentityPoolId' \
  --output text 2>&1)

if [ $? -eq 0 ]; then
    IDENTITY_POOL_ID=$IDENTITY_OUTPUT
    echo "✅ Identity Pool created: $IDENTITY_POOL_ID"
else
    echo "⚠️  Identity Pool creation failed (optional):"
    echo "$IDENTITY_OUTPUT"
    IDENTITY_POOL_ID=""
fi

echo ""
echo "✅ Cognito Setup Complete!"
echo ""
echo "📋 Configuration Details:"
echo "=========================="
echo "User Pool ID: $USER_POOL_ID"
echo "App Client ID: $CLIENT_ID"
if [ -n "$IDENTITY_POOL_ID" ]; then
    echo "Identity Pool ID: $IDENTITY_POOL_ID"
fi
echo ""
echo "📝 Update these in your frontend config:"
echo "   - src/config/development.js"
echo "   - src/aws-config.js"
echo ""
echo "💾 Store in SSM (optional):"
echo "   aws ssm put-parameter --name \"/afterlifemessage/${STAGE}/cognito-user-pool-id\" --value \"$USER_POOL_ID\" --type String --region $REGION"
echo "   aws ssm put-parameter --name \"/afterlifemessage/${STAGE}/cognito-client-id\" --value \"$CLIENT_ID\" --type String --region $REGION"
if [ -n "$IDENTITY_POOL_ID" ]; then
    echo "   aws ssm put-parameter --name \"/afterlifemessage/${STAGE}/cognito-identity-pool-id\" --value \"$IDENTITY_POOL_ID\" --type String --region $REGION"
fi
echo ""

