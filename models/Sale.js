const mongoose = require('mongoose');

const saleSchema = new mongoose.Schema({
  // Product reference
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, 'Product ID is required']
  },
  sku: {
    type: String,
    required: [true, 'SKU is required'],
    trim: true,
    uppercase: true
  },
  // Sale details
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [1, 'Quantity must be at least 1'],
    validate: {
      validator: Number.isInteger,
      message: 'Quantity must be a whole number'
    }
  },
  sellPrice: {
    type: Number,
    required: [true, 'Sell price is required'],
    min: [0, 'Sell price cannot be negative']
  },
  cost: {
    type: Number,
    required: [true, 'Cost is required'],
    min: [0, 'Cost cannot be negative']
  },
  dateSold: {
    type: Date,
    required: [true, 'Sale date is required'],
    default: Date.now
  },
  // Calculated fields
  totalSaleValue: {
    type: Number,
    default: function() {
      return this.quantity * this.sellPrice;
    }
  },
  totalCost: {
    type: Number,
    default: function() {
      return this.quantity * this.cost;
    }
  },
  profit: {
    type: Number,
    default: function() {
      return this.totalSaleValue - this.totalCost;
    }
  },
  profitMargin: {
    type: Number,
    default: function() {
      if (this.totalSaleValue > 0) {
        return ((this.totalSaleValue - this.totalCost) / this.totalSaleValue) * 100;
      }
      return 0;
    }
  },
  // Metadata
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Calculate derived fields before saving
saleSchema.pre('save', function(next) {
  this.totalSaleValue = this.quantity * this.sellPrice;
  this.totalCost = this.quantity * this.cost;
  this.profit = this.totalSaleValue - this.totalCost;
  
  if (this.totalSaleValue > 0) {
    this.profitMargin = ((this.totalSaleValue - this.totalCost) / this.totalSaleValue) * 100;
  } else {
    this.profitMargin = 0;
  }
  
  next();
});

// Indexes for better query performance
saleSchema.index({ sku: 1 });
saleSchema.index({ dateSold: -1 });
saleSchema.index({ productId: 1 });
saleSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Sale', saleSchema);
