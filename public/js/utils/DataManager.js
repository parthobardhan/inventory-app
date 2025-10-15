// Data Manager - Handles import/export functionality and data operations
class DataManager {
    constructor(productService) {
        this.productService = productService;
    }

    exportData(products) {
        const exportData = {
            timestamp: new Date().toISOString(),
            version: "1.0",
            products: products.map(product => ({
                name: product.name,
                type: product.type,
                quantity: product.quantity,
                price: product.price,
                cost: product.cost || 0,
                description: product.description || '',
                dateSold: product.dateSold || null,
                createdAt: product.createdAt,
                updatedAt: product.updatedAt
            }))
        };

        const dataStr = JSON.stringify(exportData, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

        const exportFileDefaultName = `inventory_export_${new Date().toISOString().split('T')[0]}.json`;

        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
    }

    async importData(event, onProgress, onComplete) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const text = await this.readFile(file);
            const data = JSON.parse(text);
            
            if (Array.isArray(data)) {
                // Legacy format - direct array of products
                return await this.processImportedProducts(data, onProgress, onComplete);
            } else if (data.products && Array.isArray(data.products)) {
                // New format with metadata
                return await this.processImportedProducts(data.products, onProgress, onComplete);
            } else {
                throw new Error('Invalid file format. Expected JSON array of products or object with products array.');
            }
        } catch (error) {
            console.error('Import error:', error);
            throw new Error(`Import failed: ${error.message}`);
        }
    }

    async processImportedProducts(importedProducts, onProgress, onComplete) {
        let successCount = 0;
        let errorCount = 0;
        const errors = [];

        for (let i = 0; i < importedProducts.length; i++) {
            const product = importedProducts[i];
            
            try {
                // Validate required fields
                if (!product.name || !product.type || 
                    product.quantity === undefined || product.price === undefined) {
                    throw new Error(`Missing required fields in product ${i + 1}`);
                }

                // Clean and validate data
                const cleanProduct = {
                    name: product.name.toString().trim(),
                    type: product.type.toString().trim(),
                    quantity: parseInt(product.quantity),
                    price: parseFloat(product.price),
                    cost: product.cost ? parseFloat(product.cost) : 0,
                    description: product.description ? product.description.toString().trim() : '',
                    dateSold: product.dateSold || null
                };

                // Validate numeric fields
                if (isNaN(cleanProduct.quantity) || cleanProduct.quantity < 0) {
                    throw new Error(`Invalid quantity in product ${i + 1}: ${product.quantity}`);
                }
                if (isNaN(cleanProduct.price) || cleanProduct.price < 0) {
                    throw new Error(`Invalid price in product ${i + 1}: ${product.price}`);
                }

                const result = await this.productService.createProduct(cleanProduct);
                
                if (result.success) {
                    successCount++;
                } else {
                    errorCount++;
                    errors.push(`Product ${i + 1}: ${result.message}`);
                }
            } catch (error) {
                errorCount++;
                errors.push(`Product ${i + 1}: ${error.message}`);
            }

            // Call progress callback if provided
            if (onProgress) {
                onProgress({
                    current: i + 1,
                    total: importedProducts.length,
                    successCount,
                    errorCount
                });
            }
        }

        const result = {
            successCount,
            errorCount,
            errors,
            totalProcessed: importedProducts.length
        };

        if (onComplete) {
            onComplete(result);
        }

        return result;
    }

    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }

    // Utility method to validate import file format
    validateImportFile(data) {
        if (!data) {
            throw new Error('File is empty or invalid JSON');
        }

        let products;
        if (Array.isArray(data)) {
            products = data;
        } else if (data.products && Array.isArray(data.products)) {
            products = data.products;
        } else {
            throw new Error('Invalid file format. Expected JSON array of products or object with products array.');
        }

        if (products.length === 0) {
            throw new Error('No products found in import file');
        }

        // Validate required fields in first few products
        const sampleSize = Math.min(5, products.length);
        for (let i = 0; i < sampleSize; i++) {
            const product = products[i];
            if (!product.name || !product.type || 
                product.quantity === undefined || product.price === undefined) {
                throw new Error(`Missing required fields in product ${i + 1}. Required: name, type, quantity, price`);
            }
        }

        return {
            isValid: true,
            productCount: products.length,
            sampleProduct: products[0]
        };
    }

    // Create backup before import
    async createBackup(products) {
        const backup = {
            timestamp: new Date().toISOString(),
            type: 'auto_backup_before_import',
            products: products
        };
        
        // Save to localStorage as emergency backup
        try {
            localStorage.setItem('inventory_backup_' + Date.now(), JSON.stringify(backup));
        } catch (error) {
            console.warn('Could not create localStorage backup:', error);
        }
        
        return backup;
    }

    // Restore from backup
    getAvailableBackups() {
        const backups = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('inventory_backup_')) {
                try {
                    const backup = JSON.parse(localStorage.getItem(key));
                    backups.push({
                        key,
                        timestamp: backup.timestamp,
                        type: backup.type,
                        productCount: backup.products ? backup.products.length : 0
                    });
                } catch (error) {
                    console.warn('Invalid backup found:', key);
                }
            }
        }
        return backups.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }
}
