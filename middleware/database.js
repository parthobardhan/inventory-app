// Database Connection Middleware
const mongoose = require('mongoose');

class DatabaseManager {
  constructor(config) {
    this.config = config;
    this.connected = false;
    this.connecting = false;
  }

  async connect() {
    try {
      console.warn('🔗 [DB] Attempting to connect to MongoDB...');
      console.warn('🌍 [DB] Environment:', this.config.server.env);
      console.warn('🔑 [DB] MONGODB_URI configured:', !!this.config.database.mongoUri);
      
      if (!this.config.database.mongoUri || this.config.database.mongoUri.includes('username:password')) {
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

      const conn = await mongoose.connect(this.config.database.mongoUri, this.config.database.options);

      console.warn(`✅ [DB] MongoDB Connected: ${conn.connection.host}`);
      console.warn('✅ [DB] Database connection established successfully');
      
      this.setupConnectionEventHandlers();
      this.connected = true;
      
    } catch (error) {
      console.error('💥 [DB] Database connection error:', error.message);
      console.error('💥 [DB] Error stack:', error.stack);
      throw error;
    }
  }

  setupConnectionEventHandlers() {
    mongoose.connection.on('error', (err) => {
      console.error('💥 [DB] MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ [DB] MongoDB disconnected');
      this.connected = false;
    });

    mongoose.connection.on('reconnected', () => {
      console.warn('✅ [DB] MongoDB reconnected');
      this.connected = true;
    });
  }

  async init() {
    if (this.connected) {
      return true;
    }
    
    if (this.connecting) {
      // Wait for ongoing connection attempt
      while (this.connecting && !this.connected) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return this.connected;
    }
    
    this.connecting = true;
    try {
      await this.connect();
      console.warn('✅ [DB] Database connection established');
      return true;
    } catch (error) {
      console.error('❌ [DB] Failed to connect to database:', error);
      this.connected = false;
      return false;
    } finally {
      this.connecting = false;
    }
  }

  async gracefulShutdown() {
    console.log('Closing MongoDB connection...');
    await mongoose.connection.close();
    console.log('MongoDB connection closed.');
  }
}

module.exports = { DatabaseManager };
