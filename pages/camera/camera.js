// pages/camera/camera.js
import AIService from '../../utils/ai-service';
import { formatTime } from '../../utils/util';

Page({
  data: {
    // 界面状态
    showPreview: false,
    showAnalyzing: false,
    showResultModal: false,
    
    // 选择器状态
    showSubjectPicker: false,
    showGradePicker: false,
    showDifficultyPicker: false,
    
    // 相机设置
    devicePosition: 'back',
    flash: 'off',
    cameraFrameSize: { width: 300, height: 200 },
    
    // 识别进度
    progressStep: 0,
    processingStatus: '准备开始识别...',
    
    // 识别结果
    previewImagePath: '',
    recognizedQuestion: '',
    ocrResult: null,
    analysisResult: null,
    
    // 表单数据
    formData: {
      subject: '数学',
      grade: 1,
      gradeLabel: '一年级',
      difficulty: 3,
      difficultyLabel: '中等',
      description: ''
    },
    
    // 选择器数据
    subjects: ['数学', '语文', '英语', '物理', '化学', '生物', '历史', '地理', '政治'],
    grades: [
      { value: 1, label: '一年级' },
      { value: 2, label: '二年级' },
      { value: 3, label: '三年级' },
      { value: 4, label: '四年级' },
      { value: 5, label: '五年级' },
      { value: 6, label: '六年级' },
      { value: 7, label: '七年级' },
      { value: 8, label: '八年级' },
      { value: 9, label: '九年级' },
      { value: 10, label: '高一' },
      { value: 11, label: '高二' },
      { value: 12, label: '高三' }
    ],
    difficulties: [
      { value: 1, label: '很简单' },
      { value: 2, label: '简单' },
      { value: 3, label: '中等' },
      { value: 4, label: '较难' },
      { value: 5, label: '很难' }
    ],
    
    // 开发模式
    isDevelopment: true,
    
    // 错误处理
    hasError: false,
    errorMessage: '',
    
    // 计算属性
    progressRotation: 0,
    progressPercent: 0,
    confidencePercent: 0,
    hasValidQuestion: false
  },

  onLoad() {
    this.initPage();
  },

  onShow() {
    this.resetPageState();
  },

  onHide() {
    this.cleanupResources();
  },

  onUnload() {
    this.cleanupResources();
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
    
    console.log('Camera page initialized');
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
   * 初始化相机
   */
  initCamera() {
    const cameraContext = wx.createCameraContext();
    this.cameraContext = cameraContext;
  },

  /**
   * 检查权限
   */
  checkPermissions() {
    wx.getSetting({
      success: (res) => {
        if (!res.authSetting['scope.camera']) {
          wx.authorize({
            scope: 'scope.camera',
            success: () => {
              console.log('相机权限获取成功');
      },
            fail: () => {
              wx.showModal({
                title: '需要相机权限',
                content: '请在设置中开启相机权限以使用拍照功能',
                showCancel: false
              });
            }
          });
        }
      }
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
   * 清理资源
   */
  cleanupResources() {
    if (this.progressTimer) {
      clearInterval(this.progressTimer);
      this.progressTimer = null;
    }
    
    if (this.statusTimer) {
      clearTimeout(this.statusTimer);
      this.statusTimer = null;
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
      this.setData({
          previewImagePath: result.tempImagePath,
          showPreview: false,
          showAnalyzing: true
      });
        
        // 开始AI识别
        this.startAnalyzing(result.tempImagePath);
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
   * 开始AI识别
   */
  async startAnalyzing(imagePath) {
    try {
      // 重置进度
    this.setData({
        progressStep: 0,
        processingStatus: '正在预处理图像...'
      });
      
      // 开始进度更新
      this.startProgressUpdate();
      
      // 调用AI服务进行OCR识别
      const ocrResult = await AIService.recognizeText(imagePath);
      
      // 更新进度
      this.updateProgress(4, '识别完成！');
      
      // 保存识别结果
      const confidencePercent = ocrResult.confidence ? Math.round(ocrResult.confidence * 100) : 0;
      const recognizedText = ocrResult.text || '';
      this.setData({
        ocrResult,
        recognizedQuestion: recognizedText,
        confidencePercent,
        hasValidQuestion: recognizedText.trim().length > 0
      });
      
      // 延迟后显示确认页面
      setTimeout(() => {
        this.setData({
          showAnalyzing: false,
          showPreview: true
        });
      }, 1000);
      
    } catch (error) {
      console.error('AI识别失败:', error);
      
      // 停止进度更新
      this.stopProgressUpdate();
      
      // 显示错误并降级到手动输入
      this.handleAnalyzingError(error);
    }
  },

  /**
   * 开始进度更新
   */
  startProgressUpdate() {
    let step = 0;
    const steps = [
      { step: 1, status: '正在预处理图像...', delay: 800 },
      { step: 2, status: 'AI正在识别文字...', delay: 1500 },
      { step: 3, status: '正在解析题目结构...', delay: 1200 },
      { step: 4, status: '正在生成识别结果...', delay: 800 }
    ];
    
    const updateNextStep = () => {
      if (step < steps.length) {
        const currentStep = steps[step];
        this.updateProgress(currentStep.step, currentStep.status);
        step++;
        
        this.statusTimer = setTimeout(updateNextStep, currentStep.delay);
      }
    };
    
    // 开始第一步
    updateNextStep();
  },

  /**
   * 更新进度
   */
  updateProgress(step, status) {
    const progressPercent = Math.round((step / 4) * 100);
    const progressRotation = (step / 4) * 360;
    
    this.setData({
      progressStep: step,
      processingStatus: status,
      progressPercent,
      progressRotation
    });
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
   * 处理识别错误
   */
  handleAnalyzingError(error) {
    let errorMessage = '识别失败，请重试';
    
    if (error.code === 'IMAGE_TOO_LARGE') {
      errorMessage = '图片文件过大，请重新拍照';
    } else if (error.code === 'NETWORK_ERROR') {
      errorMessage = '网络连接失败，已切换到离线模式';
    } else if (error.code === 'OCR_SERVICE_ERROR') {
      errorMessage = 'AI服务暂时不可用，请手动输入题目';
    }
    
    wx.showModal({
      title: '识别失败',
      content: errorMessage,
      showCancel: true,
      cancelText: '重新拍照',
      confirmText: '手动输入',
      success: (res) => {
        if (res.confirm) {
          // 手动输入
          this.setData({
            showAnalyzing: false,
            showPreview: true,
            recognizedQuestion: ''
          });
        } else {
          // 重新拍照
          this.setData({
            showAnalyzing: false,
            showPreview: false
            });
        }
      }
    });
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
      sizeType: ['compressed'],
        sourceType: ['album']
      });
      
      if (res.tempFilePaths && res.tempFilePaths.length > 0) {
        const imagePath = res.tempFilePaths[0];
        this.setData({
          previewImagePath: imagePath,
          showPreview: false,
          showAnalyzing: true
        });
        
        // 开始AI识别
        this.startAnalyzing(imagePath);
      }
    } catch (error) {
        console.error('选择图片失败:', error);
          this.showError('选择图片失败');
        }
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
  }
  // 已移除对全局 Math 对象的直接引用，避免只读属性报错
}); 