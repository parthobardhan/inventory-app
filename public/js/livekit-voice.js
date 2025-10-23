/**
 * LiveKit Voice Integration
 * Handles real-time voice conversations with the inventory agent
 */

class LiveKitVoiceManager {
    constructor() {
        this.room = null;
        this.isConnected = false;
        this.isConnecting = false;
        this.roomName = null;
        this.localAudioTrack = null;
        this.remoteAudioElement = null;
        this.statusCallback = null;
        this.messageCallback = null;
    }

    /**
     * Check if LiveKit is available
     */
    isAvailable() {
        // Check for LiveKit client library under various possible export names
        const hasLiveKit = typeof LivekitClient !== 'undefined' || 
                          typeof window.LivekitClient !== 'undefined' ||
                          typeof window.LiveKit !== 'undefined';
        
        if (!hasLiveKit) {
            console.warn('⚠️ LiveKit client library not detected. Please ensure livekit-client is loaded.');
        }
        
        return hasLiveKit;
    }

    /**
     * Get LiveKit client library
     */
    getLiveKitClient() {
        return typeof LivekitClient !== 'undefined' ? LivekitClient : 
               typeof window.LivekitClient !== 'undefined' ? window.LivekitClient :
               typeof window.LiveKit !== 'undefined' ? window.LiveKit :
               null;
    }

    /**
     * Set callback for status updates
     */
    onStatusChange(callback) {
        this.statusCallback = callback;
    }

    /**
     * Set callback for messages (transcripts/responses)
     */
    onMessage(callback) {
        this.messageCallback = callback;
    }

    /**
     * Update status
     */
    updateStatus(status, message) {
        console.log(`🎙️ [LiveKit] Status: ${status} - ${message}`);
        if (this.statusCallback) {
            this.statusCallback(status, message);
        }
    }

    /**
     * Send message to UI
     */
    sendMessage(type, content) {
        if (this.messageCallback) {
            this.messageCallback(type, content);
        }
    }

    /**
     * Connect to voice session
     */
    async connect() {
        if (!this.isAvailable()) {
            throw new Error('LiveKit client is not loaded');
        }

        if (this.isConnecting || this.isConnected) {
            console.log('⚠️ [LiveKit] Already connected or connecting');
            return;
        }

        try {
            this.isConnecting = true;
            this.updateStatus('connecting', 'Connecting to voice session...');

            // Generate unique room name
            this.roomName = `voice_${Date.now()}_${Math.random().toString(36).substring(7)}`;

            // Request token from server
            const tokenResponse = await fetch('/api/livekit/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    roomName: this.roomName,
                    participantName: `user_${Date.now()}`
                })
            });

            if (!tokenResponse.ok) {
                throw new Error('Failed to get LiveKit token');
            }

            const tokenData = await tokenResponse.json();

            if (!tokenData.success) {
                throw new Error(tokenData.error || 'Failed to get token');
            }

            console.log('✅ [LiveKit] Token received, connecting to room...');

            // Create room instance
            this.room = new LivekitClient.Room({
                adaptiveStream: true,
                dynacast: true,
                videoCaptureDefaults: {
                    resolution: LivekitClient.VideoPresets.h720.resolution
                }
            });

            // Set up event handlers
            this.setupEventHandlers();

            // Connect to room
            await this.room.connect(tokenData.url, tokenData.token);

            console.log('✅ [LiveKit] Connected to room:', this.roomName);

            // Enable microphone
            await this.enableMicrophone();

            // Create audio element for remote audio
            this.createRemoteAudioElement();

            this.isConnected = true;
            this.updateStatus('connected', 'Connected! You can start speaking...');

        } catch (error) {
            console.error('❌ [LiveKit] Connection error:', error);
            this.updateStatus('error', error.message);
            this.isConnected = false;
            throw error;
        } finally {
            this.isConnecting = false;
        }
    }

    /**
     * Set up event handlers
     */
    setupEventHandlers() {
        // Track subscribed (remote participant's audio/video)
        this.room.on(LivekitClient.RoomEvent.TrackSubscribed, (track, publication, participant) => {
            console.log('🎧 [LiveKit] Track subscribed:', track.kind, 'from', participant.identity);

            if (track.kind === LivekitClient.Track.Kind.Audio) {
                this.updateStatus('agent_speaking', 'Agent is speaking...');
                
                // Attach audio track to element
                const audioElement = track.attach();
                audioElement.play();
                
                // Store reference
                if (!this.remoteAudioElement) {
                    this.remoteAudioElement = audioElement;
                }
            }
        });

        // Track unsubscribed
        this.room.on(LivekitClient.RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
            console.log('🔇 [LiveKit] Track unsubscribed:', track.kind);
            
            if (track.kind === LivekitClient.Track.Kind.Audio) {
                track.detach();
                this.updateStatus('listening', 'Listening...');
            }
        });

        // Participant connected (agent joined)
        this.room.on(LivekitClient.RoomEvent.ParticipantConnected, (participant) => {
            console.log('👤 [LiveKit] Participant connected:', participant.identity);
            
            if (participant.identity.includes('agent')) {
                this.sendMessage('system', 'Voice agent has joined the conversation');
                this.updateStatus('ready', 'Ready! Start speaking...');
            }
        });

        // Participant disconnected
        this.room.on(LivekitClient.RoomEvent.ParticipantDisconnected, (participant) => {
            console.log('👋 [LiveKit] Participant disconnected:', participant.identity);
            
            if (participant.identity.includes('agent')) {
                this.sendMessage('system', 'Voice agent has left the conversation');
            }
        });

        // Connection state changed
        this.room.on(LivekitClient.RoomEvent.ConnectionStateChanged, (state) => {
            console.log('🔌 [LiveKit] Connection state:', state);
            
            switch (state) {
                case LivekitClient.ConnectionState.Connected:
                    this.updateStatus('connected', 'Connected');
                    break;
                case LivekitClient.ConnectionState.Reconnecting:
                    this.updateStatus('reconnecting', 'Reconnecting...');
                    break;
                case LivekitClient.ConnectionState.Disconnected:
                    this.updateStatus('disconnected', 'Disconnected');
                    this.isConnected = false;
                    break;
            }
        });

        // Data received (for transcripts/messages)
        this.room.on(LivekitClient.RoomEvent.DataReceived, (payload, participant) => {
            try {
                const decoder = new TextDecoder();
                const message = JSON.parse(decoder.decode(payload));
                
                console.log('📨 [LiveKit] Data received:', message);
                
                if (message.type === 'transcript') {
                    this.sendMessage('user', message.text);
                } else if (message.type === 'response') {
                    this.sendMessage('assistant', message.text);
                }
            } catch (error) {
                console.error('❌ [LiveKit] Error parsing data:', error);
            }
        });

        // Track muted/unmuted
        this.room.on(LivekitClient.RoomEvent.TrackMuted, (publication, participant) => {
            console.log('🔇 [LiveKit] Track muted:', publication.kind);
        });

        this.room.on(LivekitClient.RoomEvent.TrackUnmuted, (publication, participant) => {
            console.log('🔊 [LiveKit] Track unmuted:', publication.kind);
        });

        // Handle disconnection
        this.room.on(LivekitClient.RoomEvent.Disconnected, () => {
            console.log('🔌 [LiveKit] Disconnected from room');
            this.cleanup();
        });
    }

    /**
     * Enable microphone
     */
    async enableMicrophone() {
        try {
            this.updateStatus('enabling_mic', 'Enabling microphone...');

            // Create local audio track
            this.localAudioTrack = await LivekitClient.createLocalAudioTrack({
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            });

            // Publish to room
            await this.room.localParticipant.publishTrack(this.localAudioTrack);

            console.log('✅ [LiveKit] Microphone enabled and published');
            this.updateStatus('listening', 'Listening...');

        } catch (error) {
            console.error('❌ [LiveKit] Failed to enable microphone:', error);
            this.updateStatus('error', 'Failed to enable microphone: ' + error.message);
            throw error;
        }
    }

    /**
     * Create audio element for remote audio playback
     */
    createRemoteAudioElement() {
        if (!this.remoteAudioElement) {
            this.remoteAudioElement = document.createElement('audio');
            this.remoteAudioElement.autoplay = true;
            this.remoteAudioElement.style.display = 'none';
            document.body.appendChild(this.remoteAudioElement);
        }
    }

    /**
     * Disconnect from voice session
     */
    async disconnect() {
        try {
            this.updateStatus('disconnecting', 'Disconnecting...');

            if (this.localAudioTrack) {
                this.localAudioTrack.stop();
                this.localAudioTrack = null;
            }

            if (this.room) {
                await this.room.disconnect();
            }

            this.cleanup();
            this.updateStatus('disconnected', 'Disconnected');

            console.log('✅ [LiveKit] Disconnected successfully');

        } catch (error) {
            console.error('❌ [LiveKit] Disconnect error:', error);
            this.cleanup();
        }
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        if (this.remoteAudioElement) {
            this.remoteAudioElement.remove();
            this.remoteAudioElement = null;
        }

        if (this.localAudioTrack) {
            this.localAudioTrack.stop();
            this.localAudioTrack = null;
        }

        this.room = null;
        this.isConnected = false;
        this.isConnecting = false;
        this.roomName = null;
    }

    /**
     * Toggle microphone mute
     */
    async toggleMute() {
        if (!this.localAudioTrack) {
            return false;
        }

        const isMuted = this.localAudioTrack.isMuted;
        
        if (isMuted) {
            await this.localAudioTrack.unmute();
            this.updateStatus('listening', 'Listening...');
        } else {
            await this.localAudioTrack.mute();
            this.updateStatus('muted', 'Microphone muted');
        }

        return !isMuted;
    }

    /**
     * Get current connection status
     */
    getStatus() {
        if (!this.room) {
            return 'disconnected';
        }

        switch (this.room.state) {
            case LivekitClient.ConnectionState.Connected:
                return 'connected';
            case LivekitClient.ConnectionState.Reconnecting:
                return 'reconnecting';
            case LivekitClient.ConnectionState.Disconnected:
                return 'disconnected';
            default:
                return 'unknown';
        }
    }

    /**
     * Check if microphone is muted
     */
    isMuted() {
        return this.localAudioTrack ? this.localAudioTrack.isMuted : false;
    }
}

// Export for use in other scripts
window.LiveKitVoiceManager = LiveKitVoiceManager;

