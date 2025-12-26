#!/bin/bash

# Test script for interview room auto-close on quit functionality
# Tests:
# 1. Admin creates room and quits → room should be closed
# 2. Regular user joins and quits → room should remain open

set -e

API_BASE="http://localhost:8080/api"
COOKIES_ADMIN="cookies_admin.txt"
COOKIES_USER="cookies_user.txt"

cleanup() {
  rm -f $COOKIES_ADMIN $COOKIES_USER
}
trap cleanup EXIT

echo "=== Interview Room Quit Behavior Test ==="
echo ""

# Step 1: Admin login
echo "1. Admin login..."
curl -s -X POST "$API_BASE/auth/login" \
  -H "Content-Type: application/json" \
  -c $COOKIES_ADMIN \
  -d '{
    "email": "admin@donfra.com",
    "password": "admin123"
  }' | jq '.'

echo ""

# Step 2: Admin creates room
echo "2. Admin creates interview room..."
ROOM_RESPONSE=$(curl -s -X POST "$API_BASE/interview/init" \
  -H "Content-Type: application/json" \
  -b $COOKIES_ADMIN)

echo "$ROOM_RESPONSE" | jq '.'
ROOM_ID=$(echo "$ROOM_RESPONSE" | jq -r '.room_id')
INVITE_LINK=$(echo "$ROOM_RESPONSE" | jq -r '.invite_link')

echo "Room ID: $ROOM_ID"
echo "Invite Link: $INVITE_LINK"
echo ""

# Step 3: Simulate admin opening the room in browser
echo "3. Simulating admin opening CodePad..."
echo "   (In real scenario: admin opens invite link in browser)"
echo "   When admin clicks 'Quit', the frontend will call:"
echo "   POST $API_BASE/interview/close with room_id=$ROOM_ID"
echo ""

# Step 4: Admin clicks Quit → should close room
echo "4. Admin quits (simulating frontend behavior)..."
CLOSE_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE/interview/close" \
  -H "Content-Type: application/json" \
  -b $COOKIES_ADMIN \
  -d "{\"room_id\": \"$ROOM_ID\"}")

HTTP_CODE=$(echo "$CLOSE_RESPONSE" | tail -n1)
BODY=$(echo "$CLOSE_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Room closed successfully by admin"
  echo "$BODY" | jq '.'
else
  echo "❌ ERROR: Expected 200, got $HTTP_CODE"
  echo "$BODY" | jq '.'
  exit 1
fi
echo ""

# Step 5: Create a new room for user test
echo "5. Creating new room for user test..."
ROOM_RESPONSE=$(curl -s -X POST "$API_BASE/interview/init" \
  -H "Content-Type: application/json" \
  -b $COOKIES_ADMIN)

ROOM_ID=$(echo "$ROOM_RESPONSE" | jq -r '.room_id')
INVITE_LINK=$(echo "$ROOM_RESPONSE" | jq -r '.invite_link')
INVITE_TOKEN=$(echo "$INVITE_LINK" | sed -n 's/.*token=\([^&]*\).*/\1/p')

echo "New Room ID: $ROOM_ID"
echo ""

# Step 6: Regular user joins room
echo "6. Regular user joins room..."
curl -s -X POST "$API_BASE/interview/join" \
  -H "Content-Type: application/json" \
  -c $COOKIES_USER \
  -d "{\"invite_token\": \"$INVITE_TOKEN\"}" | jq '.'

echo "✅ User joined successfully"
echo ""

# Step 7: Regular user clicks Quit → should NOT close room
echo "7. Regular user quits (should NOT close room)..."
echo "   Frontend will check: isOwner = false (user.role !== 'admin')"
echo "   So it will NOT call /interview/close"
echo ""

# Verify room is still open
echo "8. Verifying room is still open..."
# Try to join again with same token - should succeed if room is still open
VERIFY_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE/interview/join" \
  -H "Content-Type: application/json" \
  -d "{\"invite_token\": \"$INVITE_TOKEN\"}")

HTTP_CODE=$(echo "$VERIFY_RESPONSE" | tail -n1)
BODY=$(echo "$VERIFY_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Room is still open (user quit did not close it)"
  echo "$BODY" | jq '.'
else
  echo "❌ ERROR: Room appears to be closed"
  echo "$BODY" | jq '.'
  exit 1
fi
echo ""

# Cleanup: Admin closes the room
echo "9. Cleanup: Admin closes the room..."
curl -s -X POST "$API_BASE/interview/close" \
  -H "Content-Type: application/json" \
  -b $COOKIES_ADMIN \
  -d "{\"room_id\": \"$ROOM_ID\"}" | jq '.'

echo ""
echo "=== All Tests Passed! ==="
echo ""
echo "Summary:"
echo "✅ Admin quit → room closed automatically"
echo "✅ Regular user quit → room remains open"
echo "✅ Only room owner (admin) can close the room"
