// PWA Service Worker Registration and Management
// Extracted from inline script to comply with Content Security Policy

// Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then((registration) => {
                console.log('SW registered: ', registration);
                
                // Check for updates
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            showUpdateAvailable();
                        }
                    });
                });
            })
            .catch((registrationError) => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}

// PWA Install Prompt
let deferredPrompt;
const installBtn = document.getElementById('installBtn');

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installBtn.style.display = 'block';
});

installBtn.addEventListener('click', async () => {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User response to the install prompt: ${outcome}`);
        deferredPrompt = null;
        installBtn.style.display = 'none';
    }
});

// Connection Status Monitoring
function updateConnectionStatus() {
    const indicator = document.getElementById('connectionIndicator');
    if (navigator.onLine) {
        indicator.innerHTML = '<i class="fas fa-wifi text-success" title="Online"></i>';
    } else {
        indicator.innerHTML = '<i class="fas fa-wifi-slash text-warning" title="Offline"></i>';
    }
}

window.addEventListener('online', updateConnectionStatus);
window.addEventListener('offline', updateConnectionStatus);

// Show update available notification
function showUpdateAvailable() {
    const updateBanner = document.createElement('div');
    updateBanner.className = 'alert alert-info alert-dismissible fade show position-fixed';
    updateBanner.style.cssText = 'top: 80px; right: 20px; z-index: 1050; max-width: 350px;';
    updateBanner.innerHTML = `
        <i class="fas fa-sync-alt me-2"></i>
        <strong>Update Available!</strong> A new version of the app is ready.
        <button type="button" class="btn btn-sm btn-primary ms-2" onclick="updateApp()">Update</button>
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.body.appendChild(updateBanner);
}

// Update app function
function updateApp() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistration().then((registration) => {
            if (registration && registration.waiting) {
                registration.waiting.postMessage({ type: 'SKIP_WAITING' });
                window.location.reload();
            }
        });
    }
}

// Handle action parameter for shortcuts
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('action') === 'add') {
    // Focus on the product name field when opened via shortcut
    setTimeout(() => {
        const productNameField = document.getElementById('productName');
        if (productNameField) {
            productNameField.focus();
        }
    }, 500);
}
