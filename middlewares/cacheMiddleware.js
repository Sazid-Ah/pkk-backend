const redisClient = require('../utils/redisClient');

const cacheMiddleware = async (req, res, next) => {
    // If Redis is not connected yet, bypass caching
    if (!redisClient.isReady) {
        return next();
    }

    try {
        // Create a unique key based on the URL and query parameters
        // Example: /api/product?category=AC
        const key = `cache:${req.originalUrl || req.url}`;

        const cachedData = await redisClient.get(key);

        if (cachedData) {
            // If data is found in cache, parse and return it immediately
            const parsedData = JSON.parse(cachedData);
            return res.status(200).json(parsedData);
        }

        // If not in cache, we need to intercept the response so we can save it to Redis
        // Replace the res.json method temporarily
        const originalSend = res.json;
        res.json = (body) => {
            // Only cache successful requests
            if (res.statusCode >= 200 && res.statusCode < 300) {
                // Save to Redis with an expiration (e.g., 1 hour = 3600 seconds)
                redisClient.setEx(key, 3600, JSON.stringify(body))
                    .catch(err => console.error('Error saving to Redis:', err));
            }
            // Call the original res.json to send the response to the client
            originalSend.call(res, body);
        };

        next();
    } catch (error) {
        console.error('Redis Cache Middleware Error:', error);
        // On error, just bypass caching and proceed normally
        next();
    }
};

/**
 * Utility to clear cache for a specific set of routes
 * Useful when items are created/updated/deleted
 */
const clearCache = async (routePrefix) => {
    if (!redisClient.isReady) return;

    try {
        // Find all keys starting with `cache:${routePrefix}` and delete them
        const keys = await redisClient.keys(`cache:${routePrefix}*`);
        if (keys.length > 0) {
            await redisClient.del(keys);
            console.log(`Cleared ${keys.length} cache entries for ${routePrefix}`);
        }
    } catch (err) {
        console.error('Error clearing cache:', err);
    }
};

/**
 * Middleware factory to clear cache after successful mutations
 */
const clearCacheMiddleware = (routePrefix) => {
    return async (req, res, next) => {
        // We want to clear the cache AFTER the response finishes successfully
        res.on('finish', () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
                clearCache(routePrefix);
            }
        });
        next();
    };
};

module.exports = {
    cacheMiddleware,
    clearCache,
    clearCacheMiddleware
};
