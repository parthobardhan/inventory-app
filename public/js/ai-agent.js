// AI Agent Chat Handler
class AIAgentChat {
    constructor() {
        this.conversationHistory = [];
        this.isProcessing = false;
        this.selectedImage = null;
        this.initializeElements();
        this.attachEventListeners();
    }

    initializeElements() {
        this.chatWidget = document.getElementById('aiChatWidget');
        this.chatMessages = document.getElementById('chatMessages');
        this.chatInput = document.getElementById('chatInput');
        this.sendBtn = document.getElementById('sendChatBtn');
        this.openChatBtn = document.getElementById('openChatBtn');
        this.closeChatBtn = document.getElementById('closeChatBtn');
        this.chatStatus = document.getElementById('chatStatus');
        this.suggestionChips = document.querySelectorAll('.ai-suggestion-chip');
        
        // Image upload elements
        this.uploadImageBtn = document.getElementById('uploadImageBtn');
        this.chatImageInput = document.getElementById('chatImageInput');
        this.chatImagePreview = document.getElementById('chatImagePreview');
        this.chatPreviewImage = document.getElementById('chatPreviewImage');
        this.removeChatImage = document.getElementById('removeChatImage');
        this.chatImageFilename = document.getElementById('chatImageFilename');
    }

    attachEventListeners() {
        // Open/close chat
        this.openChatBtn?.addEventListener('click', () => this.openChat());
        this.closeChatBtn?.addEventListener('click', () => this.closeChat());

        // Send message
        this.sendBtn?.addEventListener('click', () => this.sendMessage());
        
        // Send on Enter (but allow Shift+Enter for new lines)
        this.chatInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Auto-resize textarea
        this.chatInput?.addEventListener('input', () => {
            this.chatInput.style.height = 'auto';
            this.chatInput.style.height = Math.min(this.chatInput.scrollHeight, 120) + 'px';
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
    }

    openChat() {
        this.chatWidget.style.display = 'flex';
        this.chatInput.focus();
        
        // Scroll to bottom
        setTimeout(() => {
            this.scrollToBottom();
        }, 100);
    }

    closeChat() {
        this.chatWidget.style.display = 'none';
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
        
        let toolResultsHtml = '';
        
        if (toolResults && toolResults.length > 0) {
            toolResults.forEach(result => {
                const isSuccess = result.success !== false;
                const statusClass = isSuccess ? 'tool-result-success' : 'tool-result-error';
                
                toolResultsHtml += `
                    <div class="tool-result ${statusClass}">
                        <div class="tool-result-header">
                            <i class="fas fa-${isSuccess ? 'check-circle' : 'exclamation-circle'}"></i>
                            ${isSuccess ? 'Action completed' : 'Action failed'}
                        </div>
                        <div class="tool-result-details">
                            ${this.formatToolResult(result)}
                        </div>
                    </div>
                `;
            });
        }
        
        messageDiv.innerHTML = `
            <div class="ai-message-avatar">
                <i class="fas fa-robot"></i>
            </div>
            <div class="ai-message-content">
                <p>${this.formatMessage(message)}</p>
                ${toolResultsHtml}
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
            return;
        }

        // Validate file size (max 10MB)
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
            this.setStatus('Image size must be less than 10MB', 'error');
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
        this.chatInput.placeholder = "Describe what you want to do with this image...";
    }

    clearImage() {
        this.selectedImage = null;
        this.chatPreviewImage.src = '';
        this.chatImagePreview.style.display = 'none';
        this.chatImageFilename.textContent = '';
        this.chatImageInput.value = '';
        this.uploadImageBtn.classList.remove('has-image');
        this.chatInput.placeholder = "Type your message... (e.g., 'Add this as a bed cover for $25')";
    }
}

// Initialize the chat when the page loads
let aiChat;

document.addEventListener('DOMContentLoaded', () => {
    aiChat = new AIAgentChat();
    console.log('AI Agent Chat initialized');
});

