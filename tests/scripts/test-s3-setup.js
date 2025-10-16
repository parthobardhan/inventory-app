require('dotenv').config({ path: './dev.env' });
const { initializeS3Client, getBucketRegion, getS3Client, S3_BUCKET } = require('./config/aws');
const { ListObjectsV2Command } = require('@aws-sdk/client-s3');

async function testS3Setup() {
  console.log('🧪 TESTING S3 SETUP AND REGION DETECTION');
  console.log('=' .repeat(60));
  console.log('📅 Test Date:', new Date().toLocaleString());
  console.log('🪣 S3 Bucket:', S3_BUCKET);
  console.log('🔧 Configured AWS Region:', process.env.AWS_REGION);
  console.log('=' .repeat(60));

  try {
    // Step 1: Detect bucket region
    console.log('\n🔍 Step 1: Detecting bucket region...');
    const detectedRegion = await getBucketRegion(S3_BUCKET);
    console.log(`✅ Detected region: ${detectedRegion}`);

    // Step 2: Initialize S3 client
    console.log('\n🚀 Step 2: Initializing S3 client...');
    await initializeS3Client();
    console.log('✅ S3 client initialized successfully');

    // Step 3: Test S3 client connection
    console.log('\n🔗 Step 3: Testing S3 connection...');
    const s3Client = getS3Client();
    
    // Try to list objects in the bucket (limit to 1 for testing)
    const listCommand = new ListObjectsV2Command({
      Bucket: S3_BUCKET,
      MaxKeys: 1
    });

    const listResult = await s3Client.send(listCommand);
    console.log(`✅ Successfully connected to S3 bucket`);
    console.log(`📊 Bucket contains ${listResult.KeyCount || 0} objects (showing max 1)`);
    
    if (listResult.Contents && listResult.Contents.length > 0) {
      console.log(`📄 Sample object: ${listResult.Contents[0].Key}`);
      console.log(`📏 Sample object size: ${listResult.Contents[0].Size} bytes`);
    }

    // Step 4: Test credentials
    console.log('\n🔐 Step 4: Validating credentials...');
    console.log(`   Access Key ID: ${process.env.AWS_ACCESS_KEY_ID ? '✅ Present' : '❌ Missing'}`);
    console.log(`   Secret Access Key: ${process.env.AWS_SECRET_ACCESS_KEY ? '✅ Present' : '❌ Missing'}`);
    console.log(`   Session Token: ${process.env.AWS_SESSION_TOKEN ? '✅ Present' : '⚠️  Not set (may be optional)'}`);

    console.log('\n🎉 S3 SETUP TEST COMPLETED SUCCESSFULLY!');
    console.log('=' .repeat(60));
    console.log('✅ Region detection: Working');
    console.log('✅ S3 client initialization: Working');
    console.log('✅ S3 bucket connection: Working');
    console.log('✅ Credentials: Valid');
    console.log('\n💡 Image uploads should now work correctly!');
    
    return true;

  } catch (error) {
    console.error('\n❌ S3 SETUP TEST FAILED!');
    console.error('🚨 Error Details:', error.message);
    console.error('📍 Error Type:', error.name);
    console.error('❌ Full error:', error);

    console.log('\n🔧 TROUBLESHOOTING SUGGESTIONS:');
    
    if (error.message.includes('credentials')) {
      console.log('   • Check your AWS credentials in dev.env');
      console.log('   • Verify AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY');
      console.log('   • If using temporary credentials, check AWS_SESSION_TOKEN');
    }
    
    if (error.message.includes('bucket') || error.message.includes('NoSuchBucket')) {
      console.log('   • Verify the S3 bucket name is correct');
      console.log('   • Check if the bucket exists in your AWS account');
      console.log('   • Ensure you have permission to access the bucket');
    }
    
    if (error.message.includes('region')) {
      console.log('   • The bucket region detection may have failed');
      console.log('   • Try setting AWS_REGION explicitly in dev.env');
      console.log('   • Common regions: us-east-1, us-west-2, eu-west-1');
    }

    console.log('\n   • Current bucket name:', S3_BUCKET);
    console.log('   • Current configured region:', process.env.AWS_REGION || 'us-east-1 (default)');
    
    return false;
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testS3Setup()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('\n💥 TEST CRASHED:', error);
      process.exit(1);
    });
}

module.exports = { testS3Setup };
