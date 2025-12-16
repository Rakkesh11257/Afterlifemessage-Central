#!/bin/bash

# Create a test user in Cognito
# Usage: ./create-test-user.sh email@example.com

USER_POOL_ID="ap-south-1_CRybCfDpw"
REGION="ap-south-1"
EMAIL=${1:-"test@afterlifemessage.in"}
TEMP_PASSWORD="TempPass123!"
PERMANENT_PASSWORD="TestPass123!"

echo "👤 Creating test user: $EMAIL"
echo ""

# Step 1: Create user
echo "1️⃣  Creating user..."
aws cognito-idp admin-create-user \
  --user-pool-id "$USER_POOL_ID" \
  --username "$EMAIL" \
  --user-attributes Name=email,Value="$EMAIL" Name=email_verified,Value=true \
  --temporary-password "$TEMP_PASSWORD" \
  --message-action SUPPRESS \
  --region $REGION

if [ $? -eq 0 ]; then
    echo "✅ User created"
else
    echo "❌ Error creating user"
    exit 1
fi

echo ""

# Step 2: Set permanent password
echo "2️⃣  Setting permanent password..."
aws cognito-idp admin-set-user-password \
  --user-pool-id "$USER_POOL_ID" \
  --username "$EMAIL" \
  --password "$PERMANENT_PASSWORD" \
  --permanent \
  --region $REGION

if [ $? -eq 0 ]; then
    echo "✅ Password set"
else
    echo "❌ Error setting password"
    exit 1
fi

echo ""
echo "✅ Test user created successfully!"
echo ""
echo "📋 Login Credentials:"
echo "   Email: $EMAIL"
echo "   Password: $PERMANENT_PASSWORD"
echo ""
echo "🧪 Test login:"
echo "   - Start frontend: npm start"
echo "   - Go to: http://localhost:3000"
echo "   - Login with the credentials above"

