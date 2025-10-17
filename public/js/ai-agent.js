// AI Agent Chat Handler
class AIAgentChat {
    constructor() {
        this.conversationHistory = [];
        this.isProcessing = false;
        this.selectedImage = null;
        this.initializeElements();
        this.attachEventListeners();
        
        // Voice recording state
        this.isRecording = false;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.audioContext = null;
        this.analyser = null;
        this.silenceStart = null;
        this.SILENCE_THRESHOLD = 0.01;
        this.SILENCE_DURATION = 1500; // 1.5 seconds
        this.MAX_RECORDING_TIME = 30000; // 30 seconds
    }

    initializeElements() {
        this.chatWidget = document.getElementById('heroChatWidget');
        this.chatMessages = document.getElementById('heroChatMessages');
        this.chatInput = document.getElementById('heroChatInput');
        this.sendBtn = document.getElementById('heroSendChatBtn');
        this.chatStatus = document.getElementById('heroChatStatus');
        this.suggestionChips = document.querySelectorAll('.ai-suggestion-chip');
        
        // Image upload elements
        this.uploadImageBtn = document.getElementById('heroUploadImageBtn');
        this.chatImageInput = document.getElementById('heroChatImageInput');
        this.chatImagePreview = document.getElementById('heroChatImagePreview');
        this.chatPreviewImage = document.getElementById('heroChatPreviewImage');
        this.removeChatImage = document.getElementById('heroRemoveChatImage');
        this.chatImageFilename = document.getElementById('heroChatImageFilename');
        
        // Voice input elements
        this.voiceInputBtn = document.getElementById('heroVoiceInputBtn');
        
        // Drag and drop elements
        this.dropZone = document.getElementById('heroDropZone');
        this.inputContainer = document.querySelector('.hero-chat-input-container');
        
        // Help icon
        this.helpIcon = document.getElementById('aiHelpIcon');
    }

    attachEventListeners() {
        // Send message
        this.sendBtn?.addEventListener('click', () => this.sendMessage());
        
        // Send on Enter (but allow Shift+Enter for new lines)
        this.chatInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Auto-resize textarea with better sizing
        this.chatInput?.addEventListener('input', () => {
            this.chatInput.style.height = 'auto';
            const newHeight = Math.min(this.chatInput.scrollHeight, 160);
            this.chatInput.style.height = newHeight + 'px';
        });

        // Suggestion chips
        this.suggestionChips.forEach(chip => {
            chip.addEventListener('click', () => {
                const message = chip.getAttribute('data-message');
                this.chatInput.value = message;
                this.sendMessage();
            });
        });

        // Image upload
        this.uploadImageBtn?.addEventListener('click', () => {
            this.chatImageInput.click();
        });

        this.chatImageInput?.addEventListener('change', (e) => {
            this.handleImageSelect(e);
        });

        this.removeChatImage?.addEventListener('click', () => {
            this.clearImage();
        });

        // Voice input
        this.voiceInputBtn?.addEventListener('click', () => {
            if (this.isRecording) {
                this.stopRecording();
            } else {
                this.startRecording();
            }
        });

        // Help icon
        this.helpIcon?.addEventListener('click', () => {
            const helpModal = new bootstrap.Modal(document.getElementById('aiHelpModal'));
            helpModal.show();
        });

        // Drag and drop events
        this.setupDragAndDrop();
    }

    setupDragAndDrop() {
        // Prevent default drag behaviors on the entire widget
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            this.chatWidget?.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            }, false);
        });

        // Show drop zone on drag enter
        ['dragenter', 'dragover'].forEach(eventName => {
            this.chatWidget?.addEventListener(eventName, (e) => {
                if (this.isDraggedFile(e)) {
                    this.dropZone?.classList.add('active');
                }
            }, false);
        });

        // Hide drop zone on drag leave
        this.chatWidget?.addEventListener('dragleave', (e) => {
            // Only hide if leaving the widget entirely
            if (e.target === this.chatWidget) {
                this.dropZone?.classList.remove('active');
            }
        }, false);

        // Handle drop
        this.chatWidget?.addEventListener('drop', (e) => {
            this.dropZone?.classList.remove('active');
            
            const files = e.dataTransfer?.files;
            if (files && files.length > 0) {
                const file = files[0];
                
                // Check if it's an image
                if (file.type.startsWith('image/')) {
                    this.handleImageFile(file);
                } else {
                    this.setStatus('Please drop an image file', 'error');
                    setTimeout(() => this.setStatus(''), 2000);
                }
            }
        }, false);
    }

    isDraggedFile(e) {
        // Check if the dragged item contains files
        if (e.dataTransfer?.types) {
            return e.dataTransfer.types.includes('Files');
        }
        return false;
    }

    handleImageFile(file) {
        // Validate file size (max 10MB)
        const maxSize = 10 * 1024 * 1024;
        if (file.size > maxSize) {
            this.setStatus('Image size must be less than 10MB', 'error');
            setTimeout(() => this.setStatus(''), 3000);
            return;
        }

        // Store the file
        this.selectedImage = file;

        // Show preview
        const reader = new FileReader();
        reader.onload = (e) => {
            this.chatPreviewImage.src = e.target.result;
            this.chatImagePreview.style.display = 'block';
            this.chatImageFilename.textContent = file.name;
            this.uploadImageBtn.classList.add('has-image');
        };
        reader.readAsDataURL(file);

        // Update placeholder text
        this.chatInput.placeholder = "Describe what you want to do with this image";
        this.chatInput.focus();
    }

    async sendMessage() {
        let message = this.chatInput.value.trim();
        
        if ((!message && !this.selectedImage) || this.isProcessing) {
            return;
        }

        // Save image reference
        const imageToSend = this.selectedImage;
        const hasImage = !!imageToSend;

        // If there's an image but no message, provide a default
        if (hasImage && !message) {
            message = 'Please analyze this image and help me add it as a product.';
        }

        // Clear input and reset height
        this.chatInput.value = '';
        this.chatInput.style.height = 'auto';

        // Add user message to UI (with image if present)
        this.addUserMessage(message, hasImage ? this.chatPreviewImage.src : null);

        // Clear image after adding to UI
        if (hasImage) {
            this.clearImage();
        }

        // Show typing indicator
        this.setStatus('AI is thinking...', 'typing');
        this.isProcessing = true;
        this.sendBtn.disabled = true;

        try {
            let response, data;

            if (hasImage) {
                // Send with image as multipart/form-data
                const formData = new FormData();
                formData.append('message', message);
                formData.append('conversationHistory', JSON.stringify(this.conversationHistory));
                formData.append('image', imageToSend);

                console.log('📤 Sending chat with image:', {
                    messageLength: message.length,
                    imageSize: imageToSend.size,
                    imageName: imageToSend.name
                });

                response = await fetch('/api/agent/chat', {
                    method: 'POST',
                    body: formData,
                });
            } else {
                // Send as JSON (original behavior)
                response = await fetch('/api/agent/chat', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        message: message,
                        conversationHistory: this.conversationHistory,
                    }),
                });
            }

            // Log response status
            console.log('📥 Response status:', response.status);

            if (!response.ok) {
                const errorData = await response.json();
                console.error('❌ Server error:', errorData);
                throw new Error(errorData.error || errorData.message || 'Server error');
            }

            data = await response.json();

            if (data.success) {
                // Add AI response to UI
                this.addAIMessage(data.message, data.toolResults);
                
                // Update conversation history
                this.conversationHistory.push(
                    { role: 'user', content: message },
                    { role: 'assistant', content: data.message }
                );

                // Keep conversation history manageable (last 10 messages)
                if (this.conversationHistory.length > 20) {
                    this.conversationHistory = this.conversationHistory.slice(-20);
                }
            } else {
                this.addAIMessage(
                    data.message || 'Sorry, I encountered an error. Please try again.',
                    null,
                    true
                );
            }

            this.setStatus('');
        } catch (error) {
            console.error('Chat error:', error);
            
            // Show specific error message
            let errorMessage = 'Sorry, I couldn\'t process your request. ';
            if (error.message) {
                errorMessage += error.message;
            } else {
                errorMessage += 'Please check your connection and try again.';
            }
            
            this.addAIMessage(errorMessage, null, true);
            this.setStatus('Error: ' + (error.message || 'Unknown error'), 'error');
        } finally {
            this.isProcessing = false;
            this.sendBtn.disabled = false;
            this.chatInput.focus();
        }
    }

    addUserMessage(message, imageUrl = null) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'user-message';
        
        let imageHtml = '';
        if (imageUrl) {
            imageHtml = `<img src="${imageUrl}" class="user-message-image" alt="Uploaded image" />`;
        }
        
        messageDiv.innerHTML = `
            <div class="user-message-avatar">
                <i class="fas fa-user"></i>
            </div>
            <div class="user-message-content">
                ${imageHtml}
                ${message ? `<p>${this.escapeHtml(message)}</p>` : ''}
            </div>
        `;
        this.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();
    }

    addAIMessage(message, toolResults = null, isError = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'ai-message';
        
        // Tool results are handled by the backend and included in the message text
        // No need to display them separately in the UI
        
        messageDiv.innerHTML = `
            <div class="ai-message-avatar">
                <i class="fas fa-robot"></i>
            </div>
            <div class="ai-message-content">
                <p>${this.formatMessage(message)}</p>
            </div>
        `;
        
        this.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();
    }

    formatToolResult(result) {
        if (result.action === 'navigate') {
            return `
                <a href="${result.url}" class="btn btn-sm btn-primary mt-2" target="_blank">
                    <i class="fas fa-external-link-alt me-1"></i>
                    Open ${result.url}
                </a>
            `;
        }

        if (result.product) {
            return `
                <strong>Product:</strong> ${result.product.name}<br>
                <strong>Quantity:</strong> ${result.product.quantity || result.product.newQuantity || 'N/A'}<br>
                <strong>Price:</strong> $${result.product.price || 'N/A'}
            `;
        }

        if (result.sale) {
            return `
                <strong>Product:</strong> ${result.sale.productName}<br>
                <strong>Quantity Sold:</strong> ${result.sale.quantity}<br>
                <strong>Revenue:</strong> $${result.sale.revenue}<br>
                <strong>Profit:</strong> $${result.sale.profit}<br>
                <strong>Remaining Stock:</strong> ${result.sale.remainingStock}
            `;
        }

        if (result.analytics) {
            const a = result.analytics;
            return `
                <strong>Revenue:</strong> $${a.revenue}<br>
                <strong>Profit:</strong> $${a.profit}<br>
                <strong>Sales Count:</strong> ${a.salesCount}<br>
                <strong>Quantity Sold:</strong> ${a.quantitySold}<br>
                ${a.topProducts && a.topProducts.length > 0 ? `
                    <strong>Top Products:</strong>
                    <ul style="margin-top: 8px; padding-left: 20px;">
                        ${a.topProducts.map(p => `<li>${p.name} - $${p.revenue.toFixed(2)} (${p.quantity} sold)</li>`).join('')}
                    </ul>
                ` : ''}
            `;
        }

        if (result.products && result.products.length > 0) {
            return `
                <strong>Found ${result.count} products:</strong>
                <ul style="margin-top: 8px; padding-left: 20px;">
                    ${result.products.slice(0, 5).map(p => `
                        <li>${p.name} - ${p.quantity} in stock @ $${p.price}</li>
                    `).join('')}
                    ${result.products.length > 5 ? `<li><em>...and ${result.products.length - 5} more</em></li>` : ''}
                </ul>
            `;
        }

        if (result.suggestions && result.suggestions.length > 0) {
            return `
                <strong>Did you mean:</strong>
                <ul style="margin-top: 8px; padding-left: 20px;">
                    ${result.suggestions.map(s => `<li>${s}</li>`).join('')}
                </ul>
            `;
        }

        if (result.message) {
            return this.escapeHtml(result.message);
        }

        if (result.error) {
            return `<span style="color: #dc3545;">${this.escapeHtml(result.error)}</span>`;
        }

        return JSON.stringify(result, null, 2);
    }

    formatMessage(message) {
        // Convert markdown-style formatting
        message = this.escapeHtml(message);
        
        // Bold text
        message = message.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        
        // Italic text
        message = message.replace(/\*(.+?)\*/g, '<em>$1</em>');
        
        // Line breaks
        message = message.replace(/\n/g, '<br>');
        
        return message;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    setStatus(message, type = '') {
        this.chatStatus.textContent = message;
        this.chatStatus.className = 'ai-chat-status' + (type ? ` ${type}` : '');
    }

    scrollToBottom() {
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    handleImageSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            this.setStatus('Please select a valid image file', 'error');
            setTimeout(() => this.setStatus(''), 2000);
            return;
        }

        // Use the common handler
        this.handleImageFile(file);
    }

    clearImage() {
        this.selectedImage = null;
        this.chatPreviewImage.src = '';
        this.chatImagePreview.style.display = 'none';
        this.chatImageFilename.textContent = '';
        this.chatImageInput.value = '';
        this.uploadImageBtn.classList.remove('has-image');
        this.chatInput.placeholder = "Ask anything";
    }

    // Voice Recording Methods
    async startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(stream);
            this.audioChunks = [];

            // Set up audio analysis for silence detection
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            const source = this.audioContext.createMediaStreamSource(stream);
            source.connect(this.analyser);
            this.analyser.fftSize = 2048;

            this.mediaRecorder.ondataavailable = (event) => {
                this.audioChunks.push(event.data);
            };

            this.mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
                await this.processAudio(audioBlob);

                // Stop all tracks and cleanup
                stream.getTracks().forEach(track => track.stop());
                if (this.audioContext) {
                    this.audioContext.close();
                }
            };

            this.mediaRecorder.start();
            this.isRecording = true;

            // Update UI
            this.voiceInputBtn.classList.add('recording');
            this.voiceInputBtn.title = 'Recording... (Click to stop)';
            this.setStatus('🎤 Listening... (will auto-stop when you finish)', 'recording');
            this.sendBtn.disabled = true;
            this.uploadImageBtn.disabled = true;

            // Start silence detection
            this.detectSilence();

            // Safety timeout
            setTimeout(() => {
                if (this.isRecording) {
                    console.log('Max recording time reached');
                    this.stopRecording();
                }
            }, this.MAX_RECORDING_TIME);

        } catch (error) {
            console.error('Error accessing microphone:', error);
            this.setStatus('❌ Failed to access microphone. Please grant permission.', 'error');
            this.voiceInputBtn.classList.remove('recording', 'processing');
        }
    }

    detectSilence() {
        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        const checkAudioLevel = () => {
            if (!this.isRecording) return;

            this.analyser.getByteTimeDomainData(dataArray);
            
            // Calculate RMS (Root Mean Square)
            let sum = 0;
            for (let i = 0; i < bufferLength; i++) {
                const normalized = (dataArray[i] - 128) / 128;
                sum += normalized * normalized;
            }
            const rms = Math.sqrt(sum / bufferLength);
            
            // Check if audio level is below silence threshold
            if (rms < this.SILENCE_THRESHOLD) {
                if (this.silenceStart === null) {
                    this.silenceStart = Date.now();
                } else {
                    const silenceDuration = Date.now() - this.silenceStart;
                    if (silenceDuration > this.SILENCE_DURATION) {
                        console.log('Silence detected, stopping...');
                        this.stopRecording();
                        return;
                    }
                }
            } else {
                // Audio detected, reset silence timer
                this.silenceStart = null;
            }
            
            // Continue checking
            requestAnimationFrame(checkAudioLevel);
        };
        
        checkAudioLevel();
    }

    stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
            this.silenceStart = null;

            // Update UI
            this.voiceInputBtn.classList.remove('recording');
            this.voiceInputBtn.classList.add('processing');
            this.voiceInputBtn.title = 'Processing...';
            this.setStatus('⏳ Processing audio...', 'processing');
        }
    }

    async processAudio(audioBlob) {
        try {
            // Convert blob to base64
            const reader = new FileReader();
            reader.readAsDataURL(audioBlob);

            reader.onloadend = async () => {
                const base64Audio = reader.result.split(',')[1];

                this.setStatus('🔄 Transcribing audio...', 'processing');

                // Send to transcribe API only (not full chat)
                const response = await fetch('/api/voice/transcribe', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        audioData: base64Audio,
                        mimeType: 'audio/webm'
                    })
                });

                const result = await response.json();

                if (result.success && result.transcript) {
                    // Put transcribed text in the input field
                    this.chatInput.value = result.transcript;
                    
                    // Show confidence and status
                    const confidencePercent = (result.confidence * 100).toFixed(1);
                    const confidenceEmoji = result.confidence >= 0.9 ? '✅' : result.confidence >= 0.7 ? '⚠️' : '❌';
                    
                    this.setStatus(
                        `${confidenceEmoji} Transcribed (${confidencePercent}% confidence). Review and click Send.`, 
                        'success'
                    );
                    
                    // Focus on the input so user can review/edit
                    this.chatInput.focus();
                    
                    // Clear status after 5 seconds
                    setTimeout(() => this.setStatus('', ''), 5000);
                } else {
                    this.setStatus('❌ ' + (result.error || 'No speech detected'), 'error');
                }
            };

            reader.onerror = (error) => {
                console.error('Error reading audio:', error);
                this.setStatus('❌ Failed to read audio', 'error');
            };

        } catch (error) {
            console.error('Error processing audio:', error);
            this.setStatus('❌ Error: ' + error.message, 'error');
        } finally {
            // Reset UI
            this.voiceInputBtn.classList.remove('recording', 'processing');
            this.voiceInputBtn.title = 'Voice input';
            this.sendBtn.disabled = false;
            this.uploadImageBtn.disabled = false;
        }
    }
}

// Initialize the chat when the page loads
let aiChat;

document.addEventListener('DOMContentLoaded', () => {
    aiChat = new AIAgentChat();
    console.log('AI Agent Chat initialized');
});

