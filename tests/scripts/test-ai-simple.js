require('dotenv').config();
const { HfInference } = require('@huggingface/inference');

async function testHuggingFaceAPI() {
  try {
    console.log('🧪 Testing Hugging Face API...');
    console.log('API Key present:', !!process.env.HUGGINGFACE_API_KEY);
    
    if (!process.env.HUGGINGFACE_API_KEY) {
      throw new Error('HUGGINGFACE_API_KEY not found in environment');
    }
    
    const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);
    
    console.log('🔄 Making test API call...');
    const testResult = await hf.textGeneration({
      model: 'gpt2',
      inputs: 'Hello',
      parameters: { max_new_tokens: 5 }
    });
    
    console.log('✅ HF API working:', testResult);
    return true;
  } catch (error) {
    console.error('❌ HF API test failed:', error.message);
    console.error('Error details:', error.response?.data || error);
    return false;
  }
}

async function testImageModels() {
  try {
    console.log('🖼️  Testing image models...');
    const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);
    
    // Test with a simple image URL
    const testImageUrl = 'https://huggingface.co/datasets/mishig/sample_images/resolve/main/tiger.jpg';
    
    console.log('🔄 Testing BLIP image captioning...');
    const response = await fetch(testImageUrl);
    const imageBuffer = Buffer.from(await response.arrayBuffer());
    
    const captionResult = await hf.imageToText({
      data: imageBuffer,
      model: 'Salesforce/blip-image-captioning-large'
    });
    
    console.log('✅ BLIP working:', captionResult);
    
    console.log('🔄 Testing CLIP classification...');
    const clipResult = await hf.zeroShotImageClassification({
      data: imageBuffer,
      model: 'openai/clip-vit-base-patch32',
      parameters: {
        candidate_labels: ['a tiger', 'a cat', 'a dog', 'a bird']
      }
    });
    
    console.log('✅ CLIP working:', clipResult);
    return true;
    
  } catch (error) {
    console.error('❌ Image model test failed:', error.message);
    console.error('Error details:', error.response?.data || error);
    return false;
  }
}

async function runTests() {
  console.log('🚀 Starting AI service tests...\n');
  
  const apiTest = await testHuggingFaceAPI();
  console.log('\n' + '='.repeat(50) + '\n');
  
  if (apiTest) {
    const imageTest = await testImageModels();
    console.log('\n' + '='.repeat(50) + '\n');
    
    if (imageTest) {
      console.log('🎉 All tests passed! AI generation should be working.');
    } else {
      console.log('⚠️  Image models failed. AI generation will use fallback.');
    }
  } else {
    console.log('❌ Basic API test failed. Check your HUGGINGFACE_API_KEY.');
  }
}

runTests().catch(console.error);
