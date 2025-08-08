const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const { getSignedUrl } = require('../config/aws');

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
router.get('/', async (req, res) => {
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
    
    // Execute aggregation pipeline or regular find based on whether search is used
    const products = search ?
      await Product.aggregate(pipeline) :
      await Product.find(type ? { type } : {}).sort(sortObj);

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
router.get('/:id', async (req, res) => {
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
router.post('/', async (req, res) => {
  try {
    const { name, type, quantity, price, description } = req.body;
    
    // Validate required fields
    if (!name || !type || quantity === undefined || price === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: name, type, quantity, and price are required'
      });
    }
    
    const product = new Product({
      name,
      type,
      quantity,
      price,
      description
    });
    
    const savedProduct = await product.save();
    
    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: savedProduct
    });
  } catch (error) {
    console.error('Error creating product:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: Object.values(error.errors).map(err => err.message)
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error creating product',
      error: error.message
    });
  }
});

// PUT /api/products/:id - Update product
router.put('/:id', async (req, res) => {
  try {
    const { name, type, quantity, price, description } = req.body;
    
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      {
        name,
        type,
        quantity,
        price,
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
router.delete('/:id', async (req, res) => {
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

// GET /api/products/stats/summary - Get inventory summary statistics
router.get('/stats/summary', async (req, res) => {
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
