/**
 * Migration: Remove dateSold and profit fields from Product collection
 * 
 * These fields should only exist in the Sale collection as they represent
 * transaction data, not inventory data.
 * 
 * Run with: node migrations/remove_product_sale_fields.js
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: './dev.env' });

async function migrate() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log('Connected to MongoDB\n');

    const Product = mongoose.connection.collection('products');

    console.log('Starting migration: Remove dateSold and profit from Product schema');
    
    // Count documents with these fields
    const countWithDateSold = await Product.countDocuments({ dateSold: { $exists: true } });
    const countWithProfit = await Product.countDocuments({ profit: { $exists: true } });
    
    console.log(`Found ${countWithDateSold} products with dateSold field`);
    console.log(`Found ${countWithProfit} products with profit field\n`);

    // Remove dateSold and profit fields from all products
    const result = await Product.updateMany(
      {},
      { 
        $unset: { 
          dateSold: "",
          profit: "" 
        } 
      }
    );

    console.log(`\nMigration Results:`);
    console.log(`- Matched: ${result.matchedCount} products`);
    console.log(`- Modified: ${result.modifiedCount} products`);
    console.log('\n✅ Migration completed successfully!');
    console.log('\nNote: Sales data remains intact in the Sales collection.');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run migration
migrate();

