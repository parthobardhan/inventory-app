# Voice API Documentation

## Overview

The Voice API enables speech-to-text functionality using Deepgram and integrates seamlessly with the existing AI agent tools. This allows users to interact with the inventory system using voice commands.

## Setup

### 1. Install Dependencies

```bash
npm install
```

This will install the `@deepgram/sdk` package along with other dependencies.

### 2. Configure API Keys

Add your Deepgram API key to your `.env` or `dev.env` file:

```env
DEEPGRAM_API_KEY=your_deepgram_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
```

You can get a Deepgram API key from: https://console.deepgram.com/signup

### 3. Start the Server

```bash
npm start
# or for development with auto-reload
npm run dev
```

## API Endpoints

### 1. Check Voice Service Status

**Endpoint:** `GET /api/voice/status`

Check if voice services (Deepgram and OpenAI) are properly configured.

**Response:**
```json
{
  "success": true,
  "status": {
    "deepgram": {
      "configured": true,
      "initialized": true,
      "ready": true
    },
    "openai": {
      "configured": true,
      "ready": true
    },
    "voiceChat": {
      "ready": true
    }
  },
  "message": "Voice chat is ready"
}
```

### 2. Transcribe Audio

**Endpoint:** `POST /api/voice/transcribe`

Transcribe audio to text using Deepgram.

**Request Body:**
```json
{
  "audioData": "base64_encoded_audio_data",
  "mimeType": "audio/webm"
}
```

**Response:**
```json
{
  "success": true,
  "transcript": "Add 30 cushion covers for $45 SKU CC-003",
  "confidence": 0.95,
  "words": [
    { "word": "Add", "start": 0.0, "end": 0.2, "confidence": 0.98 },
    { "word": "30", "start": 0.3, "end": 0.5, "confidence": 0.97 }
  ],
  "metadata": {
    "duration": 3.5,
    "channels": 1,
    "created": "2025-10-16T12:00:00Z"
  }
}
```

### 3. Voice Chat (Transcribe + AI Agent)

**Endpoint:** `POST /api/voice/chat`

Transcribe audio and process it with the AI agent to execute inventory operations.

**Request Body:**
```json
{
  "audioData": "base64_encoded_audio_data",
  "mimeType": "audio/webm",
  "conversationHistory": []
}
```

**Response:**
```json
{
  "success": true,
  "transcript": "Add 30 cushion covers for $45 SKU CC-003",
  "confidence": 0.95,
  "agentResponse": "I've successfully added 30 units of cushion covers (SKU: CC-003) to your inventory at $45 each.",
  "toolsUsed": ["add_product"],
  "toolResults": [
    {
      "success": true,
      "message": "Successfully added 30 units of \"Cushion Covers\" (SKU: CC-003) to inventory.",
      "product": {
        "id": "...",
        "name": "Cushion Covers",
        "sku": "CC-003",
        "type": "cushion-covers",
        "quantity": 30,
        "price": 45
      }
    }
  ],
  "metadata": {
    "duration": 3.5,
    "transcriptionTime": "2025-10-16T12:00:00Z"
  }
}
```

## Features

### Speech Recognition

- **Model:** Deepgram Nova-3 (industry-leading accuracy for pre-recorded audio)
- **Language:** English monolingual for optimal accuracy
- **Smart Formatting:** Automatically formats numbers, currency, and dates
- **Punctuation:** Automatically adds punctuation
- **Keyterm Prompting:** Enhanced recognition for inventory-specific terms:
  - Coverz (brand name)
  - SKU codes
  - bed covers, cushion covers, sarees, towels
  - inventory, stock
  
  Note: Nova-3 uses `keyterm` instead of `keywords` (Nova-2 feature)

### AI Agent Integration

The voice chat endpoint automatically integrates with all existing agent tools:

#### Product Management
- Add products
- Update products
- Delete products
- Search products
- List products
- Get product details
- Update inventory quantities

#### Sales Management
- Record sales
- Get sales history
- Get recent sales

#### Analytics
- View analytics (revenue, profit, etc.)
- Get inventory summary
- Get top products
- Get low stock alerts
- View sales trends

## Usage Examples

### JavaScript (Frontend)

```javascript
// Record audio using MediaRecorder
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
    
    // Send to voice chat API
    const response = await fetch('/api/voice/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        audioData: base64Audio,
        mimeType: 'audio/webm',
        conversationHistory: []
      })
    });
    
    const result = await response.json();
    console.log('Transcript:', result.transcript);
    console.log('Agent Response:', result.agentResponse);
    console.log('Tools Used:', result.toolsUsed);
  };
};

// Start recording
mediaRecorder.start();

// Stop after 5 seconds (or on button click)
setTimeout(() => mediaRecorder.stop(), 5000);
```

### Example Voice Commands

Here are some example voice commands you can use:

#### Adding Products
- "Add 30 cushion covers for $45 SKU CC-003"
- "Add bed cover with SKU BED-001 for $50"
- "Create a new product: Blue Cotton Saree, 10 units at $75 each"

#### Searching Products
- "Search for cushion covers"
- "Find all sarees"
- "Show me products with SKU BED-001"

#### Updating Inventory
- "Add 20 more units to cushion covers"
- "Reduce bed cover quantity by 5"
- "Set saree quantity to 50"

#### Recording Sales
- "Record a sale of 5 cushion covers"
- "Sell 3 bed covers at $55 each"
- "Record sale: 10 sarees"

#### Analytics
- "Show me this month's analytics"
- "What are the top selling products?"
- "Show me low stock alerts"
- "What's my inventory summary?"

## Error Handling

The API provides detailed error messages for common issues:

### No Audio Data
```json
{
  "success": false,
  "error": "No audio data provided"
}
```

### Deepgram Not Configured
```json
{
  "success": false,
  "error": "Deepgram API key is not configured"
}
```

### No Speech Detected
```json
{
  "success": false,
  "error": "No speech detected in the audio",
  "transcript": "",
  "confidence": 0.0
}
```

### OpenAI Not Configured
```json
{
  "success": false,
  "error": "OpenAI API key is not configured",
  "message": "The AI agent is not configured. Please add your OpenAI API key to the environment variables."
}
```

## Best Practices

1. **Audio Quality**: Use good quality audio for better transcription accuracy
2. **Clear Speech**: Speak clearly and at a moderate pace
3. **Background Noise**: Minimize background noise for best results
4. **Specific Commands**: Be specific with product names, quantities, and SKUs
5. **Conversation History**: Pass conversation history for context-aware responses
6. **Error Handling**: Always check the `success` field in responses

## Performance

- **Transcription Time**: Typically 1-3 seconds for short audio clips
- **Agent Processing**: 2-5 seconds depending on tool complexity
- **Total Latency**: Usually 3-8 seconds end-to-end

## Limitations

1. Maximum audio file size: 10MB (set by Express body parser limit)
2. Supported audio formats: WAV, MP3, FLAC, OGG, WebM, and more (Deepgram supports most formats)
3. Language: Currently configured for English only (can be changed in configuration)

## Troubleshooting

### Issue: "Deepgram client not initialized"
**Solution:** Ensure `DEEPGRAM_API_KEY` is set in your environment variables

### Issue: Low transcription confidence
**Solution:** 
- Check audio quality
- Reduce background noise
- Speak more clearly
- Try adding more custom keywords

### Issue: Agent doesn't understand command
**Solution:**
- Be more specific in your voice command
- Use clear product types (bed-covers, cushion-covers, sarees, towels)
- Mention quantities and prices explicitly

## Security Considerations

1. API keys should never be exposed to the client
2. Use HTTPS in production
3. Implement rate limiting to prevent abuse
4. Validate and sanitize all audio input
5. Consider implementing authentication for production use

## Future Enhancements

- Real-time streaming transcription
- Multi-language support
- Voice response (text-to-speech)
- Voice biometrics for authentication
- Emotion detection
- Custom wake word detection

