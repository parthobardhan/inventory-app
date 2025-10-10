// IndexedDB utility for offline data storage and synchronization
class IndexedDBManager {
    constructor() {
        this.dbName = 'TextileInventoryDB';
        this.version = 1;
        this.db = null;
        this.stores = {
            products: 'products',
            syncQueue: 'syncQueue',
            settings: 'settings'
        };
    }

    // Initialize IndexedDB
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => {
                console.error('IndexedDB error:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                console.log('IndexedDB initialized successfully');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Products store
                if (!db.objectStoreNames.contains(this.stores.products)) {
                    const productStore = db.createObjectStore(this.stores.products, { 
                        keyPath: '_id' 
                    });
                    productStore.createIndex('name', 'name', { unique: false });
                    productStore.createIndex('type', 'type', { unique: false });
                    productStore.createIndex('updatedAt', 'updatedAt', { unique: false });
                }

                // Sync queue store for offline operations
                if (!db.objectStoreNames.contains(this.stores.syncQueue)) {
                    const syncStore = db.createObjectStore(this.stores.syncQueue, { 
                        keyPath: 'id', 
                        autoIncrement: true 
                    });
                    syncStore.createIndex('operation', 'operation', { unique: false });
                    syncStore.createIndex('timestamp', 'timestamp', { unique: false });
                }

                // Settings store
                if (!db.objectStoreNames.contains(this.stores.settings)) {
                    db.createObjectStore(this.stores.settings, { keyPath: 'key' });
                }

                console.log('IndexedDB schema upgraded');
            };
        });
    }

    // Generic method to perform transactions
    async performTransaction(storeName, mode, operation) {
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], mode);
            const store = transaction.objectStore(storeName);

            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);

            try {
                const result = operation(store);
                if (result && result.onsuccess !== undefined) {
                    result.onsuccess = () => resolve(result.result);
                    result.onerror = () => reject(result.error);
                } else {
                    resolve(result);
                }
            } catch (error) {
                reject(error);
            }
        });
    }

    // Products CRUD operations
    async saveProduct(product) {
        product.updatedAt = new Date().toISOString();
        product.localId = product._id || this.generateLocalId();
        
        return this.performTransaction(this.stores.products, 'readwrite', (store) => {
            return store.put(product);
        });
    }

    async getProduct(id) {
        return this.performTransaction(this.stores.products, 'readonly', (store) => {
            return store.get(id);
        });
    }

    async getAllProducts() {
        return this.performTransaction(this.stores.products, 'readonly', (store) => {
            return new Promise((resolve, reject) => {
                const request = store.getAll();
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        });
    }

    async deleteProduct(id) {
        return this.performTransaction(this.stores.products, 'readwrite', (store) => {
            return store.delete(id);
        });
    }

    async searchProducts(query) {
        const products = await this.getAllProducts();
        const searchTerm = query.toLowerCase();
        
        return products.filter(product => 
            product.name.toLowerCase().includes(searchTerm) ||
            product.description.toLowerCase().includes(searchTerm) ||
            product.type.toLowerCase().includes(searchTerm)
        );
    }

    async getProductsByType(type) {
        return this.performTransaction(this.stores.products, 'readonly', (store) => {
            return new Promise((resolve, reject) => {
                const index = store.index('type');
                const request = index.getAll(type);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        });
    }

    // Sync queue operations for offline functionality
    async addToSyncQueue(operation, data) {
        const syncItem = {
            operation, // 'create', 'update', 'delete'
            data,
            timestamp: new Date().toISOString(),
            retryCount: 0,
            maxRetries: 3
        };

        return this.performTransaction(this.stores.syncQueue, 'readwrite', (store) => {
            return store.add(syncItem);
        });
    }

    async getSyncQueue() {
        return this.performTransaction(this.stores.syncQueue, 'readonly', (store) => {
            return new Promise((resolve, reject) => {
                const request = store.getAll();
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        });
    }

    async removeSyncItem(id) {
        return this.performTransaction(this.stores.syncQueue, 'readwrite', (store) => {
            return store.delete(id);
        });
    }

    async updateSyncItem(id, updates) {
        return this.performTransaction(this.stores.syncQueue, 'readwrite', (store) => {
            return new Promise((resolve, reject) => {
                const getRequest = store.get(id);
                getRequest.onsuccess = () => {
                    const item = getRequest.result;
                    if (item) {
                        Object.assign(item, updates);
                        const putRequest = store.put(item);
                        putRequest.onsuccess = () => resolve(item);
                        putRequest.onerror = () => reject(putRequest.error);
                    } else {
                        reject(new Error('Sync item not found'));
                    }
                };
                getRequest.onerror = () => reject(getRequest.error);
            });
        });
    }

    // Settings operations
    async saveSetting(key, value) {
        const setting = { key, value, updatedAt: new Date().toISOString() };
        return this.performTransaction(this.stores.settings, 'readwrite', (store) => {
            return store.put(setting);
        });
    }

    async getSetting(key) {
        const result = await this.performTransaction(this.stores.settings, 'readonly', (store) => {
            return new Promise((resolve, reject) => {
                const request = store.get(key);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        });
        return result ? result.value : null;
    }

    // Utility methods
    generateLocalId() {
        return 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    async clearAllData() {
        const storeNames = Object.values(this.stores);
        for (const storeName of storeNames) {
            await this.performTransaction(storeName, 'readwrite', (store) => {
                return store.clear();
            });
        }
    }

    async getStorageUsage() {
        if ('storage' in navigator && 'estimate' in navigator.storage) {
            return await navigator.storage.estimate();
        }
        return null;
    }

    // Export/Import functionality for data backup
    async exportData() {
        const products = await this.getAllProducts();
        const syncQueue = await this.getSyncQueue();
        
        return {
            products,
            syncQueue,
            exportDate: new Date().toISOString(),
            version: this.version
        };
    }

    async importData(data) {
        if (!data.products) {
            throw new Error('Invalid data format');
        }

        // Clear existing data
        await this.performTransaction(this.stores.products, 'readwrite', (store) => {
            return store.clear();
        });

        // Import products
        for (const product of data.products) {
            await this.saveProduct(product);
        }

        // Import sync queue if available
        if (data.syncQueue) {
            await this.performTransaction(this.stores.syncQueue, 'readwrite', (store) => {
                return store.clear();
            });

            for (const item of data.syncQueue) {
                await this.performTransaction(this.stores.syncQueue, 'readwrite', (store) => {
                    return store.add(item);
                });
            }
        }

        return true;
    }

    // Database health check
    async healthCheck() {
        try {
            const products = await this.getAllProducts();
            const syncQueue = await this.getSyncQueue();
            const usage = await this.getStorageUsage();

            return {
                status: 'healthy',
                productCount: products.length,
                syncQueueLength: syncQueue.length,
                storageUsage: usage,
                lastCheck: new Date().toISOString()
            };
        } catch (error) {
            return {
                status: 'error',
                error: error.message,
                lastCheck: new Date().toISOString()
            };
        }
    }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = IndexedDBManager;
} else {
    window.IndexedDBManager = IndexedDBManager;
}
