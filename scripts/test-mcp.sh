#!/bin/bash
# Usage: ./test-mcp.sh [MCP_URL]
# Defaults to http://localhost:3000/mcp if MCP_URL is not provided

HOST=${1:-http://localhost:3000/mcp}

echo "Initializing MCP session on ${HOST}..."

# Initialize session and capture the new mcp-session-id from response headers.
INIT_RESPONSE=$(curl -s -D - -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2024-11-05", "capabilities": {}, "clientInfo": {"name": "test-client", "version": "1.0.0"}}}' "${HOST}")

SESSION_ID=$(echo "$INIT_RESPONSE" | grep -i "mcp-session-id:" | awk '{print $2}' | tr -d '\r')
echo "Session ID: $SESSION_ID"
if [[ -z "$SESSION_ID" ]]; then
  echo "Failed to get session ID. Exiting."
  exit 1
fi

# Function to call a tool and extract the JSON data from SSE output.
call_tool() {
  local ID=$1
  local TOOL_NAME=$2
  local ARGS=$3
  echo "Calling tool: ${TOOL_NAME} with id ${ID}..."
  RAW_RESULT=$(curl -s -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" \
    -H "mcp-session-id: ${SESSION_ID}" \
    -d "{\"jsonrpc\": \"2.0\", \"id\": ${ID}, \"method\": \"tools/call\", \"params\": {\"name\": \"${TOOL_NAME}\", \"arguments\": ${ARGS}}}" "${HOST}")
  # Extract the JSON part from lines beginning with 'data: '
  JSON_RESULT=$(echo "$RAW_RESULT" | sed -n 's/^data: //p')
  echo "$JSON_RESULT" | jq .
  echo ""
}

echo "Test 1: VPN Status"
call_tool 2 "prowlarr_vpn_status" "{}"

echo "Test 2: Prowlarr Health Check"
call_tool 3 "prowlarr_health_check" "{}"

echo "Test 3: Search 'batman'"
call_tool 4 "prowlarr_search" "{\"query\": \"batman\", \"limit\": 20}"
