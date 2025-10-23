# OpenAI TTS Configuration - Active ✅

**Date:** October 23, 2025  
**Current Configuration:** OpenAI TTS with direct plugin  
**Status:** ✅ RUNNING

---

## Current Configuration

The agent is now using **OpenAI's Text-to-Speech API** with direct plugin integration:

```python
session = AgentSession(
    stt=deepgram.STT(),                        # Deepgram Speech-to-text
    llm=openai.LLM(model="gpt-4o-mini"),       # OpenAI Language model
    tts=openai.TTS(model="tts-1", voice="alloy"),  # ✅ OpenAI TTS (direct plugin)
    vad=silero.VAD.load(),
    turn_detection=MultilingualModel(),
)
```

---

## OpenAI TTS Models

OpenAI provides two TTS models:

| Model | Quality | Speed | Use Case |
|-------|---------|-------|----------|
| **tts-1** | Good | ⚡ Fast | Real-time applications (current) |
| **tts-1-hd** | Excellent | 🐌 Slower | High-quality recordings |

**Currently using:** `tts-1` (optimized for low latency, perfect for voice agents)

---

## Available Voices

OpenAI offers 6 different voices:

### Current Voice: `alloy` ✅
Neutral, balanced voice suitable for general use.

### Other Available Voices:

1. **alloy** - Neutral and balanced (current)
2. **ash** - Clear, professional tone
3. **ballad** - Warm and conversational  
4. **coral** - Friendly and engaging
5. **echo** - Smooth and articulate
6. **sage** - Calm and informative
7. **shimmer** - Bright and expressive

---

## Change Voice

To use a different voice, edit `services/agent.py` line 756:

```python
# Professional tone
tts=openai.TTS(model="tts-1", voice="ash")

# Warm and conversational
tts=openai.TTS(model="tts-1", voice="ballad")

# Friendly and engaging
tts=openai.TTS(model="tts-1", voice="coral")

# Smooth and articulate
tts=openai.TTS(model="tts-1", voice="echo")

# Calm and informative
tts=openai.TTS(model="tts-1", voice="sage")

# Bright and expressive
tts=openai.TTS(model="tts-1", voice="shimmer")
```

Then restart the agent:
```bash
cd /Users/partho.bardhan/Documents/projects/inventory-app
./restart-agent.sh
```

---

## Use High-Quality Model

For better audio quality (with slightly higher latency), use `tts-1-hd`:

```python
tts=openai.TTS(model="tts-1-hd", voice="alloy")
```

**Note:** `tts-1-hd` is slower but produces higher quality audio. Only use it if audio quality is more important than response time.

---

## Additional Configuration Options

### Adjust Speech Speed

```python
tts=openai.TTS(
    model="tts-1",
    voice="alloy",
    speed=1.0  # Range: 0.25 to 4.0 (1.0 is normal speed)
)
```

- `speed=0.75` - 25% slower (clearer for complex information)
- `speed=1.0` - Normal speed (default)
- `speed=1.25` - 25% faster (more dynamic)

### Custom Instructions (Advanced)

```python
tts=openai.TTS(
    model="tts-1",
    voice="alloy",
    instructions="Speak with enthusiasm and energy"
)
```

---

## Why Direct Plugin?

Using `openai.TTS(model="tts-1", voice="alloy")` instead of shorthand notation:

✅ **Benefits:**
- Bypasses LiveKit inference gateway (more stable)
- Direct connection to OpenAI API
- Lower latency
- Full control over all TTS parameters
- Better error messages

❌ **Avoid:**
```python
tts="openai/tts-1/alloy"  # Routes through unstable gateway
```

---

## Environment Variables Required

Make sure these are set in your `dev.env`:

```env
# OpenAI (for LLM and TTS)
OPENAI_API_KEY=your_openai_api_key

# Deepgram (for STT)
DEEPGRAM_API_KEY=your_deepgram_api_key

# LiveKit
LIVEKIT_URL=wss://your-instance.livekit.cloud
LIVEKIT_API_KEY=your_livekit_key
LIVEKIT_API_SECRET=your_livekit_secret
```

---

## Testing

### 1. Check Agent Status
```bash
ps aux | grep "[a]gent.py"
```

Should show a running Python process.

### 2. View Logs
```bash
tail -f /tmp/inventory-agent.log
```

Should see:
```
INFO:livekit.agents:registered worker
```

### 3. Test Voice Output

1. Open http://localhost:3000
2. Click the microphone button 🎤
3. Say: "Hello, can you hear me?"
4. You should hear the OpenAI TTS response! 🔊

---

## Troubleshooting

### No Audio Output?

1. **Check OpenAI API Key:**
   ```bash
   echo $OPENAI_API_KEY
   ```

2. **Test OpenAI TTS directly:**
   ```bash
   curl https://api.openai.com/v1/audio/speech \
     -H "Authorization: Bearer $OPENAI_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{
       "model": "tts-1",
       "input": "Hello, this is a test of OpenAI text to speech.",
       "voice": "alloy"
     }' \
     --output test.mp3
   
   # Play the test file
   open test.mp3  # macOS
   ```

3. **Check logs for errors:**
   ```bash
   tail -50 /tmp/inventory-agent.log | grep -i "error\|tts\|openai"
   ```

### Audio Sounds Robotic or Choppy?

Try the HD model:
```python
tts=openai.TTS(model="tts-1-hd", voice="alloy")
```

### Want Faster Responses?

The `tts-1` model is already optimized for speed. You can slightly increase speech speed:
```python
tts=openai.TTS(model="tts-1", voice="alloy", speed=1.1)
```

---

## Cost Comparison

| Provider | Quality | Latency | Cost per 1M characters |
|----------|---------|---------|------------------------|
| OpenAI tts-1 | ⭐⭐⭐⭐ Good | ⚡ Fast | $15.00 |
| OpenAI tts-1-hd | ⭐⭐⭐⭐⭐ Excellent | 🐌 Medium | $30.00 |
| Deepgram Aura | ⭐⭐⭐⭐ Good | ⚡⚡ Very Fast | $8.00 |

**For real-time voice agents:** OpenAI `tts-1` offers a great balance of quality and speed.

---

## Switch Back to Deepgram

If you want to switch back to Deepgram TTS:

```python
session = AgentSession(
    stt=deepgram.STT(),
    llm=openai.LLM(model="gpt-4o-mini"),
    tts=deepgram.TTS(model="aura-asteria-en"),  # Deepgram TTS
    vad=silero.VAD.load(),
    turn_detection=MultilingualModel(),
)
```

Then restart: `./restart-agent.sh`

---

## Official Documentation

- **OpenAI TTS API:** https://platform.openai.com/docs/guides/text-to-speech
- **Available Voices:** https://platform.openai.com/docs/guides/text-to-speech/voice-options
- **LiveKit OpenAI Plugin:** https://docs.livekit.io/agents/plugins/openai/

---

## Status

✅ **Agent running successfully** (PID: 58737)  
✅ **Using OpenAI TTS** with `tts-1` model  
✅ **Voice:** alloy  
✅ **No connection errors**  

**Last updated:** October 23, 2025 01:09 AM PST

---

🎉 **Your agent is now using OpenAI's Text-to-Speech!**

Test it out by connecting to your voice interface and speaking to the agent.

