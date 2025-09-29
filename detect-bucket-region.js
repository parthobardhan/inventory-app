require('dotenv').config({ path: './dev.env' });
const { S3Client, HeadBucketCommand } = require('@aws-sdk/client-s3');

const S3_BUCKET = process.env.S3_BUCKET_NAME || 'partho-inventory-images';

async function detectBucketRegion() {
  console.log('🔍 S3 BUCKET REGION DETECTOR');
  console.log('=' .repeat(50));
  console.log('🪣 Bucket Name:', S3_BUCKET);
  console.log('🔐 Access Key:', process.env.AWS_ACCESS_KEY_ID ? 'Present' : 'Missing');
  console.log('=' .repeat(50));

  // List of AWS regions to test
  const regions = [
    'us-east-1',      // N. Virginia
    'us-east-2',      // Ohio  
    'us-west-1',      // N. California
    'us-west-2',      // Oregon
    'ca-central-1',   // Canada
    'eu-west-1',      // Ireland
    'eu-west-2',      // London
    'eu-west-3',      // Paris
    'eu-central-1',   // Frankfurt
    'eu-north-1',     // Stockholm
    'ap-south-1',     // Mumbai
    'ap-southeast-1', // Singapore
    'ap-southeast-2', // Sydney
    'ap-northeast-1', // Tokyo
    'ap-northeast-2', // Seoul
    'ap-northeast-3', // Osaka
    'sa-east-1',      // São Paulo
    'me-south-1',     // Bahrain
    'af-south-1',     // Cape Town
  ];

  // If AWS_REGION is configured, test it first
  if (process.env.AWS_REGION && !regions.includes(process.env.AWS_REGION)) {
    regions.unshift(process.env.AWS_REGION);
  }

  console.log(`\n🔄 Testing ${regions.length} regions...\n`);

  for (const region of regions) {
    try {
      console.log(`   Testing ${region.padEnd(20)} ... `, { end: '' });

      const s3Client = new S3Client({
        region: region,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          ...(process.env.AWS_SESSION_TOKEN && { sessionToken: process.env.AWS_SESSION_TOKEN })
        }
      });

      const command = new HeadBucketCommand({ Bucket: S3_BUCKET });
      await s3Client.send(command);

      console.log('✅ SUCCESS!');
      console.log('\n🎉 BUCKET FOUND!');
      console.log('=' .repeat(50));
      console.log(`✅ Bucket: ${S3_BUCKET}`);
      console.log(`✅ Region: ${region}`);
      console.log('=' .repeat(50));
      
      console.log('\n💡 UPDATE YOUR dev.env FILE:');
      console.log(`AWS_REGION=${region}`);
      
      return region;

    } catch (error) {
      if (error.name === 'PermanentRedirect') {
        console.log('❌ Wrong region');
      } else if (error.name === 'NoSuchBucket') {
        console.log('❌ Bucket not found');
      } else if (error.name === 'Forbidden') {
        console.log('❌ Access denied');
      } else {
        console.log(`❌ ${error.name}`);
      }
      
      // For non-region errors, we might have found the right region
      if (error.name !== 'PermanentRedirect' && error.name !== 'NoSuchBucket') {
        console.log(`   ⚠️  Potential region (non-redirect error): ${region}`);
      }
    }
  }

  console.log('\n❌ BUCKET REGION NOT FOUND');
  console.log('=' .repeat(50));
  console.log('\n🔧 POSSIBLE ISSUES:');
  console.log('   • Bucket name is incorrect');
  console.log('   • Bucket is in a different AWS account');
  console.log('   • AWS credentials are invalid');
  console.log('   • Bucket is in a region not tested');
  console.log('\n💡 SUGGESTIONS:');
  console.log('   • Check bucket name in AWS Console');
  console.log('   • Verify AWS credentials');
  console.log('   • Check bucket region in AWS Console');
  
  return null;
}

// Run if called directly
if (require.main === module) {
  detectBucketRegion()
    .then((region) => {
      process.exit(region ? 0 : 1);
    })
    .catch((error) => {
      console.error('\n💥 DETECTION CRASHED:', error.message);
      process.exit(1);
    });
}

module.exports = { detectBucketRegion };
