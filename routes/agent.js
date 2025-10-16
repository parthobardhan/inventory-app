const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const multer = require('multer');
const { chat, chatWithImage } = require('../services/agentService');

// Configure multer for memory storage (for processing images)
const storage = multer.memoryStorage();
const uploadMemory = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Middleware to check database connection
const checkDBConnection = async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      console.warn('🔄 [DB] Establishing database connection for request...');
      
      try {
        if (!process.env.MONGODB_URI || process.env.MONGODB_URI.includes('username:password')) {
          throw new Error('MongoDB URI not configured');
        }

        await mongoose.connect(process.env.MONGODB_URI, {
          serverSelectionTimeoutMS: 5000,
          socketTimeoutMS: 45000,
          maxPoolSize: 1,
          minPoolSize: 0,
          maxIdleTimeMS: 30000,
          connectTimeoutMS: 5000,
        });
        
        console.warn('✅ [DB] Database connection established for request');
      } catch (error) {
        console.error('❌ [DB] Failed to connect to database:', error.message);
        return res.status(503).json({
          success: false,
          message: 'Database connection not available',
          error: 'Service temporarily unavailable'
        });
      }
    }
    next();
  } catch (error) {
    console.error('Database connection check failed:', error);
    return res.status(503).json({
      success: false,
      message: 'Database connection not available',
      error: 'Service temporarily unavailable'
    });
  }
};

// Error handler for multer
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    console.error('Multer error:', err);
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File too large. Maximum size is 10MB.',
      });
    }
    return res.status(400).json({
      success: false,
      error: `Upload error: ${err.message}`,
    });
  } else if (err) {
    console.error('Upload error:', err);
    return res.status(400).json({
      success: false,
      error: err.message || 'File upload failed',
    });
  }
  next();
};

// POST /api/agent/chat - Handle agent chat requests (with optional image)
router.post('/chat', checkDBConnection, uploadMemory.single('image'), handleMulterError, async (req, res) => {
  try {
    let { message, conversationHistory } = req.body;
    const imageFile = req.file;

    console.log('📥 Received chat request:', {
      hasMessage: !!message,
      messageLength: message ? message.length : 0,
      hasImage: !!imageFile,
      bodyKeys: Object.keys(req.body)
    });

    // Parse conversationHistory if it's a string (from FormData)
    let parsedHistory = conversationHistory || [];
    if (typeof conversationHistory === 'string') {
      try {
        parsedHistory = JSON.parse(conversationHistory);
      } catch (e) {
        console.warn('Failed to parse conversation history:', e);
        parsedHistory = [];
      }
    }

    // Normalize empty message
    message = (message || '').trim();

    // Require either a message or an image
    if (!message && !imageFile) {
      console.warn('❌ Rejected: No message or image provided');
      return res.status(400).json({
        success: false,
        error: 'Message or image is required',
      });
    }

    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        success: false,
        error: 'OpenAI API key not configured',
        message: 'The AI agent is not configured. Please add your OpenAI API key to the environment variables.',
      });
    }

    console.log('Processing agent request:', message || '(with image)');
    if (imageFile) {
      console.log('Image received:', imageFile.originalname, imageFile.size, 'bytes');
    }

    // Process the message with the agent
    let response;
    if (imageFile) {
      // Process with image
      response = await chatWithImage(
        message || 'What is this product?',
        imageFile,
        parsedHistory
      );
    } else {
      // Process text-only
      response = await chat(message, parsedHistory);
    }

    res.json(response);
  } catch (error) {
    console.error('Error in agent chat:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'An error occurred while processing your request.',
    });
  }
});

// GET /api/agent/tools - Get available tools
router.get('/tools', (req, res) => {
  const { tools } = require('../services/agentService');
  
  res.json({
    success: true,
    tools: tools.map(tool => ({
      name: tool.function.name,
      description: tool.function.description,
    })),
  });
});

module.exports = router;

