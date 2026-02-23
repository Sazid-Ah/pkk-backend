const redis = require('redis');

// Initialize the Redis Client
const redisClient = redis.createClient({
    // If you have a remote Redis URL (e.g., AWS ElastiCache, Upstash), put it here
    // url: process.env.REDIS_URL
});

redisClient.on('error', (err) => {
    console.error('Redis Client Error:', err);
});

redisClient.on('connect', () => {
    console.log('Connected to Redis Successfully');
});

// Connect immediately (self-executing async wrapper for top-level await behavior)
(async () => {
    try {
        await redisClient.connect();
    } catch (err) {
        console.error('Failed to connect to Redis during initialization', err);
    }
})();

module.exports = redisClient;
