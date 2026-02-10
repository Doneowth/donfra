#!/bin/sh
# donfra-jail entrypoint
# Executes user code and publishes result to Redis
set -e

# Parse Redis address
REDIS_HOST="${REDIS_HOST:-redis}"
REDIS_PORT="${REDIS_PORT:-6379}"
TIMEOUT_MS="${TIMEOUT_MS:-5000}"
MAX_OUTPUT_BYTES="${MAX_OUTPUT_BYTES:-65536}"

# Publish helper
publish_result() {
  redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" PUBLISH "exec:${EXEC_ID}" "$1" >/dev/null 2>&1 || true
}

# Validate required env vars
if [ -z "$EXEC_ID" ] || [ -z "$SOURCE_CODE" ] || [ -z "$LANGUAGE_ID" ]; then
  publish_result '{"execution_id":"'"$EXEC_ID"'","status_id":11,"status_desc":"Runtime Error","stdout_b64":"","stderr_b64":"","message":"missing required env vars","exit_code":1,"execution_time_ms":0}'
  exit 0
fi

# Determine interpreter and extension
case "$LANGUAGE_ID" in
  71) INTERP="/usr/bin/python3"; EXT=".py" ;;
  63) INTERP="/usr/bin/node";    EXT=".js" ;;
  *)
    publish_result '{"execution_id":"'"$EXEC_ID"'","status_id":11,"status_desc":"Runtime Error","stdout_b64":"","stderr_b64":"","message":"unsupported language","exit_code":1,"execution_time_ms":0}'
    exit 0
    ;;
esac

# Decode source code from base64
echo "$SOURCE_CODE" | base64 -d > "/tmp/code${EXT}" 2>/dev/null
if [ $? -ne 0 ]; then
  publish_result '{"execution_id":"'"$EXEC_ID"'","status_id":11,"status_desc":"Runtime Error","stdout_b64":"","stderr_b64":"","message":"failed to decode source code","exit_code":1,"execution_time_ms":0}'
  exit 0
fi

# Decode stdin
STDIN_FILE="/tmp/stdin.txt"
if [ -n "$STDIN_DATA" ]; then
  echo "$STDIN_DATA" | base64 -d > "$STDIN_FILE" 2>/dev/null || : > "$STDIN_FILE"
else
  : > "$STDIN_FILE"
fi

# Calculate timeout in seconds (round up)
TIMEOUT_SEC=$(( (TIMEOUT_MS + 999) / 1000 ))

# Execute with timeout
STDOUT_FILE="/tmp/stdout.txt"
STDERR_FILE="/tmp/stderr.txt"
START_MS=$(date +%s%3N 2>/dev/null || echo 0)

set +e
timeout "${TIMEOUT_SEC}s" "$INTERP" "/tmp/code${EXT}" < "$STDIN_FILE" \
  > "$STDOUT_FILE" 2> "$STDERR_FILE"
EXIT_CODE=$?
set -e

END_MS=$(date +%s%3N 2>/dev/null || echo 0)
DURATION=$(( END_MS - START_MS ))
[ "$DURATION" -lt 0 ] && DURATION=0

# Truncate output to MAX_OUTPUT_BYTES
head -c "$MAX_OUTPUT_BYTES" "$STDOUT_FILE" > /tmp/stdout_trunc.txt
head -c "$MAX_OUTPUT_BYTES" "$STDERR_FILE" > /tmp/stderr_trunc.txt

# Determine status from exit code
# 124 = timeout command killed the process
# 137 = SIGKILL (OOM or external kill)
if [ $EXIT_CODE -eq 124 ]; then
  STATUS_ID=5; STATUS_DESC="Time Limit Exceeded"
elif [ $EXIT_CODE -eq 137 ]; then
  STATUS_ID=7; STATUS_DESC="Memory Limit Exceeded"
elif [ $EXIT_CODE -ne 0 ]; then
  STATUS_ID=11; STATUS_DESC="Runtime Error"
else
  STATUS_ID=3; STATUS_DESC="Accepted"
fi

# Base64 encode stdout/stderr to avoid JSON escaping issues
STDOUT_B64=$(base64 -w0 /tmp/stdout_trunc.txt 2>/dev/null || base64 /tmp/stdout_trunc.txt | tr -d '\n')
STDERR_B64=$(base64 -w0 /tmp/stderr_trunc.txt 2>/dev/null || base64 /tmp/stderr_trunc.txt | tr -d '\n')

# Build result message (skip for successful runs)
if [ $EXIT_CODE -eq 0 ]; then
  MSG=""
else
  MSG="Process exited with code ${EXIT_CODE}"
fi

# Build result JSON
RESULT=$(printf '{"execution_id":"%s","status_id":%d,"status_desc":"%s","stdout_b64":"%s","stderr_b64":"%s","message":"%s","exit_code":%d,"execution_time_ms":%d}' \
  "$EXEC_ID" "$STATUS_ID" "$STATUS_DESC" "$STDOUT_B64" "$STDERR_B64" "$MSG" "$EXIT_CODE" "$DURATION")

# Publish to Redis
publish_result "$RESULT"
