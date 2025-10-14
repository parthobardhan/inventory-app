const { HfInference } = require('@huggingface/inference');
const axios = require('axios');
const { Ollama } = require('ollama');
const OpenAI = require('openai');

const HF_TIMEOUT_MS = parseInt(process.env.HF_TIMEOUT_MS || '20000', 10);
const HF_MAX_RETRIES = parseInt(process.env.HF_MAX_RETRIES || '2', 10);
const HF_BACKOFF_MS = parseInt(process.env.HF_BACKOFF_MS || '500', 10);

// Initialize OpenAI client for production (only if API key is available)
let openai = null;
if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your-openai-api-key-here') {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function isRetriableHFError(err) {
  const status = err && (err.status || err.statusCode);
  const msg = (err && (err.message || err.toString())) || '';
  if (status && [429, 500, 502, 503, 504].includes(status)) return true;
  if (/timeout|ENOTFOUND|ECONNRESET|EAI_AGAIN|network|fetch failed/i.test(msg)) return true;
  return false;
}

async function withRetries(fn, maxRetries = HF_MAX_RETRIES, backoffMs = HF_BACKOFF_MS) {
  let lastErr;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isRetriableHFError(err) || attempt === maxRetries) break;
      await sleep(backoffMs * Math.pow(2, attempt));
    }
  }
  throw lastErr;
}

/**
 * Determine which AI service to use based on environment
 * @param {boolean} forceOpenAI - Force OpenAI mode for testing (optional)
 * @returns {string} 'openai' for production, 'ollama' for development
 */
function getAIService(forceOpenAI = false) {
  const isProduction = process.env.NODE_ENV === 'production';
  const hasOpenAIKey = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your-openai-api-key-here';
  
  console.log('🔍 AI SERVICE SELECTION DEBUG:');
  console.log('   Environment:', process.env.NODE_ENV);
  console.log('   Is Production:', isProduction);
  console.log('   Has OpenAI Key:', !!process.env.OPENAI_API_KEY);
  console.log('   OpenAI Key Length:', process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.length : 0);
  console.log('   OpenAI Key Preview:', process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.substring(0, 10) + '...' : 'undefined');
  console.log('   Force OpenAI:', forceOpenAI);
  
  // Force OpenAI mode for testing (local development)
  if (forceOpenAI && hasOpenAIKey) {
    console.log('🔧 FORCE OPENAI MODE: Using OpenAI for local testing');
    return 'openai';
  }
  
  if (isProduction && hasOpenAIKey) {
    console.log('🚀 PRODUCTION MODE: Using OpenAI for production deployment');
    return 'openai';
  }
  
  if (isProduction && !hasOpenAIKey) {
    console.log('⚠️  PRODUCTION MODE: No OpenAI key found, falling back to Ollama (this will fail in Vercel)');
  }
  
  console.log('🏠 DEVELOPMENT MODE: Using Ollama for local development');
  return 'ollama';
}

/**
 * Generate product title and description from image using OpenAI GPT-4o-mini (production)
 * @param {string} imageUrl - URL of the image to analyze
 * @param {string} productType - Type of textile product (optional context)
 * @returns {Object} Generated title, description, confidence, and model info
 */
async function generateProductDescriptionWithOpenAI(imageUrl, productType = null) {
  try {
    console.log(`🔍 ANALYZING IMAGE WITH OPENAI GPT-4O-MINI: ${imageUrl}`);
    console.log(`🏷️  PRODUCT TYPE: ${productType || 'Not specified'}`);

    // Check if OpenAI client is available
    if (!openai) {
      throw new Error('OpenAI client not initialized - API key not configured');
    }

    // Download image data
    console.log('📥 Downloading image...');
    const imageResponse = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 30000
    });

    const imageBuffer = Buffer.from(imageResponse.data);
    console.log(`✅ Image downloaded: ${imageBuffer.length} bytes`);

    // Convert to base64 for OpenAI
    const base64Image = imageBuffer.toString('base64');
    
    // Create product-specific prompt
    const availableCategories = ['bed-covers', 'cushion-covers', 'sarees', 'towels'];
    const targetCategory = productType || 'textile product';
    
    const prompt = `You are an expert online seller specializing in textile products. The user has selected "${targetCategory}" as the product type. 

Analyze this image and provide:
1. A catchy, sales-focused caption (1-2 sentences, MAXIMUM 200 characters) that highlights the design, colors, comfort, and appeal of this ${targetCategory}
2. A concise product description (under 400 characters) that mentions materials, design elements, colors, and how it enhances the space/occasion

IMPORTANT: The caption must be exactly 200 characters or less. Count your characters carefully.
Focus specifically on this ${targetCategory} and do not describe anything else in the image. Make it appealing for online shoppers. Keep descriptions concise and impactful.

Format your response as:
CAPTION: [your catchy caption here - MAX 200 chars]
DESCRIPTION: [your concise description here]`;

    console.log('🤖 Calling OpenAI GPT-4o-mini...');
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: prompt
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`,
                detail: "high"
              }
            }
          ]
        }
      ],
      max_tokens: 500,
      temperature: 0.7
    });

    const content = response.choices[0].message.content;
    console.log('🔍 OpenAI raw response:', content);

    // Parse the response
    const captionMatch = content.match(/CAPTION:\s*(.+?)(?=DESCRIPTION:|$)/s);
    const descriptionMatch = content.match(/DESCRIPTION:\s*(.+?)$/s);

    const caption = captionMatch ? captionMatch[1].trim() : content.split('\n')[0].trim();
    const description = descriptionMatch ? descriptionMatch[1].trim() : content;

    // Truncate description to fit database constraints
    const truncatedDescription = description.length > 500 ? 
      description.substring(0, 497) + '...' : description;
    
    const result = {
      title: generateProductTitle(caption, productType),
      description: truncatedDescription,
      confidence: 0.9, // OpenAI typically has higher confidence
      model: 'OpenAI GPT-4o-mini',
      generatedAt: new Date(),
      rawCaption: caption.length > 200 ? caption.substring(0, 197) + '...' : caption
    };

    console.log('🎉 OPENAI GENERATION COMPLETE!');
    console.log('📊 FINAL RESULTS:');
    console.log(`   📝 Title: "${result.title}"`);
    console.log(`   📄 Description: "${result.description}"`);
    console.log(`   🎯 Confidence: ${Math.round(result.confidence * 100)}%`);
    console.log(`   🤖 Model: ${result.model}`);

    return result;

  } catch (error) {
    console.error('❌ OPENAI GENERATION FAILED!');
    console.error('🚨 Error Details:', error.message);
    console.error('📍 Error Type:', error.name);
    console.error('❌ Full error stack:', error.stack);

    throw error;
  }
}

/**
 * Generate product title and description from image using Ollama LLaVA (local development)
 * @param {string} imageUrl - URL of the image to analyze
 * @param {string} productType - Type of textile product (optional context)
 * @returns {Object} Generated title, description, confidence, and model info
 */
async function generateProductDescriptionWithOllama(imageUrl, productType = null) {
  try {
    console.log(`🔍 ANALYZING IMAGE WITH LOCAL OLLAMA LLAVA: ${imageUrl}`);
    console.log(`🏷️  PRODUCT TYPE: ${productType || 'Not specified'}`);

    // Download image data
    console.log('📥 Downloading image...');
    const imageResponse = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 30000
    });

    const imageBuffer = Buffer.from(imageResponse.data);
    console.log(`✅ Image downloaded: ${imageBuffer.length} bytes`);

    // Generate caption using Ollama LLaVA
    console.log('📝 Running Ollama LLaVA image captioning...');
    const basicCaption = await generateLLaVACaption(imageBuffer, productType);
    console.log(`✅ LLaVA completed - Caption: "${basicCaption}"`);

    // Enhance the description with product-specific details
    const enhancedDescription = enhanceTextileDescription(basicCaption, productType);

    // Generate a product title from the enhanced description
    console.log('🏷️  Generating product title...');
    const title = generateProductTitle(enhancedDescription, productType);
    console.log(`✅ Title generated: "${title}"`);

    // Truncate description and caption to fit database constraints
    const truncatedDescription = enhancedDescription.length > 500 ? 
      enhancedDescription.substring(0, 497) + '...' : enhancedDescription;
    const truncatedCaption = basicCaption.length > 200 ? 
      basicCaption.substring(0, 197) + '...' : basicCaption;
    
    const result = {
      title: title,
      description: truncatedDescription,
      confidence: 0.8,
      model: 'Local Ollama LLaVA',
      generatedAt: new Date(),
      rawCaption: truncatedCaption
    };

    console.log('🎉 OLLAMA GENERATION COMPLETE!');
    console.log('📊 FINAL RESULTS:');
    console.log(`   📝 Title: "${result.title}"`);
    console.log(`   📄 Description: "${result.description}"`);
    console.log(`   🎯 Confidence: ${Math.round(result.confidence * 100)}%`);
    console.log(`   🤖 Model: ${result.model}`);

    return result;

  } catch (error) {
    console.error('❌ OLLAMA GENERATION FAILED!');
    console.error('🚨 Error Details:', error.message);
    console.error('📍 Error Type:', error.name);
    console.error('❌ Full error stack:', error.stack);

    throw error;
  }
}

/**
 * Main function to generate product description - automatically chooses service based on environment
 * @param {string} imageUrl - URL of the image to analyze
 * @param {string} productType - Type of textile product (optional context)
 * @param {boolean} forceOpenAI - Force OpenAI mode for testing (optional)
 * @returns {Object} Generated title, description, confidence, and model info
 */
async function generateProductDescription(imageUrl, productType = null, forceOpenAI = false) {
  const aiService = getAIService(forceOpenAI);
  console.log(`🤖 Using AI service: ${aiService.toUpperCase()}`);
  
  if (aiService === 'openai') {
    return await generateProductDescriptionWithOpenAI(imageUrl, productType);
  } else {
    return await generateProductDescriptionWithOllama(imageUrl, productType);
  }
}

/**
 * Generate caption using LOCAL Ollama LLaVA with catchy product descriptions
 * @param {Buffer} imageBuffer - Image data buffer
 * @param {string} productType - Type of textile product for context (optional)
 * @returns {string} Generated caption
 */
async function generateLLaVACaption(imageBuffer, productType) {
  try {
    console.log('🎯 LLaVA: Attempting LOCAL Ollama vision-language captioning...');

    // Create catchy product description prompt for online selling
    const availableCategories = ['bed-covers', 'cushion-covers', 'sarees', 'towels'];
    const targetCategory = productType || 'textile product';
    
    const userPrompt = `You are an online seller for products in these categories: bed-covers, cushion covers, sarees, and towels. The user has selected "${targetCategory}" as the product type. Focus specifically on this ${targetCategory} and generate a catchy caption of one or two sentences that will be used in the product caption. The caption should mention design, colors, comfort and any other elements that stand out in this ${targetCategory}. Do not describe anything else in the image outside of the main product. 

IMPORTANT: The caption must be MAXIMUM 200 characters. Count your characters carefully and ensure it's exactly 200 characters or less.
You can mention how the product will enhance where it will be used, eg. a bed-cover will brighten up the bedroom, a saree will add elegance to special occasions. Be concise and impactful.`;

    console.log(`📝 Using local LLaVA prompt for ${targetCategory}: "${userPrompt}"`);

    // Convert image buffer to base64 for Ollama
    const base64Image = imageBuffer.toString('base64');
    console.log(`🖼️  Image converted to base64 (${base64Image.length} chars)`);

    console.log('🔄 Using LOCAL Ollama LLaVA model...');
    
    // Use Ollama local LLaVA model
    const ollamaClient = new Ollama();
    const response = await ollamaClient.chat({
      model: 'llava:7b',
      messages: [{
        role: 'user',
        content: userPrompt,
        images: [base64Image]
      }],
      options: {
        temperature: 0.7,
        num_ctx: 4096
      }
    });

    console.log('🔍 Ollama raw response:', JSON.stringify(response, null, 2));

    // Extract the caption from Ollama response
    let caption = '';
    if (response && response.message && response.message.content) {
      caption = response.message.content.trim();
    } else {
      throw new Error('Ollama LLaVA returned invalid response structure');
    }

    if (!caption) {
      throw new Error('Ollama LLaVA model returned empty response');
    }

    // Minimal processing for catchy descriptions - remove quotes and ensure proper capitalization
    caption = caption.replace(/^["']|["']$/g, '').trim(); // Remove leading/trailing quotes
    caption = caption.charAt(0).toUpperCase() + caption.slice(1);
    console.log(`✅ Local LLaVA caption processed: "${caption}"`);

    return caption;

  } catch (error) {
    console.error('❌ LOCAL LLaVA caption generation failed:', error.message);
    throw error;
  }
}

/**
 * Enhance textile description with product-specific details
 * @param {string} caption - Basic caption from LLaVA
 * @param {string} productType - Product type for context
 * @returns {string} Enhanced description
 */
function enhanceTextileDescription(caption, productType) {
  let enhanced = caption;

  // Add textile-specific context based on product type
  if (productType) {
    const typeMap = {
      'bed-covers': 'bed cover',
      'cushion-covers': 'cushion cover',
      'sarees': 'saree',
      'towels': 'towel'
    };

    const typeName = typeMap[productType];
    if (typeName && !enhanced.toLowerCase().includes(typeName)) {
      enhanced = `${typeName.charAt(0).toUpperCase() + typeName.slice(1)} ${enhanced.toLowerCase()}`;
    }
  }

  // Enhance with textile-specific quality indicators
  enhanced = enhanced.replace(/\b(fabric|material|cloth|textile)\b/gi, () => {
    const fabrics = ['premium cotton', 'fine silk', 'quality linen', 'soft polyester', 'cotton blend'];
    return fabrics[Math.floor(Math.random() * fabrics.length)];
  });

  return enhanced.charAt(0).toUpperCase() + enhanced.slice(1);
}

/**
 * Generate product title using insights
 * @param {string} description - Enhanced product description
 * @param {string} productType - Product type
 * @returns {string} Generated title
 */
function generateProductTitle(description, productType) {
  // Extract key descriptive words from description
  const words = description.split(' ');
  const keyWords = words
    .filter(word => word.length > 3)
    .filter(word => !['with', 'featuring', 'displaying', 'that', 'this', 'very', 'made', 'from'].includes(word.toLowerCase()))
    .slice(0, 4);

  let title = keyWords.join(' ');

  // Clean up title
  title = title.replace(/[.,!?;:]$/, '');
  title = title.charAt(0).toUpperCase() + title.slice(1);

  // Add product type if not already included
  if (productType) {
    const typeMap = {
      'bed-covers': 'Bed Cover',
      'cushion-covers': 'Cushion Cover',
      'sarees': 'Saree',
      'towels': 'Towel'
    };

    const typeName = typeMap[productType];
    if (typeName && !title.toLowerCase().includes(typeName.toLowerCase())) {
      title = `${typeName} - ${title}`;
    }
  }

  return title;
}

/**
 * Test AI service with a sample image
 * @param {string} imageUrl - Test image URL
 * @param {boolean} forceOpenAI - Force OpenAI mode for testing (optional)
 * @returns {Object} Test results
 */
async function testAIService(imageUrl, forceOpenAI = false) {
  console.log('Testing AI service...');
  const result = await generateProductDescription(imageUrl, 'bed-covers', forceOpenAI);
  console.log('Test result:', result);
  return result;
}

/**
 * Test AI service with a local image file
 * @param {string} imagePath - Path to the test image file
 * @param {string} productType - Type of product for context
 * @param {boolean} forceOpenAI - Force OpenAI mode for testing (optional)
 * @returns {Object} Test results
 */
async function testAIServiceWithFile(imagePath, productType = 'bed-covers', forceOpenAI = false) {
  console.log('🧪 TESTING AI SERVICE WITH LOCAL IMAGE FILE');
  console.log(`📁 Image path: ${imagePath}`);
  console.log(`🏷️  Product type: ${productType}`);
  
  try {
    const fs = require('fs');
    const path = require('path');
    
    // Resolve the path (handle ~/ home directory)
    const resolvedPath = imagePath.startsWith('~/') 
      ? path.join(require('os').homedir(), imagePath.slice(2))
      : imagePath;
    
    console.log(`📂 Resolved path: ${resolvedPath}`);
    
    // Check if file exists
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Image file not found: ${resolvedPath}`);
    }
    
    // Read image file
    console.log('📥 Reading image file...');
    const imageBuffer = fs.readFileSync(resolvedPath);
    console.log(`✅ Image loaded: ${imageBuffer.length} bytes`);
    
    // Convert to base64 data URL for testing
    const base64Image = imageBuffer.toString('base64');
    const dataUrl = `data:image/jpeg;base64,${base64Image}`;
    
    // Test AI service
    const result = await generateProductDescription(dataUrl, productType, forceOpenAI);
    
    console.log('🎉 AI SERVICE TEST COMPLETED SUCCESSFULLY!');
    console.log('📊 TEST RESULTS:');
    console.log(`   📁 Image: ${resolvedPath}`);
    console.log(`   🏷️  Type: ${result.productType || productType}`);
    console.log(`   📝 Title: "${result.title}"`);
    console.log(`   📄 Description: "${result.description}"`);
    console.log(`   🎯 Confidence: ${Math.round((result.confidence || 0) * 100)}%`);
    console.log(`   🤖 Model: ${result.model}`);
    
    return {
      imagePath: resolvedPath,
      productType: productType,
      ...result,
      success: true,
      testedAt: new Date()
    };
    
  } catch (error) {
    console.error('❌ AI SERVICE TEST FAILED!');
    console.error('🚨 Error Details:', error.message);
    console.error('📍 Error Type:', error.name);
    
    const result = {
      imagePath: imagePath,
      productType: productType,
      success: false,
      error: error.message,
      testedAt: new Date()
    };
    
    throw result;
  }
}

async function testHuggingFaceAPI() {
  try {
    console.log('🧪 Testing Hugging Face API...');
    const testResult = await hf.textGeneration({
      model: 'gpt2',
      inputs: 'Hello',
      parameters: { max_new_tokens: 5 }
    });
    console.log('✅ HF API working:', testResult);
    return true;
  } catch (error) {
    console.error('❌ HF API test failed:', error.message);
    return false;
  }
}

// Available models for image-to-text generation (legacy support)
const MODELS = {
  LLAVA_1_5_7B: 'llava-hf/llava-1.5-7b-hf',
  LLAVA_1_5_13B: 'llava-hf/llava-1.5-13b-hf',
  LLAVA_V1_6_MISTRAL: 'llava-hf/llava-v1.6-mistral-7b-hf',
  GIT_BASE: 'microsoft/git-base',
  BLIP_BASE: 'Salesforce/blip-image-captioning-base'
};

/**
 * Test ONLY local LLaVA models via Ollama (no fallback)
 * @param {string} imagePath - Path to local image file
 * @param {string} productType - Product type for context
 * @returns {Object} Test results or throws error
 */
async function testLLaVAOnly(imagePath, productType = 'bed-covers') {
  console.log('🎯 TESTING LOCAL LLaVA ONLY (NO FALLBACK OR OPENAI)');
  console.log(`📁 Image path: ${imagePath}`);
  console.log(`🏷️  Product type: ${productType}`);
  
  try {
    const fs = require('fs');
    const path = require('path');
    
    // Resolve the path (handle ~/ home directory)
    const resolvedPath = imagePath.startsWith('~/') 
      ? path.join(require('os').homedir(), imagePath.slice(2))
      : imagePath;
    
    console.log(`📂 Resolved path: ${resolvedPath}`);
    
    // Check if file exists
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Image file not found: ${resolvedPath}`);
    }
    
    // Read image file
    console.log('📥 Reading image file...');
    const imageBuffer = fs.readFileSync(resolvedPath);
    console.log(`✅ Image loaded: ${imageBuffer.length} bytes`);
    
    // Force LLaVA generation (no OpenAI fallback)
    console.log('🔄 Testing LLaVA generation directly...');
    const caption = await generateLLaVACaption(imageBuffer, productType);
    
    const result = {
      caption: caption,
      model: 'Local Ollama LLaVA',
      success: true,
      testedAt: new Date()
    };
    
    console.log('✅ LLaVA TEST PASSED!');
    console.log('📊 Results:', result);
    
    return result;
    
  } catch (error) {
    console.error('❌ LLaVA TEST FAILED!');
    console.error('🚨 Error:', error.message);
    
    const result = {
      imagePath: imagePath,
      productType: productType,
      model: 'Local Ollama LLaVA',
      success: false,
      error: error.message,
      testedAt: new Date()
    };
    
    throw result;
  }
}

module.exports = {
  generateProductDescription,
  generateProductDescriptionWithOpenAI,
  generateProductDescriptionWithOllama,
  testAIService,
  testAIServiceWithFile,
  testLLaVAOnly,
  testHuggingFaceAPI,
  getAIService,
  MODELS
};