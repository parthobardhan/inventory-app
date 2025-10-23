const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Sale = require('../models/Sale');
const mongoose = require('mongoose');

// Middleware to check database connection
const checkDBConnection = async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      console.warn('🔄 [DB] Establishing database connection for request...');
      
      try {
        if (!process.env.MONGODB_URI || process.env.MONGODB_URI.includes('username:password')) {
          throw new Error('MongoDB URI not configured');
        }

        await mongoose.connect(process.env.MONGODB_URI, {
          serverSelectionTimeoutMS: 5000,
          socketTimeoutMS: 45000,
          maxPoolSize: 1,
          minPoolSize: 0,
          maxIdleTimeMS: 30000,
          connectTimeoutMS: 5000,
        });
        
        console.warn('✅ [DB] Database connection established for request');
      } catch (error) {
        console.error('❌ [DB] Failed to connect to database:', error.message);
        return res.status(503).json({
          success: false,
          message: 'Database connection not available',
          error: 'Service temporarily unavailable'
        });
      }
    }
    next();
  } catch (error) {
    console.error('Database connection check failed:', error);
    return res.status(503).json({
      success: false,
      message: 'Database connection not available',
      error: 'Service temporarily unavailable'
    });
  }
};

// POST /api/sales - Record a new sale
router.post('/', checkDBConnection, async (req, res) => {
  try {
    const { productName, quantity, sellPrice } = req.body;

    if (!productName || !quantity) {
      return res.status(400).json({
        success: false,
        error: 'Product name and quantity are required'
      });
    }

    // Find the product by name, SKU, or ID
    let product;
    if (mongoose.Types.ObjectId.isValid(productName)) {
      product = await Product.findById(productName);
    } else {
      product = await Product.findOne({
        $or: [
          { name: { $regex: productName, $options: 'i' } },
          { sku: { $regex: productName, $options: 'i' } }
        ]
      });
    }

    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    // Check if enough quantity is available
    if (product.quantity < quantity) {
      return res.status(400).json({
        success: false,
        error: `Insufficient quantity. Only ${product.quantity} units available.`
      });
    }

    // Use provided sell price or product's price
    const finalSellPrice = sellPrice || product.price;
    const costPrice = product.cost || 0;

    // Calculate sale values
    const totalSaleValue = finalSellPrice * quantity;
    const totalCost = costPrice * quantity;
    const profit = totalSaleValue - totalCost;

    // Create sale record
    const sale = new Sale({
      productId: product._id,
      quantity: quantity,
      salePrice: finalSellPrice,
      costPrice: costPrice,
      totalSaleValue: totalSaleValue,
      profit: profit,
      saleDate: new Date()
    });

    await sale.save();

    // Update product quantity
    product.quantity -= quantity;
    await product.save();

    // Populate product details
    await sale.populate('productId', 'name sku type');

    return res.status(201).json({
      success: true,
      data: sale,
      message: `Sale recorded successfully. ${quantity} units of ${product.name} sold.`
    });

  } catch (error) {
    console.error('Error recording sale:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to record sale'
    });
  }
});

// GET /api/sales - Get sales history with filtering
router.get('/', checkDBConnection, async (req, res) => {
  try {
    const { product, startDate, endDate, limit = 10 } = req.query;
    
    let query = {};

    // Filter by product
    if (product) {
      const products = await Product.find({
        $or: [
          { name: { $regex: product, $options: 'i' } },
          { sku: { $regex: product, $options: 'i' } }
        ]
      }).select('_id');
      
      const productIds = products.map(p => p._id);
      query.productId = { $in: productIds };
    }

    // Filter by date range
    if (startDate || endDate) {
      query.saleDate = {};
      if (startDate) query.saleDate.$gte = new Date(startDate);
      if (endDate) query.saleDate.$lte = new Date(endDate);
    }

    const sales = await Sale.find(query)
      .populate('productId', 'name sku type price cost')
      .sort({ saleDate: -1 })
      .limit(parseInt(limit));

    return res.json({
      success: true,
      count: sales.length,
      data: sales
    });

  } catch (error) {
    console.error('Error fetching sales history:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch sales history'
    });
  }
});

module.exports = router;

