/**
 * 图片处理工具类
 * 提供图片压缩、格式转换、尺寸调整等功能
 */

class ImageProcessor {
  constructor() {
    this.maxSize = 2 * 1024 * 1024; // 2MB 默认最大文件大小
    this.defaultQuality = 0.8; // 默认压缩质量
    this.canvas = null;
    this.ctx = null;
  }

  /**
   * 压缩图片
   * @param {string} imagePath - 图片路径
   * @param {Object} options - 压缩选项
   * @returns {Promise<Object>} 压缩结果
   */
  async compressImage(imagePath, options = {}) {
    const {
      maxWidth = 1200,
      maxHeight = 1600,
      quality = this.defaultQuality,
      format = 'jpeg',
      maxSize = this.maxSize
    } = options;

    try {
      // 获取图片信息
      const imageInfo = await this.getImageInfo(imagePath);
      
      // 检查是否需要压缩
      if (imageInfo.size <= maxSize && 
          imageInfo.width <= maxWidth && 
          imageInfo.height <= maxHeight) {
        return {
          success: true,
          originalPath: imagePath,
          compressedPath: imagePath,
          originalSize: imageInfo.size,
          compressedSize: imageInfo.size,
          compressionRatio: 1,
          needsCompression: false
        };
      }

      // 计算目标尺寸
      const targetDimensions = this.calculateTargetDimensions(
        imageInfo.width, 
        imageInfo.height, 
        maxWidth, 
        maxHeight
      );

      // 执行压缩
      const compressedPath = await this.performCompression(
        imagePath,
        targetDimensions,
        quality,
        format
      );

      // 获取压缩后的文件大小
      const compressedInfo = await this.getImageInfo(compressedPath);

      return {
        success: true,
        originalPath: imagePath,
        compressedPath,
        originalSize: imageInfo.size,
        compressedSize: compressedInfo.size,
        compressionRatio: compressedInfo.size / imageInfo.size,
        needsCompression: true,
        dimensions: {
          original: { width: imageInfo.width, height: imageInfo.height },
          compressed: { width: targetDimensions.width, height: targetDimensions.height }
        }
      };

    } catch (error) {
      console.error('图片压缩失败:', error);
      return {
        success: false,
        error: error.message,
        originalPath: imagePath
      };
    }
  }

  /**
   * 获取图片信息
   * @param {string} imagePath - 图片路径
   * @returns {Promise<Object>} 图片信息
   */
  async getImageInfo(imagePath) {
    return new Promise((resolve, reject) => {
      wx.getImageInfo({
        src: imagePath,
        success: (res) => {
          // 获取文件大小
          wx.getFileSystemManager().getFileInfo({
            filePath: imagePath,
            success: (fileInfo) => {
              resolve({
                width: res.width,
                height: res.height,
                type: res.type,
                size: fileInfo.size,
                path: res.path
              });
            },
            fail: () => {
              // 如果获取文件信息失败，估算大小
              resolve({
                width: res.width,
                height: res.height,
                type: res.type,
                size: res.width * res.height * 3, // 估算大小
                path: res.path
              });
            }
          });
        },
        fail: reject
      });
    });
  }

  /**
   * 计算目标尺寸
   * @param {number} originalWidth - 原始宽度
   * @param {number} originalHeight - 原始高度
   * @param {number} maxWidth - 最大宽度
   * @param {number} maxHeight - 最大高度
   * @returns {Object} 目标尺寸
   */
  calculateTargetDimensions(originalWidth, originalHeight, maxWidth, maxHeight) {
    let { width, height } = { width: originalWidth, height: originalHeight };

    // 按比例缩放
    if (width > maxWidth) {
      height = (height * maxWidth) / width;
      width = maxWidth;
    }

    if (height > maxHeight) {
      width = (width * maxHeight) / height;
      height = maxHeight;
    }

    return {
      width: Math.round(width),
      height: Math.round(height)
    };
  }

  /**
   * 执行图片压缩
   * @param {string} imagePath - 原图路径
   * @param {Object} dimensions - 目标尺寸
   * @param {number} quality - 压缩质量
   * @param {string} format - 输出格式
   * @returns {Promise<string>} 压缩后的图片路径
   */
  async performCompression(imagePath, dimensions, quality, format) {
    return new Promise((resolve, reject) => {
      const canvas = wx.createCanvasContext('imageCompressCanvas');
      
      if (!canvas) {
        reject(new Error('无法创建Canvas上下文'));
        return;
      }

      // 创建临时文件路径
      const tempPath = `${wx.env.USER_DATA_PATH}/compressed_${Date.now()}.${format}`;

      try {
        // 在canvas上绘制并压缩图片
        canvas.drawImage(imagePath, 0, 0, dimensions.width, dimensions.height);
        
        canvas.draw(false, () => {
          wx.canvasToTempFilePath({
            canvasId: 'imageCompressCanvas',
            x: 0,
            y: 0,
            width: dimensions.width,
            height: dimensions.height,
            destWidth: dimensions.width,
            destHeight: dimensions.height,
            quality: quality,
            fileType: format,
            success: (res) => {
              resolve(res.tempFilePath);
            },
            fail: (error) => {
              console.error('Canvas转换失败:', error);
              reject(error);
            }
          });
        });

      } catch (error) {
        console.error('Canvas绘制失败:', error);
        reject(error);
      }
    });
  }

  /**
   * 批量压缩图片
   * @param {Array} imagePaths - 图片路径数组
   * @param {Object} options - 压缩选项
   * @returns {Promise<Array>} 压缩结果数组
   */
  async compressImages(imagePaths, options = {}) {
    const { concurrent = 3 } = options; // 并发数量
    const results = [];
    
    // 分批处理
    for (let i = 0; i < imagePaths.length; i += concurrent) {
      const batch = imagePaths.slice(i, i + concurrent);
      const batchPromises = batch.map(path => this.compressImage(path, options));
      
      try {
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      } catch (error) {
        console.error('批量压缩失败:', error);
        // 添加失败的结果
        batch.forEach(path => {
          results.push({
            success: false,
            error: error.message,
            originalPath: path
          });
        });
      }
    }

    return results;
  }

  /**
   * 转换图片格式
   * @param {string} imagePath - 图片路径
   * @param {string} targetFormat - 目标格式
   * @param {number} quality - 质量
   * @returns {Promise<string>} 转换后的图片路径
   */
  async convertFormat(imagePath, targetFormat = 'jpeg', quality = 0.9) {
    try {
      const imageInfo = await this.getImageInfo(imagePath);
      
      return await this.performCompression(
        imagePath,
        { width: imageInfo.width, height: imageInfo.height },
        quality,
        targetFormat
      );
    } catch (error) {
      console.error('格式转换失败:', error);
      throw error;
    }
  }

  /**
   * 生成缩略图
   * @param {string} imagePath - 图片路径
   * @param {Object} options - 缩略图选项
   * @returns {Promise<string>} 缩略图路径
   */
  async generateThumbnail(imagePath, options = {}) {
    const {
      width = 200,
      height = 200,
      quality = 0.7,
      format = 'jpeg'
    } = options;

    try {
      return await this.performCompression(
        imagePath,
        { width, height },
        quality,
        format
      );
    } catch (error) {
      console.error('缩略图生成失败:', error);
      throw error;
    }
  }

  /**
   * 图片质量检测
   * @param {string} imagePath - 图片路径
   * @returns {Promise<Object>} 质量分析结果
   */
  async analyzeImageQuality(imagePath) {
    try {
      const imageInfo = await this.getImageInfo(imagePath);
      
      // 计算像素密度
      const pixelCount = imageInfo.width * imageInfo.height;
      const sizePerPixel = imageInfo.size / pixelCount;
      
      // 质量评估
      let quality = 'unknown';
      if (sizePerPixel > 3) {
        quality = 'high';
      } else if (sizePerPixel > 1.5) {
        quality = 'medium';
      } else {
        quality = 'low';
      }

      // 推荐压缩设置
      let recommendedSettings = {};
      if (quality === 'high' && imageInfo.size > this.maxSize) {
        recommendedSettings = {
          maxWidth: Math.min(imageInfo.width, 1200),
          maxHeight: Math.min(imageInfo.height, 1600),
          quality: 0.8
        };
      } else if (quality === 'medium' && imageInfo.size > this.maxSize * 0.5) {
        recommendedSettings = {
          maxWidth: imageInfo.width,
          maxHeight: imageInfo.height,
          quality: 0.9
        };
      }

      return {
        ...imageInfo,
        pixelCount,
        sizePerPixel,
        quality,
        needsCompression: imageInfo.size > this.maxSize,
        recommendedSettings
      };

    } catch (error) {
      console.error('图片质量分析失败:', error);
      throw error;
    }
  }

  /**
   * 清理临时文件
   * @param {Array} filePaths - 文件路径数组
   * @returns {Promise<void>}
   */
  async cleanupTempFiles(filePaths) {
    const fileManager = wx.getFileSystemManager();
    
    for (const filePath of filePaths) {
      try {
        if (filePath.includes(wx.env.USER_DATA_PATH)) {
          await new Promise((resolve) => {
            fileManager.unlink({
              filePath,
              success: resolve,
              fail: resolve // 忽略删除失败
            });
          });
        }
      } catch (error) {
        console.warn('清理临时文件失败:', filePath, error);
      }
    }
  }

  /**
   * 获取压缩统计信息
   * @param {Array} compressionResults - 压缩结果数组
   * @returns {Object} 统计信息
   */
  getCompressionStats(compressionResults) {
    const successful = compressionResults.filter(r => r.success);
    const failed = compressionResults.filter(r => !r.success);
    
    if (successful.length === 0) {
      return {
        totalImages: compressionResults.length,
        successCount: 0,
        failCount: failed.length,
        totalOriginalSize: 0,
        totalCompressedSize: 0,
        totalSavings: 0,
        averageCompressionRatio: 0
      };
    }

    const totalOriginalSize = successful.reduce((sum, r) => sum + r.originalSize, 0);
    const totalCompressedSize = successful.reduce((sum, r) => sum + r.compressedSize, 0);
    const totalSavings = totalOriginalSize - totalCompressedSize;
    const averageCompressionRatio = totalCompressedSize / totalOriginalSize;

    return {
      totalImages: compressionResults.length,
      successCount: successful.length,
      failCount: failed.length,
      totalOriginalSize,
      totalCompressedSize,
      totalSavings,
      averageCompressionRatio,
      savingsPercentage: Math.round((1 - averageCompressionRatio) * 100)
    };
  }

  /**
   * 设置全局压缩参数
   * @param {Object} config - 配置参数
   */
  setGlobalConfig(config) {
    if (config.maxSize) this.maxSize = config.maxSize;
    if (config.defaultQuality) this.defaultQuality = config.defaultQuality;
  }

  /**
   * 获取推荐的压缩设置
   * @param {string} usage - 使用场景 (avatar, thumbnail, document, photo)
   * @returns {Object} 推荐设置
   */
  getRecommendedSettings(usage) {
    const presets = {
      avatar: {
        maxWidth: 200,
        maxHeight: 200,
        quality: 0.8,
        format: 'jpeg'
      },
      thumbnail: {
        maxWidth: 300,
        maxHeight: 300,
        quality: 0.7,
        format: 'jpeg'
      },
      document: {
        maxWidth: 1200,
        maxHeight: 1600,
        quality: 0.9,
        format: 'jpeg'
      },
      photo: {
        maxWidth: 1600,
        maxHeight: 1200,
        quality: 0.85,
        format: 'jpeg'
      }
    };

    return presets[usage] || presets.document;
  }
}

// 导出单例
export default new ImageProcessor(); 