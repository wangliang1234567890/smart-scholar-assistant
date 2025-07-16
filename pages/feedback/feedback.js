// pages/feedback/feedback.js
import AIService from '../../utils/ai-service';

Page({
  data: {
    // 反馈类型
    feedbackTypes: [
      { id: 'bug', name: '问题反馈', icon: 'warning', color: '#FF6B6B' },
      { id: 'feature', name: '功能建议', icon: 'star', color: '#4ECDC4' },
      { id: 'experience', name: '体验评价', icon: 'like', color: '#45B7D1' },
      { id: 'other', name: '其他意见', icon: 'chat', color: '#96CEB4' }
    ],
    
    // 当前选择的反馈类型
    selectedType: '',
    
    // 表单数据
    formData: {
      type: '',
      title: '',
      description: '',
      contactInfo: '',
      rating: 0,
      deviceInfo: {},
      performanceData: null
    },
    
    // 评分相关
    ratingStars: [1, 2, 3, 4, 5],
    ratingLabels: ['很差', '较差', '一般', '良好', '优秀'],
    
    // 提交状态
    isSubmitting: false,
    
    // 附件
    attachedImages: [],
    maxImages: 3,
    
    // 常见问题
    commonIssues: [
      { id: 'slow_recognition', text: 'OCR识别速度慢', category: 'bug' },
      { id: 'wrong_result', text: '识别结果不准确', category: 'bug' },
      { id: 'app_crash', text: '应用崩溃或卡顿', category: 'bug' },
      { id: 'ui_improve', text: '界面设计优化', category: 'feature' },
      { id: 'new_subject', text: '新增学科支持', category: 'feature' },
      { id: 'offline_mode', text: '离线模式功能', category: 'feature' }
    ]
  },

  onLoad() {
    this.collectDeviceInfo();
    this.collectPerformanceData();
  },

  // 收集设备信息
  collectDeviceInfo() {
    try {
      const deviceInfo = wx.getDeviceInfo();
      const windowInfo = wx.getWindowInfo();
      const appBaseInfo = wx.getAppBaseInfo();
      
      this.setData({
        'formData.deviceInfo': {
          model: deviceInfo.model,
          system: deviceInfo.system,
          version: deviceInfo.version || appBaseInfo.version,
          platform: deviceInfo.platform,
          brand: deviceInfo.brand,
          screenWidth: windowInfo.screenWidth,
          screenHeight: windowInfo.screenHeight,
          pixelRatio: windowInfo.pixelRatio,
          wechatVersion: appBaseInfo.SDKVersion
        }
      });
    } catch (error) {
      console.warn('获取设备信息失败，使用降级方案:', error);
      // 降级使用旧API
      const systemInfo = wx.getSystemInfoSync();
      this.setData({
        'formData.deviceInfo': {
          model: systemInfo.model,
          system: systemInfo.system,
          version: systemInfo.version,
          platform: systemInfo.platform,
          brand: systemInfo.brand,
          screenWidth: systemInfo.screenWidth,
          screenHeight: systemInfo.screenHeight,
          pixelRatio: systemInfo.pixelRatio,
          wechatVersion: systemInfo.SDKVersion
        }
      });
    }
  },

  // 收集性能数据
  async collectPerformanceData() {
    try {
      const performanceData = await AIService.getPerformanceStats();
      this.setData({
        'formData.performanceData': performanceData
      });
    } catch (error) {
      console.error('获取性能数据失败:', error);
    }
  },

  // 选择反馈类型
  selectFeedbackType(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({
      selectedType: type,
      'formData.type': type
    });
    
    // 根据类型预填充常见问题
    this.loadCommonIssues(type);
  },

  // 加载常见问题
  loadCommonIssues(type) {
    const issues = this.data.commonIssues.filter(issue => 
      issue.category === type || type === 'other'
    );
    
    if (issues.length > 0) {
      wx.showActionSheet({
        itemList: ['自定义描述', ...issues.map(issue => issue.text)],
        success: (res) => {
          if (res.tapIndex > 0) {
            const selectedIssue = issues[res.tapIndex - 1];
            this.setData({
              'formData.title': selectedIssue.text,
              'formData.description': `关于"${selectedIssue.text}"的详细描述：\n\n`
            });
          }
        }
      });
    }
  },

  // 输入标题
  onTitleInput(e) {
    this.setData({
      'formData.title': e.detail.value
    });
  },

  // 输入描述
  onDescriptionInput(e) {
    this.setData({
      'formData.description': e.detail.value
    });
  },

  // 输入联系方式
  onContactInput(e) {
    this.setData({
      'formData.contactInfo': e.detail.value
    });
  },

  // 评分
  onRatingTap(e) {
    const rating = parseInt(e.currentTarget.dataset.rating);
    this.setData({
      'formData.rating': rating
    });
    
    // 震动反馈
    wx.vibrateShort();
  },

  // 添加图片
  async addImage() {
    if (this.data.attachedImages.length >= this.data.maxImages) {
      wx.showToast({
        title: `最多上传${this.data.maxImages}张图片`,
        icon: 'none'
      });
      return;
    }

    try {
      const res = await this.chooseImage();
      const newImages = [...this.data.attachedImages, ...res.tempFilePaths];
      
      this.setData({
        attachedImages: newImages.slice(0, this.data.maxImages)
      });
      
    } catch (error) {
      console.error('选择图片失败:', error);
    }
  },

  // 选择图片
  chooseImage() {
    return new Promise((resolve, reject) => {
      wx.chooseImage({
        count: this.data.maxImages - this.data.attachedImages.length,
        sourceType: ['album', 'camera'],
        success: resolve,
        fail: reject
      });
    });
  },

  // 预览图片
  previewImage(e) {
    const index = e.currentTarget.dataset.index;
    wx.previewImage({
      current: this.data.attachedImages[index],
      urls: this.data.attachedImages
    });
  },

  // 删除图片
  removeImage(e) {
    const index = e.currentTarget.dataset.index;
    const images = this.data.attachedImages.filter((_, i) => i !== index);
    this.setData({
      attachedImages: images
    });
  },

  // 提交反馈
  async submitFeedback() {
    if (!this.validateForm()) {
      return;
    }

    this.setData({ isSubmitting: true });

    try {
      // 上传图片（如果有）
      const uploadedImages = await this.uploadImages();
      
      // 构建反馈数据
      const feedbackData = {
        ...this.data.formData,
        images: uploadedImages,
        timestamp: Date.now(),
        userAgent: this.getUserAgent()
      };

      // 提交反馈
      await this.saveFeedback(feedbackData);
      
      // 提交成功
      wx.showToast({
        title: '反馈提交成功',
        icon: 'success'
      });

      // 返回上一页
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);

    } catch (error) {
      console.error('提交反馈失败:', error);
      wx.showToast({
        title: '提交失败，请重试',
        icon: 'error'
      });
    } finally {
      this.setData({ isSubmitting: false });
    }
  },

  // 验证表单
  validateForm() {
    const { type, title, description } = this.data.formData;
    
    if (!type) {
      wx.showToast({
        title: '请选择反馈类型',
        icon: 'none'
      });
      return false;
    }

    if (!title.trim()) {
      wx.showToast({
        title: '请输入反馈标题',
        icon: 'none'
      });
      return false;
    }

    if (!description.trim()) {
      wx.showToast({
        title: '请输入详细描述',
        icon: 'none'
      });
      return false;
    }

    if (description.trim().length < 10) {
      wx.showToast({
        title: '描述至少需要10个字符',
        icon: 'none'
      });
      return false;
    }

    return true;
  },

  // 上传图片
  async uploadImages() {
    if (this.data.attachedImages.length === 0) {
      return [];
    }

    const uploadPromises = this.data.attachedImages.map(async (imagePath, index) => {
      try {
        const result = await wx.cloud.uploadFile({
          cloudPath: `feedback/${Date.now()}_${index}.jpg`,
          filePath: imagePath
        });
        return result.fileID;
      } catch (error) {
        console.error('上传图片失败:', error);
        return null;
      }
    });

    const results = await Promise.all(uploadPromises);
    return results.filter(fileID => fileID !== null);
  },

  // 保存反馈
  async saveFeedback(feedbackData) {
    try {
      // 保存到云数据库
      await wx.cloud.database().collection('feedbacks').add({
        data: feedbackData
      });

      // 同时保存到本地（备份）
      const localFeedbacks = wx.getStorageSync('local_feedbacks') || [];
      localFeedbacks.push(feedbackData);
      wx.setStorageSync('local_feedbacks', localFeedbacks);

    } catch (error) {
      console.error('保存反馈失败:', error);
      
      // 如果云端保存失败，至少保存到本地
      const localFeedbacks = wx.getStorageSync('local_feedbacks') || [];
      localFeedbacks.push({
        ...feedbackData,
        status: 'local_only',
        syncFailed: true
      });
      wx.setStorageSync('local_feedbacks', localFeedbacks);
    }
  },

  // 获取用户代理信息
  getUserAgent() {
    const { deviceInfo } = this.data.formData;
    return `SmartHelper/1.0 (${deviceInfo.platform}; ${deviceInfo.system}; ${deviceInfo.model}) WeChat/${deviceInfo.wechatVersion}`;
  },

  // 快速反馈（一键反馈）
  quickFeedback(e) {
    const type = e.currentTarget.dataset.type;
    const templates = {
      'performance': {
        type: 'bug',
        title: '性能问题反馈',
        description: '应用运行缓慢或卡顿，具体表现：\n\n'
      },
      'accuracy': {
        type: 'bug', 
        title: 'OCR识别准确度问题',
        description: 'OCR识别结果不准确，具体情况：\n\n'
      },
      'feature_request': {
        type: 'feature',
        title: '功能改进建议',
        description: '希望增加或改进的功能：\n\n'
      },
      'ui_suggestion': {
        type: 'feature',
        title: '界面优化建议',
        description: '对界面设计的建议：\n\n'
      }
    };

    const template = templates[type];
    if (template) {
      this.setData({
        selectedType: template.type,
        'formData.type': template.type,
        'formData.title': template.title,
        'formData.description': template.description
      });
    }
  },

  // 查看历史反馈
  viewFeedbackHistory() {
    wx.navigateTo({
      url: '/pages/feedback/history'
    });
  },

  // 联系客服
  contactSupport() {
    wx.showModal({
      title: '联系客服',
      content: '您可以通过以下方式联系我们：\n\n邮箱：support@smarthelper.com\n工作时间：9:00-18:00',
      confirmText: '复制邮箱',
      success: (res) => {
        if (res.confirm) {
          wx.setClipboardData({
            data: 'support@smarthelper.com',
            success: () => {
              wx.showToast({
                title: '邮箱已复制',
                icon: 'success'
              });
            }
          });
        }
      }
    });
  }
}); 