// Cost Breakdown Manager - Handles dynamic cost itemization in the add product modal
class CostBreakdownManager {
    constructor() {
        this.costItemCounter = 0;
        this.availableCategories = {
            'cushion-covers': ['Making Charge'],
            'bed-covers': ['End Stitching', 'Printing'],
            'sarees': ['Printing'],
            'towels': []
        };
        this.userModifiedTotal = false; // Track if user manually changed total
        this.init();
    }

    init() {
        console.log('🧮 Initializing CostBreakdownManager...');
        this.bindEvents();
        this.updateTotalCost();
        console.log('✅ CostBreakdownManager initialized');
    }

    bindEvents() {
        // Add cost item button
        const addBtn = document.getElementById('modalAddCostItemBtn');
        if (addBtn) {
            addBtn.addEventListener('click', () => this.addCostItem());
        }

        // Listen to cost field changes
        document.addEventListener('input', (e) => {
            if (e.target.classList.contains('cost-breakdown-item')) {
                this.updateTotalCost();
            }
            // Listen to manual total cost changes
            if (e.target.id === 'modalTotalCost') {
                this.userModifiedTotal = true;
                this.checkCostMismatch();
            }
        });

        // Listen to product type changes to suggest relevant cost categories
        const productTypeSelect = document.getElementById('modalProductType');
        if (productTypeSelect) {
            productTypeSelect.addEventListener('change', (e) => {
                this.updateCategorySuggestions(e.target.value);
            });
        }

        // Clear cost breakdown when modal closes
        const modal = document.getElementById('addProductModal');
        if (modal) {
            modal.addEventListener('hidden.bs.modal', () => {
                this.clearCostBreakdown();
            });
        }
    }

    addCostItem(category = '', amount = 0) {
        const container = document.getElementById('modalAdditionalCosts');
        if (!container) return;

        this.costItemCounter++;
        const itemId = `costItem${this.costItemCounter}`;

        const itemHtml = `
            <div class="row mb-2 align-items-end cost-item" id="${itemId}">
                <div class="col-md-5">
                    <label class="form-label small">Category</label>
                    <input type="text" class="form-control form-control-sm cost-category-input" 
                           data-item-id="${itemId}" 
                           placeholder="Enter category..."
                           value="${category}"
                           list="categoryList${itemId}">
                    <datalist id="categoryList${itemId}">
                        <option value="Making Charge">
                        <option value="End Stitching">
                        <option value="Printing">
                        <option value="Packaging">
                        <option value="Shipping">
                        <option value="Labor">
                        <option value="Other">
                    </datalist>
                </div>
                <div class="col-md-5">
                    <label class="form-label small">Amount ($)</label>
                    <input type="number" class="form-control form-control-sm cost-breakdown-item" 
                           data-category-dynamic="${itemId}" min="0" step="0.01" value="${amount}" 
                           placeholder="0.00">
                </div>
                <div class="col-md-2">
                    <button type="button" class="btn btn-sm btn-outline-danger w-100" 
                            onclick="window.costBreakdownManager.removeCostItem('${itemId}')">
                        <i class="fas fa-minus"></i>
                    </button>
                </div>
            </div>
        `;

        container.insertAdjacentHTML('beforeend', itemHtml);
        this.updateTotalCost();
    }

    removeCostItem(itemId) {
        const item = document.getElementById(itemId);
        if (item) {
            item.remove();
            this.updateTotalCost();
        }
    }

    updateCategorySuggestions(productType) {
        // Clear existing additional cost items
        const container = document.getElementById('modalAdditionalCosts');
        if (container) {
            container.innerHTML = '';
        }

        // Add suggested categories based on product type
        const suggestedCategories = this.availableCategories[productType] || [];
        suggestedCategories.forEach(category => {
            this.addCostItem(category, 0);
        });
    }

    updateTotalCost() {
        const costInputs = document.querySelectorAll('.cost-breakdown-item');
        let total = 0;

        costInputs.forEach(input => {
            const value = parseFloat(input.value) || 0;
            total += value;
        });

        const totalInput = document.getElementById('modalTotalCost');
        
        // Only auto-update if user hasn't manually modified it
        if (totalInput && !this.userModifiedTotal) {
            totalInput.value = total.toFixed(2);
        }

        // Check for cost mismatch after updating calculated total
        this.checkCostMismatch();

        return total;
    }

    checkCostMismatch() {
        const calculatedTotal = this.getCalculatedTotal();
        const totalInput = document.getElementById('modalTotalCost');
        const warningDiv = document.getElementById('modalCostMismatchWarning');
        
        if (!totalInput || !warningDiv) return;

        const enteredTotal = parseFloat(totalInput.value);
        
        // If total is not entered or is empty, hide warning
        if (!enteredTotal || totalInput.value === '') {
            warningDiv.style.display = 'none';
            return;
        }

        // Check if there's a mismatch (allowing for small floating point differences)
        const tolerance = 0.01;
        if (Math.abs(enteredTotal - calculatedTotal) > tolerance) {
            // Show warning
            warningDiv.style.display = 'block';
            document.getElementById('warningManualCost').textContent = `$${enteredTotal.toFixed(2)}`;
            document.getElementById('warningCalculatedCost').textContent = `$${calculatedTotal.toFixed(2)}`;
        } else {
            // Hide warning if they match
            warningDiv.style.display = 'none';
        }
    }

    getCalculatedTotal() {
        const costInputs = document.querySelectorAll('.cost-breakdown-item');
        let total = 0;

        costInputs.forEach(input => {
            const value = parseFloat(input.value) || 0;
            total += value;
        });

        return total;
    }

    getCostBreakdown() {
        const breakdown = [];

        // Get Material cost
        const materialInput = document.getElementById('modalCostMaterial');
        if (materialInput && parseFloat(materialInput.value) > 0) {
            breakdown.push({
                category: 'Material',
                amount: parseFloat(materialInput.value)
            });
        }

        // Get Embroidery cost
        const embroideryInput = document.getElementById('modalCostEmbroidery');
        if (embroideryInput && parseFloat(embroideryInput.value) > 0) {
            breakdown.push({
                category: 'Embroidery',
                amount: parseFloat(embroideryInput.value)
            });
        }

        // Get dynamic cost items
        const costItems = document.querySelectorAll('.cost-item');
        costItems.forEach(item => {
            const categoryInput = item.querySelector('.cost-category-input');
            const amountInput = item.querySelector('.cost-breakdown-item');
            
            if (categoryInput && amountInput && categoryInput.value.trim() && parseFloat(amountInput.value) > 0) {
                breakdown.push({
                    category: categoryInput.value.trim(),
                    amount: parseFloat(amountInput.value)
                });
            }
        });

        return breakdown;
    }

    setCostBreakdown(breakdown) {
        // Clear existing
        this.clearCostBreakdown();

        if (!breakdown || breakdown.length === 0) return;

        // Set fixed fields
        breakdown.forEach(item => {
            if (item.category === 'Material') {
                const materialInput = document.getElementById('modalCostMaterial');
                if (materialInput) materialInput.value = item.amount;
            } else if (item.category === 'Embroidery') {
                const embroideryInput = document.getElementById('modalCostEmbroidery');
                if (embroideryInput) embroideryInput.value = item.amount;
            } else {
                // Add as dynamic item
                this.addCostItem(item.category, item.amount);
            }
        });

        this.updateTotalCost();
    }

    clearCostBreakdown() {
        // Reset fixed fields
        const materialInput = document.getElementById('modalCostMaterial');
        const embroideryInput = document.getElementById('modalCostEmbroidery');
        const totalInput = document.getElementById('modalTotalCost');
        
        if (materialInput) materialInput.value = '0';
        if (embroideryInput) embroideryInput.value = '0';
        if (totalInput) totalInput.value = '';

        // Clear dynamic items
        const container = document.getElementById('modalAdditionalCosts');
        if (container) {
            container.innerHTML = '';
        }

        // Hide warning
        const warningDiv = document.getElementById('modalCostMismatchWarning');
        if (warningDiv) {
            warningDiv.style.display = 'none';
        }

        this.costItemCounter = 0;
        this.userModifiedTotal = false;
        this.updateTotalCost();
    }

    getTotalCost() {
        // Return the value from the total cost input
        const totalInput = document.getElementById('modalTotalCost');
        if (totalInput && totalInput.value) {
            return parseFloat(totalInput.value) || 0;
        }
        return 0;
    }
}

