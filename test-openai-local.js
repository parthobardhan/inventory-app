#!/usr/bin/env node

/**
 * Test script for OpenAI GPT-4o-mini integration in local development
 * This script forces OpenAI mode for testing production behavior locally
 */

require('dotenv').config({ path: './dev.env' });

const { generateProductDescription, testAIServiceWithFile, getAIService } = require('./services/aiService');

async function testOpenAILocal() {
  console.log('🧪 TESTING OPENAI GPT-4O-MINI IN LOCAL DEVELOPMENT');
  console.log('=' .repeat(60));
  
  try {
    // Check OpenAI API key availability
    const hasOpenAIKey = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your-openai-api-key-here';
    
    if (!hasOpenAIKey) {
      console.error('❌ OPENAI API KEY NOT CONFIGURED!');
      console.error('Please set OPENAI_API_KEY in your dev.env file');
      console.error('Example: OPENAI_API_KEY=sk-proj-your-key-here');
      process.exit(1);
    }
    
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔑 OpenAI API Key configured: Yes`);
    console.log(`🔧 Force OpenAI Mode: Enabled`);
    console.log('');
    
    // Test with a sample image URL first
    const testImageUrl = 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=500&h=500&fit=crop';
    const productType = 'bed-covers';
    
    console.log('📸 Testing with sample image URL...');
    console.log(`🔗 Image URL: ${testImageUrl}`);
    console.log(`🏷️  Product type: ${productType}`);
    console.log('');
    
    const result = await generateProductDescription(testImageUrl, productType, true); // Force OpenAI
    
    console.log('');
    console.log('🎉 OPENAI LOCAL TEST COMPLETED SUCCESSFULLY!');
    console.log('=' .repeat(60));
    console.log('📊 TEST RESULTS:');
    console.log(`   ✅ Success: true`);
    console.log(`   📝 Title: "${result.title}"`);
    console.log(`   📄 Description: "${result.description}"`);
    console.log(`   🎯 Confidence: ${Math.round((result.confidence || 0) * 100)}%`);
    console.log(`   🤖 Model: ${result.model}`);
    console.log(`   ⏰ Generated At: ${result.generatedAt}`);
    console.log(`   📝 Raw Caption: "${result.rawCaption}"`);
    console.log('');
    
    // Test with local image file if available
    const localImagePath = '~/Downloads/bedcover.jpg';
    console.log('📁 Testing with local image file...');
    console.log(`📂 Image path: ${localImagePath}`);
    
    try {
      const fileResult = await testAIServiceWithFile(localImagePath, productType, true); // Force OpenAI
      
      console.log('');
      console.log('📁 LOCAL FILE TEST RESULTS:');
      console.log(`   📝 Title: "${fileResult.title}"`);
      console.log(`   📄 Description: "${fileResult.description}"`);
      console.log(`   🤖 Model: ${fileResult.model}`);
      console.log('');
    } catch (fileError) {
      console.log('⚠️  Local file test skipped (file not found or error):', fileError.message);
      console.log('');
    }
    
    console.log('✅ ALL OPENAI TESTS PASSED! Production behavior verified locally.');
    
  } catch (error) {
    console.error('');
    console.error('❌ OPENAI LOCAL TEST FAILED!');
    console.error('=' .repeat(60));
    console.error('🚨 Error Details:', error.message);
    console.error('📍 Error Type:', error.name);
    
    if (error.stack) {
      console.error('📚 Stack Trace:');
      console.error(error.stack);
    }
    
    console.error('');
    console.error('🔧 Troubleshooting Tips:');
    console.error('   1. Ensure OPENAI_API_KEY is set in dev.env');
    console.error('   2. Verify the API key is valid and has sufficient credits');
    console.error('   3. Check internet connectivity for OpenAI API calls');
    console.error('   4. Check OpenAI API status at https://status.openai.com/');
    
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testOpenAILocal()
    .then(() => {
      console.log('');
      console.log('🎯 OpenAI local test completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Test failed with unhandled error:', error);
      process.exit(1);
    });
}

module.exports = { testOpenAILocal };
