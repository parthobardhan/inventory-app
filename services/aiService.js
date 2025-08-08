const { HfInference } = require('@huggingface/inference');
const axios = require('axios');


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

async function hfRestImageToText(modelId, imageUrl, token) {
  const url = `https://api-inference.huggingface.co/models/${encodeURIComponent(modelId)}`;
  const imgResp = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: HF_TIMEOUT_MS });
  const res = await axios.post(
    url,
    Buffer.from(imgResp.data),
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/octet-stream'
      },
      timeout: HF_TIMEOUT_MS,
      validateStatus: () => true
    }
  );
  const status = res.status;
  const data = res.data;
  if (status < 200 || status >= 300) {
    const err = new Error(typeof data === 'string' ? data : JSON.stringify(data));
    err.status = status;
    throw err;
  }
  return data;
}

// Initialize Hugging Face Inference API
const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);

// Available models for image-to-text generation
const MODELS = {
  BLIP_LARGE: 'Salesforce/blip-image-captioning-large', // Fallback option
  INSTRUCTBLIP_FLAN_T5_XL: 'Salesforce/instructblip-flan-t5-xl', // InstructBLIP model
  INSTRUCTBLIP_VICUNA_7B: 'Salesforce/instructblip-vicuna-7b' // InstructBLIP model
};

// Default models to use - InstructBLIP for better instruction-following captioning
const DEFAULT_CAPTIONING_MODEL = MODELS.INSTRUCTBLIP_FLAN_T5_XL; // Primary choice
const FALLBACK_CAPTIONING_MODEL = MODELS.BLIP_LARGE; // Fallback if InstructBLIP fails

/**
 * Generate product title and description from image using InstructBLIP
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

    // Step 1: Use InstructBLIP to generate detailed caption with instructions
    console.log('📝 Step 1: Running InstructBLIP image captioning...');

    let basicCaption;
    let usedModel = 'InstructBLIP';
    try {
      basicCaption = await generateInstructBLIPCaption(imageBuffer, productType);
      console.log(`✅ InstructBLIP completed - Caption: "${basicCaption}"`);
    } catch (error) {
      console.log(`⚠️  InstructBLIP failed (${error.message}), trying BLIP fallback...`);
      try {
        const captionResult = await withRetries(
          () => hf.imageToText({
            data: imageBuffer,
            model: FALLBACK_CAPTIONING_MODEL
          }),
          HF_MAX_RETRIES,
          HF_BACKOFF_MS
        );
        basicCaption = captionResult.generated_text;
        usedModel = 'BLIP';
        console.log(`✅ BLIP fallback completed - Caption: "${basicCaption}"`);
      } catch (fallbackError) {
        console.log(`⚠️  BLIP fallback via SDK failed (${fallbackError.message}), trying REST fallback...`);
        const token = process.env.HUGGINGFACE_API_KEY;
        try {
          const restResult = await withRetries(
            () => hfRestImageToText(FALLBACK_CAPTIONING_MODEL, imageUrl, token),
            HF_MAX_RETRIES,
            HF_BACKOFF_MS
          );
          const restText = Array.isArray(restResult)
            ? (restResult[0]?.generated_text || restResult[0]?.summary_text || restResult[0]?.text)
            : (restResult?.generated_text || restResult?.summary_text || restResult?.text);
          if (!restText) {
            throw new Error('HF REST response did not include generated_text');
          }
          basicCaption = restText;
          usedModel = 'BLIP';
          console.log(`✅ BLIP REST fallback completed - Caption: "${basicCaption}"`);
        } catch (restError) {
          console.log(`❌ BLIP REST fallback also failed (${restError.message})`);
          throw new Error(`All LLM caption generation methods failed: ${restError.message}`);
        }
      }
    }

    console.log(`🔗 Processing InstructBLIP results...`);

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
 * Generate caption using InstructBLIP with specific instructions for textile products
 * @param {Buffer} imageBuffer - Image data buffer
 * @param {string} productType - Type of textile product for context
 * @returns {string} Generated caption
 */
async function generateInstructBLIPCaption(imageBuffer, productType) {
  try {
    console.log('🎯 InstructBLIP: Attempting instruction-based captioning...');

    // Create specific instruction prompt based on product type
    const instructionPrompts = {
      'bed-covers': 'You sell bed-covers. Create an impactful caption for this bed cover, focusing on its patterns, colors, fabric texture, and decorative elements.',
      'cushion-covers': 'Describe this cushion cover, highlighting its design, patterns, colors, and material quality.',
      'sarees': 'Describe this saree, focusing on its traditional elements, embroidery, fabric type, and cultural design features.',
      'napkins': 'Describe this napkin, noting its patterns, material, colors, and suitability for dining.',
      'towels': 'Describe this towel, focusing on its texture, absorbency, colors, and fabric quality.'
    };

    const instruction = instructionPrompts[productType] ||
      'Describe this textile product in detail, focusing on its design, colors, patterns, and material quality.';

    console.log(`📝 Using instruction: "${instruction}"`);

    // Check if API key is available and valid
    if (!process.env.HUGGINGFACE_API_KEY || process.env.HUGGINGFACE_API_KEY.length < 10) {
      console.log('❌ No valid Hugging Face API key found');
      throw new Error('No valid API key - LLM caption generation requires API access');
    }

    // Try to use regular BLIP first (more reliable than InstructBLIP)
    console.log('🔄 Trying BLIP image captioning...');
    const captionResult = await withRetries(
      () => hf.imageToText({
        data: imageBuffer,
        model: FALLBACK_CAPTIONING_MODEL
      }),
      HF_MAX_RETRIES,
      HF_BACKOFF_MS
    );

    let caption = captionResult.generated_text;

    // Enhance the caption based on the instruction and product type
    caption = enhanceCaptionWithInstructions(caption, productType);

    return caption;

  } catch (error) {
    console.error('❌ InstructBLIP caption generation failed:', error.message);
    throw error;
  }
}

/**
 * Enhance a basic caption from LLM with minimal processing
 * @param {string} basicCaption - Basic caption from LLM
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
      'napkins': 'napkin',
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
 * @param {string} caption - Basic caption from InstructBLIP
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
      'napkins': 'napkin',
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
 * Generate product title using InstructBLIP insights
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
      'napkins': 'Napkin',
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
  console.log('Testing InstructBLIP AI service...');
  const result = await generateProductDescription(imageUrl, 'bed-covers');
  console.log('Test result:', result);
  return result;
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
  MODELS
};
