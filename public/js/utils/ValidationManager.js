// Validation Utilities - Handles form validation and error display
class ValidationManager {
    constructor() {
        this.validationRules = {
            productName: {
                required: true,
                minLength: 2,
                message: 'Product name must be at least 2 characters long'
            },
            productType: {
                required: true,
                message: 'Please select a product type'
            },
            quantity: {
                required: true,
                type: 'number',
                min: 0,
                message: 'Quantity must be a positive number'
            },
            price: {
                required: true,
                type: 'number',
                min: 0,
                message: 'Price must be a positive number'
            },
            cost: {
                type: 'number',
                min: 0,
                message: 'Cost must be a positive number'
            }
        };
    }

    validateField(fieldId, value) {
        const rules = this.validationRules[fieldId];
        if (!rules) return { isValid: true };

        const errors = [];

        // Required field validation
        if (rules.required && (!value || value.toString().trim() === '')) {
            errors.push(rules.message || `${fieldId} is required`);
            return { isValid: false, errors };
        }

        // Skip other validations if field is empty and not required
        if (!value && !rules.required) {
            return { isValid: true };
        }

        // Type validation
        if (rules.type === 'number') {
            const numValue = parseFloat(value);
            if (isNaN(numValue)) {
                errors.push(`${fieldId} must be a valid number`);
                return { isValid: false, errors };
            }

            // Min value validation for numbers
            if (rules.min !== undefined && numValue < rules.min) {
                errors.push(rules.message || `${fieldId} must be at least ${rules.min}`);
            }

            // Max value validation for numbers
            if (rules.max !== undefined && numValue > rules.max) {
                errors.push(rules.message || `${fieldId} must be at most ${rules.max}`);
            }
        }

        // String length validation
        if (rules.minLength && value.length < rules.minLength) {
            errors.push(rules.message || `${fieldId} must be at least ${rules.minLength} characters long`);
        }

        if (rules.maxLength && value.length > rules.maxLength) {
            errors.push(rules.message || `${fieldId} must be at most ${rules.maxLength} characters long`);
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    validateModalField(fieldId) {
        const field = document.getElementById(fieldId);
        if (!field) return true;

        const validation = this.validateField(fieldId, field.value);
        
        if (!validation.isValid) {
            this.showFieldError(fieldId, validation.errors[0]);
            return false;
        } else {
            this.clearFieldError(fieldId);
            return true;
        }
    }

    showFieldError(fieldId, message) {
        const field = document.getElementById(fieldId);
        if (!field) return;

        // Add invalid class
        field.classList.add('is-invalid');

        // Create or update error message
        let errorElement = field.parentNode.querySelector('.invalid-feedback');
        if (!errorElement) {
            errorElement = document.createElement('div');
            errorElement.className = 'invalid-feedback';
            field.parentNode.appendChild(errorElement);
        }

        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }

    clearFieldError(fieldId) {
        const field = document.getElementById(fieldId);
        if (!field) return;

        field.classList.remove('is-invalid');
        const errorElement = field.parentNode.querySelector('.invalid-feedback');
        if (errorElement) {
            errorElement.style.display = 'none';
        }
    }

    validateModalForm() {
        const requiredFields = ['modalProductName', 'modalProductType', 'modalQuantity', 'modalPrice'];
        let isValid = true;

        for (const fieldId of requiredFields) {
            if (!this.validateModalField(fieldId)) {
                isValid = false;
            }
        }

        return isValid;
    }

    validateMainForm() {
        const requiredFields = ['productName', 'productType', 'quantity', 'price'];
        let isValid = true;
        const errors = [];

        for (const fieldId of requiredFields) {
            const field = document.getElementById(fieldId);
            if (!field) continue;

            const validation = this.validateField(fieldId, field.value);
            if (!validation.isValid) {
                isValid = false;
                errors.push(...validation.errors);
            }
        }

        return { isValid, errors };
    }

    setupRealTimeValidation() {
        // Setup real-time validation for modal fields
        const modalFields = ['modalProductName', 'modalProductType', 'modalQuantity', 'modalPrice'];
        
        modalFields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                field.addEventListener('blur', () => this.validateModalField(fieldId));
                field.addEventListener('input', () => {
                    // Clear error on input if field becomes valid
                    if (field.classList.contains('is-invalid')) {
                        const validation = this.validateField(fieldId, field.value);
                        if (validation.isValid) {
                            this.clearFieldError(fieldId);
                        }
                    }
                });
            }
        });
    }

    // Utility method to validate product data object
    validateProductData(productData) {
        const errors = [];
        
        Object.keys(this.validationRules).forEach(fieldKey => {
            const value = productData[fieldKey] || productData[fieldKey.replace('modal', '').toLowerCase()];
            const validation = this.validateField(fieldKey, value);
            
            if (!validation.isValid) {
                errors.push(...validation.errors);
            }
        });

        return {
            isValid: errors.length === 0,
            errors
        };
    }
}
