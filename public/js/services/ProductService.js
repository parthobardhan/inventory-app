// Product Service - Handles all product-related API operations
class ProductService {
    constructor(apiBaseUrl = '/api/products') {
        this.apiBaseUrl = apiBaseUrl;
    }

    async loadProducts() {
        try {
            const response = await fetch(this.apiBaseUrl);
            const result = await response.json();
            return result;
        } catch (error) {
            console.error('Error loading products:', error);
            throw new Error('Failed to load products from API');
        }
    }

    async searchProducts(searchTerm, typeFilter) {
        try {
            const params = new URLSearchParams();
            if (searchTerm) {
                params.append('search', searchTerm);
            }
            if (typeFilter) {
                params.append('type', typeFilter);
            }

            const url = params.toString() ? `${this.apiBaseUrl}?${params.toString()}` : this.apiBaseUrl;
            const response = await fetch(url);
            const result = await response.json();
            return result;
        } catch (error) {
            console.error('Error searching products:', error);
            throw new Error('Failed to search products');
        }
    }

    async createProduct(productData) {
        try {
            const response = await fetch(this.apiBaseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(productData)
            });
            const result = await response.json();
            return result;
        } catch (error) {
            console.error('Error creating product:', error);
            throw new Error('Failed to create product');
        }
    }

    async updateProduct(id, productData) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(productData)
            });
            const result = await response.json();
            return result;
        } catch (error) {
            console.error('Error updating product:', error);
            throw new Error('Failed to update product');
        }
    }

    async deleteProduct(id) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/${id}`, {
                method: 'DELETE'
            });
            const result = await response.json();
            return result;
        } catch (error) {
            console.error('Error deleting product:', error);
            throw new Error('Failed to delete product');
        }
    }

    async uploadImage(productId, imageFile, generateAI = true) {
        try {
            const formData = new FormData();
            formData.append('image', imageFile);
            formData.append('generateAI', generateAI.toString());

            const response = await fetch(`/api/images/upload/${productId}`, {
                method: 'POST',
                body: formData
            });
            const result = await response.json();
            return result;
        } catch (error) {
            console.error('Error uploading image:', error);
            throw new Error('Failed to upload image');
        }
    }

    async loadProfitData() {
        try {
            const response = await fetch('/api/products/stats/profits');
            const result = await response.json();
            return result;
        } catch (error) {
            console.error('Error loading profit data:', error);
            throw new Error('Failed to load profit data');
        }
    }
}
