const Product = require('../models/Product');
const Sale = require('../models/Sale');
const mongoose = require('mongoose');

/**
 * Records a sale and updates product quantity
 * @param {Object} saleData - Sale data
 * @param {string} saleData.productId - Product ID
 * @param {string} saleData.sku - Product SKU
 * @param {number} saleData.quantity - Quantity sold
 * @param {number} saleData.sellPrice - Sale price per unit
 * @param {Date} [saleData.dateSold] - Date of sale (defaults to now)
 * @returns {Promise<Object>} Result object with sale data
 */
async function recordSale(saleData) {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { productId, sku, quantity, sellPrice, dateSold } = saleData;
    
    // Validate required fields
    if (!productId || !sku || !quantity || !sellPrice) {
      await session.abortTransaction();
      return {
        success: false,
        error: 'Missing required fields: productId, sku, quantity, and sellPrice are required',
        code: 'VALIDATION_ERROR'
      };
    }
    
    // Validate quantity
    if (quantity < 1 || !Number.isInteger(quantity)) {
      await session.abortTransaction();
      return {
        success: false,
        error: 'Quantity must be a positive integer',
        code: 'VALIDATION_ERROR'
      };
    }
    
    // Validate sellPrice
    if (sellPrice <= 0) {
      await session.abortTransaction();
      return {
        success: false,
        error: 'Sell price must be greater than 0',
        code: 'VALIDATION_ERROR'
      };
    }
    
    // Find the product
    const product = await Product.findById(productId).session(session);
    
    if (!product) {
      await session.abortTransaction();
      return {
        success: false,
        error: 'Product not found',
        code: 'NOT_FOUND'
      };
    }
    
    // Verify SKU matches
    const normalizedSku = sku.toUpperCase().trim();
    const normalizedProductSku = product.sku.toUpperCase().trim();
    
    if (normalizedProductSku !== normalizedSku) {
      await session.abortTransaction();
      return {
        success: false,
        error: `SKU mismatch. Expected "${normalizedProductSku}" but received "${normalizedSku}"`,
        code: 'VALIDATION_ERROR'
      };
    }
    
    // Check if enough quantity available
    if (product.quantity < quantity) {
      await session.abortTransaction();
      return {
        success: false,
        error: `Insufficient quantity. Available: ${product.quantity}, Requested: ${quantity}`,
        code: 'INSUFFICIENT_STOCK'
      };
    }
    
    // Create sale record
    const sale = new Sale({
      productId: product._id,
      sku: product.sku,
      quantity: quantity,
      sellPrice: sellPrice,
      cost: product.cost || 0,
      dateSold: dateSold || new Date()
    });
    
    await sale.save({ session });
    
    // Update product quantity
    product.quantity -= quantity;
    await product.save({ session });
    
    // Commit transaction
    await session.commitTransaction();
    
    return {
      success: true,
      data: {
        sale: sale,
        product: {
          id: product._id,
          name: product.name,
          remainingQuantity: product.quantity
        }
      },
      message: `Sale recorded successfully. ${quantity} units of "${product.name}" sold.`
    };
    
  } catch (error) {
    await session.abortTransaction();
    console.error('Error recording sale:', error);
    return {
      success: false,
      error: `Failed to record sale: ${error.message}`,
      code: 'INTERNAL_ERROR'
    };
  } finally {
    session.endSession();
  }
}

/**
 * Gets sale records with optional filtering
 * @param {Object} options - Query options
 * @param {string} [options.productId] - Filter by product ID
 * @param {string} [options.sku] - Filter by SKU
 * @param {Date} [options.startDate] - Start date for date range
 * @param {Date} [options.endDate] - End date for date range
 * @param {number} [options.limit] - Maximum number of results
 * @returns {Promise<Object>} Result with sales array
 */
async function getSales(options = {}) {
  try {
    const { productId, sku, startDate, endDate, limit = 100 } = options;
    
    let query = {};
    
    // Filter by product ID
    if (productId) {
      query.productId = productId;
    }
    
    // Filter by SKU
    if (sku) {
      query.sku = sku.toUpperCase();
    }
    
    // Filter by date range
    if (startDate || endDate) {
      query.dateSold = {};
      if (startDate) query.dateSold.$gte = new Date(startDate);
      if (endDate) query.dateSold.$lte = new Date(endDate);
    }
    
    const sales = await Sale.find(query)
      .sort({ dateSold: -1 })
      .limit(limit)
      .populate('productId', 'name type');
    
    return {
      success: true,
      data: sales,
      count: sales.length
    };
  } catch (error) {
    console.error('Error getting sales:', error);
    return {
      success: false,
      error: `Failed to get sales: ${error.message}`,
      code: 'INTERNAL_ERROR'
    };
  }
}

/**
 * Gets a single sale by ID
 * @param {string} saleId - Sale ID
 * @returns {Promise<Object>} Result with sale data
 */
async function getSale(saleId) {
  try {
    const sale = await Sale.findById(saleId).populate('productId', 'name type sku');
    
    if (!sale) {
      return {
        success: false,
        error: 'Sale not found',
        code: 'NOT_FOUND'
      };
    }
    
    return {
      success: true,
      data: sale
    };
  } catch (error) {
    console.error('Error getting sale:', error);
    return {
      success: false,
      error: `Failed to get sale: ${error.message}`,
      code: 'INTERNAL_ERROR'
    };
  }
}

/**
 * Gets recent sales (last N sales)
 * @param {number} limit - Number of sales to retrieve
 * @returns {Promise<Object>} Result with recent sales
 */
async function getRecentSales(limit = 10) {
  try {
    const sales = await Sale.find()
      .sort({ dateSold: -1 })
      .limit(limit)
      .populate('productId', 'name type sku');
    
    return {
      success: true,
      data: sales,
      count: sales.length
    };
  } catch (error) {
    console.error('Error getting recent sales:', error);
    return {
      success: false,
      error: `Failed to get recent sales: ${error.message}`,
      code: 'INTERNAL_ERROR'
    };
  }
}

/**
 * Gets sales for a specific product
 * @param {string} productIdentifier - Product ID or SKU
 * @param {number} limit - Maximum number of results
 * @returns {Promise<Object>} Result with sales array
 */
async function getProductSales(productIdentifier, limit = 50) {
  try {
    let query = {};
    
    // Check if it's a MongoDB ObjectId
    if (productIdentifier.match(/^[0-9a-fA-F]{24}$/)) {
      query.productId = productIdentifier;
    } else {
      // Assume it's a SKU
      query.sku = productIdentifier.toUpperCase();
    }
    
    const sales = await Sale.find(query)
      .sort({ dateSold: -1 })
      .limit(limit);
    
    // Calculate totals
    const totalQuantity = sales.reduce((sum, sale) => sum + sale.quantity, 0);
    const totalRevenue = sales.reduce((sum, sale) => sum + sale.totalSaleValue, 0);
    const totalProfit = sales.reduce((sum, sale) => sum + sale.profit, 0);
    
    return {
      success: true,
      data: sales,
      count: sales.length,
      summary: {
        totalQuantity,
        totalRevenue,
        totalProfit
      }
    };
  } catch (error) {
    console.error('Error getting product sales:', error);
    return {
      success: false,
      error: `Failed to get product sales: ${error.message}`,
      code: 'INTERNAL_ERROR'
    };
  }
}

/**
 * Deletes a sale record and restores product quantity
 * @param {string} saleId - Sale ID
 * @returns {Promise<Object>} Result object
 */
async function deleteSale(saleId) {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const sale = await Sale.findById(saleId).session(session);
    
    if (!sale) {
      await session.abortTransaction();
      return {
        success: false,
        error: 'Sale not found',
        code: 'NOT_FOUND'
      };
    }
    
    // Restore product quantity
    const product = await Product.findById(sale.productId).session(session);
    if (product) {
      product.quantity += sale.quantity;
      await product.save({ session });
    }
    
    // Delete sale
    await Sale.findByIdAndDelete(saleId).session(session);
    
    await session.commitTransaction();
    
    return {
      success: true,
      message: 'Sale deleted and product quantity restored',
      data: {
        saleId,
        quantityRestored: sale.quantity
      }
    };
  } catch (error) {
    await session.abortTransaction();
    console.error('Error deleting sale:', error);
    return {
      success: false,
      error: `Failed to delete sale: ${error.message}`,
      code: 'INTERNAL_ERROR'
    };
  } finally {
    session.endSession();
  }
}

module.exports = {
  recordSale,
  getSales,
  getSale,
  getRecentSales,
  getProductSales,
  deleteSale
};

