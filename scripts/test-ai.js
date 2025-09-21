const { generateProductDescription } = require('../services/aiService');

async function main() {
  const imageUrl = 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400';
  const types = ['bed-covers', 'cushion-covers', 'sarees', 'napkins', 'towels'];
  for (const t of types) {
    try {
      console.log(`\n=== Testing type: ${t} ===`);
      const res = await generateProductDescription(imageUrl, t);
      console.log({
        model: res.model,
        confidence: res.confidence,
        title: res.title,
        description: res.description
      });
    } catch (e) {
      console.error(`Error for ${t}:`, e && e.message ? e.message : e);
    }
  }
}

main().catch(err => {
  console.error('Fatal error:', err && err.message ? err.message : err);
  process.exit(1);
});
