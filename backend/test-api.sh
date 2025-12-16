#!/bin/bash

# Quick API Testing Script
# Usage: ./test-api.sh [TOKEN]

BASE_URL="https://kk9hsbofeh.execute-api.ap-south-1.amazonaws.com/dev"
TOKEN=${1:-""}

echo "🧪 Testing AfterLifeMessage Backend API"
echo "========================================"
echo ""

# Test 1: WhatsApp endpoint (no auth required)
echo "1️⃣  Testing WhatsApp endpoint..."
RESPONSE=$(curl -s -X POST "$BASE_URL/test-whatsapp" \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "+1234567890", "message": "Test message"}')
echo "Response: $RESPONSE"
echo ""

# Test 2: Get Upload URL (may require auth)
echo "2️⃣  Testing Upload URL endpoint..."
RESPONSE=$(curl -s -X POST "$BASE_URL/upload-url" \
  -H "Content-Type: application/json" \
  -d '{
    "fileName": "test.mp3",
    "fileType": "audio/mpeg",
    "messageId": "test-123"
  }')
echo "Response: $RESPONSE"
echo ""

# Test 3: Get Messages (requires auth)
if [ -n "$TOKEN" ]; then
  echo "3️⃣  Testing Get Messages (with auth)..."
  RESPONSE=$(curl -s -X GET "$BASE_URL/messages" \
    -H "Authorization: Bearer $TOKEN")
  echo "Response: $RESPONSE"
else
  echo "3️⃣  Skipping authenticated endpoints (no token provided)"
  echo "   Usage: ./test-api.sh YOUR_COGNITO_TOKEN"
fi
echo ""

# Test 4: Activity endpoint (requires auth)
if [ -n "$TOKEN" ]; then
  echo "4️⃣  Testing Activity endpoint..."
  RESPONSE=$(curl -s -X POST "$BASE_URL/activity" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{}')
  echo "Response: $RESPONSE"
fi
echo ""

echo "✅ Testing complete!"
echo ""
echo "💡 Tips:"
echo "   - For authenticated endpoints, get a token from Cognito"
echo "   - Check CloudWatch logs if you see errors"
echo "   - See TESTING.md for detailed testing guide"

