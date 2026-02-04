
const requestStore = new Map();

// Cleanup interval to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of requestStore.entries()) {
    if (now > value.resetTime) {
      requestStore.delete(key);
    }
  }
}, 60000); // Cleanup every minute

function createRateLimiter(options = {}) {
  const {
    windowMs = 60000, // Default: 1 minute
    max = 60, // Default: 60 requests per window
    message = 'Too many requests, please try again later',
    statusCode = 429,
    skipSuccessfulRequests = false,
    keyGenerator = (req) => req.ip || req.connection.remoteAddress
  } = options;

  return function rateLimitMiddleware(req, res, next) {
    const key = keyGenerator(req);
    const now = Date.now();

    // Get or create request record
    let record = requestStore.get(key);

    if (!record || now > record.resetTime) {
      // Create new record
      record = {
        count: 0,
        resetTime: now + windowMs
      };
      requestStore.set(key, record);
    }

    // Increment request count
    record.count++;

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - record.count));
    res.setHeader('X-RateLimit-Reset', new Date(record.resetTime).toISOString());

    // Check if limit exceeded
    if (record.count > max) {
      res.setHeader('Retry-After', Math.ceil((record.resetTime - now) / 1000));
      return res.status(statusCode).json({ 
        error: message,
        retryAfter: Math.ceil((record.resetTime - now) / 1000)
      });
    }

    // If skipSuccessfulRequests is enabled, decrement on success
    if (skipSuccessfulRequests) {
      const originalSend = res.send;
      res.send = function(data) {
        if (res.statusCode < 400) {
          record.count--;
        }
        return originalSend.call(this, data);
      };
    }

    next();
  };
}

/**
 * Strict rate limiter for expensive operations (backups, restores)
 * 3 requests per 10 minutes
 */
const strictRateLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 3,
  message: 'Too many requests for this operation. Please wait before trying again.',
  statusCode: 429
});

/**
 * Auth rate limiter for login/password operations
 * 5 attempts per 15 minutes to prevent brute force
 */
const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: 'Too many authentication attempts. Please try again later.',
  statusCode: 429,
  skipSuccessfulRequests: true // Don't count successful logins
});

/**
 * Standard rate limiter for regular API endpoints
 * 100 requests per minute
 */
const standardRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  message: 'Too many requests. Please slow down.',
  statusCode: 429
});

/**
 * Moderate rate limiter for update operations
 * 20 requests per minute
 */
const moderateRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  message: 'Too many update requests. Please try again later.',
  statusCode: 429
});

module.exports = {
  createRateLimiter,
  strictRateLimiter,
  authRateLimiter,
  standardRateLimiter,
  moderateRateLimiter
};
