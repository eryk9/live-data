const Redis = require('ioredis');
require('dotenv').config();

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

redis.on('error', (err) => {
  console.error('Errore in Redis:', err);
});

redis.on('connect', () => {
  console.log('Connesso a Redis');
});

// Compatibilità helper: alcune versioni/API usano `setex`.
// Forniamo un wrapper per garantire che `setex` sia disponibile.
if (typeof redis.setex !== 'function') {
  redis.setex = (key, ttl, value) => {
    // ioredis v5 supporta `set` con opzioni, usiamo 'EX' per TTL in secondi
    return redis.set(key, value, 'EX', ttl);
  };
}

module.exports = redis;
