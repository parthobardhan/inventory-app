const { generateProductDescription } = require('./services/aiService');

async function testAI() {
    console.log('🧪 TESTING AI FUNCTIONALITY');
    console.log('=' .repeat(50));
    
    // Test with a sample textile image URL
    const testImageUrl = 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400&h=400&fit=crop';
    const productType = 'bed-covers';
    
    console.log('🔬 Test Parameters:');
    console.log(`   📸 Image URL: ${testImageUrl}`);
    console.log(`   🏷️  Product Type: ${productType}`);
    console.log('');
    
    try {
        const result = await generateProductDescription(testImageUrl, productType);
        
        console.log('');
        console.log('🎉 TEST COMPLETED SUCCESSFULLY!');
        console.log('=' .repeat(50));
        console.log('📊 FINAL AI RESULTS:');
        console.log(`📝 Generated Title: "${result.title}"`);
        console.log(`📄 Generated Description: "${result.description}"`);
        console.log(`🎯 Confidence Score: ${Math.round((result.confidence || 0) * 100)}%`);
        console.log(`🤖 AI Model Used: ${result.model}`);
        console.log(`⏰ Generated At: ${result.generatedAt}`);
        
        if (result.rawCaption) {
            console.log(`🔍 Raw BLIP Caption: "${result.rawCaption}"`);
        }
        
        if (result.clipClassification) {
            console.log(`🎯 CLIP Classification: "${result.clipClassification}"`);
            console.log(`📊 CLIP Confidence: ${Math.round((result.clipConfidence || 0) * 100)}%`);
        }
        
        console.log('=' .repeat(50));
        
    } catch (error) {
        console.error('❌ TEST FAILED!');
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
    }
}

// Run the test
testAI();
