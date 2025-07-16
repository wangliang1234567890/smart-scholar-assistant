/**
 * AI服务工具类
 * 包含OCR识别、题目生成、智能批改等功能
 * 优化版本：增强错误处理、重试机制、性能优化和用户反馈
 */

import { AI_CONFIG } from './constants';
import ImageProcessor from './image-processor';
import CacheManager from './cache-manager';
import ConcurrentProcessor from './concurrent-processor';

class AIService {
  constructor() {
    this.isProduction = false; // 开发模式标识
    this.mockMode = true; // 模拟模式，正式部署时设为false
    this.retryCount = 0;
    this.maxRetries = 3;
    this.retryDelay = 1000; // 初始重试延迟（毫秒）
    
    // 性能优化配置
    this.performanceConfig = {
      enableImageCompression: true,
      enableCaching: true,
      enableConcurrency: true,
      cacheTime: {
        ocr: 24 * 60 * 60 * 1000, // OCR结果缓存24小时
        questions: 60 * 60 * 1000, // 题目缓存1小时
        grading: 30 * 60 * 1000    // 批改结果缓存30分钟
      }
    };

    // 初始化性能优化组件
    this.initPerformanceComponents();
  }

  /**
   * 初始化性能优化组件
   */
  initPerformanceComponents() {
    // 设置并发限制
    ConcurrentProcessor.setLimit('ocr', 2);
    ConcurrentProcessor.setLimit('ai', 3);
    ConcurrentProcessor.setLimit('grading', 2);

    // 配置缓存
    CacheManager.setConfig({
      defaultTTL: 30 * 60 * 1000, // 30分钟
      maxMemorySize: 50 * 1024 * 1024, // 50MB
      maxStorageSize: 100 * 1024 * 1024 // 100MB
    });

    // 配置图片处理
    ImageProcessor.setGlobalConfig({
      maxSize: 2 * 1024 * 1024, // 2MB
      defaultQuality: 0.8
    });
  }

  /**
   * OCR文字识别
   * @param {string} imagePath - 图片路径
   * @param {Object} options - 识别选项
   * @returns {Promise<Object>} 识别结果
   */
  async recognizeText(imagePath, options = {}) {
    console.log('开始OCR识别:', imagePath);

    // 开发模式：使用模拟数据
    if (this.mockMode) {
      return this.mockOCRRecognition(imagePath);
    }

    // 生成缓存键
    const cacheKey = await this.generateImageCacheKey(imagePath, options);
    
    // 检查缓存
    if (this.performanceConfig.enableCaching) {
      const cachedResult = await CacheManager.get(cacheKey);
      if (cachedResult) {
        console.log('使用OCR缓存结果');
        return cachedResult;
      }
    }

    // 使用并发控制执行OCR
    const ocrTask = async () => {
      try {
        // 图片预处理和压缩
        const processedImage = await this.preprocessImageWithOptimization(imagePath);
        
        // 调用云函数进行OCR识别
        const result = await this.callCloudFunction('ocr-recognition', {
          imageBase64: processedImage.base64,
          imageFormat: processedImage.format,
          options: {
            scene: 'text', // text, math, handwriting
            language: 'zh-cn',
            ...options
          }
        });

        if (!result.success) {
          throw this.createServiceError('OCR_SERVICE_ERROR', result.error?.message || 'OCR服务调用失败', result.error);
        }

        const ocrResult = this.formatOCRResult(result);
        ocrResult.imageInfo = processedImage.info;

        // 缓存结果
        if (this.performanceConfig.enableCaching) {
          await CacheManager.set(cacheKey, ocrResult, {
            ttl: this.performanceConfig.cacheTime.ocr
          });
        }

        // 清理临时文件
        if (processedImage.needsCleanup) {
          ImageProcessor.cleanupTempFiles([processedImage.tempPath]);
        }

        return ocrResult;

      } catch (error) {
        console.error('OCR识别失败:', error);
        
        // 根据错误类型决定是否重试
        if (this.shouldRetry(error)) {
          throw error; // 让重试机制处理
        } else {
          // 不可重试的错误，直接降级
          console.log('OCR服务不可用，使用模拟数据');
          return this.mockOCRRecognition(imagePath);
        }
      }
    };

    // 使用并发处理器或直接执行
    if (this.performanceConfig.enableConcurrency) {
      return await ConcurrentProcessor.addTask('ocr', ocrTask, {
        timeout: 60000,
        retries: this.maxRetries,
        retryDelay: this.retryDelay
      });
    } else {
      return await this.executeWithRetry(ocrTask, 'OCR识别');
    }
  }

  /**
   * AI题目生成
   * @param {Object} params - 生成参数
   * @returns {Promise<Array>} 生成的题目列表
   */
  async generateQuestions(params) {
    console.log('开始AI题目生成:', params);

    const {
      subject = '数学',
      grade = 1,
      difficulty = 3,
      questionType = 'mixed',
      count = 5,
      baseQuestion = null,
      knowledgePoints = []
    } = params;

    // 开发模式：使用模拟数据
    if (this.mockMode) {
      return this.mockQuestionGeneration(params);
    }

    return this.executeWithRetry(async () => {
      try {
        // 构建AI提示词
        const prompt = this.buildQuestionPrompt({
          subject,
          grade,
          difficulty,
          questionType,
          count,
          baseQuestion,
          knowledgePoints
        });

        // 调用云函数生成题目
        const result = await this.callCloudFunction('ai-question-generator', {
          prompt,
          model: AI_CONFIG.QUESTION_GENERATION.OPENAI.MODEL,
          maxTokens: AI_CONFIG.QUESTION_GENERATION.OPENAI.MAX_TOKENS,
          temperature: AI_CONFIG.QUESTION_GENERATION.OPENAI.TEMPERATURE,
          options: params
        });

        if (!result.success) {
          throw this.createServiceError('AI_GENERATE_ERROR', result.error?.message || 'AI题目生成失败', result.error);
        }

        return this.formatQuestionResult(result);

      } catch (error) {
        console.error('AI题目生成失败:', error);
        
        // 根据错误类型决定是否重试
        if (this.shouldRetry(error)) {
          throw error; // 让重试机制处理
        } else {
          // 不可重试的错误，直接降级
          console.log('AI服务不可用，使用模拟数据');
          return this.mockQuestionGeneration(params);
        }
      }
    }, 'AI题目生成');
  }

  /**
   * 智能批改
   * @param {Object} question - 题目信息
   * @param {string} userAnswer - 用户答案
   * @param {string} standardAnswer - 标准答案
   * @returns {Promise<Object>} 批改结果
   */
  async intelligentGrading(question, userAnswer, standardAnswer) {
    console.log('开始智能批改');

    if (!userAnswer || !standardAnswer) {
      return {
        isCorrect: false,
        score: 0,
        feedback: '答案不能为空',
        analysis: ''
      };
    }

    // 开发模式：使用模拟批改
    if (this.mockMode) {
      return this.mockIntelligentGrading(question, userAnswer, standardAnswer);
    }

    return this.executeWithRetry(async () => {
      try {
        // 调用云函数进行智能批改
        const result = await this.callCloudFunction('ai-grading', {
          question: {
            type: question.type,
            content: question.content,
            subject: question.subject
          },
          userAnswer: this.preprocessAnswer(userAnswer),
          standardAnswer: this.preprocessAnswer(standardAnswer),
          gradingOptions: AI_CONFIG.AUTO_GRADING
        });

        if (!result.success) {
          throw this.createServiceError('AI_GRADING_ERROR', result.error?.message || 'AI批改失败', result.error);
        }

        return result;

      } catch (error) {
        console.error('智能批改失败:', error);
        
        // 降级策略：简单字符串比较
        return this.simpleGrading(userAnswer, standardAnswer);
      }
    }, '智能批改', 1); // 批改功能只重试1次
  }

  /**
   * 执行带重试机制的操作
   * @param {Function} operation - 要执行的操作
   * @param {string} operationName - 操作名称
   * @param {number} maxRetries - 最大重试次数
   */
  async executeWithRetry(operation, operationName, maxRetries = this.maxRetries) {
    let lastError;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await operation();
        
        // 成功时重置重试计数器
        this.retryCount = 0;
        return result;
        
      } catch (error) {
        lastError = error;
        
        // 如果是最后一次尝试或不应该重试，抛出错误
        if (attempt === maxRetries || !this.shouldRetry(error)) {
          break;
        }
        
        // 计算重试延迟（指数退避）
        const delay = this.retryDelay * Math.pow(2, attempt);
        console.log(`${operationName}失败，${delay}ms后进行第${attempt + 1}次重试:`, error.message);
        
        // 等待后重试
        await this.delay(delay);
      }
    }
    
    // 所有重试都失败了
    console.error(`${operationName}在${maxRetries + 1}次尝试后最终失败:`, lastError);
    throw lastError;
  }

  /**
   * 调用云函数的统一方法
   * @param {string} functionName - 云函数名称
   * @param {Object} data - 传递的数据
   * @returns {Promise<Object>} 云函数返回结果
   */
  async callCloudFunction(functionName, data) {
    try {
      const startTime = Date.now();
      
      const result = await wx.cloud.callFunction({
        name: functionName,
        data
      });
      
      const duration = Date.now() - startTime;
      console.log(`云函数${functionName}调用完成，耗时${duration}ms`);
      
      if (result.errMsg && result.errMsg !== 'cloud.callFunction:ok') {
        throw this.createServiceError('CLOUD_FUNCTION_ERROR', `云函数调用失败: ${result.errMsg}`);
      }
      
      return result.result;
      
    } catch (error) {
      if (error.errCode) {
        // 微信云函数错误
        const errorMessage = this.getCloudFunctionErrorMessage(error.errCode);
        throw this.createServiceError('CLOUD_FUNCTION_ERROR', errorMessage, error);
      } else {
        throw error;
      }
    }
  }

  /**
   * 判断错误是否应该重试
   * @param {Error} error - 错误对象
   * @returns {boolean} 是否应该重试
   */
  shouldRetry(error) {
    // 网络错误、超时错误、服务器错误 - 可重试
    const retryableErrors = [
      'NETWORK_ERROR',
      'TIMEOUT_ERROR',
      'SERVER_ERROR',
      'CLOUD_FUNCTION_ERROR',
      'OCR_SERVICE_ERROR',
      'AI_GENERATE_ERROR',
      'AI_GRADING_ERROR'
    ];
    
    // 权限错误、参数错误、配置错误 - 不可重试
    const nonRetryableErrors = [
      'AUTH_ERROR',
      'PERMISSION_DENIED',
      'INVALID_PARAMS',
      'CONFIG_ERROR'
    ];
    
    const errorCode = error.code || error.type;
    
    if (nonRetryableErrors.includes(errorCode)) {
      return false;
    }
    
    if (retryableErrors.includes(errorCode)) {
      return true;
    }
    
    // 默认情况下，对于网络相关错误进行重试
    return error.message.includes('网络') || 
           error.message.includes('超时') || 
           error.message.includes('连接');
  }

  /**
   * 创建标准化的服务错误
   * @param {string} code - 错误代码
   * @param {string} message - 错误消息
   * @param {Object} details - 错误详情
   * @returns {Error} 标准化错误对象
   */
  createServiceError(code, message, details = null) {
    const error = new Error(message);
    error.code = code;
    error.details = details;
    error.timestamp = Date.now();
    return error;
  }

  /**
   * 获取云函数错误消息
   * @param {number} errCode - 错误代码
   * @returns {string} 用户友好的错误消息
   */
  getCloudFunctionErrorMessage(errCode) {
    const errorMessages = {
      '-404001': '云函数不存在，请检查函数名称',
      '-404002': '云函数版本不存在',
      '-404003': '云函数运行时不存在',
      '-404004': '云函数环境不存在',
      '-601000': '云函数执行超时',
      '-601001': '云函数内存不足',
      '-601002': '云函数执行异常',
      '-601003': '云函数权限不足',
      '-601004': '云函数配置错误',
      '-601005': '云函数网络错误'
    };
    
    return errorMessages[errCode] || `云函数调用失败 (${errCode})`;
  }

  /**
   * 延迟函数
   * @param {number} ms - 延迟毫秒数
   * @returns {Promise} Promise对象
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 图片预处理
   * @param {string} imagePath - 图片路径
   * @returns {Promise<Object>} 处理后的图片数据
   */
  async preprocessImage(imagePath) {
    return new Promise((resolve, reject) => {
      wx.getFileSystemManager().readFile({
        filePath: imagePath,
        encoding: 'base64',
        success: (res) => {
          const base64 = res.data;
          const format = this.getImageFormat(imagePath);
          
          // 验证图片大小
          const size = base64.length * 0.75; // 估算文件大小
          if (size > AI_CONFIG.OCR.OPTIONS.MAX_IMAGE_SIZE) {
            reject(this.createServiceError('IMAGE_TOO_LARGE', '图片文件过大，请选择较小的图片'));
            return;
          }

          resolve({
            base64,
            format,
            size
          });
        },
        fail: (error) => {
          reject(this.createServiceError('IMAGE_READ_ERROR', '读取图片失败: ' + error.errMsg, error));
        }
      });
    });
  }

  /**
   * 模拟OCR识别
   */
  mockOCRRecognition(imagePath) {
    return new Promise((resolve) => {
      setTimeout(() => {
        const mockTexts = [
          '计算下列各题：\n(1) 25 × 4 = ?\n(2) 48 ÷ 6 = ?\n(3) 15 + 27 = ?',
          '解方程：2x + 5 = 13',
          '填空题：长方形的面积公式是_____ × _____',
          '选择题：下面哪个是质数？\nA. 4  B. 6  C. 7  D. 8',
          '应用题：小明有15个苹果，吃了3个，又买了8个，现在有多少个苹果？'
        ];

        const randomText = mockTexts[Math.floor(Math.random() * mockTexts.length)];
        
        resolve({
          success: true,
          text: randomText,
          confidence: 0.92 + Math.random() * 0.06,
          regions: [
            {
              text: randomText,
              confidence: 0.92,
              position: { x: 10, y: 10, width: 200, height: 100 }
            }
          ],
          processingTime: 1200 + Math.random() * 800
        });
      }, 1000 + Math.random() * 1000);
    });
  }

  /**
   * 模拟题目生成
   */
  mockQuestionGeneration(params) {
    return new Promise((resolve) => {
      setTimeout(() => {
        const { subject, count, difficulty } = params;
        const questions = [];

        for (let i = 0; i < count; i++) {
          if (subject === '数学') {
            questions.push(this.generateMockMathQuestion(difficulty, i));
          } else if (subject === '语文') {
            questions.push(this.generateMockChineseQuestion(difficulty, i));
          } else if (subject === '英语') {
            questions.push(this.generateMockEnglishQuestion(difficulty, i));
          } else {
            questions.push(this.generateMockMathQuestion(difficulty, i));
          }
        }

        resolve({
          success: true,
          questions,
          totalGenerated: questions.length,
          processingTime: 2000 + Math.random() * 2000
        });
      }, 1500 + Math.random() * 1500);
    });
  }

  /**
   * 生成模拟数学题目
   */
  generateMockMathQuestion(difficulty, index) {
    const mathQuestions = [
      {
        id: `math_${Date.now()}_${index}`,
        type: 'single_choice',
        content: '计算：15 + 27 = ?',
        options: [
          { label: '32', value: 'A' },
          { label: '42', value: 'B' },
          { label: '45', value: 'C' },
          { label: '52', value: 'D' }
        ],
        correctAnswer: 'B',
        explanation: '15 + 27 = 42，这是基础的加法运算。',
        knowledgePoints: ['加法运算', '两位数加法'],
        difficulty: difficulty
      },
      {
        id: `math_${Date.now()}_${index}`,
        type: 'single_choice',
        content: '9 × 8 = ?',
        options: [
          { label: '64', value: 'A' },
          { label: '72', value: 'B' },
          { label: '81', value: 'C' },
          { label: '56', value: 'D' }
        ],
        correctAnswer: 'B',
        explanation: '9 × 8 = 72，这是乘法口诀表中的内容。',
        knowledgePoints: ['乘法口诀', '乘法运算'],
        difficulty: difficulty
      },
      {
        id: `math_${Date.now()}_${index}`,
        type: 'fill_blank',
        content: '100 - 55 = ___',
        correctAnswer: '45',
        explanation: '100 - 55 = 45，这是减法运算。',
        knowledgePoints: ['减法运算', '两位数减法'],
        difficulty: difficulty
      }
    ];

    return mathQuestions[index % mathQuestions.length];
  }

  /**
   * 生成模拟语文题目
   */
  generateMockChineseQuestion(difficulty, index) {
    const chineseQuestions = [
      {
        id: `chinese_${Date.now()}_${index}`,
        type: 'single_choice',
        content: '下面哪个字的读音是正确的？',
        options: [
          { label: '读(dú)书', value: 'A' },
          { label: '读(dòu)书', value: 'B' },
          { label: '读(tú)书', value: 'C' },
          { label: '读(duò)书', value: 'D' }
        ],
        correctAnswer: 'A',
        explanation: '"读"字读作"dú"，是常用的读音。',
        knowledgePoints: ['拼音', '字音'],
        difficulty: difficulty
      }
    ];

    return chineseQuestions[index % chineseQuestions.length];
  }

  /**
   * 生成模拟英语题目
   */
  generateMockEnglishQuestion(difficulty, index) {
    const englishQuestions = [
      {
        id: `english_${Date.now()}_${index}`,
        type: 'single_choice',
        content: 'What color is the apple?',
        options: [
          { label: 'Red', value: 'A' },
          { label: 'Blue', value: 'B' },
          { label: 'Yellow', value: 'C' },
          { label: 'Green', value: 'D' }
        ],
        correctAnswer: 'A',
        explanation: 'Apple is usually red in color.',
        knowledgePoints: ['颜色词汇', '基础对话'],
        difficulty: difficulty
      }
    ];

    return englishQuestions[index % englishQuestions.length];
  }

  /**
   * 模拟智能批改
   */
  mockIntelligentGrading(question, userAnswer, standardAnswer) {
    return new Promise((resolve) => {
      setTimeout(() => {
        const userClean = this.preprocessAnswer(userAnswer);
        const standardClean = this.preprocessAnswer(standardAnswer);
        
        const isExactMatch = userClean === standardClean;
        const similarity = this.calculateSimilarity(userClean, standardClean);
        
        let isCorrect = isExactMatch || similarity > 0.8;
        let score = isCorrect ? 100 : Math.max(0, Math.floor(similarity * 100));
        let feedback = '';
        
        if (isCorrect) {
          feedback = '回答正确！';
        } else if (similarity > 0.5) {
          feedback = '答案基本正确，但有些细节需要注意。';
        } else {
          feedback = '答案不正确，请重新思考。';
        }

        resolve({
          isCorrect,
          score,
          feedback,
          similarity,
          analysis: this.generateAnalysis(question, userAnswer, standardAnswer, isCorrect)
        });
      }, 500 + Math.random() * 500);
    });
  }

  /**
   * 简单批改（降级策略）
   */
  simpleGrading(userAnswer, standardAnswer) {
    const userClean = this.preprocessAnswer(userAnswer);
    const standardClean = this.preprocessAnswer(standardAnswer);
    const isCorrect = userClean === standardClean;

    return {
      isCorrect,
      score: isCorrect ? 100 : 0,
      feedback: isCorrect ? '回答正确！' : '答案不正确',
      analysis: ''
    };
  }

  /**
   * 预处理答案
   */
  preprocessAnswer(answer) {
    if (!answer) return '';
    
    return answer
      .toString()
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ') // 标准化空格
      .replace(/[，。！？；：]/g, match => {
        // 中文标点转英文
        const map = { '，': ',', '。': '.', '！': '!', '？': '?', '；': ';', '：': ':' };
        return map[match] || match;
      });
  }

  /**
   * 计算相似度
   */
  calculateSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;
    if (str1 === str2) return 1;

    const len1 = str1.length;
    const len2 = str2.length;
    const maxLen = Math.max(len1, len2);

    if (maxLen === 0) return 1;

    // 简单的字符相似度计算
    let matches = 0;
    const minLen = Math.min(len1, len2);

    for (let i = 0; i < minLen; i++) {
      if (str1[i] === str2[i]) {
        matches++;
      }
    }

    return matches / maxLen;
  }

  /**
   * 生成分析报告
   */
  generateAnalysis(question, userAnswer, standardAnswer, isCorrect) {
    if (isCorrect) {
      return `回答正确！标准答案是：${standardAnswer}`;
    } else {
      return `你的答案：${userAnswer}\n标准答案：${standardAnswer}\n建议：请检查计算过程和答案格式。`;
    }
  }

  /**
   * 构建题目生成提示词
   */
  buildQuestionPrompt(params) {
    const { subject, grade, difficulty, questionType, count, baseQuestion, knowledgePoints } = params;
    
    let prompt = `请生成${count}道${subject}题目，适合${grade}年级学生，难度等级${difficulty}（1-5级）。`;
    
    if (questionType !== 'mixed') {
      prompt += `题目类型：${questionType}。`;
    }
    
    if (baseQuestion) {
      prompt += `请基于以下错题生成变式题目：${baseQuestion}`;
    }
    
    if (knowledgePoints.length > 0) {
      prompt += `涉及知识点：${knowledgePoints.join('、')}。`;
    }
    
    prompt += `
    请按以下JSON格式返回：
    {
      "questions": [
        {
          "type": "single_choice", // single_choice, multiple_choice, fill_blank, solve
          "content": "题目内容",
          "options": [{"label": "选项A", "value": "A"}], // 选择题需要
          "correctAnswer": "正确答案",
          "explanation": "详细解析",
          "knowledgePoints": ["知识点1", "知识点2"],
          "difficulty": 3
        }
      ]
    }`;
    
    return prompt;
  }

  /**
   * 格式化OCR结果
   */
  formatOCRResult(result) {
    return {
      success: true,
      text: result.text || '',
      confidence: result.confidence || 0,
      regions: result.regions || [],
      processingTime: result.processingTime || 0
    };
  }

  /**
   * 格式化题目生成结果
   */
  formatQuestionResult(result) {
    return {
      success: true,
      questions: result.questions || [],
      totalGenerated: result.questions?.length || 0,
      processingTime: result.processingTime || 0
    };
  }

  /**
   * 获取图片格式
   */
  getImageFormat(imagePath) {
    const ext = imagePath.split('.').pop().toLowerCase();
    const formatMap = {
      'jpg': 'jpeg',
      'jpeg': 'jpeg',
      'png': 'png',
      'bmp': 'bmp'
    };
    return formatMap[ext] || 'jpeg';
  }

  /**
   * 统一错误处理
   */
  handleError(error, defaultMessage) {
    return new Error(defaultMessage + ': ' + (error.message || error.toString()));
  }

  /**
   * 设置生产模式
   */
  setProductionMode(isProduction) {
    this.isProduction = isProduction;
    this.mockMode = !isProduction;
  }

  /**
   * 获取服务状态
   */
  getServiceStatus() {
    return {
      isProduction: this.isProduction,
      mockMode: this.mockMode,
      retryCount: this.retryCount,
      maxRetries: this.maxRetries,
      performanceConfig: this.performanceConfig
    };
  }

  /**
   * 生成图片缓存键
   * @param {string} imagePath - 图片路径
   * @param {Object} options - 选项
   * @returns {Promise<string>} 缓存键
   */
  async generateImageCacheKey(imagePath, options = {}) {
    try {
      // 获取图片的基本信息作为缓存键的一部分
      const imageInfo = await ImageProcessor.getImageInfo(imagePath);
      const keyData = {
        path: imagePath,
        size: imageInfo.size,
        width: imageInfo.width,
        height: imageInfo.height,
        options: JSON.stringify(options)
      };
      
      // 生成简单的哈希
      const keyString = JSON.stringify(keyData);
      const hash = this.simpleHash(keyString);
      
      return `ocr_${hash}`;
    } catch (error) {
      // 如果无法获取图片信息，使用路径和选项作为缓存键
      const fallbackKey = `ocr_${this.simpleHash(imagePath + JSON.stringify(options))}`;
      return fallbackKey;
    }
  }

  /**
   * 带优化的图片预处理
   * @param {string} imagePath - 图片路径
   * @returns {Promise<Object>} 处理后的图片数据
   */
  async preprocessImageWithOptimization(imagePath) {
    try {
      let processedPath = imagePath;
      let needsCleanup = false;
      let tempPath = null;

      // 如果启用图片压缩，先进行压缩
      if (this.performanceConfig.enableImageCompression) {
        const compressionResult = await ImageProcessor.compressImage(imagePath, 
          ImageProcessor.getRecommendedSettings('document')
        );
        
        if (compressionResult.success && compressionResult.needsCompression) {
          processedPath = compressionResult.compressedPath;
          needsCleanup = true;
          tempPath = compressionResult.compressedPath;
          
          console.log(`图片压缩完成: ${(compressionResult.originalSize / 1024).toFixed(1)}KB -> ${(compressionResult.compressedSize / 1024).toFixed(1)}KB`);
        }
      }

      // 读取处理后的图片
      const imageData = await this.preprocessImage(processedPath);
      
      return {
        ...imageData,
        needsCleanup,
        tempPath,
        info: {
          originalPath: imagePath,
          processedPath,
          compressed: needsCleanup
        }
      };

    } catch (error) {
      console.error('图片预处理失败:', error);
      throw error;
    }
  }

  /**
   * 简单哈希函数
   * @param {string} str - 要哈希的字符串
   * @returns {string} 哈希值
   */
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * 获取性能统计信息
   * @returns {Promise<Object>} 性能统计
   */
  async getPerformanceStats() {
    const cacheStats = await CacheManager.getStats();
    const queueStats = ConcurrentProcessor.getAllQueueStatus();
    
    return {
      cache: cacheStats,
      concurrency: queueStats,
      config: this.performanceConfig,
      service: this.getServiceStatus()
    };
  }

  /**
   * 清理缓存和临时文件
   * @returns {Promise<void>}
   */
  async cleanup() {
    if (this.performanceConfig.enableCaching) {
      // 清理过期缓存
      await CacheManager.clear();
    }
    
    // 清理并发处理器
    ConcurrentProcessor.clearAllQueues();
    
    console.log('AI服务清理完成');
  }

  /**
   * 设置性能配置
   * @param {Object} config - 性能配置
   */
  setPerformanceConfig(config) {
    this.performanceConfig = {
      ...this.performanceConfig,
      ...config
    };
    
    // 重新初始化组件
    this.initPerformanceComponents();
  }
}

// 导出单例
export default new AIService(); 