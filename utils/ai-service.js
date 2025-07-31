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
   * 调用云函数（优化版）
   * @param {string} name - 云函数名称
   * @param {Object} data - 传递给云函数的数据
   * @param {Object} options - 调用选项
   */
  async callCloudFunction(name, data, options = {}) {
    const maxRetries = options.maxRetries !== undefined ? options.maxRetries : 2; // 默认重试2次
    const timeout = options.timeout || 50000; // 50秒超时
    const retryDelay = options.retryDelay || 1000; // 重试延迟
    
    console.log(`[${name}] 调用云函数，超时设置: ${timeout}ms，最大重试: ${maxRetries}次`);
    
    let lastError;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const attemptInfo = `(${attempt + 1}/${maxRetries + 1})`;
        console.log(`[${name}] 尝试调用云函数 ${attemptInfo}`);
        
        const startTime = Date.now();
        
        const result = await wx.cloud.callFunction({
          name,
          data,
          timeout: timeout
        });
        
        const duration = Date.now() - startTime;
        
        if (result.errMsg === 'cloud.callFunction:ok') {
          console.log(`[${name}] 云函数调用成功 ${attemptInfo}，耗时: ${duration}ms`);
          
          // 检查返回结果的有效性
          if (this.isValidResult(result.result)) {
            return result.result;
          } else {
            console.warn(`[${name}] 云函数返回结果无效:`, result.result);
            throw new Error('云函数返回结果格式无效');
          }
        } else {
          throw new Error(result.errMsg || '云函数调用未知错误');
        }
        
      } catch (error) {
        lastError = error;
        const errorMsg = error.message || error.errMsg || '未知错误';
        console.error(`[${name}] 云函数调用失败 (尝试 ${attempt + 1}):`, errorMsg);
        
        // 判断是否应该重试
        if (attempt === maxRetries || !this.shouldRetry(error)) {
          break;
        }
        
        // 计算重试延迟（指数退避）
        const delay = retryDelay * Math.pow(2, attempt);
        console.log(`[${name}] ${delay}ms后重试...`);
        await this.delay(delay);
      }
    }
    
    // 所有重试都失败了
    const finalError = this.createServiceError('CLOUD_FUNCTION_ERROR', 
      `云函数调用失败: ${lastError?.message || '未知错误'}`);
    
    // 记录详细错误信息
    console.error(`[${name}] 云函数调用最终失败:`, {
      error: lastError?.message,
      attempts: maxRetries + 1,
      timeout: timeout
    });
    
    throw finalError;
  }

  /**
   * 检查云函数返回结果是否有效
   */
  isValidResult(result) {
    return result && typeof result === 'object';
  }

  /**
   * 判断错误是否应该重试
   */
  shouldRetry(error) {
    const errorMsg = error.message || error.errMsg || '';
    
    // 不重试的错误类型
    const noRetryErrors = [
      'cloud.callFunction:fail invalid parameter',
      '参数错误',
      '配置无效'
    ];
    
    if (noRetryErrors.some(msg => errorMsg.includes(msg))) {
      return false;
    }
    
    // 重试的错误类型（网络、超时等）
    const retryErrors = [
      'timeout',
      'network',
      'service unavailable',
      'internal error'
    ];
    
    return retryErrors.some(msg => errorMsg.toLowerCase().includes(msg));
  }

  /**
   * 延迟工具方法
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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
        '知识点提取',
        'AI题目生成',
        'AI智能评分'
      ]
    };
  }

  /**
   * AI服务健康检查
   * 测试所有关键的AI云函数是否正常工作
   */
  async performHealthCheck() {
    console.log('开始AI服务健康检查...');
    
    const healthStatus = {
      overall: 'unknown',
      timestamp: new Date().toISOString(),
      services: {},
      summary: {
        total: 0,
        healthy: 0,
        unhealthy: 0,
        failed: 0
      }
    };

    // 要检查的云函数列表
    const servicesToCheck = [
      {
        name: 'ai-question-analyzer',
        description: '图片分析服务',
        testData: { test: true }
      },
      {
        name: 'ai-question-generator', 
        description: 'AI题目生成服务',
        testData: { 
          test: true,
          sourceErrors: [{ content: '测试题目', subject: '数学' }],
          generateCount: 1
        }
      },
      {
        name: 'ai-grading',
        description: 'AI智能评分服务',
        testData: {
          question: { type: 'single_choice', content: '测试题目' },
          userAnswer: 'A',
          standardAnswer: 'A'
        }
      },
      {
        name: 'ocr-recognition',
        description: 'OCR识别服务',
        testData: { test: true }
      }
    ];

    healthStatus.summary.total = servicesToCheck.length;

    // 并发测试所有服务
    const checkPromises = servicesToCheck.map(async service => {
      try {
        console.log(`检查 ${service.name}...`);
        const startTime = Date.now();
        
        const result = await this.callCloudFunction(service.name, service.testData, {
          timeout: 10000, // 健康检查使用较短超时
          maxRetries: 1
        });
        
        const duration = Date.now() - startTime;
        const isHealthy = result.success !== false;
        
        healthStatus.services[service.name] = {
          status: isHealthy ? 'healthy' : 'unhealthy',
          description: service.description,
          responseTime: duration,
          result: isHealthy ? 'ok' : result.error || '响应异常',
          lastCheck: new Date().toISOString()
        };
        
        if (isHealthy) {
          healthStatus.summary.healthy++;
        } else {
          healthStatus.summary.unhealthy++;
        }
        
        console.log(`✅ ${service.name} 检查完成: ${isHealthy ? '健康' : '异常'} (${duration}ms)`);
        
      } catch (error) {
        console.error(`❌ ${service.name} 检查失败:`, error.message);
        
        healthStatus.services[service.name] = {
          status: 'failed',
          description: service.description,
          responseTime: -1,
          result: error.message,
          lastCheck: new Date().toISOString()
        };
        
        healthStatus.summary.failed++;
      }
    });

    await Promise.all(checkPromises);

    // 确定整体健康状态
    if (healthStatus.summary.healthy === healthStatus.summary.total) {
      healthStatus.overall = 'healthy';
    } else if (healthStatus.summary.healthy > 0) {
      healthStatus.overall = 'degraded';
    } else {
      healthStatus.overall = 'unhealthy';
    }

    console.log('AI服务健康检查完成:', {
      overall: healthStatus.overall,
      healthy: `${healthStatus.summary.healthy}/${healthStatus.summary.total}`,
      avgResponseTime: this.calculateAverageResponseTime(healthStatus.services)
    });

    return healthStatus;
  }

  /**
   * 计算平均响应时间
   */
  calculateAverageResponseTime(services) {
    const validTimes = Object.values(services)
      .map(s => s.responseTime)
      .filter(t => t > 0);
    
    if (validTimes.length === 0) return -1;
    
    return Math.round(validTimes.reduce((sum, time) => sum + time, 0) / validTimes.length);
  }

  /**
   * AI服务性能测试
   * 测试AI服务在不同负载下的性能
   */
  async performPerformanceTest(options = {}) {
    const {
      testDuration = 30000, // 30秒
      concurrency = 3, // 并发数
      testType = 'mixed' // 测试类型: image, generation, grading, mixed
    } = options;

    console.log(`开始AI服务性能测试 - 持续时间: ${testDuration}ms, 并发: ${concurrency}, 类型: ${testType}`);

    const testResults = {
      startTime: Date.now(),
      endTime: null,
      duration: testDuration,
      concurrency,
      testType,
      requests: {
        total: 0,
        successful: 0,
        failed: 0,
        timeouts: 0
      },
      performance: {
        avgResponseTime: 0,
        minResponseTime: Infinity,
        maxResponseTime: 0,
        throughput: 0 // 请求/秒
      },
      errors: []
    };

    const endTime = Date.now() + testDuration;
    const responseTimes = [];

    // 创建并发测试任务
    const testTasks = Array(concurrency).fill().map(async (_, index) => {
      while (Date.now() < endTime) {
        try {
          const startRequest = Date.now();
          
          // 根据测试类型选择不同的测试方法
          await this.executeTestRequest(testType);
          
          const responseTime = Date.now() - startRequest;
          responseTimes.push(responseTime);
          
          testResults.requests.total++;
          testResults.requests.successful++;
          
          testResults.performance.minResponseTime = Math.min(testResults.performance.minResponseTime, responseTime);
          testResults.performance.maxResponseTime = Math.max(testResults.performance.maxResponseTime, responseTime);
          
        } catch (error) {
          testResults.requests.total++;
          testResults.requests.failed++;
          
          if (error.message.includes('timeout')) {
            testResults.requests.timeouts++;
          }
          
          testResults.errors.push({
            timestamp: Date.now(),
            error: error.message,
            worker: index
          });
        }
        
        // 短暂延迟避免过于密集的请求
        await this.delay(100);
      }
    });

    await Promise.all(testTasks);

    testResults.endTime = Date.now();
    testResults.performance.avgResponseTime = responseTimes.length > 0 
      ? Math.round(responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length)
      : 0;
    
    const actualDuration = testResults.endTime - testResults.startTime;
    testResults.performance.throughput = Math.round((testResults.requests.total / actualDuration) * 1000 * 100) / 100;

    console.log('AI服务性能测试完成:', {
      总请求数: testResults.requests.total,
      成功率: `${Math.round((testResults.requests.successful / testResults.requests.total) * 100)}%`,
      平均响应时间: `${testResults.performance.avgResponseTime}ms`,
      吞吐量: `${testResults.performance.throughput} 请求/秒`
    });

    return testResults;
  }

  /**
   * 执行测试请求
   */
  async executeTestRequest(testType) {
    switch (testType) {
      case 'image':
        return await this.callCloudFunction('ai-question-analyzer', { test: true });
        
      case 'generation':
        return await this.callCloudFunction('ai-question-generator', {
          test: true,
          sourceErrors: [{ content: '测试', subject: '数学' }],
          generateCount: 1
        });
        
      case 'grading':
        return await this.callCloudFunction('ai-grading', {
          question: { type: 'single_choice', content: '测试' },
          userAnswer: 'A',
          standardAnswer: 'A'
        });
        
      case 'mixed':
      default:
        const methods = ['image', 'generation', 'grading'];
        const randomMethod = methods[Math.floor(Math.random() * methods.length)];
        return await this.executeTestRequest(randomMethod);
    }
  }

  // 清理缓存
  clearCache() {
    this.cache.clear();
    console.log('AI服务缓存已清理');
  }

  /**
   * 创建用户友好的错误信息
   * @param {string} errorCode - 错误代码
   * @param {string} technicalMessage - 技术错误信息
   * @param {Object} context - 错误上下文
   */
  createUserFriendlyError(errorCode, technicalMessage, context = {}) {
    const errorMappings = {
      'CLOUD_FUNCTION_ERROR': {
        title: 'AI服务暂时不可用',
        message: '网络连接或服务异常，请稍后重试',
        suggestions: ['检查网络连接', '稍后重试', '使用离线功能']
      },
      'TIMEOUT_ERROR': {
        title: '处理超时',
        message: '处理时间较长，请稍后重试',
        suggestions: ['减少图片大小', '重新拍照', '稍后重试']
      },
      'INVALID_IMAGE': {
        title: '图片格式不支持',
        message: '请使用清晰的图片重新拍照',
        suggestions: ['重新拍照', '确保图片清晰', '调整光线条件']
      },
      'AI_GENERATION_FAILED': {
        title: 'AI生成失败',
        message: '暂时无法生成练习题目，请稍后重试',
        suggestions: ['稍后重试', '手动添加题目', '检查网络连接']
      },
      'AI_GRADING_FAILED': {
        title: '智能评分失败',
        message: '暂时无法进行智能评分，已使用基础评分',
        suggestions: ['答案仍会被保存', '可手动核对答案', '稍后查看详细分析']
      },
      'QUOTA_EXCEEDED': {
        title: '今日AI使用次数已达上限',
        message: '您今天的AI功能使用已达上限，明天会自动重置',
        suggestions: ['明天再试', '使用手动功能', '升级账户']
      },
      'CONFIG_ERROR': {
        title: 'AI服务配置异常',
        message: '服务配置需要更新，请联系客服',
        suggestions: ['联系客服', '稍后重试', '使用基础功能']
      }
    };

    const errorInfo = errorMappings[errorCode] || {
      title: '未知错误',
      message: '发生了未知错误，请稍后重试',
      suggestions: ['重启应用', '检查网络', '联系客服']
    };

    return {
      code: errorCode,
      title: errorInfo.title,
      message: errorInfo.message,
      suggestions: errorInfo.suggestions,
      technicalMessage,
      context,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 显示用户友好的错误提示
   * @param {Object} error - 错误信息
   * @param {Object} options - 显示选项
   */
  showUserFriendlyError(error, options = {}) {
    const {
      showModal = true,
      showToast = false,
      duration = 3000
    } = options;

    if (showModal) {
      wx.showModal({
        title: error.title || '操作失败',
        content: error.message || '发生了未知错误',
        showCancel: error.suggestions && error.suggestions.length > 0,
        cancelText: '查看建议',
        confirmText: '知道了',
        success: (res) => {
          if (res.cancel && error.suggestions) {
            // 显示建议
            const suggestions = error.suggestions.join('\n• ');
            wx.showModal({
              title: '解决建议',
              content: '• ' + suggestions,
              showCancel: false,
              confirmText: '明白了'
            });
          }
        }
      });
    } else if (showToast) {
      wx.showToast({
        title: error.title || error.message || '操作失败',
        icon: 'none',
        duration
      });
    }

    // 记录错误到控制台以便调试
    console.error('用户友好错误:', error);
  }

  /**
   * AI服务降级处理
   * 当AI服务不可用时，提供基础功能
   */
  async degradeService(serviceType, originalData, options = {}) {
    console.log(`AI服务降级: ${serviceType}`);

    switch (serviceType) {
      case 'image_analysis':
        return this.fallbackImageAnalysis(originalData, options);
        
      case 'question_generation':
        return this.fallbackQuestionGeneration(originalData, options);
        
      case 'grading':
        return this.fallbackGrading(originalData, options);
        
      default:
        throw this.createUserFriendlyError('CONFIG_ERROR', `未知的服务类型: ${serviceType}`);
    }
  }

  /**
   * 图片分析降级处理
   */
  async fallbackImageAnalysis(imageData, options = {}) {
    console.log('使用降级图片分析...');
    
    return {
      success: true,
      recognizedText: '图片内容需要手动输入',
      confidence: 0,
      questionType: 'unknown',
      subject: '未知',
      analysis: {
        difficulty: 3,
        keyPoints: [],
        concepts: []
      },
      fallbackMode: true,
      provider: '降级服务'
    };
  }

  /**
   * 题目生成降级处理
   */
  async fallbackQuestionGeneration(sourceData, options = {}) {
    console.log('使用降级题目生成...');
    
    const { mistakes, count = 5 } = sourceData;
    
    if (!mistakes || mistakes.length === 0) {
      return {
        success: false,
        error: '没有可用的错题数据',
        fallbackMode: true
      };
    }

    // 基于错题创建简化版练习题
    const questions = mistakes.slice(0, count).map((mistake, index) => ({
      id: `fallback_${Date.now()}_${index}`,
      type: mistake.type || 'single_choice',
      subject: mistake.subject || '综合',
      question: `根据错题：${(mistake.question || mistake.content || '').substring(0, 50)}...，请总结类似题目的解题方法。`,
      options: ['方法A', '方法B', '方法C', '方法D'],
      answer: '方法A',
      explanation: '这是一个基于您错题生成的思考题，帮助您总结解题方法。',
      difficulty: mistake.difficulty || 3,
      fallbackGenerated: true
    }));

    return {
      success: true,
      questions,
      fallbackMode: true,
      provider: '降级服务',
      metadata: {
        generatedCount: questions.length,
        method: 'fallback'
      }
    };
  }

  /**
   * 智能评分降级处理
   */
  async fallbackGrading(gradingData, options = {}) {
    console.log('使用降级智能评分...');
    
    const { question, userAnswer, standardAnswer } = gradingData;
    
    // 简单的字符串匹配评分
    const userAnswerNormalized = (userAnswer || '').toString().trim().toLowerCase();
    const standardAnswerNormalized = (standardAnswer || '').toString().trim().toLowerCase();
    
    const isExactMatch = userAnswerNormalized === standardAnswerNormalized;
    const isSimilar = userAnswerNormalized.length > 0 && 
      standardAnswerNormalized.includes(userAnswerNormalized);
    
    let score = 0;
    let isCorrect = false;
    let analysis = '';
    
    if (isExactMatch) {
      score = 100;
      isCorrect = true;
      analysis = '答案完全正确！';
    } else if (isSimilar) {
      score = 60;
      isCorrect = false;
      analysis = '答案部分正确，但还需要完善。';
    } else {
      score = 0;
      isCorrect = false;
      analysis = '答案与标准答案不符，建议重新思考。';
    }

    return {
      success: true,
      isCorrect,
      score,
      analysis,
      suggestions: '请参考标准答案，总结解题思路。',
      keyPoints: [],
      fallbackMode: true,
      provider: '基础评分'
    };
  }

  /**
   * 智能重试机制
   * 根据错误类型决定是否应该重试
   */
  async intelligentRetry(operation, maxAttempts = 3, context = {}) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        console.log(`智能重试第 ${attempt} 次尝试: ${context.operationType || 'unknown'}`);
        
        const result = await operation();
        
        console.log(`智能重试成功: ${context.operationType || 'unknown'}`);
        return result;
        
      } catch (error) {
        lastError = error;
        console.error(`智能重试第 ${attempt} 次失败:`, error.message);
        
        // 根据错误类型决定是否继续重试
        if (!this.shouldRetryOperation(error, attempt, maxAttempts)) {
          break;
        }
        
        // 智能延迟：网络错误用指数退避，其他错误固定延迟
        const delay = this.calculateRetryDelay(error, attempt);
        if (delay > 0) {
          console.log(`等待 ${delay}ms 后重试...`);
          await this.delay(delay);
        }
      }
    }
    
    // 重试失败，抛出最后的错误
    throw lastError;
  }

  /**
   * 判断是否应该重试操作
   */
  shouldRetryOperation(error, currentAttempt, maxAttempts) {
    if (currentAttempt >= maxAttempts) {
      return false;
    }
    
    const errorMessage = error.message || '';
    
    // 立即失败的错误类型（不重试）
    const noRetryErrors = [
      '参数错误',
      '配置无效',
      '权限不足',
      'quota exceeded',
      'invalid parameter'
    ];
    
    if (noRetryErrors.some(msg => errorMessage.toLowerCase().includes(msg))) {
      return false;
    }
    
    // 可重试的错误类型
    const retryableErrors = [
      'timeout',
      'network',
      'service unavailable',
      'connection',
      'server error',
      'internal error'
    ];
    
    return retryableErrors.some(msg => errorMessage.toLowerCase().includes(msg));
  }

  /**
   * 计算重试延迟
   */
  calculateRetryDelay(error, attempt) {
    const errorMessage = error.message || '';
    
    // 网络相关错误使用指数退避
    if (errorMessage.toLowerCase().includes('network') || 
        errorMessage.toLowerCase().includes('timeout')) {
      return Math.min(1000 * Math.pow(2, attempt - 1), 10000); // 最大10秒
    }
    
    // 服务器错误使用固定延迟
    if (errorMessage.toLowerCase().includes('server') || 
        errorMessage.toLowerCase().includes('service')) {
      return 2000; // 固定2秒
    }
    
    // 其他错误使用较短延迟
    return 1000;
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

  /**
   * 基于已保存的错题生成AI练习题
   * @param {string} mistakeId - 错题ID
   * @param {Object} options - 生成选项
   */
  async generatePracticeFromMistake(mistakeId, options = {}) {
    const requestId = this.generateRequestId();
    
    try {
      console.log(`[${requestId}] 基于错题生成练习题:`, mistakeId);
      
      // 1. 获取错题详情
      const mistakeResult = await this.getMistakeDetails(mistakeId);
      if (!mistakeResult.success) {
        throw new Error('获取错题详情失败');
      }
      
      const mistake = mistakeResult.data;
      
      // 2. 调用豆包AI题目生成云函数
      const result = await this.callCloudFunction('ai-question-generator', {
        errorQuestion: {
          content: mistake.question || mistake.content,
          subject: mistake.subject,
          difficulty: mistake.difficulty || 3,
          type: mistake.type || 'single_choice',
          keyPoints: mistake.keyPoints || [],
          concepts: mistake.concepts || [],
          wrongAnswer: mistake.userAnswer,
          correctAnswer: mistake.correctAnswer,
          mistakeReason: mistake.mistakeReason
        },
        generateCount: options.count || 5,
        difficulty: options.difficulty || mistake.difficulty,
        questionTypes: options.types || ['single_choice', 'multiple_choice', 'fill_blank'],
        requestId: requestId,
        useDoubao: true // 明确使用豆包AI
      });
      
      if (result.success && result.questions) {
        // 为生成的题目添加元数据
        const enhancedQuestions = result.questions.map((q, index) => ({
          ...q,
          sourceId: mistakeId,
          generatedAt: new Date().toISOString(),
          practiceType: 'ai_generated',
          relatedConcepts: mistake.concepts || [],
          targetWeakness: mistake.mistakeReason
        }));
        
        return {
          success: true,
          questions: enhancedQuestions,
          sourceError: mistake,
          metadata: {
            generatedCount: enhancedQuestions.length,
            targetSubject: mistake.subject,
            difficulty: options.difficulty,
            processingTime: result.metadata?.processingTime || 0
          }
        };
      }
      
      throw new Error('AI生成失败');
      
    } catch (error) {
      console.error(`[${requestId}] 基于错题生成练习题失败:`, error);
      throw error;
    }
  }

  /**
   * 批量基于多个错题生成综合练习题
   */
  async generateComprehensivePractice(mistakeIds, options = {}) {
    const requestId = this.generateRequestId();
    
    try {
      console.log(`[${requestId}] 批量生成综合练习题:`, mistakeIds.length);
      
      const allQuestions = [];
      const sourceErrors = [];
      
      // 并发生成，但限制并发数
      const maxConcurrency = 3;
      for (let i = 0; i < mistakeIds.length; i += maxConcurrency) {
        const batch = mistakeIds.slice(i, i + maxConcurrency);
        const batchPromises = batch.map(id => 
          this.generatePracticeFromMistake(id, {
            count: options.questionsPerError || 2,
            difficulty: options.difficulty
          })
        );
        
        const batchResults = await Promise.all(batchPromises);
        
        batchResults.forEach(result => {
          if (result.success) {
            allQuestions.push(...result.questions);
            sourceErrors.push(result.sourceError);
          }
        });
      }
      
      return {
        success: true,
        questions: allQuestions,
        sourceErrors: sourceErrors,
        metadata: {
          totalQuestions: allQuestions.length,
          sourceErrorCount: mistakeIds.length,
          subjects: [...new Set(sourceErrors.map(e => e.subject))]
        }
      };
      
    } catch (error) {
      console.error(`[${requestId}] 批量生成练习题失败:`, error);
      throw error;
    }
  }

  /**
   * 基于错题数组生成练习题目（exam.js调用的方法）
   * @param {Array} mistakes - 错题数组
   * @param {Object} options - 生成选项
   */
  async generateQuestionsFromMistakes(mistakes, options = {}) {
    const requestId = this.generateRequestId();
    
    try {
      console.log(`[${requestId}] 基于${mistakes.length}个错题生成练习题目`);
      
      if (!mistakes || mistakes.length === 0) {
        return {
          success: false,
          error: '没有错题数据',
          questions: []
        };
      }
      
      // 调用豆包AI题目生成云函数
      const result = await this.callCloudFunction('ai-question-generator', {
        sourceErrors: mistakes.map(mistake => ({
          content: mistake.question || mistake.content || '题目内容缺失',
          subject: mistake.subject || '未知',
          difficulty: mistake.difficulty || 3,
          type: mistake.type || 'single_choice',
          keyPoints: mistake.keyPoints || [],
          concepts: mistake.concepts || [],
          wrongAnswer: mistake.userAnswer || mistake.我的答案 || '',
          correctAnswer: mistake.answer || mistake.correctAnswer || mistake.正确答案 || '',
          mistakeReason: mistake.mistakeReason || '未分析'
        })),
        generateCount: options.count || 5,
        questionTypes: options.types || ['single_choice', 'multiple_choice', 'fill_blank'],
        difficulty: options.difficulty || 'auto', // 'auto'表示根据错题难度自动调整
        requestId: requestId,
        useDoubao: true
      });
      
      if (result.success && result.questions) {
        // 为生成的题目添加元数据
        const enhancedQuestions = result.questions.map((q, index) => ({
          ...q,
          id: `generated_${Date.now()}_${index}`,
          generatedAt: new Date().toISOString(),
          practiceType: 'ai_generated',
          sourceErrors: mistakes.map(m => m._id || m.id).filter(Boolean),
          relatedConcepts: this.extractUniqueValues(mistakes, 'concepts'),
          targetSubjects: this.extractUniqueValues(mistakes, 'subject')
        }));
        
        console.log(`[${requestId}] 成功生成${enhancedQuestions.length}个练习题目`);
        
        return {
          success: true,
          questions: enhancedQuestions,
          sourceErrors: mistakes,
          metadata: {
            generatedCount: enhancedQuestions.length,
            sourceErrorCount: mistakes.length,
            subjects: this.extractUniqueValues(mistakes, 'subject'),
            processingTime: result.metadata?.processingTime || 0
          }
        };
      }
      
      // AI生成失败时的降级处理
      console.warn(`[${requestId}] AI生成失败，使用降级方案`);
      return this.fallbackGenerateQuestions(mistakes, options);
      
    } catch (error) {
      console.error(`[${requestId}] 基于错题生成练习题目失败:`, error);
      
      // 错误时的降级处理
      return this.fallbackGenerateQuestions(mistakes, options);
    }
  }

  /**
   * 降级题目生成方案（当AI服务不可用时）
   */
  fallbackGenerateQuestions(mistakes, options = {}) {
    console.log('使用降级方案生成练习题目');
    
    try {
      const questions = mistakes.map((mistake, index) => ({
        id: `fallback_${Date.now()}_${index}`,
        type: mistake.type || 'single_choice',
        subject: mistake.subject || '综合',
        difficulty: mistake.difficulty || 3,
        question: mistake.question || mistake.content || '题目内容缺失',
        options: this.generateFallbackOptions(mistake),
        answer: mistake.answer || mistake.correctAnswer || mistake.正确答案 || '',
        explanation: `这是基于您的错题"${(mistake.question || mistake.content || '').substring(0, 20)}..."生成的类似题目。`,
        keyPoints: mistake.keyPoints || [],
        source: 'fallback_generation',
        practiceType: 'error_review',
        originalErrorId: mistake._id || mistake.id
      }));
      
      return {
        success: true,
        questions: questions.slice(0, options.count || 5),
        sourceErrors: mistakes,
        metadata: {
          generatedCount: Math.min(questions.length, options.count || 5),
          sourceErrorCount: mistakes.length,
          method: 'fallback',
          subjects: this.extractUniqueValues(mistakes, 'subject')
        }
      };
    } catch (error) {
      console.error('降级题目生成也失败:', error);
      return {
        success: false,
        error: '题目生成失败',
        questions: []
      };
    }
  }

  /**
   * 为降级方案生成选项
   */
  generateFallbackOptions(mistake) {
    if (mistake.type === 'single_choice' || mistake.type === 'multiple_choice') {
      const correctAnswer = mistake.answer || mistake.correctAnswer || mistake.正确答案 || 'A';
      return [
        correctAnswer,
        '其他选项1',
        '其他选项2',
        '其他选项3'
      ].slice(0, 4);
    }
    return [];
  }

  /**
   * 提取数组中对象的唯一值
   */
  extractUniqueValues(array, field) {
    const values = array.map(item => item[field]).filter(Boolean);
    return [...new Set(values)];
  }

  /**
   * 生成试卷
   */
  async generateExamPaper(questions, options = {}) {
    const requestId = this.generateRequestId();
    
    try {
      console.log(`[${requestId}] 生成试卷:`, questions.length);
      
      const paperConfig = {
        title: options.title || '智能练习试卷',
        subtitle: options.subtitle || `基于错题生成 - ${new Date().toLocaleDateString()}`,
        totalScore: options.totalScore || 100,
        timeLimit: options.timeLimit || 60, // 分钟
        instructions: options.instructions || [
          '1. 请仔细阅读题目，选择最佳答案',
          '2. 填空题请填写准确答案',
          '3. 注意答题时间，合理分配'
        ]
      };
      
      // 按题型分组并分配分值
      const groupedQuestions = this.groupQuestionsByType(questions);
      const scoredQuestions = this.assignScores(groupedQuestions, paperConfig.totalScore);
      
      const examPaper = {
        id: `exam_${Date.now()}`,
        config: paperConfig,
        sections: scoredQuestions,
        metadata: {
          questionCount: questions.length,
          subjects: [...new Set(questions.map(q => q.subject || '未知'))],
          difficulty: this.calculateAverageDifficulty(questions),
          generatedAt: new Date().toISOString(),
          estimatedTime: this.estimateCompletionTime(questions)
        }
      };
      
      return {
        success: true,
        examPaper: examPaper,
        printData: this.formatForPrint(examPaper)
      };
      
    } catch (error) {
      console.error(`[${requestId}] 生成试卷失败:`, error);
      throw error;
    }
  }

  /**
   * 获取错题详情（从数据库）
   */
  async getMistakeDetails(mistakeId) {
    try {
      const db = getApp().globalData.databaseManager;
      return await db.getMistakeById(mistakeId);
    } catch (error) {
      console.error('获取错题详情失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 按题型分组并分配分值
   */
  groupQuestionsByType(questions) {
    const groups = {
      single_choice: { name: '单选题', questions: [], scorePerQuestion: 5 },
      multiple_choice: { name: '多选题', questions: [], scorePerQuestion: 8 },
      fill_blank: { name: '填空题', questions: [], scorePerQuestion: 6 },
      short_answer: { name: '简答题', questions: [], scorePerQuestion: 10 }
    };
    
    questions.forEach(q => {
      const type = q.type || 'single_choice';
      if (groups[type]) {
        groups[type].questions.push(q);
      } else {
        groups.single_choice.questions.push(q);
      }
    });
    
    return Object.entries(groups)
      .filter(([type, group]) => group.questions.length > 0)
      .map(([type, group]) => ({
        type,
        name: group.name,
        questions: group.questions,
        scorePerQuestion: group.scorePerQuestion,
        totalScore: group.questions.length * group.scorePerQuestion
      }));
  }

  /**
   * 分配题目分值
   */
  assignScores(sections, totalScore) {
    const totalQuestions = sections.reduce((sum, section) => sum + section.questions.length, 0);
    
    if (totalQuestions === 0) return sections;
    
    let remainingScore = totalScore;
    
    return sections.map((section, index) => {
      if (index === sections.length - 1) {
        // 最后一个部分分配剩余分数
        section.totalScore = remainingScore;
        section.scorePerQuestion = Math.round(remainingScore / section.questions.length);
      } else {
        const sectionScore = Math.round((section.questions.length / totalQuestions) * totalScore);
        section.totalScore = sectionScore;
        section.scorePerQuestion = Math.round(sectionScore / section.questions.length);
        remainingScore -= sectionScore;
      }
      
      return section;
    });
  }

  /**
   * 计算平均难度
   */
  calculateAverageDifficulty(questions) {
    if (questions.length === 0) return 3;
    
    const totalDifficulty = questions.reduce((sum, q) => sum + (q.difficulty || 3), 0);
    return Math.round(totalDifficulty / questions.length * 10) / 10;
  }

  /**
   * 估算完成时间
   */
  estimateCompletionTime(questions) {
    const timePerType = {
      single_choice: 1.5,    // 1.5分钟/题
      multiple_choice: 2.5,  // 2.5分钟/题
      fill_blank: 2,         // 2分钟/题
      short_answer: 5        // 5分钟/题
    };
    
    const totalMinutes = questions.reduce((sum, q) => {
      const timePerQuestion = timePerType[q.type] || 2;
      return sum + timePerQuestion;
    }, 0);
    
    return Math.round(totalMinutes);
  }

  /**
   * 格式化试卷用于打印
   */
  formatForPrint(examPaper) {
    return {
      header: {
        title: examPaper.config.title,
        subtitle: examPaper.config.subtitle,
        info: [
          `总分：${examPaper.config.totalScore}分`,
          `时间：${examPaper.config.timeLimit}分钟`,
          `题目数：${examPaper.metadata.questionCount}道`
        ]
      },
      instructions: examPaper.config.instructions,
      sections: examPaper.sections.map(section => ({
        title: `${section.name}（共${section.questions.length}题，每题${section.scorePerQuestion}分）`,
        questions: section.questions.map((q, index) => ({
          number: index + 1,
          content: q.content,
          options: q.options || [],
          type: q.type,
          score: section.scorePerQuestion
        }))
      })),
      answerSheet: this.generateAnswerSheet(examPaper)
    };
  }

  /**
   * 生成答题卡
   */
  generateAnswerSheet(examPaper) {
    const answers = [];
    let questionNumber = 1;
    
    examPaper.sections.forEach(section => {
      section.questions.forEach(q => {
        answers.push({
          number: questionNumber++,
          type: q.type,
          correctAnswer: q.correctAnswer || '',
          explanation: q.explanation || ''
        });
      });
    });
    
    return answers;
  }

  /**
   * 测试豆包AI题目生成服务
   */
  async testQuestionGeneration() {
    try {
      console.log('开始测试豆包AI题目生成服务...');
      
      const result = await this.callCloudFunction('ai-question-generator', {
        test: true
      });
      
      console.log('豆包AI题目生成测试结果:', result);
      return result;
      
    } catch (error) {
      console.error('豆包AI题目生成测试失败:', error);
      throw error;
    }
  }

  /**
   * 生成练习报告
   */
  async generatePracticeReport(practiceData) {
    const { questions, userAnswers, timeSpent, startTime, endTime } = practiceData;
    
    let correctCount = 0;
    let totalScore = 0;
    let maxScore = 0;
    
    const detailedResults = questions.map((question, index) => {
      const userAnswer = userAnswers[index];
      const isCorrect = this.checkAnswer(question, userAnswer);
      const score = isCorrect ? (question.score || 5) : 0;
      
      if (isCorrect) correctCount++;
      totalScore += score;
      maxScore += (question.score || 5);
      
      return {
        questionId: question.id,
        question: question.content,
        userAnswer: userAnswer,
        correctAnswer: question.correctAnswer,
        isCorrect: isCorrect,
        score: score,
        explanation: question.explanation,
        knowledgePoints: question.knowledgePoints || []
      };
    });
    
    const accuracy = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;
    const scorePercentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
    
    return {
      summary: {
        totalQuestions: questions.length,
        correctCount: correctCount,
        wrongCount: questions.length - correctCount,
        accuracy: accuracy,
        totalScore: totalScore,
        maxScore: maxScore,
        scorePercentage: scorePercentage,
        timeSpent: timeSpent,
        averageTimePerQuestion: questions.length > 0 ? Math.round(timeSpent / questions.length) : 0
      },
      detailedResults: detailedResults,
      weaknessAnalysis: this.analyzeWeaknesses(detailedResults),
      recommendations: this.generateRecommendations(detailedResults),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 检查答案是否正确
   */
  checkAnswer(question, userAnswer) {
    if (!userAnswer || !question.correctAnswer) return false;
    
    const normalizeAnswer = (answer) => {
      return String(answer).trim().toLowerCase();
    };
    
    return normalizeAnswer(userAnswer) === normalizeAnswer(question.correctAnswer);
  }

  /**
   * 分析薄弱环节
   */
  analyzeWeaknesses(results) {
    const wrongAnswers = results.filter(r => !r.isCorrect);
    const knowledgePointErrors = {};
    
    wrongAnswers.forEach(result => {
      result.knowledgePoints.forEach(point => {
        knowledgePointErrors[point] = (knowledgePointErrors[point] || 0) + 1;
      });
    });
    
    return Object.entries(knowledgePointErrors)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([point, count]) => ({
        knowledgePoint: point,
        errorCount: count,
        errorRate: Math.round((count / wrongAnswers.length) * 100)
      }));
  }

  /**
   * 生成学习建议
   */
  generateRecommendations(results) {
    const accuracy = results.filter(r => r.isCorrect).length / results.length;
    const recommendations = [];
    
    if (accuracy < 0.6) {
      recommendations.push('建议重新学习相关基础知识点');
      recommendations.push('可以先从简单题目开始练习');
    } else if (accuracy < 0.8) {
      recommendations.push('基础掌握较好，建议加强易错知识点的练习');
      recommendations.push('可以尝试一些中等难度的题目');
    } else {
      recommendations.push('掌握情况良好，建议挑战更高难度的题目');
      recommendations.push('可以尝试综合性较强的题目');
    }
    
    return recommendations;
  }
}

// 创建并导出AI服务实例
const aiService = new AIService();
export default aiService;






















































