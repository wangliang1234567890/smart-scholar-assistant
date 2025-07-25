/**
 * 图片处理工具类 - 优化版
 * 提供图片压缩、格式转换、尺寸调整等功能
 * 优化点：内存管理、压缩算法、并发处理、缓存策略
 */

import { errorHandler } from './error-handler';
import { debounce, throttle, deepClone } from './common';

class ImageProcessor {
  constructor() {
    // 默认配置
    this.config = {
      maxSize: 2 * 1024 * 1024, // 2MB 默认最大文件大小
      defaultQuality: 0.8, // 默认压缩质量
      maxConcurrent: 3, // 最大并发处理数
      enableCache: true, // 启用缓存
      cacheSize: 50, // 缓存条目数
      enableProgressiveJPEG: true, // 启用渐进式JPEG
      enableWebP: false // 是否支持WebP格式
    };

    // 处理状态
    this.processing = {
      queue: [], // 处理队列
      active: new Map(), // 活跃任务
      cache: new Map(), // 处理结果缓存
      stats: {
        totalProcessed: 0,
        totalSaved: 0, // 总节省的字节数
        averageCompressionRatio: 0,
        averageProcessingTime: 0
      }
    };

    // Canvas相关
    this.canvasPool = []; // Canvas对象池
    this.maxCanvasInPool = 3;

    // 防抖函数
    this.debouncedCleanupCache = debounce(this.cleanupCache.bind(this), 5000);

    this.init();
  }

  /**
   * 初始化
   */
  init() {
    try {
      // 检测设备性能
      this.detectDeviceCapabilities();
      
      // 预创建Canvas对象
      this.preCreateCanvas();
      
      console.log('图片处理器初始化完成');
    } catch (error) {
      errorHandler.handleError(error, {
        context: 'ImageProcessor.init',
        level: 'warning'
      });
    }
  }

  /**
   * 检测设备性能
   */
  detectDeviceCapabilities() {
    try {
      const systemInfo = wx.getSystemInfoSync();
      const isHighEnd = systemInfo.benchmarkLevel > 30; // 高端设备
      
      // 根据设备性能调整配置
      if (isHighEnd) {
        this.config.maxConcurrent = 5;
        this.config.defaultQuality = 0.85;
      } else {
        this.config.maxConcurrent = 2;
        this.config.defaultQuality = 0.75;
      }

      // 检测WebP支持
      this.checkWebPSupport();
      
    } catch (error) {
      console.warn('检测设备性能失败，使用默认配置');
    }
  }

  /**
   * 检测WebP支持
   */
  checkWebPSupport() {
    // 微信小程序基本都支持WebP
    const systemInfo = wx.getSystemInfoSync();
    this.config.enableWebP = systemInfo.platform !== 'devtools';
  }

  /**
   * 预创建Canvas对象
   */
  preCreateCanvas() {
    for (let i = 0; i < Math.min(this.maxCanvasInPool, this.config.maxConcurrent); i++) {
      const canvas = wx.createOffscreenCanvas({ type: '2d' });
      this.canvasPool.push(canvas);
    }
  }

  /**
   * 获取Canvas对象
   */
  getCanvas() {
    if (this.canvasPool.length > 0) {
      return this.canvasPool.pop();
    }
    
    try {
      return wx.createOffscreenCanvas({ type: '2d' });
    } catch (error) {
      errorHandler.handleError(error, {
        context: 'ImageProcessor.getCanvas',
        level: 'error'
      });
      return null;
    }
  }

  /**
   * 归还Canvas对象
   */
  returnCanvas(canvas) {
    if (this.canvasPool.length < this.maxCanvasInPool && canvas) {
      // 清理canvas
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      this.canvasPool.push(canvas);
    }
  }

  /**
   * 设置全局配置
   */
  static setGlobalConfig(config) {
    if (this.instance) {
      this.instance.setConfig(config);
    }
  }

  /**
   * 设置配置
   */
  setConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * 压缩图片 - 主要接口
   * @param {string} imagePath - 图片路径
   * @param {Object} options - 压缩选项
   * @returns {Promise<Object>} 压缩结果
   */
  async compressImage(imagePath, options = {}) {
    const startTime = Date.now();
    
    try {
      // 合并配置
      const config = { ...this.config, ...options };
      
      // 生成缓存键
      const cacheKey = this.generateCacheKey(imagePath, config);
      
      // 检查缓存
      if (config.enableCache && this.processing.cache.has(cacheKey)) {
        console.log('使用缓存的压缩结果');
        return this.processing.cache.get(cacheKey);
      }

      // 检查并发限制
      await this.waitForSlot();

      // 获取图片信息
      const imageInfo = await this.getImageInfo(imagePath);
      
      // 检查是否需要压缩
      const needsCompression = this.checkNeedsCompression(imageInfo, config);
      if (!needsCompression) {
        return this.createResult(imagePath, imagePath, imageInfo.size, imageInfo.size, false);
      }

      // 执行压缩
      const result = await this.performCompression(imagePath, imageInfo, config);
      
      // 更新统计信息
      this.updateStats(result, Date.now() - startTime);
      
      // 缓存结果
      if (config.enableCache) {
        this.cacheResult(cacheKey, result);
      }

      return result;
      
    } catch (error) {
      errorHandler.handleError(error, {
        context: 'ImageProcessor.compressImage',
        level: 'error',
        extra: { imagePath, options }
      });
      
      // 返回原图作为降级处理
      return this.createResult(imagePath, imagePath, 0, 0, false, error.message);
    }
  }

  /**
   * 生成缓存键
   */
  generateCacheKey(imagePath, config) {
    const keyData = {
      path: imagePath,
      maxWidth: config.maxWidth,
      maxHeight: config.maxHeight,
      quality: config.quality,
      format: config.format
    };
    return btoa(JSON.stringify(keyData)).replace(/[+/=]/g, '');
  }

  /**
   * 等待处理槽位
   */
  async waitForSlot() {
    while (this.processing.active.size >= this.config.maxConcurrent) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  /**
   * 检查是否需要压缩
   */
  checkNeedsCompression(imageInfo, config) {
    const {
      maxWidth = 1200,
      maxHeight = 1600,
      maxSize = this.config.maxSize
    } = config;

    return imageInfo.size > maxSize || 
           imageInfo.width > maxWidth || 
           imageInfo.height > maxHeight;
  }

  /**
   * 执行压缩处理
   */
  async performCompression(imagePath, imageInfo, config) {
    const taskId = this.generateTaskId();
    this.processing.active.set(taskId, Date.now());

    try {
      // 计算目标尺寸
      const targetDimensions = this.calculateTargetDimensions(
        imageInfo.width, 
        imageInfo.height, 
        config.maxWidth || 1200,
        config.maxHeight || 1600
      );

      // 获取Canvas
      const canvas = this.getCanvas();
      if (!canvas) {
        throw new Error('无法获取Canvas对象');
      }

      try {
        // 设置canvas尺寸
        canvas.width = targetDimensions.width;
        canvas.height = targetDimensions.height;
        
        const ctx = canvas.getContext('2d');
        
        // 创建图片对象
        const image = canvas.createImage();
        
        // 加载图片
        await this.loadImageToCanvas(image, imagePath, ctx, targetDimensions);
        
        // 导出压缩后的图片
        const compressedPath = await this.exportCanvasToFile(canvas, config);
        
        // 获取压缩后的文件信息
        const compressedInfo = await this.getImageInfo(compressedPath);
        
        return this.createResult(
          imagePath, 
          compressedPath, 
          imageInfo.size, 
          compressedInfo.size, 
          true
        );
        
      } finally {
        this.returnCanvas(canvas);
      }
      
    } finally {
      this.processing.active.delete(taskId);
    }
  }

  /**
   * 获取图片信息
   */
  async getImageInfo(imagePath) {
    return new Promise((resolve, reject) => {
      wx.getImageInfo({
        src: imagePath,
        success: (res) => {
          resolve({
            width: res.width,
            height: res.height,
            path: res.path,
            size: res.size || 0,
            type: res.type || 'unknown'
          });
        },
        fail: (error) => {
          reject(new Error(`获取图片信息失败: ${error.errMsg}`));
        }
      });
    });
  }

  /**
   * 计算目标尺寸
   */
  calculateTargetDimensions(width, height, maxWidth, maxHeight) {
    let targetWidth = width;
    let targetHeight = height;
    
    // 计算缩放比例
    const widthRatio = maxWidth / width;
    const heightRatio = maxHeight / height;
    const ratio = Math.min(widthRatio, heightRatio, 1); // 不放大图片
    
    if (ratio < 1) {
      targetWidth = Math.round(width * ratio);
      targetHeight = Math.round(height * ratio);
    }
    
    return {
      width: targetWidth,
      height: targetHeight,
      ratio
    };
  }

  /**
   * 加载图片到Canvas
   */
  async loadImageToCanvas(image, imagePath, ctx, dimensions) {
    return new Promise((resolve, reject) => {
      image.onload = () => {
        try {
          // 启用图像平滑
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          
          // 绘制图片
          ctx.drawImage(
            image, 
            0, 0, image.width, image.height,
            0, 0, dimensions.width, dimensions.height
          );
          
          resolve();
        } catch (error) {
          reject(new Error(`绘制图片失败: ${error.message}`));
        }
      };
      
      image.onerror = () => {
        reject(new Error('图片加载失败'));
      };
      
      image.src = imagePath;
    });
  }

  /**
   * 导出Canvas到文件
   */
  async exportCanvasToFile(canvas, config) {
    const {
      quality = this.config.defaultQuality,
      format = 'jpeg'
    } = config;

    return new Promise((resolve, reject) => {
      const tempFilePath = `${wx.env.USER_DATA_PATH}/compressed_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${format}`;
      
      canvas.toTempFilePath({
        fileType: format,
        quality: quality,
        destPath: tempFilePath,
        success: (res) => {
          resolve(res.tempFilePath);
        },
        fail: (error) => {
          reject(new Error(`导出图片失败: ${error.errMsg}`));
        }
      });
    });
  }

  /**
   * 批量压缩图片
   * @param {Array} imagePaths - 图片路径数组
   * @param {Object} options - 压缩选项
   * @returns {Promise<Array>} 压缩结果数组
   */
  async compressImageBatch(imagePaths, options = {}) {
    try {
      const results = await Promise.allSettled(
        imagePaths.map(path => this.compressImage(path, options))
      );
      
      return results.map((result, index) => {
        if (result.status === 'fulfilled') {
          return result.value;
        } else {
          errorHandler.handleError(result.reason, {
            context: 'ImageProcessor.compressImageBatch',
            level: 'warning',
            extra: { imagePath: imagePaths[index] }
          });
          
          // 返回错误结果
          return this.createResult(
            imagePaths[index], 
            imagePaths[index], 
            0, 0, false, 
            result.reason.message
          );
        }
      });
      
    } catch (error) {
      errorHandler.handleError(error, {
        context: 'ImageProcessor.compressImageBatch',
        level: 'error'
      });
      throw error;
    }
  }

  /**
   * 图片格式转换
   * @param {string} imagePath - 图片路径
   * @param {string} targetFormat - 目标格式
   * @param {Object} options - 转换选项
   * @returns {Promise<Object>} 转换结果
   */
  async convertFormat(imagePath, targetFormat, options = {}) {
    try {
      const convertOptions = {
        ...options,
        format: targetFormat
      };
      
      return await this.compressImage(imagePath, convertOptions);
      
    } catch (error) {
      errorHandler.handleError(error, {
        context: 'ImageProcessor.convertFormat',
        level: 'error',
        extra: { imagePath, targetFormat }
      });
      throw error;
    }
  }

  /**
   * 生成图片缩略图
   * @param {string} imagePath - 图片路径
   * @param {Object} options - 缩略图选项
   * @returns {Promise<Object>} 缩略图结果
   */
  async generateThumbnail(imagePath, options = {}) {
    const thumbnailOptions = {
      maxWidth: options.size || 200,
      maxHeight: options.size || 200,
      quality: options.quality || 0.7,
      format: options.format || 'jpeg',
      ...options
    };
    
    try {
      return await this.compressImage(imagePath, thumbnailOptions);
    } catch (error) {
      errorHandler.handleError(error, {
        context: 'ImageProcessor.generateThumbnail',
        level: 'error',
        extra: { imagePath, options }
      });
      throw error;
    }
  }

  /**
   * 创建结果对象
   */
  createResult(originalPath, compressedPath, originalSize, compressedSize, needsCompression, error = null) {
    const compressionRatio = originalSize > 0 ? compressedSize / originalSize : 1;
    const savedBytes = originalSize - compressedSize;
    
    return {
      success: !error,
      originalPath,
      compressedPath,
      originalSize,
      compressedSize,
      compressionRatio: Math.round(compressionRatio * 100) / 100,
      savedBytes,
      needsCompression,
      error,
      timestamp: Date.now()
    };
  }

  /**
   * 更新统计信息
   */
  updateStats(result, processingTime) {
    const stats = this.processing.stats;
    
    stats.totalProcessed++;
    stats.totalSaved += result.savedBytes;
    
    // 更新平均压缩比
    stats.averageCompressionRatio = (
      (stats.averageCompressionRatio * (stats.totalProcessed - 1) + result.compressionRatio) 
      / stats.totalProcessed
    );
    
    // 更新平均处理时间
    stats.averageProcessingTime = (
      (stats.averageProcessingTime * (stats.totalProcessed - 1) + processingTime)
      / stats.totalProcessed
    );
  }

  /**
   * 缓存结果
   */
  cacheResult(cacheKey, result) {
    // 检查缓存大小限制
    if (this.processing.cache.size >= this.config.cacheSize) {
      // 删除最旧的缓存项
      const firstKey = this.processing.cache.keys().next().value;
      this.processing.cache.delete(firstKey);
    }
    
    this.processing.cache.set(cacheKey, result);
    
    // 防抖清理缓存
    this.debouncedCleanupCache();
  }

  /**
   * 清理过期缓存
   */
  cleanupCache() {
    const now = Date.now();
    const maxAge = 30 * 60 * 1000; // 30分钟
    
    for (const [key, result] of this.processing.cache) {
      if (now - result.timestamp > maxAge) {
        this.processing.cache.delete(key);
      }
    }
  }

  /**
   * 生成任务ID
   */
  generateTaskId() {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 获取处理统计信息
   */
  getStats() {
    return {
      ...deepClone(this.processing.stats),
      activeTasksCount: this.processing.active.size,
      cacheSize: this.processing.cache.size,
      canvasPoolSize: this.canvasPool.length
    };
  }

  /**
   * 获取队列状态
   */
  getQueueStatus() {
    return {
      queueLength: this.processing.queue.length,
      activeTasksCount: this.processing.active.size,
      maxConcurrent: this.config.maxConcurrent
    };
  }

  /**
   * 清理临时文件
   * @param {Array} filePaths - 要清理的文件路径
   */
  async cleanupTempFiles(filePaths) {
    try {
      const fileManager = wx.getFileSystemManager();
      
      for (const filePath of filePaths) {
        try {
          await new Promise((resolve, reject) => {
            fileManager.unlink({
              filePath,
              success: resolve,
              fail: reject
            });
          });
        } catch (error) {
          // 文件可能已经不存在，忽略错误
          console.warn(`清理临时文件失败: ${filePath}`, error);
        }
      }
      
    } catch (error) {
      errorHandler.handleError(error, {
        context: 'ImageProcessor.cleanupTempFiles',
        level: 'warning'
      });
    }
  }

  /**
   * 重置处理器状态
   */
  reset() {
    try {
      // 清空队列和活跃任务
      this.processing.queue = [];
      this.processing.active.clear();
      
      // 清空缓存
      this.processing.cache.clear();
      
      // 重置统计信息
      this.processing.stats = {
        totalProcessed: 0,
        totalSaved: 0,
        averageCompressionRatio: 0,
        averageProcessingTime: 0
      };
      
      console.log('图片处理器已重置');
    } catch (error) {
      errorHandler.handleError(error, {
        context: 'ImageProcessor.reset',
        level: 'warning'
      });
    }
  }

  /**
   * 销毁处理器
   */
  destroy() {
    try {
      this.reset();
      
      // 清空Canvas池
      this.canvasPool = [];
      
      console.log('图片处理器已销毁');
    } catch (error) {
      errorHandler.handleError(error, {
        context: 'ImageProcessor.destroy',
        level: 'warning'
      });
    }
  }
}

// 创建单例实例
const imageProcessor = new ImageProcessor();

export default imageProcessor; 