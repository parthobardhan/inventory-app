#!/usr/bin/env node

/**
 * Test script for AI service integration
 * This script tests both OpenAI (production) and Ollama (development) configurations
 */

require('dotenv').config({ path: './dev.env' });

const { generateProductDescription, testAIServiceWithFile, getAIService } = require('./services/aiService');

async function testAIService(forceOpenAI = false) {
  console.log('🧪 TESTING AI SERVICE INTEGRATION');
  console.log('=' .repeat(60));
  
  try {
    // Check which AI service will be used
    const aiService = getAIService(forceOpenAI);
    console.log(`🤖 AI Service: ${aiService.toUpperCase()}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔑 OpenAI API Key configured: ${process.env.OPENAI_API_KEY ? 'Yes' : 'No'}`);
    if (forceOpenAI) {
      console.log(`🔧 Force OpenAI Mode: ${forceOpenAI ? 'Enabled' : 'Disabled'}`);
    }
    console.log('');
    
    if (aiService === 'openai') {
      if (forceOpenAI) {
        console.log('✅ Using OpenAI GPT-4o-mini (forced for local testing)');
      } else {
        console.log('✅ Using OpenAI GPT-4o-mini for production');
      }
    } else {
      console.log('✅ Using Ollama LLaVA for development');
    }
    
    // Test with a sample image URL
    const testImageUrl = 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=500&h=500&fit=crop';
    const productType = 'bed-covers';
    
    console.log('📸 Testing with sample image...');
    console.log(`🔗 Image URL: ${testImageUrl}`);
    console.log(`🏷️  Product type: ${productType}`);
    console.log('');
    
    const result = await generateProductDescription(testImageUrl, productType, forceOpenAI);
    
    console.log('');
    console.log('🎉 AI SERVICE TEST COMPLETED SUCCESSFULLY!');
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
    
    console.log('✅ AI SERVICE IS WORKING CORRECTLY!');
    
  } catch (error) {
    console.error('');
    console.error('❌ AI SERVICE TEST FAILED!');
    console.error('=' .repeat(60));
    console.error('🚨 Error Details:', error.message);
    console.error('📍 Error Type:', error.name);
    
    if (error.stack) {
      console.error('📚 Stack Trace:');
      console.error(error.stack);
    }
    
    console.error('');
    console.error('🔧 Troubleshooting Tips:');
    console.error('   1. For OpenAI: Ensure OPENAI_API_KEY is set and valid');
    console.error('   2. For Ollama: Ensure Ollama is running with LLaVA model');
    console.error('   3. Check internet connectivity for API calls');
    console.error('   4. Verify environment variables are properly configured');
    
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testAIService()
    .then(() => {
      console.log('');
      console.log('🎯 Test completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Test failed with unhandled error:', error);
      process.exit(1);
    });
}

module.exports = { testAIService };
