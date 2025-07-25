/**
 * 缓存管理工具类 - 优化版
 * 提供内存缓存、本地存储缓存、缓存过期管理等功能
 * 优化点：LRU算法、智能清理、分层缓存、性能监控
 */

import { errorHandler } from './error-handler';
import { debounce, throttle, deepClone } from './common';

class CacheManager {
  constructor() {
    // 缓存配置
    this.config = {
      maxMemorySize: 50 * 1024 * 1024, // 50MB 最大内存缓存
      maxStorageSize: 100 * 1024 * 1024, // 100MB 最大本地存储缓存
      defaultTTL: 30 * 60 * 1000, // 30分钟默认过期时间
      cleanupInterval: 5 * 60 * 1000, // 5分钟清理间隔
      storagePrefix: 'smart_cache_',
      enableCompression: true, // 启用数据压缩
      enableLRU: true, // 启用LRU算法
      enableMetrics: true, // 启用性能指标
      maxCacheItems: 1000 // 最大缓存项数量
    };
    
    // 内存缓存 - 使用Map实现LRU
    this.memoryCache = new Map();
    this.currentMemorySize = 0;
    
    // 清理定时器
    this.cleanupTimer = null;
    
    // 访问顺序跟踪（LRU）
    this.accessOrder = new Map(); // key -> timestamp
    
    // 性能指标
    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0, // 被驱逐的缓存项
      compressionSavings: 0 // 压缩节省的字节数
    };

    // 缓存类型配置
    this.cacheTypes = {
      user: { ttl: 60 * 60 * 1000, priority: 'high' }, // 1小时，高优先级
      api: { ttl: 30 * 60 * 1000, priority: 'medium' }, // 30分钟，中优先级
      image: { ttl: 24 * 60 * 60 * 1000, priority: 'low' }, // 24小时，低优先级
      temp: { ttl: 5 * 60 * 1000, priority: 'lowest' } // 5分钟，最低优先级
    };

    // 防抖和节流函数
    this.debouncedCleanup = debounce(this.performCleanup.bind(this), 1000);
    this.throttledMetricsLog = throttle(this.logMetrics.bind(this), 60000); // 每分钟最多记录一次

    this.init();
  }

  /**
   * 初始化缓存管理器
   */
  init() {
    try {
      // 启动定时清理
      this.startCleanupTimer();
      
      // 恢复本地存储的缓存信息
      this.restoreStorageMetadata();
      
      console.log('缓存管理器初始化完成');
    } catch (error) {
      errorHandler.handleError(error, {
        context: 'CacheManager.init',
        level: 'warning'
      });
    }
  }

  /**
   * 设置配置
   */
  setConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * 静态方法：设置全局配置
   */
  static setConfig(config) {
    if (this.instance) {
      this.instance.setConfig(config);
    }
  }

  /**
   * 设置内存缓存
   * @param {string} key - 缓存键
   * @param {any} value - 缓存值
   * @param {Object} options - 选项
   * @returns {boolean} 是否设置成功
   */
  async setMemoryCache(key, value, options = {}) {
    try {
      const {
        ttl = this.config.defaultTTL,
        priority = 'medium',
        compress = this.config.enableCompression
      } = options;

      // 计算数据大小
      let processedValue = value;
      let originalSize = this.calculateSize(value);
      let finalSize = originalSize;

      // 数据压缩
      if (compress && originalSize > 1024) { // 大于1KB才压缩
        try {
          processedValue = this.compressData(value);
          finalSize = this.calculateSize(processedValue);
          this.metrics.compressionSavings += (originalSize - finalSize);
        } catch (error) {
          console.warn('数据压缩失败，使用原始数据', error);
          processedValue = value;
        }
      }

      // 检查内存限制
      const availableSpace = this.config.maxMemorySize - this.currentMemorySize;
      if (finalSize > availableSpace) {
        // 尝试清理空间
        await this.freeMemorySpace(finalSize);
        
        // 再次检查
        if (finalSize > (this.config.maxMemorySize - this.currentMemorySize)) {
          console.warn('内存缓存空间不足:', key);
          return false;
        }
      }

      const item = {
        value: processedValue,
        originalValue: compress ? value : null, // 只在压缩时保存原始值用于调试
        timestamp: Date.now(),
        ttl,
        priority,
        size: finalSize,
        compressed: compress && finalSize < originalSize,
        accessCount: 0,
        lastAccess: Date.now()
      };

      // 如果键已存在，先减去旧值的大小
      if (this.memoryCache.has(key)) {
        const oldItem = this.memoryCache.get(key);
        this.currentMemorySize -= oldItem.size;
      }

      this.memoryCache.set(key, item);
      this.currentMemorySize += finalSize;
      
      // 更新LRU访问顺序
      if (this.config.enableLRU) {
        this.accessOrder.set(key, Date.now());
      }

      this.metrics.sets++;
      this.throttledMetricsLog();

      return true;

    } catch (error) {
      errorHandler.handleError(error, {
        context: 'CacheManager.setMemoryCache',
        level: 'warning',
        extra: { key }
      });
      return false;
    }
  }

  /**
   * 获取内存缓存
   * @param {string} key - 缓存键
   * @returns {any} 缓存值或null
   */
  getMemoryCache(key) {
    try {
      const item = this.memoryCache.get(key);
      
      if (!item) {
        this.metrics.misses++;
        return null;
      }

      // 检查过期
      const now = Date.now();
      if (now - item.timestamp > item.ttl) {
        this.deleteMemoryCache(key);
        this.metrics.misses++;
        return null;
      }

      // 更新访问信息
      item.accessCount++;
      item.lastAccess = now;
      
      // 更新LRU顺序
      if (this.config.enableLRU) {
        this.accessOrder.set(key, now);
      }

      this.metrics.hits++;
      
      // 解压缩数据
      let value = item.value;
      if (item.compressed) {
        try {
          value = this.decompressData(item.value);
        } catch (error) {
          console.warn('数据解压缩失败', error);
          // 如果有原始值备份，使用它
          value = item.originalValue || item.value;
        }
      }

      return value;

    } catch (error) {
      errorHandler.handleError(error, {
        context: 'CacheManager.getMemoryCache',
        level: 'warning',
        extra: { key }
      });
      this.metrics.misses++;
      return null;
    }
  }

  /**
   * 删除内存缓存
   * @param {string} key - 缓存键
   * @returns {boolean} 是否删除成功
   */
  deleteMemoryCache(key) {
    try {
      const item = this.memoryCache.get(key);
      if (item) {
        this.currentMemorySize -= item.size;
        this.memoryCache.delete(key);
        this.accessOrder.delete(key);
        this.metrics.deletes++;
        return true;
      }
      return false;
    } catch (error) {
      errorHandler.handleError(error, {
        context: 'CacheManager.deleteMemoryCache',
        level: 'warning',
        extra: { key }
      });
      return false;
    }
  }

  /**
   * 设置本地存储缓存
   * @param {string} key - 缓存键
   * @param {any} value - 缓存值
   * @param {Object} options - 选项
   * @returns {Promise<boolean>} 是否设置成功
   */
  async setStorageCache(key, value, options = {}) {
    try {
      const {
        ttl = this.config.defaultTTL,
        compress = this.config.enableCompression
      } = options;

      const storageKey = this.config.storagePrefix + key;
      
      // 准备存储数据
      let processedValue = value;
      if (compress) {
        try {
          processedValue = this.compressData(value);
        } catch (error) {
          console.warn('存储数据压缩失败', error);
        }
      }

      const storageItem = {
        value: processedValue,
        timestamp: Date.now(),
        ttl,
        compressed: compress,
        size: this.calculateSize(processedValue)
      };

      // 检查存储空间
      const currentStorageSize = await this.getStorageSize();
      if (currentStorageSize + storageItem.size > this.config.maxStorageSize) {
        await this.cleanupStorageSpace(storageItem.size);
      }

      return new Promise((resolve) => {
        wx.setStorage({
          key: storageKey,
          data: storageItem,
          success: () => {
            this.updateStorageMetadata(key, storageItem);
            resolve(true);
          },
          fail: (error) => {
            console.warn('设置本地存储失败:', error);
            resolve(false);
          }
        });
      });

    } catch (error) {
      errorHandler.handleError(error, {
        context: 'CacheManager.setStorageCache',
        level: 'warning',
        extra: { key }
      });
      return false;
    }
  }

  /**
   * 获取本地存储缓存
   * @param {string} key - 缓存键
   * @returns {Promise<any>} 缓存值或null
   */
  async getStorageCache(key) {
    try {
      const storageKey = this.config.storagePrefix + key;
      
      return new Promise((resolve) => {
        wx.getStorage({
          key: storageKey,
          success: (res) => {
            const item = res.data;
            
            // 检查过期
            const now = Date.now();
            if (now - item.timestamp > item.ttl) {
              this.deleteStorageCache(key);
              resolve(null);
              return;
            }

            // 解压缩数据
            let value = item.value;
            if (item.compressed) {
              try {
                value = this.decompressData(item.value);
              } catch (error) {
                console.warn('存储数据解压缩失败', error);
                value = item.value;
              }
            }

            resolve(value);
          },
          fail: () => {
            resolve(null);
          }
        });
      });

    } catch (error) {
      errorHandler.handleError(error, {
        context: 'CacheManager.getStorageCache',
        level: 'warning',
        extra: { key }
      });
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
      const storageKey = this.config.storagePrefix + key;
      
      return new Promise((resolve) => {
        wx.removeStorage({
          key: storageKey,
          success: () => {
            this.removeStorageMetadata(key);
            resolve(true);
          },
          fail: () => {
            resolve(false);
          }
        });
      });

    } catch (error) {
      errorHandler.handleError(error, {
        context: 'CacheManager.deleteStorageCache',
        level: 'warning',
        extra: { key }
      });
      return false;
    }
  }

  /**
   * 通用缓存获取方法（先内存后存储）
   * @param {string} key - 缓存键
   * @returns {Promise<any>} 缓存值或null
   */
  async get(key) {
    // 先检查内存缓存
    let value = this.getMemoryCache(key);
    if (value !== null) {
      return value;
    }

    // 再检查本地存储缓存
    value = await this.getStorageCache(key);
    if (value !== null) {
      // 将值提升到内存缓存（热点数据）
      await this.setMemoryCache(key, value, { ttl: this.config.defaultTTL });
    }

    return value;
  }

  /**
   * 通用缓存设置方法
   * @param {string} key - 缓存键
   * @param {any} value - 缓存值
   * @param {Object} options - 选项
   * @returns {Promise<boolean>} 是否设置成功
   */
  async set(key, value, options = {}) {
    const {
      memoryOnly = false,
      storageOnly = false,
      type = 'default'
    } = options;

    // 根据类型获取配置
    const typeConfig = this.cacheTypes[type] || {};
    const mergedOptions = { ...typeConfig, ...options };

    let memorySuccess = true;
    let storageSuccess = true;

    if (!storageOnly) {
      memorySuccess = await this.setMemoryCache(key, value, mergedOptions);
    }

    if (!memoryOnly) {
      storageSuccess = await this.setStorageCache(key, value, mergedOptions);
    }

    return memorySuccess || storageSuccess;
  }

  /**
   * 删除缓存（内存和存储）
   * @param {string} key - 缓存键
   * @returns {Promise<boolean>} 是否删除成功
   */
  async delete(key) {
    const memoryResult = this.deleteMemoryCache(key);
    const storageResult = await this.deleteStorageCache(key);
    return memoryResult || storageResult;
  }

  /**
   * 释放内存空间
   * @param {number} neededSpace - 需要的空间大小
   */
  async freeMemorySpace(neededSpace) {
    try {
      const startSize = this.currentMemorySize;
      let freedSpace = 0;

      if (this.config.enableLRU) {
        // 使用LRU算法释放空间
        freedSpace = this.evictLRUItems(neededSpace);
      } else {
        // 使用过期和优先级策略
        freedSpace = this.evictByPriority(neededSpace);
      }

      this.metrics.evictions += Math.floor(freedSpace / 1024); // 记录驱逐的KB数
      
      console.log(`释放内存空间: ${freedSpace} bytes, 剩余: ${this.currentMemorySize} bytes`);

    } catch (error) {
      errorHandler.handleError(error, {
        context: 'CacheManager.freeMemorySpace',
        level: 'warning'
      });
    }
  }

  /**
   * LRU驱逐策略
   * @param {number} neededSpace - 需要的空间
   * @returns {number} 释放的空间大小
   */
  evictLRUItems(neededSpace) {
    let freedSpace = 0;
    
    // 按访问时间排序（最久未访问的优先）
    const sortedByAccess = Array.from(this.accessOrder.entries())
      .sort((a, b) => a[1] - b[1]); // 按时间戳升序

    for (const [key] of sortedByAccess) {
      if (freedSpace >= neededSpace) break;

      const item = this.memoryCache.get(key);
      if (item) {
        freedSpace += item.size;
        this.deleteMemoryCache(key);
      }
    }

    return freedSpace;
  }

  /**
   * 按优先级驱逐策略
   * @param {number} neededSpace - 需要的空间
   * @returns {number} 释放的空间大小
   */
  evictByPriority(neededSpace) {
    let freedSpace = 0;
    const now = Date.now();
    
    // 优先级权重
    const priorityWeights = {
      lowest: 1,
      low: 2,
      medium: 3,
      high: 4
    };

    // 获取所有缓存项并计算驱逐分数
    const items = Array.from(this.memoryCache.entries()).map(([key, item]) => {
      const age = now - item.timestamp;
      const priorityWeight = priorityWeights[item.priority] || 2;
      const accessScore = item.accessCount || 1;
      
      // 分数越低越容易被驱逐
      const evictionScore = (priorityWeight * accessScore) / (age + 1);
      
      return { key, item, evictionScore };
    });

    // 按驱逐分数排序（分数低的优先驱逐）
    items.sort((a, b) => a.evictionScore - b.evictionScore);

    for (const { key, item } of items) {
      if (freedSpace >= neededSpace) break;
      
      freedSpace += item.size;
      this.deleteMemoryCache(key);
    }

    return freedSpace;
  }

  /**
   * 数据压缩
   * @param {any} data - 要压缩的数据
   * @returns {string} 压缩后的数据
   */
  compressData(data) {
    try {
      const jsonString = JSON.stringify(data);
      // 简单的压缩：去除多余空格和使用更短的键名
      return jsonString.replace(/\s+/g, '');
    } catch (error) {
      throw new Error('数据压缩失败: ' + error.message);
    }
  }

  /**
   * 数据解压缩
   * @param {string} compressedData - 压缩的数据
   * @returns {any} 解压后的数据
   */
  decompressData(compressedData) {
    try {
      return JSON.parse(compressedData);
    } catch (error) {
      throw new Error('数据解压缩失败: ' + error.message);
    }
  }

  /**
   * 计算数据大小
   * @param {any} data - 数据
   * @returns {number} 字节数
   */
  calculateSize(data) {
    try {
      if (typeof data === 'string') {
        return data.length * 2; // Unicode字符平均2字节
      }
      return JSON.stringify(data).length * 2;
    } catch {
      return 0;
    }
  }

  /**
   * 获取存储大小
   * @returns {Promise<number>} 存储大小
   */
  async getStorageSize() {
    return new Promise((resolve) => {
      wx.getStorageInfo({
        success: (res) => {
          resolve(res.currentSize * 1024); // KB转字节
        },
        fail: () => {
          resolve(0);
        }
      });
    });
  }

  /**
   * 清理存储空间
   * @param {number} neededSpace - 需要的空间
   */
  async cleanupStorageSpace(neededSpace) {
    try {
      // 获取所有缓存键
      const cacheKeys = await this.getAllCacheKeys();
      const now = Date.now();
      
      // 按过期时间和优先级排序
      const sortedKeys = cacheKeys.sort((a, b) => {
        // 这里可以实现更复杂的排序逻辑
        return a.timestamp - b.timestamp;
      });

      let freedSpace = 0;
      for (const keyInfo of sortedKeys) {
        if (freedSpace >= neededSpace) break;
        
        await this.deleteStorageCache(keyInfo.key);
        freedSpace += keyInfo.size || 1024; // 估算大小
      }

    } catch (error) {
      errorHandler.handleError(error, {
        context: 'CacheManager.cleanupStorageSpace',
        level: 'warning'
      });
    }
  }

  /**
   * 获取所有缓存键
   * @returns {Promise<Array>} 缓存键信息数组
   */
  async getAllCacheKeys() {
    return new Promise((resolve) => {
      wx.getStorageInfo({
        success: (res) => {
          const cacheKeys = res.keys
            .filter(key => key.startsWith(this.config.storagePrefix))
            .map(key => ({
              key: key.replace(this.config.storagePrefix, ''),
              storageKey: key
            }));
          resolve(cacheKeys);
        },
        fail: () => {
          resolve([]);
        }
      });
    });
  }

  /**
   * 更新存储元数据
   */
  updateStorageMetadata(key, item) {
    // 这里可以维护存储的元数据信息
    // 比如大小、过期时间等，用于更精确的空间管理
  }

  /**
   * 移除存储元数据
   */
  removeStorageMetadata(key) {
    // 清理元数据
  }

  /**
   * 恢复存储元数据
   */
  restoreStorageMetadata() {
    // 恢复元数据信息
  }

  /**
   * 执行清理任务
   */
  async performCleanup() {
    try {
      const now = Date.now();
      let cleanedCount = 0;

      // 清理过期的内存缓存
      for (const [key, item] of this.memoryCache) {
        if (now - item.timestamp > item.ttl) {
          this.deleteMemoryCache(key);
          cleanedCount++;
        }
      }

      // 清理过期的存储缓存
      const cacheKeys = await this.getAllCacheKeys();
      for (const keyInfo of cacheKeys) {
        const item = await this.getStorageCache(keyInfo.key);
        if (!item) { // 已过期被删除
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        console.log(`缓存清理完成，清理了 ${cleanedCount} 个过期项`);
      }

    } catch (error) {
      errorHandler.handleError(error, {
        context: 'CacheManager.performCleanup',
        level: 'warning'
      });
    }
  }

  /**
   * 启动清理定时器
   */
  startCleanupTimer() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(() => {
      this.debouncedCleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * 停止清理定时器
   */
  stopCleanupTimer() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * 记录性能指标
   */
  logMetrics() {
    if (!this.config.enableMetrics) return;

    const hitRate = this.metrics.hits / (this.metrics.hits + this.metrics.misses) || 0;
    console.log('缓存性能指标:', {
      hitRate: `${(hitRate * 100).toFixed(2)}%`,
      memoryUsage: `${(this.currentMemorySize / 1024 / 1024).toFixed(2)}MB`,
      cacheItems: this.memoryCache.size,
      compressionSavings: `${(this.metrics.compressionSavings / 1024).toFixed(2)}KB`,
      evictions: this.metrics.evictions
    });
  }

  /**
   * 获取缓存统计信息
   * @returns {Object} 统计信息
   */
  getStats() {
    const hitRate = this.metrics.hits / (this.metrics.hits + this.metrics.misses) || 0;
    
    return {
      memory: {
        size: this.currentMemorySize,
        items: this.memoryCache.size,
        maxSize: this.config.maxMemorySize,
        usage: this.currentMemorySize / this.config.maxMemorySize
      },
      metrics: {
        ...deepClone(this.metrics),
        hitRate
      },
      config: deepClone(this.config)
    };
  }

  /**
   * 清空所有缓存
   */
  async clear() {
    try {
      // 清空内存缓存
      this.memoryCache.clear();
      this.accessOrder.clear();
      this.currentMemorySize = 0;

      // 清空本地存储缓存
      const cacheKeys = await this.getAllCacheKeys();
      for (const keyInfo of cacheKeys) {
        await this.deleteStorageCache(keyInfo.key);
      }

      // 重置指标
      this.metrics = {
        hits: 0,
        misses: 0,
        sets: 0,
        deletes: 0,
        evictions: 0,
        compressionSavings: 0
      };

      console.log('所有缓存已清空');

    } catch (error) {
      errorHandler.handleError(error, {
        context: 'CacheManager.clear',
        level: 'warning'
      });
    }
  }

  /**
   * 销毁缓存管理器
   */
  destroy() {
    try {
      this.stopCleanupTimer();
      this.clear();
      console.log('缓存管理器已销毁');
    } catch (error) {
      errorHandler.handleError(error, {
        context: 'CacheManager.destroy',
        level: 'warning'
      });
    }
  }
}

// 创建单例实例
const cacheManager = new CacheManager();

export default cacheManager; 