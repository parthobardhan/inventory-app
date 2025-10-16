const Product = require('../models/Product');

/**
 * Generates a unique SKU for a product
 * @param {string} productName - The name of the product
 * @returns {string} Generated SKU
 */
function generateSKU(productName) {
  // Create SKU from product name and timestamp
  const namePart = productName
    .substring(0, 3)
    .toUpperCase()
    .replace(/[^A-Z]/g, 'X');
  const timestamp = Date.now().toString().slice(-6);
  return `${namePart}-${timestamp}`;
}

/**
 * Creates a new product in the database
 * @param {Object} productData - Product data
 * @param {string} productData.name - Product name (required)
 * @param {string} [productData.sku] - Product SKU (auto-generated if not provided)
 * @param {string} productData.type - Product type (required)
 * @param {number} productData.quantity - Product quantity (required)
 * @param {number} productData.price - Product price (required)
 * @param {number} [productData.cost] - Product cost (optional, defaults to 0)
 * @param {string} [productData.description] - Product description (optional)
 * @returns {Promise<Object>} Result object with success status and data/error
 */
async function createProduct(productData) {
  try {
    const { name, sku, type, quantity, price, cost, description } = productData;

    // Validate required fields
    if (!name || !type || quantity === undefined || price === undefined) {
      return {
        success: false,
        error: 'Missing required fields: name, type, quantity, and price are required',
        code: 'VALIDATION_ERROR'
      };
    }

    // Validate data types and ranges
    if (typeof quantity !== 'number' || quantity < 0) {
      return {
        success: false,
        error: 'Quantity must be a non-negative number',
        code: 'VALIDATION_ERROR'
      };
    }

    if (typeof price !== 'number' || price < 0) {
      return {
        success: false,
        error: 'Price must be a non-negative number',
        code: 'VALIDATION_ERROR'
      };
    }

    // Generate SKU if not provided or empty
    const productSKU = (sku && sku.trim()) || generateSKU(name);
    
    console.log('[ProductService] Creating product:', { name, sku: productSKU, type, quantity, price });

    // Create product instance
    const product = new Product({
      name,
      sku: productSKU,
      type,
      quantity,
      price,
      cost: cost || 0,
      description: description || ''
    });

    // Save to database
    const savedProduct = await product.save();

    return {
      success: true,
      data: savedProduct,
      message: 'Product created successfully'
    };

  } catch (error) {
    console.error('Error creating product:', error);

    // Handle MongoDB duplicate key error (E11000) for SKU uniqueness
    if (error.code === 11000 && error.keyPattern && error.keyPattern.sku) {
      return {
        success: false,
        error: 'SKU already exists. Please choose a different SKU.',
        code: 'DUPLICATE_SKU'
      };
    }

    // Handle Mongoose validation errors
    if (error.name === 'ValidationError') {
      return {
        success: false,
        error: 'Validation error',
        code: 'VALIDATION_ERROR',
        details: Object.values(error.errors).map(err => err.message)
      };
    }

    // Generic error
    return {
      success: false,
      error: `Failed to create product: ${error.message}`,
      code: 'INTERNAL_ERROR'
    };
  }
}

/**
 * Updates an existing product's quantity
 * @param {string} productIdentifier - Product name or ID
 * @param {Object} updateData - Update data
 * @param {number} [updateData.quantity_change] - Amount to change quantity by
 * @param {number} [updateData.new_quantity] - New quantity to set
 * @returns {Promise<Object>} Result object with success status and data/error
 */
async function updateProductQuantity(productIdentifier, updateData) {
  try {
    // Search for product by name (case-insensitive, partial match) or by ID
    let product;
    
    if (productIdentifier.match(/^[0-9a-fA-F]{24}$/)) {
      // It's a MongoDB ObjectId
      product = await Product.findById(productIdentifier);
    } else {
      // Search by name
      product = await Product.findOne({
        name: { $regex: productIdentifier, $options: 'i' }
      });
    }

    if (!product) {
      // Try to find similar products
      const similarProducts = await Product.find({
        name: { $regex: productIdentifier.split(' ')[0], $options: 'i' }
      }).limit(5);

      return {
        success: false,
        error: `Product "${productIdentifier}" not found.`,
        code: 'NOT_FOUND',
        suggestions: similarProducts.map(p => p.name)
      };
    }

    const oldQuantity = product.quantity;

    if (updateData.new_quantity !== undefined) {
      product.quantity = updateData.new_quantity;
    } else if (updateData.quantity_change !== undefined) {
      product.quantity += updateData.quantity_change;
    } else {
      return {
        success: false,
        error: 'Must provide either new_quantity or quantity_change',
        code: 'VALIDATION_ERROR'
      };
    }

    if (product.quantity < 0) {
      return {
        success: false,
        error: `Cannot set quantity below 0. Current quantity is ${oldQuantity}.`,
        code: 'VALIDATION_ERROR'
      };
    }

    await product.save();

    return {
      success: true,
      data: {
        id: product._id,
        name: product.name,
        oldQuantity,
        newQuantity: product.quantity
      },
      message: `Updated "${product.name}" quantity from ${oldQuantity} to ${product.quantity}.`
    };

  } catch (error) {
    console.error('Error updating product quantity:', error);
    return {
      success: false,
      error: `Failed to update product: ${error.message}`,
      code: 'INTERNAL_ERROR'
    };
  }
}

/**
 * Gets all products with optional filtering and search
 * @param {Object} options - Query options
 * @param {string} [options.search] - Search term for name/description
 * @param {string} [options.type] - Filter by product type
 * @param {string} [options.sortBy] - Field to sort by
 * @param {string} [options.sortOrder] - Sort order (asc/desc)
 * @param {boolean} [options.lowStock] - Only show low stock products
 * @returns {Promise<Object>} Result object with products array
 */
async function getAllProducts(options = {}) {
  try {
    const { search, type, sortBy = 'dateAdded', sortOrder = 'desc', lowStock } = options;
    
    let query = {};
    
    // Search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Type filter
    if (type && type !== 'all') {
      query.type = type;
    }
    
    // Low stock filter
    if (lowStock) {
      query.quantity = { $lt: 10 };
    }
    
    // Sort
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;
    
    const products = await Product.find(query).sort(sortOptions);
    
    return {
      success: true,
      data: products,
      count: products.length
    };
  } catch (error) {
    console.error('Error getting products:', error);
    return {
      success: false,
      error: `Failed to get products: ${error.message}`,
      code: 'INTERNAL_ERROR'
    };
  }
}

/**
 * Gets a single product by ID or SKU
 * @param {string} identifier - Product ID or SKU
 * @returns {Promise<Object>} Result object with product data
 */
async function getProduct(identifier) {
  try {
    let product;
    
    // Check if it's a MongoDB ObjectId
    if (identifier.match(/^[0-9a-fA-F]{24}$/)) {
      product = await Product.findById(identifier);
    } else {
      // Try to find by SKU
      product = await Product.findOne({ sku: identifier.toUpperCase() });
    }
    
    if (!product) {
      return {
        success: false,
        error: `Product not found: ${identifier}`,
        code: 'NOT_FOUND'
      };
    }
    
    return {
      success: true,
      data: product
    };
  } catch (error) {
    console.error('Error getting product:', error);
    return {
      success: false,
      error: `Failed to get product: ${error.message}`,
      code: 'INTERNAL_ERROR'
    };
  }
}

/**
 * Updates a product's details
 * @param {string} productId - Product ID
 * @param {Object} updateData - Fields to update
 * @returns {Promise<Object>} Result object with updated product
 */
async function updateProduct(productId, updateData) {
  try {
    const product = await Product.findById(productId);
    
    if (!product) {
      return {
        success: false,
        error: 'Product not found',
        code: 'NOT_FOUND'
      };
    }
    
    // Update allowed fields
    const allowedFields = ['name', 'sku', 'type', 'quantity', 'price', 'cost', 'description'];
    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        product[field] = updateData[field];
      }
    });
    
    const updatedProduct = await product.save();
    
    return {
      success: true,
      data: updatedProduct,
      message: 'Product updated successfully'
    };
  } catch (error) {
    console.error('Error updating product:', error);
    
    if (error.code === 11000 && error.keyPattern && error.keyPattern.sku) {
      return {
        success: false,
        error: 'SKU already exists',
        code: 'DUPLICATE_SKU'
      };
    }
    
    return {
      success: false,
      error: `Failed to update product: ${error.message}`,
      code: 'INTERNAL_ERROR'
    };
  }
}

/**
 * Deletes a product
 * @param {string} productId - Product ID
 * @returns {Promise<Object>} Result object
 */
async function deleteProduct(productId) {
  try {
    const product = await Product.findByIdAndDelete(productId);
    
    if (!product) {
      return {
        success: false,
        error: 'Product not found',
        code: 'NOT_FOUND'
      };
    }
    
    return {
      success: true,
      message: 'Product deleted successfully',
      data: { id: productId, name: product.name }
    };
  } catch (error) {
    console.error('Error deleting product:', error);
    return {
      success: false,
      error: `Failed to delete product: ${error.message}`,
      code: 'INTERNAL_ERROR'
    };
  }
}

/**
 * Searches for products by various criteria
 * @param {Object} criteria - Search criteria
 * @param {string} [criteria.searchTerm] - Text to search for
 * @param {string} [criteria.type] - Product type
 * @param {boolean} [criteria.lowStock] - Only low stock items
 * @returns {Promise<Object>} Result with matching products
 */
async function searchProducts(criteria) {
  try {
    let query = {};
    
    if (criteria.searchTerm) {
      query.$or = [
        { name: { $regex: criteria.searchTerm, $options: 'i' } },
        { description: { $regex: criteria.searchTerm, $options: 'i' } },
        { sku: { $regex: criteria.searchTerm, $options: 'i' } }
      ];
    }
    
    if (criteria.type && criteria.type !== 'all') {
      query.type = criteria.type;
    }
    
    if (criteria.lowStock) {
      query.quantity = { $lt: 10 };
    }
    
    const products = await Product.find(query).limit(20);
    
    return {
      success: true,
      data: products,
      count: products.length
    };
  } catch (error) {
    console.error('Error searching products:', error);
    return {
      success: false,
      error: `Failed to search products: ${error.message}`,
      code: 'INTERNAL_ERROR'
    };
  }
}

module.exports = {
  createProduct,
  updateProduct,
  updateProductQuantity,
  deleteProduct,
  getProduct,
  getAllProducts,
  searchProducts,
  generateSKU
};

