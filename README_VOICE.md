# 🎤 Voice Integration for Inventory App

## What's New?

Your inventory app now has **voice-to-text capabilities**! Users can manage inventory, record sales, and get analytics using voice commands.

## Quick Demo

```
Step 1: You say: "Add 30 cushion covers for $45 SKU CC-003"

Step 2: Text appears in box: "Add 30 cushion covers for $45 SKU CC-003"
        (You can review and edit if needed)

Step 3: Click "Send" button

Step 4: AI responds: "I've successfully added 30 units of cushion covers 
        (SKU: CC-003) to your inventory at $45 each."
```

### 🎯 Two-Step Voice Process

1. **Voice → Transcription**: Speak your command, it's transcribed and shown in a text box
2. **Review & Send**: Edit if needed, then click Send to process with AI

## Installation

### 1. Install Dependencies
```bash
npm install
```

### 2. Get API Keys

**Deepgram** (Speech-to-Text)
- Sign up: https://console.deepgram.com/signup
- Get $200 in free credits
- Create API key

**OpenAI** (AI Agent)
- Sign up: https://platform.openai.com
- Add payment method
- Create API key

### 3. Configure Environment

Add to your `dev.env`:
```env
DEEPGRAM_API_KEY=your_deepgram_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
```

### 4. Start Server
```bash
npm run dev
```

### 5. Test It!
Open: `http://localhost:3000/voice-test.html`

## Features

### 🎯 API Endpoints

1. **GET /api/voice/status** - Check if services are ready
2. **POST /api/voice/transcribe** - Transcribe audio to text (Step 1 - recommended)
3. **POST /api/agent/chat** - Process text with AI agent (Step 2 - after user reviews)
4. **POST /api/voice/chat** - Direct transcribe + AI (legacy, available but not recommended)

**Recommended Flow**: Use `/api/voice/transcribe` first to show user the transcription, then `/api/agent/chat` after user clicks Send. This gives users control over what gets processed.

### 🔧 Full Tool Integration

All 15+ existing agent tools work with voice:

**Products:** Add, update, delete, search, list  
**Sales:** Record sales, view history  
**Analytics:** Revenue, profit, top products, low stock alerts  

### 🎤 Optimized for Inventory

**Model:** Deepgram Nova-3 (English monolingual)
- 47.4% better accuracy vs competitors for pre-recorded audio
- Perfect for short voice commands (5-10 seconds)
- Custom vocabulary for better recognition:
  - Product types (bed-covers, cushion-covers, sarees, towels)
  - SKU codes
  - Inventory terms
  - Numbers and currency

## Example Voice Commands

### Adding Products
```
"Add 30 cushion covers for $45 SKU CC-003"
"Create a new bed cover product with 20 units at $60"
"Add 15 sarees for $85"
```

### Sales
```
"Record a sale of 5 cushion covers"
"Sell 3 bed covers at $55 each"
"Show me recent sales"
```

### Analytics
```
"What's my inventory summary?"
"Show me this month's analytics"
"What are the top selling products?"
"Show me low stock alerts"
```

## Documentation

- **Quick Start:** [VOICE_QUICK_START.md](./docs/VOICE_QUICK_START.md)
- **Full API Docs:** [VOICE_API.md](./docs/VOICE_API.md)
- **Implementation:** [VOICE_INTEGRATION_SUMMARY.md](./VOICE_INTEGRATION_SUMMARY.md)

## Test Interface

A beautiful test interface is included at `/voice-test.html`:

- ✅ Service status checking
- ✅ One-click recording with **auto-stop on silence**
- ✅ Real-time transcription into editable text box
- ✅ Review & edit capability before sending
- ✅ Manual send with "Send" button or Enter key
- ✅ AI response display with tool results
- ✅ Tools execution visualization
- ✅ Example commands
- ✅ Smart silence detection (auto-stops after 1.5s of silence)
- ✅ Confidence score display

## Architecture

```
Voice → Deepgram → Text Box → [User Reviews] → OpenAI → Agent Tools → MongoDB
```

1. User speaks command
2. Deepgram transcribes to text
3. Text appears in input box (user can review/edit)
4. User clicks "Send" button
5. OpenAI analyzes intent
6. Agent executes appropriate tool
7. Response sent back

This two-step process ensures accuracy and gives users control over what gets processed.

## Simple Integration Example

```javascript
// Step 1: Record and transcribe audio
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
const mediaRecorder = new MediaRecorder(stream);
const audioChunks = [];

mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);

mediaRecorder.onstop = async () => {
  const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
  
  // Convert to base64
  const reader = new FileReader();
  reader.readAsDataURL(audioBlob);
  reader.onloadend = async () => {
    const base64Audio = reader.result.split(',')[1];
    
    // Transcribe only (Step 1)
    const response = await fetch('/api/voice/transcribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audioData: base64Audio })
    });
    
    const result = await response.json();
    console.log('Transcript:', result.transcript);
    console.log('Confidence:', result.confidence);
    
    // Show in text box for user to review
    document.getElementById('messageInput').value = result.transcript;
  };
};

mediaRecorder.start();

// Step 2: Send to AI when user clicks Send button
document.getElementById('sendBtn').addEventListener('click', async () => {
  const message = document.getElementById('messageInput').value;
  
  const response = await fetch('/api/agent/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message })
  });
  
  const result = await response.json();
  console.log('AI Response:', result.message);
});
```

## Performance

| Metric | Typical Value |
|--------|--------------|
| Transcription | 1-3 seconds |
| AI Processing | 2-5 seconds |
| Total | 3-8 seconds |
| Audio Limit | 10 MB |

## Use Cases

✅ Hands-free inventory management  
✅ Mobile-first operations  
✅ Accessibility support  
✅ Fast data entry  
✅ Natural language interaction  

## Security

- ✅ API key validation
- ✅ Rate limiting
- ✅ Input validation
- ✅ CORS protection
- ✅ Security headers
- ✅ 10MB size limit

## Troubleshooting

### "Deepgram API key is not configured"
→ Add `DEEPGRAM_API_KEY` to `dev.env` and restart server

### "Failed to access microphone"
→ Allow microphone permissions in browser

### Low confidence scores
→ Speak clearly, reduce background noise, use good microphone

### "No speech detected"
→ Record for 2-5 seconds minimum, speak louder

## Production Deployment

For Vercel/production:
```env
DEEPGRAM_API_KEY=prod_key
OPENAI_API_KEY=prod_key
NODE_ENV=production
```

Note: HTTPS required for voice input in production (Vercel provides this automatically)

## What's Next?

- 🎯 Test with the included interface
- 🎯 Integrate into your main app
- 🎯 Add conversation history for context
- 🎯 Customize the UI
- 🎯 Build voice-first features!

## Support

Having issues? Check:
1. [Quick Start Guide](./docs/VOICE_QUICK_START.md)
2. [API Documentation](./docs/VOICE_API.md)
3. `/api/voice/status` endpoint
4. Browser console for errors

## Summary

The voice integration is:
- ✅ Production-ready
- ✅ Fully integrated with existing tools
- ✅ Well-documented
- ✅ Easy to test
- ✅ Secure and performant

Just add your API keys and start voice chatting! 🎤✨

---

**Quick Links:**
- Test Interface: `http://localhost:3000/voice-test.html`
- Status Check: `http://localhost:3000/api/voice/status`
- Deepgram Console: https://console.deepgram.com

