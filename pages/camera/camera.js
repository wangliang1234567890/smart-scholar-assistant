// pages/camera/camera.js
import AIService from '../../utils/ai-service';
import { formatTime } from '../../utils/util';
import DatabaseManager from '../../utils/database.js';

Page({
  data: {
    // 相机状态
    cameraReady: false,
    
    // 界面状态
    showCropping: false,
    showAnalyzing: false,
    
    // 图片相关
    originalImagePath: '',
    croppedImagePath: '',
    
    // 裁剪相关
    cropArea: { x: 0, y: 0, width: 0, height: 0 },
    imageDisplaySize: { width: 0, height: 0 },
    isDragging: false,
    
    // 相机设置
    devicePosition: 'back',
    flash: 'off',
    
    // AI分析状态
    progressStep: 0,
    processingStatus: '正在初始化...'
  },

  onLoad(options) {
    console.log('Camera page initialized');
    
    // ❌ 删除或注释掉自动测试
    // this.autoTestCloudFunction();
  },

  onShow() {
    console.log('Camera page show');
    
    // ❌ 删除或注释掉自动测试
    // this.autoTestCloudFunction();
  },

  onHide() {
    this.cleanupAllResources();
  },

  onUnload() {
    console.log('Camera page unloading, cleaning up resources...');
    this.cleanupAllResources();
  },

  /**
   * 初始化页面
   */
  initPage() {
    // 获取系统信息
    this.getSystemInfo();

    // 初始化相机
    this.initCamera();
    
    // 检查权限
    this.checkPermissions();
    
    // 设置AI服务模式
    AIService.setProductionMode(false);
    
    // 添加调试模式检测
    this.setData({
      isDevelopment: true // 开发模式，显示调试按钮
    });
    
    console.log('Camera page initialized');
    
    // 自动测试云函数连接（可选）
    this.autoTestConnection();
  },

  /**
   * 获取系统信息
   */
  getSystemInfo() {
      const systemInfo = wx.getSystemInfoSync();
    const screenWidth = systemInfo.screenWidth;
    const screenHeight = systemInfo.screenHeight;
      
    // 计算相机框尺寸
    const frameWidth = Math.min(screenWidth * 0.8, 350);
    const frameHeight = frameWidth * 0.6;
      
      this.setData({
        cameraFrameSize: {
          width: frameWidth,
        height: frameHeight
        }
      });
  },

  /**
   * 页面加载完成
   */
  onReady() {
    console.log('Camera page ready');
    this.initCamera();
  },

  /**
   * 初始化相机
   */
  initCamera() {
    try {
      console.log('开始初始化相机...');
      
      // 创建相机上下文
      this.cameraContext = wx.createCameraContext();
      
      if (!this.cameraContext) {
        throw new Error('创建相机上下文失败');
      }
      
      console.log('相机上下文创建成功');
      
      // 设置相机初始化完成标志
      this.setData({
        cameraReady: true
      });
      
      console.log('相机初始化完成');
      
    } catch (error) {
      console.error('相机初始化失败:', error);
      wx.showToast({
        title: '相机初始化失败',
        icon: 'none'
      });
    }
  },

  /**
   * 相机初始化完成回调
   */
  onCameraReady() {
    console.log('相机准备就绪');
    this.setData({
      cameraReady: true
    });
  },

  /**
   * 相机错误回调
   */
  onCameraError(e) {
    console.error('相机错误:', e.detail);
    wx.showModal({
      title: '相机错误',
      content: '相机启动失败，请检查相机权限或重新进入页面',
      showCancel: false
    });
  },

  /**
   * 相机停止回调
   */
  onCameraStop() {
    console.log('相机已停止');
    this.setData({
      cameraReady: false
    });
  },

  /**
   * 重置页面状态
   */
  resetPageState() {
    this.setData({
      showPreview: false,
      showAnalyzing: false,
      showResultModal: false,
      hasError: false,
      errorMessage: '',
      progressStep: 0,
      processingStatus: '准备开始识别...'
    });
  },

  /**
   * 清理所有资源
   */
  cleanupAllResources() {
    // 清理所有定时器
    this.clearAllTimers();
    
    // 清理图片缓存
    this.clearImageCache();
    
    // 清理事件监听
    this.cleanupEventListeners();
    
    // 清理相机上下文
    if (this.cameraContext) {
      this.cameraContext = null;
    }
  },

  /**
   * 清理所有定时器
   */
  clearAllTimers() {
    const timers = ['statusTimer', 'progressTimer', 'retryTimer', 'cleanupTimer'];
    
    timers.forEach(timerName => {
      if (this[timerName]) {
        if (timerName.includes('Interval')) {
          clearInterval(this[timerName]);
        } else {
          clearTimeout(this[timerName]);
        }
        this[timerName] = null;
        console.log(`已清理定时器: ${timerName}`);
      }
    });
  },

  /**
   * 清理图片缓存
   */
  clearImageCache() {
    const imagePaths = [
      this.data.previewImagePath,
      this.data.originalImagePath,
      this.data.croppedImagePath
    ];
    
    imagePaths.forEach(path => {
      if (path && path.includes('temp')) {
        try {
          wx.getFileSystemManager().unlinkSync(path);
          console.log('已清理图片缓存:', path);
        } catch (error) {
          console.warn('清理图片缓存失败:', error);
        }
      }
    });
  },

  /**
   * 清理事件监听
   */
  cleanupEventListeners() {
    // 清理裁剪相关的事件监听
    this.cleanupCropEvents();
  },

  /**
   * 清理裁剪事件
   */
  cleanupCropEvents() {
    // 如果有绑定的触摸事件，在这里清理
    if (this.cropTouchHandler) {
      this.cropTouchHandler = null;
    }
  },

  /**
   * 返回上一页
   */
  onBack() {
    wx.navigateBack();
  },

  /**
   * 拍照
   */
  async takePhoto() {
    if (!this.cameraContext) {
      this.showError('相机未初始化');
      return;
    }

    wx.vibrateShort();
    
    try {
      // 显示加载状态
      wx.showLoading({
        title: '正在拍照...',
        mask: true
      });

      const result = await this.capturePhoto();
      
      wx.hideLoading();
      
      if (result.tempImagePath) {
        // 拍照成功，进入裁剪界面
        this.setData({
          originalImagePath: result.tempImagePath,
          previewImagePath: result.tempImagePath,
          showCropping: true
        });
        
        // 初始化裁剪区域
        this.initCropArea(result.tempImagePath);
      } else {
        this.showError('拍照失败，请重试');
      }

    } catch (error) {
      wx.hideLoading();
      console.error('拍照失败:', error);
      this.showError('拍照失败: ' + error.message);
    }
  },

  /**
   * 捕获照片
   */
  capturePhoto() {
    return new Promise((resolve, reject) => {
      this.cameraContext.takePhoto({
        quality: 'high',
        success: (res) => {
          resolve(res);
        },
        fail: (error) => {
          reject(new Error('拍照失败: ' + error.errMsg));
        }
      });
    });
  },

     /**
    * 开始AI识别 - 优化版
    */
   async startAnalyzing(imagePath, options = {}) {
    try {
      console.log('🤖 开始AI分析:', imagePath);
      
      // 重置进度
      this.setData({
        progressStep: 0,
        processingStatus: '正在预处理图像...'
      });
      
      // 开始进度更新
      this.startProgressUpdate();
      
      // 图片质量检查
      console.log('📋 开始图片质量检查...');
      const imageValid = await this.validateImage(imagePath);
      if (!imageValid.valid) {
        throw new Error(imageValid.message);
      }
      console.log('✅ 图片质量检查通过');
      
      this.updateProgress(1, '正在压缩图片...');
      
      // 调用AI服务进行图片分析
      console.log('🔍 开始调用AI服务...');
      const aiService = getApp().globalData.aiService;
      
      if (!aiService) {
        throw new Error('AI服务未初始化');
      }
      
      console.log('📤 调用AI分析接口...');
      const ocrResult = await aiService.analyzeQuestionFromImage(imagePath, {
        enhanceAccuracy: true,
        detectQuestionType: true,
        cropOptimized: options.cropOptimized || false,
        ...options
      });
      
      console.log('📥 AI分析结果:', ocrResult);
      
      this.updateProgress(3, '正在分析题目结构...');
      
      // 处理识别结果
      await this.processOCRResult(ocrResult);
      
      this.updateProgress(4, '识别完成！');

      setTimeout(() => {
        this.setData({
          showAnalyzing: false,
          showPreview: true,  // 显示预览确认页面
          recognizedQuestion: ocrResult.text,
          hasValidQuestion: true
        });
      }, 1000);
      
    } catch (error) {
      console.error('❌ AI识别失败:', error);
      this.handleAnalyzingError(error);
    }
  },

  /**
   * 验证图片质量
   */
  async validateImage(imagePath) {
    // 直接放行，不再检查分辨率
    return { valid: true };
  },

  /**
   * 获取图片信息
   */
  getImageInfo(imagePath) {
    return new Promise((resolve, reject) => {
      wx.getImageInfo({
        src: imagePath,
        success: resolve,
        fail: reject
      });
    });
  },

  /**
   * 处理OCR识别结果 - 修复版
   */
  async processOCRResult(result) {
    console.log('📝 处理OCR结果:', result);
    
    if (!result || !result.success) {
      throw new Error(result?.error?.message || '识别结果无效');
    }
    
    // 检查识别文本
    const recognizedText = result.text || result.recognizedText || '';
    if (!recognizedText.trim()) {
      throw new Error('未识别到文字内容');
    }
    
    try {
      // 上传图片到云存储
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath: `ocr-images/${Date.now()}.jpg`,
        filePath: this.data.croppedImagePath || this.data.originalImagePath
      });
      
      // 🔧 修复：直接保存到错题本，而不是只跳转
      const mistakeData = {
        userId: DatabaseManager.getCurrentUserId(), // 修复：添加缺失的userId
        question: recognizedText,
        subject: result.subject || '未知',
        difficulty: result.difficulty || 3,
        myAnswer: '', // 用户可以后续编辑
        correctAnswer: '', // 用户可以后续编辑
        analysis: result.analysis || '',
        imageUrl: uploadRes.fileID,
        tags: [],
        source: 'camera_ocr',
        questionType: result.questionType || 'unknown',
        confidence: result.confidence || 0
      };
      
      // 保存到数据库
      console.log('💾 开始保存错题数据:', mistakeData);
      const saveResult = await DatabaseManager.saveMistake(mistakeData);

      if (saveResult.success) {
        console.log('✅ 错题保存成功:', saveResult.data._id);
        console.log('📋 保存结果详情:', saveResult);
        
        // 显示成功提示
        wx.showToast({
          title: '识别并保存成功',
          icon: 'success',
          duration: 2000
        });
        
        // 🔧 添加详细的跳转调试
        const targetUrl = `/pages/mistakes/detail?id=${saveResult.data._id}&source=camera`;
        console.log('🚀 准备跳转，完整路径:', targetUrl);
        console.log('🚀 错题ID:', saveResult.data._id);
        console.log('🚀 当前时间:', new Date().toISOString());
        
        // 优化：保存成功后提供更好的用户引导
        wx.showModal({
          title: '保存成功',
          content: '题目已添加到错题本，是否立即查看详情？',
          confirmText: '查看详情',
          cancelText: '继续拍照',
          success: (res) => {
            if (res.confirm) {
              wx.redirectTo({
                url: targetUrl
              });
            } else {
              this.resetToCamera();
            }
          }
        });
        
      } else {
        console.error('❌ 保存失败:', saveResult);
        throw new Error(saveResult.message || '保存失败');
      }
      
    } catch (error) {
      console.error('❌ 保存错题失败:', error);
      
      // 保存失败时，仍然跳转到结果页面让用户手动保存
      const app = getApp();
      app.globalData.lastOCRResult = {
        ocrResult: {
          text: recognizedText,
          confidence: result.confidence || 0,
          questionType: result.questionType || 'unknown',
          subject: result.subject || 'unknown',
          difficulty: result.difficulty || 1
        },
        imagePath: this.data.croppedImagePath || this.data.originalImagePath,
        sourceType: 'camera'
      };
      
      wx.showModal({
        title: '自动保存失败',
        content: '识别成功但保存失败，将跳转到结果页面，您可以手动保存',
        showCancel: false,
        success: () => {
          wx.navigateTo({
            url: `/pages/result/result?manual=true`
          });
        }
      });
    }
  },

  /**
   * 自动填充题目数据
   */
  autoFillQuestionData(structuredData) {
    if (structuredData.question) {
      this.setData({
        'questionData.content': structuredData.question,
        'questionData.type': this.data.questionType,
        'questionData.options': structuredData.options || [],
        'questionData.correctAnswer': structuredData.correctAnswer || ''
      });
    }
  },

  /**
   * 生成练习题
   */
  async generatePracticeQuestions() {
    if (!this.data.hasValidQuestion) {
      wx.showToast({
        title: '请先识别有效题目',
        icon: 'none'
      });
      return;
    }
    
    try {
      wx.showLoading({ title: '正在生成练习题...' });
      
      const errorQuestion = {
        content: this.data.recognizedQuestion,
        type: this.data.questionType,
        subject: this.data.subject,
        difficulty: 3, // 默认中等难度
        structuredData: this.data.structuredData
      };
      
      const result = await getApp().globalData.aiService.generatePracticeQuestions(errorQuestion, {
        count: 3,
        types: ['single_choice', 'fill_blank']
      });
      
      wx.hideLoading();
      
      if (result.success && result.questions) {
        // 跳转到练习题页面
        wx.navigateTo({
          url: `/pages/practice/practice?questions=${encodeURIComponent(JSON.stringify(result.questions))}`
        });
      } else {
        throw new Error('练习题生成失败');
      }
      
    } catch (error) {
      wx.hideLoading();
      console.error('生成练习题失败:', error);
      wx.showToast({
        title: '生成失败，请重试',
        icon: 'none'
      });
    }
  },

  /**
   * 开始进度更新
   */
  startProgressUpdate() {
    // 清除之前的定时器
    if (this.progressTimer) {
      clearInterval(this.progressTimer);
    }
    
    // 模拟进度更新
    this.progressTimer = setInterval(() => {
      const currentStep = this.data.progressStep;
      if (currentStep < 3) {
        this.setData({
          progressStep: currentStep + 0.1
        });
      }
    }, 500);
  },

  /**
   * 更新进度
   */
  updateProgress(step, status) {
    console.log('📊 进度更新:', `${step}/4 - ${status}`);
    
    this.setData({
      progressStep: step,
      processingStatus: status
    });
    
    // 🔧 如果是最后一步，确保隐藏加载状态
    if (step >= 4) {
      setTimeout(() => {
        this.setData({
          showAnalyzing: false,
          isProcessing: false,
          showProgress: false
        });
        wx.hideLoading();
      }, 500); // 延迟500ms让用户看到完成状态
    }
  },

  /**
   * 停止进度更新
   */
  stopProgressUpdate() {
    if (this.statusTimer) {
      clearTimeout(this.statusTimer);
      this.statusTimer = null;
    }
  },

  /**
   * 处理AI分析错误
   */
  handleAnalyzingError(error) {
    console.error('🚨 处理AI分析错误:', error);
    
    // 清除定时器
    if (this.progressTimer) {
      clearInterval(this.progressTimer);
      this.progressTimer = null;
    }
    
    // 隐藏加载状态
    wx.hideLoading();
    
    // 更新界面状态
    this.setData({
      showAnalyzing: false,
      hasError: true,
      errorMessage: error.message || '识别失败，请重试'
    });
    
    // 显示错误提示
    wx.showModal({
      title: '识别失败',
      content: error.message || '图片识别失败，请重试',
      showCancel: true,
      cancelText: '重新拍照',
      confirmText: '重试',
      success: (res) => {
        if (res.confirm) {
          // 重试分析
          this.retryAnalysis();
        } else {
          // 返回相机界面
          this.resetToCamera();
        }
      }
    });
  },

  /**
   * 重试分析
   */
  async retryAnalysis() {
    const { croppedImagePath } = this.data;
    if (croppedImagePath) {
      console.log('🔄 重试AI分析...');
      this.setData({
        showAnalyzing: true,
        hasError: false,
        errorMessage: ''
      });
      await this.startAnalyzing(croppedImagePath, { cropOptimized: true });
    } else {
      this.resetToCamera();
    }
  },

  /**
   * 重置到相机界面
   */
  resetToCamera() {
    console.log('🔄 重置到相机界面');
    this.setData({
      showCropping: false,
      showAnalyzing: false,
      showPreview: false,
      hasError: false,
      errorMessage: '',
      originalImagePath: '',
      croppedImagePath: '',
      progressStep: 0,
      processingStatus: '准备开始识别...'
    });
  },

  /**
   * 增强的错误处理 - 添加恢复选项
   */
  showErrorWithRecovery(error, recoveryOptions = {}) {
    console.error('显示错误恢复界面:', error);
    
    let errorMessage = '识别失败';
    let errorDetail = '';
    let suggestions = [];
    
    // 根据错误类型提供具体建议
    if (error.message.includes('图片文件过大')) {
      errorMessage = '图片文件过大';
      errorDetail = '建议使用裁剪功能精确选择题目区域';
      suggestions = [
        { text: '重新裁剪', action: 'recrop', icon: '✂️' },
        { text: '重新拍照', action: 'retake', icon: '📷' },
        { text: '从相册选择', action: 'album', icon: '🖼️' }
      ];
    } else if (error.message.includes('网络')) {
      errorMessage = '网络连接异常';
      errorDetail = '请检查网络连接后重试';
      suggestions = [
        { text: '重试识别', action: 'retry', icon: '🔄' },
        { text: '重新拍照', action: 'retake', icon: '📷' }
      ];
    } else {
      errorMessage = 'AI识别失败';
      errorDetail = error.message || '未知错误';
      suggestions = [
        { text: '重试识别', action: 'retry', icon: '🔄' },
        { text: '重新裁剪', action: 'recrop', icon: '✂️' },
        { text: '重新拍照', action: 'retake', icon: '📷' }
      ];
    }
    
    // 显示错误恢复弹窗
    this.setData({
      showErrorRecovery: true,
      errorInfo: {
        title: errorMessage,
        detail: errorDetail,
        suggestions: suggestions,
        recoveryOptions: recoveryOptions
      }
    });
  },

  /**
   * 执行错误恢复操作
   */
  executeRecoveryAction(action) {
    const { recoveryOptions } = this.data.errorInfo;
    
    // 隐藏错误弹窗
    this.setData({ showErrorRecovery: false });
    
    switch (action) {
      case 'retry':
        if (recoveryOptions.retry) {
          recoveryOptions.retry();
        } else if (this.data.previewImagePath) {
          this.startAnalyzing(this.data.previewImagePath);
        }
        break;
        
      case 'recrop':
        if (recoveryOptions.recrop) {
          recoveryOptions.recrop();
        } else {
          this.switchToStep('crop');
        }
        break;
        
      case 'retake':
        if (recoveryOptions.retake) {
          recoveryOptions.retake();
        } else {
          this.switchToStep('camera');
        }
        break;
        
      case 'album':
        this.chooseFromAlbum();
        break;
        
      default:
        console.warn('未知的恢复操作:', action);
    }
  },

  /**
   * 真实进度更新 - 替换假进度条
   */
  startRealProgressUpdate() {
    this.setData({
      progressStep: 0,
      progressPercent: 0,
      processingStatus: '正在预处理图像...'
    });
  },

  /**
   * 更新真实进度
   */
  updateRealProgress(step, message, progress) {
    const progressPercent = Math.min(Math.max(progress || 0, 0), 100);
    
    this.setData({
      progressStep: step,
      progressPercent: progressPercent,
      processingStatus: message,
      progressRotation: (progressPercent / 100) * 360
    });
    
    console.log(`进度更新: ${progressPercent}% - ${message}`);
  },

  /**
   * 显示错误提示弹窗
   */
  showErrorModal(title, detail, suggestions) {
    const suggestionText = suggestions.length > 0 ? 
      '\n\n解决建议：\n' + suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n') : '';
    
    wx.showModal({
      title: title,
      content: detail + suggestionText,
      showCancel: true,
      cancelText: '取消',
      confirmText: '重试',
      success: (res) => {
        if (res.confirm && this.data.showRetry) {
          // 重新开始识别
          this.retryAnalysis();
        } else {
          // 返回拍照界面
          this.resetToCamera();
        }
             }
     });
   },

   /**
    * 重试分析
    */
   retryAnalysis() {
    if (this.data.previewImagePath) {
      this.setData({
        showAnalyzing: true,
        hasError: false,
        errorMessage: '',
        progressStep: 0
      });
      this.startAnalyzing(this.data.previewImagePath);
         } else {
       this.resetToCamera();
     }
   },

   /**
    * 重置到拍照界面
    */
      resetToCamera() {
     this.setData({
       showPreview: false,
       showAnalyzing: false,
       showCropping: false,
       hasError: false,
       errorMessage: '',
       previewImagePath: '',
       originalImagePath: '',
       croppedImagePath: '',
       recognizedQuestion: '',
       ocrResult: null,
       analysisResult: null,
       progressStep: 0,
       cropArea: { x: 0, y: 0, width: 0, height: 0 },
       imageDisplaySize: { width: 0, height: 0 },
       isDragging: false,
       dragStartArea: null,
       resizeType: null,
       resizeDirection: null,
       containerRect: null
     });
   },

   /**
    * 初始化裁剪区域 - 修复坐标映射
    */
   async initCropArea() {
     try {
       const { originalImagePath } = this.data;
       if (!originalImagePath) return;

       const imageInfo = await this.getImageInfo(originalImagePath);
       const system = wx.getSystemInfoSync();
       
       // ✅ 获取图片容器的实际位置和尺寸
       const query = wx.createSelectorQuery();
       query.select('.crop-image-container').boundingClientRect();
       
       const containerInfo = await new Promise((resolve) => {
         query.exec((res) => resolve(res[0]));
       });
       
       if (!containerInfo) {
         console.error('无法获取图片容器信息');
         return;
       }
       
       // ✅ 计算图片在容器中的实际显示尺寸和位置
       const containerWidth = containerInfo.width;
       const containerHeight = containerInfo.height;
       
       const imageRatio = imageInfo.width / imageInfo.height;
       const containerRatio = containerWidth / containerHeight;
       
       let displayWidth, displayHeight, offsetX = 0, offsetY = 0;
       
       if (imageRatio > containerRatio) {
         // 图片更宽，以容器宽度为准
         displayWidth = containerWidth;
         displayHeight = containerWidth / imageRatio;
         offsetY = (containerHeight - displayHeight) / 2;
       } else {
         // 图片更高，以容器高度为准
         displayHeight = containerHeight;
         displayWidth = containerHeight * imageRatio;
         offsetX = (containerWidth - displayWidth) / 2;
       }
       
       // ✅ 初始裁剪区域：占图片显示区域的80%，居中
       const cropWidth = displayWidth * 0.8;
       const cropHeight = displayHeight * 0.6;
       const cropX = offsetX + (displayWidth - cropWidth) / 2;
       const cropY = offsetY + (displayHeight - cropHeight) / 2;
       
       this.setData({
         imageDisplaySize: {
           width: displayWidth,
           height: displayHeight
         },
         imageOffset: {
           x: offsetX,
           y: offsetY
         },
         containerSize: {
           width: containerWidth,
           height: containerHeight
         },
         cropArea: {
           x: cropX,
           y: cropY,
           width: cropWidth,
           height: cropHeight
         }
       });
       
       console.log('✅ 裁剪区域初始化完成:', {
         容器尺寸: `${containerWidth}x${containerHeight}`,
         图片显示尺寸: `${displayWidth}x${displayHeight}`,
         图片偏移: `${offsetX},${offsetY}`,
         裁剪区域: `${cropX},${cropY} ${cropWidth}x${cropHeight}`
       });
       
     } catch (error) {
       console.error('❌ 初始化裁剪区域失败:', error);
     }
   },

   /**
    * 获取图片信息
    */
   getImageInfo(imagePath) {
     return new Promise((resolve, reject) => {
       wx.getImageInfo({
         src: imagePath,
         success: resolve,
         fail: reject
       });
     });
   },

   /**
    * 裁剪框移动处理 - 简化版本
    */
   onCropMove(e) {
     const { type } = e;
     if (type === 'touchstart') this.startCropMove(e);
     else if (type === 'touchmove') this.processCropMove(e);
     else if (type === 'touchend') this.endCropMove(e);
     return false; // 阻止事件冒泡
   },

   /**
    * 开始移动裁剪框 - 修复坐标计算
    */
   startCropMove(e) {
     const { containerSize, imageOffset } = this.data;
  
     // ✅ 获取触摸点相对于容器的坐标
     const touch = e.touches[0];
     const relativeX = touch.clientX - imageOffset.x;
     const relativeY = touch.clientY - imageOffset.y;

     console.log('拖拽开始 - 修复版本:', {
       触摸点: `${touch.clientX},${touch.clientY}`,
       图片偏移: `${imageOffset.x},${imageOffset.y}`,
       相对坐标: `${relativeX},${relativeY}`,
       当前裁剪区域: this.data.cropArea
     });

     this.setData({
       isDragging: true,
       dragStart: { 
         x: relativeX, 
         y: relativeY 
       },
       dragStartArea: { ...this.data.cropArea }
     });

     wx.vibrateShort({ type: 'light' });
   },

   /**
    * 处理移动裁剪框 - 修复坐标计算
    */
   processCropMove(e) {
     if (!this.data.isDragging) return;

     // 节流优化
     const now = Date.now();
     if (now - (this.data.lastMoveTime || 0) < 16) return;
     this.setData({ lastMoveTime: now });

     const { dragStart, dragStartArea, imageDisplaySize, imageOffset } = this.data;
     const touch = e.touches[0];
  
     // ✅ 计算相对于图片的移动距离
     const relativeX = touch.clientX - imageOffset.x;
     const relativeY = touch.clientY - imageOffset.y;
     const deltaX = relativeX - dragStart.x;
     const deltaY = relativeY - dragStart.y;

     // ✅ 计算新的裁剪区域位置
     let newX = dragStartArea.x + deltaX;
     let newY = dragStartArea.y + deltaY;

     // ✅ 边界限制：确保裁剪框不超出图片显示区域
     const minX = imageOffset.x;
     const minY = imageOffset.y;
     const maxX = imageOffset.x + imageDisplaySize.width - dragStartArea.width;
     const maxY = imageOffset.y + imageDisplaySize.height - dragStartArea.height;

     newX = Math.max(minX, Math.min(newX, maxX));
     newY = Math.max(minY, Math.min(newY, maxY));

     this.setData({
       cropArea: {
         ...dragStartArea,
         x: newX,
         y: newY
       }
     });
   },

   /**
    * 结束移动裁剪框
    */
   endCropMove() {
     console.log('拖拽结束');
     this.setData({
       isDragging: false,
       dragStart: null,
       dragStartArea: null
     });
     wx.vibrateShort({ type: 'light' });
   },

   /**
    * 裁剪框缩放处理 - 简化版本
    */
   onCropResize(e) {
     const { type } = e;
     if (type === 'touchstart') this.startCropResize(e);
     else if (type === 'touchmove') this.processCropResize(e);
     else if (type === 'touchend') this.endCropResize(e);
     return false; // 阻止事件冒泡
   },

   /**
    * 开始缩放裁剪框
    */
   startCropResize(e) {
     const { imageDisplaySize } = this.data;
     const system = wx.getSystemInfoSync();
     const imageLeft = (system.windowWidth - imageDisplaySize.width) / 2;
     const { corner } = e.currentTarget.dataset;

     console.log('缩放开始:', corner);

     this.setData({
       isDragging: true,
       resizeCorner: corner,
       dragStart: { 
         x: e.touches[0].clientX - imageLeft, 
         y: e.touches[0].clientY 
       },
       dragStartArea: { ...this.data.cropArea }
     });

     wx.vibrateShort({ type: 'medium' });
   },

   /**
    * 处理缩放裁剪框 - 修复边界计算
    */
   processCropResize(e) {
     if (!this.data.isDragging || !this.data.resizeCorner) return;
  
     // 节流优化
     const now = Date.now();
     if (now - (this.data.lastMoveTime || 0) < 16) return;
     this.setData({ lastMoveTime: now });
  
     const { dragStart, dragStartArea, resizeCorner, imageDisplaySize } = this.data;
     const system = wx.getSystemInfoSync();
     const imageLeft = (system.windowWidth - imageDisplaySize.width) / 2;

     const deltaX = e.touches[0].clientX - (dragStart.x + imageLeft);
     const deltaY = e.touches[0].clientY - dragStart.y;

     let newArea = { ...dragStartArea };
     const minSize = 50;

     // ✅ 使用屏幕尺寸作为边界
     const screenWidth = wx.getSystemInfoSync().windowWidth;
     const screenHeight = wx.getSystemInfoSync().windowHeight;

     switch (resizeCorner) {
       case 'top-left':
         newArea.x = Math.max(0, Math.min(dragStartArea.x + deltaX, dragStartArea.x + dragStartArea.width - minSize));
         newArea.y = Math.max(0, Math.min(dragStartArea.y + deltaY, dragStartArea.y + dragStartArea.height - minSize));
         newArea.width = dragStartArea.width - (newArea.x - dragStartArea.x);
         newArea.height = dragStartArea.height - (newArea.y - dragStartArea.y);
         break;
         
       case 'top-right':
         newArea.y = Math.max(0, Math.min(dragStartArea.y + deltaY, dragStartArea.y + dragStartArea.height - minSize));
         newArea.width = Math.max(minSize, Math.min(dragStartArea.width + deltaX, screenWidth - dragStartArea.x));
         newArea.height = dragStartArea.height - (newArea.y - dragStartArea.y);
         break;
         
       case 'bottom-left':
         newArea.x = Math.max(0, Math.min(dragStartArea.x + deltaX, dragStartArea.x + dragStartArea.width - minSize));
         newArea.width = dragStartArea.width - (newArea.x - dragStartArea.x);
         newArea.height = Math.max(minSize, Math.min(dragStartArea.height + deltaY, screenHeight - dragStartArea.y));
         break;
         
       case 'bottom-right':
         newArea.width = Math.max(minSize, Math.min(dragStartArea.width + deltaX, screenWidth - dragStartArea.x));
         newArea.height = Math.max(minSize, Math.min(dragStartArea.height + deltaY, screenHeight - dragStartArea.y));
         break;
     }

     this.setData({ cropArea: newArea });
   },

   /**
    * 结束缩放裁剪框
    */
   endCropResize() {
     console.log('缩放结束');
     this.setData({
       isDragging: false,
       resizeCorner: null,
       dragStart: null,
       dragStartArea: null
     });
     wx.vibrateShort({ type: 'light' });
   },

   /**
    * 确认裁剪并开始AI分析
    */
   async confirmCropAndAnalyze() {
     try {
       console.log('开始确认裁剪...');
       
       // 移除过严格的尺寸检查，直接执行裁剪
       await this.proceedWithCrop();
       
     } catch (error) {
       console.error('裁剪分析失败:', error);
       wx.showModal({
         title: '处理失败',
         content: error.message || '图片处理失败，请重试',
         showCancel: false
       });
     }
   },

   /**
    * 执行裁剪流程
    */
   async proceedWithCrop() {
     // 显示加载状态
     wx.showLoading({
       title: '正在处理...',
       mask: true
     });

     // 使用现有的裁剪方法
     const croppedImagePath = await this.cropImage();
     
     if (!croppedImagePath) {
       throw new Error('图片裁剪失败');
     }

     console.log('裁剪完成，开始AI分析:', croppedImagePath);

     // 切换到分析界面
     this.setData({
       showCropping: false,
       showAnalyzing: true,
       croppedImagePath: croppedImagePath
     });

     // 开始AI分析
     await this.startAnalyzing(croppedImagePath, {
       cropOptimized: true
     });
   },

   /**
    * 取消裁剪
    */
   cancelCrop() {
     this.setData({
       showCropping: false,
       showAnalyzing: true,
       previewImagePath: this.data.originalImagePath
     });
     
     // 使用原图进行识别
     this.startAnalyzing(this.data.originalImagePath);
   },

   /**
    * 执行图片裁剪 - 修复坐标映射
    */
   async cropImage() {
     const { originalImagePath, cropArea, imageDisplaySize, imageOffset } = this.data;

     if (!originalImagePath || !cropArea || !imageDisplaySize || !imageOffset) {
       console.error('裁剪参数不完整');
       return originalImagePath;
     }

     try {
       // 获取原始图片信息
       const imageInfo = await this.getImageInfo(originalImagePath);
       console.log('🖼️ 开始裁剪，原始图片信息:', imageInfo);
       
       // ✅ 修复坐标映射：裁剪区域相对于图片显示区域的位置
       const cropRelativeX = cropArea.x - imageOffset.x;
       const cropRelativeY = cropArea.y - imageOffset.y;
       
       // ✅ 计算缩放比例
       const scaleX = imageInfo.width / imageDisplaySize.width;
       const scaleY = imageInfo.height / imageDisplaySize.height;
       
       // ✅ 计算实际裁剪区域（映射到原始图片坐标）
       const realCropX = Math.round(cropRelativeX * scaleX);
       const realCropY = Math.round(cropRelativeY * scaleY);
       const realCropWidth = Math.round(cropArea.width * scaleX);
       const realCropHeight = Math.round(cropArea.height * scaleY);
       
       // 边界检查
       const finalCropX = Math.max(0, Math.min(realCropX, imageInfo.width - 1));
       const finalCropY = Math.max(0, Math.min(realCropY, imageInfo.height - 1));
       const finalCropWidth = Math.max(50, Math.min(realCropWidth, imageInfo.width - finalCropX));
       const finalCropHeight = Math.max(50, Math.min(realCropHeight, imageInfo.height - finalCropY));
       
       console.log('✂️ 裁剪参数计算（修复版）:', {
         原始图片: `${imageInfo.width}x${imageInfo.height}`,
         显示尺寸: `${imageDisplaySize.width}x${imageDisplaySize.height}`,
         图片偏移: `${imageOffset.x},${imageOffset.y}`,
         裁剪区域: `${cropArea.x},${cropArea.y} ${cropArea.width}x${cropArea.height}`,
         相对位置: `${cropRelativeX},${cropRelativeY}`,
         缩放比例: `${scaleX.toFixed(2)}x${scaleY.toFixed(2)}`,
         实际裁剪: `${finalCropX},${finalCropY} ${finalCropWidth}x${finalCropHeight}`
       });

       // Canvas裁剪逻辑保持不变
       const ctx = wx.createCanvasContext('cropCanvas');
       ctx.clearRect(0, 0, finalCropWidth, finalCropHeight);
       ctx.drawImage(
         originalImagePath,
         finalCropX, finalCropY, finalCropWidth, finalCropHeight,
         0, 0, finalCropWidth, finalCropHeight
       );
       
       return new Promise((resolve) => {
         ctx.draw(false, () => {
           wx.canvasToTempFilePath({
             canvasId: 'cropCanvas',
             x: 0, y: 0,
             width: finalCropWidth,
             height: finalCropHeight,
             destWidth: finalCropWidth,
             destHeight: finalCropHeight,
             success: (res) => {
               console.log('✅ 图片裁剪成功（修复版）:', {
                 输出路径: res.tempFilePath,
                 裁剪尺寸: `${finalCropWidth}x${finalCropHeight}`
               });
               resolve(res.tempFilePath);
             },
             fail: (error) => {
               console.error('❌ Canvas导出失败:', error);
               resolve(originalImagePath);
             }
           });
         });
       });

     } catch (error) {
       console.error('❌ 裁剪过程异常:', error);
       return originalImagePath;
     }
   },

   /**
    * 重置裁剪区域
    */
   resetCropArea() {
     const { imageDisplaySize } = this.data;
     
     // 重置为默认的80%区域
     const cropWidth = imageDisplaySize.width * 0.8;
     const cropHeight = imageDisplaySize.height * 0.6;
     const cropX = (imageDisplaySize.width - cropWidth) / 2;
     const cropY = (imageDisplaySize.height - cropHeight) / 2;
     
     this.setData({
       cropArea: {
         x: cropX,
         y: cropY,
         width: cropWidth,
         height: cropHeight
       },
       cropBoxSize: {
         width: cropWidth,
         height: cropHeight
       }
     });
     
     wx.showToast({
       title: '已重置选择区域',
       icon: 'success',
       duration: 1000
     });
   },

   /**
    * 扩大裁剪区域
    */
   expandCropArea() {
     const { cropArea, imageDisplaySize } = this.data;
     const expandRatio = 1.1; // 扩大10%
     
     const newWidth = Math.min(cropArea.width * expandRatio, imageDisplaySize.width);
     const newHeight = Math.min(cropArea.height * expandRatio, imageDisplaySize.height);
     
     // 保持中心位置
     const newX = Math.max(0, cropArea.x - (newWidth - cropArea.width) / 2);
     const newY = Math.max(0, cropArea.y - (newHeight - cropArea.height) / 2);
     
     // 确保不超出边界
     const finalX = Math.min(newX, imageDisplaySize.width - newWidth);
     const finalY = Math.min(newY, imageDisplaySize.height - newHeight);
     
     this.setData({
       cropArea: {
         x: finalX,
         y: finalY,
         width: newWidth,
         height: newHeight
       },
       cropBoxSize: {
         width: newWidth,
         height: newHeight
       }
     });
   },

   /**
    * 缩小裁剪区域
    */
   shrinkCropArea() {
     const { cropArea } = this.data;
     const shrinkRatio = 0.9; // 缩小10%
     
     const newWidth = Math.max(cropArea.width * shrinkRatio, 100);
     const newHeight = Math.max(cropArea.height * shrinkRatio, 100);
     
     // 保持中心位置
     const newX = cropArea.x + (cropArea.width - newWidth) / 2;
     const newY = cropArea.y + (cropArea.height - newHeight) / 2;
     
     this.setData({
       cropArea: {
         x: newX,
         y: newY,
         width: newWidth,
         height: newHeight
       },
       cropBoxSize: {
         width: newWidth,
         height: newHeight
       }
     });
   },

   /**
    * 智能识别题目区域
    */
   async autoDetectArea() {
     try {
       wx.showLoading({ title: '智能识别中...' });
       
       // 模拟智能识别过程
       await new Promise(resolve => setTimeout(resolve, 1500));
       
       const { imageDisplaySize } = this.data;
       
       // 简单的智能识别算法：假设题目在图片的中央70%区域
       const cropWidth = imageDisplaySize.width * 0.7;
       const cropHeight = imageDisplaySize.height * 0.5;
       const cropX = (imageDisplaySize.width - cropWidth) / 2;
       const cropY = imageDisplaySize.height * 0.25; // 稍微偏上
       
       this.setData({
         cropArea: {
           x: cropX,
           y: cropY,
           width: cropWidth,
           height: cropHeight
         },
         cropBoxSize: {
           width: cropWidth,
           height: cropHeight
         }
       });
       
       wx.hideLoading();
       wx.showToast({
         title: '智能识别完成',
         icon: 'success',
         duration: 1500
       });
       
     } catch (error) {
       wx.hideLoading();
       console.error('智能识别失败:', error);
       wx.showToast({
         title: '智能识别失败',
         icon: 'none'
       });
     }
   },

   /**
    * 取消识别
    */
  cancelAnalyzing() {
    this.stopProgressUpdate();
    
    wx.showModal({
      title: '取消识别',
      content: '确定要取消当前识别吗？',
      success: (res) => {
        if (res.confirm) {
          this.setData({
            showAnalyzing: false,
            showPreview: false
          });
    }
      }
    });
  },

  /**
   * 从相册选择图片
   */
  async chooseFromAlbum() {
    try {
      const res = await wx.chooseImage({
        count: 1,
        sizeType: ['compressed'], // 强制压缩
        sourceType: ['album']
      });
      
      if (res.tempFilePaths && res.tempFilePaths.length > 0) {
        const imagePath = res.tempFilePaths[0];
        
                 // 预验证图片大小
         try {
           const imageInfo = await this.getImageInfo(imagePath);
           console.log('选择的图片信息:', imageInfo);
           
           // 根据图片大小给出不同的提示
           if (imageInfo.size > 2 * 1024 * 1024) { // 超过2MB
             wx.showModal({
               title: '图片较大，建议裁剪',
               content: `图片大小: ${Math.round(imageInfo.size/1024/1024*100)/100}MB\n\n为了确保识别成功，强烈建议使用裁剪功能精确选择题目区域。这样既能减少数据传输，又能提高识别准确率。`,
               showCancel: false,
               confirmText: '好的，我会裁剪'
             });
           } else if (imageInfo.size > 1 * 1024 * 1024) { // 超过1MB
             wx.showToast({
               title: '图片较大，建议裁剪题目区域',
               icon: 'none',
               duration: 3000
             });
           }
         } catch (error) {
           console.warn('获取图片信息失败:', error);
         }
        
        // 从相册选择图片后也进入裁剪界面
        this.setData({
          originalImagePath: imagePath,
          previewImagePath: imagePath,
          showCropping: true
        });
        
        // 初始化裁剪区域
        this.initCropArea(imagePath);
      }
    } catch (error) {
      console.error('选择图片失败:', error);
      this.showError('选择图片失败');
    }
  },

  /**
   * 获取图片信息（辅助方法）
   */
  getImageInfo(imagePath) {
    return new Promise((resolve, reject) => {
      wx.getImageInfo({
        src: imagePath,
        success: resolve,
        fail: reject
      });
    });
  },

  /**
   * 切换闪光灯
   */
  switchFlash() {
    const flashModes = ['off', 'on', 'auto'];
    const currentIndex = flashModes.indexOf(this.data.flash);
    const nextIndex = (currentIndex + 1) % flashModes.length;
    
    this.setData({
      flash: flashModes[nextIndex]
    });
    
    wx.vibrateShort();
  },

  /**
   * 切换摄像头
   */
  switchCamera() {
    const newPosition = this.data.devicePosition === 'back' ? 'front' : 'back';
    this.setData({
      devicePosition: newPosition
    });
    
    wx.vibrateShort();
  },

  /**
   * 相机错误处理
   */
  onCameraError(error) {
    console.error('相机错误:', error);
    this.showError('相机启动失败，请检查权限设置');
  },

  /**
   * 重新拍照
   */
  retakePhoto() {
    this.setData({
      showPreview: false,
      showAnalyzing: false,
      previewImagePath: '',
      recognizedQuestion: '',
      ocrResult: null
    });
  },

  /**
   * 题目内容输入
   */
  onQuestionInput(e) {
    const value = e.detail.value;
    this.setData({
      recognizedQuestion: value,
      hasValidQuestion: value.trim().length > 0
    });
  },

  /**
   * 备注输入
   */
  onDescriptionInput(e) {
    this.setData({
      'formData.description': e.detail.value
    });
  },

  /**
   * 显示学科选择器
   */
  showSubjectPicker() {
    this.setData({
      showSubjectPicker: true
    });
  },

  /**
   * 显示年级选择器
   */
  showGradePicker() {
    this.setData({
      showGradePicker: true
    });
  },

  /**
   * 显示难度选择器
   */
  showDifficultyPicker() {
    this.setData({
      showDifficultyPicker: true
    });
  },

  /**
   * 选择学科
   */
  selectSubject(e) {
    const subject = e.currentTarget.dataset.subject;
    this.setData({
      'formData.subject': subject,
      showSubjectPicker: false
    });
  },

  /**
   * 选择年级
   */
  selectGrade(e) {
    const grade = e.currentTarget.dataset.grade;
    this.setData({
      'formData.grade': grade.value,
      'formData.gradeLabel': grade.label,
      showGradePicker: false
    });
  },

  /**
   * 选择难度
   */
  selectDifficulty(e) {
    const difficulty = e.currentTarget.dataset.difficulty;
    this.setData({
      'formData.difficulty': difficulty.value,
      'formData.difficultyLabel': difficulty.label,
      showDifficultyPicker: false
    });
  },

  /**
   * 取消选择器
   */
  onPickerCancel() {
    this.setData({
      showSubjectPicker: false,
      showGradePicker: false,
      showDifficultyPicker: false
    });
  },

  /**
   * 确认并分析
   */
  async confirmAndAnalyze() {
    if (!this.data.recognizedQuestion.trim()) {
      wx.showToast({
        title: '请输入题目内容',
        icon: 'none'
      });
      return;
    }

    try {
      wx.showLoading({
        title: '正在分析...',
        mask: true
      });

      // 模拟AI分析过程
      await this.simulateAnalysis();
      
      wx.hideLoading();
      
      // 显示结果
      this.setData({
        showResultModal: true
      });
      
    } catch (error) {
      wx.hideLoading();
      console.error('分析失败:', error);
      this.showError('分析失败: ' + error.message);
    }
  },

  /**
   * 模拟AI分析
   */
  async simulateAnalysis() {
    return new Promise((resolve) => {
      setTimeout(() => {
        const mockResult = {
          question: this.data.recognizedQuestion,
          answer: this.generateMockAnswer(),
          explanation: this.generateMockExplanation(),
          knowledge_points: this.generateMockKnowledgePoints(),
          difficulty: this.data.formData.difficulty,
          subject: this.data.formData.subject
        };
        
        this.setData({
          analysisResult: mockResult
        });
        
        resolve(mockResult);
      }, 2000);
    });
  },

  /**
   * 生成模拟答案
   */
  generateMockAnswer() {
    const answers = [
      '42',
      '正确答案是C',
      '解：x = 5',
      '因为...所以...',
      '答：小明现在有20个苹果'
    ];
    
    return answers[Math.floor(Math.random() * answers.length)];
  },

  /**
   * 生成模拟解析
   */
  generateMockExplanation() {
    return '这道题主要考查的是基础运算能力。首先需要理解题目的含义，然后按照运算法则进行计算。具体解题步骤如下：\n\n1. 分析题目给出的条件\n2. 确定解题思路\n3. 按步骤计算\n4. 检查答案的合理性\n\n通过这种方法可以确保计算准确，避免出错。';
  },

  /**
   * 生成模拟知识点
   */
  generateMockKnowledgePoints() {
    const knowledgePoints = {
      '数学': ['基础运算', '代数', '几何', '函数'],
      '语文': ['阅读理解', '古诗词', '文言文', '作文'],
      '英语': ['语法', '词汇', '阅读', '写作'],
      '物理': ['力学', '电学', '光学', '热学'],
      '化学': ['化学反应', '元素周期表', '有机化学', '无机化学']
    };
    
    const subject = this.data.formData.subject;
    const points = knowledgePoints[subject] || knowledgePoints['数学'];
    
    // 随机选择1-3个知识点
    const count = Math.floor(Math.random() * 3) + 1;
    const selectedPoints = [];
    
    for (let i = 0; i < count && i < points.length; i++) {
      const randomIndex = Math.floor(Math.random() * points.length);
      if (!selectedPoints.includes(points[randomIndex])) {
        selectedPoints.push(points[randomIndex]);
      }
    }
    
    return selectedPoints;
  },

  /**
   * 保存错题
   */
  async saveMistake() {
    try {
      wx.showLoading({
        title: '保存中...',
        mask: true
      });

      const mistakeData = {
        id: Date.now().toString(),
        question: this.data.analysisResult.question,
        answer: this.data.analysisResult.answer,
        explanation: this.data.analysisResult.explanation,
        knowledge_points: this.data.analysisResult.knowledge_points,
        subject: this.data.formData.subject,
        grade: this.data.formData.grade,
        difficulty: this.data.formData.difficulty,
        description: this.data.formData.description,
        image_path: this.data.previewImagePath,
        created_at: formatTime(new Date()),
        updated_at: formatTime(new Date()),
        review_count: 0,
        mastery_level: 0
      };

      // 保存到本地存储
      await this.saveToLocalStorage(mistakeData);
      
      wx.hideLoading();
      
      wx.showToast({
        title: '保存成功',
        icon: 'success',
        duration: 2000
      });
      
      // 关闭弹窗并返回
      this.setData({
        showResultModal: false
      });
      
      setTimeout(() => {
        wx.navigateBack();
      }, 2000);
      
    } catch (error) {
      wx.hideLoading();
      console.error('保存错题失败:', error);
      this.showError('保存失败: ' + error.message);
    }
  },

  /**
   * 保存到本地存储
   */
  async saveToLocalStorage(mistakeData) {
    return new Promise((resolve, reject) => {
      try {
        // 获取现有数据
        const existingData = wx.getStorageSync('mistakes') || [];
        
        // 添加新数据
        existingData.unshift(mistakeData);
        
        // 保存数据
        wx.setStorageSync('mistakes', existingData);
        
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  },

  /**
   * 关闭结果弹窗
   */
  closeResultModal() {
    this.setData({
      showResultModal: false
    });
  },

  /**
   * 显示错误信息
   */
  showError(message) {
    wx.showModal({
      title: '错误',
      content: message,
      showCancel: false
    });
  },

  /**
   * 开发模式：自动模拟拍照
   */
  startDevelopmentMode() {
    if (this.data.isDevelopment) {
      setTimeout(() => {
        this.mockTakePhoto();
      }, 2000);
    }
  },

  /**
   * 模拟拍照
   */
  mockTakePhoto() {
    const mockImagePath = '/images/mock-question.jpg';
    
    this.setData({
      previewImagePath: mockImagePath,
      showPreview: false,
      showAnalyzing: true
    });
    
    // 模拟AI识别
    this.startAnalyzing(mockImagePath);
  },

  // 添加调试按钮的事件处理
  async testOCRFunction() {
    wx.showLoading({ title: '测试中...' })
    
    try {
      const result = await wx.cloud.callFunction({
        name: 'ocr-recognition',
        data: {
          test: true,
          imageBase64: 'test_image_data'
        }
      })
      
      console.log('OCR云函数测试结果:', result)
      
      wx.hideLoading()
      wx.showModal({
        title: '测试成功',
        content: `识别文字: ${result.result.text}`,
        showCancel: false
      })
      
    } catch (error) {
      console.error('OCR云函数测试失败:', error)
      wx.hideLoading()
      wx.showToast({
        title: '测试失败: ' + error.message,
        icon: 'none'
      })
    }
  },

  // 测试OCR识别
  async testOCR() {
    try {
      wx.showLoading({ title: '识别中...' });
      
      // 选择图片
      const res = await wx.chooseImage({
        count: 1,
        sourceType: ['album', 'camera']
      });
      
      const imagePath = res.tempFilePaths[0];
      console.log('选择的图片:', imagePath);
      
      // 调用OCR识别
      const result = await getApp().globalData.aiService.analyzeQuestionFromImage(imagePath);
      
      wx.hideLoading();
      
      console.log('OCR识别结果:', result);
      
      wx.showModal({
        title: '识别结果',
        content: `文字: ${result.text}\n置信度: ${Math.round(result.confidence * 100)}%`,
        showCancel: false
      });
      
    } catch (error) {
      wx.hideLoading();
      console.error('OCR测试失败:', error);
      wx.showToast({
        title: '识别失败: ' + error.message,
        icon: 'none'
      });
    }
  },
  // 已移除对全局 Math 对象的直接引用，避免只读属性报错
  // 自动测试云函数连接
  async autoTestCloudFunction() {
    try {
      console.log('自动测试云函数连接...');
      
      // 明确的测试调用
      const result = await wx.cloud.callFunction({
        name: 'ocr-recognition',
        data: {
          test: true // 只在测试时传递
        }
      });
      
      console.log('云函数连接正常:', result);
      return result.result;
      
    } catch (error) {
      console.error('云函数连接测试失败:', error);
      throw error;
    }
  },

  /**
   * 测试云函数状态
   */
  async testCloudFunction() {
    try {
      wx.showLoading({ title: '测试中...' });
      
      const aiService = getApp().globalData.aiService;
      const result = await aiService.testCloudFunction();
      
      wx.hideLoading();
      
      wx.showModal({
        title: '云函数测试结果',
        content: `状态: ${result.success ? '正常' : '异常'}\n提供商: ${result.provider}\n测试模式: ${result.testMode}`,
        showCancel: false
      });
      
    } catch (error) {
      wx.hideLoading();
      wx.showModal({
        title: '云函数测试失败',
        content: error.message,
        showCancel: false
      });
    }
  },

  /**
   * 测试OCR识别功能
   */
  async testOCR() {
    try {
      wx.showLoading({ title: '选择图片...' });
      
      // 选择图片
      const res = await wx.chooseImage({
        count: 1,
        sourceType: ['album', 'camera'],
        sizeType: ['compressed']
      });
      
      const imagePath = res.tempFilePaths[0];
      console.log('选择的图片路径:', imagePath);
      
      wx.showLoading({ title: 'OCR识别中...' });
      
      // 调用AI服务进行图片分析
      const aiService = getApp().globalData.aiService;
      const result = await aiService.analyzeQuestionFromImage(imagePath, {
        enhanceAccuracy: true,
        detectQuestionType: true
      });
      
      wx.hideLoading();
      
      console.log('OCR识别结果:', result);
      
      wx.showModal({
        title: 'OCR识别结果',
        content: `识别文字: ${result.text || '无法识别'}\n置信度: ${Math.round((result.confidence || 0) * 100)}%`,
        showCancel: false
      });
      
    } catch (error) {
      wx.hideLoading();
      console.error('OCR测试失败:', error);
      
      wx.showModal({
        title: 'OCR测试失败',
        content: `错误信息: ${error.message}`,
        showCancel: false
      });
    }
  },

  /**
   * 开发模式：选择图片进行OCR测试
   */
  async testOCRWithImage() {
    try {
      wx.showLoading({ title: '选择图片...' });
      
      // 选择图片
      const res = await wx.chooseImage({
        count: 1,
        sourceType: ['album'],
        sizeType: ['compressed']
      });
      
      const imagePath = res.tempFilePaths[0];
      console.log('选择的图片路径:', imagePath);
      
      // 显示预览并开始识别
      this.setData({
        previewImagePath: imagePath,
        showPreview: false,
        showAnalyzing: true
      });
      
      wx.hideLoading();
      
      // 开始AI识别
      await this.startAnalyzing(imagePath);
      
    } catch (error) {
      wx.hideLoading();
      console.error('图片选择失败:', error);
      
      wx.showToast({
        title: '图片选择失败',
        icon: 'none'
      });
    }
  },

  /**
   * 图片加载完成回调
   */
  onCropImageLoad(e) {
    console.log('裁剪图片加载完成:', e.detail);
  },

  /**
   * 预览图片加载错误处理
   */
  onPreviewImageError(e) {
    console.warn('预览图片加载失败:', e.detail);
    
    // 如果裁剪图片加载失败，回退到原图
    if (this.data.croppedImagePath && this.data.originalImagePath) {
      this.setData({
        croppedImagePath: this.data.originalImagePath
      });
    }
  },

  /**
   * 自动测试连接（兼容方法）
   */
  async autoTestConnection() {
    try {
      const res = await wx.cloud.callFunction({ 
        name: 'ocr-recognition', 
        data: { test: true } 
      });
      console.log('云函数连接正常:', res);
      return res;
    } catch (error) {
      console.error('云函数连接测试失败:', error);
      throw error;
    }
  }
}); 


































































