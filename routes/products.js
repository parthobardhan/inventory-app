const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Sale = require('../models/Sale');
const { getSignedUrl } = require('../config/aws');
const mongoose = require('mongoose');
const { upload, deleteFromS3 } = require('../config/aws');
const { generateProductDescription } = require('../services/aiService');
const { createProduct } = require('../services/productService');
const { v4: uuidv4 } = require('uuid');

// Middleware to check database connection
const checkDBConnection = async (req, res, next) => {
  try {
    // In serverless environments, we need to establish connection on each request
    if (mongoose.connection.readyState !== 1) {
      console.warn('🔄 [DB] Establishing database connection for request...');
      
      // Try to establish connection directly
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

// Helper function to refresh signed URLs for product images
async function refreshImageUrls(product) {
  if (product.images && product.images.length > 0) {
    const refreshPromises = product.images.map(async (image) => {
      try {
        if (image.s3Key) {
          // Generate new signed URL (valid for 24 hours)
          image.url = await getSignedUrl(image.s3Key, 86400);
        }
      } catch (error) {
        console.error('Error refreshing signed URL for image:', image.s3Key, error.message);
        // Keep the old URL if refresh fails
      }
    });

    // Wait for all URL refreshes to complete with a timeout
    await Promise.allSettled(refreshPromises);
  }
  return product;
}

// GET /api/products - Get all products with optional filtering
router.get('/', checkDBConnection, async (req, res) => {
  console.warn('🚀 [PRODUCTS API] GET /api/products - Fetching products');
  console.warn('🔍 [PRODUCTS API] Query params:', req.query);
  console.warn('🌍 [PRODUCTS API] Environment:', process.env.NODE_ENV);
  
  try {
    const { search, type, sortBy = 'dateAdded', sortOrder = 'desc' } = req.query;
    
    let pipeline = [];
    
    // Add Atlas Search stage if search term provided
    if (search) {
      const searchStage = {
        $search: {
          index: 'default', // You may need to create this search index in Atlas
          compound: {
            must: [{
              text: {
                query: search,
                path: ['name', 'description']
              }
            }]
          }
        }
      };
      
      // Add type filter as equals operator if provided
      if (type) {
        searchStage.$search.compound.filter = [{
          equals: {
            path: 'type',
            value: type
          }
        }];
      }
      
      pipeline.push(searchStage);
    }
    
    // Add sort stage
    const sortObj = {};
    sortObj[sortBy] = sortOrder === 'asc' ? 1 : -1;
    pipeline.push({ $sort: sortObj });
    
    console.warn('💾 [PRODUCTS API] Executing database query...');
    
    // Execute aggregation pipeline or regular find based on whether search is used
    const products = search ?
      await Product.aggregate(pipeline) :
      await Product.find(type ? { type } : {}).sort(sortObj);
    
    console.warn('✅ [PRODUCTS API] Database query completed, found', products.length, 'products');

    // Refresh signed URLs for all products with images
    const productsWithRefreshedUrls = await Promise.all(
      products.map(product => refreshImageUrls(product))
    );

    res.json({
      success: true,
      count: productsWithRefreshedUrls.length,
      data: productsWithRefreshedUrls
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching products',
      error: error.message
    });
  }
});

// GET /api/products/stats/sales-test - Test endpoint to check sales data
router.get('/stats/sales-test', checkDBConnection, async (req, res) => {
  try {
    console.log('🧪 [SALES TEST] Testing sales collection access...');
    
    // Count all sales
    const totalSales = await Sale.countDocuments();
    console.log('💰 [SALES TEST] Total sales:', totalSales);
    
    // Get all sales (limit to 10 for safety)
    const allSales = await Sale.find().sort({ dateSold: -1 }).limit(10);
    console.log('📋 [SALES TEST] Recent sales:', allSales.length);
    
    // Calculate total profit from ALL sales
    const allSalesForProfit = await Sale.find();
    const totalProfit = allSalesForProfit.reduce((sum, sale) => {
      const saleProfit = sale.profit || 0;
      console.log(`  - Sale ${sale.sku}: profit = ${saleProfit}`);
      return sum + saleProfit;
    }, 0);
    console.log('💰 [SALES TEST] Total profit across all sales:', totalProfit);
    
    // Log each sale
    allSales.forEach((sale, index) => {
      console.log(`Sale ${index + 1}:`, {
        id: sale._id,
        sku: sale.sku,
        quantity: sale.quantity,
        sellPrice: sale.sellPrice,
        cost: sale.cost,
        totalSaleValue: sale.totalSaleValue,
        totalCost: sale.totalCost,
        profit: sale.profit,
        dateSold: sale.dateSold,
        dateSoldType: typeof sale.dateSold,
        createdAt: sale.createdAt
      });
    });
    
    res.json({
      success: true,
      data: {
        totalSales,
        totalProfit,
        recentSales: allSales.map(sale => ({
          id: sale._id,
          sku: sale.sku,
          quantity: sale.quantity,
          sellPrice: sale.sellPrice,
          cost: sale.cost,
          profit: sale.profit,
          dateSold: sale.dateSold,
          dateSoldType: typeof sale.dateSold,
          createdAt: sale.createdAt
        }))
      }
    });
  } catch (error) {
    console.error('❌ [SALES TEST] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error testing sales collection',
      error: error.message,
      stack: error.stack
    });
  }
});

// GET /api/products/stats/profits - Get profit statistics
router.get('/stats/profits', checkDBConnection, async (req, res) => {
  try {
    console.log('📊 [PROFITS API] Fetching profit statistics...');
    
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    
    // Get first day of current month
    const currentMonthStart = new Date(currentYear, currentMonth, 1);
    
    // Get first day of last month
    const lastMonthStart = new Date(currentYear, currentMonth - 1, 1);
    const lastMonthEnd = new Date(currentYear, currentMonth, 0); // Last day of previous month
    
    console.log('📅 [PROFITS API] Date ranges:', {
      currentMonthStart: currentMonthStart.toISOString(),
      now: now.toISOString(),
      lastMonthStart: lastMonthStart.toISOString(),
      lastMonthEnd: lastMonthEnd.toISOString()
    });
    
    // First, check total sales in collection
    const totalSales = await Sale.countDocuments();
    console.log('💰 [PROFITS API] Total sales in database:', totalSales);
    
    // Get a sample sale to see the data structure
    const sampleSale = await Sale.findOne().sort({ dateSold: -1 });
    if (sampleSale) {
      console.log('📝 [PROFITS API] Sample sale:', {
        id: sampleSale._id,
        sku: sampleSale.sku,
        dateSold: sampleSale.dateSold,
        profit: sampleSale.profit,
        quantity: sampleSale.quantity,
        sellPrice: sampleSale.sellPrice,
        cost: sampleSale.cost
      });
    } else {
      console.log('⚠️  [PROFITS API] No sales found in database');
    }
    
    // Calculate current month profits from Sale collection
    const currentMonthSales = await Sale.find({
      dateSold: { 
        $gte: currentMonthStart,
        $lte: now
      }
    });
    
    console.log('📈 [PROFITS API] Current month sales found:', currentMonthSales.length);
    
    const currentMonthProfit = currentMonthSales.reduce((sum, sale) => {
      return sum + (sale.profit || 0);
    }, 0);
    
    console.log('💵 [PROFITS API] Current month profit:', currentMonthProfit);
    
    // Calculate last month profits from Sale collection
    const lastMonthSales = await Sale.find({
      dateSold: { 
        $gte: lastMonthStart,
        $lte: lastMonthEnd
      }
    });
    
    console.log('📈 [PROFITS API] Last month sales found:', lastMonthSales.length);
    
    const lastMonthProfit = lastMonthSales.reduce((sum, sale) => {
      return sum + (sale.profit || 0);
    }, 0);
    
    console.log('💵 [PROFITS API] Last month profit:', lastMonthProfit);
    
    // Calculate 12-month profit history
    const monthlyProfits = [];
    for (let i = 11; i >= 0; i--) {
      const monthStart = new Date(currentYear, currentMonth - i, 1);
      const monthEnd = new Date(currentYear, currentMonth - i + 1, 0);
      
      const monthlySales = await Sale.find({
        dateSold: { 
          $gte: monthStart,
          $lte: monthEnd
        }
      });
      
      const monthProfit = monthlySales.reduce((sum, sale) => {
        return sum + (sale.profit || 0);
      }, 0);
      
      monthlyProfits.push({
        month: monthStart.toISOString().substring(0, 7), // YYYY-MM format
        profit: monthProfit,
        salesCount: monthlySales.length
      });
    }
    
    console.log('📊 [PROFITS API] Monthly profits summary:', monthlyProfits.map(m => `${m.month}: $${m.profit.toFixed(2)}`).join(', '));
    
    const response = {
      success: true,
      data: {
        currentMonth: currentMonthProfit,
        lastMonth: lastMonthProfit,
        changePercent: lastMonthProfit > 0 ? 
          ((currentMonthProfit - lastMonthProfit) / lastMonthProfit * 100) : 0,
        monthlyProfits
      }
    };
    
    console.log('✅ [PROFITS API] Sending response:', JSON.stringify(response, null, 2));
    
    res.json(response);
  } catch (error) {
    console.error('❌ [PROFITS API] Error fetching profit stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching profit statistics',
      error: error.message
    });
  }
});

// GET /api/products/stats/summary - Get inventory summary statistics
router.get('/stats/summary', checkDBConnection, async (req, res) => {
  try {
    const products = await Product.find();
    
    const summary = {
      totalProducts: products.reduce((sum, product) => sum + product.quantity, 0),
      totalValue: products.reduce((sum, product) => sum + product.totalValue, 0),
      productCount: products.length,
      typeBreakdown: {}
    };
    
    // Calculate type breakdown
    products.forEach(product => {
      if (!summary.typeBreakdown[product.type]) {
        summary.typeBreakdown[product.type] = {
          count: 0,
          value: 0,
          items: 0
        };
      }
      summary.typeBreakdown[product.type].count += product.quantity;
      summary.typeBreakdown[product.type].value += product.totalValue;
      summary.typeBreakdown[product.type].items += 1;
    });
    
    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Error fetching summary:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching summary',
      error: error.message
    });
  }
});

// GET /api/products/:id - Get single product
router.get('/:id', checkDBConnection, async (req, res) => {
  try {
    // Validate that the ID is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID format'
      });
    }
    
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Refresh signed URLs for product images
    const productWithRefreshedUrls = await refreshImageUrls(product);

    res.json({
      success: true,
      data: productWithRefreshedUrls
    });
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching product',
      error: error.message
    });
  }
});

// POST /api/products - Create new product
router.post('/', checkDBConnection, async (req, res) => {
  console.warn('🚀 [PRODUCTS API] POST /api/products - Creating new product');
  console.warn('📥 [PRODUCTS API] Request body:', JSON.stringify(req.body, null, 2));
  console.warn('🌍 [PRODUCTS API] Environment:', process.env.NODE_ENV);
  console.warn('📊 [PRODUCTS API] Request headers:', {
    'content-type': req.headers['content-type'],
    'user-agent': req.headers['user-agent'],
    'origin': req.headers['origin'],
    'referer': req.headers['referer']
  });
  
  try {
    const { name, sku, type, quantity, price, cost, costBreakdown, description } = req.body;
    
    console.warn('🔍 [PRODUCTS API] Extracted fields:', {
      name: name,
      sku: sku || 'auto-generated',
      type: type,
      quantity: quantity,
      price: price,
      cost: cost,
      costBreakdown: costBreakdown,
      description: description ? description.substring(0, 100) + '...' : 'none'
    });
    
    console.warn('💾 [PRODUCTS API] Attempting to create product via service...');
    
    // Use shared service to create product
    // SKU will be auto-generated if not provided
    const result = await createProduct({
      name,
      sku, // Optional - will be auto-generated if not provided
      type,
      quantity,
      price,
      cost,
      costBreakdown, // Itemized cost breakdown
      description
    });
    
    if (result.success) {
      console.warn('✅ [PRODUCTS API] Product created successfully:', {
        id: result.data._id,
        name: result.data.name,
        type: result.data.type
      });
      
      res.status(201).json({
        success: true,
        message: result.message,
        data: result.data
      });
      
      console.warn('📤 [PRODUCTS API] Response sent successfully');
    } else {
      console.warn('❌ [PRODUCTS API] Product creation failed:', result.error);
      
      // Map error codes to HTTP status codes
      const statusCode = result.code === 'VALIDATION_ERROR' ? 400 :
                        result.code === 'DUPLICATE_SKU' ? 400 : 500;
      
      res.status(statusCode).json({
        success: false,
        message: result.error,
        error: result.code,
        details: result.details
      });
    }
  } catch (error) {
    console.error('💥 [PRODUCTS API] Unexpected error creating product:', error);
    console.error('💥 [PRODUCTS API] Error stack:', error.stack);
    
    res.status(500).json({
      success: false,
      message: 'Unexpected error creating product',
      error: error.message
    });
  }
});

// POST /api/products/upload - Create new product with image upload and AI generation
router.post('/upload', checkDBConnection, upload.single('image'), async (req, res) => {
  console.warn('🚀 [PRODUCTS API] POST /api/products/upload - Creating product with image');
  console.warn('📥 [PRODUCTS API] Request body:', req.body);
  console.warn('📸 [PRODUCTS API] Image file:', req.file ? 'Present' : 'Not present');
  console.warn('🌍 [PRODUCTS API] Environment:', process.env.NODE_ENV);
  
  try {
    // Parse product data from form
    let productData;
    try {
      productData = JSON.parse(req.body.productData || '{}');
    } catch (error) {
      console.error('Error parsing productData:', error);
      return res.status(400).json({
        success: false,
        message: 'Invalid product data format'
      });
    }

    const { name, sku, type, quantity, price, cost, description } = productData;
    const { generateAI = 'true' } = req.body;
    
    console.warn('🔍 [PRODUCTS API] Extracted fields:', {
      name: name,
      sku: sku,
      type: type,
      quantity: quantity,
      price: price,
      cost: cost,
      description: description ? description.substring(0, 100) + '...' : 'none',
      hasImage: !!req.file,
      generateAI: generateAI
    });
    
    // Validate required fields
    if (!name || !sku || !type || quantity === undefined || price === undefined) {
      console.warn('❌ [PRODUCTS API] Validation failed - missing required fields');
      
      // Clean up uploaded file if validation fails
      if (req.file && req.file.key) {
        await deleteFromS3(req.file.key);
      }
      
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: name, sku, type, quantity, and price are required'
      });
    }
    
    console.warn('✅ [PRODUCTS API] Validation passed - creating product object');
    
    // Create the product
    const product = new Product({
      name,
      sku,
      type,
      quantity,
      price,
      cost: cost || 0,
      description
    });
    
    // Handle image upload if present
    if (req.file) {
      console.warn('📸 [PRODUCTS API] Processing image upload...');
      
      // Create image metadata
      const imageId = uuidv4();
      const imageData = {
        id: imageId,
        s3Key: req.file.key,
        s3Bucket: req.file.bucket,
        url: req.file.location,
        filename: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        uploadedAt: new Date()
      };
      
      // Generate AI description if requested
      if (generateAI === 'true') {
        try {
          console.log('🤖 STARTING AI GENERATION...');
          console.log('📸 Image URL:', req.file.location);
          console.log('🏷️  Product Type:', type);
          console.log('⏳ Calling AI service...');

          const aiResult = await generateProductDescription(req.file.location, type);
          imageData.aiGenerated = aiResult;

          console.log('✅ AI GENERATION COMPLETED!');
          console.log('📝 Generated Title:', aiResult.title);
          console.log('📄 Generated Description:', aiResult.description);
          console.log('🎯 Confidence Score:', Math.round((aiResult.confidence || 0) * 100) + '%');
          console.log('🤖 AI Model Used:', aiResult.model);
          console.log('⚡ Generation Time:', aiResult.generatedAt);
          
          // Update product with AI-generated content if available
          if (aiResult && aiResult.title && aiResult.description) {
            console.log('🔄 Updating product with AI-generated content...');
            console.log('📝 AI Title:', aiResult.title);
            console.log('📄 AI Description length:', aiResult.description.length);
            console.log('🏷️  AI Caption length:', aiResult.rawCaption ? aiResult.rawCaption.length : 0);
            
            // Only update if the product doesn't have a meaningful name/description
            const shouldUpdateName = !product.name || product.name.trim() === '' || product.name === 'Untitled Product';
            const shouldUpdateDescription = !product.description || product.description.trim() === '';
            
            if (shouldUpdateName && aiResult.title) {
              product.name = aiResult.title;
              console.log('✅ Updated product name with AI title:', aiResult.title);
            }
            
            if (shouldUpdateDescription && aiResult.description) {
              product.description = aiResult.description;
              console.log('✅ Updated product description with AI description (length:', aiResult.description.length, ')');
            }
            
            // Always update the caption with the raw AI-generated caption
            if (aiResult.rawCaption) {
              product.caption = aiResult.rawCaption;
              console.log('✅ Updated product caption with AI raw caption (length:', aiResult.rawCaption.length, ')');
            }
          }
        } catch (error) {
          console.error('AI generation failed:', error);
          console.error('AI Error Details:', {
            message: error.message,
            name: error.name,
            stack: error.stack
          });
          
          // Set a more descriptive error message
          let errorMessage = 'AI generation failed';
          if (error.message.includes('model runner has unexpectedly stopped')) {
            errorMessage = 'AI service unavailable - please try again later';
          } else if (error.message.includes('timeout')) {
            errorMessage = 'AI generation timed out - please try again';
          } else if (error.message.includes('API key')) {
            errorMessage = 'AI service configuration error';
          }
          
          imageData.aiError = errorMessage;
          // Continue without AI data - user can retry later
        }
      }
      
      // Add image to product
      product.images.push(imageData);
      
      // Set as primary image (it's the first one)
      product.primaryImageId = imageId;
      
      console.warn('✅ [PRODUCTS API] Image processed and added to product');
    }
    
    // Validate content lengths before saving
    if (product.description && product.description.length > 500) {
      console.warn('⚠️  [PRODUCTS API] Description too long, truncating...');
      product.description = product.description.substring(0, 497) + '...';
    }
    
    if (product.caption && product.caption.length > 200) {
      console.warn('⚠️  [PRODUCTS API] Caption too long, truncating...');
      product.caption = product.caption.substring(0, 197) + '...';
    }
    
    console.warn('💾 [PRODUCTS API] Attempting to save product to database...');
    console.warn('📊 [PRODUCTS API] Final content lengths:', {
      name: product.name ? product.name.length : 0,
      description: product.description ? product.description.length : 0,
      caption: product.caption ? product.caption.length : 0
    });
    
    const savedProduct = await product.save();
    console.warn('✅ [PRODUCTS API] Product saved successfully:', {
      id: savedProduct._id,
      name: savedProduct.name,
      type: savedProduct.type,
      hasImages: savedProduct.images.length > 0
    });
    
    // Prepare response with AI status
    const responseData = {
      ...savedProduct.toObject(),
      aiStatus: savedProduct.images.length > 0 ? 
        (savedProduct.images[0].aiGenerated ? 'success' : 
         savedProduct.images[0].aiError ? 'failed' : 'not_requested') : 'no_image'
    };
    
    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: responseData
    });
    
    console.warn('📤 [PRODUCTS API] Response sent successfully');
  } catch (error) {
    console.error('💥 [PRODUCTS API] Error creating product with image:', error);
    console.error('💥 [PRODUCTS API] Error stack:', error.stack);
    
    // Clean up uploaded file on error
    if (req.file && req.file.key) {
      try {
        await deleteFromS3(req.file.key);
        console.warn('🧹 [PRODUCTS API] Cleaned up uploaded file after error');
      } catch (cleanupError) {
        console.error('❌ [PRODUCTS API] Failed to cleanup uploaded file:', cleanupError);
      }
    }
    
    // Handle MongoDB duplicate key error (E11000) for SKU uniqueness
    if (error.code === 11000 && error.keyPattern && error.keyPattern.sku) {
      console.warn('❌ [PRODUCTS API] Duplicate SKU error');
      return res.status(400).json({
        success: false,
        message: 'SKU already exists. Please choose a different SKU.',
        error: 'Duplicate SKU'
      });
    }
    
    if (error.name === 'ValidationError') {
      console.warn('❌ [PRODUCTS API] Validation error:', Object.values(error.errors).map(err => err.message));
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: Object.values(error.errors).map(err => err.message)
      });
    }
    
    console.warn('❌ [PRODUCTS API] Server error - returning 500');
    res.status(500).json({
      success: false,
      message: 'Error creating product',
      error: error.message
    });
  }
});

// PUT /api/products/:id - Update product
router.put('/:id', checkDBConnection, async (req, res) => {
  try {
    const { name, sku, type, quantity, price, cost, dateSold, description } = req.body;
    
    console.warn('🔧 [PRODUCTS API] PUT /api/products/:id - Updating product');
    console.warn('🆔 [PRODUCTS API] Product ID:', req.params.id);
    console.warn('📥 [PRODUCTS API] Update data:', {
      name,
      sku,
      type,
      quantity,
      price,
      cost,
      dateSold,
      description: description ? description.substring(0, 50) + '...' : 'none'
    });
    
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      {
        name,
        sku,
        type,
        quantity,
        price,
        cost,
        dateSold,
        description,
        lastUpdated: new Date()
      },
      {
        new: true,
        runValidators: true
      }
    );
    
    if (!product) {
      console.warn('❌ [PRODUCTS API] Product not found with ID:', req.params.id);
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    console.warn('✅ [PRODUCTS API] Product updated successfully:', {
      id: product._id,
      name: product.name,
      sku: product.sku,
      type: product.type
    });
    
    res.json({
      success: true,
      message: 'Product updated successfully',
      data: product
    });
  } catch (error) {
    console.error('Error updating product:', error);
    
    // Handle MongoDB duplicate key error (E11000) for SKU uniqueness
    if (error.code === 11000 && error.keyPattern && error.keyPattern.sku) {
      return res.status(400).json({
        success: false,
        message: 'SKU already exists. Please choose a different SKU.',
        error: 'Duplicate SKU'
      });
    }
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: Object.values(error.errors).map(err => err.message)
      });
    }
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID format'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error updating product',
      error: error.message
    });
  }
});

// DELETE /api/products/:id - Delete product
router.delete('/:id', checkDBConnection, async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Product deleted successfully',
      data: product
    });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting product',
      error: error.message
    });
  }
});

// POST /api/products/sell - Record a sale and update product quantity
router.post('/sell', checkDBConnection, async (req, res) => {
  try {
    const { productId, sku, quantity, sellPrice, dateSold } = req.body;
    
    console.log('📥 [SELL] Received sale request:', {
      productId,
      sku,
      quantity,
      sellPrice,
      dateSold
    });
    
    // Validation
    if (!productId || !sku || !quantity || !sellPrice || !dateSold) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: productId, sku, quantity, sellPrice, dateSold'
      });
    }
    
    if (quantity < 1) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be at least 1'
      });
    }
    
    if (sellPrice <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Sell price must be greater than 0'
      });
    }
    
    // Find the product
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    // Debug logging - check raw document
    const productObj = product.toObject();
    console.log('🔍 [SELL] Product found:', {
      id: product._id,
      name: product.name,
      sku: product.sku,
      skuFromObject: productObj.sku,
      skuType: typeof product.sku,
      skuLength: product.sku ? product.sku.length : 'null/undefined',
      hasOwnProperty: product.hasOwnProperty('sku'),
      skuValue: JSON.stringify(product.sku)
    });
    
    // IMPORTANT: Use productObj.sku instead of product.sku
    // Mongoose may not expose the SKU via the model property, but it's in the raw object
    const productSku = (productObj.sku || product.sku)?.trim();
    if (!productSku || productSku === '' || productSku === 'undefined' || productSku === 'null') {
      console.error('❌ [SELL] Product missing or invalid SKU:', {
        productId: product._id,
        name: product.name,
        skuRaw: product.sku,
        skuFromObject: productObj.sku,
        skuTrimmed: productSku,
        allFields: Object.keys(productObj)
      });
      return res.status(400).json({
        success: false,
        message: `Product "${product.name}" does not have a valid SKU assigned. Please edit the product to add a SKU before recording sales.`,
        productId: product._id.toString(),
        productName: product.name
      });
    }
    
    console.log('✅ [SELL] Using SKU:', productSku);
    
    // Verify SKU matches
    const normalizedSku = sku ? sku.toUpperCase().trim() : '';
    const normalizedProductSku = productSku.toUpperCase().trim();
    
    if (normalizedProductSku !== normalizedSku) {
      console.error(`SKU mismatch: Product SKU="${normalizedProductSku}", Provided SKU="${normalizedSku}"`);
      return res.status(400).json({
        success: false,
        message: `SKU mismatch. Expected "${normalizedProductSku}" but received "${normalizedSku}"`
      });
    }
    
    // Check if enough quantity available
    if (product.quantity < quantity) {
      return res.status(400).json({
        success: false,
        message: `Insufficient quantity. Available: ${product.quantity}, Requested: ${quantity}`
      });
    }
    
    // Use transaction to ensure data consistency
    const session = await mongoose.startSession();
    
    try {
      await session.withTransaction(async () => {
        // Create sale record - use the validated product SKU
        const saleData = {
          productId,
          sku: normalizedProductSku,
          quantity: parseInt(quantity),
          sellPrice: parseFloat(sellPrice),
          cost: product.cost || productObj.cost || 0, // Get cost from product
          dateSold: new Date(dateSold)
        };
        
        const sale = new Sale(saleData);
        await sale.save({ session });
        
        // Update product quantity
        await Product.findByIdAndUpdate(
          productId,
          { $inc: { quantity: -quantity } },
          { session, new: true }
        );
      });
      
      await session.commitTransaction();
      
      console.log('✅ [SELL] Sale completed successfully:', {
        sku: normalizedProductSku,
        quantity,
        sellPrice
      });
      
      res.json({
        success: true,
        message: `Successfully sold ${quantity} units of ${normalizedProductSku}`,
        data: {
          sku: normalizedProductSku,
          quantity,
          sellPrice,
          dateSold,
          remainingQuantity: product.quantity - quantity
        }
      });
      
    } catch (transactionError) {
      await session.abortTransaction();
      throw transactionError;
    } finally {
      await session.endSession();
    }
    
  } catch (error) {
    console.error('Error recording sale:', error);
    res.status(500).json({
      success: false,
      message: 'Error recording sale',
      error: error.message
    });
  }
});

module.exports = router;
