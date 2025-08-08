const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    maxlength: [100, 'Product name cannot exceed 100 characters']
  },
  type: {
    type: String,
    required: [true, 'Product type is required'],
    enum: {
      values: ['bed-covers', 'cushion-covers', 'sarees', 'napkins', 'towels'],
      message: 'Product type must be one of: bed-covers, cushion-covers, sarees, napkins, towels'
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
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
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

// Update totalValue before saving
productSchema.pre('save', function(next) {
  this.totalValue = this.quantity * this.price;
  this.lastUpdated = new Date();
  next();
});

// Update totalValue before updating
productSchema.pre('findOneAndUpdate', function(next) {
  const update = this.getUpdate();
  if (update.quantity !== undefined || update.price !== undefined) {
    const quantity = update.quantity !== undefined ? update.quantity : this.getQuery().quantity;
    const price = update.price !== undefined ? update.price : this.getQuery().price;
    update.totalValue = quantity * price;
  }
  update.lastUpdated = new Date();
  next();
});

// Index for better query performance
productSchema.index({ type: 1 });
productSchema.index({ name: 'text', description: 'text' });

module.exports = mongoose.model('Product', productSchema);
