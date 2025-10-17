const express = require('express');
const router = express.Router();
const { createClient } = require('@deepgram/sdk');
const { chat } = require('../services/agentService');

let deepgram = null;
if (process.env.DEEPGRAM_API_KEY) {
    deepgram = createClient({
        apiKey: process.env.DEEPGRAM_API_KEY,
    });
}

// POST /api/voice/transcribe - Transcribe audio to text
router.post('/transcribe', async (req, res) => {
    try {
        const { audioData, mimeType } = req.body;

        if (!audioData) {
            return res.status(400).json({ success: false, error: 'No audio data provided' });
        }

        console.log('🎤 Transcribing audio with Deepgram...');
        console.log('📊 Audio data size:', (audioData.length * 0.75 / 1024).toFixed(2), 'KB');

        if (!process.env.DEEPGRAM_API_KEY) {
            return res.status(500).json({ success: false, error: 'Deepgram API key is not configured' });
        }
        
        if (!deepgram) {
            return res.status(500).json({ success: false, error: 'Deepgram client not initialized' });
        }

        const audioBuffer = Buffer.from(audioData, 'base64');

        const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
            audioBuffer,
            {
              model: 'nova-3', // Latest Nova-3 model for best accuracy
              smart_format: true, // Auto-format numbers, currency, dates
              punctuate: true, // Add punctuation
              paragraphs: false, // Single paragraph for commands
              utterances: false, // Don't need separate utterances
              language: 'en', // English (monolingual)
              
              // Nova-3 uses keyterm prompting instead of keywords
              keyterm: [
                'Coverz', // Brand name
                'SKU',
                'bed covers',
                'cushion covers',
                'bed-covers',
                'cushion-covers',
                'sarees',
                'towels',
                'inventory',
                'stock',
              ],
              
              // Additional options for better accuracy
              diarize: false, // Don't need speaker detection
              numerals: true, // Convert numbers to digits
              profanity_filter: false, // Don't filter (you might want SKU codes)
            }
        );
      
        if (error) {
            throw error;
        }
      
        // Extract the transcript
        const transcript = result.results.channels[0].alternatives[0].transcript;
        const confidence = result.results.channels[0].alternatives[0].confidence;
        const words = result.results.channels[0].alternatives[0].words;

        console.log('✅ Transcription complete:', transcript);
        console.log('📈 Confidence:', (confidence * 100).toFixed(2) + '%');

        return res.json({
            success: true,
            transcript: transcript,
            confidence: confidence,
            words: words,
            metadata: {
                duration: result.metadata.duration,
                channels: result.metadata.channels,
                created: result.metadata.created
            }
        });

    } catch (error) {
        console.error('❌ Transcription error:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Failed to transcribe audio'
        });
    }
});

// POST /api/voice/chat - Transcribe audio and process with AI agent
router.post('/chat', async (req, res) => {
    try {
        const { audioData, mimeType, conversationHistory } = req.body;

        if (!audioData) {
            return res.status(400).json({ success: false, error: 'No audio data provided' });
        }

        console.log('🎤 Processing voice chat request...');

        // Check if services are configured
        if (!process.env.DEEPGRAM_API_KEY) {
            return res.status(500).json({ 
                success: false, 
                error: 'Deepgram API key is not configured' 
            });
        }

        if (!process.env.OPENAI_API_KEY) {
            return res.status(500).json({
                success: false,
                error: 'OpenAI API key is not configured',
                message: 'The AI agent is not configured. Please add your OpenAI API key to the environment variables.',
            });
        }
        
        if (!deepgram) {
            return res.status(500).json({ 
                success: false, 
                error: 'Deepgram client not initialized' 
            });
        }

        // Step 1: Transcribe the audio
        console.log('📝 Step 1: Transcribing audio...');
        const audioBuffer = Buffer.from(audioData, 'base64');

        const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
            audioBuffer,
            {
              model: 'nova-3', // Nova-3 for best accuracy on pre-recorded audio
              smart_format: true,
              punctuate: true,
              paragraphs: false,
              utterances: false,
              language: 'en', // Monolingual English
              
              // Nova-3 uses keyterm prompting (not keywords)
              keyterm: [
                'Coverz',
                'SKU',
                'bed covers',
                'cushion covers',
                'bed-covers',
                'cushion-covers',
                'sarees',
                'towels',
                'inventory',
                'stock',
              ],
              diarize: false,
              numerals: true,
              profanity_filter: false,
            }
        );
      
        if (error) {
            throw error;
        }
      
        const transcript = result.results.channels[0].alternatives[0].transcript;
        const confidence = result.results.channels[0].alternatives[0].confidence;

        console.log('✅ Transcription:', transcript);
        console.log('📈 Confidence:', (confidence * 100).toFixed(2) + '%');

        if (!transcript || transcript.trim().length === 0) {
            return res.json({
                success: false,
                error: 'No speech detected in the audio',
                transcript: '',
                confidence: confidence
            });
        }

        // Step 2: Process with AI agent
        console.log('🤖 Step 2: Processing with AI agent...');
        
        // Parse conversation history
        let parsedHistory = conversationHistory || [];
        if (typeof conversationHistory === 'string') {
            try {
                parsedHistory = JSON.parse(conversationHistory);
            } catch (e) {
                console.warn('Failed to parse conversation history:', e);
                parsedHistory = [];
            }
        }

        // Call the agent service with the transcribed text
        const agentResponse = await chat(transcript, parsedHistory);

        console.log('✅ Agent response generated');

        // Return combined response
        return res.json({
            success: true,
            transcript: transcript,
            confidence: confidence,
            agentResponse: agentResponse.message,
            toolsUsed: agentResponse.toolsUsed || [],
            toolResults: agentResponse.toolResults || [],
            metadata: {
                duration: result.metadata.duration,
                transcriptionTime: result.metadata.created
            }
        });

    } catch (error) {
        console.error('❌ Voice chat error:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Failed to process voice chat'
        });
    }
});

// GET /api/voice/status - Check if voice services are configured
router.get('/status', (req, res) => {
    const hasDeepgram = !!process.env.DEEPGRAM_API_KEY;
    const hasOpenAI = !!process.env.OPENAI_API_KEY;
    const deepgramInitialized = !!deepgram;

    res.json({
        success: true,
        status: {
            deepgram: {
                configured: hasDeepgram,
                initialized: deepgramInitialized,
                ready: hasDeepgram && deepgramInitialized
            },
            openai: {
                configured: hasOpenAI,
                ready: hasOpenAI
            },
            voiceChat: {
                ready: hasDeepgram && deepgramInitialized && hasOpenAI
            }
        },
        message: hasDeepgram && hasOpenAI 
            ? 'Voice chat is ready' 
            : 'Voice chat requires both Deepgram and OpenAI API keys'
    });
});

module.exports = router;
