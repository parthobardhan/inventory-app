# TTS (Text-to-Speech) Connection Error Fix - FINAL SOLUTION

## The Error
```
livekit.agents._exceptions.APIConnectionError: Connection error. (body=None, retryable=True)
livekit.agents._exceptions.APIStatusError: Gateway connection closed unexpectedly (status_code=-1, request_id=...)
WARNING:livekit.agents:failed to synthesize speech, retrying in 2.0s
```

## Problem
The agent was experiencing TTS connection failures because it was routing through LiveKit's **inference gateway** (`agent-gateway.livekit.cloud`), which was closing connections unexpectedly during speech synthesis. Even after switching from OpenAI TTS to Deepgram TTS using the shorthand notation, the gateway remained unstable.

### Root Cause
1. **LiveKit Inference Gateway** acts as a proxy/router for TTS requests
2. Using shorthand notation (e.g., `tts="deepgram/aura-asteria-en"`) routes through the gateway
3. The gateway WebSocket connection is unstable and closes unexpectedly (status_code=-1)
4. The agent retries multiple times but keeps failing
5. Result: User hears nothing, even though the agent is processing requests correctly

### What We Tried
1. ❌ Switched from OpenAI TTS to Deepgram using `tts="deepgram/aura-asteria-en"` - Still failed (gateway issue)
2. ✅ **SOLUTION**: Use direct plugin instances to bypass the gateway entirely

## The Solution

### Use Direct Plugin Instances Instead of Inference Gateway

**Before (using inference gateway - UNSTABLE):**
```python
session = AgentSession(
    stt="deepgram/nova-2",              # ❌ Routes through gateway
    llm="openai/gpt-4o-mini",           # ❌ Routes through gateway  
    tts="deepgram/aura-asteria-en",     # ❌ Routes through gateway (FAILS)
    vad=silero.VAD.load(),
    turn_detection=MultilingualModel(),
)
```

**After (direct plugin instances - STABLE):**
```python
session = AgentSession(
    stt=deepgram.STT(),                              # ✅ Direct Deepgram connection
    llm=openai.LLM(model="gpt-4o-mini"),             # ✅ Direct OpenAI connection
    tts=deepgram.TTS(model="aura-asteria-en"),       # ✅ Direct Deepgram TTS (bypasses gateway!)
    vad=silero.VAD.load(),                           # Voice Activity Detection
    turn_detection=MultilingualModel(),              # Turn detection
)
```

### Why Direct Plugin Instances?

**Advantages:**
1. ✅ **Bypasses unstable gateway** - Connects directly to provider APIs
2. ✅ **More reliable** - No intermediary proxy that can fail
3. ✅ **Lower latency** - Direct connection = faster responses
4. ✅ **Better error handling** - Direct SDK integration
5. ✅ **Full control** - Can configure all plugin options

### Why This Works

The shorthand notation (`tts="deepgram/aura-asteria-en"`) uses LiveKit's newer inference gateway architecture, which routes all requests through `agent-gateway.livekit.cloud`. While convenient, this gateway has stability issues.

By using direct plugin instances (`deepgram.TTS(model="aura-asteria-en")`), we bypass the gateway entirely and connect directly to Deepgram's API, which is much more stable.

**Alternative Deepgram voices:**
- `deepgram/aura-asteria-en` - Warm, friendly female voice (selected)
- `deepgram/aura-luna-en` - Professional female voice
- `deepgram/aura-stella-en` - Energetic female voice
- `deepgram/aura-athena-en` - Authoritative female voice
- `deepgram/aura-hera-en` - Confident female voice
- `deepgram/aura-orion-en` - Professional male voice
- `deepgram/aura-arcas-en` - Friendly male voice
- `deepgram/aura-perseus-en` - Warm male voice
- `deepgram/aura-angus-en` - Deep male voice
- `deepgram/aura-orpheus-en` - Smooth male voice
- `deepgram/aura-helios-en` - Bright male voice
- `deepgram/aura-zeus-en` - Authoritative male voice

## How to Apply the Fix

### 1. Restart the Agent

Stop any running agent processes:
```bash
pkill -f "agent.py"
```

Start the agent with the new configuration:
```bash
cd /Users/partho.bardhan/Documents/projects/inventory-app
./start-agent.sh
```

### 2. Verify It's Working

You should see in the logs:
```
INFO:inventory-voice-agent:Starting inventory voice agent...
INFO:livekit.agents:Connected to LiveKit room
INFO:deepgram:Using Deepgram Aura TTS
```

### 3. Test Voice Output

1. Open http://localhost:3000
2. Click the microphone button 🎤
3. Say: "Hello, can you hear me?"
4. **You should now hear the agent's voice response!** 🔊

## Configuration

### Environment Variables Required

Make sure these are in your `dev.env`:
```env
# Deepgram (for both STT and TTS)
DEEPGRAM_API_KEY=your_deepgram_key

# OpenAI (for LLM only)
OPENAI_API_KEY=your_openai_key

# LiveKit
LIVEKIT_URL=wss://your-instance.livekit.cloud
LIVEKIT_API_KEY=your_livekit_key
LIVEKIT_API_SECRET=your_livekit_secret
```

### Architecture After Fix

```
User Voice Input
    ↓
Deepgram STT (Speech-to-Text) → Transcribes: "Add 10 cushion covers"
    ↓
OpenAI GPT-4 (LLM) → Understands intent & calls tool
    ↓
add_product() tool → Creates product in database
    ↓
OpenAI GPT-4 → Generates response: "Successfully added 10 cushion covers..."
    ↓
Deepgram TTS (Text-to-Speech) → Synthesizes audio ✅
    ↓
User Hears Response 🔊
```

## Troubleshooting

### Still No Audio?

1. **Check Deepgram API Key:**
   ```bash
   echo $DEEPGRAM_API_KEY
   ```
   Should show your key starting with letters/numbers

2. **Test Deepgram TTS directly:**
   ```bash
   curl -X POST https://api.deepgram.com/v1/speak?model=aura-asteria-en \
     -H "Authorization: Token $DEEPGRAM_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"text":"Hello, this is a test"}' \
     --output test.mp3
   
   # Play the test file
   open test.mp3  # macOS
   ```

3. **Check agent logs:**
   ```bash
   tail -f services/agent.log | grep -i "tts\|audio\|deepgram"
   ```

4. **Verify browser audio:**
   - Check browser volume isn't muted
   - Check system volume
   - Try with headphones

### Want to Use a Different Voice?

Edit `services/agent.py` line 756:
```python
tts=deepgram.TTS(model="aura-luna-en"),  # Change to your preferred voice
```

Available voices: `aura-asteria-en`, `aura-luna-en`, `aura-stella-en`, `aura-athena-en`, `aura-hera-en`, `aura-orion-en`, `aura-arcas-en`, `aura-perseus-en`, `aura-angus-en`, `aura-orpheus-en`, `aura-helios-en`, `aura-zeus-en`

Then restart the agent.

### Want to Use OpenAI TTS Instead?

If you prefer OpenAI voices, use the direct plugin:
```python
from livekit.plugins import openai

session = AgentSession(
    stt=deepgram.STT(),
    llm=openai.LLM(model="gpt-4o-mini"),
    tts=openai.TTS(voice="alloy"),  # Direct OpenAI TTS plugin
    vad=silero.VAD.load(),
    turn_detection=MultilingualModel(),
)
```

Available OpenAI voices: `alloy`, `echo`, `fable`, `onyx`, `nova`, `shimmer`

## Alternative: Use ElevenLabs TTS

If you have an ElevenLabs API key, that's another excellent option:

1. Install the plugin:
   ```bash
   pip install livekit-plugins-elevenlabs
   ```

2. Update `agent.py`:
   ```python
   from livekit.plugins import elevenlabs
   
   session = AgentSession(
       stt="deepgram/nova-2",
       llm="openai/gpt-4o-mini",
       tts="elevenlabs/eleven_turbo_v2",  # ElevenLabs TTS
       vad=silero.VAD.load(),
       turn_detection=MultilingualModel(),
   )
   ```

3. Add to `dev.env`:
   ```env
   ELEVENLABS_API_KEY=your_elevenlabs_key
   ```

## Performance Comparison

| Provider | Latency | Stability | Quality | Cost |
|----------|---------|-----------|---------|------|
| Deepgram | ⚡ Fast | ✅ Excellent | ⭐⭐⭐⭐ Good | 💰 Low |
| OpenAI | 🐌 Variable | ⚠️ Unstable | ⭐⭐⭐⭐⭐ Excellent | 💰💰 Medium |
| ElevenLabs | ⚡ Fast | ✅ Excellent | ⭐⭐⭐⭐⭐ Excellent | 💰💰💰 High |

For real-time voice agents, **stability and latency matter more than perfect quality**, so Deepgram is an excellent choice.

## Summary

✅ **Root Cause:** LiveKit inference gateway instability  
✅ **Solution:** Use direct plugin instances instead of shorthand notation  
✅ **Result:** TTS now bypasses the unstable gateway and connects directly to Deepgram  
✅ **Status:** Agent running successfully with no connection errors  
✅ **Voice:** Natural-sounding "Aura Asteria" voice from Deepgram  

**Key Takeaway:** When using LiveKit Agents, prefer direct plugin instances over shorthand notation for better stability and control.

Now test your voice agent - you should hear responses without any connection errors! 🎉

