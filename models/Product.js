const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    maxlength: [100, 'Product name cannot exceed 100 characters']
  },
  sku: {
    type: String,
    required: [true, 'SKU is required'],
    unique: true,
    trim: true,
    uppercase: true,
    maxlength: [50, 'SKU cannot exceed 50 characters'],
    match: [/^[A-Z0-9\-_]+$/, 'SKU can only contain uppercase letters, numbers, hyphens, and underscores']
  },
  type: {
    type: String,
    required: [true, 'Product type is required'],
    enum: {
      values: ['bed-covers', 'cushion-covers', 'sarees', 'towels'],
      message: 'Product type must be one of: bed-covers, cushion-covers, sarees, towels'
    }
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [0, 'Quantity cannot be negative'],
    validate: {
      validator: Number.isInteger,
      message: 'Quantity must be a whole number'
    }
  },
  price: {
    type: Number,
    required: [true, 'List price is required'],
    min: [0, 'List price cannot be negative']
  },
  cost: {
    type: Number,
    min: [0, 'Cost cannot be negative'],
    default: 0
  },
  // Itemized cost breakdown
  costBreakdown: [{
    category: {
      type: String,
      required: true,
      trim: true
    },
    amount: {
      type: Number,
      min: [0, 'Cost amount cannot be negative'],
      required: true
    }
  }],
  dateSold: {
    type: Date
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  caption: {
    type: String,
    trim: true,
    maxlength: [200, 'Caption cannot exceed 200 characters']
  },
  // Image metadata for AWS S3 storage
  images: [{
    id: {
      type: String,
      required: true
    },
    s3Key: {
      type: String,
      required: true
    },
    s3Bucket: {
      type: String,
      required: true
    },
    url: {
      type: String,
      required: true
    },
    filename: {
      type: String,
      required: true
    },
    mimetype: {
      type: String,
      required: true
    },
    size: {
      type: Number,
      required: true
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    },
    // AI-generated content
    aiGenerated: {
      title: {
        type: String,
        trim: true
      },
      description: {
        type: String,
        trim: true
      },
      confidence: {
        type: Number,
        min: 0,
        max: 1
      },
      model: {
        type: String,
        trim: true
      },
      generatedAt: {
        type: Date
      }
    },
    // User edits to AI content
    userEdited: {
      title: {
        type: String,
        trim: true
      },
      description: {
        type: String,
        trim: true
      },
      editedAt: {
        type: Date
      }
    }
  }],
  // Primary image reference
  primaryImageId: {
    type: String
  },
  totalValue: {
    type: Number,
    default: function() {
      return this.quantity * this.price;
    }
  },
  profit: {
    type: Number,
    default: function() {
      // Only calculate profit if item is sold (has dateSold)
      if (this.dateSold && this.cost > 0) {
        return this.price - this.cost;
      }
      return 0;
    }
  },
  dateAdded: {
    type: Date,
    default: Date.now
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Update totalValue and profit before saving
productSchema.pre('save', function(next) {
  // Do NOT auto-calculate cost from costBreakdown - use the user-entered value
  // Cost field will be set explicitly by the user (either manually or from breakdown sum)
  
  this.totalValue = this.quantity * this.price;
  // Calculate profit only if item is sold
  if (this.dateSold && this.cost > 0) {
    this.profit = this.price - this.cost;
  } else {
    this.profit = 0;
  }
  this.lastUpdated = new Date();
  next();
});

// Update totalValue and profit before updating
productSchema.pre('findOneAndUpdate', function(next) {
  const update = this.getUpdate();
  if (update.quantity !== undefined || update.price !== undefined) {
    const quantity = update.quantity !== undefined ? update.quantity : this.getQuery().quantity;
    const price = update.price !== undefined ? update.price : this.getQuery().price;
    update.totalValue = quantity * price;
  }
  
  // Calculate profit if cost, price, or dateSold are being updated
  if (update.cost !== undefined || update.price !== undefined || update.dateSold !== undefined) {
    const cost = update.cost !== undefined ? update.cost : 0;
    const price = update.price !== undefined ? update.price : 0;
    const dateSold = update.dateSold !== undefined ? update.dateSold : null;
    
    if (dateSold && cost > 0) {
      update.profit = price - cost;
    } else {
      update.profit = 0;
    }
  }
  
  update.lastUpdated = new Date();
  next();
});

// Index for better query performance
productSchema.index({ type: 1 });
productSchema.index({ sku: 1 });
productSchema.index({ name: 'text', description: 'text' });
productSchema.index({ dateSold: 1 }); // For profit calculations

module.exports = mongoose.model('Product', productSchema);
