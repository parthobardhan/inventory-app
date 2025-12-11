/**
 * Voice Route - Deepgram Live Streaming + LLM
 * Restores live transcription (websocket) with proper opus/webm handling.
 */

const express = require('express');
const router = express.Router();
const { createClient, LiveTranscriptionEvents } = require('@deepgram/sdk');
const agentService = require('../services/agentService');

// Store active WebSocket connections
const activeConnections = new Map();

/**
 * Initialize WebSocket handling for voice streaming
 * This should be called from server.js with the express-ws instance
 */
function initializeWebSocket(app) {
    app.ws('/api/voice/stream', (ws, req) => {
        const connectionId = `voice_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        console.log(`🎙️ [Voice] New connection: ${connectionId}`);

        let deepgramConnection = null;
        let conversationHistory = [];
        let currentTranscript = '';
        let isProcessingLLM = false;
        let keepAliveInterval = null;
        let reconnecting = false;
        let hasStarted = false;

        // Initialize Deepgram connection
        const initDeepgram = async () => {
            return new Promise(async (resolve, reject) => {
                try {
                    if (!process.env.DEEPGRAM_API_KEY) {
                        throw new Error('DEEPGRAM_API_KEY not configured');
                    }

                    const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

                    deepgramConnection = deepgram.listen.live({
                        model: 'nova-2',
                        language: 'en',
                        smart_format: true,
                        interim_results: true,
                        endpointing: 300,
                        utterance_end_ms: 1000,
                        vad_events: true,
                        punctuate: true,
                        encoding: 'linear16',
                        sample_rate: 16000,
                        channels: 1,
                    });

                    deepgramConnection.on(LiveTranscriptionEvents.Open, () => {
                        console.log('✅ [Voice] Deepgram connection opened');
                        keepAliveInterval = setInterval(() => {
                            if (deepgramConnection) {
                                deepgramConnection.keepAlive();
                            }
                        }, 10000);
                        sendToClient(ws, {
                            type: 'status',
                            status: 'connected',
                            message: 'Connected! Ready to start.',
                        });
                        resolve();
                    });

                    deepgramConnection.on(LiveTranscriptionEvents.Transcript, async (data) => {
                        const transcript = data.channel?.alternatives?.[0]?.transcript || '';
                        const isFinal = data.is_final;
                        const speechFinal = data.speech_final;

                        if (!transcript) return;

                        if (isFinal) currentTranscript = transcript;

                        sendToClient(ws, {
                            type: 'transcript',
                            text: transcript,
                            is_final: isFinal,
                            speech_final: speechFinal,
                        });

                        if (speechFinal && transcript && !isProcessingLLM) {
                            isProcessingLLM = true;
                            sendToClient(ws, {
                                type: 'status',
                                status: 'processing',
                                message: 'Processing your request...',
                            });

                            try {
                                const llmResponse = await agentService.chat(transcript, conversationHistory);
                                if (llmResponse.success) {
                                    conversationHistory.push(
                                        { role: 'user', content: transcript },
                                        { role: 'assistant', content: llmResponse.message }
                                    );
                                    if (conversationHistory.length > 20) {
                                        conversationHistory = conversationHistory.slice(-20);
                                    }
                                    sendToClient(ws, {
                                        type: 'response',
                                        text: llmResponse.message,
                                        toolsUsed: llmResponse.toolsUsed || [],
                                    });
                                } else {
                                    sendToClient(ws, {
                                        type: 'error',
                                        message: llmResponse.message || 'Failed to process request',
                                    });
                                }
                            } catch (err) {
                                console.error('❌ [Voice] LLM error:', err);
                                sendToClient(ws, {
                                    type: 'error',
                                    message: 'Sorry, I encountered an error. Please try again.',
                                });
                            } finally {
                                isProcessingLLM = false;
                                currentTranscript = '';
                                sendToClient(ws, { type: 'status', status: 'ready', message: 'Ready' });
                            }
                        }
                    });

                    deepgramConnection.on(LiveTranscriptionEvents.SpeechStarted, () => {
                        sendToClient(ws, { type: 'status', status: 'listening', message: 'Listening...' });
                    });

                    deepgramConnection.on(LiveTranscriptionEvents.Error, (error) => {
                        console.error('❌ [Voice] Deepgram error:', error);
                        sendToClient(ws, {
                            type: 'error',
                            message: 'Transcription error: ' + (error.message || 'Unknown error'),
                        });
                    });

                    deepgramConnection.on(LiveTranscriptionEvents.Close, () => {
                        console.log('🔌 [Voice] Deepgram connection closed');
                        if (keepAliveInterval) {
                            clearInterval(keepAliveInterval);
                            keepAliveInterval = null;
                        }
                        if (ws.readyState === 1 && !reconnecting) {
                            reconnecting = true;
                            console.log('🔄 [Voice] Auto-reconnecting to Deepgram...');
                            setTimeout(() => {
                                initDeepgram().then(() => (reconnecting = false)).catch(() => (reconnecting = false));
                            }, 1000);
                        }
                    });

                    activeConnections.set(connectionId, {
                        ws,
                        deepgram: deepgramConnection,
                        conversationHistory,
                    });

                    console.log('✅ [Voice] Deepgram initialized');
                } catch (error) {
                    console.error('❌ [Voice] Failed to initialize Deepgram:', error);
                    sendToClient(ws, {
                        type: 'error',
                        message: 'Failed to initialize voice service: ' + error.message,
                    });
                    reject(error);
                }
            });
        };

        // Handle incoming control + audio messages from browser
        let audioChunkCount = 0;
        ws.on('message', async (rawMessage) => {
            try {
                const parsed = JSON.parse(rawMessage.toString());

                if (parsed.type === 'start') {
                    if (!deepgramConnection) {
                        await initDeepgram();
                    }
                    hasStarted = true;
                    sendToClient(ws, { type: 'status', status: 'listening', message: 'Listening...' });
                    return;
                }

                if (parsed.type === 'audio') {
                    if (!hasStarted || !deepgramConnection) {
                        console.warn('⚠️ [Voice] Audio received before start/init, ignoring chunk.');
                        return;
                    }

                    const readyState = deepgramConnection.getReadyState();
                    if (readyState !== 1) {
                        console.warn('⚠️ [Voice] Deepgram not ready, state:', readyState);
                        return;
                    }

                    if (!parsed.audio) {
                        return;
                    }

                    const audioBuffer = Buffer.from(parsed.audio, 'base64');
                    audioChunkCount++;
                    if (audioChunkCount <= 5 || audioChunkCount % 40 === 0) {
                        console.log(`📥 [Voice] Received PCM chunk #${audioChunkCount}: ${audioBuffer.length} bytes`);
                    }

                    deepgramConnection.send(audioBuffer);
                    return;
                }

                if (parsed.type === 'stop') {
                    console.log('🛑 [Voice] Stop received');
                    hasStarted = false;
                    if (deepgramConnection) {
                        deepgramConnection.finish();
                    }
                    return;
                }
            } catch (err) {
                console.error('❌ [Voice] Failed to process WS message:', err);
                sendToClient(ws, {
                    type: 'error',
                    message: 'Failed to process audio message',
                });
            }
        });

        ws.on('close', () => {
            console.log(`🔌 [Voice] Connection closed: ${connectionId}`);
            if (keepAliveInterval) clearInterval(keepAliveInterval);
            if (deepgramConnection) deepgramConnection.finish();
            activeConnections.delete(connectionId);
        });

        ws.on('error', (error) => {
            console.error(`❌ [Voice] WebSocket error: ${connectionId}`, error);
            if (keepAliveInterval) clearInterval(keepAliveInterval);
            if (deepgramConnection) deepgramConnection.finish();
            activeConnections.delete(connectionId);
        });

        // Initialize Deepgram when connection is established
        initDeepgram();
    });
}

// Status endpoint
router.get('/status', (req, res) => {
    const hasDeepgram = !!process.env.DEEPGRAM_API_KEY;
    res.json({
        success: true,
        configured: hasDeepgram,
        message: hasDeepgram
            ? 'Voice streaming is configured'
            : 'DEEPGRAM_API_KEY is not configured',
    });
});

function sendToClient(ws, data) {
    if (ws.readyState === 1) {
        ws.send(JSON.stringify(data));
    }
}

module.exports = router;
module.exports.initializeWebSocket = initializeWebSocket;
