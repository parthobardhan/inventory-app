const { HfInference } = require('@huggingface/inference');
const axios = require('axios');
const { Ollama } = require('ollama');

const HF_TIMEOUT_MS = parseInt(process.env.HF_TIMEOUT_MS || '20000', 10);
const HF_MAX_RETRIES = parseInt(process.env.HF_MAX_RETRIES || '2', 10);
const HF_BACKOFF_MS = parseInt(process.env.HF_BACKOFF_MS || '500', 10);

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

async function hfRestLLaVAChat(modelId, imageBuffer, prompt, token) {
  const url = `https://api-inference.huggingface.co/models/${encodeURIComponent(modelId)}`;
  
  // Convert image buffer to base64
  const base64Image = imageBuffer.toString('base64');
  
  // Try different request formats for LLaVA models
  const requestFormats = [
    // Format 1: Standard conversational format
    {
      inputs: {
        image: base64Image,
        text: prompt
      },
      parameters: {
        max_new_tokens: 200,
        temperature: 0.7,
        do_sample: true
      }
    },
    // Format 2: Simplified format
    {
      inputs: prompt,
      image: base64Image,
      parameters: {
        max_new_tokens: 200
      }
    },
    // Format 3: Direct inputs format
    {
      inputs: {
        text: prompt,
        images: [base64Image]
      }
    }
  ];

  let lastError;
  
  // Try each format until one works
  for (let i = 0; i < requestFormats.length; i++) {
    try {
      console.log(`🔄 Trying LLaVA request format ${i + 1}...`);
      console.log(`🔍 Request URL: ${url}`);
      console.log(`🔍 Request payload (preview):`, JSON.stringify(requestFormats[i], null, 2).substring(0, 500) + '...');
      
      const res = await axios.post(
        url,
        requestFormats[i],
        {
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          timeout: HF_TIMEOUT_MS,
          validateStatus: () => true
        }
      );
      
      const status = res.status;
      const data = res.data;
      
      console.log(`🔍 Response status: ${status}`);
      console.log(`🔍 Response data:`, JSON.stringify(data, null, 2).substring(0, 1000));
      
      if (status >= 200 && status < 300) {
        console.log(`✅ LLaVA request format ${i + 1} succeeded`);
        return data;
      }
      
      lastError = new Error(typeof data === 'string' ? data : JSON.stringify(data));
      lastError.status = status;
      console.log(`⚠️  LLaVA request format ${i + 1} got status ${status}: ${lastError.message}`);
      
    } catch (error) {
      lastError = error;
      console.log(`❌ LLaVA request format ${i + 1} failed: ${error.message}`);
    }
  }
  
  // If all formats failed, throw the last error
  throw lastError;
}

// Initialize Hugging Face Inference API
const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);

// Available models for image-to-text generation
const MODELS = {
  LLAVA_1_5_7B: 'llava-hf/llava-1.5-7b-hf', // Primary LLaVA model
  LLAVA_1_5_13B: 'llava-hf/llava-1.5-13b-hf', // Larger LLaVA model
  LLAVA_V1_6_MISTRAL: 'llava-hf/llava-v1.6-mistral-7b-hf', // Latest LLaVA model
  GIT_BASE: 'microsoft/git-base', // Reliable fallback vision model
  BLIP_BASE: 'Salesforce/blip-image-captioning-base' // Another fallback option
};

// Default models to use - LLaVA for better vision-language understanding
const DEFAULT_CAPTIONING_MODEL = MODELS.LLAVA_1_5_7B; // Primary choice
const FALLBACK_VISION_MODEL = MODELS.GIT_BASE; // Reliable fallback

/**
 * Generate product title and description from image using LLaVA
 * @param {string} imageUrl - URL of the image to analyze
 * @param {string} productType - Type of textile product (optional context)
 * @returns {Object} Generated title, description, confidence, and model info
 */
async function generateProductDescription(imageUrl, productType = null) {
  try {
    console.log(`🔍 ANALYZING IMAGE: ${imageUrl}`);
    console.log(`🏷️  PRODUCT TYPE: ${productType || 'Not specified'}`);

    // Download image data
    console.log('📥 Downloading image...');
    const imageResponse = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 30000
    });

    const imageBuffer = Buffer.from(imageResponse.data);
    console.log(`✅ Image downloaded: ${imageBuffer.length} bytes`);

    // Step 1: Use LLaVA to generate detailed caption
    console.log('📝 Step 1: Running LLaVA image captioning...');

    let basicCaption;
    let usedModel = 'LLaVA';
    
    basicCaption = await generateLLaVACaption(imageBuffer, productType);
    console.log(`✅ LLaVA completed - Caption: "${basicCaption}"`);

    console.log(`🔗 Processing LLaVA results...`);

    // Step 2: Enhance the description with product-specific details
    const enhancedDescription = enhanceTextileDescription(basicCaption, productType);

    // Step 3: Generate a product title from the enhanced description
    console.log('🏷️  Step 3: Generating product title...');
    const title = generateProductTitle(enhancedDescription, productType);
    console.log(`✅ Title generated: "${title}"`);

    const finalResult = {
      title: title,
      description: enhancedDescription,
      confidence: 0.8,
      model: usedModel,
      generatedAt: new Date(),
      rawCaption: basicCaption
    };

    console.log('🎉 AI GENERATION COMPLETE!');
    console.log('📊 FINAL RESULTS:');
    console.log(`   📝 Title: "${finalResult.title}"`);
    console.log(`   📄 Description: "${finalResult.description}"`);
    console.log(`   🎯 Confidence: ${Math.round(finalResult.confidence * 100)}%`);
    console.log(`   🤖 Model: ${finalResult.model}`);

    return finalResult;
    
  } catch (error) {
    console.error('❌ AI GENERATION FAILED!');
    console.error('🚨 Error Details:', error.message);
    console.error('📍 Error Type:', error.name);
    console.error('❌ Full error stack:', error.stack);
    console.error('❌ Error response:', error.response?.data);

    // No fallback - require LLM generation
    console.log('❌ LLM caption generation failed - no fallback available');
    throw error;
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
    // Use the selected product type to focus the AI on the correct category
    const availableCategories = ['bed-covers', 'cushion-covers', 'sarees', 'towels'];
    const targetCategory = productType || 'textile product';
    
    const userPrompt = `You are an online seller for products in these categories: bed-covers, cushion covers, sarees, and towels. The user has selected "${targetCategory}" as the product type. Focus specifically on this ${targetCategory} and generate a catchy caption of one or two sentences that will be used in the product caption. The caption should mention design, colors, comfort and any other elements that stand out in this ${targetCategory}. Do not describe anything else in the image outside of the main product. Keep the caption under 200 characters. You can mention how the product will enhance where it will be used, eg. a bed-cover will brighten up the bedroom, a saree will add elegance to special occasions.`;

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
 * Enhance a basic caption from LLaVA with minimal processing
 * @param {string} basicCaption - Basic caption from LLaVA
 * @param {string} productType - Product type
 * @returns {string} Enhanced caption
 */
function enhanceCaptionWithInstructions(basicCaption, productType) {
  // Minimal enhancement - just ensure proper capitalization and product type context
  let enhanced = basicCaption.trim();

  // Ensure proper capitalization
  enhanced = enhanced.charAt(0).toUpperCase() + enhanced.slice(1);

  // Add product type context if not already present
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

  return enhanced;
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
 * Generate product title using LLaVA insights
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
 * @returns {Object} Test results
 */
async function testAIService(imageUrl) {
  console.log('Testing LLaVA AI service...');
  const result = await generateProductDescription(imageUrl, 'bed-covers');
  console.log('Test result:', result);
  return result;
}

/**
 * Generate caption using LOCAL Ollama LLaVA model (no fallback) for testing
 * @param {Buffer} imageBuffer - Image data buffer
 * @param {string} productType - Type of textile product for context
 * @returns {string} Generated caption from local LLaVA only
 */
async function generateLLaVACaptionOnly(imageBuffer, productType) {
  try {
    console.log('🎯 LLaVA-ONLY: Testing LOCAL Ollama LLaVA without fallback...');

    // Create catchy product description prompt for online selling
    // Use the selected product type to focus the AI on the correct category
    const availableCategories = ['bed-covers', 'cushion-covers', 'sarees', 'towels'];
    const targetCategory = productType || 'textile product';
    
    const userPrompt = `You are an online seller for products in these categories: bed-covers, cushion covers, sarees, and towels. The user has selected "${targetCategory}" as the product type. Focus specifically on this ${targetCategory} and generate a catchy caption of one or two sentences that will be used in the product caption. The caption should mention design, colors, comfort and any other elements that stand out in this ${targetCategory}. Do not describe anything else in the image outside of the main product. Keep the caption under 200 characters. You can mention how the product will enhance where it will be used, eg. a bed-cover will brighten up the bedroom, a saree will add elegance to special occasions.`;

    console.log(`📝 Using local LLaVA prompt for ${targetCategory}: "${userPrompt}"`);

    // Convert image buffer to base64 for Ollama
    const base64Image = imageBuffer.toString('base64');
    console.log(`🖼️  Image converted to base64 (${base64Image.length} chars)`);

    console.log('🔄 Using LOCAL Ollama LLaVA model...');
    
    // Use Ollama local LLaVA model
    // Create Ollama client and make the request
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
      throw new Error('Ollama LLaVA model returned empty response - NO FALLBACK USED');
    }

    // Minimal processing for catchy descriptions - remove quotes and ensure proper capitalization
    caption = caption.replace(/^["']|["']$/g, '').trim(); // Remove leading/trailing quotes
    caption = caption.charAt(0).toUpperCase() + caption.slice(1);
    console.log(`✅ Local LLaVA caption processed: "${caption}"`);

    return caption;

  } catch (error) {
    console.error('❌ LOCAL LLaVA caption generation failed (no fallback used):', error.message);
    throw new Error(`Local LLaVA test failed: ${error.message}`);
  }
}

/**
 * Test LOCAL Ollama LLaVA models with a specific image file (no fallback allowed)
 * @param {string} imagePath - Path to the test image file
 * @param {string} productType - Type of product for context
 * @returns {Object} Test results from local LLaVA only
 */
async function testLLaVAOnly(imagePath, productType = 'bed-covers') {
  console.log('🧪 TESTING LOCAL OLLAMA LLAVA MODELS ONLY - NO FALLBACK ALLOWED');
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
    
    // Test LOCAL LLaVA caption generation (no fallback)
    const caption = await generateLLaVACaptionOnly(imageBuffer, productType);
    
    const result = {
      imagePath: resolvedPath,
      productType: productType,
      caption: caption,
      model: 'Local Ollama LLaVA',
      success: true,
      testedAt: new Date()
    };
    
    console.log('🎉 LOCAL LLAVA TEST COMPLETED SUCCESSFULLY!');
    console.log('📊 TEST RESULTS:');
    console.log(`   📁 Image: ${result.imagePath}`);
    console.log(`   🏷️  Type: ${result.productType}`);
    console.log(`   📝 Caption: "${result.caption}"`);
    console.log(`   🤖 Model: ${result.model}`);
    
    return result;
    
  } catch (error) {
    console.error('❌ LOCAL LLAVA TEST FAILED!');
    console.error('🚨 Error Details:', error.message);
    console.error('📍 Error Type:', error.name);
    
    const result = {
      imagePath: imagePath,
      productType: productType,
      caption: null,
      model: 'Local Ollama LLaVA',
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

module.exports = {
  generateProductDescription,
  testAIService,
  testHuggingFaceAPI,
  testLLaVAOnly,
  generateLLaVACaptionOnly,
  MODELS
};
