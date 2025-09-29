// Mock AWS SDK components before any imports
jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/lib-storage');
jest.mock('@aws-sdk/s3-request-presigner');

const { S3Client, HeadBucketCommand, CreateBucketCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

// Mock implementations
let mockSend;
let mockUploadDone;
let mockGetSignedUrl;

beforeEach(() => {
  jest.clearAllMocks();
  jest.resetModules();
  
  // Mock S3Client and its send method
  mockSend = jest.fn();
  S3Client.mockImplementation(() => ({
    send: mockSend
  }));
  
  // Mock Upload class and its done method
  mockUploadDone = jest.fn();
  Upload.mockImplementation(() => ({
    done: mockUploadDone
  }));
  
  // Mock getSignedUrl
  mockGetSignedUrl = jest.fn();
  getSignedUrl.mockImplementation(mockGetSignedUrl);
});

describe('AWS S3 Configuration', () => {
  let awsModule;
  
  beforeEach(() => {
    // Require the module fresh for each test
    awsModule = require('../../config/aws');
  });

  describe('getBucketRegion', () => {
    it('should detect bucket region successfully', async () => {
      // Mock successful HeadBucketCommand
      mockSend.mockResolvedValueOnce({});
      
      const region = await awsModule.getBucketRegion('test-bucket');
      
      expect(region).toBe('us-east-1');
      expect(S3Client).toHaveBeenCalled();
      expect(mockSend).toHaveBeenCalledWith(expect.any(HeadBucketCommand));
    });

    it('should try multiple regions on PermanentRedirect', async () => {
      // Mock PermanentRedirect error for first few regions, then success
      const redirectError = new Error('PermanentRedirect');
      redirectError.name = 'PermanentRedirect';
      redirectError.message = 'PermanentRedirect';
      
      mockSend
        .mockRejectedValueOnce(redirectError)
        .mockRejectedValueOnce(redirectError)
        .mockResolvedValueOnce({});
      
      const region = await awsModule.getBucketRegion('test-bucket');
      
      expect(S3Client).toHaveBeenCalledTimes(3);
      expect(mockSend).toHaveBeenCalledTimes(3);
    });

    it('should return fallback region when all regions fail', async () => {
      // Mock all regions failing with redirect
      const redirectError = new Error('PermanentRedirect');
      redirectError.name = 'PermanentRedirect';
      redirectError.message = 'PermanentRedirect';
      
      mockSend.mockRejectedValue(redirectError);
      
      const region = await awsModule.getBucketRegion('test-bucket');
      
      expect(region).toBe('us-east-1'); // Fallback region
    });
  });

  describe('createBucketIfNotExists', () => {
    it('should return true if bucket already exists', async () => {
      // Mock successful HeadBucketCommand (bucket exists)
      mockSend.mockResolvedValueOnce({});
      
      const result = await awsModule.createBucketIfNotExists('existing-bucket');
      
      expect(result).toBe(true);
      expect(mockSend).toHaveBeenCalledWith(expect.any(HeadBucketCommand));
    });

    it('should create bucket if it does not exist', async () => {
      // Mock NotFound error for HeadBucketCommand, then successful CreateBucketCommand
      const notFoundError = new Error('NotFound');
      notFoundError.name = 'NotFound';
      notFoundError.$metadata = { httpStatusCode: 404 };
      
      mockSend
        .mockRejectedValueOnce(notFoundError)
        .mockResolvedValueOnce({}); // Successful creation
      
      const result = await awsModule.createBucketIfNotExists('new-bucket', 'us-east-1');
      
      expect(result).toBe(true);
      expect(mockSend).toHaveBeenCalledWith(expect.any(HeadBucketCommand));
      expect(mockSend).toHaveBeenCalledWith(expect.any(CreateBucketCommand));
    });

    it('should create bucket with LocationConstraint for non us-east-1 regions', async () => {
      // Mock NotFound error, then successful creation
      const notFoundError = new Error('NotFound');
      notFoundError.name = 'NotFound';
      notFoundError.$metadata = { httpStatusCode: 404 };
      
      mockSend
        .mockRejectedValueOnce(notFoundError)
        .mockResolvedValueOnce({});
      
      const result = await awsModule.createBucketIfNotExists('new-bucket', 'us-west-2');
      
      expect(result).toBe(true);
      expect(CreateBucketCommand).toHaveBeenCalledWith({
        Bucket: 'new-bucket',
        CreateBucketConfiguration: {
          LocationConstraint: 'us-west-2'
        }
      });
    });

    it('should handle Forbidden errors gracefully', async () => {
      // Mock Forbidden error
      const forbiddenError = new Error('Forbidden');
      forbiddenError.name = 'Forbidden';
      forbiddenError.$metadata = { httpStatusCode: 403 };
      
      mockSend.mockRejectedValueOnce(forbiddenError);
      
      const result = await awsModule.createBucketIfNotExists('forbidden-bucket');
      
      expect(result).toBe(true); // Should continue anyway
    });

    it('should return false on bucket creation failure', async () => {
      // Mock NotFound for head, then error on create
      const notFoundError = new Error('NotFound');
      notFoundError.name = 'NotFound';
      notFoundError.$metadata = { httpStatusCode: 404 };
      
      const createError = new Error('BucketAlreadyExists');
      createError.name = 'BucketAlreadyExists';
      
      mockSend
        .mockRejectedValueOnce(notFoundError)
        .mockRejectedValueOnce(createError);
      
      const result = await awsModule.createBucketIfNotExists('problem-bucket');
      
      expect(result).toBe(false);
    });
  });

  describe('getSignedUrlForKey', () => {
    it('should generate signed URL successfully', async () => {
      const expectedUrl = 'https://test-bucket.s3.amazonaws.com/test-key?signed';
      mockGetSignedUrl.mockResolvedValueOnce(expectedUrl);
      
      // Mock getS3Client to return a client
      const mockClient = { send: mockSend };
      jest.spyOn(awsModule, 'getS3Client').mockReturnValue(mockClient);
      
      const signedUrl = await awsModule.getSignedUrlForKey('test-key', 3600);
      
      expect(signedUrl).toBe(expectedUrl);
      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        mockClient,
        expect.any(GetObjectCommand),
        { expiresIn: 3600 }
      );
    });

    it('should handle signed URL generation errors', async () => {
      const error = new Error('SignedURL generation failed');
      mockGetSignedUrl.mockRejectedValueOnce(error);
      
      const mockClient = { send: mockSend };
      jest.spyOn(awsModule, 'getS3Client').mockReturnValue(mockClient);
      
      const signedUrl = await awsModule.getSignedUrlForKey('test-key');
      
      expect(signedUrl).toBeNull();
    });
  });

  describe('deleteFromS3', () => {
    it('should delete object successfully', async () => {
      mockSend.mockResolvedValueOnce({});
      
      const mockClient = { send: mockSend };
      jest.spyOn(awsModule, 'getS3Client').mockReturnValue(mockClient);
      
      const result = await awsModule.deleteFromS3('test-key');
      
      expect(result).toBe(true);
      expect(mockSend).toHaveBeenCalledWith(expect.any(DeleteObjectCommand));
    });

    it('should handle delete errors gracefully', async () => {
      const error = new Error('Delete failed');
      mockSend.mockRejectedValueOnce(error);
      
      const mockClient = { send: mockSend };
      jest.spyOn(awsModule, 'getS3Client').mockReturnValue(mockClient);
      
      const result = await awsModule.deleteFromS3('test-key');
      
      expect(result).toBe(false);
    });
  });

  describe('multer S3 storage', () => {
    it('should handle file upload successfully', async () => {
      const mockFile = {
        originalname: 'test-image.jpg',
        mimetype: 'image/jpeg',
        stream: Buffer.from('fake image data')
      };
      
      const mockUploadResult = {
        Location: 'https://test-bucket.s3.amazonaws.com/products/test-key',
        Key: 'products/test-key',
        ETag: 'test-etag'
      };
      
      mockUploadDone.mockResolvedValueOnce(mockUploadResult);
      mockGetSignedUrl.mockResolvedValueOnce('https://signed-url.com/test');
      
      const mockClient = { send: mockSend };
      jest.spyOn(awsModule, 'getS3Client').mockReturnValue(mockClient);
      
      // Test the multer storage handler
      const storage = awsModule.upload.options.storage;
      const mockReq = {};
      const mockCallback = jest.fn();
      
      await storage._handleFile(mockReq, mockFile, mockCallback);
      
      expect(Upload).toHaveBeenCalled();
      expect(mockUploadDone).toHaveBeenCalled();
      expect(mockCallback).toHaveBeenCalledWith(null, expect.objectContaining({
        key: expect.stringMatching(/^products\/\d+-.*\.jpg$/),
        location: 'https://signed-url.com/test',
        mimetype: 'image/jpeg',
        originalname: 'test-image.jpg'
      }));
    });

    it('should handle upload errors', async () => {
      const mockFile = {
        originalname: 'test-image.jpg',
        mimetype: 'image/jpeg',
        stream: Buffer.from('fake image data')
      };
      
      const uploadError = new Error('Upload failed');
      mockUploadDone.mockRejectedValueOnce(uploadError);
      
      const mockClient = { send: mockSend };
      jest.spyOn(awsModule, 'getS3Client').mockReturnValue(mockClient);
      
      const storage = awsModule.upload.options.storage;
      const mockReq = {};
      const mockCallback = jest.fn();
      
      await storage._handleFile(mockReq, mockFile, mockCallback);
      
      expect(mockCallback).toHaveBeenCalledWith(uploadError);
    });
  });

  describe('getS3Client', () => {
    it('should throw error if S3 client not initialized', () => {
      // Reset the module to clear any initialized client
      jest.resetModules();
      const freshAwsModule = require('../../config/aws');
      
      expect(() => {
        freshAwsModule.getS3Client();
      }).toThrow('S3 client not initialized');
    });
  });
});
