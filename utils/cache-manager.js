/**
 * 缓存管理工具类
 * 提供内存缓存、本地存储缓存、缓存过期管理等功能
 */

class CacheManager {
  constructor() {
    this.memoryCache = new Map(); // 内存缓存
    this.cacheConfig = {
      maxMemorySize: 50 * 1024 * 1024, // 50MB 最大内存缓存
      maxStorageSize: 100 * 1024 * 1024, // 100MB 最大本地存储缓存
      defaultTTL: 30 * 60 * 1000, // 30分钟默认过期时间
      cleanupInterval: 5 * 60 * 1000, // 5分钟清理间隔
      storagePrefix: 'smart_cache_'
    };
    
    this.currentMemorySize = 0;
    this.cleanupTimer = null;
    
    this.startCleanupTimer();
  }

  /**
   * 设置内存缓存
   * @param {string} key - 缓存键
   * @param {any} value - 缓存值
   * @param {number} ttl - 过期时间(毫秒)
   * @returns {boolean} 是否设置成功
   */
  setMemoryCache(key, value, ttl = this.cacheConfig.defaultTTL) {
    try {
      const item = {
        value,
        timestamp: Date.now(),
        ttl,
        size: this.calculateSize(value)
      };

      // 检查内存限制
      if (this.currentMemorySize + item.size > this.cacheConfig.maxMemorySize) {
        this.cleanupMemoryCache();
        
        // 如果清理后仍然超出限制，拒绝设置
        if (this.currentMemorySize + item.size > this.cacheConfig.maxMemorySize) {
          console.warn('内存缓存空间不足:', key);
          return false;
        }
      }

      this.memoryCache.set(key, item);
      this.currentMemorySize += item.size;
      
      return true;
    } catch (error) {
      console.error('设置内存缓存失败:', error);
      return false;
    }
  }

  /**
   * 获取内存缓存
   * @param {string} key - 缓存键
   * @returns {any} 缓存值，如果不存在或过期返回null
   */
  getMemoryCache(key) {
    const item = this.memoryCache.get(key);
    
    if (!item) {
      return null;
    }

    // 检查是否过期
    if (this.isExpired(item)) {
      this.deleteMemoryCache(key);
      return null;
    }

    return item.value;
  }

  /**
   * 删除内存缓存
   * @param {string} key - 缓存键
   * @returns {boolean} 是否删除成功
   */
  deleteMemoryCache(key) {
    const item = this.memoryCache.get(key);
    if (item) {
      this.memoryCache.delete(key);
      this.currentMemorySize -= item.size;
      return true;
    }
    return false;
  }

  /**
   * 设置本地存储缓存
   * @param {string} key - 缓存键
   * @param {any} value - 缓存值
   * @param {number} ttl - 过期时间(毫秒)
   * @returns {Promise<boolean>} 是否设置成功
   */
  async setStorageCache(key, value, ttl = this.cacheConfig.defaultTTL) {
    try {
      const item = {
        value,
        timestamp: Date.now(),
        ttl
      };

      const storageKey = this.getStorageKey(key);
      const itemString = JSON.stringify(item);
      
      // 检查存储空间
      const currentSize = await this.getStorageSize();
      const itemSize = new Blob([itemString]).size;
      
      if (currentSize + itemSize > this.cacheConfig.maxStorageSize) {
        await this.cleanupStorageCache();
      }

      wx.setStorageSync(storageKey, item);
      return true;
      
    } catch (error) {
      console.error('设置本地存储缓存失败:', error);
      return false;
    }
  }

  /**
   * 获取本地存储缓存
   * @param {string} key - 缓存键
   * @returns {Promise<any>} 缓存值，如果不存在或过期返回null
   */
  async getStorageCache(key) {
    try {
      const storageKey = this.getStorageKey(key);
      const item = wx.getStorageSync(storageKey);
      
      if (!item) {
        return null;
      }

      // 检查是否过期
      if (this.isExpired(item)) {
        await this.deleteStorageCache(key);
        return null;
      }

      return item.value;
      
    } catch (error) {
      console.error('获取本地存储缓存失败:', error);
      return null;
    }
  }

  /**
   * 删除本地存储缓存
   * @param {string} key - 缓存键
   * @returns {Promise<boolean>} 是否删除成功
   */
  async deleteStorageCache(key) {
    try {
      const storageKey = this.getStorageKey(key);
      wx.removeStorageSync(storageKey);
      return true;
    } catch (error) {
      console.error('删除本地存储缓存失败:', error);
      return false;
    }
  }

  /**
   * 设置缓存（优先内存，超出大小则使用本地存储）
   * @param {string} key - 缓存键
   * @param {any} value - 缓存值
   * @param {Object} options - 选项
   * @returns {Promise<boolean>} 是否设置成功
   */
  async set(key, value, options = {}) {
    const {
      ttl = this.cacheConfig.defaultTTL,
      forceStorage = false,
      maxMemoryItemSize = 1024 * 1024 // 1MB
    } = options;

    const size = this.calculateSize(value);
    
    // 如果强制使用存储或数据过大，直接使用本地存储
    if (forceStorage || size > maxMemoryItemSize) {
      return await this.setStorageCache(key, value, ttl);
    }

    // 优先使用内存缓存
    const memorySuccess = this.setMemoryCache(key, value, ttl);
    if (memorySuccess) {
      return true;
    }

    // 内存缓存失败，降级到本地存储
    return await this.setStorageCache(key, value, ttl);
  }

  /**
   * 获取缓存（优先内存，然后本地存储）
   * @param {string} key - 缓存键
   * @returns {Promise<any>} 缓存值
   */
  async get(key) {
    // 先查找内存缓存
    const memoryValue = this.getMemoryCache(key);
    if (memoryValue !== null) {
      return memoryValue;
    }

    // 再查找本地存储缓存
    const storageValue = await this.getStorageCache(key);
    
    // 如果从本地存储找到，且不太大，同时加入内存缓存
    if (storageValue !== null) {
      const size = this.calculateSize(storageValue);
      if (size <= 1024 * 1024) { // 小于1MB
        this.setMemoryCache(key, storageValue);
      }
    }

    return storageValue;
  }

  /**
   * 删除缓存
   * @param {string} key - 缓存键
   * @returns {Promise<boolean>} 是否删除成功
   */
  async delete(key) {
    const memoryDeleted = this.deleteMemoryCache(key);
    const storageDeleted = await this.deleteStorageCache(key);
    
    return memoryDeleted || storageDeleted;
  }

  /**
   * 清空所有缓存
   * @returns {Promise<void>}
   */
  async clear() {
    // 清空内存缓存
    this.memoryCache.clear();
    this.currentMemorySize = 0;

    // 清空本地存储缓存
    try {
      const storageInfo = wx.getStorageInfoSync();
      const keys = storageInfo.keys.filter(key => 
        key.startsWith(this.cacheConfig.storagePrefix)
      );
      
      for (const key of keys) {
        wx.removeStorageSync(key);
      }
    } catch (error) {
      console.error('清空本地存储缓存失败:', error);
    }
  }

  /**
   * 缓存装饰器 - 用于函数结果缓存
   * @param {string} key - 缓存键
   * @param {Function} func - 要缓存的函数
   * @param {Object} options - 选项
   * @returns {Function} 装饰后的函数
   */
  cached(key, func, options = {}) {
    return async (...args) => {
      const cacheKey = `${key}_${JSON.stringify(args)}`;
      
      // 尝试从缓存获取
      const cachedValue = await this.get(cacheKey);
      if (cachedValue !== null) {
        return cachedValue;
      }

      // 执行函数
      const result = await func(...args);
      
      // 缓存结果
      await this.set(cacheKey, result, options);
      
      return result;
    };
  }

  /**
   * 预加载缓存
   * @param {Array} items - 预加载项目列表 [{key, factory, options}]
   * @returns {Promise<Array>} 预加载结果
   */
  async preload(items) {
    const results = [];
    
    for (const item of items) {
      try {
        const { key, factory, options = {} } = item;
        
        // 检查是否已存在
        const existing = await this.get(key);
        if (existing !== null) {
          results.push({ key, success: true, cached: true });
          continue;
        }

        // 生成数据
        const value = await factory();
        const success = await this.set(key, value, options);
        
        results.push({ key, success, cached: false });
        
      } catch (error) {
        console.error('预加载失败:', item.key, error);
        results.push({ key: item.key, success: false, error: error.message });
      }
    }

    return results;
  }

  /**
   * 获取缓存统计信息
   * @returns {Promise<Object>} 统计信息
   */
  async getStats() {
    const memoryStats = {
      count: this.memoryCache.size,
      size: this.currentMemorySize,
      maxSize: this.cacheConfig.maxMemorySize,
      usage: (this.currentMemorySize / this.cacheConfig.maxMemorySize) * 100
    };

    const storageSize = await this.getStorageSize();
    const storageStats = {
      size: storageSize,
      maxSize: this.cacheConfig.maxStorageSize,
      usage: (storageSize / this.cacheConfig.maxStorageSize) * 100
    };

    return {
      memory: memoryStats,
      storage: storageStats,
      config: this.cacheConfig
    };
  }

  /**
   * 设置缓存配置
   * @param {Object} config - 配置对象
   */
  setConfig(config) {
    this.cacheConfig = { ...this.cacheConfig, ...config };
    
    // 重启清理定时器
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.startCleanupTimer();
  }

  /**
   * 清理内存缓存
   */
  cleanupMemoryCache() {
    const now = Date.now();
    const items = Array.from(this.memoryCache.entries());
    
    // 按访问时间排序，删除过期的和最老的
    items.sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    for (const [key, item] of items) {
      if (this.isExpired(item)) {
        this.deleteMemoryCache(key);
      } else if (this.currentMemorySize > this.cacheConfig.maxMemorySize * 0.8) {
        // 如果仍然超过80%使用量，删除最老的
        this.deleteMemoryCache(key);
      } else {
        break;
      }
    }
  }

  /**
   * 清理本地存储缓存
   * @returns {Promise<void>}
   */
  async cleanupStorageCache() {
    try {
      const storageInfo = wx.getStorageInfoSync();
      const cacheKeys = storageInfo.keys.filter(key => 
        key.startsWith(this.cacheConfig.storagePrefix)
      );

      // 检查过期项
      for (const key of cacheKeys) {
        try {
          const item = wx.getStorageSync(key);
          if (item && this.isExpired(item)) {
            wx.removeStorageSync(key);
          }
        } catch (error) {
          // 删除损坏的缓存项
          wx.removeStorageSync(key);
        }
      }

    } catch (error) {
      console.error('清理本地存储缓存失败:', error);
    }
  }

  /**
   * 启动清理定时器
   */
  startCleanupTimer() {
    this.cleanupTimer = setInterval(() => {
      this.cleanupMemoryCache();
      this.cleanupStorageCache();
    }, this.cacheConfig.cleanupInterval);
  }

  /**
   * 检查缓存项是否过期
   * @param {Object} item - 缓存项
   * @returns {boolean} 是否过期
   */
  isExpired(item) {
    if (!item.ttl) return false;
    return Date.now() - item.timestamp > item.ttl;
  }

  /**
   * 计算数据大小（估算）
   * @param {any} data - 数据
   * @returns {number} 字节大小
   */
  calculateSize(data) {
    try {
      const jsonString = JSON.stringify(data);
      return new Blob([jsonString]).size;
    } catch (error) {
      // 如果无法序列化，返回估算大小
      return 1024; // 1KB 默认大小
    }
  }

  /**
   * 获取存储键
   * @param {string} key - 原始键
   * @returns {string} 存储键
   */
  getStorageKey(key) {
    return `${this.cacheConfig.storagePrefix}${key}`;
  }

  /**
   * 获取本地存储总大小
   * @returns {Promise<number>} 字节大小
   */
  async getStorageSize() {
    try {
      const storageInfo = wx.getStorageInfoSync();
      const cacheKeys = storageInfo.keys.filter(key => 
        key.startsWith(this.cacheConfig.storagePrefix)
      );

      let totalSize = 0;
      for (const key of cacheKeys) {
        try {
          const item = wx.getStorageSync(key);
          if (item) {
            totalSize += this.calculateSize(item);
          }
        } catch (error) {
          // 忽略损坏的项
        }
      }

      return totalSize;
    } catch (error) {
      console.error('获取存储大小失败:', error);
      return 0;
    }
  }

  /**
   * 销毁缓存管理器
   */
  destroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    
    this.memoryCache.clear();
    this.currentMemorySize = 0;
  }
}

// 导出单例
export default new CacheManager(); 