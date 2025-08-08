const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

// Configure AWS S3 Client (v3)
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    ...(process.env.AWS_SESSION_TOKEN && { sessionToken: process.env.AWS_SESSION_TOKEN })
  }
});

// S3 bucket configuration
const S3_BUCKET = process.env.S3_BUCKET_NAME || 'textile-inventory-images';

// Custom multer storage for AWS SDK v3
const multerS3Storage = {
  _handleFile: async (req, file, cb) => {
    try {
      const uniqueId = uuidv4();
      const extension = file.originalname.split('.').pop();
      const key = `products/${Date.now()}-${uniqueId}.${extension}`;

      const upload = new Upload({
        client: s3Client,
        params: {
          Bucket: S3_BUCKET,
          Key: key,
          Body: file.stream,
          ContentType: file.mimetype
          // Removed ACL since bucket doesn't allow ACLs
        }
      });

      const result = await upload.done();

      // Generate a signed URL for the uploaded image (valid for 24 hours)
      const signedUrl = await getSignedUrl(key, 86400); // 24 hours

      cb(null, {
        bucket: S3_BUCKET,
        key: key,
        location: signedUrl,
        etag: result.ETag,
        size: result.ContentLength || 0,
        mimetype: file.mimetype,
        originalname: file.originalname
      });
    } catch (error) {
      cb(error);
    }
  },
  _removeFile: (req, file, cb) => {
    cb(null);
  }
};

// Multer configuration for image uploads
const upload = multer({
  storage: multerS3Storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: function (req, file, cb) {
    // Only allow image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Function to delete image from S3
const deleteFromS3 = async (s3Key) => {
  try {
    const command = new DeleteObjectCommand({
      Bucket: S3_BUCKET,
      Key: s3Key
    });
    await s3Client.send(command);
    return true;
  } catch (error) {
    console.error('Error deleting from S3:', error);
    return false;
  }
};

// Function to get signed URL for private images (if needed)
const { getSignedUrl: getSignedUrlV3 } = require('@aws-sdk/s3-request-presigner');
const { GetObjectCommand } = require('@aws-sdk/client-s3');

const getSignedUrl = async (s3Key, expires = 3600) => {
  try {
    const command = new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: s3Key
    });
    return await getSignedUrlV3(s3Client, command, { expiresIn: expires });
  } catch (error) {
    console.error('Error generating signed URL:', error);
    return null;
  }
};

module.exports = {
  s3Client,
  upload,
  deleteFromS3,
  getSignedUrl,
  S3_BUCKET
};
