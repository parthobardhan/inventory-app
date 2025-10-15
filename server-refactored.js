const express = require('express');
const cors = require('cors');
const path = require('path');

// Import configuration
const config = require('./config');

// Import middleware
const { createRateLimiter } = require('./middleware/rateLimiter');
const { createSecurityMiddleware } = require('./middleware/security');
const { DatabaseManager } = require('./middleware/database');
const { createPWAMiddleware, createStaticFileMiddleware } = require('./middleware/static');

// Import routes
const productRoutes = require('./routes/products');
const imageRoutes = require('./routes/images');

const app = express();
const PORT = config.server.port;

// Trust proxy for Vercel/reverse proxy deployments
app.set('trust proxy', config.server.trustProxy);

// Initialize database manager
const dbManager = new DatabaseManager(config);

// Apply middleware in correct order
app.use(createSecurityMiddleware(config));
app.use(cors());

// Handle CORS preflight for API routes
app.options('/api/*', cors());

// PWA middleware (before rate limiting)
createPWAMiddleware(app);

// Rate limiting
const limiter = createRateLimiter(config);
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files
app.use(createStaticFileMiddleware(express));

// API Routes
app.use('/api/products', productRoutes);
app.use('/api/images', imageRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Textile Inventory API is running',
    timestamp: new Date().toISOString(),
    environment: config.server.env,
    database: dbManager.connected ? 'connected' : 'disconnected'
  });
});

// Serve specific pages first (before catch-all)
app.get('/coverz', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'coverz.html'));
});

app.get('/bed-covers', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'bed-covers.html'));
});

app.get('/cushion-covers', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'cushion-covers.html'));
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
    error: config.server.env === 'development' ? error.message : 'Something went wrong'
  });
});

// Initialize database on startup
dbManager.init();

// For local development, start the server
if (config.server.env !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${config.server.env}`);
    console.log(`Frontend available at: http://localhost:${PORT}`);
    console.log(`API available at: http://localhost:${PORT}/api`);
  });
}

// Export the app and dbManager for Vercel
module.exports = app;
module.exports.dbManager = dbManager;

// Graceful shutdown handlers
const gracefulShutdown = () => {
  console.log('Shutting down gracefully...');
  dbManager.gracefulShutdown().then(() => {
    process.exit(0);
  });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
