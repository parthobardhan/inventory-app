// Hero Chat Handler - Connects hero chat with main AI agent chat
(function() {
    'use strict';

    // Wait for DOM and AI Agent to be ready
    window.addEventListener('DOMContentLoaded', function() {
        initializeHeroChat();
    });

    function initializeHeroChat() {
        const heroSendBtn = document.getElementById('heroSendChatBtn');
        const heroChatInput = document.getElementById('heroChatInput');
        const heroUploadBtn = document.getElementById('heroUploadImageBtn');
        const heroVoiceBtn = document.getElementById('heroVoiceInputBtn');
        const heroChatMessages = document.getElementById('heroChatMessages');

        if (!heroSendBtn || !heroChatInput) return;

        // Send message from hero chat
        async function sendHeroMessage() {
            const message = heroChatInput.value.trim();
            if (!message) return;

            // Add user message to hero chat
            addHeroMessage(message, 'user');
            heroChatInput.value = '';
            heroChatInput.style.height = 'auto';

            // Show typing indicator
            showHeroTyping();

            // Check if AI agent chat exists and use it
            if (window.aiAgent) {
                try {
                    // Process message through AI agent
                    const result = await window.aiAgent.processMessage(message);
                    
                    hideHeroTyping();
                    
                    if (result && result.success) {
                        // Add AI response to hero chat
                        addHeroMessage(result.response, 'ai');
                    } else {
                        addHeroMessage('Sorry, I encountered an error processing your message. Please try again.', 'ai');
                    }
                } catch (error) {
                    console.error('Hero chat error:', error);
                    hideHeroTyping();
                    addHeroMessage('Sorry, something went wrong. Please try again or use the full chat widget.', 'ai');
                }
            } else {
                // Fallback: Show generic response
                setTimeout(() => {
                    hideHeroTyping();
                    addHeroMessage('The AI assistant is still loading. Please wait a moment and try again, or click the chat icon below to open the full assistant.', 'ai');
                }, 1000);
            }
        }

        // Add message to hero chat display
        function addHeroMessage(content, type = 'ai') {
            if (!heroChatMessages) return;

            const messageDiv = document.createElement('div');
            messageDiv.className = type === 'user' ? 'user-message' : 'ai-message';
            
            if (type === 'user') {
                messageDiv.innerHTML = `
                    <div class="user-message-avatar">
                        <i class="fas fa-user"></i>
                    </div>
                    <div class="user-message-content">
                        <p>${escapeHtml(content)}</p>
                    </div>
                `;
            } else {
                messageDiv.innerHTML = `
                    <div class="ai-message-avatar">
                        <i class="fas fa-robot"></i>
                    </div>
                    <div class="ai-message-content">
                        ${content}
                    </div>
                `;
            }

            heroChatMessages.appendChild(messageDiv);
            heroChatMessages.scrollTop = heroChatMessages.scrollHeight;
        }

        // Show typing indicator
        function showHeroTyping() {
            if (!heroChatMessages) return;

            const typingDiv = document.createElement('div');
            typingDiv.className = 'ai-message typing-indicator';
            typingDiv.id = 'heroTypingIndicator';
            typingDiv.innerHTML = `
                <div class="ai-message-avatar">
                    <i class="fas fa-robot"></i>
                </div>
                <div class="ai-message-content">
                    <div class="loading-dots">
                        <span></span>
                        <span></span>
                        <span></span>
                    </div>
                </div>
            `;
            heroChatMessages.appendChild(typingDiv);
            heroChatMessages.scrollTop = heroChatMessages.scrollHeight;
        }

        // Hide typing indicator
        function hideHeroTyping() {
            const typingIndicator = document.getElementById('heroTypingIndicator');
            if (typingIndicator) {
                typingIndicator.remove();
            }
        }

        // Escape HTML to prevent XSS
        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        // Event Listeners
        heroSendBtn.addEventListener('click', sendHeroMessage);

        heroChatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendHeroMessage();
            }
        });

        // Auto-resize textarea
        heroChatInput.addEventListener('input', () => {
            heroChatInput.style.height = 'auto';
            const newHeight = Math.min(heroChatInput.scrollHeight, 120);
            heroChatInput.style.height = newHeight + 'px';
        });

        // Upload button - open main AI chat widget for image functionality
        if (heroUploadBtn) {
            heroUploadBtn.addEventListener('click', () => {
                if (window.aiAgent) {
                    window.aiAgent.openChat();
                    // Focus on upload button in main chat
                    setTimeout(() => {
                        document.getElementById('uploadImageBtn')?.click();
                    }, 300);
                } else {
                    addHeroMessage('Image upload is available in the full AI assistant. Please wait for it to load.', 'ai');
                }
            });
        }

        // Voice button - open main AI chat widget for voice functionality
        if (heroVoiceBtn) {
            heroVoiceBtn.addEventListener('click', () => {
                if (window.aiAgent) {
                    window.aiAgent.openChat();
                    // Focus on voice button in main chat
                    setTimeout(() => {
                        document.getElementById('voiceInputBtn')?.click();
                    }, 300);
                } else {
                    addHeroMessage('Voice input is available in the full AI assistant. Please wait for it to load.', 'ai');
                }
            });
        }
    }
})();

