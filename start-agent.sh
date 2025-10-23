#!/bin/bash

# Start the LiveKit voice agent with environment variables from dev.env
# Usage: ./start-agent.sh

cd "$(dirname "$0")"

# Load environment variables
set -a
source dev.env
set +a

# Navigate to services directory
cd services

# Start the agent
echo "🚀 Starting LiveKit voice agent..."
echo "📋 Environment check:"
echo "  LIVEKIT_URL: ${LIVEKIT_URL:0:30}..."
echo "  LIVEKIT_API_KEY: ${LIVEKIT_API_KEY:0:10}..."
echo "  OPENAI_API_KEY: ${OPENAI_API_KEY:0:10}..."
echo "  DEEPGRAM_API_KEY: ${DEEPGRAM_API_KEY:0:10}..."
echo ""

# Run the agent in dev mode
python3 agent.py dev

# If you want to run it in production mode, use:
# python3 agent.py start

