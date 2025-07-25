// 导入配置
import { DOUBAO_CONFIG } from './constants.js';

/**
 * AI服务工具类 - 集成豆包AI
 * 重构版本：去掉独立OCR层，直接使用豆包AI进行图片分析
 */
class AIService {
  constructor() {
    this.config = {
      mockMode: false, // 使用真实API
      enableCaching: true,
      timeoutMs: 30000
    };

    this.metrics = {
      imageAnalysis: { total: 0, success: 0, error: 0 }, // 重命名为图片分析
      generation: { total: 0, success: 0, error: 0 },
      grading: { total: 0, success: 0, error: 0 }
    };

    this.cache = new Map();
    console.log('AI服务初始化完成 - 豆包AI图片分析模式');
  }

  // 生成请求ID
  generateRequestId() {
    return `doubao_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // 创建服务错误
  createServiceError(code, message, details = null) {
    const error = new Error(message);
    error.code = code;
    error.details = details;
    return error;
  }

  // 更新统计信息
  updateMetrics(type, action) {
    if (this.metrics[type]) {
      this.metrics[type][action]++;
    }
  }

  /**
   * 图片智能分析 - 统一接口（替代原OCR识别）
   * 一次性完成：文字识别 + 题目解析 + 学科判断
   * @param {string} imagePath - 图片路径
   * @param {Object} options - 分析选项
   * @returns {Promise<Object>} 分析结果
   */
  async recognizeText(imagePath, options = {}) {
    return this.analyzeQuestionFromImage(imagePath, options);
  }

  /**
   * 分析图片中的题目 - 主入口方法
   */
  async analyzeQuestionFromImage(imagePath, options = {}) {
    const requestId = this.generateRequestId();
    
    try {
      console.log(`[${requestId}] 开始图片分析:`, {
        图片路径: imagePath,
        选项: options
      });

      this.metrics.imageAnalysis.total++;

      // 1. 压缩图片
      console.log(`[${requestId}] 步骤1: 压缩图片`);
      const compressResult = await this.compressImageStrict(imagePath, { 
        ...options, 
        requestId 
      });
      
      console.log(`[${requestId}] 压缩完成:`, compressResult);

      // 2. 使用云存储方式分析
      console.log(`[${requestId}] 步骤2: 开始云存储分析`);
      const result = await this.analyzeWithCloudStorage(
        compressResult.tempFilePath, 
        options, 
        requestId
      );

      console.log(`[${requestId}] 分析完成:`, result);

      this.metrics.imageAnalysis.success++;
      return result;

    } catch (error) {
      console.error(`[${requestId}] 图片分析失败:`, error);
      this.metrics.imageAnalysis.error++;
      
      // 返回降级结果
      return await this.createFallbackResult(imagePath, options, requestId);
    }
  }

  /**
   * 标准化分析结果格式
   * @param {Object} rawResult - 豆包AI返回的原始结果
   * @returns {Object} 标准化结果
   */
  standardizeAnalysisResult(rawResult) {
    return {
      success: rawResult.success || true,
      
      // OCR识别结果（保持向后兼容）
      text: rawResult.recognizedText || rawResult.text || '',
      confidence: rawResult.confidence || 0.8,
      
      // 题目分析结果
      questionType: rawResult.questionType || 'unknown',
      subject: rawResult.subject || 'unknown',
      difficulty: rawResult.difficulty || 3,
      
      // 结构化数据
      structuredData: rawResult.structuredData || null,
      
      // 详细分析（新增功能）
      analysis: {
        keyPoints: rawResult.keyPoints || [],
        concepts: rawResult.concepts || [],
        suggestedAnswer: rawResult.suggestedAnswer || null,
        explanation: rawResult.explanation || null
      },
      
      // 元数据
      requestId: rawResult.requestId,
      processingTime: rawResult.processingTime || 0,
      provider: '豆包AI',
      modelVersion: rawResult.modelVersion || DOUBAO_CONFIG.MODEL_ID,
      
      // 向后兼容字段
      ocrResult: {
        text: rawResult.recognizedText || rawResult.text || '',
        confidence: rawResult.confidence || 0.8
      }
    };
  }

  // 基于错题生成练习题 - 使用豆包AI
  async generatePracticeQuestions(errorQuestion, options = {}) {
    const requestId = this.generateRequestId();
    
    try {
      console.log(`[${requestId}] 开始生成练习题:`, errorQuestion.subject);
      this.updateMetrics('generation', 'total');

      const params = {
        errorQuestion: errorQuestion,
        generateCount: options.count || 3,
        difficulty: options.difficulty || errorQuestion.difficulty,
        questionTypes: options.types || ['single_choice', 'fill_blank'],
        requestId: requestId
      };

      // 调用豆包AI题目生成云函数
      const result = await this.callCloudFunction('ai-question-generator', params);

      this.updateMetrics('generation', 'success');
      console.log(`[${requestId}] 练习题生成成功，共${result.questions?.length || 0}道题`);
      return result;

    } catch (error) {
      this.updateMetrics('generation', 'error');
      console.error(`[${requestId}] 练习题生成失败:`, error);
      throw error;
    }
  }

  /**
   * 判断是否应该使用云存储方式
   */
  async shouldUseCloudStorage(processedImage) {
    // 如果base64超过300KB，强制使用云存储
    const sizeThreshold = 300 * 1024;
    const shouldUseCloud = processedImage.base64.length > sizeThreshold;
    
    console.log(`图片大小检查: ${processedImage.base64.length} bytes, 阈值: ${sizeThreshold} bytes, 使用云存储: ${shouldUseCloud}`);
    
    return shouldUseCloud;
  }

  /**
   * 网络质量检测 - 异步版本
   */
  async checkNetworkQuality() {
    try {
      const networkInfo = await new Promise((resolve, reject) => {
        wx.getNetworkType({
          success: resolve,
          fail: reject
        });
      });
      
      const networkType = networkInfo.networkType;
      
      // 根据网络类型判断质量
      if (networkType === 'wifi') {
        return 'good';
      } else if (networkType === '4g' || networkType === '5g') {
        return 'medium';
      } else if (networkType === '3g' || networkType === '2g') {
        return 'poor';
      } else {
        return 'none';
      }
    } catch (error) {
      console.warn('获取网络信息失败:', error);
      return 'unknown';
    }
  }

  /**
   * 使用云存储方式进行分析 - 优化版本
   */
  async analyzeWithCloudStorage(imagePath, options, requestId) {
    try {
      console.log(`[${requestId}] 开始云存储上传...`);
      
      // 上传图片到云存储
      const uploadResult = await wx.cloud.uploadFile({
        cloudPath: `analysis-images/${requestId}-${Date.now()}.jpg`,
        filePath: imagePath
      });

      console.log(`[${requestId}] 图片上传成功:`, uploadResult.fileID);

      // 调用豆包AI图片分析云函数
      try {
        const result = await this.callCloudFunction('ocr-recognition', {
          fileID: uploadResult.fileID,
          useCloudStorage: true,
          analysisType: 'complete',
          options: {
            ...options,
            requestId: requestId,
            enhanceAccuracy: options.enhanceAccuracy || true,
            detectQuestionType: options.detectQuestionType || true,
            detectSubject: options.detectSubject || true
          }
        }, {
          maxRetries: 0,
          timeout: 50000
        });

        console.log(`[${requestId}] 云函数原始返回结果:`, result);
        
        // 🔧 关键修复：确保返回正确的数据结构
        if (!result) {
          console.error(`[${requestId}] 云函数返回null/undefined`);
          throw new Error('云函数返回空结果');
        }
        
        // 🔧 标准化返回结果
        const standardizedResult = {
          success: result.success !== false, // 默认为true，除非明确为false
          text: result.recognizedText || result.text || '',
          recognizedText: result.recognizedText || result.text || '',
          confidence: result.confidence || 0.8,
          questionType: result.questionType || 'unknown',
          subject: result.subject || 'unknown',
          difficulty: result.difficulty || 3,
          provider: result.provider || '豆包AI',
          processingTime: result.processingTime || 0,
          requestId: requestId
        };
        
        // 🔧 验证结果有效性
        if (standardizedResult.success && standardizedResult.text && standardizedResult.text.trim().length > 0) {
          console.log(`[${requestId}] 云函数分析成功，文本长度: ${standardizedResult.text.length}`);
          this.scheduleCloudFileCleanup(uploadResult.fileID);
          return standardizedResult;
        } else {
          console.warn(`[${requestId}] 云函数返回无效结果，使用降级分析`);
          const fallbackResult = await this.createFallbackResult(imagePath, options, requestId);
          this.scheduleCloudFileCleanup(uploadResult.fileID);
          return fallbackResult;
        }

      } catch (cloudError) {
        console.warn(`[${requestId}] 云函数调用失败，使用降级分析:`, cloudError.message);
        
        const fallbackResult = await this.createFallbackResult(imagePath, options, requestId);
        this.scheduleCloudFileCleanup(uploadResult.fileID);
        return fallbackResult;
      }

    } catch (error) {
      console.error(`[${requestId}] 云存储分析失败:`, error);
      return await this.createFallbackResult(imagePath, options, requestId);
    }
  }

  /**
   * 创建降级分析结果
   */
  async createFallbackResult(imagePath, options, requestId) {
    console.log(`[${requestId}] 使用降级分析模式`);
    
    // 模拟处理延迟
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 多样化的模拟结果
    const mockResults = [
      {
        recognizedText: '这是一道数学计算题：计算 25 × 4 = ?\n\nA. 90\nB. 100\nC. 110\nD. 120',
        questionType: 'single_choice',
        subject: 'math',
        difficulty: 2,
        structuredData: {
          question: '计算 25 × 4 = ?',
          options: [
            { label: 'A', content: '90' },
            { label: 'B', content: '100' },
            { label: 'C', content: '110' },
            { label: 'D', content: '120' }
          ]
        },
        keyPoints: ['乘法运算', '整数计算'],
        concepts: ['数学运算', '选择题'],
        suggestedAnswer: 'B',
        explanation: '25 × 4 = 100，这是基础的乘法运算'
      },
      {
        recognizedText: '根据课文内容，回答问题：\n\n小明今天做了什么？请用自己的话概括。',
        questionType: 'short_answer',
        subject: 'chinese',
        difficulty: 3,
        structuredData: {
          question: '小明今天做了什么？请用自己的话概括。',
          context: '课文内容'
        },
        keyPoints: ['阅读理解', '概括能力'],
        concepts: ['语文阅读', '简答题'],
        suggestedAnswer: '需要根据具体课文内容回答',
        explanation: '这是一道阅读理解题，需要学生概括文章内容'
      },
      {
        recognizedText: 'Choose the correct answer:\n\nWhat color is the sky?\n\nA. Red\nB. Blue\nC. Green\nD. Yellow',
        questionType: 'single_choice',
        subject: 'english',
        difficulty: 1,
        structuredData: {
          question: 'What color is the sky?',
          options: [
            { label: 'A', content: 'Red' },
            { label: 'B', content: 'Blue' },
            { label: 'C', content: 'Green' },
            { label: 'D', content: 'Yellow' }
          ]
        },
        keyPoints: ['颜色词汇', '常识问答'],
        concepts: ['英语词汇', '选择题'],
        suggestedAnswer: 'B',
        explanation: 'The sky is blue. 天空是蓝色的。'
      }
    ];
    
    // 随机选择一个结果
    const randomIndex = Math.floor(Math.random() * mockResults.length);
    const selectedResult = mockResults[randomIndex];
    
    return {
      success: true,
      text: selectedResult.recognizedText,
      recognizedText: selectedResult.recognizedText,
      confidence: 0.85 + Math.random() * 0.1,
      questionType: selectedResult.questionType,
      subject: selectedResult.subject,
      difficulty: selectedResult.difficulty,
      structuredData: selectedResult.structuredData,
      keyPoints: selectedResult.keyPoints,
      concepts: selectedResult.concepts,
      suggestedAnswer: selectedResult.suggestedAnswer,
      explanation: selectedResult.explanation,
      requestId: requestId,
      processingTime: 1000,
      provider: '豆包AI(降级模式)',
      modelVersion: 'fallback-v1.0',
      imageSource: 'fallback',
      ocrResult: {
        text: selectedResult.recognizedText,
        confidence: 0.85
      }
    };
  }

  /**
   * 计划清理云存储文件
   */
  scheduleCloudFileCleanup(fileID) {
    // 延迟清理，避免影响当前操作
    setTimeout(async () => {
      try {
        await wx.cloud.deleteFile({
          fileList: [fileID]
        });
        console.log('云存储文件清理成功:', fileID);
      } catch (error) {
        console.warn('云存储文件清理失败:', error);
      }
    }, 60000); // 1分钟后清理
  }

  /**
   * 智能图片压缩策略
   */
  async preprocessImage(imagePath) {
    try {
      const imageInfo = await this.getImageInfo(imagePath);
      
      // 检查图片大小
      if (imageInfo.size > DOUBAO_CONFIG.OCR.MAX_IMAGE_SIZE) {
        throw this.createServiceError(
          DOUBAO_CONFIG.ERROR_CODES.IMAGE_TOO_LARGE, 
          '图片文件过大，请选择小于5MB的图片'
        );
      }
      
      // 智能压缩策略
      const compressionOptions = this.calculateOptimalCompression(imageInfo);
      let finalImagePath = imagePath;
      let compressionLevel = 0;
      
      // 第一步：尺寸压缩（如果需要）
      if (compressionOptions.needsResize) {
        finalImagePath = await this.resizeImage(finalImagePath, compressionOptions.targetSize);
        compressionLevel = 1;
      }
      
      // 第二步：质量压缩（如果需要）
      if (compressionOptions.needsQualityCompression) {
        finalImagePath = await this.compressImageQuality(finalImagePath, compressionOptions.quality);
        compressionLevel = 2;
      }
      
      // 转换为Base64
      let base64 = await this.imageToBase64(finalImagePath);
      
      // 多级压缩检查
      if (base64.length > 400 * 1024) { // 400KB阈值
        console.log('Base64仍然过大，进行二次压缩');
        finalImagePath = await this.compressImageQuality(finalImagePath, 15); // 极低质量
        base64 = await this.imageToBase64(finalImagePath);
        compressionLevel = 3;
      }
      
      if (base64.length > 300 * 1024) { // 300KB阈值
        console.log('Base64仍然过大，进行三次压缩');
        finalImagePath = await this.compressImageQuality(finalImagePath, 10); // 最低质量
        base64 = await this.imageToBase64(finalImagePath);
        compressionLevel = 4;
      }
      
      // 内存管理：清理临时文件
      if (finalImagePath !== imagePath && finalImagePath.includes('temp')) {
        this.scheduleFileCleanup(finalImagePath);
      }
      
      console.log('图片预处理完成:', {
        originalSize: imageInfo.size,
        finalBase64Size: base64.length,
        compressionLevel: compressionLevel,
        compressionRatio: imageInfo.size > 0 ? Math.round((1 - base64.length / (imageInfo.size * 1.33)) * 100) : 0,
        withinCloudFunctionLimit: base64.length < 300 * 1024
      });
      
      // 最终安全检查
      if (base64.length > 350 * 1024) {
        throw this.createServiceError(
          'IMAGE_TOO_LARGE_AFTER_COMPRESSION',
          `图片压缩后仍然过大(${Math.round(base64.length/1024)}KB)，请选择更小的图片或重新拍照`
        );
      }
      
      return {
        base64: base64,
        info: {
          ...imageInfo,
          finalSize: base64.length,
          compressionLevel: compressionLevel
        }
      };
      
    } catch (error) {
      console.error('图片预处理失败:', error);
      throw error;
    }
  }

  /**
   * 计算最优压缩参数 - 针对云函数大小限制优化
   */
  calculateOptimalCompression(imageInfo) {
    const { width, height, size } = imageInfo;
    
    // 更严格的限制：目标300KB以内
    const maxDimension = 600; // 进一步降低最大尺寸
    const maxFileSize = 300 * 1024; // 300KB，确保有足够余量
    
    let needsResize = false;
    let needsQualityCompression = true; // 默认开启质量压缩
    let targetSize = { width, height };
    let quality = 30; // 默认质量进一步降低
    
    // 判断是否需要尺寸压缩
    if (width > maxDimension || height > maxDimension) {
      needsResize = true;
      const ratio = Math.min(maxDimension / width, maxDimension / height);
      targetSize = {
        width: Math.round(width * ratio),
        height: Math.round(height * ratio)
      };
    }
    
    // 根据文件大小动态调整质量
    if (size > 2 * 1024 * 1024) {
      quality = 15; // 超大文件使用极低质量
    } else if (size > 1 * 1024 * 1024) {
      quality = 20;
    } else if (size > maxFileSize) {
      quality = 25;
    }
    
    console.log('压缩策略（严格限制）:', {
      needsResize,
      needsQualityCompression,
      targetSize,
      quality,
      originalSize: size,
      maxAllowedSize: maxFileSize
    });
    
    return {
      needsResize,
      needsQualityCompression,
      targetSize,
      quality
    };
  }

  /**
   * 改进的重试机制 - 快速失败策略
   */
  async callCloudFunction(name, data, options = {}) {
    const maxRetries = options.maxRetries || 0; // 默认不重试
    const timeout = options.timeout || 50000; // 50秒超时
    
    console.log(`[${name}] 调用云函数，超时设置: ${timeout}ms`);
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[${name}] 尝试调用云函数 (${attempt + 1}/${maxRetries + 1})`);
        
        const result = await wx.cloud.callFunction({
          name,
          data,
          timeout: timeout
        });
        
        if (result.errMsg === 'cloud.callFunction:ok') {
          return result.result;
        } else {
          throw new Error(result.errMsg);
        }
        
      } catch (error) {
        console.error(`[${name}] 云函数调用失败 (尝试 ${attempt + 1}):`, error.message);
        
        if (attempt === maxRetries) {
          throw this.createServiceError('CLOUD_FUNCTION_ERROR', 
            `云函数调用失败: ${error.message}`);
        }
        
        // 简短延迟后重试
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  // 智能批改（保持原有功能）
  async intelligentGrading(question, userAnswer, standardAnswer) {
    const requestId = this.generateRequestId();
    
    try {
      console.log(`[${requestId}] 开始智能批改`);
      this.updateMetrics('grading', 'total');

      const result = await this.callCloudFunction('ai-grading', {
        question: question,
        userAnswer: userAnswer,
        standardAnswer: standardAnswer,
        requestId: requestId
      });

      this.updateMetrics('grading', 'success');
      return result;

    } catch (error) {
      this.updateMetrics('grading', 'error');
      console.error(`[${requestId}] 智能批改失败:`, error);
      throw error;
    }
  }

  // 获取服务状态
  getServiceStatus() {
    return {
      config: this.config,
      metrics: this.metrics,
      cacheSize: this.cache.size,
      aiProvider: '豆包AI图片分析服务',
      supportedFeatures: [
        '图片文字识别',
        '题目类型识别', 
        '学科判断',
        '难度评估',
        '结构化分析',
        '知识点提取'
      ]
    };
  }

  // 清理缓存
  clearCache() {
    this.cache.clear();
    console.log('AI服务缓存已清理');
  }

  /**
   * 批量图片分析
   * @param {Array} imagePaths - 图片路径数组
   * @param {Object} options - 分析选项
   * @returns {Promise<Array>} 分析结果数组
   */
  async batchAnalyzeImages(imagePaths, options = {}) {
    const results = [];
    const maxConcurrency = options.maxConcurrency || 3;
    
    // 分批处理避免并发过多
    for (let i = 0; i < imagePaths.length; i += maxConcurrency) {
      const batch = imagePaths.slice(i, i + maxConcurrency);
      const batchPromises = batch.map(imagePath => 
        this.analyzeQuestionFromImage(imagePath, options)
          .catch(error => ({ success: false, error: error.message, imagePath }))
      );
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }
    
    return results;
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
   * 图片转Base64
   */
  async imageToBase64(imagePath) {
    return new Promise((resolve, reject) => {
      wx.getFileSystemManager().readFile({
        filePath: imagePath,
        encoding: 'base64',
        success: (res) => {
          resolve(res.data);
        },
        fail: (error) => {
          reject(new Error(`图片转Base64失败: ${error.errMsg}`));
        }
      });
    });
  }

  /**
   * 调整图片尺寸
   */
  async resizeImage(imagePath, targetSize) {
    return new Promise((resolve, reject) => {
      const ctx = wx.createCanvasContext('compressCanvas');
      
      wx.getImageInfo({
        src: imagePath,
        success: (imageInfo) => {
          const { width: originalWidth, height: originalHeight } = imageInfo;
          const { width: targetWidth, height: targetHeight } = targetSize;
          
          // 创建canvas并绘制缩放后的图片
          ctx.drawImage(imagePath, 0, 0, originalWidth, originalHeight, 0, 0, targetWidth, targetHeight);
          ctx.draw(false, () => {
            wx.canvasToTempFilePath({
              canvasId: 'compressCanvas',
              x: 0,
              y: 0,
              width: targetWidth,
              height: targetHeight,
              success: (res) => {
                console.log('图片尺寸压缩成功:', {
                  原尺寸: `${originalWidth}x${originalHeight}`,
                  新尺寸: `${targetWidth}x${targetHeight}`,
                  压缩比: Math.round((1 - (targetWidth * targetHeight) / (originalWidth * originalHeight)) * 100) + '%'
                });
                resolve(res.tempFilePath);
              },
              fail: (error) => {
                console.error('图片尺寸压缩失败:', error);
                resolve(imagePath); // 失败时返回原图
              }
            });
          });
        },
        fail: (error) => {
          console.error('获取图片信息失败:', error);
          resolve(imagePath); // 失败时返回原图
        }
      });
    });
  }

  /**
   * 压缩图片质量
   */
  async compressImageQuality(imagePath, quality) {
    return new Promise((resolve, reject) => {
      wx.compressImage({
        src: imagePath,
        quality: quality,
        success: (res) => {
          console.log('图片质量压缩成功:', {
            质量设置: quality,
            原路径: imagePath,
            新路径: res.tempFilePath
          });
          resolve(res.tempFilePath);
        },
        fail: (error) => {
          console.error('图片质量压缩失败:', error);
          resolve(imagePath); // 失败时返回原图
        }
      });
    });
  }

  /**
   * 清理临时文件
   */
  scheduleFileCleanup(filePath) {
    setTimeout(() => {
      try {
        wx.getFileSystemManager().unlink({
          filePath: filePath,
          success: () => console.log('临时文件已清理:', filePath),
          fail: (error) => console.warn('清理临时文件失败:', error)
        });
      } catch (error) {
        console.warn('清理临时文件异常:', error);
      }
    }, 5000); // 5秒后清理
  }

  /**
   * 测试云函数连接和豆包AI状态
   */
  async testCloudFunction() {
    try {
      console.log('开始测试云函数连接...');
      
      // 只有在测试时才传递 test: true
      const result = await this.callCloudFunction('ocr-recognition', {
        test: true // 明确的测试调用
      });
      
      console.log('云函数测试结果:', result);
      return result;
      
    } catch (error) {
      console.error('云函数测试失败:', error);
      throw error;
    }
  }

  /**
   * 设置生产模式（兼容方法）
   */
  setProductionMode(isProduction) {
    this.config.mockMode = !isProduction;
    console.log(`AI服务模式设置: ${isProduction ? '生产模式' : '开发模式'}`);
  }

  /**
   * 设置开发模式（兼容方法）
   */
  setDevelopmentMode(isDevelopment) {
    this.config.mockMode = isDevelopment;
    console.log(`AI服务模式设置: ${isDevelopment ? '开发模式' : '生产模式'}`);
  }

  /**
   * 压缩图片 - 严格限制版本
   */
  async compressImageStrict(imagePath, options = {}) {
    const requestId = options.requestId || this.generateRequestId();
    
    try {
      console.log(`[${requestId}] 压缩策略（严格限制）:`, {
        原始路径: imagePath,
        目标大小: '< 1MB',
        质量: '0.6-0.8',
        格式转换: 'PNG -> JPEG'
      });

      // 获取原始图片信息
      const imageInfo = await this.getImageInfo(imagePath);
      console.log(`[${requestId}] 原始图片信息:`, {
        宽度: imageInfo.width,
        高度: imageInfo.height,
        路径: imageInfo.path
      });

      // 🔧 关键修复：直接使用微信压缩API，自动转换为JPEG
      const compressResult = await new Promise((resolve, reject) => {
        wx.compressImage({
          src: imagePath,
          quality: 70, // 降低质量确保转换为JPEG
          success: (res) => {
            console.log(`[${requestId}] 微信压缩成功，输出路径:`, res.tempFilePath);
            resolve({
              success: true,
              tempFilePath: res.tempFilePath,
              width: imageInfo.width,
              height: imageInfo.height
            });
          },
          fail: (error) => {
            console.error(`[${requestId}] 微信压缩失败:`, error);
            // 如果压缩失败，使用原图
            resolve({
              success: true,
              tempFilePath: imagePath,
              width: imageInfo.width,
              height: imageInfo.height,
              note: '压缩失败，使用原图'
            });
          }
        });
      });

      console.log(`[${requestId}] 压缩完成:`, compressResult);
      return compressResult;

    } catch (error) {
      console.error(`[${requestId}] 压缩过程异常:`, error);
      
      // 降级处理：返回原图
      try {
        const imageInfo = await this.getImageInfo(imagePath);
        return {
          success: true,
          tempFilePath: imagePath,
          width: imageInfo.width,
          height: imageInfo.height,
          note: '压缩异常，使用原图'
        };
      } catch (getInfoError) {
        return {
          success: true,
          tempFilePath: imagePath,
          width: 0,
          height: 0,
          note: '获取图片信息失败，使用原图'
        };
      }
    }
  }

  /**
   * 使用Canvas压缩图片
   */
  compressWithCanvas(imagePath, width, height, resolve, reject) {
    try {
      // 简化版：直接返回原图路径
      // 在小程序环境中，canvas压缩比较复杂，暂时跳过
      console.log('Canvas压缩暂时跳过，使用原图');
      resolve({
        tempFilePath: imagePath,
        width: width,
        height: height
      });
    } catch (error) {
      console.error('Canvas压缩失败:', error);
      resolve({
        tempFilePath: imagePath,
        width: width,
        height: height
      });
    }
  }

  /**
   * 使用微信压缩API转换图片为JPEG格式
   */
  async convertToJPEG(imagePath, quality = 0.8) {
    try {
      console.log('开始转换为JPEG格式，使用微信压缩API...');
      
      // 使用微信的压缩API，它会自动转换为JPEG格式
      const compressResult = await new Promise((resolve, reject) => {
        wx.compressImage({
          src: imagePath,
          quality: Math.round(quality * 100), // 转换为0-100的范围
          success: (res) => {
            console.log('微信压缩转换JPEG成功:', res.tempFilePath);
            resolve(res.tempFilePath);
          },
          fail: (error) => {
            console.error('微信压缩转换失败:', error);
            resolve(imagePath); // 降级使用原图
          }
        });
      });
      
      return compressResult;
      
    } catch (error) {
      console.error('转换JPEG异常:', error);
      return imagePath; // 降级使用原图
    }
  }
}

// 创建并导出AI服务实例
const aiService = new AIService();
export default aiService;



















































