#!/usr/bin/env node

/**
 * CLI script for testing AI services with different options
 * Usage: node test-ai-cli.js [mode] [image-path]
 * 
 * Modes:
 * - auto (default): Use automatic service selection
 * - openai: Force OpenAI mode
 * - ollama: Force Ollama mode
 * - both: Test both services
 */

require('dotenv').config({ path: './dev.env' });

const { generateProductDescription, getAIService } = require('./services/aiService');

async function testAICLI() {
  const args = process.argv.slice(2);
  const mode = args[0] || 'auto';
  const imagePath = args[1] || 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=500&h=500&fit=crop';
  
  console.log('🧪 AI SERVICE CLI TESTER');
  console.log('=' .repeat(50));
  console.log(`📋 Mode: ${mode.toUpperCase()}`);
  console.log(`🖼️  Image: ${imagePath}`);
  console.log('');
  
  try {
    switch (mode.toLowerCase()) {
      case 'auto':
        await testAutoMode(imagePath);
        break;
      case 'openai':
        await testOpenAIMode(imagePath);
        break;
      case 'ollama':
        await testOllamaMode(imagePath);
        break;
      case 'both':
        await testBothModes(imagePath);
        break;
      default:
        console.error('❌ Invalid mode. Use: auto, openai, ollama, or both');
        process.exit(1);
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

async function testAutoMode(imagePath) {
  console.log('🤖 Testing automatic service selection...');
  
  // Handle local file paths
  if (imagePath.startsWith('~/') || imagePath.startsWith('/')) {
    console.log('📁 Local file detected, using testAIServiceWithFile...');
    const { testAIServiceWithFile } = require('./services/aiService');
    const result = await testAIServiceWithFile(imagePath, 'bed-covers');
    displayResults(result, 'AUTO');
  } else {
    const result = await generateProductDescription(imagePath, 'bed-covers');
    displayResults(result, 'AUTO');
  }
}

async function testOpenAIMode(imagePath) {
  console.log('🤖 Testing OpenAI mode (forced)...');
  
  // Handle local file paths
  if (imagePath.startsWith('~/') || imagePath.startsWith('/')) {
    console.log('📁 Local file detected, using testAIServiceWithFile...');
    const { testAIServiceWithFile } = require('./services/aiService');
    const result = await testAIServiceWithFile(imagePath, 'bed-covers', true);
    displayResults(result, 'OPENAI (FORCED)');
  } else {
    const result = await generateProductDescription(imagePath, 'bed-covers', true);
    displayResults(result, 'OPENAI (FORCED)');
  }
}

async function testOllamaMode(imagePath) {
  console.log('🤖 Testing Ollama mode...');
  // Force Ollama by setting environment temporarily
  const originalEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'development';
  delete process.env.OPENAI_API_KEY;
  
  try {
    const result = await generateProductDescription(imagePath, 'bed-covers');
    displayResults(result, 'OLLAMA');
  } finally {
    // Restore environment
    process.env.NODE_ENV = originalEnv;
  }
}

async function testBothModes(imagePath) {
  console.log('🤖 Testing both services...');
  console.log('');
  
  // Test OpenAI
  console.log('1️⃣ Testing OpenAI:');
  try {
    const openaiResult = await generateProductDescription(imagePath, 'bed-covers', true);
    displayResults(openaiResult, 'OPENAI');
  } catch (error) {
    console.log('❌ OpenAI test failed:', error.message);
  }
  
  console.log('');
  console.log('2️⃣ Testing Ollama:');
  try {
    const ollamaResult = await generateProductDescription(imagePath, 'bed-covers');
    displayResults(ollamaResult, 'OLLAMA');
  } catch (error) {
    console.log('❌ Ollama test failed:', error.message);
  }
}

function displayResults(result, service) {
  console.log('');
  console.log(`✅ ${service} TEST RESULTS:`);
  console.log(`   📝 Title: "${result.title}"`);
  console.log(`   📄 Description: "${result.description.substring(0, 100)}..."`);
  console.log(`   🎯 Confidence: ${Math.round((result.confidence || 0) * 100)}%`);
  console.log(`   🤖 Model: ${result.model}`);
  console.log('');
}

// Show usage if no arguments or help requested
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
🧪 AI Service CLI Tester

Usage: node test-ai-cli.js [mode] [image-path]

Modes:
  auto    - Use automatic service selection (default)
  openai  - Force OpenAI mode for testing
  ollama  - Force Ollama mode
  both    - Test both services and compare

Examples:
  node test-ai-cli.js                           # Auto mode with default image
  node test-ai-cli.js openai                    # Force OpenAI with default image
  node test-ai-cli.js both ~/Downloads/test.jpg # Test both with local image
  node test-ai-cli.js openai https://example.com/image.jpg # OpenAI with custom URL

Environment Variables:
  OPENAI_API_KEY - Required for OpenAI mode
  NODE_ENV       - Set to 'production' for automatic OpenAI selection
`);
  process.exit(0);
}

// Run the CLI
if (require.main === module) {
  testAICLI()
    .then(() => {
      console.log('🎯 CLI test completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 CLI test failed:', error);
      process.exit(1);
    });
}

module.exports = { testAICLI };
