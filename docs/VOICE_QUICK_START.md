# Voice Integration Quick Start Guide

## 🚀 Get Started in 5 Minutes

### Step 1: Install Dependencies

```bash
cd /Users/partho.bardhan/Documents/projects/inventory-app
npm install
```

This will install the new `@deepgram/sdk` package along with all existing dependencies.

### Step 2: Get API Keys

#### Deepgram API Key
1. Go to [Deepgram Console](https://console.deepgram.com/signup)
2. Sign up for a free account (includes $200 in free credits)
3. Create a new API key
4. Copy the API key

#### OpenAI API Key (if you don't have one)
1. Go to [OpenAI Platform](https://platform.openai.com/signup)
2. Sign up and add payment method
3. Create a new API key
4. Copy the API key

### Step 3: Configure Environment

Add these to your `dev.env` file:

```env
DEEPGRAM_API_KEY=your_deepgram_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
```

### Step 4: Start the Server

```bash
npm run dev
```

### Step 5: Test the Integration

Open your browser and navigate to:

```
http://localhost:3000/voice-test.html
```

## 🎤 Testing Voice Commands

### Basic Test Flow

1. Click "Start Recording" button
2. Speak one of these commands:
   - "Add 30 cushion covers for $45 SKU CC-003"
   - "Show me all bed covers"
   - "What's my inventory summary?"
3. **No need to click Stop!** Recording automatically stops after 1.5 seconds of silence
4. Watch the magic happen! ✨

**Note:** You can still manually click "Stop" anytime, or recording will auto-stop after 30 seconds max.

### Example Commands by Category

#### Adding Products
```
"Add 30 cushion covers for $45 SKU CC-003"
"Create a new bed cover product with 20 units at $60 each"
"Add 15 sarees for $85 SKU SAR-001"
```

#### Searching
```
"Search for cushion covers"
"Show me all sarees"
"Find products with low stock"
```

#### Sales
```
"Record a sale of 5 cushion covers"
"Sell 3 bed covers"
"Show me recent sales"
```

#### Analytics
```
"What's my inventory summary?"
"Show me this month's analytics"
"What are the top selling products?"
"Show me low stock alerts"
```

## 🎯 Model Used

This integration uses **Deepgram Nova-3** with English monolingual settings for:
- ✅ 47.4% better word error rate for pre-recorded audio
- ✅ Superior accuracy for SKU codes, numbers, and product names
- ✅ Optimal performance for short voice commands (5-10 seconds)

## 📊 API Endpoints

### Check Status
```bash
curl http://localhost:3000/api/voice/status
```

### Transcribe Only
```bash
curl -X POST http://localhost:3000/api/voice/transcribe \
  -H "Content-Type: application/json" \
  -d '{"audioData": "base64_audio_here", "mimeType": "audio/webm"}'
```

### Voice Chat (Transcribe + AI)
```bash
curl -X POST http://localhost:3000/api/voice/chat \
  -H "Content-Type: application/json" \
  -d '{"audioData": "base64_audio_here", "mimeType": "audio/webm"}'
```

## 🔧 Integration with Your Frontend

### Simple JavaScript Example

```javascript
// Start recording
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
const mediaRecorder = new MediaRecorder(stream);
const audioChunks = [];

mediaRecorder.ondataavailable = (event) => {
  audioChunks.push(event.data);
};

mediaRecorder.onstop = async () => {
  const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
  
  // Convert to base64
  const reader = new FileReader();
  reader.readAsDataURL(audioBlob);
  reader.onloadend = async () => {
    const base64Audio = reader.result.split(',')[1];
    
    // Send to API
    const response = await fetch('/api/voice/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audioData: base64Audio,
        mimeType: 'audio/webm'
      })
    });
    
    const result = await response.json();
    console.log('Transcript:', result.transcript);
    console.log('Response:', result.agentResponse);
  };
};

// Start recording
mediaRecorder.start();

// Stop after 5 seconds
setTimeout(() => mediaRecorder.stop(), 5000);
```

## 🎯 What's Integrated

The voice chat API has access to **ALL** existing agent tools:

### Product Tools ✅
- ✅ `add_product` - Add new products
- ✅ `update_product` - Update product details
- ✅ `update_inventory` - Change stock levels
- ✅ `delete_product` - Remove products
- ✅ `search_products` - Search inventory
- ✅ `get_product` - Get product details
- ✅ `list_products` - List all products

### Sales Tools ✅
- ✅ `record_sale` - Record sales
- ✅ `get_sales_history` - View sales history
- ✅ `get_recent_sales` - Recent transactions

### Analytics Tools ✅
- ✅ `view_analytics` - Revenue & profit stats
- ✅ `get_inventory_summary` - Inventory overview
- ✅ `get_top_products` - Best sellers
- ✅ `get_low_stock_alerts` - Stock alerts
- ✅ `get_sales_trends` - Sales trends

## 🔍 Troubleshooting

### "Deepgram API key is not configured"
- Check that `DEEPGRAM_API_KEY` is in your `dev.env` file
- Restart the server after adding the key

### "Failed to access microphone"
- Allow microphone permissions in your browser
- Check browser console for detailed errors
- Make sure you're using HTTPS (or localhost)

### Low transcription confidence
- Speak clearly and at moderate pace
- Reduce background noise
- Use a good quality microphone
- Check audio levels

### "No speech detected"
- Ensure you're recording long enough (2-5 seconds minimum)
- Check microphone is working properly
- Speak louder or closer to the microphone

## 📚 Architecture

```
Voice Input → Deepgram (Speech-to-Text) → OpenAI Agent (Intent) → Tools (Actions) → Response
```

1. **User speaks** into microphone
2. **Browser records** audio (WebM format)
3. **Frontend sends** base64 audio to `/api/voice/chat`
4. **Deepgram transcribes** audio to text
5. **OpenAI analyzes** text and determines intent
6. **Agent executes** appropriate tool(s)
7. **Response sent** back with transcript and agent message

## 🚢 Production Deployment

### Environment Variables (Vercel/Production)
```env
DEEPGRAM_API_KEY=prod_api_key
OPENAI_API_KEY=prod_api_key
MONGODB_URI=your_mongodb_uri
NODE_ENV=production
```

### HTTPS Required
- Voice input requires HTTPS in production
- Vercel automatically provides HTTPS
- For custom domains, ensure SSL certificate is valid

### Rate Limiting
- Consider implementing rate limits for voice endpoints
- Current implementation: 100 requests per 15 minutes (production)

## 💡 Tips for Best Results

1. **Clear Speech**: Speak naturally but clearly
2. **Specific Commands**: Be specific about quantities, prices, SKUs
3. **Product Types**: Use exact types: bed-covers, cushion-covers, sarees, towels
4. **Numbers**: Speak numbers clearly (e.g., "thirty" or "3-0")
5. **Context**: Provide context in one command (e.g., "Add 30 cushion covers for $45")

## 📞 Support

For issues or questions:
1. Check the [Voice API Documentation](./VOICE_API.md)
2. Review the [Main Documentation](../README.md)
3. Check browser console for detailed errors
4. Test with the `/api/voice/status` endpoint

## 🎉 What's Next?

- Test with different voice commands
- Integrate into your main app UI
- Add conversation history for context
- Customize the UI in `voice-test.html`
- Build voice-first features into your inventory app!

Happy voice chatting! 🎤✨

