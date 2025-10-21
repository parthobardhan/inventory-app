// Main Inventory Manager - Orchestrates all modules and handles core business logic
class InventoryManager {
    constructor() {
        this.products = [];
        this.filteredProducts = [];
        
        // Initialize services and managers
        this.productService = new ProductService('/api/products');
        this.uiManager = new UIManager();
        this.validationManager = new ValidationManager();
        this.dataManager = new DataManager(this.productService);
        this.costBreakdownManager = new CostBreakdownManager();
        
        // Make cost breakdown manager globally accessible
        window.costBreakdownManager = this.costBreakdownManager;
        
        // IndexedDB manager (if available)
        this.dbManager = null;
        
        this.init();
    }

    async init() {
        console.log('🚀 Initializing InventoryManager...');
        
        // Initialize IndexedDB for offline functionality
        try {
            this.dbManager = new IndexedDBManager();
            await this.dbManager.init();
            console.log('✅ IndexedDB initialized successfully');
        } catch (error) {
            console.warn('⚠️ IndexedDB initialization failed:', error);
            this.dbManager = null;
        }
        
        // Setup validation
        this.validationManager.setupRealTimeValidation();
        
        // Bind events
        this.bindEvents();
        
        // Load initial data
        await this.loadProducts();
        this.uiManager.renderProducts(this.filteredProducts);
        this.uiManager.updateSummary(this.products);
        await this.loadProfitData();
        
        console.log('✅ InventoryManager initialized successfully');
    }

    bindEvents() {
        console.log('🔗 Binding events...');
        
        // Main form submission
        const mainForm = document.getElementById('productForm');
        if (mainForm) {
            mainForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.addProduct();
            });
        }

        // Search functionality
        document.getElementById('searchInput')?.addEventListener('input', () => {
            this.searchProducts();
        });

        document.getElementById('searchBtn')?.addEventListener('click', () => {
            this.searchProducts();
        });

        document.getElementById('searchInput')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.searchProducts();
            }
        });

        // Filter by type
        document.getElementById('filterType')?.addEventListener('change', () => {
            this.searchProducts();
        });

        // Modal product addition
        const modalAddBtn = document.getElementById('addProductBtn');
        if (modalAddBtn) {
            modalAddBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.addProductFromModal();
            });
        }

        // Edit product modal save button
        document.getElementById('saveEditBtn')?.addEventListener('click', () => {
            this.saveEditedProduct();
        });

        // Product actions (edit/delete) - Event delegation
        document.getElementById('productList')?.addEventListener('click', (e) => {
            if (e.target.closest('.edit-btn')) {
                const id = e.target.closest('.edit-btn').getAttribute('data-id');
                this.editProduct(id);
            } else if (e.target.closest('.delete-btn')) {
                const id = e.target.closest('.delete-btn').getAttribute('data-id');
                this.deleteProduct(id);
            }
        });

        // Import/Export functionality
        document.getElementById('exportBtn')?.addEventListener('click', () => {
            this.dataManager.exportData(this.products);
        });

        document.getElementById('importFile')?.addEventListener('change', (e) => {
            this.handleImport(e);
        });

        // Image preview handling
        document.getElementById('productImage')?.addEventListener('change', (e) => {
            this.handleImagePreview(e);
        });
    }

    async loadProducts() {
        try {
            console.log('📥 Loading products...');
            const result = await this.productService.loadProducts();
            
            if (result.success) {
                this.products = result.data;
                this.filteredProducts = [...this.products];
                
                // Save to IndexedDB for offline access
                if (this.dbManager) {
                    for (const product of this.products) {
                        await this.dbManager.saveProduct(product);
                    }
                }
            } else {
                this.uiManager.showAlert('Error loading products: ' + result.message, 'danger');
            }
        } catch (error) {
            console.error('Error loading products:', error);
            
            // Try to load from IndexedDB if API fails
            if (this.dbManager) {
                try {
                    this.products = await this.dbManager.getAllProducts();
                    this.filteredProducts = [...this.products];
                    this.uiManager.showAlert('Loaded products from offline storage', 'warning');
                } catch (dbError) {
                    console.error('Error loading from IndexedDB:', dbError);
                    this.uiManager.showAlert('Unable to load products. Please check your connection.', 'danger');
                }
            } else {
                this.uiManager.showAlert('Unable to load products. Please check your connection.', 'danger');
            }
        }
    }

    async searchProducts() {
        const searchTerm = document.getElementById('searchInput')?.value.trim();
        const typeFilter = document.getElementById('filterType')?.value;

        try {
            const result = await this.productService.searchProducts(searchTerm, typeFilter);
            
            if (result.success) {
                this.products = result.data;
                this.filteredProducts = [...this.products];
                this.uiManager.renderProducts(this.filteredProducts);
                this.uiManager.updateSummary(this.products);
            } else {
                this.uiManager.showAlert('Error searching products: ' + result.message, 'danger');
            }
        } catch (error) {
            console.error('Error searching products:', error);
            this.uiManager.showAlert('Error searching products. Please check your connection.', 'danger');
        }
    }

    async addProduct() {
        const productData = this.getFormData('productForm');
        const validation = this.validationManager.validateMainForm();
        
        if (!validation.isValid) {
            this.uiManager.showAlert('Please fix the following errors: ' + validation.errors.join(', '), 'danger');
            return;
        }

        try {
            const result = await this.productService.createProduct(productData);
            
            if (result.success) {
                const productId = result.data._id;
                
                // Save to IndexedDB
                if (this.dbManager) {
                    await this.dbManager.saveProduct(result.data);
                }
                
                // Handle image upload
                const imageFile = document.getElementById('productImage')?.files[0];
                if (imageFile) {
                    const generateAI = document.getElementById('generateAI')?.checked;
                    const imageResult = await this.productService.uploadImage(productId, imageFile, generateAI);
                    
                    if (imageResult && imageResult.aiGenerated) {
                        this.uiManager.displayAIContent(imageResult.aiGenerated);
                    }
                }
                
                await this.loadProducts();
                this.uiManager.renderProducts(this.filteredProducts);
                this.uiManager.updateSummary(this.products);
                this.uiManager.clearForm();
                this.uiManager.showAlert(`Product "${productData.name}" added successfully!`, 'success');
            } else {
                this.uiManager.showAlert('Error adding product: ' + result.message, 'danger');
            }
        } catch (error) {
            console.error('Error adding product:', error);
            this.handleOfflineProductAdd(productData);
        }
    }

    async addProductFromModal() {
        if (!this.validationManager.validateModalForm()) {
            return;
        }

        const productData = this.getFormData('modalProductForm');
        this.uiManager.showModalLoading(true);

        try {
            const result = await this.productService.createProduct(productData);
            
            if (result.success) {
                // Handle image upload if provided
                const imageFile = document.getElementById('modalProductImage')?.files[0];
                if (imageFile) {
                    const generateAI = document.getElementById('modalGenerateAI')?.checked;
                    await this.productService.uploadImage(result.data._id, imageFile, generateAI);
                }
                
                await this.loadProducts();
                this.uiManager.renderProducts(this.filteredProducts);
                this.uiManager.updateSummary(this.products);
                this.uiManager.hideModal();
                this.uiManager.clearModalForm();
                this.uiManager.showAlert(`Product "${productData.name}" added successfully!`, 'success');
            } else {
                this.uiManager.showAlert('Error adding product: ' + result.message, 'danger');
            }
        } catch (error) {
            console.error('Error adding product from modal:', error);
            this.handleOfflineProductAdd(productData);
        } finally {
            this.uiManager.showModalLoading(false);
        }
    }

    async handleOfflineProductAdd(productData) {
        if (this.dbManager) {
            try {
                const localProduct = {
                    _id: this.dbManager.generateLocalId(),
                    ...productData,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    isOffline: true
                };
                
                await this.dbManager.saveProduct(localProduct);
                await this.dbManager.addToSyncQueue('create', localProduct);
                
                this.products.push(localProduct);
                this.filteredProducts = [...this.products];
                this.uiManager.renderProducts(this.filteredProducts);
                this.uiManager.updateSummary(this.products);
                this.uiManager.clearForm();
                this.uiManager.showAlert(`Product "${productData.name}" saved offline. Will sync when connection is restored.`, 'warning');
            } catch (dbError) {
                console.error('Error saving to IndexedDB:', dbError);
                this.uiManager.showAlert('Error adding product. Please check your connection.', 'danger');
            }
        } else {
            this.uiManager.showAlert('Error adding product. Please check your connection.', 'danger');
        }
    }

    async editProduct(id) {
        const product = this.products.find(p => p._id === id);
        if (!product) return;

        // Populate edit form (implementation depends on your edit modal structure)
        this.populateEditForm(product);
        
        // Show edit modal if you have one
        const editModal = document.getElementById('editProductModal');
        if (editModal) {
            const bsModal = new bootstrap.Modal(editModal);
            bsModal.show();
        }
    }

    async saveEditedProduct() {
        const productData = this.getFormData('editProductForm');
        const productId = document.getElementById('editProductId')?.value;
        
        if (!productId) return;

        try {
            const result = await this.productService.updateProduct(productId, productData);
            
            if (result.success) {
                await this.loadProducts();
                this.uiManager.renderProducts(this.filteredProducts);
                this.uiManager.updateSummary(this.products);
                this.uiManager.showAlert('Product updated successfully!', 'success');
            } else {
                this.uiManager.showAlert('Error updating product: ' + result.message, 'danger');
            }
        } catch (error) {
            console.error('Error updating product:', error);
            this.uiManager.showAlert('Error updating product. Please check your connection.', 'danger');
        }
    }

    async deleteProduct(id) {
        const product = this.products.find(p => p._id === id);
        if (!product) return;

        if (confirm(`Are you sure you want to delete "${product.name}"?`)) {
            try {
                const result = await this.productService.deleteProduct(id);
                
                if (result.success) {
                    await this.loadProducts();
                    this.uiManager.renderProducts(this.filteredProducts);
                    this.uiManager.updateSummary(this.products);
                    this.uiManager.showAlert('Product deleted successfully!', 'success');
                } else {
                    this.uiManager.showAlert('Error deleting product: ' + result.message, 'danger');
                }
            } catch (error) {
                console.error('Error deleting product:', error);
                this.uiManager.showAlert('Error deleting product. Please check your connection.', 'danger');
            }
        }
    }

    async loadProfitData() {
        try {
            const result = await this.productService.loadProfitData();
            
            if (result.success) {
                this.uiManager.updateProfitDisplay(result.data);
            }
        } catch (error) {
            console.error('Error loading profit data:', error);
        }
    }

    async handleImport(event) {
        try {
            // Create backup before import
            await this.dataManager.createBackup(this.products);
            
            const result = await this.dataManager.importData(
                event,
                (progress) => {
                    // Progress callback
                    console.log(`Import progress: ${progress.current}/${progress.total}`);
                },
                (result) => {
                    // Completion callback
                    if (result.errorCount === 0) {
                        this.uiManager.showAlert(`Successfully imported ${result.successCount} products!`, 'success');
                    } else {
                        this.uiManager.showAlert(`Import completed: ${result.successCount} successful, ${result.errorCount} failed`, 'warning');
                    }
                    
                    // Reload products
                    this.loadProducts();
                }
            );
        } catch (error) {
            this.uiManager.showAlert('Import failed: ' + error.message, 'danger');
        }
    }

    handleImagePreview(event) {
        const file = event.target.files[0];
        if (file) {
            console.log('Image selected:', file.name);
            // Add image preview functionality here if needed
        }
    }

    // Utility methods
    getFormData(formId) {
        const form = document.getElementById(formId);
        if (!form) return {};

        const formData = new FormData(form);
        const data = {};
        
        for (let [key, value] of formData.entries()) {
            data[key] = value;
        }
        
        // Add cost breakdown data if it's from the modal form
        if (formId === 'modalProductForm' && this.costBreakdownManager) {
            data.costBreakdown = this.costBreakdownManager.getCostBreakdown();
            data.cost = this.costBreakdownManager.getTotalCost();
        }
        
        return data;
    }

    populateEditForm(product) {
        // Implementation depends on your edit form structure
        document.getElementById('editProductId').value = product._id;
        document.getElementById('editProductName').value = product.name;
        document.getElementById('editProductType').value = product.type;
        document.getElementById('editQuantity').value = product.quantity;
        document.getElementById('editPrice').value = product.price;
        document.getElementById('editCost').value = product.cost || 0;
        
        // Display cost breakdown
        const breakdownDisplay = document.getElementById('editCostBreakdownDisplay');
        if (breakdownDisplay && product.costBreakdown && product.costBreakdown.length > 0) {
            let html = '<label class="form-label fw-bold">Cost Breakdown</label><div class="card"><div class="card-body">';
            product.costBreakdown.forEach(item => {
                html += `
                    <div class="cost-breakdown-item-display">
                        <span class="cost-category">${item.category}</span>
                        <span class="cost-amount">$${item.amount.toFixed(2)}</span>
                    </div>
                `;
            });
            html += '</div></div>';
            breakdownDisplay.innerHTML = html;
        } else if (breakdownDisplay) {
            breakdownDisplay.innerHTML = '<p class="text-muted">No cost breakdown available</p>';
        }
    }

    // Sell Product Modal Functionality
    setupSellProductModal() {
        const sellModal = document.getElementById('sellProductModal');
        const sellProductSelect = document.getElementById('sellProductSelect');
        const sellProductDetails = document.getElementById('sellProductDetails');
        const confirmSellBtn = document.getElementById('confirmSellBtn');

        if (!sellModal || !sellProductSelect) return;

        // Load products when modal opens
        sellModal.addEventListener('show.bs.modal', async () => {
            await this.loadProductsForSell();
            
            // Set today's date as default
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('sellDate').value = today;
        });

        // Handle product selection
        sellProductSelect.addEventListener('change', (e) => {
            const productId = e.target.value;
            if (productId) {
                this.selectProductForSell(productId);
            }
        });

        // Handle sell confirmation
        if (confirmSellBtn) {
            confirmSellBtn.addEventListener('click', () => this.handleSellProduct());
        }

        // Clear validation on input
        document.getElementById('sellQuantity')?.addEventListener('input', () => {
            document.getElementById('sellQuantity').classList.remove('is-invalid');
            document.getElementById('sellQuantityError').textContent = '';
        });

        document.getElementById('sellPrice')?.addEventListener('input', () => {
            document.getElementById('sellPrice').classList.remove('is-invalid');
            document.getElementById('sellPriceError').textContent = '';
        });
    }

    async loadProductsForSell() {
        try {
            const result = await this.productService.loadProducts();
            const sellProductSelect = document.getElementById('sellProductSelect');
            
            if (!result.success) {
                console.error('Failed to load products:', result.message);
                alert('Failed to load products: ' + result.message);
                return;
            }

            const products = result.data || [];
            
            // Clear existing options except first
            sellProductSelect.innerHTML = '<option value="">Choose a product...</option>';
            
            // Add products with available quantity - showing SKU, Name, and Qty
            products.filter(p => p.quantity > 0).forEach(product => {
                const option = document.createElement('option');
                option.value = product._id;
                const sku = product.sku || product._id.substring(0, 8);
                option.textContent = `${sku} - ${product.name} (${product.quantity} available)`;
                option.dataset.product = JSON.stringify(product);
                sellProductSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Error loading products for sell:', error);
            alert('Failed to load products');
        }
    }

    selectProductForSell(productId) {
        const sellProductSelect = document.getElementById('sellProductSelect');
        const selectedOption = sellProductSelect.querySelector(`option[value="${productId}"]`);
        
        if (!selectedOption) return;
        
        const product = JSON.parse(selectedOption.dataset.product);
        
        // Populate product details
        document.getElementById('sellProductId').value = product._id;
        document.getElementById('sellProductSku').value = product.sku || product._id;
        document.getElementById('sellMaxQuantity').value = product.quantity;
        document.getElementById('sellProductSkuDisplay').textContent = product.sku || product._id.substring(0, 8);
        document.getElementById('sellAvailableQuantity').textContent = product.quantity;
        
        // Set sell price to list price (default)
        document.getElementById('sellPrice').value = product.price || 0;
        
        // Set quantity to 1
        document.getElementById('sellQuantity').value = 1;
        document.getElementById('sellQuantity').max = product.quantity;
        
        // Set today's date as default
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('sellDate').value = today;
        
        // Clear any validation errors
        document.getElementById('sellQuantity').classList.remove('is-invalid');
        document.getElementById('sellPrice').classList.remove('is-invalid');
        document.getElementById('sellQuantityError').textContent = '';
        document.getElementById('sellPriceError').textContent = '';
    }

    async handleSellProduct() {
        try {
            const productId = document.getElementById('sellProductId').value;
            const sku = document.getElementById('sellProductSku').value;
            const quantity = parseInt(document.getElementById('sellQuantity').value);
            const sellPrice = parseFloat(document.getElementById('sellPrice').value);
            const dateSold = document.getElementById('sellDate').value;
            const maxQuantity = parseInt(document.getElementById('sellMaxQuantity').value);

            // Clear previous validation
            document.getElementById('sellQuantity').classList.remove('is-invalid');
            document.getElementById('sellPrice').classList.remove('is-invalid');

            // Validation
            let hasError = false;

            if (!quantity || quantity < 1 || quantity > maxQuantity) {
                document.getElementById('sellQuantityError').textContent = `Please enter a valid quantity (1-${maxQuantity})`;
                document.getElementById('sellQuantity').classList.add('is-invalid');
                hasError = true;
            }

            if (!sellPrice || sellPrice <= 0) {
                document.getElementById('sellPriceError').textContent = 'Please enter a valid sell price';
                document.getElementById('sellPrice').classList.add('is-invalid');
                hasError = true;
            }

            if (hasError) return;

            // Record the sale via API
            const saleData = {
                productId: productId,
                sku: sku,
                quantity: quantity,
                sellPrice: sellPrice,
                dateSold: dateSold
            };

            const response = await fetch('/api/products/sell', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(saleData)
            });

            const result = await response.json();

            if (result.success) {
                // Close modal
                const modal = bootstrap.Modal.getInstance(document.getElementById('sellProductModal'));
                modal.hide();

                // Show success message
                this.uiManager.showAlert(`Successfully sold ${quantity} units of ${sku} for $${sellPrice.toFixed(2)}`, 'success');

                // Refresh profit metrics
                await this.loadProfitData();

                // Reset form
                document.getElementById('sellProductForm').reset();
                document.getElementById('sellProductSkuDisplay').textContent = '-';
                document.getElementById('sellAvailableQuantity').textContent = '0';
                
                // Set default date again after reset
                const today = new Date().toISOString().split('T')[0];
                document.getElementById('sellDate').value = today;
            } else {
                throw new Error(result.message || 'Failed to record sale');
            }

        } catch (error) {
            console.error('Error selling product:', error);
            this.uiManager.showAlert('Error recording sale: ' + error.message, 'danger');
        }
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.inventoryManager = new InventoryManager();
    
    // Setup sell product modal if it exists
    if (document.getElementById('sellProductModal')) {
        window.inventoryManager.setupSellProductModal();
    }
});
