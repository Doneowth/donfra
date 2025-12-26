#!/bin/bash

# Test script for password update functionality
# Tests:
# 1. User registers with initial password
# 2. User logs in with initial password
# 3. User updates password (with correct current password)
# 4. User logs out
# 5. User logs in with new password
# 6. User attempts to update password with incorrect current password (should fail)

set -e

API_BASE="http://localhost:8080/api"
COOKIES_USER="cookies_user_pwd.txt"

cleanup() {
  rm -f $COOKIES_USER
}
trap cleanup EXIT

echo "=== Password Update API Test ==="
echo ""

# Generate random email to avoid conflicts
RANDOM_EMAIL="testuser_$(date +%s)@example.com"
INITIAL_PASSWORD="password123"
NEW_PASSWORD="newpassword456"

# Step 1: Register a new user
echo "1. Registering new user..."
curl -s -X POST "$API_BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$RANDOM_EMAIL\",
    \"password\": \"$INITIAL_PASSWORD\",
    \"username\": \"testuser\"
  }" | jq '.'

echo ""

# Step 2: Login with initial password
echo "2. Logging in with initial password..."
curl -s -X POST "$API_BASE/auth/login" \
  -H "Content-Type: application/json" \
  -c $COOKIES_USER \
  -d "{
    \"email\": \"$RANDOM_EMAIL\",
    \"password\": \"$INITIAL_PASSWORD\"
  }" | jq '.'

echo "✅ Login successful with initial password"
echo ""

# Step 3: Update password
echo "3. Updating password..."
UPDATE_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE/auth/update-password" \
  -H "Content-Type: application/json" \
  -b $COOKIES_USER \
  -d "{
    \"current_password\": \"$INITIAL_PASSWORD\",
    \"new_password\": \"$NEW_PASSWORD\"
  }")

HTTP_CODE=$(echo "$UPDATE_RESPONSE" | tail -n1)
BODY=$(echo "$UPDATE_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Password updated successfully"
  echo "$BODY" | jq '.'
else
  echo "❌ ERROR: Expected 200, got $HTTP_CODE"
  echo "$BODY" | jq '.'
  exit 1
fi
echo ""

# Step 4: Logout
echo "4. Logging out..."
curl -s -X POST "$API_BASE/auth/logout" \
  -b $COOKIES_USER | jq '.'
echo ""

# Step 5: Login with new password
echo "5. Logging in with new password..."
LOGIN_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE/auth/login" \
  -H "Content-Type: application/json" \
  -c $COOKIES_USER \
  -d "{
    \"email\": \"$RANDOM_EMAIL\",
    \"password\": \"$NEW_PASSWORD\"
  }")

HTTP_CODE=$(echo "$LOGIN_RESPONSE" | tail -n1)
BODY=$(echo "$LOGIN_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Login successful with new password"
  echo "$BODY" | jq '.'
else
  echo "❌ ERROR: Expected 200, got $HTTP_CODE"
  echo "$BODY" | jq '.'
  exit 1
fi
echo ""

# Step 6: Attempt to update password with incorrect current password
echo "6. Attempting to update password with incorrect current password (should fail)..."
FAIL_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE/auth/update-password" \
  -H "Content-Type: application/json" \
  -b $COOKIES_USER \
  -d "{
    \"current_password\": \"wrongpassword\",
    \"new_password\": \"anotherpassword789\"
  }")

HTTP_CODE=$(echo "$FAIL_RESPONSE" | tail -n1)
BODY=$(echo "$FAIL_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "401" ]; then
  echo "✅ Correctly rejected: Incorrect current password"
  echo "$BODY" | jq '.'
else
  echo "❌ ERROR: Expected 401, got $HTTP_CODE"
  echo "$BODY" | jq '.'
  exit 1
fi
echo ""

# Step 7: Attempt to update password with too short new password
echo "7. Attempting to update password with too short new password (should fail)..."
FAIL_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE/auth/update-password" \
  -H "Content-Type: application/json" \
  -b $COOKIES_USER \
  -d "{
    \"current_password\": \"$NEW_PASSWORD\",
    \"new_password\": \"short\"
  }")

HTTP_CODE=$(echo "$FAIL_RESPONSE" | tail -n1)
BODY=$(echo "$FAIL_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "400" ]; then
  echo "✅ Correctly rejected: Password too short"
  echo "$BODY" | jq '.'
else
  echo "❌ ERROR: Expected 400, got $HTTP_CODE"
  echo "$BODY" | jq '.'
  exit 1
fi
echo ""

echo "=== All Password Update Tests Passed! ==="
echo ""
echo "Summary:"
echo "✅ User can register with initial password"
echo "✅ User can login with initial password"
echo "✅ User can update password with correct current password"
echo "✅ User can login with new password"
echo "✅ Password update fails with incorrect current password"
echo "✅ Password update fails when new password is too short"
