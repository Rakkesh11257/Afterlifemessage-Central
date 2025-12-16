#!/bin/bash

# Script to store secrets in AWS SSM Parameter Store
# Run this ONCE before deploying the backend
# Usage: ./setup-secrets.sh [dev|prod]

STAGE=${1:-dev}
REGION="ap-south-1"

echo "🔐 Setting up secrets in AWS SSM Parameter Store for stage: $STAGE"
echo "Region: $REGION"
echo ""

# Base path for all secrets
BASE_PATH="/afterlifemessage/$STAGE"

# Function to create SSM parameter
create_param() {
    local name=$1
    local value=$2
    local description=$3
    
    echo "Creating: $name"
    aws ssm put-parameter \
        --region $REGION \
        --name "$BASE_PATH/$name" \
        --value "$value" \
        --type "SecureString" \
        --description "$description" \
        --overwrite \
        --no-cli-pager
    
    if [ $? -eq 0 ]; then
        echo "✅ Created: $name"
    else
        echo "❌ Failed: $name"
    fi
    echo ""
}

# Prompt for secrets (or use environment variables if set)
echo "Enter your secrets (or set them as environment variables):"
echo ""

# ZeptoMail
ZEPTO_PASSWORD=${ZEPTO_PASSWORD:-$(read -sp "ZeptoMail Password: " pwd; echo $pwd)}
ZEPTO_FROM_EMAIL=${ZEPTO_FROM_EMAIL:-$(read -p "ZeptoMail From Email: " email; echo $email)}

# WhatsApp
WHATSAPP_ACCESS_TOKEN=${WHATSAPP_ACCESS_TOKEN:-$(read -sp "WhatsApp Access Token: " token; echo $token)}
WHATSAPP_PHONE_NUMBER_ID=${WHATSAPP_PHONE_NUMBER_ID:-$(read -p "WhatsApp Phone Number ID: " id; echo $id)}

# Encryption
ENCRYPTION_KEY=${ENCRYPTION_KEY:-$(read -sp "Encryption Key (32-byte hex): " key; echo $key)}

# Twilio (optional)
read -p "Do you want to set Twilio credentials? (y/n): " use_twilio
if [ "$use_twilio" = "y" ]; then
    TWILIO_ACCOUNT_SID=${TWILIO_ACCOUNT_SID:-$(read -p "Twilio Account SID: " sid; echo $sid)}
    TWILIO_AUTH_TOKEN=${TWILIO_AUTH_TOKEN:-$(read -sp "Twilio Auth Token: " token; echo $token)}
    TWILIO_WHATSAPP_NUMBER=${TWILIO_WHATSAPP_NUMBER:-$(read -p "Twilio WhatsApp Number: " num; echo $num)}
fi

# Razorpay (optional)
read -p "Do you want to set Razorpay credentials? (y/n): " use_razorpay
if [ "$use_razorpay" = "y" ]; then
    RAZORPAY_KEY_ID=${RAZORPAY_KEY_ID:-$(read -p "Razorpay Key ID: " key; echo $key)}
    RAZORPAY_KEY_SECRET=${RAZORPAY_KEY_SECRET:-$(read -sp "Razorpay Key Secret: " secret; echo $secret)}
fi

echo ""
echo "Storing secrets in SSM Parameter Store..."
echo ""

# Store all secrets
create_param "zepto-password" "$ZEPTO_PASSWORD" "ZeptoMail API password"
create_param "zepto-from-email" "$ZEPTO_FROM_EMAIL" "ZeptoMail sender email"

create_param "whatsapp-access-token" "$WHATSAPP_ACCESS_TOKEN" "WhatsApp Business API access token"
create_param "whatsapp-phone-number-id" "$WHATSAPP_PHONE_NUMBER_ID" "WhatsApp Business phone number ID"

create_param "encryption-key" "$ENCRYPTION_KEY" "AES-256 encryption key for message encryption"

if [ "$use_twilio" = "y" ]; then
    create_param "twilio-account-sid" "$TWILIO_ACCOUNT_SID" "Twilio account SID"
    create_param "twilio-auth-token" "$TWILIO_AUTH_TOKEN" "Twilio authentication token"
    create_param "twilio-whatsapp-number" "$TWILIO_WHATSAPP_NUMBER" "Twilio WhatsApp number"
fi

if [ "$use_razorpay" = "y" ]; then
    create_param "razorpay-key-id" "$RAZORPAY_KEY_ID" "Razorpay API key ID"
    create_param "razorpay-key-secret" "$RAZORPAY_KEY_SECRET" "Razorpay API key secret"
fi

echo ""
echo "✅ All secrets stored in SSM Parameter Store!"
echo "Path prefix: $BASE_PATH"
echo ""
echo "You can now deploy your backend with:"
echo "  cd backend && serverless deploy --stage $STAGE"
echo ""

