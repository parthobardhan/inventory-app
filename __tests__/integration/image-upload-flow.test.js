const request = require('supertest');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const express = require('express');

// Integration test for complete image upload flow
describe('Image Upload Flow Integration', () => {
  let app;
  let server;
  let testImagePath;
  let productId;

  beforeAll(async () => {
    // Skip if no AWS credentials
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      console.log('⚠️  Skipping image upload integration tests - AWS credentials not provided');
      return;
    }

    // Create test image
    testImagePath = path.join(__dirname, '../fixtures/integration-test-image.jpg');
    const testImageDir = path.dirname(testImagePath);
    if (!fs.existsSync(testImageDir)) {
      fs.mkdirSync(testImageDir, { recursive: true });
    }

    // Create a small test image (1x1 pixel JPEG)
    const testImageData = Buffer.from([
      0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
      0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
      0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
      0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
      0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20,
      0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
      0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32,
      0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x11, 0x08, 0x00, 0x01,
      0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
      0xFF, 0xC4, 0x00, 0x14, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x08, 0xFF, 0xC4,
      0x00, 0x14, 0x10, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xFF, 0xDA, 0x00, 0x0C,
      0x03, 0x01, 0x00, 0x02, 0x11, 0x03, 0x11, 0x00, 0x3F, 0x00, 0x55, 0xFF, 0xD9
    ]);
    
    fs.writeFileSync(testImagePath, testImageData);

    // Setup test database
    if (mongoose.connection.readyState === 0) {
      // Use test database or in-memory database
      const mongoUri = process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/textile-inventory-test';
      await mongoose.connect(mongoUri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
    }

    // Setup express app with all middleware
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // Import and setup routes
    const productRoutes = require('../../routes/products');
    const imageRoutes = require('../../routes/images');
    app.use('/api/products', productRoutes);
    app.use('/api/images', imageRoutes);

    // Start server
    server = app.listen(0); // Use random available port
  }, 30000);

  afterAll(async () => {
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      return;
    }

    // Clean up test image
    if (fs.existsSync(testImagePath)) {
      fs.unlinkSync(testImagePath);
    }

    // Clean up database
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.dropDatabase();
      await mongoose.connection.close();
    }

    // Close server
    if (server) {
      server.close();
    }
  });

  beforeEach(() => {
    // Skip if no credentials
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      pending('AWS credentials not provided');
    }
  });

  describe('Complete Image Upload Workflow', () => {
    it('should create product, upload image, and retrieve with signed URLs', async () => {
      // Step 1: Create a product
      const productResponse = await request(app)
        .post('/api/products')
        .send({
          name: 'Integration Test Product',
          type: 'bed-covers',
          quantity: 10,
          price: 29.99,
          description: 'A test product for integration testing'
        });

      expect(productResponse.status).toBe(201);
      expect(productResponse.body.success).toBe(true);
      productId = productResponse.body.data._id;

      // Step 2: Upload image without AI generation
      const imageUploadResponse = await request(app)
        .post(`/api/images/upload/${productId}`)
        .field('generateAI', 'false')
        .attach('image', testImagePath, 'test-image.jpg');

      expect(imageUploadResponse.status).toBe(200);
      expect(imageUploadResponse.body.success).toBe(true);
      expect(imageUploadResponse.body.data).toHaveProperty('imageId');
      expect(imageUploadResponse.body.data).toHaveProperty('url');

      const imageId = imageUploadResponse.body.data.imageId;
      const imageUrl = imageUploadResponse.body.data.url;

      // Verify the URL is a signed URL
      expect(imageUrl).toContain('amazonaws.com');
      expect(imageUrl).toContain('X-Amz-Signature');

      // Step 3: Retrieve the product and verify image is attached
      const retrieveProductResponse = await request(app)
        .get(`/api/products/${productId}`);

      expect(retrieveProductResponse.status).toBe(200);
      expect(retrieveProductResponse.body.success).toBe(true);
      expect(retrieveProductResponse.body.data.images).toHaveLength(1);
      expect(retrieveProductResponse.body.data.primaryImageId).toBe(imageId);

      // Step 4: Get images for the product
      const getImagesResponse = await request(app)
        .get(`/api/images/${productId}`);

      expect(getImagesResponse.status).toBe(200);
      expect(getImagesResponse.body.success).toBe(true);
      expect(getImagesResponse.body.data.images).toHaveLength(1);
      expect(getImagesResponse.body.data.primaryImageId).toBe(imageId);

      // Step 5: Delete the image
      const deleteImageResponse = await request(app)
        .delete(`/api/images/${productId}/${imageId}`);

      expect(deleteImageResponse.status).toBe(200);
      expect(deleteImageResponse.body.success).toBe(true);

      // Step 6: Verify image was deleted
      const finalProductResponse = await request(app)
        .get(`/api/products/${productId}`);

      expect(finalProductResponse.status).toBe(200);
      expect(finalProductResponse.body.data.images).toHaveLength(0);
      expect(finalProductResponse.body.data.primaryImageId).toBeNull();
    }, 60000); // Extended timeout for full workflow

    it('should upload image with AI generation (mocked)', async () => {
      // Mock AI service to avoid external dependencies
      jest.doMock('../../services/aiService', () => ({
        generateProductDescription: jest.fn().mockResolvedValue({
          title: 'AI Generated Test Title',
          description: 'AI Generated Test Description',
          confidence: 0.95,
          model: 'TestModel',
          generatedAt: new Date()
        })
      }));

      // Create product
      const productResponse = await request(app)
        .post('/api/products')
        .send({
          name: 'AI Test Product',
          type: 'cushion-covers',
          quantity: 5,
          price: 19.99
        });

      expect(productResponse.status).toBe(201);
      const testProductId = productResponse.body.data._id;

      // Upload with AI generation
      const imageUploadResponse = await request(app)
        .post(`/api/images/upload/${testProductId}`)
        .field('generateAI', 'true')
        .attach('image', testImagePath, 'ai-test-image.jpg');

      expect(imageUploadResponse.status).toBe(200);
      expect(imageUploadResponse.body.success).toBe(true);
      
      // Note: AI generation might fail in test environment, so we just check it doesn't break the upload
      expect(imageUploadResponse.body.data).toHaveProperty('imageId');
      expect(imageUploadResponse.body.data).toHaveProperty('url');
    }, 45000);

    it('should handle multiple image uploads for single product', async () => {
      // Create product
      const productResponse = await request(app)
        .post('/api/products')
        .send({
          name: 'Multi-Image Product',
          type: 'towels',
          quantity: 8,
          price: 24.99
        });

      const testProductId = productResponse.body.data._id;
      const imageIds = [];

      // Upload first image
      const firstUpload = await request(app)
        .post(`/api/images/upload/${testProductId}`)
        .field('generateAI', 'false')
        .attach('image', testImagePath, 'first-image.jpg');

      expect(firstUpload.status).toBe(200);
      imageIds.push(firstUpload.body.data.imageId);

      // Upload second image
      const secondUpload = await request(app)
        .post(`/api/images/upload/${testProductId}`)
        .field('generateAI', 'false')
        .attach('image', testImagePath, 'second-image.jpg');

      expect(secondUpload.status).toBe(200);
      imageIds.push(secondUpload.body.data.imageId);

      // Verify both images are attached
      const productCheck = await request(app)
        .get(`/api/products/${testProductId}`);

      expect(productCheck.body.data.images).toHaveLength(2);
      expect(productCheck.body.data.primaryImageId).toBe(imageIds[0]); // First image should be primary

      // Change primary image
      const setPrimaryResponse = await request(app)
        .put(`/api/images/${testProductId}/${imageIds[1]}/set-primary`);

      expect(setPrimaryResponse.status).toBe(200);

      // Verify primary image changed
      const finalCheck = await request(app)
        .get(`/api/products/${testProductId}`);

      expect(finalCheck.body.data.primaryImageId).toBe(imageIds[1]);
    }, 60000);
  });

  describe('Error Handling in Integration', () => {
    it('should handle invalid image files gracefully', async () => {
      if (!productId) {
        // Create a product for this test
        const productResponse = await request(app)
          .post('/api/products')
          .send({
            name: 'Error Test Product',
            type: 'napkins',
            quantity: 1,
            price: 9.99
          });
        productId = productResponse.body.data._id;
      }

      // Try to upload non-image file
      const textFilePath = path.join(__dirname, '../fixtures/test.txt');
      fs.writeFileSync(textFilePath, 'This is not an image');

      const uploadResponse = await request(app)
        .post(`/api/images/upload/${productId}`)
        .attach('image', textFilePath, 'test.txt');

      // Should be rejected by multer file filter
      expect(uploadResponse.status).toBe(500);

      // Clean up
      fs.unlinkSync(textFilePath);
    }, 30000);

    it('should handle upload to non-existent product', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      
      const uploadResponse = await request(app)
        .post(`/api/images/upload/${nonExistentId}`)
        .attach('image', testImagePath, 'test-image.jpg');

      expect(uploadResponse.status).toBe(404);
      expect(uploadResponse.body.success).toBe(false);
      expect(uploadResponse.body.message).toBe('Product not found');
    }, 30000);
  });
});
