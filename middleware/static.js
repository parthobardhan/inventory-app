// PWA and Static File Middleware
const path = require('path');

const createPWAMiddleware = (app) => {
  // Serve PWA files before rate limiting to prevent 401 errors
  app.get('/manifest.json', (req, res) => {
    res.setHeader('Content-Type', 'application/manifest+json');
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    res.sendFile(path.join(__dirname, '..', 'public', 'manifest.json'), (err) => {
      if (err) {
        console.error('Error serving manifest.json:', err);
        res.status(404).json({ error: 'Manifest not found' });
      }
    });
  });

  // Service worker is now served directly by Vercel static file serving
  // app.get('/sw.js', ...) - removed, handled by vercel.json routing
};

const createStaticFileMiddleware = (express) => {
  return express.static(path.join(__dirname, '..', 'public'));
};

module.exports = { createPWAMiddleware, createStaticFileMiddleware };
