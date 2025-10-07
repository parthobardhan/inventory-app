const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config({ path: './dev.env' });

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy for Vercel/reverse proxy deployments
// Use specific hop count for Vercel's proxy setup
app.set('trust proxy', 1);

// Import routes
const productRoutes = require('./routes/products');
const imageRoutes = require('./routes/images');

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000, // Higher limit for development
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  },
  // Use a more secure key generator for Vercel
  keyGenerator: (req) => {
    // For Vercel, the real IP is in x-forwarded-for header
    return req.ip || req.connection.remoteAddress || 'unknown';
  },
  // Skip rate limiting for successful requests to static assets
  skip: (req) => {
    return req.url.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/) || 
           req.url === '/manifest.json' || 
           req.url === '/sw.js';
  }
});

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: [
        "'self'", 
        "'unsafe-inline'", 
        "https://cdn.jsdelivr.net", 
        "https://cdnjs.cloudflare.com",
        "https://fonts.googleapis.com"
      ],
      scriptSrc: [
        "'self'", 
        "'unsafe-inline'",
        "https://cdn.jsdelivr.net"
      ],
      fontSrc: [
        "'self'", 
        "https://cdnjs.cloudflare.com",
        "https://fonts.gstatic.com"
      ],
      imgSrc: [
        "'self'", 
        "data:", 
        "https:",
        "*.amazonaws.com"
      ],
      connectSrc: [
        "'self'",
        "https://cdn.jsdelivr.net",
        "https://cdnjs.cloudflare.com",
        "https://fonts.googleapis.com",
        "https://fonts.gstatic.com",
        "*.amazonaws.com"
      ],
    },
  },
}));
app.use(cors());

// Serve PWA files before rate limiting to prevent 401 errors
app.get('/manifest.json', (req, res) => {
  res.setHeader('Content-Type', 'application/manifest+json');
  res.setHeader('Cache-Control', 'public, max-age=31536000');
  res.sendFile(path.join(__dirname, 'public', 'manifest.json'), (err) => {
    if (err) {
      console.error('Error serving manifest.json:', err);
      res.status(404).json({ error: 'Manifest not found' });
    }
  });
});

// Service worker is now served directly by Vercel static file serving
// app.get('/sw.js', ...) - removed, handled by vercel.json routing

app.use(limiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB connection
const connectDB = async () => {
  try {
    console.warn('🔗 [DB] Attempting to connect to MongoDB...');
    console.warn('🌍 [DB] Environment:', process.env.NODE_ENV);
    console.warn('🔑 [DB] MONGODB_URI configured:', !!process.env.MONGODB_URI);
    
    if (!process.env.MONGODB_URI || process.env.MONGODB_URI.includes('username:password')) {
      console.warn('❌ [DB] MONGODB_URI environment variable is not properly configured');
      console.warn('⚠️ [DB] Running in development mode without database connection');
      console.warn('⚠️ [DB] Frontend will be available but API endpoints will not work');
      throw new Error('MongoDB URI not configured');
    }

    // Check if already connected
    if (mongoose.connection.readyState === 1) {
      console.warn('✅ [DB] Already connected to MongoDB');
      return;
    }

    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000, // Increased timeout for serverless
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      maxPoolSize: 1, // Maintain up to 1 socket connection for serverless
      minPoolSize: 0, // Allow connection pool to close all connections
      maxIdleTimeMS: 30000, // Close connections after 30 seconds of inactivity
      connectTimeoutMS: 10000, // Connection timeout
    });

    console.warn(`✅ [DB] MongoDB Connected: ${conn.connection.host}`);
    console.warn('✅ [DB] Database connection established successfully');
    
    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('💥 [DB] MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ [DB] MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      console.warn('✅ [DB] MongoDB reconnected');
    });

  } catch (error) {
    console.error('💥 [DB] Database connection error:', error.message);
    console.error('💥 [DB] Error stack:', error.stack);
    throw error; // Re-throw to prevent server startup
  }
};

// Initialize database connection
let dbConnected = false;
let dbConnecting = false;

const initDB = async () => {
  if (dbConnected) {
    return true;
  }
  
  if (dbConnecting) {
    // Wait for ongoing connection attempt
    while (dbConnecting && !dbConnected) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return dbConnected;
  }
  
  dbConnecting = true;
  try {
    await connectDB();
    dbConnected = true;
    console.warn('✅ [DB] Database connection established');
    return true;
  } catch (error) {
    console.error('❌ [DB] Failed to connect to database:', error);
    dbConnected = false;
    return false;
  } finally {
    dbConnecting = false;
  }
};

// Routes
app.use('/api/products', productRoutes);
app.use('/api/images', imageRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Textile Inventory API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});


// Serve specific pages first (before catch-all)
app.get('/coverz', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'coverz.html'));
});

app.get('/bed-covers', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'bed-covers.html'));
});

// Serve frontend home page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Handle 404 for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint not found'
  });
});

// Handle all other routes by serving the frontend (catch-all must be last)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Global error handler:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// Initialize database on startup
initDB();

// For local development, start the server
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Frontend available at: http://localhost:${PORT}`);
    console.log(`API available at: http://localhost:${PORT}/api`);
  });
}

// Export the app and initDB function for Vercel
module.exports = app;
module.exports.initDB = initDB;

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  mongoose.connection.close(() => {
    console.log('MongoDB connection closed.');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  mongoose.connection.close(() => {
    console.log('MongoDB connection closed.');
    process.exit(0);
  });
});
