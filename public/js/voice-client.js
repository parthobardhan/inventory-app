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

            // Prepare audio context + processor for 16k PCM
            this._setupAudioPipeline();

            // Connect WebSocket
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}/api/voice/stream`;
            
            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = () => {
                console.log('✅ [Voice] WebSocket connected');
                this.isConnected = true;
                this.isConnecting = false;
                this._updateStatus('ready', 'Ready - click to start');
            };

            this.ws.onmessage = (event) => {
                this._handleMessage(JSON.parse(event.data));
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
                const base64Audio = this._bufferToBase64(pcm16.buffer);
                this.ws.send(JSON.stringify({ type: 'audio', audio: base64Audio }));
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

        // Start streaming
        if (this.ws?.readyState === WebSocket.OPEN && !this.isStreaming) {
            this.ws.send(JSON.stringify({ type: 'start' }));
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
        if (this.isStreaming && this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: 'stop' }));
        }
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
     * Handle incoming messages from server
     */
    _handleMessage(data) {
        switch (data.type) {
            case 'transcript':
                console.log(`📝 [Voice] ${data.is_final ? 'FINAL' : 'INTERIM'}: ${data.text}`);
                if (this.onTranscript) {
                    this.onTranscript(data.text, data.is_final, data.speech_final);
                }
                break;

            case 'response':
                console.log('🤖 [Voice] Response:', data.text);
                if (this.onResponse) {
                    this.onResponse(data.text, data.toolsUsed);
                }
                break;

            case 'status':
                this._updateStatus(data.status, data.message);
                break;

            case 'error':
                console.error('❌ [Voice] Error:', data.message);
                if (this.onError) {
                    this.onError(data.message);
                }
                break;

            default:
                console.log('📨 [Voice] Unknown message:', data);
        }
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

    _bufferToBase64(buffer) {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
    }
}

// Export for use in other scripts
window.VoiceClient = VoiceClient;

