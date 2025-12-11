/**
 * Voice Client - Direct Deepgram STT via WebSocket
 * Simple, fast, no LiveKit required
 */

class VoiceClient {
    constructor() {
        this.ws = null;
        this.audioStream = null;
        this.audioContext = null;
        this.scriptProcessor = null;
        this.audioSource = null;
        this.isConnected = false;
        this.isConnecting = false;
        this.isMuted = true;
        this.isStreaming = false;
        this.deepgramInfo = null;
        
        // Callbacks
        this.onTranscript = null;      // (text, isFinal) => {}
        this.onResponse = null;        // (text) => {}
        this.onStatusChange = null;    // (status, message) => {}
        this.onError = null;           // (message) => {}
    }

    /**
     * Check if voice service is available
     */
    async checkAvailability() {
        try {
            const response = await fetch('/api/voice/status');
            const data = await response.json();
            return data.configured;
        } catch (error) {
            console.error('❌ [Voice] Failed to check availability:', error);
            return false;
        }
    }

    /**
     * Pre-connect and get microphone ready (muted)
     * Call this on page load for instant activation later
     */
    async preConnect() {
        if (this.isConnected || this.isConnecting) return;

        try {
            this.isConnecting = true;
            console.log('🔄 [Voice] Pre-connecting...');

            // Get microphone access early
            this.audioStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });
            console.log('✅ [Voice] Microphone access granted');

            // Fetch Deepgram connection info (url + token)
            this.deepgramInfo = await this._fetchDeepgramInfo();
            if (!this.deepgramInfo) {
                throw new Error('Failed to obtain Deepgram token');
            }

            // Prepare audio context + processor for 16k PCM
            this._setupAudioPipeline();

            // Connect WebSocket directly to Deepgram
            const protocols = this.deepgramInfo.token ? ['token', this.deepgramInfo.token] : undefined;
            this.ws = new WebSocket(this.deepgramInfo.url, protocols);

            this.ws.onopen = () => {
                console.log('✅ [Voice] WebSocket connected');
                this.isConnected = true;
                this.isConnecting = false;
                this._updateStatus('ready', 'Ready - click to start');
            };

            this.ws.onmessage = (event) => {
                try {
                    const parsed = JSON.parse(event.data);
                    this._handleMessage(parsed);
                } catch (err) {
                    console.warn('⚠️ [Voice] Non-JSON message from Deepgram', err);
                }
            };

            this.ws.onerror = (error) => {
                console.error('❌ [Voice] WebSocket error:', error);
                this._updateStatus('error', 'Connection error');
                this.isConnecting = false;
            };

            this.ws.onclose = () => {
                console.log('🔌 [Voice] WebSocket closed');
                this.isConnected = false;
                this.isMuted = true;
                this.isStreaming = false;
                this._updateStatus('disconnected', 'Disconnected');
            };

        } catch (error) {
            console.error('❌ [Voice] Pre-connect failed:', error);
            this.isConnecting = false;
            
            if (error.name === 'NotAllowedError') {
                this._updateStatus('error', 'Microphone access denied');
            } else {
                this._updateStatus('error', 'Failed to connect');
            }
        }
    }

    /**
     * Setup AudioContext + ScriptProcessor for 16k PCM streaming
     */
    _setupAudioPipeline() {
        if (!this.audioStream) return;

        // Create audio context targeting 16k; browser may choose nearest rate
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
            sampleRate: 16000
        });
        console.log('🎤 [Voice] AudioContext sample rate:', this.audioContext.sampleRate);

        this.audioSource = this.audioContext.createMediaStreamSource(this.audioStream);

        // Optional analyser hook for future visualization
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 2048;
        this.audioSource.connect(this.analyser);

        // ScriptProcessor to grab PCM frames
        const bufferSize = 4096;
        this.scriptProcessor = this.audioContext.createScriptProcessor(bufferSize, 1, 1);
        this.scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
            if (!this.isStreaming || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
                return;
            }

            const inputBuffer = audioProcessingEvent.inputBuffer;
            const inputData = inputBuffer.getChannelData(0);
            const pcm16 = this._downsampleTo16k(inputData, inputBuffer.sampleRate);

            if (pcm16 && pcm16.length > 0) {
                // Send raw PCM bytes directly to Deepgram
                this.ws.send(pcm16.buffer);
            }
        };

        // Connect nodes
        this.audioSource.connect(this.scriptProcessor);
        this.scriptProcessor.connect(this.audioContext.destination);

        this.isMuted = true;
        console.log('✅ [Voice] Audio pipeline ready (muted)');
    }

    /**
     * Activate voice (unmute) - INSTANT!
     */
    activate() {
        if (!this.isConnected) {
            // Not pre-connected, do full connect
            console.log('⚠️ [Voice] Not connected, doing full connect...');
            this.connect();
            return;
        }

        if (this.audioContext?.state === 'suspended') {
            this.audioContext.resume();
        }

        this.isStreaming = true;
        this.isMuted = false;
        this._updateStatus('listening', '🎤 Listening...');
        console.log('✅ [Voice] Activated (unmuted)');
        console.log('📊 [Voice] State:', {
            wsState: this.ws?.readyState,
            audioCtx: this.audioContext?.state,
            isMuted: this.isMuted
        });
    }

    /**
     * Deactivate voice (mute) - INSTANT!
     */
    deactivate() {
        this.isMuted = true;
        this.isStreaming = false;
        this._updateStatus('muted', '🔇 Muted');
        console.log('✅ [Voice] Deactivated (muted)');
        console.log('📊 [Voice] State:', {
            wsState: this.ws?.readyState,
            audioCtx: this.audioContext?.state,
            isMuted: this.isMuted
        });
    }

    /**
     * Toggle voice on/off
     */
    toggle() {
        if (this.isMuted) {
            this.activate();
        } else {
            this.deactivate();
        }
        return !this.isMuted;
    }

    /**
     * Full connect (if not pre-connected)
     */
    async connect() {
        if (!this.isConnected) {
            await this.preConnect();
        }
        
        // Wait for connection
        let attempts = 0;
        while (!this.isConnected && attempts < 50) {
            await new Promise(r => setTimeout(r, 100));
            attempts++;
        }

        if (this.isConnected) {
            this.activate();
        }
    }

    /**
     * Disconnect completely
     */
    disconnect() {
        this.isMuted = true;
        this.isStreaming = false;

        if (this.audioStream) {
            this.audioStream.getTracks().forEach(track => track.stop());
            this.audioStream = null;
        }

        if (this.scriptProcessor) {
            this.scriptProcessor.disconnect();
            this.scriptProcessor = null;
        }

        if (this.audioSource) {
            this.audioSource.disconnect();
            this.audioSource = null;
        }

        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }

        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }

        this.isConnected = false;
        this._updateStatus('disconnected', 'Disconnected');
        console.log('✅ [Voice] Disconnected');
    }

    /**
     * Handle incoming messages from Deepgram
     */
    _handleMessage(data) {
        // Transcript event
        if (data.channel?.alternatives?.length) {
            const transcript = data.channel.alternatives[0].transcript || '';
            const isFinal = data.is_final;
            const speechFinal = data.speech_final;

            if (transcript && this.onTranscript) {
                this.onTranscript(transcript, isFinal, speechFinal);
            }
            return;
        }

        if (data.type === 'error') {
            console.error('❌ [Voice] Error:', data.message);
            if (this.onError) {
                this.onError(data.message);
            }
            return;
        }

        console.log('📨 [Voice] Message:', data);
    }

    /**
     * Update status and notify callback
     */
    _updateStatus(status, message) {
        console.log(`🎙️ [Voice] Status: ${status} - ${message}`);
        if (this.onStatusChange) {
            this.onStatusChange(status, message);
        }
    }

    /**
     * Check if ready for instant activation
     */
    isReady() {
        return this.isConnected && this.audioContext !== null;
    }

    /**
     * Check if currently muted
     */
    isMicMuted() {
        return this.isMuted;
    }

    async _fetchDeepgramInfo() {
        try {
            const res = await fetch('/api/voice/token');
            if (!res.ok) {
                throw new Error('Token request failed');
            }
            const data = await res.json();
            if (!data.success) {
                throw new Error(data.error || 'Token request failed');
            }
            return data;
        } catch (err) {
            console.error('❌ [Voice] Failed to fetch Deepgram token:', err);
            this._updateStatus('error', 'Failed to fetch voice token');
            return null;
        }
    }

    /**
     * Downsample to 16k and convert to Int16Array
     */
    _downsampleTo16k(float32Audio, inputSampleRate) {
        const targetRate = 16000;
        if (inputSampleRate === targetRate) {
            return this._floatTo16BitPCM(float32Audio);
        }

        const sampleRateRatio = inputSampleRate / targetRate;
        const newLength = Math.round(float32Audio.length / sampleRateRatio);
        const downsampled = new Float32Array(newLength);

        for (let i = 0, j = 0; i < newLength; i++, j += sampleRateRatio) {
            downsampled[i] = float32Audio[Math.floor(j)] || 0;
        }

        return this._floatTo16BitPCM(downsampled);
    }

    _floatTo16BitPCM(float32Audio) {
        const output = new Int16Array(float32Audio.length);
        for (let i = 0; i < float32Audio.length; i++) {
            const s = Math.max(-1, Math.min(1, float32Audio[i]));
            output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        return output;
    }

}

// Export for use in other scripts
window.VoiceClient = VoiceClient;

