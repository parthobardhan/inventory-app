const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');

// Mock the aws module before requiring the routes
jest.mock('../../config/aws', () => ({
  upload: {
    single: jest.fn().mockImplementation((fieldname) => {
      return (req, res, next) => {
        req.file = {
          key: 'products/test-key.jpg',
          location: 'https://test-bucket.s3.amazonaws.com/test-key.jpg',
          originalname: 'test-image.jpg',
          mimetype: 'image/jpeg',
          size: 1024
        };
        next();
      };
    }),
    options: {
      storage: {
        _handleFile: jest.fn(),
        _removeFile: jest.fn()
      }
    }
  },
  deleteFromS3: jest.fn(),
  S3_BUCKET: 'test-bucket',
  getSignedUrl: jest.fn().mockResolvedValue('https://signed-url.com/test')
}));

// Mock the AI service
jest.mock('../../services/aiService', () => ({
  generateProductDescription: jest.fn().mockResolvedValue({
    title: 'AI Generated Title',
    description: 'AI Generated Description',
    confidence: 0.85,
    model: 'TestModel',
    generatedAt: new Date()
  })
}));

// Mock the Product model
jest.mock('../../models/Product', () => {
  const mockProduct = {
    _id: 'mockProductId',
    name: 'Test Product',
    type: 'bed-covers',
    images: [],
    primaryImageId: null,
    save: jest.fn().mockResolvedValue(true),
    find: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn()
  };
  
  const ProductMock = jest.fn().mockImplementation(() => mockProduct);
  ProductMock.findById = jest.fn();
  ProductMock.find = jest.fn();
  ProductMock.findByIdAndUpdate = jest.fn();
  ProductMock.findByIdAndDelete = jest.fn();
  
  return ProductMock;
});

describe('Images Routes', () => {
  let app;
  let imageRoutes;
  let mockProduct;
  let Product;
  let mockAws;
  let mockAiService;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Get mocked modules
    mockAws = require('../../config/aws');
    mockAiService = require('../../services/aiService');
    Product = require('../../models/Product');
    
    // Create mock product instance
    mockProduct = {
      _id: 'mockProductId',
      name: 'Test Product',
      type: 'bed-covers',
      images: [],
      primaryImageId: null,
      save: jest.fn().mockResolvedValue(true)
    };
    
    Product.findById = jest.fn().mockResolvedValue(mockProduct);
    
    // Setup express app
    app = express();
    app.use(express.json());
    
    // Require and setup routes
    imageRoutes = require('../../routes/images');
    app.use('/api/images', imageRoutes);
  });

  describe('POST /api/images/upload/:productId', () => {
    it('should upload image successfully without AI generation', async () => {
      const response = await request(app)
        .post('/api/images/upload/mockProductId')
        .field('generateAI', 'false')
        .attach('image', Buffer.from('fake image data'), 'test-image.jpg');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Image uploaded successfully');
      expect(response.body.data).toHaveProperty('imageId');
      expect(response.body.data).toHaveProperty('url');
      expect(mockProduct.save).toHaveBeenCalled();
      expect(mockProduct.images).toHaveLength(1);
    });

    it('should upload image successfully with AI generation', async () => {
      const response = await request(app)
        .post('/api/images/upload/mockProductId')
        .field('generateAI', 'true')
        .attach('image', Buffer.from('fake image data'), 'test-image.jpg');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('aiGenerated');
      expect(response.body.data.aiGenerated).toHaveProperty('title', 'AI Generated Title');
      expect(mockAiService.generateProductDescription).toHaveBeenCalledWith(
        'https://test-bucket.s3.amazonaws.com/test-key.jpg',
        'bed-covers'
      );
    });

    it('should handle AI generation failure gracefully', async () => {
      mockAiService.generateProductDescription.mockRejectedValueOnce(
        new Error('AI service failed')
      );

      const response = await request(app)
        .post('/api/images/upload/mockProductId')
        .field('generateAI', 'true')
        .attach('image', Buffer.from('fake image data'), 'test-image.jpg');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('aiError', 'AI service failed');
    });

    it('should return 400 if no image file provided', async () => {
      // Mock upload middleware to not set req.file
      mockAws.upload.single.mockImplementationOnce(() => {
        return (req, res, next) => {
          req.file = null;
          next();
        };
      });

      const response = await request(app)
        .post('/api/images/upload/mockProductId');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('No image file provided');
    });

    it('should return 404 if product not found', async () => {
      Product.findById.mockResolvedValueOnce(null);

      const response = await request(app)
        .post('/api/images/upload/mockProductId')
        .attach('image', Buffer.from('fake image data'), 'test-image.jpg');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Product not found');
      expect(mockAws.deleteFromS3).toHaveBeenCalledWith('products/test-key.jpg');
    });

    it('should set image as primary if it is the first image', async () => {
      const response = await request(app)
        .post('/api/images/upload/mockProductId')
        .attach('image', Buffer.from('fake image data'), 'test-image.jpg');

      expect(response.status).toBe(200);
      expect(mockProduct.primaryImageId).toBeTruthy();
      expect(mockProduct.images[0].id).toBe(mockProduct.primaryImageId);
    });

    it('should handle upload errors', async () => {
      mockProduct.save.mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .post('/api/images/upload/mockProductId')
        .attach('image', Buffer.from('fake image data'), 'test-image.jpg');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Error uploading image');
      expect(mockAws.deleteFromS3).toHaveBeenCalledWith('products/test-key.jpg');
    });
  });

  describe('POST /api/images/:productId/:imageId/generate-ai', () => {
    beforeEach(() => {
      mockProduct.images = [{
        id: 'testImageId',
        url: 'https://test-bucket.s3.amazonaws.com/test-image.jpg',
        s3Key: 'products/test-image.jpg'
      }];
    });

    it('should generate AI description for existing image', async () => {
      const response = await request(app)
        .post('/api/images/mockProductId/testImageId/generate-ai');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('AI description generated successfully');
      expect(response.body.data).toHaveProperty('title', 'AI Generated Title');
      expect(mockAiService.generateProductDescription).toHaveBeenCalledWith(
        'https://test-bucket.s3.amazonaws.com/test-image.jpg',
        'bed-covers'
      );
    });

    it('should return 404 if product not found', async () => {
      Product.findById.mockResolvedValueOnce(null);

      const response = await request(app)
        .post('/api/images/mockProductId/testImageId/generate-ai');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Product not found');
    });

    it('should return 404 if image not found', async () => {
      const response = await request(app)
        .post('/api/images/mockProductId/nonexistentImageId/generate-ai');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Image not found');
    });
  });

  describe('DELETE /api/images/:productId/:imageId', () => {
    beforeEach(() => {
      mockProduct.images = [{
        id: 'testImageId',
        s3Key: 'products/test-image.jpg'
      }];
      mockProduct.primaryImageId = 'testImageId';
      mockAws.deleteFromS3.mockResolvedValue(true);
    });

    it('should delete image successfully', async () => {
      const response = await request(app)
        .delete('/api/images/mockProductId/testImageId');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Image deleted successfully');
      expect(mockAws.deleteFromS3).toHaveBeenCalledWith('products/test-image.jpg');
      expect(mockProduct.images).toHaveLength(0);
      expect(mockProduct.primaryImageId).toBeNull();
    });

    it('should return 404 if image not found', async () => {
      const response = await request(app)
        .delete('/api/images/mockProductId/nonexistentImageId');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Image not found');
    });
  });

  describe('PUT /api/images/:productId/:imageId/set-primary', () => {
    beforeEach(() => {
      mockProduct.images = [
        { id: 'image1', s3Key: 'products/image1.jpg' },
        { id: 'image2', s3Key: 'products/image2.jpg' }
      ];
      mockProduct.primaryImageId = 'image1';
    });

    it('should set image as primary successfully', async () => {
      const response = await request(app)
        .put('/api/images/mockProductId/image2/set-primary');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Primary image updated successfully');
      expect(mockProduct.primaryImageId).toBe('image2');
    });

    it('should return 404 if image not found', async () => {
      const response = await request(app)
        .put('/api/images/mockProductId/nonexistentImageId/set-primary');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Image not found');
    });
  });

  describe('GET /api/images/:productId', () => {
    beforeEach(() => {
      mockProduct.images = [
        { id: 'image1', s3Key: 'products/image1.jpg' },
        { id: 'image2', s3Key: 'products/image2.jpg' }
      ];
      mockProduct.primaryImageId = 'image1';
    });

    it('should return all images for a product', async () => {
      const response = await request(app)
        .get('/api/images/mockProductId');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.images).toHaveLength(2);
      expect(response.body.data.primaryImageId).toBe('image1');
    });

    it('should return 404 if product not found', async () => {
      Product.findById.mockResolvedValueOnce(null);

      const response = await request(app)
        .get('/api/images/mockProductId');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Product not found');
    });
  });
});
