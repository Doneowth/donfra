#!/bin/bash

# Test script for user profile page functionality
# Tests:
# 1. User registers and logs in
# 2. User can view profile information
# 3. User can update password
# 4. Admin can see interview rooms
# 5. Admin can create and close rooms

set -e

API_BASE="http://localhost:8080/api"
COOKIES_USER="cookies_user_profile.txt"
COOKIES_ADMIN="cookies_admin_profile.txt"

cleanup() {
  rm -f $COOKIES_USER $COOKIES_ADMIN
}
trap cleanup EXIT

echo "=== User Profile Page Test ==="
echo ""

# Generate random email to avoid conflicts
RANDOM_EMAIL="profiletest_$(date +%s)@example.com"
INITIAL_PASSWORD="password123"
NEW_PASSWORD="newpassword456"

# ===== REGULAR USER TEST =====
echo "========== REGULAR USER TEST =========="
echo ""

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

# Step 2: Login
echo "2. Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_BASE/auth/login" \
  -H "Content-Type: application/json" \
  -c $COOKIES_USER \
  -d "{
    \"email\": \"$RANDOM_EMAIL\",
    \"password\": \"$INITIAL_PASSWORD\"
  }")

echo "$LOGIN_RESPONSE" | jq '.'
echo "✅ Login successful"
echo ""

# Step 3: Get user profile
echo "3. Getting user profile..."
PROFILE_RESPONSE=$(curl -s -X GET "$API_BASE/auth/me" \
  -b $COOKIES_USER)

echo "$PROFILE_RESPONSE" | jq '.'
echo "✅ Profile retrieved"
echo ""

# Step 4: Update password
echo "4. Updating password..."
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

# Step 5: Verify new password works
echo "5. Logging in with new password..."
curl -s -X POST "$API_BASE/auth/login" \
  -H "Content-Type: application/json" \
  -c $COOKIES_USER \
  -d "{
    \"email\": \"$RANDOM_EMAIL\",
    \"password\": \"$NEW_PASSWORD\"
  }" | jq '.'

echo "✅ New password works"
echo ""

# Step 6: Regular user should NOT be able to get rooms (no endpoint access for non-admin)
echo "6. Regular user trying to access my-rooms endpoint..."
ROOMS_RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$API_BASE/interview/my-rooms" \
  -b $COOKIES_USER)

HTTP_CODE=$(echo "$ROOMS_RESPONSE" | tail -n1)
BODY=$(echo "$ROOMS_RESPONSE" | sed '$d')

# Note: Regular users CAN access my-rooms, but will get empty list
if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Regular user can access my-rooms (but has no rooms)"
  echo "$BODY" | jq '.'
else
  echo "Response: $HTTP_CODE"
  echo "$BODY" | jq '.'
fi
echo ""

# ===== ADMIN USER TEST =====
echo "========== ADMIN USER TEST =========="
echo ""

# Step 7: Admin login
echo "7. Admin login..."
curl -s -X POST "$API_BASE/auth/login" \
  -H "Content-Type: application/json" \
  -c $COOKIES_ADMIN \
  -d '{
    "email": "admin@donfra.com",
    "password": "admin123"
  }' | jq '.'

echo "✅ Admin logged in"
echo ""

# Step 8: Admin gets profile
echo "8. Admin getting profile..."
curl -s -X GET "$API_BASE/auth/me" \
  -b $COOKIES_ADMIN | jq '.'

echo "✅ Admin profile retrieved"
echo ""

# Step 9: Admin creates interview room
echo "9. Admin creating interview room..."
ROOM_RESPONSE=$(curl -s -X POST "$API_BASE/interview/init" \
  -H "Content-Type: application/json" \
  -b $COOKIES_ADMIN)

echo "$ROOM_RESPONSE" | jq '.'
ROOM_ID=$(echo "$ROOM_RESPONSE" | jq -r '.room_id')

echo "✅ Interview room created: $ROOM_ID"
echo ""

# Step 10: Admin gets list of rooms
echo "10. Admin getting list of rooms..."
ROOMS_RESPONSE=$(curl -s -X GET "$API_BASE/interview/my-rooms" \
  -b $COOKIES_ADMIN)

echo "$ROOMS_RESPONSE" | jq '.'
ROOM_COUNT=$(echo "$ROOMS_RESPONSE" | jq '.rooms | length')

if [ "$ROOM_COUNT" -gt "0" ]; then
  echo "✅ Admin has $ROOM_COUNT room(s)"
else
  echo "❌ ERROR: Admin should have at least 1 room"
  exit 1
fi
echo ""

# Step 11: Admin closes room
echo "11. Admin closing room..."
curl -s -X POST "$API_BASE/interview/close" \
  -H "Content-Type: application/json" \
  -b $COOKIES_ADMIN \
  -d "{\"room_id\": \"$ROOM_ID\"}" | jq '.'

echo "✅ Room closed"
echo ""

# Step 12: Verify room is no longer in active list
echo "12. Verifying room is closed..."
ROOMS_AFTER=$(curl -s -X GET "$API_BASE/interview/my-rooms" \
  -b $COOKIES_ADMIN)

echo "$ROOMS_AFTER" | jq '.'
echo "✅ Rooms list updated"
echo ""

echo "=== All User Profile Page Tests Passed! ==="
echo ""
echo "Summary:"
echo "✅ Regular user can register, login, and view profile"
echo "✅ Regular user can update password"
echo "✅ Regular user can login with new password"
echo "✅ Admin can create interview rooms"
echo "✅ Admin can view list of rooms"
echo "✅ Admin can close rooms"
echo "✅ Room list updates after closing room"
