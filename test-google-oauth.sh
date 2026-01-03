#!/bin/bash

echo "=========================================="
echo "Google OAuth Integration Test"
echo "=========================================="
echo

# Test 1: Get auth URL
echo "✓ Test 1: Get Google OAuth URL"
RESPONSE=$(curl -s http://localhost:8080/api/auth/google/url)
AUTH_URL=$(echo $RESPONSE | grep -o '"auth_url":"[^"]*"' | cut -d'"' -f4)
STATE=$(echo $RESPONSE | grep -o '"state":"[^"]*"' | cut -d'"' -f4)

if [ -z "$AUTH_URL" ]; then
  echo "  ✗ FAILED: No auth URL returned"
  exit 1
fi

if [ -z "$STATE" ]; then
  echo "  ✗ FAILED: No state parameter returned"
  exit 1
fi

echo "  ✓ Auth URL generated successfully"
echo "  ✓ State parameter: ${STATE:0:20}..."
echo

# Check auth URL components
if [[ $AUTH_URL == *"client_id=591319272586-mab0vkn55tpl83r4mdd4fhnb2hhae3pi.apps.googleusercontent.com"* ]]; then
  echo "  ✓ Client ID present in auth URL"
else
  echo "  ✗ FAILED: Client ID missing from auth URL"
  exit 1
fi

if [[ $AUTH_URL == *"redirect_uri=http%3A%2F%2Flocalhost%3A8080%2Fapi%2Fauth%2Fgoogle%2Fcallback"* ]]; then
  echo "  ✓ Redirect URI correct"
else
  echo "  ✗ FAILED: Redirect URI incorrect"
  exit 1
fi

if [[ $AUTH_URL == *"scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fuserinfo.email"* ]]; then
  echo "  ✓ Email scope present"
else
  echo "  ✗ FAILED: Email scope missing"
  exit 1
fi

if [[ $AUTH_URL == *"scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fuserinfo.profile"* ]] || [[ $AUTH_URL == *"userinfo.profile"* ]]; then
  echo "  ✓ Profile scope present"
else
  echo "  ✗ FAILED: Profile scope missing"
  exit 1
fi

echo

# Test 2: API health check
echo "✓ Test 2: API Health Check"
HEALTH=$(curl -s http://localhost:8080/healthz)
if [ "$HEALTH" = "ok" ]; then
  echo "  ✓ API is healthy"
else
  echo "  ✗ FAILED: API health check failed"
  exit 1
fi
echo

# Test 3: Database connectivity
echo "✓ Test 3: Database Connectivity"
DB_CHECK=$(docker exec donfra-db psql -U donfra -d donfra_study -c "SELECT 1;" 2>&1)
if [[ $DB_CHECK == *"1 row"* ]]; then
  echo "  ✓ Database connection successful"
else
  echo "  ✗ FAILED: Cannot connect to database"
  exit 1
fi
echo

# Test 4: Users table has Google columns
echo "✓ Test 4: Database Schema Check"
SCHEMA_CHECK=$(docker exec donfra-db psql -U donfra -d donfra_study -c "\d users" 2>&1)
if [[ $SCHEMA_CHECK == *"google_id"* ]]; then
  echo "  ✓ google_id column exists"
else
  echo "  ✗ FAILED: google_id column missing"
  exit 1
fi

if [[ $SCHEMA_CHECK == *"google_avatar"* ]]; then
  echo "  ✓ google_avatar column exists"
else
  echo "  ✗ FAILED: google_avatar column missing"
  exit 1
fi
echo

echo "=========================================="
echo "All Tests Passed! ✓"
echo "=========================================="
echo
echo "Next Steps:"
echo "1. Open http://localhost in your browser"
echo "2. Click 'Sign in with Google' button"
echo "3. The OAuth flow will redirect you to:"
echo
echo "   $AUTH_URL"
echo
echo "4. After authorizing, you'll be redirected back to:"
echo "   http://localhost:8080/api/auth/google/callback"
echo
echo "Note: The callback will set a JWT cookie and redirect to frontend"
