// Global state
let allProducts = [];
let filteredProducts = [];
let currentFilters = {
    size: [],
    color: [],
    material: []
};
let currentSort = 'bestselling';

// API endpoints
const API_BASE = '/api';

// DOM elements
const loadingState = document.getElementById('loadingState');
const productsGrid = document.getElementById('productsGrid');
const emptyState = document.getElementById('emptyState');
const resultsCount = document.getElementById('resultsCount');
const sortSelect = document.getElementById('sortBy');

// Mobile elements
const mobileFilterBtn = document.getElementById('mobileFilterBtn');
const mobileFilterModal = document.getElementById('mobileFilterModal');
const closeMobileModal = document.getElementById('closeMobileModal');

// Filter elements
const filtersSidebar = document.getElementById('filtersSidebar');
const closeFilters = document.getElementById('closeFilters');

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
    loadProducts();
});

// Event listeners
function initializeEventListeners() {
    // Sort functionality
    sortSelect.addEventListener('change', handleSortChange);
    
    // Desktop filter close
    closeFilters.addEventListener('click', toggleFilters);
    
    // Mobile filter modal
    mobileFilterBtn.addEventListener('click', openMobileModal);
    closeMobileModal.addEventListener('click', closeMobileFilterModal);
    
    // Filter change listeners
    document.querySelectorAll('input[name="size"]').forEach(input => {
        input.addEventListener('change', handleFilterChange);
    });
    document.querySelectorAll('input[name="color"]').forEach(input => {
        input.addEventListener('change', handleFilterChange);
    });
    document.querySelectorAll('input[name="material"]').forEach(input => {
        input.addEventListener('change', handleFilterChange);
    });
    
    // Mobile filter change listeners
    document.querySelectorAll('input[name="mobileSize"]').forEach(input => {
        input.addEventListener('change', handleMobileFilterChange);
    });
    document.querySelectorAll('input[name="mobileColor"]').forEach(input => {
        input.addEventListener('change', handleMobileFilterChange);
    });
    document.querySelectorAll('input[name="mobileMaterial"]').forEach(input => {
        input.addEventListener('change', handleMobileFilterChange);
    });
    document.querySelectorAll('input[name="mobileSort"]').forEach(input => {
        input.addEventListener('change', handleMobileSortChange);
    });
    
    // Filter action buttons
    document.getElementById('clearFilters').addEventListener('click', clearAllFilters);
    document.getElementById('applyFilters').addEventListener('click', applyFilters);
    document.getElementById('clearMobileFilters').addEventListener('click', clearAllMobileFilters);
    document.getElementById('applyMobileFilters').addEventListener('click', applyMobileFilters);
    
    // Close mobile modal when clicking outside
    mobileFilterModal.addEventListener('click', function(e) {
        if (e.target === mobileFilterModal) {
            closeMobileFilterModal();
        }
    });
    
    // Quick view modal event listeners
    const quickViewModal = document.getElementById('quickViewModal');
    const modalClose = document.getElementById('modalClose');
    const modalClose2 = document.getElementById('modalClose2');
    const modalOverlay = document.getElementById('modalOverlay');
    
    if (modalClose) {
        modalClose.addEventListener('click', closeQuickViewModal);
    }
    if (modalClose2) {
        modalClose2.addEventListener('click', closeQuickViewModal);
    }
    if (modalOverlay) {
        modalOverlay.addEventListener('click', closeQuickViewModal);
    }
    
    // Close modal with Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && quickViewModal.style.display === 'flex') {
            closeQuickViewModal();
        }
    });
}

// Load products from API
async function loadProducts() {
    try {
        showLoading();
        
        const response = await fetch(`${API_BASE}/products?type=cushion-covers`);
        const data = await response.json();
        
        if (data.success) {
            allProducts = data.data;
            filteredProducts = [...allProducts];
            
            // Debug: Check for quotes in API data
            allProducts.forEach(product => {
                if (product.description && (product.description.startsWith('"') || product.description.startsWith("'"))) {
                    console.log('Found quotes in API product:', product.name, product.description);
                }
            });
            
            // If no products found, show sample products for demo
            if (allProducts.length === 0) {
                allProducts = generateSampleProducts();
                filteredProducts = [...allProducts];
            }
            
            applyCurrentSort();
            renderProducts();
            updateResultsCount();
        } else {
            throw new Error(data.message || 'Failed to load products');
        }
    } catch (error) {
        console.error('Error loading products:', error);
        
        // Show sample products for demo purposes
        allProducts = generateSampleProducts();
        filteredProducts = [...allProducts];
        applyCurrentSort();
        renderProducts();
        updateResultsCount();
    } finally {
        hideLoading();
    }
}

// Generate sample products for demo
function generateSampleProducts() {
    return [
        {
            _id: 'sample-1',
            name: 'Velvet Luxury Cushion Cover',
            description: 'Plush velvet cushion cover with rich texture and elegant drape. Perfect for adding luxury to any space.',
            price: 24.99,
            type: 'cushion-covers',
            quantity: 18,
            images: [],
            sampleData: {
                size: 'medium',
                color: 'navy',
                material: 'velvet'
            }
        },
        {
            _id: 'sample-2',
            name: 'Cotton Blend Geometric Cover',
            description: 'Modern geometric pattern on soft cotton blend fabric. Machine-washable and fade-resistant.',
            price: 19.99,
            type: 'cushion-covers',
            quantity: 25,
            images: [],
            sampleData: {
                size: 'small',
                color: 'white',
                material: 'cotton'
            }
        },
        {
            _id: 'sample-3',
            name: 'Linen Textured Cushion Cover',
            description: 'Natural linen with beautiful texture and breathable comfort. Pre-washed for softness.',
            price: 29.99,
            type: 'cushion-covers',
            quantity: 12,
            images: [],
            sampleData: {
                size: 'large',
                color: 'beige',
                material: 'linen'
            }
        },
        {
            _id: 'sample-4',
            name: 'Embroidered Boho Cover',
            description: 'Hand-embroidered boho design on premium cotton. Unique patterns and artisanal craftsmanship.',
            price: 34.99,
            type: 'cushion-covers',
            quantity: 8,
            images: [],
            sampleData: {
                size: 'medium',
                color: 'coral',
                material: 'cotton'
            }
        },
        {
            _id: 'sample-5',
            name: 'Sage Green Velvet Cover',
            description: 'Rich sage green velvet with subtle sheen. Adds sophistication to modern and traditional spaces.',
            price: 27.99,
            type: 'cushion-covers',
            quantity: 15,
            images: [],
            sampleData: {
                size: 'rectangular',
                color: 'sage',
                material: 'velvet'
            }
        },
        {
            _id: 'sample-6',
            name: 'Teal Linen Blend Cover',
            description: 'Vibrant teal color on linen blend fabric. Perfect for coastal and contemporary home styles.',
            price: 22.99,
            type: 'cushion-covers',
            quantity: 20,
            images: [],
            sampleData: {
                size: 'large',
                color: 'teal',
                material: 'blend'
            }
        },
        {
            _id: 'sample-7',
            name: 'Mustard Yellow Cotton Cover',
            description: 'Cheerful mustard yellow cotton cover with subtle texture. Brightens any room instantly.',
            price: 21.99,
            type: 'cushion-covers',
            quantity: 14,
            images: [],
            sampleData: {
                size: 'medium',
                color: 'mustard',
                material: 'cotton'
            }
        },
        {
            _id: 'sample-8',
            name: 'Gray Herringbone Linen Cover',
            description: 'Classic herringbone pattern in soft gray linen. Timeless design with modern appeal.',
            price: 26.99,
            type: 'cushion-covers',
            quantity: 16,
            images: [],
            sampleData: {
                size: 'small',
                color: 'gray',
                material: 'linen'
            }
        }
    ];
}

// Render products in the grid
function renderProducts() {
    if (filteredProducts.length === 0) {
        showEmptyState();
        return;
    }
    
    hideEmptyState();
    
    const productsHTML = filteredProducts.map(product => createProductCard(product)).join('');
    productsGrid.innerHTML = productsHTML;
    
    // Add event listeners to product cards
    addProductEventListeners();
}

// Create individual product card HTML
function createProductCard(product) {
    const imageUrl = product.images && product.images.length > 0 
        ? product.images[0].url 
        : null;
    
    const imageHTML = imageUrl 
        ? `<img src="${imageUrl}" alt="${product.name}" loading="lazy">`
        : `<div class="product-image-placeholder"><span>Cushion Cover</span></div>`;
    
    return `
        <div class="product-card" data-product-id="${product._id}">
            <div class="product-image">
                ${imageHTML}
            </div>
            <div class="product-info">
                <h3 class="product-name">${product.name}</h3>
                <p class="product-description">${(product.description || 'Premium cushion cover crafted for comfort and style.').replace(/^["']|["']$/g, '')}</p>
                <div class="product-price">$${product.price.toFixed(2)}</div>
                <div class="product-actions">
                    <button class="btn btn-primary add-to-cart" data-product-id="${product._id}">
                        Quick View
                    </button>
                    <button class="btn btn-outline view-details" data-product-id="${product._id}">
                        Add to Cart
                    </button>
                </div>
            </div>
        </div>
    `;
}

// Add event listeners to product cards
function addProductEventListeners() {
    // Quick view buttons
    document.querySelectorAll('.add-to-cart').forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            const productId = this.getAttribute('data-product-id');
            handleQuickView(productId);
        });
    });
    
    // Add to cart buttons
    document.querySelectorAll('.view-details').forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            const productId = this.getAttribute('data-product-id');
            handleAddToCart(productId);
        });
    });
    
    // Product images - click to open quick view
    document.querySelectorAll('.product-image').forEach(imageContainer => {
        imageContainer.addEventListener('click', function(e) {
            e.preventDefault();
            const productCard = this.closest('.product-card');
            const productId = productCard.getAttribute('data-product-id');
            handleQuickView(productId);
        });
        
        // Add cursor pointer to indicate clickability
        imageContainer.style.cursor = 'pointer';
    });
}

// Handle quick view
function handleQuickView(productId) {
    const product = allProducts.find(p => p._id === productId);
    if (product) {
        showQuickViewModal(product);
    }
}

// Show quick view modal
function showQuickViewModal(product) {
    const modal = document.getElementById('quickViewModal');
    const modalProductName = document.getElementById('modalProductName');
    const modalProductImage = document.getElementById('modalProductImage');
    const modalProductPrice = document.getElementById('modalProductPrice');
    const modalProductDescription = document.getElementById('modalProductDescription');
    const modalAddToCart = document.getElementById('modalAddToCart');
    
    // Set product details
    modalProductName.textContent = product.name;
    modalProductPrice.textContent = `$${product.price.toFixed(2)}`;
    
    // Clean description of any quotes
    let description = product.description || 'Premium cushion cover crafted for comfort and style. Machine-washable and designed to last.';
    // Remove quotes from beginning and end if they exist
    description = description.replace(/^["']|["']$/g, '');
    modalProductDescription.textContent = description;
    
    // Set product image
    const modalImageContainer = document.querySelector('.modal-image');
    if (product.images && product.images.length > 0) {
        modalProductImage.src = product.images[0].url;
        modalProductImage.alt = product.name;
        modalProductImage.style.display = 'block';
        // Remove any existing placeholder
        const existingPlaceholder = modalImageContainer.querySelector('.modal-image-placeholder');
        if (existingPlaceholder) {
            existingPlaceholder.remove();
        }
    } else {
        // Show placeholder for products without images
        modalProductImage.style.display = 'none';
        let placeholder = modalImageContainer.querySelector('.modal-image-placeholder');
        if (!placeholder) {
            placeholder = document.createElement('div');
            placeholder.className = 'modal-image-placeholder';
            placeholder.textContent = 'Cushion Cover Image';
            modalImageContainer.appendChild(placeholder);
        }
    }
    
    // Set up add to cart button
    modalAddToCart.onclick = () => {
        handleAddToCart(product._id);
        closeQuickViewModal();
    };
    
    // Show modal
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

// Close quick view modal
function closeQuickViewModal() {
    const modal = document.getElementById('quickViewModal');
    modal.style.display = 'none';
    document.body.style.overflow = '';
}

// Handle add to cart
function handleAddToCart(productId) {
    const product = allProducts.find(p => p._id === productId);
    if (product) {
        // Visual feedback
        const button = document.querySelector(`[data-product-id="${productId}"].view-details`);
        const originalText = button.textContent;
        button.textContent = 'Added!';
        button.style.backgroundColor = '#28a745';
        button.style.borderColor = '#28a745';
        button.style.color = '#fff';
        
        setTimeout(() => {
            button.textContent = originalText;
            button.style.backgroundColor = '';
            button.style.borderColor = '';
            button.style.color = '';
        }, 2000);
        
        console.log('Added to cart:', product.name);
    }
}

// Filter and sort functionality
function handleFilterChange() {
    updateCurrentFilters();
    applyFilters();
}

function handleMobileFilterChange() {
    // Mobile filters will be applied when "Apply" is clicked
}

function handleSortChange() {
    currentSort = sortSelect.value;
    applyCurrentSort();
    renderProducts();
    updateResultsCount();
}

function handleMobileSortChange() {
    // Mobile sort will be applied when "Apply" is clicked
}

function updateCurrentFilters() {
    currentFilters.size = Array.from(document.querySelectorAll('input[name="size"]:checked')).map(input => input.value);
    currentFilters.color = Array.from(document.querySelectorAll('input[name="color"]:checked')).map(input => input.value);
    currentFilters.material = Array.from(document.querySelectorAll('input[name="material"]:checked')).map(input => input.value);
}

function applyFilters() {
    updateCurrentFilters();
    
    filteredProducts = allProducts.filter(product => {
        // For sample products, use sampleData for filtering
        const productData = product.sampleData || {};
        
        // Size filter
        if (currentFilters.size.length > 0 && !currentFilters.size.includes(productData.size)) {
            return false;
        }
        
        // Color filter
        if (currentFilters.color.length > 0 && !currentFilters.color.includes(productData.color)) {
            return false;
        }
        
        // Material filter
        if (currentFilters.material.length > 0 && !currentFilters.material.includes(productData.material)) {
            return false;
        }
        
        return true;
    });
    
    applyCurrentSort();
    renderProducts();
    updateResultsCount();
}

function applyCurrentSort() {
    filteredProducts.sort((a, b) => {
        switch (currentSort) {
            case 'price-asc':
                return a.price - b.price;
            case 'price-desc':
                return b.price - a.price;
            case 'dateAdded':
                return new Date(b.dateAdded || Date.now()) - new Date(a.dateAdded || Date.now());
            case 'bestselling':
            default:
                // For demo, sort by quantity (assuming higher quantity = more popular)
                return b.quantity - a.quantity;
        }
    });
}

function clearAllFilters() {
    // Clear desktop filters
    document.querySelectorAll('input[name="size"], input[name="color"], input[name="material"]').forEach(input => {
        input.checked = false;
    });
    
    currentFilters = { size: [], color: [], material: [] };
    applyFilters();
}

function clearAllMobileFilters() {
    // Clear mobile filters
    document.querySelectorAll('input[name="mobileSize"], input[name="mobileColor"], input[name="mobileMaterial"]').forEach(input => {
        input.checked = false;
    });
    
    // Reset mobile sort
    document.querySelector('input[name="mobileSort"][value="bestselling"]').checked = true;
}

function applyMobileFilters() {
    // Apply mobile sort
    const selectedSort = document.querySelector('input[name="mobileSort"]:checked');
    if (selectedSort) {
        currentSort = selectedSort.value;
        sortSelect.value = currentSort;
    }
    
    // Apply mobile filters to desktop
    const mobileSize = Array.from(document.querySelectorAll('input[name="mobileSize"]:checked')).map(input => input.value);
    const mobileColor = Array.from(document.querySelectorAll('input[name="mobileColor"]:checked')).map(input => input.value);
    const mobileMaterial = Array.from(document.querySelectorAll('input[name="mobileMaterial"]:checked')).map(input => input.value);
    
    // Sync with desktop filters
    document.querySelectorAll('input[name="size"]').forEach(input => {
        input.checked = mobileSize.includes(input.value);
    });
    document.querySelectorAll('input[name="color"]').forEach(input => {
        input.checked = mobileColor.includes(input.value);
    });
    document.querySelectorAll('input[name="material"]').forEach(input => {
        input.checked = mobileMaterial.includes(input.value);
    });
    
    applyFilters();
    closeMobileFilterModal();
}

// UI state management
function showLoading() {
    loadingState.style.display = 'block';
    productsGrid.style.display = 'none';
    emptyState.style.display = 'none';
}

function hideLoading() {
    loadingState.style.display = 'none';
    productsGrid.style.display = 'grid';
}

function showEmptyState() {
    productsGrid.style.display = 'none';
    emptyState.style.display = 'block';
}

function hideEmptyState() {
    emptyState.style.display = 'none';
    productsGrid.style.display = 'grid';
}

function updateResultsCount() {
    const count = filteredProducts.length;
    const total = allProducts.length;
    
    if (count === total) {
        resultsCount.textContent = `Showing all ${count} cushion covers`;
    } else {
        resultsCount.textContent = `Showing ${count} of ${total} cushion covers`;
    }
}

// Mobile modal functionality
function openMobileModal() {
    // Sync mobile filters with desktop filters
    syncMobileFilters();
    mobileFilterModal.style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function closeMobileFilterModal() {
    mobileFilterModal.style.display = 'none';
    document.body.style.overflow = '';
}

function syncMobileFilters() {
    // Sync size filters
    document.querySelectorAll('input[name="size"]').forEach(input => {
        const mobileInput = document.querySelector(`input[name="mobileSize"][value="${input.value}"]`);
        if (mobileInput) {
            mobileInput.checked = input.checked;
        }
    });
    
    // Sync color filters
    document.querySelectorAll('input[name="color"]').forEach(input => {
        const mobileInput = document.querySelector(`input[name="mobileColor"][value="${input.value}"]`);
        if (mobileInput) {
            mobileInput.checked = input.checked;
        }
    });
    
    // Sync material filters
    document.querySelectorAll('input[name="material"]').forEach(input => {
        const mobileInput = document.querySelector(`input[name="mobileMaterial"][value="${input.value}"]`);
        if (mobileInput) {
            mobileInput.checked = input.checked;
        }
    });
    
    // Sync sort
    const mobileSortInput = document.querySelector(`input[name="mobileSort"][value="${currentSort}"]`);
    if (mobileSortInput) {
        mobileSortInput.checked = true;
    }
}

// Desktop filter sidebar toggle
function toggleFilters() {
    filtersSidebar.classList.toggle('active');
    
    if (window.innerWidth <= 768) {
        document.body.style.overflow = filtersSidebar.classList.contains('active') ? 'hidden' : '';
    }
}

// Global function for clearing filters (used in empty state)
window.clearAllFilters = clearAllFilters;

// Handle window resize
window.addEventListener('resize', function() {
    if (window.innerWidth > 768) {
        filtersSidebar.classList.remove('active');
        document.body.style.overflow = '';
    }
});

// Add smooth scrolling for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});
