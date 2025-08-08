const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const Product = require('../models/Product');
const { upload, deleteFromS3, S3_BUCKET, getSignedUrl } = require('../config/aws');
const { generateProductDescription } = require('../services/aiService');

// POST /api/images/upload/:productId - Upload image for a product
router.post('/upload/:productId', upload.single('image'), async (req, res) => {
  try {
    const { productId } = req.params;
    const { generateAI = 'true' } = req.body;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided'
      });
    }
    
    const product = await Product.findById(productId);
    if (!product) {
      // Clean up uploaded file if product doesn't exist
      await deleteFromS3(req.file.key);
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    // Create image metadata
    const imageId = uuidv4();
    const imageData = {
      id: imageId,
      s3Key: req.file.key,
      s3Bucket: S3_BUCKET,
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
        console.log('🏷️  Product Type:', product.type);
        console.log('⏳ Calling AI service...');

        const aiResult = await generateProductDescription(req.file.location, product.type);
        imageData.aiGenerated = aiResult;

        console.log('✅ AI GENERATION COMPLETED!');
        console.log('📝 Generated Title:', aiResult.title);
        console.log('📄 Generated Description:', aiResult.description);
        console.log('🎯 Confidence Score:', Math.round((aiResult.confidence || 0) * 100) + '%');
        console.log('🤖 AI Model Used:', aiResult.model);
        console.log('⚡ Generation Time:', aiResult.generatedAt);
        
        // Update product with AI-generated content if available
        if (aiResult && aiResult.title && aiResult.description) {
          // Only update if the product doesn't have a meaningful name/description
          const shouldUpdateName = !product.name || product.name.trim() === '' || product.name === 'Untitled Product';
          const shouldUpdateDescription = !product.description || product.description.trim() === '';
          
          if (shouldUpdateName && aiResult.title) {
            product.name = aiResult.title;
            console.log('Updated product name with AI title:', aiResult.title);
          }
          
          if (shouldUpdateDescription && aiResult.description) {
            product.description = aiResult.description;
            console.log('Updated product description with AI description:', aiResult.description);
          }
        }
      } catch (error) {
        console.error('AI generation failed:', error);
        // Continue without AI data - user can retry later
      }
    }
    
    // Add image to product
    product.images.push(imageData);
    
    // Set as primary image if it's the first one
    if (!product.primaryImageId) {
      product.primaryImageId = imageId;
    }
    
    await product.save();
    
    res.json({
      success: true,
      message: 'Image uploaded successfully',
      data: {
        imageId: imageId,
        url: req.file.location,
        aiGenerated: imageData.aiGenerated || null
      }
    });
    
  } catch (error) {
    console.error('Error uploading image:', error);
    
    // Clean up uploaded file on error
    if (req.file && req.file.key) {
      await deleteFromS3(req.file.key);
    }
    
    res.status(500).json({
      success: false,
      message: 'Error uploading image',
      error: error.message
    });
  }
});

// POST /api/images/:productId/:imageId/generate-ai - Generate AI description for existing image
router.post('/:productId/:imageId/generate-ai', async (req, res) => {
  try {
    const { productId, imageId } = req.params;
    
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    const image = product.images.find(img => img.id === imageId);
    if (!image) {
      return res.status(404).json({
        success: false,
        message: 'Image not found'
      });
    }
    
    // Generate AI description
    const aiResult = await generateProductDescription(image.url, product.type);
    
    // Update image with AI data
    image.aiGenerated = aiResult;
    await product.save();
    
    res.json({
      success: true,
      message: 'AI description generated successfully',
      data: aiResult
    });
    
  } catch (error) {
    console.error('Error generating AI description:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating AI description',
      error: error.message
    });
  }
});

// PUT /api/images/:productId/:imageId/edit - Edit AI-generated content
router.put('/:productId/:imageId/edit', async (req, res) => {
  try {
    const { productId, imageId } = req.params;
    const { title, description } = req.body;
    
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    const image = product.images.find(img => img.id === imageId);
    if (!image) {
      return res.status(404).json({
        success: false,
        message: 'Image not found'
      });
    }
    
    // Update user-edited content
    image.userEdited = {
      title: title || image.aiGenerated?.title,
      description: description || image.aiGenerated?.description,
      editedAt: new Date()
    };
    
    await product.save();
    
    res.json({
      success: true,
      message: 'Image content updated successfully',
      data: image.userEdited
    });
    
  } catch (error) {
    console.error('Error updating image content:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating image content',
      error: error.message
    });
  }
});

// DELETE /api/images/:productId/:imageId - Delete image
router.delete('/:productId/:imageId', async (req, res) => {
  try {
    const { productId, imageId } = req.params;
    
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    const imageIndex = product.images.findIndex(img => img.id === imageId);
    if (imageIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Image not found'
      });
    }
    
    const image = product.images[imageIndex];
    
    // Delete from S3
    const s3DeleteSuccess = await deleteFromS3(image.s3Key);
    if (!s3DeleteSuccess) {
      console.warn(`Failed to delete image from S3: ${image.s3Key}`);
    }
    
    // Remove from product
    product.images.splice(imageIndex, 1);
    
    // Update primary image if this was the primary
    if (product.primaryImageId === imageId) {
      product.primaryImageId = product.images.length > 0 ? product.images[0].id : null;
    }
    
    await product.save();
    
    res.json({
      success: true,
      message: 'Image deleted successfully'
    });
    
  } catch (error) {
    console.error('Error deleting image:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting image',
      error: error.message
    });
  }
});

// PUT /api/images/:productId/:imageId/set-primary - Set image as primary
router.put('/:productId/:imageId/set-primary', async (req, res) => {
  try {
    const { productId, imageId } = req.params;
    
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    const image = product.images.find(img => img.id === imageId);
    if (!image) {
      return res.status(404).json({
        success: false,
        message: 'Image not found'
      });
    }
    
    product.primaryImageId = imageId;
    await product.save();
    
    res.json({
      success: true,
      message: 'Primary image updated successfully'
    });
    
  } catch (error) {
    console.error('Error setting primary image:', error);
    res.status(500).json({
      success: false,
      message: 'Error setting primary image',
      error: error.message
    });
  }
});

// GET /api/images/:productId - Get all images for a product
router.get('/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    res.json({
      success: true,
      data: {
        images: product.images,
        primaryImageId: product.primaryImageId
      }
    });
    
  } catch (error) {
    console.error('Error fetching images:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching images',
      error: error.message
    });
  }
});

module.exports = router;
