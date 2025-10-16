// Central Configuration Management
require('dotenv').config({ path: './dev.env' });

const config = {
  // Database Configuration
  database: {
    mongoUri: process.env.MONGODB_URI,
    options: {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      maxPoolSize: process.env.NODE_ENV === 'production' ? 1 : 10,
      minPoolSize: 0,
      maxIdleTimeMS: 30000,
      connectTimeoutMS: 10000,
    }
  },

  // Server Configuration
  server: {
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || 'development',
    trustProxy: 1,
  },

  // AWS/S3 Configuration
  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION || 'us-east-1',
    bucketName: process.env.S3_BUCKET_NAME,
  },

  // AI Services Configuration
  ai: {
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || 'gpt-4-vision-preview',
    },
    huggingface: {
      apiKey: process.env.HUGGING_FACE_API_KEY,
    },
    ollama: {
      host: process.env.OLLAMA_HOST || 'http://localhost:11434',
    }
  },

  // Rate Limiting Configuration
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'production' ? 100 : 1000,
    message: {
      success: false,
      message: 'Too many requests from this IP, please try again later.'
    }
  },

  // Security Configuration
  security: {
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
    }
  }
};

module.exports = config;
