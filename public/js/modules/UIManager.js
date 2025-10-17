// UI Manager - Handles all user interface operations and DOM manipulation
class UIManager {
    constructor() {
        this.alertContainer = null;
        this.setupAlertContainer();
    }

    setupAlertContainer() {
        // Create alert container if it doesn't exist
        this.alertContainer = document.getElementById('alertContainer') || 
            document.createElement('div');
        this.alertContainer.id = 'alertContainer';
        this.alertContainer.className = 'alert-container';
        
        if (!document.getElementById('alertContainer')) {
            document.body.appendChild(this.alertContainer);
        }
    }

    renderProducts(products) {
        const container = document.getElementById('productList');
        if (!container) return;

        if (products.length === 0) {
            container.innerHTML = `
                <div class="col-12">
                    <div class="alert alert-info">
                        <i class="fas fa-info-circle"></i>
                        No products found. Add your first product to get started!
                    </div>
                </div>`;
            return;
        }

        container.innerHTML = products.map(product => this.createProductCard(product)).join('');
    }

    createProductCard(product) {
        const primaryImageUrl = this.getPrimaryImageUrl(product);
        const imageHtml = primaryImageUrl ? 
            `<img src="${primaryImageUrl}" class="card-img-top" alt="${this.escapeHtml(product.name)}" style="height: 200px; object-fit: cover;">` : 
            `<div class="card-img-placeholder" style="height: 200px; background: #f8f9fa; display: flex; align-items: center; justify-content: center;">
                <i class="fas fa-image text-muted fa-3x"></i>
            </div>`;

        return `
            <div class="col-md-4 col-lg-3 mb-4">
                <div class="card h-100 product-card" data-product-id="${product._id}">
                    ${imageHtml}
                    <div class="card-body d-flex flex-column">
                        <h5 class="card-title">${this.escapeHtml(product.name)}</h5>
                        <p class="card-text text-muted mb-2">${this.formatProductType(product.type)}</p>
                        <p class="card-text flex-grow-1">${this.escapeHtml(product.description || 'No description available')}</p>
                        <div class="product-details mt-auto">
                            <div class="d-flex justify-content-between align-items-center mb-2">
                                <span class="badge ${product.quantity > 10 ? 'bg-success' : product.quantity > 5 ? 'bg-warning' : 'bg-danger'}">
                                    ${product.quantity} in stock
                                </span>
                                <strong class="text-primary">₹${product.price}</strong>
                            </div>
                            <div class="btn-group w-100" role="group">
                                <button class="btn btn-outline-primary btn-sm edit-btn" data-id="${product._id}">
                                    <i class="fas fa-edit"></i> Edit
                                </button>
                                <button class="btn btn-outline-danger btn-sm delete-btn" data-id="${product._id}">
                                    <i class="fas fa-trash"></i> Delete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;
    }

    getPrimaryImageUrl(product) {
        if (!product.images || product.images.length === 0) {
            return null;
        }
        
        const primaryImage = product.images.find(img => img.id === product.primaryImageId);
        return primaryImage ? primaryImage.url : product.images[0].url;
    }

    updateSummary(products) {
        const totalProducts = products.length;
        const totalValue = products.reduce((sum, p) => sum + (p.price * p.quantity), 0);
        const lowStock = products.filter(p => p.quantity <= 5).length;

        // Update summary cards
        const totalProductsElement = document.getElementById('totalProducts');
        const totalValueElement = document.getElementById('totalValue');
        const lowStockElement = document.getElementById('lowStock');

        if (totalProductsElement) totalProductsElement.textContent = totalProducts;
        if (totalValueElement) totalValueElement.textContent = `₹${totalValue.toLocaleString()}`;
        if (lowStockElement) lowStockElement.textContent = lowStock;

        // Update type breakdown
        const typeBreakdown = {};
        products.forEach(product => {
            if (!typeBreakdown[product.type]) {
                typeBreakdown[product.type] = { count: 0, value: 0 };
            }
            typeBreakdown[product.type].count += 1;
            typeBreakdown[product.type].value += product.price * product.quantity;
        });

        const typeBreakdownElement = document.getElementById('typeBreakdown');
        if (typeBreakdownElement) {
            typeBreakdownElement.innerHTML = Object.entries(typeBreakdown)
                .map(([type, data]) => `
                    <div class="d-flex justify-content-between">
                        <span>${this.formatProductType(type)}</span>
                        <span>${data.count} items (₹${data.value.toLocaleString()})</span>
                    </div>
                `).join('');
        }
    }

    updateProfitDisplay(profitData) {
        console.log('💰 Updating profit display with data:', profitData);
        
        const currentMonthElement = document.getElementById('currentMonthProfit');
        const lastMonthElement = document.getElementById('lastMonthProfit');

        if (currentMonthElement) {
            currentMonthElement.textContent = `$${profitData.currentMonth.toFixed(2)}`;
            console.log('✅ Updated currentMonthProfit');
        } else {
            console.warn('⚠️ currentMonthProfit element not found');
        }
        
        if (lastMonthElement) {
            lastMonthElement.textContent = `$${profitData.lastMonth.toFixed(2)}`;
            console.log('✅ Updated lastMonthProfit');
        } else {
            console.warn('⚠️ lastMonthProfit element not found');
        }
    }

    formatProductType(type) {
        return type.split('-').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
    }

    showAlert(message, type = 'info') {
        const existingAlert = this.alertContainer.querySelector('.alert');
        if (existingAlert) {
            existingAlert.remove();
        }

        const alert = document.createElement('div');
        alert.className = `alert alert-${type} alert-dismissible fade show`;
        alert.innerHTML = `
            ${this.escapeHtml(message)}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;

        this.alertContainer.appendChild(alert);

        // Auto-hide after 5 seconds
        setTimeout(() => {
            if (alert.parentNode) {
                alert.remove();
            }
        }, 5000);
    }

    escapeHtml(text) {
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
        return text ? text.replace(/[&<>"']/g, m => map[m]) : '';
    }

    clearForm() {
        const form = document.getElementById('productForm');
        if (form) {
            form.reset();
        }
        this.hideAIPreview();
    }

    clearModalForm() {
        const form = document.getElementById('modalProductForm');
        if (form) {
            form.reset();
            // Clear validation states
            form.querySelectorAll('.is-invalid').forEach(field => {
                field.classList.remove('is-invalid');
            });
            form.querySelectorAll('.invalid-feedback').forEach(feedback => {
                feedback.style.display = 'none';
            });
        }
    }

    displayAIContent(aiData) {
        document.getElementById('aiTitle').value = aiData.title || '';
        document.getElementById('aiDescription').value = aiData.description || '';
        document.getElementById('aiConfidence').textContent = Math.round((aiData.confidence || 0) * 100);
        document.getElementById('aiModel').textContent = aiData.model || 'Unknown';
        
        document.getElementById('aiPreview').style.display = 'block';
    }

    hideAIPreview() {
        const aiPreview = document.getElementById('aiPreview');
        if (aiPreview) {
            aiPreview.style.display = 'none';
            document.getElementById('aiTitle').value = '';
            document.getElementById('aiDescription').value = '';
        }
    }

    showModalLoading(show) {
        const submitButton = document.querySelector('#addProductModal .btn-primary');
        if (submitButton) {
            if (show) {
                submitButton.disabled = true;
                submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding Product...';
            } else {
                submitButton.disabled = false;
                submitButton.innerHTML = '<i class="fas fa-plus"></i> Add Product';
            }
        }
    }

    hideModal() {
        const modal = document.getElementById('addProductModal');
        if (modal) {
            const bsModal = bootstrap.Modal.getInstance(modal);
            if (bsModal) {
                bsModal.hide();
            } else {
                const modalElement = new bootstrap.Modal(modal);
                modalElement.hide();
            }
        }
    }
}
