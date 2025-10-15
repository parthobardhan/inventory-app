// Security Middleware
const helmet = require('helmet');

const createSecurityMiddleware = (config) => {
  return helmet({
    contentSecurityPolicy: {
      directives: config.security.contentSecurityPolicy.directives,
    },
  });
};

module.exports = { createSecurityMiddleware };
