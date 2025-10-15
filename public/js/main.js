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
        
        return data;
    }

    populateEditForm(product) {
        // Implementation depends on your edit form structure
        document.getElementById('editProductId').value = product._id;
        document.getElementById('editProductName').value = product.name;
        document.getElementById('editProductType').value = product.type;
        document.getElementById('editQuantity').value = product.quantity;
        document.getElementById('editPrice').value = product.price;
        // ... populate other fields
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.inventoryManager = new InventoryManager();
});
