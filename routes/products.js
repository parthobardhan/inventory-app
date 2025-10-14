const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const { getSignedUrl } = require('../config/aws');
const mongoose = require('mongoose');
const { upload, deleteFromS3 } = require('../config/aws');
const { generateProductDescription } = require('../services/aiService');
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

// GET /api/products/:id - Get single product
router.get('/:id', checkDBConnection, async (req, res) => {
  try {
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
    const { name, type, quantity, price, cost, description } = req.body;
    
    console.warn('🔍 [PRODUCTS API] Extracted fields:', {
      name: name,
      type: type,
      quantity: quantity,
      price: price,
      cost: cost,
      description: description ? description.substring(0, 100) + '...' : 'none'
    });
    
    // Validate required fields
    if (!name || !type || quantity === undefined || price === undefined) {
      console.warn('❌ [PRODUCTS API] Validation failed - missing required fields');
      console.warn('❌ [PRODUCTS API] Missing fields:', {
        name: !name,
        type: !type,
        quantity: quantity === undefined,
        price: price === undefined
      });
      
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: name, type, quantity, and price are required'
      });
    }
    
    console.warn('✅ [PRODUCTS API] Validation passed - creating product object');
    
    const product = new Product({
      name,
      type,
      quantity,
      price,
      cost: cost || 0,
      description
    });
    
    console.warn('💾 [PRODUCTS API] Attempting to save product to database...');
    const savedProduct = await product.save();
    console.warn('✅ [PRODUCTS API] Product saved successfully:', {
      id: savedProduct._id,
      name: savedProduct.name,
      type: savedProduct.type
    });
    
    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: savedProduct
    });
    
    console.warn('📤 [PRODUCTS API] Response sent successfully');
  } catch (error) {
    console.error('💥 [PRODUCTS API] Error creating product:', error);
    console.error('💥 [PRODUCTS API] Error stack:', error.stack);
    
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

    const { name, type, quantity, price, cost, description } = productData;
    const { generateAI = 'true' } = req.body;
    
    console.warn('🔍 [PRODUCTS API] Extracted fields:', {
      name: name,
      type: type,
      quantity: quantity,
      price: price,
      cost: cost,
      description: description ? description.substring(0, 100) + '...' : 'none',
      hasImage: !!req.file,
      generateAI: generateAI
    });
    
    // Validate required fields
    if (!name || !type || quantity === undefined || price === undefined) {
      console.warn('❌ [PRODUCTS API] Validation failed - missing required fields');
      
      // Clean up uploaded file if validation fails
      if (req.file && req.file.key) {
        await deleteFromS3(req.file.key);
      }
      
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: name, type, quantity, and price are required'
      });
    }
    
    console.warn('✅ [PRODUCTS API] Validation passed - creating product object');
    
    // Create the product
    const product = new Product({
      name,
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
    const { name, type, quantity, price, cost, dateSold, description } = req.body;
    
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      {
        name,
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
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Product updated successfully',
      data: product
    });
  } catch (error) {
    console.error('Error updating product:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: Object.values(error.errors).map(err => err.message)
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

// GET /api/products/stats/profits - Get profit statistics
router.get('/stats/profits', checkDBConnection, async (req, res) => {
  try {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    
    // Get first day of current month
    const currentMonthStart = new Date(currentYear, currentMonth, 1);
    
    // Get first day of last month
    const lastMonthStart = new Date(currentYear, currentMonth - 1, 1);
    const lastMonthEnd = new Date(currentYear, currentMonth, 0); // Last day of previous month
    
    // Calculate current month profits
    const currentMonthSales = await Product.find({
      dateSold: { 
        $gte: currentMonthStart,
        $lte: now
      },
      cost: { $gt: 0 }
    });
    
    const currentMonthProfit = currentMonthSales.reduce((sum, product) => {
      return sum + (product.price - product.cost);
    }, 0);
    
    // Calculate last month profits  
    const lastMonthSales = await Product.find({
      dateSold: { 
        $gte: lastMonthStart,
        $lte: lastMonthEnd
      },
      cost: { $gt: 0 }
    });
    
    const lastMonthProfit = lastMonthSales.reduce((sum, product) => {
      return sum + (product.price - product.cost);
    }, 0);
    
    // Calculate 12-month profit history
    const monthlyProfits = [];
    for (let i = 11; i >= 0; i--) {
      const monthStart = new Date(currentYear, currentMonth - i, 1);
      const monthEnd = new Date(currentYear, currentMonth - i + 1, 0);
      
      const monthlySales = await Product.find({
        dateSold: { 
          $gte: monthStart,
          $lte: monthEnd
        },
        cost: { $gt: 0 }
      });
      
      const monthProfit = monthlySales.reduce((sum, product) => {
        return sum + (product.price - product.cost);
      }, 0);
      
      monthlyProfits.push({
        month: monthStart.toISOString().substring(0, 7), // YYYY-MM format
        profit: monthProfit,
        salesCount: monthlySales.length
      });
    }
    
    res.json({
      success: true,
      data: {
        currentMonthProfit,
        lastMonthProfit,
        changePercent: lastMonthProfit > 0 ? 
          ((currentMonthProfit - lastMonthProfit) / lastMonthProfit * 100) : 0,
        monthlyProfits
      }
    });
  } catch (error) {
    console.error('Error fetching profit stats:', error);
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

module.exports = router;
