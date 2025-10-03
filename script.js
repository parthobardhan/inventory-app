// Textile Inventory Management System

class InventoryManager {
    constructor() {
        this.products = [];
        this.filteredProducts = [];
        this.apiBaseUrl = '/api/products';
        this.init();
    }

    async init() {
        this.bindEvents();
        await this.loadProducts();
        this.renderProducts();
        this.updateSummary();
    }

    bindEvents() {
        // Add product form
        document.getElementById('productForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addProduct();
        });

        // Search functionality - real-time search on input
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.searchProducts();
        });

        // Search button click
        document.getElementById('searchBtn').addEventListener('click', () => {
            this.searchProducts();
        });

        // Search on Enter key
        document.getElementById('searchInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.searchProducts();
            }
        });

        // Filter by type
        document.getElementById('filterType').addEventListener('change', (e) => {
            this.searchProducts();
        });

        // Edit product modal save button
        document.getElementById('saveEditBtn').addEventListener('click', () => {
            this.saveEditedProduct();
        });

        // Add product modal button
        document.getElementById('addProductBtn').addEventListener('click', () => {
            this.addProductFromModal();
        });

        // Image upload functionality
        document.getElementById('productImage').addEventListener('change', (e) => {
            this.handleImagePreview(e);
        });

        // AI content editing buttons
        document.getElementById('editTitleBtn').addEventListener('click', () => {
            this.toggleEditMode('aiTitle', 'editTitleBtn');
        });

        document.getElementById('editDescBtn').addEventListener('click', () => {
            this.toggleEditMode('aiDescription', 'editDescBtn');
        });

        // Event delegation for edit and delete buttons (CSP-compliant)
        document.addEventListener('click', (e) => {
            // Handle edit button clicks
            if (e.target.closest('.edit-btn')) {
                e.preventDefault();
                const button = e.target.closest('.edit-btn');
                const productId = button.getAttribute('data-product-id');
                console.log('Edit button clicked for product:', productId);
                this.editProduct(productId);
            }
            // Handle delete button clicks
            else if (e.target.closest('.delete-btn')) {
                e.preventDefault();
                const button = e.target.closest('.delete-btn');
                const productId = button.getAttribute('data-product-id');
                console.log('Delete button clicked for product:', productId);
                this.deleteProduct(productId);
            }
        });
    }

    // API Methods
    async loadProducts() {
        try {
            const response = await fetch(this.apiBaseUrl);
            const result = await response.json();
            
            if (result.success) {
                this.products = result.data;
                this.filteredProducts = [...this.products];
            } else {
                this.showAlert('Error loading products: ' + result.message, 'danger');
            }
        } catch (error) {
            console.error('Error loading products:', error);
            this.showAlert('Error loading products. Please check your connection.', 'danger');
        }
    }

    async searchProducts() {
        try {
            const searchTerm = document.getElementById('searchInput').value.trim();
            const typeFilter = document.getElementById('filterType').value;
            
            let url = this.apiBaseUrl;
            const params = new URLSearchParams();
            
            if (searchTerm) {
                params.append('search', searchTerm);
            }
            if (typeFilter) {
                params.append('type', typeFilter);
            }
            
            if (params.toString()) {
                url += '?' + params.toString();
            }
            
            const response = await fetch(url);
            const result = await response.json();
            
            if (result.success) {
                this.products = result.data;
                this.filteredProducts = [...this.products];
                this.renderProducts();
                this.updateSummary();
            } else {
                this.showAlert('Error searching products: ' + result.message, 'danger');
            }
        } catch (error) {
            console.error('Error searching products:', error);
            this.showAlert('Error searching products. Please check your connection.', 'danger');
        }
    }

    async addProduct() {
        const name = document.getElementById('productName').value.trim();
        const type = document.getElementById('productType').value;
        const quantity = parseInt(document.getElementById('quantity').value);
        const price = parseFloat(document.getElementById('price').value);
        const description = document.getElementById('description').value.trim();
        const imageFile = document.getElementById('productImage').files[0];
        const generateAI = document.getElementById('generateAI').checked;

        if (!name || !type || quantity < 0 || price < 0) {
            this.showAlert('Please fill in all required fields with valid values.', 'danger');
            return;
        }

        try {
            // Create the product first - AI content will be integrated during image upload
            const response = await fetch(this.apiBaseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name,
                    type,
                    quantity,
                    price,
                    description
                })
            });

            const result = await response.json();

            if (result.success) {
                const productId = result.data._id;
                
                // Upload image if provided - AI content integration is handled on the backend
                if (imageFile) {
                    const imageResult = await this.uploadProductImage(productId, imageFile, generateAI);
                    
                    // Display AI content in preview if generated
                    if (imageResult && imageResult.aiGenerated) {
                        this.displayAIContent(imageResult.aiGenerated);
                        console.log('AI content generated and product updated on backend:', imageResult.aiGenerated);
                    }
                }
                
                await this.loadProducts();
                this.renderProducts();
                this.updateSummary();
                this.clearForm();
                this.hideAIPreview();
                this.showAlert(`Product "${finalName}" added successfully!`, 'success');
            } else {
                this.showAlert('Error adding product: ' + result.message, 'danger');
            }
        } catch (error) {
            console.error('Error adding product:', error);
            this.showAlert('Error adding product. Please check your connection.', 'danger');
        }
    }

    async uploadProductImage(productId, imageFile, generateAI = true) {
        try {
            const formData = new FormData();
            formData.append('image', imageFile);
            formData.append('generateAI', generateAI.toString());

            this.showAlert('Uploading image and generating AI description...', 'info');

            const response = await fetch(`/api/images/upload/${productId}`, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (result.success) {
                if (result.data.aiGenerated) {
                    this.displayAIContent(result.data.aiGenerated);
                }
                return result.data;
            } else {
                this.showAlert('Error uploading image: ' + result.message, 'warning');
                return null;
            }
        } catch (error) {
            console.error('Error uploading image:', error);
            this.showAlert('Error uploading image. Please try again.', 'warning');
            return null;
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
        document.getElementById('aiPreview').style.display = 'none';
        document.getElementById('aiTitle').value = '';
        document.getElementById('aiDescription').value = '';
    }

    handleImagePreview(event) {
        const file = event.target.files[0];
        if (file) {
            // You can add image preview functionality here if needed
            console.log('Image selected:', file.name);
        }
    }

    toggleEditMode(fieldId, buttonId) {
        const fieldElement = document.getElementById(fieldId);
        const buttonElement = document.getElementById(buttonId);

        if (fieldElement.readOnly) {
            fieldElement.readOnly = false;
            fieldElement.focus();
            buttonElement.innerHTML = '<i class="fas fa-save"></i> Save';
        } else {
            fieldElement.readOnly = true;
            buttonElement.innerHTML = '<i class="fas fa-edit"></i> Edit';
        }
    }

    getPrimaryImageUrl(product) {
        if (!product.images || product.images.length === 0) {
            return null;
        }
        
        const primaryImage = product.images.find(img => img.id === product.primaryImageId);
        return primaryImage ? primaryImage.url : product.images[0].url;
    }

    editProduct(id) {
        const product = this.products.find(p => p._id === id);
        if (!product) return;

        // Populate edit form
        document.getElementById('editProductId').value = product._id;
        document.getElementById('editProductName').value = product.name;
        document.getElementById('editProductType').value = product.type;
        document.getElementById('editQuantity').value = product.quantity;
        document.getElementById('editPrice').value = product.price;
        document.getElementById('editDescription').value = product.description || '';

        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('editProductModal'));
        modal.show();
    }


    async saveEditedProduct() {
        const id = document.getElementById('editProductId').value;
        const name = document.getElementById('editProductName').value.trim();
        const type = document.getElementById('editProductType').value;
        const quantity = parseInt(document.getElementById('editQuantity').value);
        const price = parseFloat(document.getElementById('editPrice').value);
        const description = document.getElementById('editDescription').value.trim();

        if (!name || !type || quantity < 0 || price < 0) {
            this.showAlert('Please fill in all required fields with valid values.', 'danger');
            return;
        }

        try {
            const response = await fetch(`${this.apiBaseUrl}/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name,
                    type,
                    quantity,
                    price,
                    description
                })
            });

            const result = await response.json();

            if (result.success) {
                await this.loadProducts();
                this.renderProducts();
                this.updateSummary();

                // Hide modal
                const modal = bootstrap.Modal.getInstance(document.getElementById('editProductModal'));
                modal.hide();

                this.showAlert(`Product "${name}" updated successfully!`, 'success');
            } else {
                this.showAlert('Error updating product: ' + result.message, 'danger');
            }
        } catch (error) {
            console.error('Error updating product:', error);
            this.showAlert('Error updating product. Please check your connection.', 'danger');
        }
    }

    async addProductFromModal() {
        const name = document.getElementById('modalProductName').value.trim();
        const type = document.getElementById('modalProductType').value;
        const quantity = parseInt(document.getElementById('modalQuantity').value);
        const price = parseFloat(document.getElementById('modalPrice').value);
        const description = document.getElementById('modalDescription').value.trim();
        const imageFile = document.getElementById('modalProductImage').files[0];
        const generateAI = document.getElementById('modalGenerateAI').checked;

        if (!name || !type || quantity < 0 || price < 0) {
            this.showAlert('Please fill in all required fields with valid values.', 'danger');
            return;
        }

        const product = {
            name,
            type,
            quantity,
            price,
            description
        };

        try {
            let response;
            
            if (imageFile && generateAI) {
                // Handle image upload with AI generation
                const formData = new FormData();
                formData.append('image', imageFile);
                formData.append('productData', JSON.stringify(product));
                formData.append('generateAI', 'true');

                response = await fetch(`${this.apiBaseUrl}/upload`, {
                    method: 'POST',
                    body: formData
                });
            } else {
                // Regular product addition
                response = await fetch(this.apiBaseUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(product)
                });
            }

            const result = await response.json();

            if (result.success) {
                this.showAlert(`Product "${name}" added successfully!`, 'success');
                
                // Close modal and reset form
                const modal = bootstrap.Modal.getInstance(document.getElementById('addProductModal'));
                modal.hide();
                document.getElementById('modalProductForm').reset();
                
                // Reload products
                await this.loadProducts();
                this.renderProducts();
                this.updateSummary();
            } else {
                this.showAlert('Error adding product: ' + result.message, 'danger');
            }
        } catch (error) {
            console.error('Error adding product:', error);
            this.showAlert('Error adding product. Please check your connection.', 'danger');
        }
    }

    async deleteProduct(id) {
        const product = this.products.find(p => p._id === id);
        if (!product) return;

        if (confirm(`Are you sure you want to delete "${product.name}"?`)) {
            try {
                const response = await fetch(`${this.apiBaseUrl}/${id}`, {
                    method: 'DELETE'
                });

                const result = await response.json();

                if (result.success) {
                    await this.loadProducts();
                    this.renderProducts();
                    this.updateSummary();
                    this.showAlert(`Product "${product.name}" deleted successfully!`, 'success');
                } else {
                    this.showAlert('Error deleting product: ' + result.message, 'danger');
                }
            } catch (error) {
                console.error('Error deleting product:', error);
                this.showAlert('Error deleting product. Please check your connection.', 'danger');
            }
        }
    }

    filterProducts() {
        const searchTerm = document.getElementById('searchInput').value.toLowerCase();
        const typeFilter = document.getElementById('filterType').value;

        this.filteredProducts = this.products.filter(product => {
            const matchesSearch = product.name.toLowerCase().includes(searchTerm) ||
                                product.description.toLowerCase().includes(searchTerm);
            const matchesType = !typeFilter || product.type === typeFilter;
            return matchesSearch && matchesType;
        });

        this.renderProducts();
    }

    renderProducts() {
        const tbody = document.getElementById('productTableBody');

        if (this.filteredProducts.length === 0) {
            tbody.innerHTML = `
                <tr id="emptyState">
                    <td colspan="7" class="text-center text-muted py-4">
                        <i class="fas fa-box-open fa-2x mb-2"></i>
                        <br>
                        No products in inventory. Add your first product to get started!
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.filteredProducts.map(product => {
            const imageUrl = this.getPrimaryImageUrl(product);
            const imageHtml = imageUrl 
                ? `<img src="${imageUrl}" alt="${product.name}" class="product-thumbnail" style="width: 60px; height: 60px; object-fit: cover; border-radius: 4px;">`
                : `<div class="product-placeholder" style="width: 60px; height: 60px; background: #f8f9fa; border: 2px dashed #dee2e6; border-radius: 4px; display: flex; align-items: center; justify-content: center;">
                     <i class="fas fa-image text-muted"></i>
                   </div>`;

            return `
                <tr>
                    <td>${imageHtml}</td>
                    <td>
                        <strong>${this.escapeHtml(product.name)}</strong>
                        ${product.description ? `<br><small class="text-muted">${this.escapeHtml(product.description)}</small>` : ''}
                    </td>
                    <td>
                        <span class="type-badge type-${product.type}">
                            ${this.formatProductType(product.type)}
                        </span>
                    </td>
                    <td>
                        <span class="badge ${product.quantity === 0 ? 'bg-danger' : product.quantity < 10 ? 'bg-warning' : 'bg-success'}">
                            ${product.quantity}
                        </span>
                    </td>
                    <td>$${product.price.toFixed(2)}</td>
                    <td><strong>$${product.totalValue.toFixed(2)}</strong></td>
                    <td>
                        <button type="button" class="btn btn-outline-primary btn-sm me-1 edit-btn" data-product-id="${product._id}" title="Edit Product" aria-label="Edit Product">
                            <i class="fas fa-edit" aria-hidden="true"></i>
                        </button>
                        <button type="button" class="btn btn-outline-danger btn-sm delete-btn" data-product-id="${product._id}" title="Delete Product" aria-label="Delete Product">
                            <i class="fas fa-trash" aria-hidden="true"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    updateSummary() {
        const totalProducts = this.products.reduce((sum, product) => sum + product.quantity, 0);
        const totalValue = this.products.reduce((sum, product) => sum + product.totalValue, 0);

        document.getElementById('totalProducts').textContent = totalProducts;
        document.getElementById('totalValue').textContent = `$${totalValue.toFixed(2)}`;

        // Type breakdown
        const typeBreakdown = {};
        this.products.forEach(product => {
            if (!typeBreakdown[product.type]) {
                typeBreakdown[product.type] = { count: 0, value: 0 };
            }
            typeBreakdown[product.type].count += product.quantity;
            typeBreakdown[product.type].value += product.totalValue;
        });

        const breakdownHtml = Object.entries(typeBreakdown).map(([type, data]) => `
            <div class="d-flex justify-content-between align-items-center mb-2">
                <span class="type-badge type-${type}">${this.formatProductType(type)}</span>
                <div class="text-end">
                    <small class="text-muted">${data.count} items</small><br>
                    <small class="fw-bold">$${data.value.toFixed(2)}</small>
                </div>
            </div>
        `).join('');

        document.getElementById('typeBreakdown').innerHTML = breakdownHtml || '<p class="text-muted text-center">No products yet</p>';
    }

    formatProductType(type) {
        const typeMap = {
            'bed-covers': 'Bed Covers',
            'cushion-covers': 'Cushion Covers',
            'sarees': 'Sarees',
            'towels': 'Towels'
        };
        return typeMap[type] || type;
    }

    clearForm() {
        document.getElementById('productName').value = '';
        document.getElementById('productType').value = '';
        document.getElementById('quantity').value = '';
        document.getElementById('price').value = '';
        document.getElementById('description').value = '';
        document.getElementById('productImage').value = '';
        document.getElementById('generateAI').checked = true;
        this.hideAIPreview();
    }



    showAlert(message, type = 'info') {
        // Remove existing alerts
        const existingAlert = document.querySelector('.alert');
        if (existingAlert) {
            existingAlert.remove();
        }

        const alert = document.createElement('div');
        alert.className = `alert alert-${type} alert-dismissible fade show`;
        alert.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;

        document.querySelector('.container').insertBefore(alert, document.querySelector('.row'));

        // Auto-dismiss after 3 seconds
        setTimeout(() => {
            if (alert.parentNode) {
                alert.remove();
            }
        }, 3000);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Export data as JSON
    exportData() {
        const dataStr = JSON.stringify(this.products, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'textile-inventory.json';
        link.click();
        URL.revokeObjectURL(url);
    }

    // Import data from JSON
    async importData(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const importedProducts = JSON.parse(e.target.result);
                if (Array.isArray(importedProducts)) {
                    // Import each product via API
                    let successCount = 0;
                    let errorCount = 0;
                    
                    for (const product of importedProducts) {
                        try {
                            const response = await fetch(this.apiBaseUrl, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({
                                    name: product.name,
                                    type: product.type,
                                    quantity: product.quantity,
                                    price: product.price,
                                    description: product.description || ''
                                })
                            });
                            
                            const result = await response.json();
                            if (result.success) {
                                successCount++;
                            } else {
                                errorCount++;
                            }
                        } catch (error) {
                            errorCount++;
                        }
                    }
                    
                    await this.loadProducts();
                    this.renderProducts();
                    this.updateSummary();
                    
                    if (errorCount === 0) {
                        this.showAlert(`Successfully imported ${successCount} products!`, 'success');
                    } else {
                        this.showAlert(`Imported ${successCount} products, ${errorCount} failed.`, 'warning');
                    }
                } else {
                    throw new Error('Invalid file format');
                }
            } catch (error) {
                this.showAlert('Error importing data. Please check the file format.', 'danger');
            }
        };
        reader.readAsText(file);
    }
}

// Initialize the inventory manager when the page loads
window.inventoryManager = null;
document.addEventListener('DOMContentLoaded', () => {
    window.inventoryManager = new InventoryManager();
});
