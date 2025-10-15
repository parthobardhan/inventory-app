// Rate Limiting Middleware
const rateLimit = require('express-rate-limit');

const createRateLimiter = (config) => {
  return rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    message: config.rateLimit.message,
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
};

module.exports = { createRateLimiter };
