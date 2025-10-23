#!/bin/bash

# Kill any existing agent processes
echo "🛑 Stopping any running agents..."
pkill -9 -f "agent.py" 2>/dev/null
sleep 2

# Navigate to project directory
cd "$(dirname "$0")"

# Load environment variables
set -a
source dev.env
set +a

# Navigate to services directory
cd services

# Start the agent
echo ""
echo "🚀 Starting LiveKit voice agent with Deepgram TTS..."
echo "📋 Environment check:"
echo "  LIVEKIT_URL: ${LIVEKIT_URL:0:30}..."
echo "  LIVEKIT_API_KEY: ${LIVEKIT_API_KEY:0:10}..."
echo "  OPENAI_API_KEY: ${OPENAI_API_KEY:0:10}..."
echo "  DEEPGRAM_API_KEY: ${DEEPGRAM_API_KEY:0:10}..."
echo ""
echo "✅ Using Deepgram TTS (aura-asteria-en) for stable audio output"
echo "🎤 Press Ctrl+C to stop the agent"
echo ""
echo "----------------------------------------"
echo ""

# Run the agent in dev mode
python3 agent.py dev

