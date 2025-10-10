// Textile Inventory Management System - API Version

class InventoryManager {
    constructor() {
        this.products = [];
        this.filteredProducts = [];
        this.apiBase = '/api/products';
        this.cacheKey = 'textileInventory_cache';
        this.lastSyncKey = 'textileInventory_lastSync';
        this.isOnline = navigator.onLine;
        this.syncInProgress = false;
        this.pieChart = null;
        this.barChart = null;
        
        // Check if IndexedDBManager is available
        if (typeof IndexedDBManager === 'undefined') {
            console.error('IndexedDBManager is not defined. Please ensure indexeddb-utils.js is loaded first.');
            throw new Error('IndexedDBManager is not defined');
        }
        
        this.dbManager = new IndexedDBManager();
        this.init();
    }

    async init() {
        try {
            // Initialize IndexedDB
            await this.dbManager.init();
            console.warn('IndexedDB initialized successfully');
            
            this.bindEvents();
            this.setupNetworkMonitoring();
            await this.loadProducts();
            this.renderProducts();
            await this.updateSummary();
            
            // Setup service worker message listener for sync
            this.setupServiceWorkerSync();
            
            // Perform initial sync if online
            if (this.isOnline) {
                this.syncWithDatabase();
            }
        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.showAlert('Failed to initialize app. Some features may not work properly.', 'error');
            
            // Fallback to localStorage if IndexedDB fails
            this.bindEvents();
            this.setupNetworkMonitoring();
            await this.loadProducts();
            this.renderProducts();
            await this.updateSummary();
        }
    }

    bindEvents() {
        console.warn('🔗 [CLIENT] Binding events...');
        
        // Add product form
        const mainForm = document.getElementById('productForm');
        if (mainForm) {
            console.warn('✅ [CLIENT] Main form found, binding submit event');
            mainForm.addEventListener('submit', (e) => {
                e.preventDefault();
                console.warn('📝 [CLIENT] Main form submitted');
                this.addProduct();
            });
        } else {
            console.warn('⚠️ [CLIENT] Main form not found');
        }

        // Modal add product button - with error handling and duplicate prevention
        const modalAddBtn = document.getElementById('addProductBtn');
        if (modalAddBtn) {
            // Remove any existing event listeners to prevent duplicates
            const existingHandler = modalAddBtn._inventoryHandler;
            if (existingHandler) {
                modalAddBtn.removeEventListener('click', existingHandler);
                console.warn('🔄 Removed existing modal button event listener');
            }
            
            // Create and attach new event listener
            const clickHandler = () => {
                console.warn('🖱️ [CLIENT] Modal Add Product button clicked');
                console.warn('🔍 [CLIENT] Button element:', modalAddBtn);
                console.warn('🔍 [CLIENT] Modal element exists:', !!document.getElementById('addProductModal'));
                console.warn('🔍 [CLIENT] Form element exists:', !!document.getElementById('modalProductForm'));
                console.warn('🔍 [CLIENT] Calling addProductFromModal...');
                this.addProductFromModal();
            };
            
            modalAddBtn.addEventListener('click', clickHandler);
            modalAddBtn._inventoryHandler = clickHandler; // Store reference for future cleanup
            console.warn('✅ Modal add product button event listener attached');
        } else {
            console.error('❌ Modal add product button not found during event binding');
        }

        // Search functionality
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.filterProducts();
        });

        // Filter by type
        document.getElementById('filterType').addEventListener('change', (e) => {
            this.filterProducts();
        });

        // Refresh button
        document.getElementById('refreshBtn').addEventListener('click', (e) => {
            this.forceRefresh();
        });

        // Edit product modal save button
        document.getElementById('saveEditBtn').addEventListener('click', () => {
            this.saveEditedProduct();
        });

        // Image upload functionality
        document.getElementById('productImage').addEventListener('change', (e) => {
            this.handleImagePreview(e);
        });

        // Modal image upload functionality
        const modalImageInput = document.getElementById('modalProductImage');
        if (modalImageInput) {
            modalImageInput.addEventListener('change', (e) => {
                this.handleModalImagePreview(e);
            });
            console.warn('✅ Modal image upload event listener attached');
        } else {
            console.error('❌ Modal image input not found during event binding');
        }

        // AI content editing buttons
        document.getElementById('editTitleBtn').addEventListener('click', () => {
            this.toggleEditMode('aiTitle', 'editTitleBtn');
        });

        document.getElementById('editDescBtn').addEventListener('click', () => {
            this.toggleEditMode('aiDescription', 'editDescBtn');
        });

        // Modal AI content editing buttons
        const modalEditTitleBtn = document.getElementById('modalEditTitleBtn');
        if (modalEditTitleBtn) {
            modalEditTitleBtn.addEventListener('click', () => {
                this.toggleEditMode('modalAiTitle', 'modalEditTitleBtn');
            });
            console.warn('✅ Modal edit title button event listener attached');
        } else {
            console.error('❌ Modal edit title button not found during event binding');
        }

        const modalEditDescBtn = document.getElementById('modalEditDescBtn');
        if (modalEditDescBtn) {
            modalEditDescBtn.addEventListener('click', () => {
                this.toggleEditMode('modalAiDescription', 'modalEditDescBtn');
            });
            console.warn('✅ Modal edit description button event listener attached');
        } else {
            console.error('❌ Modal edit description button not found during event binding');
        }

        // Event delegation for edit and delete buttons
        document.getElementById('productTableBody').addEventListener('click', (e) => {
            const button = e.target.closest('button');
            if (!button) return;

            const productId = button.dataset.productId;
            if (!productId) return;

            if (button.classList.contains('edit-btn')) {
                this.editProduct(productId);
            } else if (button.classList.contains('delete-btn')) {
                this.deleteProduct(productId);
            }
        });
    }

    setupNetworkMonitoring() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.showAlert('Connection restored. Syncing data...', 'info');
            this.syncWithDatabase();
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.showAlert('You are now offline. Changes will be saved locally.', 'warning');
        });
    }

    setupServiceWorkerSync() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('message', (event) => {
                if (event.data && event.data.type === 'SYNC_OFFLINE_PRODUCTS') {
                    this.syncWithDatabase();
                }
            });
        }
    }

    loadFromCache() {
        try {
            const cached = localStorage.getItem(this.cacheKey);
            return cached ? JSON.parse(cached) : null;
        } catch (error) {
            console.error('Error loading from cache:', error);
            return null;
        }
    }

    saveToCache(data) {
        try {
            localStorage.setItem(this.cacheKey, JSON.stringify(data));
            localStorage.setItem(this.lastSyncKey, new Date().toISOString());
        } catch (error) {
            console.error('Error saving to cache:', error);
        }
    }

    async syncWithDatabase() {
        if (this.syncInProgress || !this.isOnline) return;
        
        try {
            this.syncInProgress = true;
            console.warn('🔄 [CLIENT] Syncing with database...');
            const response = await fetch(this.apiBase);
            const result = await response.json();
            
            if (result.success) {
                console.warn('✅ [CLIENT] Database sync successful, received', result.data.length, 'products');
                this.products = result.data;
                this.filteredProducts = [...this.products];
                this.saveToCache(this.products);
                
                // Update IndexedDB with fresh data
                try {
                    await this.saveProductsToIndexedDB(this.products);
                    console.warn('✅ [CLIENT] IndexedDB updated with fresh data');
                } catch (indexedDBError) {
                    console.warn('⚠️ [CLIENT] Failed to update IndexedDB:', indexedDBError);
                }
                
                this.renderProducts();
                await this.updateSummary();
            } else {
                throw new Error(result.message || 'Failed to sync with database');
            }
        } catch (error) {
            console.error('❌ [CLIENT] Error syncing with database:', error);
            if (!this.loadFromCache()) {
                this.showAlert('Unable to sync with server: ' + error.message, 'danger');
            }
        } finally {
            this.syncInProgress = false;
        }
    }

    async loadProducts() {
        try {
            this.showLoading(true);
            
            // If online, prioritize database sync over local storage
            if (this.isOnline && !this.syncInProgress) {
                console.warn('🌐 [CLIENT] Online - syncing with database first');
                await this.syncWithDatabase();
            } else {
                console.warn('📱 [CLIENT] Offline or sync in progress - loading from local storage');
                
                // Load from IndexedDB first for immediate display
                try {
                    const indexedDBProducts = await this.dbManager.getAllProducts();
                    if (indexedDBProducts && indexedDBProducts.length > 0) {
                        this.products = indexedDBProducts;
                        this.filteredProducts = [...this.products];
                        this.renderProducts(); // Show IndexedDB data immediately
                        console.warn('Products loaded from IndexedDB:', this.products.length);
                    }
                } catch (dbError) {
                    console.warn('IndexedDB load failed, trying localStorage:', dbError);
                    
                    // Fallback to localStorage cache
                    const cachedData = this.loadFromCache();
                    if (cachedData) {
                        this.products = cachedData;
                        this.filteredProducts = [...this.products];
                        this.renderProducts(); // Show cached data immediately
                        
                        // Try to migrate to IndexedDB
                        try {
                            await this.saveProductsToIndexedDB(this.products);
                            console.warn('Migrated products to IndexedDB');
                        } catch (migrationError) {
                            console.warn('Failed to migrate to IndexedDB:', migrationError);
                        }
                    }
                }
                
                if (!this.isOnline && this.products.length === 0) {
                    this.showAlert('You are offline. Please connect to the internet to load data.', 'warning');
                }
            }
            
        } catch (error) {
            console.error('Error loading products:', error);
            this.showAlert('Error loading products: ' + error.message, 'danger');
        } finally {
            this.showLoading(false);
        }
    }

    async saveProductsToIndexedDB(products) {
        for (const product of products) {
            try {
                await this.dbManager.saveProduct(product);
            } catch (error) {
                console.error('Failed to save product to IndexedDB:', product._id, error);
            }
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
            this.showLoading(true);

            if (this.isOnline) {
                // Create the product first
                const response = await fetch(this.apiBase, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
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
                    let finalName = name;

                    // Upload image if provided - AI content integration happens on backend
                    if (imageFile) {
                        const imageResult = await this.uploadProductImage(productId, imageFile, generateAI);

                        // Display AI content in preview if generated
                        if (imageResult && imageResult.aiGenerated) {
                            this.displayAIContent(imageResult.aiGenerated);
                            console.warn('AI content generated:', imageResult.aiGenerated);

                            // Use AI-generated title if available and user wants it
                            if (imageResult.aiGenerated.title && generateAI) {
                                finalName = imageResult.aiGenerated.title;
                            }
                        }
                    }

                    // Reload products to get updated data from server
                    await this.loadProducts();
                    this.renderProducts();
                    await this.updateSummary();
                    this.clearForm();
                    this.hideAIPreview();
                    this.showAlert(`Product "${finalName}" added successfully!`, 'success');
                } else {
                    throw new Error(result.message || 'Failed to add product');
                }
            } else {
                // Offline mode - create optimistic product
                const optimisticProduct = {
                    _id: 'temp_' + Date.now(),
                    name,
                    type,
                    quantity,
                    price,
                    description,
                    dateAdded: new Date().toISOString(),
                    totalValue: quantity * price,
                    _isOptimistic: true,
                    _isPending: true
                };

                this.products.push(optimisticProduct);
                this.filteredProducts = [...this.products];
                this.saveToCache(this.products);
                this.renderProducts();
                await this.updateSummary();
                this.clearForm();
                this.showAlert(`Product "${name}" added locally. Will sync when online.`, 'info');
            }
        } catch (error) {
            console.error('Error adding product:', error);
            this.showAlert('Error adding product: ' + error.message, 'danger');
        } finally {
            this.showLoading(false);
        }
    }

    async addProductFromModal() {
        console.warn('🚀 [CLIENT] addProductFromModal() called');
        console.warn('🔍 [CLIENT] Getting form values...');
        
        const name = document.getElementById('modalProductName').value.trim();
        const type = document.getElementById('modalProductType').value;
        const quantity = parseInt(document.getElementById('modalQuantity').value);
        const price = parseFloat(document.getElementById('modalPrice').value);
        const description = document.getElementById('modalDescription').value.trim();
        
        console.warn('📝 [CLIENT] Form values extracted:', {
            name: name,
            type: type,
            quantity: quantity,
            price: price,
            description: description ? description.substring(0, 50) + '...' : 'none'
        });
        const imageFile = document.getElementById('modalProductImage').files[0];
        const generateAI = document.getElementById('modalGenerateAI').checked;

        if (!name || !type || quantity < 0 || price < 0) {
            this.showAlert('Please fill in all required fields with valid values.', 'danger');
            return;
        }

        try {
            console.warn('⏳ [CLIENT] Showing loading state...');
            this.showModalLoading(true);

            if (this.isOnline) {
                console.warn('🌐 [CLIENT] Online - making API request to:', this.apiBase);
                
                const requestBody = {
                    name,
                    type,
                    quantity,
                    price,
                    description
                };
                
                console.warn('📤 [CLIENT] Request body:', JSON.stringify(requestBody, null, 2));
                
                // Create the product first
                const response = await fetch(this.apiBase, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(requestBody)
                });

                console.warn('📥 [CLIENT] Response received:', {
                    status: response.status,
                    statusText: response.statusText,
                    ok: response.ok,
                    headers: Object.fromEntries(response.headers.entries())
                });

                const result = await response.json();
                console.warn('📋 [CLIENT] Response body:', JSON.stringify(result, null, 2));

                if (result.success) {
                    console.warn('✅ [CLIENT] Product created successfully:', result.data);
                    const productId = result.data._id;
                    let finalName = name;

                    // Upload image if provided - AI content integration happens on backend
                    if (imageFile) {
                        console.warn('📸 [CLIENT] Image file provided, uploading...');
                        const imageResult = await this.uploadProductImage(productId, imageFile, generateAI);

                        // Display AI content in modal preview if generated
                        if (imageResult && imageResult.aiGenerated) {
                            console.warn('🤖 [CLIENT] AI content generated:', imageResult.aiGenerated);
                            this.displayModalAIContent(imageResult.aiGenerated);

                            // Use AI-generated title if available and user wants it
                            if (imageResult.aiGenerated.title && generateAI) {
                                finalName = imageResult.aiGenerated.title;
                                console.warn('🏷️ [CLIENT] Using AI-generated title:', finalName);
                            }
                        }
                    } else {
                        console.warn('📸 [CLIENT] No image file provided');
                    }

                    console.warn('🔄 [CLIENT] Reloading products and updating UI...');
                    // Reload products to get updated data from server
                    await this.loadProducts();
                    this.renderProducts();
                    await this.updateSummary();
                    this.clearModalForm();
                    this.hideModalAIPreview();
                    
                    // Hide modal
                    console.warn('👋 [CLIENT] Hiding modal...');
                    const modal = bootstrap.Modal.getInstance(document.getElementById('addProductModal'));
                    modal.hide();
                    
                    console.warn('🎉 [CLIENT] Showing success alert...');
                    this.showAlert(`Product "${finalName}" added successfully!`, 'success');
                } else {
                    console.warn('❌ [CLIENT] API returned error:', result.message);
                    throw new Error(result.message || 'Failed to add product');
                }
            } else {
                console.warn('📱 [CLIENT] Offline mode - creating optimistic product');
                // Offline mode - create optimistic product
                const optimisticProduct = {
                    _id: 'temp_' + Date.now(),
                    name,
                    type,
                    quantity,
                    price,
                    description,
                    dateAdded: new Date().toISOString(),
                    totalValue: quantity * price,
                    _isOptimistic: true,
                    _isPending: true
                };

                console.warn('💾 [CLIENT] Adding optimistic product to local storage:', optimisticProduct);
                this.products.push(optimisticProduct);
                this.filteredProducts = [...this.products];
                this.saveToCache(this.products);
                this.renderProducts();
                await this.updateSummary();
                this.clearModalForm();
                
                // Hide modal
                console.warn('👋 [CLIENT] Hiding modal (offline mode)...');
                const modal = bootstrap.Modal.getInstance(document.getElementById('addProductModal'));
                modal.hide();
                
                console.warn('ℹ️ [CLIENT] Showing offline alert...');
                this.showAlert(`Product "${name}" added locally. Will sync when online.`, 'info');
            }
        } catch (error) {
            console.error('💥 [CLIENT] Error adding product:', error);
            console.error('💥 [CLIENT] Error stack:', error.stack);
            this.showAlert('Error adding product: ' + error.message, 'danger');
        } finally {
            this.showModalLoading(false);
        }
    }

    async editProduct(id) {
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
            this.showLoading(true);
            
            // Optimistic update - update locally first
            const productIndex = this.products.findIndex(p => p._id === id);
            if (productIndex !== -1) {
                const originalProduct = { ...this.products[productIndex] };
                
                this.products[productIndex] = {
                    ...this.products[productIndex],
                    name,
                    type,
                    quantity,
                    price,
                    description,
                    totalValue: quantity * price,
                    _isOptimistic: this.isOnline ? false : true
                };
                
                this.filteredProducts = [...this.products];
                this.renderProducts();
                await this.updateSummary();
                
                // Hide modal
                const modal = bootstrap.Modal.getInstance(document.getElementById('editProductModal'));
                modal.hide();

                if (this.isOnline) {
                    // Try to sync with database
                    const response = await fetch(`${this.apiBase}/${id}`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
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
                        this.products[productIndex] = result.data;
                        this.saveToCache(this.products);
                        this.showAlert(`Product "${name}" updated successfully!`, 'success');
                    } else {
                        // Revert on error
                        this.products[productIndex] = originalProduct;
                        throw new Error(result.message || 'Failed to update product');
                    }
                } else {
                    // Offline mode - save to localStorage with pending flag
                    this.products[productIndex]._isPending = true;
                    this.saveToCache(this.products);
                    this.showAlert(`Product "${name}" updated locally. Will sync when online.`, 'info');
                }
            }
        } catch (error) {
            console.error('Error updating product:', error);
            this.showAlert('Error updating product: ' + error.message, 'danger');
        } finally {
            this.showLoading(false);
        }
    }

    async deleteProduct(id) {
        const product = this.products.find(p => p._id === id);
        if (!product) return;

        if (confirm(`Are you sure you want to delete "${product.name}"?`)) {
            try {
                this.showLoading(true);
                
                // Optimistic update - remove from UI immediately
                const originalProducts = [...this.products];
                this.products = this.products.filter(p => p._id !== id);
                this.filteredProducts = [...this.products];
                this.renderProducts();
                await this.updateSummary();

                if (this.isOnline) {
                    // Try to sync with database
                    const response = await fetch(`${this.apiBase}/${id}`, {
                        method: 'DELETE'
                    });

                    const result = await response.json();

                    if (result.success) {
                        this.saveToCache(this.products);
                        this.showAlert(`Product "${product.name}" deleted successfully!`, 'success');
                    } else {
                        // Revert on error
                        this.products = originalProducts;
                        this.filteredProducts = [...this.products];
                        this.renderProducts();
                        await this.updateSummary();
                        throw new Error(result.message || 'Failed to delete product');
                    }
                } else {
                    // Offline mode - mark for deletion and save to localStorage
                    const deletedProduct = { ...product, _isDeleted: true, _isPending: true };
                    this.products.push(deletedProduct);
                    this.saveToCache(this.products);
                    this.showAlert(`Product "${product.name}" marked for deletion. Will sync when online.`, 'info');
                }
            } catch (error) {
                console.error('Error deleting product:', error);
                this.showAlert('Error deleting product: ' + error.message, 'danger');
            } finally {
                this.showLoading(false);
            }
        }
    }

    filterProducts() {
        const searchTerm = document.getElementById('searchInput').value.toLowerCase();
        const typeFilter = document.getElementById('filterType').value;

        this.filteredProducts = this.products.filter(product => {
            const matchesSearch = product.name.toLowerCase().includes(searchTerm) ||
                                (product.description && product.description.toLowerCase().includes(searchTerm));
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

        tbody.innerHTML = this.filteredProducts.map(product => `
            <tr>
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
                    <button class="btn btn-outline-primary btn-sm me-1 edit-btn" data-product-id="${product._id}">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-outline-danger btn-sm delete-btn" data-product-id="${product._id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    async updateSummary() {
        try {
            const response = await fetch(`${this.apiBase}/stats/summary`);
            const result = await response.json();

            if (result.success) {
                const summary = result.data;
                
                document.getElementById('totalProducts').textContent = summary.totalProducts;
                document.getElementById('totalValue').textContent = `$${summary.totalValue.toFixed(2)}`;

                // Type breakdown
                const breakdownHtml = Object.entries(summary.typeBreakdown).map(([type, data]) => `
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <span class="type-badge type-${type}">${this.formatProductType(type)}</span>
                        <div class="text-end">
                            <small class="text-muted">${data.count} items</small><br>
                            <small class="fw-bold">$${data.value.toFixed(2)}</small>
                        </div>
                    </div>
                `).join('');

                document.getElementById('typeBreakdown').innerHTML = breakdownHtml || '<p class="text-muted text-center">No products yet</p>';
                
                this.updateAnalyticsDashboard(summary.typeBreakdown);
            }
        } catch (error) {
            console.error('Error updating summary:', error);
        }
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

    getTypeColors() {
        return {
            'bed-covers': '#FF6384',
            'cushion-covers': '#36A2EB', 
            'sarees': '#FFCE56',
            'towels': '#9966FF'
        };
    }

    updateAnalyticsDashboard(typeBreakdown) {
        const hasData = Object.keys(typeBreakdown).length > 0;
        
        // Check if we're on the analytics page
        const analyticsContainer = document.getElementById('analyticsContainer');
        const emptyAnalyticsState = document.getElementById('emptyAnalyticsState');
        
        if (analyticsContainer && emptyAnalyticsState) {
            // We're on the analytics page
            if (hasData) {
                analyticsContainer.querySelector('.row').style.display = 'block';
                emptyAnalyticsState.style.display = 'none';
                
                this.renderPieChart(typeBreakdown);
                this.renderBarChart(typeBreakdown);
            } else {
                analyticsContainer.querySelector('.row').style.display = 'none';
                emptyAnalyticsState.style.display = 'block';
            }
        } else {
            // We're on the homepage - just render charts if they exist
            if (hasData) {
                this.renderPieChart(typeBreakdown);
                this.renderBarChart(typeBreakdown);
            }
        }
    }

    renderPieChart(typeBreakdown) {
        const pieChartElement = document.getElementById('pieChart');
        if (!pieChartElement) {
            return; // Chart element doesn't exist on this page
        }
        
        const ctx = pieChartElement.getContext('2d');
        const colors = this.getTypeColors();
        
        const data = {
            labels: Object.keys(typeBreakdown).map(type => this.formatProductType(type)),
            datasets: [{
                data: Object.values(typeBreakdown).map(item => item.count),
                backgroundColor: Object.keys(typeBreakdown).map(type => colors[type] || '#999999'),
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        };

        const config = {
            type: 'pie',
            data: data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 15,
                            usePointStyle: true
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((context.parsed / total) * 100).toFixed(1);
                                return `${context.label}: ${context.parsed} items (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        };

        if (this.pieChart) {
            this.pieChart.destroy();
        }
        this.pieChart = new Chart(ctx, config);
    }

    renderBarChart(typeBreakdown) {
        const barChartElement = document.getElementById('barChart');
        if (!barChartElement) {
            return; // Chart element doesn't exist on this page
        }
        
        const ctx = barChartElement.getContext('2d');
        const colors = this.getTypeColors();
        
        const data = {
            labels: Object.keys(typeBreakdown).map(type => this.formatProductType(type)),
            datasets: [{
                label: 'Inventory Value',
                data: Object.values(typeBreakdown).map(item => item.value),
                backgroundColor: Object.keys(typeBreakdown).map(type => colors[type] || '#999999'),
                borderColor: Object.keys(typeBreakdown).map(type => colors[type] || '#999999'),
                borderWidth: 1
            }]
        };

        const config = {
            type: 'bar',
            data: data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.label}: $${context.parsed.y.toFixed(2)}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return '$' + value.toFixed(0);
                            }
                        }
                    }
                }
            }
        };

        if (this.barChart) {
            this.barChart.destroy();
        }
        this.barChart = new Chart(ctx, config);
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
            // Show that an image is selected
            this.showAlert('Image selected. AI description will be generated after adding the product.', 'info');
        }
    }

    handleModalImagePreview(event) {
        const file = event.target.files[0];
        if (file) {
            // Show that an image is selected
            this.showAlert('Image selected. AI description will be generated after adding the product.', 'info');
        }
    }

    toggleEditMode(fieldId, buttonId) {
        const field = document.getElementById(fieldId);
        const button = document.getElementById(buttonId);

        if (field.readOnly) {
            field.readOnly = false;
            field.focus();
            button.innerHTML = '<i class="fas fa-save"></i> Save';
            button.classList.remove('btn-outline-primary');
            button.classList.add('btn-success');
        } else {
            field.readOnly = true;
            button.innerHTML = '<i class="fas fa-edit"></i> Edit';
            button.classList.remove('btn-success');
            button.classList.add('btn-outline-primary');
            // Here you could save the edited content to the server
        }
    }

    clearForm() {
        document.getElementById('productForm').reset();
        this.hideAIPreview();
    }

    clearModalForm() {
        document.getElementById('modalProductForm').reset();
        this.hideModalAIPreview();
    }

    displayModalAIContent(aiData) {
        document.getElementById('modalAiTitle').value = aiData.title || '';
        document.getElementById('modalAiDescription').value = aiData.description || '';
        document.getElementById('modalAiConfidence').textContent = Math.round((aiData.confidence || 0) * 100);
        document.getElementById('modalAiModel').textContent = aiData.model || 'Unknown';

        document.getElementById('modalAiPreview').style.display = 'block';
    }

    hideModalAIPreview() {
        document.getElementById('modalAiPreview').style.display = 'none';
        document.getElementById('modalAiTitle').value = '';
        document.getElementById('modalAiDescription').value = '';
    }

    showModalLoading(show) {
        const submitButton = document.getElementById('addProductBtn');
        if (submitButton) {
            if (show) {
                submitButton.disabled = true;
                submitButton.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Loading...';
            } else {
                submitButton.disabled = false;
                submitButton.innerHTML = '<i class="fas fa-plus me-2"></i>Add Product';
            }
        }
    }

    showAlert(message, type = 'info') {
        // Remove existing alerts
        const existingAlerts = document.querySelectorAll('.alert');
        existingAlerts.forEach(alert => alert.remove());

        const alert = document.createElement('div');
        alert.className = `alert alert-${type} alert-dismissible fade show`;
        alert.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;

        // Find a safe insertion point
        const container = document.querySelector('.container');

        if (container) {
            // Find the first row that is a direct child of this container
            const row = container.querySelector('.row');

            if (row && row.parentNode === container) {
                try {
                    container.insertBefore(alert, row);
                } catch (error) {
                    console.warn('Failed to insert alert before row, using prepend:', error);
                    container.prepend(alert);
                }
            } else {
                // Fallback: prepend to container
                container.prepend(alert);
            }
        } else {
            // Last resort: append to body
            document.body.prepend(alert);
        }

        // Auto-dismiss after 3 seconds
        setTimeout(() => {
            if (alert.parentNode) {
                alert.remove();
            }
        }, 3000);
    }

    showLoading(show) {
        // Only target the specific submit button in the product form, not all buttons
        const submitButton = document.querySelector('#productForm button[type="submit"]');
        if (submitButton) {
            if (show) {
                submitButton.disabled = true;
                submitButton.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Loading...';
            } else {
                submitButton.disabled = false;
                submitButton.innerHTML = '<i class="fas fa-plus me-2"></i>Add Product';
            }
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Export data as JSON
    async exportData() {
        try {
            const response = await fetch(this.apiBase);
            const result = await response.json();
            
            if (result.success) {
                const dataStr = JSON.stringify(result.data, null, 2);
                const dataBlob = new Blob([dataStr], { type: 'application/json' });
                const url = URL.createObjectURL(dataBlob);
                const link = document.createElement('a');
                link.href = url;
                link.download = 'textile-inventory.json';
                link.click();
                URL.revokeObjectURL(url);
                this.showAlert('Data exported successfully!', 'success');
            }
        } catch (error) {
            this.showAlert('Error exporting data: ' + error.message, 'danger');
        }
    }

    // Force refresh data from database
    async forceRefresh() {
        try {
            this.showLoading(true);
            console.warn('🔄 [CLIENT] Force refreshing data from database...');
            
            // Clear local caches
            try {
                await this.dbManager.clearAllData();
                console.warn('✅ [CLIENT] Cleared IndexedDB cache');
            } catch (error) {
                console.warn('⚠️ [CLIENT] Failed to clear IndexedDB:', error);
            }
            
            // Clear localStorage cache
            localStorage.removeItem(this.cacheKey);
            localStorage.removeItem(this.lastSyncKey);
            console.warn('✅ [CLIENT] Cleared localStorage cache');
            
            // Force sync with database
            await this.syncWithDatabase();
            
            this.showAlert('Data refreshed successfully!', 'success');
        } catch (error) {
            console.error('❌ [CLIENT] Error force refreshing:', error);
            this.showAlert('Error refreshing data: ' + error.message, 'danger');
        } finally {
            this.showLoading(false);
        }
    }
}

// Initialize the inventory manager when the page loads
let inventoryManager;
document.addEventListener('DOMContentLoaded', async () => {
    console.warn('🚀 Initializing InventoryManager...');
    try {
        // Check if IndexedDBManager is available before creating InventoryManager
        if (typeof IndexedDBManager === 'undefined') {
            throw new Error('IndexedDBManager is not defined. Please check if indexeddb-utils.js is loaded.');
        }
        
        inventoryManager = new InventoryManager();
        
        // The constructor calls init() automatically, but we need to wait for it
        // Let's wait a bit longer for the async initialization to complete
        console.warn('⏳ Waiting for InventoryManager async initialization...');
        
        // Wait for the init process to complete
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Make it globally available for debugging and modal access
        window.inventoryManager = inventoryManager;
        console.warn('✅ InventoryManager initialized and available globally');
        console.warn('✅ addProductFromModal method:', typeof inventoryManager.addProductFromModal);
        
        // Verify the method exists
        if (typeof inventoryManager.addProductFromModal === 'function') {
            console.warn('🎯 Modal functionality should work now!');
            
            // Test that we can call the method (without actually executing it)
            console.warn('🧪 Testing method availability...');
            console.warn('Method signature:', inventoryManager.addProductFromModal.toString().substring(0, 100) + '...');
        } else {
            console.error('❌ addProductFromModal method not found on InventoryManager');
            console.warn('Available methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(inventoryManager)));
        }
        
    } catch (error) {
        console.error('❌ Failed to initialize InventoryManager:', error);
        console.error('Error details:', error.stack);
    }
});
