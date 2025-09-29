#!/usr/bin/env node

/**
 * Local LLaVA Image Captioning Test using Ollama
 * 
 * This script tests the LOCAL LLaVA models via Ollama without any fallback options.
 * It will fail if local LLaVA models don't work, ensuring we test only LLaVA functionality.
 */

const { testLLaVAOnly } = require('./services/aiService');
const path = require('path');

async function main() {
  console.log('🚀 Starting LOCAL LLaVA Image Captioning Test (via Ollama)');
  console.log('============================================================');
  
  // Check if Ollama is running
  console.log('🔧 System Requirements:');
  console.log('   📦 Ollama: Required for local LLaVA model');
  console.log('   🤖 LLaVA Model: llava:7b (should be pulled locally)');
  console.log('');
  
  // Test configuration
  const imagePath = '~/Downloads/1754283121679-13613813-a6eb-4ca9-8469-0b241e446952.jpg';
  const productType = 'bed-covers'; // You can change this to test different product types
  
  try {
    console.log('🔧 Test Configuration:');
    console.log(`   📁 Image: ${imagePath}`);
    console.log(`   🏷️  Product Type: ${productType}`);
    console.log(`   🤖 Model: LOCAL LLaVA via Ollama (no fallback)`);
    console.log('');
    
    // Run the LLaVA-only test
    const result = await testLLaVAOnly(imagePath, productType);
    
    console.log('');
    console.log('✅ TEST PASSED - Local LLaVA models are working!');
    console.log('📋 Final Results:');
    console.log('   Caption:', result.caption);
    console.log('   Model:', result.model);
    console.log('   Success:', result.success);
    console.log('   Tested At:', result.testedAt.toISOString());
    
    process.exit(0);
    
  } catch (error) {
    console.log('');
    console.error('❌ TEST FAILED - Local LLaVA models are not working');
    
    if (error.success === false) {
      // This is our structured error object
      console.error('📋 Test Results:');
      console.error('   Image Path:', error.imagePath);
      console.error('   Product Type:', error.productType);
      console.error('   Model:', error.model);
      console.error('   Success:', error.success);
      console.error('   Error:', error.error);
      console.error('   Tested At:', error.testedAt.toISOString());
    } else {
      console.error('💥 Unexpected Error:');
      console.error('   Message:', error.message);
      console.error('   Stack:', error.stack);
    }
    
    console.log('');
    console.log('🔍 Troubleshooting Tips:');
    console.log('1. Check that Ollama is running: `ollama list`');
    console.log('2. Ensure LLaVA model is installed: `ollama pull llava:7b`');
    console.log('3. Verify the image file exists at the specified path');
    console.log('4. Check Ollama service status: `ollama serve`');
    console.log('5. Test Ollama directly: `ollama run llava:7b "describe this image" --image path/to/image.jpg`');
    
    process.exit(1);
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };
