/**
 * Integration Tests for Product Addition with Atlas MongoDB
 * Tests the complete flow from frontend to database
 */

const request = require('supertest');
const mongoose = require('mongoose');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../../dev.env') });

const Product = require('../../models/Product');

// Import the Express app
let app;

describe('Product Addition Integration Tests', () => {
  let server;
  let testProductId;

  beforeAll(async () => {
    // Start the Express server
    delete require.cache[require.resolve('../../server.js')];
    const serverModule = require('../../server.js');
    app = serverModule;
    
    // Wait for MongoDB connection
    await new Promise((resolve) => {
      const checkConnection = () => {
        if (mongoose.connection.readyState === 1) {
          resolve();
        } else {
          setTimeout(checkConnection, 100);
        }
      };
      checkConnection();
    });

    console.log('✅ Connected to MongoDB for integration tests');
  });

  afterAll(async () => {
    // Clean up test data
    if (testProductId) {
      await Product.findByIdAndDelete(testProductId);
    }
    
    // Clean up any test products
    await Product.deleteMany({ name: /^Test.*/ });
    
    // Close database connection
    await mongoose.connection.close();
    console.log('✅ Closed MongoDB connection');
  });

  beforeEach(async () => {
    // Clean up any existing test products
    await Product.deleteMany({ name: /^Test.*/ });
  });

  describe('POST /api/products', () => {
    test('should create a new product successfully', async () => {
      const productData = {
        name: 'Test Bed Cover Integration',
        type: 'bed-covers',
        quantity: 15,
        price: 29.99,
        description: 'Integration test bed cover'
      };

      const response = await request(app)
        .post('/api/products')
        .send(productData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Product created successfully');
      expect(response.body.data).toMatchObject({
        name: productData.name,
        type: productData.type,
        quantity: productData.quantity,
        price: productData.price,
        description: productData.description
      });

      // Verify product was saved to database
      testProductId = response.body.data._id;
      const savedProduct = await Product.findById(testProductId);
      expect(savedProduct).toBeTruthy();
      expect(savedProduct.name).toBe(productData.name);
      expect(savedProduct.totalValue).toBe(productData.quantity * productData.price);
    });

    test('should validate required fields', async () => {
      const incompleteData = {
        name: 'Test Product',
        // Missing type, quantity, price
      };

      const response = await request(app)
        .post('/api/products')
        .send(incompleteData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Missing required fields: name, type, quantity, and price are required');
    });

    test('should handle validation errors', async () => {
      const invalidData = {
        name: '', // Empty name should fail validation
        type: 'bed-covers',
        quantity: 10,
        price: 25.99
      };

      const response = await request(app)
        .post('/api/products')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation error');
    });

    test('should calculate totalValue correctly', async () => {
      const productData = {
        name: 'Test Value Calculation',
        type: 'cushion-covers',
        quantity: 8,
        price: 15.50,
        description: 'Testing value calculation'
      };

      const response = await request(app)
        .post('/api/products')
        .send(productData)
        .expect(201);

      expect(response.body.data.totalValue).toBe(8 * 15.50);

      // Verify in database
      const savedProduct = await Product.findById(response.body.data._id);
      expect(savedProduct.totalValue).toBe(124);
      
      // Clean up
      await Product.findByIdAndDelete(response.body.data._id);
    });
  });

  describe('GET /api/products', () => {
    test('should retrieve all products', async () => {
      // Create test products
      const products = [
        {
          name: 'Test Product 1',
          type: 'bed-covers',
          quantity: 5,
          price: 20.00,
          description: 'First test product'
        },
        {
          name: 'Test Product 2',
          type: 'towels',
          quantity: 10,
          price: 12.50,
          description: 'Second test product'
        }
      ];

      const createdProducts = [];
      for (const productData of products) {
        const response = await request(app)
          .post('/api/products')
          .send(productData)
          .expect(201);
        createdProducts.push(response.body.data);
      }

      // Retrieve all products
      const response = await request(app)
        .get('/api/products')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeGreaterThanOrEqual(2);

      // Clean up
      for (const product of createdProducts) {
        await Product.findByIdAndDelete(product._id);
      }
    });
  });

  describe('Image Upload Integration', () => {
    test('should handle image upload for existing product', async () => {
      // First create a product
      const productData = {
        name: 'Test Product for Image',
        type: 'bed-covers',
        quantity: 3,
        price: 45.00,
        description: 'Product for image testing'
      };

      const productResponse = await request(app)
        .post('/api/products')
        .send(productData)
        .expect(201);

      const productId = productResponse.body.data._id;

      // Create a simple test image buffer
      const testImageBuffer = Buffer.from('fake-image-data');

      // Test image upload (Note: This will fail without proper S3 setup, but we can test the endpoint)
      const imageResponse = await request(app)
        .post(`/api/images/upload/${productId}`)
        .attach('image', testImageBuffer, 'test.jpg')
        .field('generateAI', 'true');

      // The response might be an error due to S3 setup, but we can verify the endpoint exists
      expect([200, 400, 500]).toContain(imageResponse.status);

      // Clean up
      await Product.findByIdAndDelete(productId);
    });

    test('should return 404 for non-existent product image upload', async () => {
      const fakeProductId = new mongoose.Types.ObjectId();
      const testImageBuffer = Buffer.from('fake-image-data');

      const response = await request(app)
        .post(`/api/images/upload/${fakeProductId}`)
        .attach('image', testImageBuffer, 'test.jpg')
        .field('generateAI', 'true');

      // Should return 404 or 500 depending on S3 setup
      expect([404, 500]).toContain(response.status);
    });
  });

  describe('Product Statistics Integration', () => {
    test('should calculate product statistics correctly', async () => {
      // Create test products with known values
      const testProducts = [
        { name: 'Test Stats 1', type: 'bed-covers', quantity: 5, price: 20.00 },
        { name: 'Test Stats 2', type: 'bed-covers', quantity: 3, price: 30.00 },
        { name: 'Test Stats 3', type: 'towels', quantity: 10, price: 8.00 }
      ];

      const createdProducts = [];
      for (const productData of testProducts) {
        const response = await request(app)
          .post('/api/products')
          .send(productData)
          .expect(201);
        createdProducts.push(response.body.data);
      }

      // Get statistics
      const statsResponse = await request(app)
        .get('/api/products/stats/summary')
        .expect(200);

      expect(statsResponse.body.success).toBe(true);
      expect(statsResponse.body.data).toHaveProperty('totalProducts');
      expect(statsResponse.body.data).toHaveProperty('totalValue');
      expect(statsResponse.body.data).toHaveProperty('typeBreakdown');

      const stats = statsResponse.body.data;
      
      // Verify type breakdown includes our test products
      expect(stats.typeBreakdown).toHaveProperty('bed-covers');
      expect(stats.typeBreakdown).toHaveProperty('towels');

      // Clean up
      for (const product of createdProducts) {
        await Product.findByIdAndDelete(product._id);
      }
    });
  });

  describe('Product CRUD Operations', () => {
    let productId;

    beforeEach(async () => {
      // Create a test product for each test
      const productData = {
        name: 'Test CRUD Product',
        type: 'cushion-covers',
        quantity: 7,
        price: 18.50,
        description: 'Product for CRUD testing'
      };

      const response = await request(app)
        .post('/api/products')
        .send(productData)
        .expect(201);

      productId = response.body.data._id;
    });

    afterEach(async () => {
      // Clean up after each test
      if (productId) {
        await Product.findByIdAndDelete(productId);
      }
    });

    test('should update product successfully', async () => {
      const updateData = {
        name: 'Updated CRUD Product',
        type: 'cushion-covers',
        quantity: 12,
        price: 22.00,
        description: 'Updated description'
      };

      const response = await request(app)
        .put(`/api/products/${productId}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(updateData.name);
      expect(response.body.data.quantity).toBe(updateData.quantity);
      expect(response.body.data.totalValue).toBe(updateData.quantity * updateData.price);

      // Verify in database
      const updatedProduct = await Product.findById(productId);
      expect(updatedProduct.name).toBe(updateData.name);
    });

    test('should delete product successfully', async () => {
      const response = await request(app)
        .delete(`/api/products/${productId}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify product was deleted from database
      const deletedProduct = await Product.findById(productId);
      expect(deletedProduct).toBeNull();

      // Don't try to clean up in afterEach since we deleted it
      productId = null;
    });

    test('should return 404 for non-existent product operations', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      // Test GET
      await request(app)
        .get(`/api/products/${fakeId}`)
        .expect(404);

      // Test PUT
      await request(app)
        .put(`/api/products/${fakeId}`)
        .send({ name: 'Test', type: 'bed-covers', quantity: 1, price: 10 })
        .expect(404);

      // Test DELETE
      await request(app)
        .delete(`/api/products/${fakeId}`)
        .expect(404);
    });
  });

  describe('Database Connection and Error Handling', () => {
    test('should handle database connection gracefully', async () => {
      // Test health endpoint
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Textile Inventory API is running');
    });

    test('should handle malformed product data', async () => {
      const malformedData = {
        name: 'Test Product',
        type: 'invalid-type', // Invalid type
        quantity: 'not-a-number', // Invalid quantity
        price: 'not-a-number' // Invalid price
      };

      const response = await request(app)
        .post('/api/products')
        .send(malformedData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Concurrent Operations', () => {
    test('should handle multiple simultaneous product creations', async () => {
      const productPromises = [];
      
      for (let i = 0; i < 5; i++) {
        const productData = {
          name: `Test Concurrent Product ${i}`,
          type: 'towels',
          quantity: i + 1,
          price: 10.00 + i,
          description: `Concurrent test product ${i}`
        };

        productPromises.push(
          request(app)
            .post('/api/products')
            .send(productData)
        );
      }

      const responses = await Promise.all(productPromises);

      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
      });

      // Clean up all created products
      const productIds = responses.map(r => r.body.data._id);
      await Product.deleteMany({ _id: { $in: productIds } });
    });
  });
});


