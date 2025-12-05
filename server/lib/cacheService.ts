/**
 * Cache Service
 * 
 * Provides Redis-based caching using existing Redis infrastructure
 * Integrates with existing storage system without modifying existing code
 */

// Guarded import - only load Redis if enabled
// Redis will be imported dynamically when needed

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string; // Key prefix
  serialize?: boolean; // Whether to serialize/deserialize data
}

export interface CacheStats {
  hits: number;
  misses: number;
  keys: number;
  memory: string;
}

export class CacheService {
  private redis: any;
  private defaultTTL: number;
  private keyPrefix: string;
  private stats: { hits: number; misses: number };

  constructor(options: {
    defaultTTL?: number;
    keyPrefix?: string;
  } = {}) {
    // Use existing Redis URL from environment
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    // Initialize Redis lazily if enabled
    this.redis = null;
    if (process.env.REDIS_ENABLED === 'true') {
      this.initializeRedis(redisUrl).catch((error) => {
        console.warn('[CacheService] Redis initialization failed, using no-op mode:', error);
        this.redis = null;
      });
    } else {
      console.log('[CacheService] Running in no-op mode');
    }

    this.defaultTTL = options.defaultTTL || 300; // 5 minutes default
    this.keyPrefix = options.keyPrefix || 'poolvisual:';
    this.stats = { hits: 0, misses: 0 };
  }

  private async initializeRedis(redisUrl: string): Promise<void> {
    try {
      const RedisModule = await import('ioredis');
      const Redis = RedisModule.default || RedisModule;
      this.redis = new Redis(redisUrl, {
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        // Connection pooling for better performance
        family: 4,
        keepAlive: true
      });

      // Handle Redis connection errors gracefully
      this.redis.on('error', (error: Error) => {
        console.warn('[CacheService] Redis connection error:', error.message);
      });

      this.redis.on('connect', () => {
        console.log('[CacheService] Connected to Redis');
      });
    } catch (error) {
      console.warn('[CacheService] Redis not available, using no-op mode');
      this.redis = null;
    }
  }

  /**
   * Get cached data
   * @param key Cache key
   * @param options Cache options
   * @returns Promise<T | null> Cached data or null
   */
  async get<T>(key: string, options: CacheOptions = {}): Promise<T | null> {
    try {
      // No-op mode: always miss
      if (!this.redis) {
        this.stats.misses++;
        return null;
      }
      
      const fullKey = this.getFullKey(key, options.prefix);
      const data = await this.redis.get(fullKey);
      
      if (data === null) {
        this.stats.misses++;
        return null;
      }

      this.stats.hits++;
      
      if (options.serialize !== false) {
        return JSON.parse(data);
      }
      
      return data as T;

    } catch (error) {
      console.error('[CacheService] Error getting cache:', error);
      this.stats.misses++;
      return null;
    }
  }

  /**
   * Set cached data
   * @param key Cache key
   * @param value Data to cache
   * @param options Cache options
   * @returns Promise<boolean> Success status
   */
  async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<boolean> {
    try {
      // No-op mode: always succeed
      if (!this.redis) {
        return true;
      }
      
      const fullKey = this.getFullKey(key, options.prefix);
      const ttl = options.ttl || this.defaultTTL;
      
      let data: string;
      if (options.serialize !== false) {
        data = JSON.stringify(value);
      } else {
        data = value as string;
      }

      if (ttl > 0) {
        await this.redis.setex(fullKey, ttl, data);
      } else {
        await this.redis.set(fullKey, data);
      }

      return true;

    } catch (error) {
      console.error('[CacheService] Error setting cache:', error);
      return false;
    }
  }

  /**
   * Delete cached data
   * @param key Cache key
   * @param options Cache options
   * @returns Promise<boolean> Success status
   */
  async delete(key: string, options: CacheOptions = {}): Promise<boolean> {
    try {
      const fullKey = this.getFullKey(key, options.prefix);
      const result = await this.redis.del(fullKey);
      return result > 0;

    } catch (error) {
      console.error('[CacheService] Error deleting cache:', error);
      return false;
    }
  }

  /**
   * Check if key exists in cache
   * @param key Cache key
   * @param options Cache options
   * @returns Promise<boolean> Exists status
   */
  async exists(key: string, options: CacheOptions = {}): Promise<boolean> {
    try {
      const fullKey = this.getFullKey(key, options.prefix);
      const result = await this.redis.exists(fullKey);
      return result === 1;

    } catch (error) {
      console.error('[CacheService] Error checking cache existence:', error);
      return false;
    }
  }

  /**
   * Get or set cached data with fallback function
   * @param key Cache key
   * @param fallback Function to get data if not cached
   * @param options Cache options
   * @returns Promise<T> Cached or fresh data
   */
  async getOrSet<T>(
    key: string, 
    fallback: () => Promise<T>, 
    options: CacheOptions = {}
  ): Promise<T> {
    try {
      // Try to get from cache first
      const cached = await this.get<T>(key, options);
      if (cached !== null) {
        return cached;
      }

      // Get fresh data from fallback
      const freshData = await fallback();
      
      // Cache the fresh data
      await this.set(key, freshData, options);
      
      return freshData;

    } catch (error) {
      console.error('[CacheService] Error in getOrSet:', error);
      // Fallback to fresh data if caching fails
      return await fallback();
    }
  }

  /**
   * Invalidate cache by pattern
   * @param pattern Pattern to match keys
   * @param options Cache options
   * @returns Promise<number> Number of keys deleted
   */
  async invalidatePattern(pattern: string, options: CacheOptions = {}): Promise<number> {
    try {
      const fullPattern = this.getFullKey(pattern, options.prefix);
      const keys = await this.redis.keys(fullPattern);
      
      if (keys.length === 0) {
        return 0;
      }

      // Delete in batches to avoid blocking Redis
      const batchSize = 100;
      let deleted = 0;
      
      for (let i = 0; i < keys.length; i += batchSize) {
        const batch = keys.slice(i, i + batchSize);
        const result = await this.redis.del(...batch);
        deleted += result;
      }

      return deleted;

    } catch (error) {
      console.error('[CacheService] Error invalidating pattern:', error);
      return 0;
    }
  }

  /**
   * Get cache statistics
   * @returns Promise<CacheStats> Cache statistics
   */
  async getStats(): Promise<CacheStats> {
    try {
      const info = await this.redis.info('memory');
      const memoryMatch = info.match(/used_memory_human:([^\r\n]+)/);
      const memory = memoryMatch ? memoryMatch[1] : 'unknown';

      const keys = await this.redis.dbsize();

      return {
        hits: this.stats.hits,
        misses: this.stats.misses,
        keys,
        memory
      };

    } catch (error) {
      console.error('[CacheService] Error getting stats:', error);
      return {
        hits: this.stats.hits,
        misses: this.stats.misses,
        keys: 0,
        memory: 'unknown'
      };
    }
  }

  /**
   * Clear all cache data
   * @returns Promise<boolean> Success status
   */
  async clear(): Promise<boolean> {
    try {
      await this.redis.flushdb();
      this.stats = { hits: 0, misses: 0 };
      return true;

    } catch (error) {
      console.error('[CacheService] Error clearing cache:', error);
      return false;
    }
  }

  /**
   * Get cache hit rate
   * @returns number Hit rate percentage
   */
  getHitRate(): number {
    const total = this.stats.hits + this.stats.misses;
    return total > 0 ? (this.stats.hits / total) * 100 : 0;
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    try {
      await this.redis.quit();
    } catch (error) {
      console.error('[CacheService] Error closing Redis connection:', error);
    }
  }

  /**
   * Get full cache key with prefix
   * @param key Base key
   * @param prefix Optional prefix override
   * @returns string Full key
   */
  private getFullKey(key: string, prefix?: string): string {
    const keyPrefix = prefix || this.keyPrefix;
    return `${keyPrefix}${key}`;
  }
}

/**
 * Cache decorator for methods
 * Automatically caches method results
 */
export function Cacheable(options: CacheOptions = {}) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    const cacheService = new CacheService();

    descriptor.value = async function (...args: any[]) {
      const cacheKey = `${propertyName}:${JSON.stringify(args)}`;
      
      return cacheService.getOrSet(
        cacheKey,
        () => method.apply(this, args),
        options
      );
    };

    return descriptor;
  };
}

/**
 * Cache invalidation decorator
 * Automatically invalidates cache when method is called
 */
export function CacheInvalidate(pattern: string, options: CacheOptions = {}) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    const cacheService = new CacheService();

    descriptor.value = async function (...args: any[]) {
      const result = await method.apply(this, args);
      
      // Invalidate cache after method execution
      await cacheService.invalidatePattern(pattern, options);
      
      return result;
    };

    return descriptor;
  };
}

// Export singleton instance for global use
export const cacheService = new CacheService();
