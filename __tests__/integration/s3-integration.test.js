const fs = require('fs');
const path = require('path');

// Integration tests - test actual S3 functionality
// These tests require AWS credentials and will create/delete actual S3 resources

describe('S3 Integration Tests', () => {
  let awsModule;
  const testBucketName = `test-s3-integration-${Date.now()}`;
  const testImagePath = path.join(__dirname, '../fixtures/test-image.jpg');

  beforeAll(async () => {
    // Skip integration tests if no AWS credentials
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      console.log('⚠️  Skipping S3 integration tests - AWS credentials not provided');
      return;
    }

    // Create test image fixture
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

    // Set test environment
    process.env.S3_BUCKET_NAME = testBucketName;
    process.env.AWS_REGION = 'us-east-1';

    // Require the module after setting environment
    awsModule = require('../../config/aws');
  });

  afterAll(async () => {
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      return;
    }

    // Clean up test image
    if (fs.existsSync(testImagePath)) {
      fs.unlinkSync(testImagePath);
    }

    // Clean up test bucket if created
    try {
      const s3Client = awsModule.getS3Client();
      if (s3Client) {
        const { DeleteBucketCommand } = require('@aws-sdk/client-s3');
        await s3Client.send(new DeleteBucketCommand({ Bucket: testBucketName }));
        console.log(`✅ Cleaned up test bucket: ${testBucketName}`);
      }
    } catch (error) {
      console.warn(`⚠️  Could not clean up test bucket: ${error.message}`);
    }
  });

  beforeEach(() => {
    // Skip if no credentials
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      pending('AWS credentials not provided');
    }
  });

  describe('Bucket Operations', () => {
    it('should create bucket if it does not exist', async () => {
      const bucketCreated = await awsModule.createBucketIfNotExists(testBucketName, 'us-east-1');
      expect(bucketCreated).toBe(true);
    }, 30000);

    it('should detect existing bucket', async () => {
      // First ensure bucket exists
      await awsModule.createBucketIfNotExists(testBucketName, 'us-east-1');
      
      // Then check it exists
      const bucketExists = await awsModule.createBucketIfNotExists(testBucketName, 'us-east-1');
      expect(bucketExists).toBe(true);
    }, 30000);

    it('should detect bucket region', async () => {
      // Ensure bucket exists first
      await awsModule.createBucketIfNotExists(testBucketName, 'us-east-1');
      
      const detectedRegion = await awsModule.getBucketRegion(testBucketName);
      expect(detectedRegion).toBe('us-east-1');
    }, 30000);
  });

  describe('S3 Client Initialization', () => {
    it('should initialize S3 client successfully', async () => {
      const client = await awsModule.initializeS3Client();
      expect(client).toBeDefined();
      expect(typeof client.send).toBe('function');
    }, 30000);

    it('should return initialized S3 client', () => {
      const client = awsModule.getS3Client();
      expect(client).toBeDefined();
      expect(typeof client.send).toBe('function');
    });
  });

  describe('File Upload and Download', () => {
    const testKey = `test-images/integration-test-${Date.now()}.jpg`;

    it('should generate signed URL for existing object', async () => {
      // First upload a test file
      const { PutObjectCommand } = require('@aws-sdk/client-s3');
      const client = awsModule.getS3Client();
      const fileContent = fs.readFileSync(testImagePath);
      
      await client.send(new PutObjectCommand({
        Bucket: testBucketName,
        Key: testKey,
        Body: fileContent,
        ContentType: 'image/jpeg'
      }));

      // Now generate signed URL
      const signedUrl = await awsModule.getSignedUrlForKey(testKey, 3600);
      expect(signedUrl).toBeDefined();
      expect(signedUrl).toContain(testBucketName);
      expect(signedUrl).toContain(testKey);
      expect(signedUrl).toContain('X-Amz-Signature');
    }, 30000);

    it('should delete object from S3', async () => {
      // Upload test file first (if not already uploaded)
      const { PutObjectCommand } = require('@aws-sdk/client-s3');
      const client = awsModule.getS3Client();
      const fileContent = fs.readFileSync(testImagePath);
      
      await client.send(new PutObjectCommand({
        Bucket: testBucketName,
        Key: testKey + '-delete-test',
        Body: fileContent,
        ContentType: 'image/jpeg'
      }));

      // Delete the file
      const deleteResult = await awsModule.deleteFromS3(testKey + '-delete-test');
      expect(deleteResult).toBe(true);
    }, 30000);

    it('should handle delete of non-existent object gracefully', async () => {
      const deleteResult = await awsModule.deleteFromS3('non-existent-key.jpg');
      expect(deleteResult).toBe(true); // S3 returns success even for non-existent objects
    }, 30000);
  });

  describe('Multer Integration', () => {
    it('should have properly configured multer upload middleware', () => {
      const upload = awsModule.upload;
      expect(upload).toBeDefined();
      expect(typeof upload.single).toBe('function');
      expect(typeof upload.array).toBe('function');
      expect(typeof upload.fields).toBe('function');
    });

    it('should have correct file size limits', () => {
      const upload = awsModule.upload;
      expect(upload.options.limits.fileSize).toBe(10 * 1024 * 1024); // 10MB
    });

    it('should have correct file filter for images', () => {
      const upload = awsModule.upload;
      const fileFilter = upload.options.fileFilter;
      
      // Test valid image file
      const validFile = { mimetype: 'image/jpeg' };
      let result;
      fileFilter(null, validFile, (error, accepted) => {
        result = { error, accepted };
      });
      expect(result.error).toBeNull();
      expect(result.accepted).toBe(true);

      // Test invalid file
      const invalidFile = { mimetype: 'application/pdf' };
      fileFilter(null, invalidFile, (error, accepted) => {
        result = { error, accepted };
      });
      expect(result.error).toBeTruthy();
      expect(result.accepted).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid bucket names gracefully', async () => {
      const invalidBucketName = 'Invalid-Bucket-Name-With-UPPERCASE';
      const result = await awsModule.createBucketIfNotExists(invalidBucketName);
      expect(result).toBe(false);
    }, 30000);

    it('should handle network errors gracefully', async () => {
      // Temporarily break the connection by using invalid credentials
      const originalAccessKey = process.env.AWS_ACCESS_KEY_ID;
      process.env.AWS_ACCESS_KEY_ID = 'invalid-key';

      // Reset modules to pick up new environment
      jest.resetModules();
      const brokenAwsModule = require('../../config/aws');
      
      const result = await brokenAwsModule.getBucketRegion('any-bucket');
      expect(result).toBe('us-east-1'); // Should return fallback

      // Restore original credentials
      process.env.AWS_ACCESS_KEY_ID = originalAccessKey;
    }, 30000);
  });
});
