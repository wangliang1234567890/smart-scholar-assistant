import DatabaseManager from '../../utils/database';
import { SUBJECTS, GRADE_LEVELS, DIFFICULTY_LEVELS } from '../../utils/constants';

Page({
  data: {
    cameraFrameSize: {},
    devicePosition: 'back', // back | front
    flash: 'off', // off | on | auto
    showPreview: false,
    previewImagePath: '',
    analyzing: false,
    analysisResult: null,
    showResultModal: false,
    
    // 表单数据
    formData: {
      subject: '数学',
      grade: 1,
      difficulty: 1,
      description: '',
      tags: []
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
        
        this.setData({
          showPreview: true,
          previewImagePath: res.tempImagePath
        });
      },
      fail: (error) => {
        wx.hideLoading();
        console.error('拍照失败:', error);
        this.showError('拍照失败，请重试');
      }
    });
  },

  // 重新拍照
  retakePhoto() {
    this.setData({
      showPreview: false,
      previewImagePath: '',
      analysisResult: null,
      showResultModal: false
    });
  },

  // 确认使用照片
  confirmPhoto() {
    this.analyzeImage();
  },

  // 分析图片
  async analyzeImage() {
    if (!this.data.previewImagePath) return;

    try {
      this.setData({ analyzing: true });
      
      wx.showLoading({
        title: 'AI分析中...',
        mask: true
      });

      // 模拟AI分析过程（实际应用中需要调用OCR和AI分析接口）
      const mockAnalysis = await this.mockImageAnalysis(this.data.previewImagePath);
      
      wx.hideLoading();
      
      this.setData({
        analysisResult: mockAnalysis,
        showResultModal: true,
        analyzing: false
      });

    } catch (error) {
      wx.hideLoading();
      console.error('图片分析失败:', error);
      this.setData({ analyzing: false });
      this.showError('分析失败，请重试');
    }
  },

  // 模拟图片分析（实际项目中替换为真实AI接口）
  mockImageAnalysis(imagePath) {
    return new Promise((resolve) => {
      setTimeout(() => {
        const mockResults = [
          {
            question: '计算：125 × 8 = ?',
            answer: '1000',
            explanation: '125 × 8 = 125 × 2³ = (125 × 2) × 2² = 250 × 4 = 1000',
            confidence: 0.95,
            subject: '数学',
            difficulty: 2,
            knowledge_points: ['乘法运算', '整数运算']
          },
          {
            question: '解方程：2x + 5 = 13',
            answer: 'x = 4',
            explanation: '2x + 5 = 13\n2x = 13 - 5\n2x = 8\nx = 4',
            confidence: 0.92,
            subject: '数学',
            difficulty: 3,
            knowledge_points: ['一元一次方程', '方程求解']
          }
        ];
        
        const randomIndex = Math.floor(Math.random() * mockResults.length);
        resolve(mockResults[randomIndex]);
      }, 2000);
    });
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
        userId: userInfo._id,
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
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album'],
      success: (res) => {
        const imagePath = res.tempFilePaths[0];
        this.setData({
          showPreview: true,
          previewImagePath: imagePath
        });
      },
      fail: (error) => {
        console.error('选择图片失败:', error);
        this.showError('选择图片失败');
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
    this.setData({
      'formData.grade': this.data.grades[index].value,
      showGradePicker: false
    });
  },

  onDifficultyChange(e) {
    const index = e.detail.value;
    this.setData({
      'formData.difficulty': this.data.difficulties[index].value,
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
    this.showError('相机启动失败，请检查权限设置');
  },

  // 获取格式化的难度文本
  getDifficultyText(difficulty) {
    const item = this.data.difficulties.find(d => d.value === difficulty);
    return item ? item.label : '简单';
  },

  // 获取格式化的年级文本
  getGradeText(grade) {
    const item = this.data.grades.find(g => g.value === grade);
    return item ? item.label : '一年级';
  }
}); 