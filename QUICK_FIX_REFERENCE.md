# Quick Fix Reference Card

## TTS Gateway Error - FIXED ✅

### The Problem
```
APIConnectionError: Connection error
Gateway connection closed unexpectedly (status_code=-1)
```

### The Solution (1-line change)
**In `services/agent.py` line ~756:**

❌ **OLD** (routes through unstable gateway):
```python
tts="deepgram/aura-asteria-en"
```

✅ **NEW** (direct connection):
```python
tts=deepgram.TTS(voice="aura-asteria-en")
```

---

## Commands

### Check Agent Status
```bash
ps aux | grep "[a]gent.py"
```

### View Logs
```bash
tail -f /tmp/inventory-agent.log
```

### Restart Agent
```bash
cd /Users/partho.bardhan/Documents/projects/inventory-app
pkill -f "agent.py"
./start-agent.sh
```

### Stop Agent
```bash
pkill -f "agent.py"
```

---

## Current Configuration (Working ✅)

```python
session = AgentSession(
    stt=deepgram.STT(),                         # Direct Deepgram STT
    llm=openai.LLM(model="gpt-4o-mini"),        # Direct OpenAI LLM
    tts=openai.TTS(model="tts-1", voice="alloy"),  # Direct OpenAI TTS ✅
    vad=silero.VAD.load(),
    turn_detection=MultilingualModel(),
)
```

---

## Change Voice (Optional)

Edit `services/agent.py` line 756:

**OpenAI Voices:**
```python
tts=openai.TTS(model="tts-1", voice="ash")      # Professional tone
tts=openai.TTS(model="tts-1", voice="ballad")   # Warm & conversational
tts=openai.TTS(model="tts-1", voice="coral")    # Friendly & engaging
tts=openai.TTS(model="tts-1", voice="echo")     # Smooth & articulate
tts=openai.TTS(model="tts-1", voice="sage")     # Calm & informative
tts=openai.TTS(model="tts-1", voice="shimmer")  # Bright & expressive
```

**Or switch to Deepgram:**
```python
tts=deepgram.TTS(model="aura-asteria-en")  # Warm female
tts=deepgram.TTS(model="aura-orion-en")    # Professional male
```

Then restart: `./restart-agent.sh`

---

## Key Insight

**Shorthand notation = Gateway (unstable):**
```python
tts="provider/model"  # ❌ Routes through agent-gateway.livekit.cloud
```

**Direct plugin = Direct API (stable):**
```python
tts=provider.TTS(...)  # ✅ Connects directly to provider's API
```

---

## Status

✅ Agent running successfully  
✅ No TTS connection errors  
✅ Voice responses working  

**Last updated:** Oct 23, 2025

