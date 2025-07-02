import DatabaseManager from '../../utils/database';
import { SUBJECTS, GRADE_LEVELS, DIFFICULTY_LEVELS } from '../../utils/constants';

Page({
  data: {
    cameraFrameSize: {},
    devicePosition: 'back', // back | front
    flash: 'off', // off | on | auto
    showPreview: false,
    showAnalyzing: false,
    previewImagePath: '',
    analyzing: false,
    analysisResult: null,
    showResultModal: false,
    
    // 识别相关数据
    recognizedQuestion: '计算下列各题：\n(1) 25 × 4 = ?\n(2) 48 ÷ 6 = ?\n(3) 15 + 27 = ?',
    progressStep: 0,
    
    // 开发模式标志
    isDevelopment: true,
    
    // 表单数据
    formData: {
      subject: '数学',
      grade: 1,
      difficulty: 1,
      description: '',
      tags: [],
      gradeLabel: '一年级',
      difficultyLabel: '很简单'
    },
    
    // 界面控制
    showSubjectPicker: false,
    showGradePicker: false,
    showDifficultyPicker: false,
    
    // 数据列表
    subjects: SUBJECTS,
    grades: GRADE_LEVELS,
    difficulties: DIFFICULTY_LEVELS,
    
    // 用户信息
    userInfo: null
  },

  onLoad() {
    console.log('拍照页面加载');
    this.initCamera();
    this.getUserInfo();

    // 初始化显示的文本
    this.setData({
      'formData.gradeLabel': this.getGradeText(this.data.formData.grade),
      'formData.difficultyLabel': this.getDifficultyText(this.data.formData.difficulty)
    });

    // 开发模式：自动显示测试数据
    if (this.data.isDevelopment) {
      this.loadDevelopmentData();
    }
  },

  // 开发模式：加载测试数据
  loadDevelopmentData() {
    // 延迟2秒后自动进入AI识别页面，方便开发测试
    setTimeout(() => {
      this.simulateTakePhoto();
    }, 2000);
  },

  // 模拟拍照（开发模式）
  simulateTakePhoto() {
    const mockImagePath = '/images/mock-question.jpg'; // 模拟图片路径
    
    console.log('模拟拍照成功');
    
    // 先显示AI识别中页面
    this.setData({
      showPreview: false,
      showAnalyzing: true,
      previewImagePath: mockImagePath,
      analyzing: true,
      progressStep: 0
    });
    
    // 开始AI识别流程
    this.startAIRecognition();
  },

  onShow() {
    // 每次显示时重新初始化相机
    this.initCamera();
  },

  onHide() {
    // 页面隐藏时释放相机资源
    this.releaseCamera();
  },

  onUnload() {
    // 页面卸载时释放资源
    this.releaseCamera();
  },

  // 初始化相机
  initCamera() {
    try {
      // 获取系统信息
      const systemInfo = wx.getSystemInfoSync();
      const { windowWidth, windowHeight } = systemInfo;
      
      // 计算相机框大小（保持4:3比例）
      const frameWidth = windowWidth - 40; // 左右各20rpx边距
      const frameHeight = frameWidth * 0.75;
      
      this.setData({
        cameraFrameSize: {
          width: frameWidth,
          height: frameHeight,
          top: (windowHeight - frameHeight) / 2 - 100
        }
      });

      console.log('相机初始化完成');
    } catch (error) {
      console.error('相机初始化失败:', error);
      this.showError('相机初始化失败');
    }
  },

  // 获取用户信息
  getUserInfo() {
    const app = getApp();
    const userInfo = app.getUserInfo();
    
    if (userInfo) {
      this.setData({ 
        userInfo,
        'formData.grade': userInfo.grade || 1
      });
    }
  },

  // 拍照
  takePhoto() {
    if (this.data.analyzing) return;

    // 开发模式：直接使用模拟数据
    if (this.data.isDevelopment) {
      this.simulateTakePhoto();
      return;
    }

    const cameraContext = wx.createCameraContext();
    
    wx.showLoading({
      title: '拍照中...',
      mask: true
    });

    cameraContext.takePhoto({
      quality: 'high',
      success: (res) => {
        wx.hideLoading();
        console.log('拍照成功:', res.tempImagePath);
        
        // 先显示AI识别中页面
        this.setData({
          showPreview: false,
          showAnalyzing: true,
          previewImagePath: res.tempImagePath,
          analyzing: true,
          progressStep: 0
        });
        
        // 开始AI识别流程
        this.startAIRecognition();
      },
      fail: (error) => {
        wx.hideLoading();
        console.error('拍照失败:', error);
        // 开发模式：拍照失败时也使用模拟数据
        if (this.data.isDevelopment) {
          this.simulateTakePhoto();
        } else {
          this.showError('拍照失败，请重试');
        }
      }
    });
  },

  // 开始AI识别流程
  startAIRecognition() {
    // 开始进度动画
    this.startProgressAnimation();
  },

  // 开始进度动画
  startProgressAnimation() {
    // 步骤1：图像预处理
    setTimeout(() => {
      this.setData({ progressStep: 1 });
    }, 800);
    
    // 步骤2：文字识别
    setTimeout(() => {
      this.setData({ progressStep: 2 });
    }, 1800);
    
    // 步骤3：题目解析
    setTimeout(() => {
      this.setData({ progressStep: 3 });
    }, 2800);
    
    // 完成AI识别，跳转到确认题目页面
    setTimeout(() => {
      this.completeAIRecognition();
    }, 4000);
  },

  // 完成AI识别，进入确认题目页面
  completeAIRecognition() {
    // 生成识别结果
    this.simulateQuickRecognition();
    
    // 显示确认题目页面
    this.setData({
      showAnalyzing: false,
      showPreview: true,
      analyzing: false
    });
  },

  // 模拟快速识别（生成题目内容）
  simulateQuickRecognition() {
    const mockQuestions = [
      '计算下列各题：\n(1) 25 × 4 = ?\n(2) 48 ÷ 6 = ?\n(3) 15 + 27 = ?',
      '解方程：2x + 5 = 13',
      '填空题：\n长方形的面积公式是_____ × _____',
      '选择题：下面哪个是质数？\nA. 4  B. 6  C. 7  D. 8',
      '应用题：\n小明有15个苹果，吃了3个，又买了8个，现在有多少个苹果？',
      '计算题：\n(1) 126 + 89 = ?\n(2) 200 - 97 = ?\n(3) 45 × 6 = ?'
    ];
    
    const randomQuestion = mockQuestions[Math.floor(Math.random() * mockQuestions.length)];
    
    this.setData({
      recognizedQuestion: randomQuestion
    });
  },

  // 确认并开始分析（从确认题目页面点击确认保存错题）
  confirmAndAnalyze() {
    // 直接进行最终分析并显示结果弹窗
    this.analyzeAndShowResult();
  },

  // 分析并显示结果
  async analyzeAndShowResult() {
    try {
      wx.showLoading({
        title: '分析中...',
        mask: true
      });

      // 模拟AI分析结果
      const mockAnalysis = await this.mockImageAnalysis(this.data.previewImagePath);
      
      wx.hideLoading();
      
      this.setData({
        analysisResult: mockAnalysis,
        showResultModal: true
      });

    } catch (error) {
      wx.hideLoading();
      console.error('分析失败:', error);
      this.showError('分析失败，请重试');
    }
  },

  // 取消AI识别
  cancelAnalyzing() {
    this.setData({
      showAnalyzing: false,
      showPreview: false,
      analyzing: false,
      progressStep: 0,
      previewImagePath: ''
    });
  },

  // 重新拍照
  retakePhoto() {
    this.setData({
      showPreview: false,
      showAnalyzing: false,
      previewImagePath: '',
      analysisResult: null,
      showResultModal: false,
      progressStep: 0
    });
  },

  // 选择科目
  selectSubject(e) {
    const subject = e.currentTarget.dataset.subject;
    this.setData({
      'formData.subject': subject
    });
  },

  // 手动编辑
  manualEdit() {
    wx.showModal({
      title: '手动编辑',
      content: '此功能正在开发中，敬请期待！',
      showCancel: false
    });
  },

  // 确认使用照片（原有方法，保持兼容）
  confirmPhoto() {
    this.confirmAndAnalyze();
  },

  // 分析图片（原有方法，现在通过确认页面触发）
  async analyzeImage() {
    return this.completeAIRecognition();
  },

  // 模拟图片分析（实际项目中替换为真实AI接口）
  mockImageAnalysis(imagePath) {
    return new Promise((resolve) => {
      setTimeout(() => {
        const mockResults = [
          {
            question: this.data.recognizedQuestion,
            answer: this.generateMockAnswer(this.data.recognizedQuestion),
            explanation: this.generateMockExplanation(this.data.recognizedQuestion),
            confidence: 0.92 + Math.random() * 0.06, // 0.92-0.98
            subject: this.data.formData.subject,
            difficulty: Math.floor(Math.random() * 5) + 1, // 1-5
            knowledge_points: this.generateMockKnowledgePoints(this.data.recognizedQuestion)
          }
        ];
        
        resolve(mockResults[0]);
      }, 1000);
    });
  },

  // 生成模拟答案
  generateMockAnswer(question) {
    if (question.includes('25 × 4')) {
      return '(1) 100  (2) 8  (3) 42';
    } else if (question.includes('方程')) {
      return 'x = 4';
    } else if (question.includes('面积公式')) {
      return '长 × 宽';
    } else if (question.includes('质数')) {
      return 'C. 7';
    } else if (question.includes('小明')) {
      return '20个苹果';
    } else if (question.includes('126 + 89')) {
      return '(1) 215  (2) 103  (3) 270';
    } else {
      return '答案示例';
    }
  },

  // 生成模拟解析
  generateMockExplanation(question) {
    if (question.includes('25 × 4')) {
      return '(1) 25 × 4 = 100\n(2) 48 ÷ 6 = 8\n(3) 15 + 27 = 42\n\n解题思路：按照四则运算的法则进行计算。';
    } else if (question.includes('方程')) {
      return '2x + 5 = 13\n移项得：2x = 13 - 5 = 8\n两边同除以2：x = 4\n\n验证：2×4 + 5 = 13 ✓';
    } else if (question.includes('面积公式')) {
      return '长方形面积 = 长 × 宽\n这是长方形面积计算的基本公式。';
    } else if (question.includes('质数')) {
      return '质数是只能被1和自身整除的自然数。\nA. 4 = 2×2 (合数)\nB. 6 = 2×3 (合数)\nC. 7 只能被1和7整除 (质数)\nD. 8 = 2×4 (合数)';
    } else if (question.includes('小明')) {
      return '原有：15个\n吃了：-3个\n又买了：+8个\n现在有：15 - 3 + 8 = 20个';
    } else if (question.includes('126 + 89')) {
      return '(1) 126 + 89 = 215\n(2) 200 - 97 = 103\n(3) 45 × 6 = 270\n\n解题要点：注意运算符号，按步骤计算。';
    } else {
      return '这是一道典型的数学题目，需要根据题目要求进行分析和计算。';
    }
  },

  // 生成模拟知识点
  generateMockKnowledgePoints(question) {
    if (question.includes('×') || question.includes('÷') || question.includes('+') || question.includes('-')) {
      return ['四则运算', '加法', '减法', '乘法', '除法'];
    } else if (question.includes('方程')) {
      return ['一元一次方程', '方程求解', '移项法则'];
    } else if (question.includes('面积')) {
      return ['几何图形', '长方形', '面积计算'];
    } else if (question.includes('质数')) {
      return ['数论', '质数与合数', '因数分解'];
    } else if (question.includes('应用题')) {
      return ['应用题', '数量关系', '生活数学'];
    } else {
      return ['基础数学', '计算能力'];
    }
  },

  // 保存错题
  async saveMistake() {
    if (!this.data.analysisResult) return;

    try {
      wx.showLoading({
        title: '保存中...',
        mask: true
      });

      const { analysisResult, formData, previewImagePath, userInfo } = this.data;

      // 准备错题数据
      const mistakeData = {
        userId: userInfo?._id || 'test_user_001',
        subject: formData.subject,
        grade: formData.grade,
        difficulty: formData.difficulty,
        question: analysisResult.question,
        answer: analysisResult.answer,
        explanation: analysisResult.explanation,
        imagePath: previewImagePath,
        userDescription: formData.description,
        tags: formData.tags,
        knowledgePoints: analysisResult.knowledge_points || [],
        confidence: analysisResult.confidence || 0.9,
        status: 'new', // new | reviewing | mastered
        createTime: new Date(),
        reviewCount: 0,
        masteredTime: null
      };

      // 开发模式：模拟保存成功
      if (this.data.isDevelopment) {
        setTimeout(() => {
          wx.hideLoading();
          wx.showToast({
            title: '保存成功！',
            icon: 'success'
          });

          // 返回首页
          setTimeout(() => {
            wx.switchTab({
              url: '/pages/home/home'
            });
          }, 1500);
        }, 1000);
        return;
      }

      // 保存到数据库
      const result = await DatabaseManager.addMistake(mistakeData);

      wx.hideLoading();

      if (result.success) {
        wx.showToast({
          title: '保存成功！',
          icon: 'success'
        });

        // 返回首页
        setTimeout(() => {
          wx.switchTab({
            url: '/pages/home/home'
          });
        }, 1500);
      } else {
        throw new Error('保存失败');
      }

    } catch (error) {
      wx.hideLoading();
      console.error('保存错题失败:', error);
      this.showError('保存失败，请重试');
    }
  },

  // 从相册选择
  chooseFromAlbum() {
    // 开发模式：直接使用模拟数据
    if (this.data.isDevelopment) {
      this.simulateTakePhoto();
      return;
    }

    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album'],
      success: (res) => {
        const imagePath = res.tempFilePaths[0];
        
        // 先显示AI识别中页面
        this.setData({
          showPreview: false,
          showAnalyzing: true,
          previewImagePath: imagePath,
          analyzing: true,
          progressStep: 0
        });
        
        // 开始AI识别流程
        this.startAIRecognition();
      },
      fail: (error) => {
        console.error('选择图片失败:', error);
        // 开发模式：失败时也使用模拟数据
        if (this.data.isDevelopment) {
          this.simulateTakePhoto();
        } else {
          this.showError('选择图片失败');
        }
      }
    });
  },

  // 切换摄像头
  switchCamera() {
    const newPosition = this.data.devicePosition === 'back' ? 'front' : 'back';
    this.setData({ devicePosition: newPosition });
  },

  // 切换闪光灯
  switchFlash() {
    const flashModes = ['off', 'on', 'auto'];
    const currentIndex = flashModes.indexOf(this.data.flash);
    const nextIndex = (currentIndex + 1) % flashModes.length;
    this.setData({ flash: flashModes[nextIndex] });
  },

  // 表单相关方法
  onSubjectChange(e) {
    const index = e.detail.value;
    this.setData({
      'formData.subject': this.data.subjects[index],
      showSubjectPicker: false
    });
  },

  onGradeChange(e) {
    const index = e.detail.value;
    const grade = this.data.grades[index].value;
    this.setData({
      'formData.grade': grade,
      'formData.gradeLabel': this.data.grades[index].label,
      showGradePicker: false
    });
  },

  onDifficultyChange(e) {
    const index = e.detail.value;
    const difficulty = this.data.difficulties[index].value;
    this.setData({
      'formData.difficulty': difficulty,
      'formData.difficultyLabel': this.data.difficulties[index].label,
      showDifficultyPicker: false
    });
  },

  onDescriptionInput(e) {
    this.setData({
      'formData.description': e.detail.value
    });
  },

  // 显示选择器
  showSubjectPicker() {
    this.setData({ showSubjectPicker: true });
  },

  showGradePicker() {
    this.setData({ showGradePicker: true });
  },

  showDifficultyPicker() {
    this.setData({ showDifficultyPicker: true });
  },

  // 关闭选择器
  onPickerCancel() {
    this.setData({
      showSubjectPicker: false,
      showGradePicker: false,
      showDifficultyPicker: false
    });
  },

  // 关闭结果弹窗
  closeResultModal() {
    this.setData({ showResultModal: false });
  },

  // 释放相机资源
  releaseCamera() {
    // 相机资源会在页面销毁时自动释放
    console.log('释放相机资源');
  },

  // 错误处理
  showError(message) {
    wx.showModal({
      title: '提示',
      content: message,
      showCancel: false,
      confirmText: '知道了'
    });
  },

  // 相机错误处理
  onCameraError(e) {
    console.error('相机错误:', e.detail);
    // 开发模式：相机错误时自动使用模拟数据
    if (this.data.isDevelopment) {
      this.simulateTakePhoto();
    } else {
      this.showError('相机启动失败，请检查权限设置');
    }
  },

  // 获取格式化的难度文本
  getDifficultyText(difficulty) {
    const item = this.data.difficulties.find(d => d.value === difficulty);
    return item ? item.label : '';
  },

  // 获取格式化的年级文本
  getGradeText(grade) {
    return this.data.grades.find(g => g.value === grade)?.label || '';
  }
}); 