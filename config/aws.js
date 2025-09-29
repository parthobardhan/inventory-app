const { S3Client, DeleteObjectCommand, GetBucketLocationCommand, HeadBucketCommand, CreateBucketCommand } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

// S3 bucket configuration
const S3_BUCKET = process.env.S3_BUCKET_NAME || 'textile-inventory-images';

// Function to get bucket region by trying different regions
async function getBucketRegion(bucketName) {
  console.log(`🔍 Detecting region for bucket: ${bucketName}`);
  
  // List of common AWS regions to try
  const commonRegions = [
    'us-east-1',
    'us-west-1', 
    'us-west-2',
    'eu-west-1',
    'eu-west-2',
    'eu-central-1',
    'ap-south-1',
    'ap-southeast-1',
    'ap-southeast-2',
    'ap-northeast-1'
  ];

  // If AWS_REGION is set, try that first
  if (process.env.AWS_REGION) {
    commonRegions.unshift(process.env.AWS_REGION);
  }

  // Try each region until we find one that works
  for (const region of commonRegions) {
    try {
      console.log(`   Trying region: ${region}`);
      
      const tempS3Client = new S3Client({
        region: region,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          ...(process.env.AWS_SESSION_TOKEN && { sessionToken: process.env.AWS_SESSION_TOKEN })
        }
      });

      // Try a simple operation to test if the region is correct
      const command = new HeadBucketCommand({ Bucket: bucketName });
      await tempS3Client.send(command);
      
      console.log(`   ✅ Found correct region: ${region}`);
      return region;
      
    } catch (error) {
      console.log(`   ❌ Region ${region} failed: ${error.name}`);
      
      // If it's not a region-related error, break and return this region anyway
      if (!error.message.includes('PermanentRedirect') && 
          !error.message.includes('endpoint') && 
          !error.message.includes('region')) {
        console.log(`   ⚠️  Non-region error in ${region}, but bucket might exist there`);
        return region;
      }
    }
  }

  // If all regions fail, return the configured or default region
  const fallbackRegion = process.env.AWS_REGION || 'us-east-1';
  console.warn(`⚠️  Could not detect region for ${bucketName}, using fallback: ${fallbackRegion}`);
  return fallbackRegion;
}

// Function to create bucket if it doesn't exist (AWS SDK v3)
async function createBucketIfNotExists(bucketName, region = 'us-east-1') {
  try {
    console.log(`📦 Checking if bucket '${bucketName}' exists...`);
    
    // Create a temporary client for this operation
    const tempS3Client = new S3Client({
      region: region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        ...(process.env.AWS_SESSION_TOKEN && { sessionToken: process.env.AWS_SESSION_TOKEN })
      }
    });
    
    // Try to check if bucket exists
    const headCommand = new HeadBucketCommand({ Bucket: bucketName });
    await tempS3Client.send(headCommand);
    console.log(`✅ Bucket '${bucketName}' already exists`);
    return true;
    
  } catch (error) {
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      console.log(`📦 Bucket '${bucketName}' doesn't exist, creating...`);
      
      try {
        const tempS3Client = new S3Client({
          region: region,
          credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            ...(process.env.AWS_SESSION_TOKEN && { sessionToken: process.env.AWS_SESSION_TOKEN })
          }
        });
        
        const createParams = { Bucket: bucketName };
        
        // Only add LocationConstraint for regions other than us-east-1
        if (region !== 'us-east-1') {
          createParams.CreateBucketConfiguration = {
            LocationConstraint: region
          };
        }
        
        const createCommand = new CreateBucketCommand(createParams);
        await tempS3Client.send(createCommand);
        console.log(`✅ Bucket '${bucketName}' created successfully in region ${region}`);
        return true;
        
      } catch (createError) {
        console.error('❌ Error creating bucket:', createError.message);
        return false;
      }
    } else if (error.name === 'Forbidden' || error.$metadata?.httpStatusCode === 403) {
      console.log(`⚠️  Bucket '${bucketName}' exists but access denied - continuing anyway`);
      return true;
    } else {
      console.error('❌ Error checking/creating bucket:', error.message);
      return false;
    }
  }
}

// Initialize S3 client with proper region detection
let s3Client;
let bucketRegion;

async function initializeS3Client() {
  try {
    // First, try to detect the bucket region
    bucketRegion = await getBucketRegion(S3_BUCKET);
    console.log(`✅ Detected S3 bucket region: ${bucketRegion}`);
    
    // Try to create bucket if it doesn't exist
    const bucketCreated = await createBucketIfNotExists(S3_BUCKET, bucketRegion);
    if (!bucketCreated) {
      console.warn('⚠️  Bucket creation failed, but continuing with S3 client initialization');
    }
    
    s3Client = new S3Client({
      region: bucketRegion,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        ...(process.env.AWS_SESSION_TOKEN && { sessionToken: process.env.AWS_SESSION_TOKEN })
      }
    });
    
    return s3Client;
  } catch (error) {
    console.error('❌ Failed to initialize S3 client:', error.message);
    // Fallback to configured region
    const fallbackRegion = process.env.AWS_REGION || 'us-east-1';
    console.log(`⚠️  Using fallback region: ${fallbackRegion}`);
    
    // Try to create bucket in fallback region
    const bucketCreated = await createBucketIfNotExists(S3_BUCKET, fallbackRegion);
    if (!bucketCreated) {
      console.warn('⚠️  Bucket creation failed in fallback region');
    }
    
    s3Client = new S3Client({
      region: fallbackRegion,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        ...(process.env.AWS_SESSION_TOKEN && { sessionToken: process.env.AWS_SESSION_TOKEN })
      }
    });
    
    return s3Client;
  }
}

// Initialize the client
initializeS3Client().catch(console.error);

// Function to get S3 client (ensure it's initialized)
function getS3Client() {
  if (!s3Client) {
    throw new Error('S3 client not initialized. Please wait for initialization to complete.');
  }
  return s3Client;
}

// Custom multer storage for AWS SDK v3
const multerS3Storage = {
  _handleFile: async (req, file, cb) => {
    try {
      // Ensure S3 client is initialized
      const client = getS3Client();
      
      const uniqueId = uuidv4();
      const extension = file.originalname.split('.').pop();
      const key = `products/${Date.now()}-${uniqueId}.${extension}`;

      const upload = new Upload({
        client: client,
        params: {
          Bucket: S3_BUCKET,
          Key: key,
          Body: file.stream,
          ContentType: file.mimetype
          // Removed ACL since bucket doesn't allow ACLs
        }
      });

      console.log(`📤 Uploading to S3: ${S3_BUCKET}/${key} in region ${bucketRegion}`);
      const result = await upload.done();
      console.log(`✅ Successfully uploaded to S3: ${result.Location || key}`);

      // Generate a signed URL for the uploaded image (valid for 24 hours)
      const signedUrl = await getSignedUrlForKey(key, 86400); // 24 hours

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
      console.error('❌ S3 upload failed:', error.message);
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
    const client = getS3Client();
    const command = new DeleteObjectCommand({
      Bucket: S3_BUCKET,
      Key: s3Key
    });
    await client.send(command);
    console.log(`🗑️  Successfully deleted from S3: ${s3Key}`);
    return true;
  } catch (error) {
    console.error('❌ Error deleting from S3:', error.message);
    return false;
  }
};

// Function to get signed URL for private images (if needed)
const { getSignedUrl: getSignedUrlV3 } = require('@aws-sdk/s3-request-presigner');
const { GetObjectCommand } = require('@aws-sdk/client-s3');

const getSignedUrlForKey = async (s3Key, expires = 3600) => {
  try {
    const client = getS3Client();
    const command = new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: s3Key
    });
    const signedUrl = await getSignedUrlV3(client, command, { expiresIn: expires });
    console.log(`🔗 Generated signed URL for: ${s3Key}`);
    return signedUrl;
  } catch (error) {
    console.error('❌ Error generating signed URL:', error.message);
    return null;
  }
};

// Legacy function name for backward compatibility
const getSignedUrl = getSignedUrlForKey;

module.exports = {
  getS3Client,
  s3Client: () => getS3Client(), // Dynamic getter for S3 client
  upload,
  deleteFromS3,
  getSignedUrl,
  getSignedUrlForKey,
  S3_BUCKET,
  initializeS3Client,
  getBucketRegion,
  createBucketIfNotExists
};
