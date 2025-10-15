const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { chat } = require('../services/agentService');

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

// POST /api/agent/chat - Handle agent chat requests
router.post('/chat', checkDBConnection, async (req, res) => {
  try {
    const { message, conversationHistory } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required',
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

    console.log('Processing agent request:', message);

    // Process the message with the agent
    const response = await chat(message, conversationHistory || []);

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

