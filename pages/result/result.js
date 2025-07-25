// pages/result/result.js
Page({
  data: {
    // 识别结果
    ocrResult: {
      text: '',
      confidence: 0,
      questionType: 'unknown',
      subject: 'unknown',
      difficulty: 1
    },
    
    // 原始图片
    originalImagePath: '',
    
    // 来源信息
    sourceType: 'camera', // camera | album
    
    // 编辑状态
    isEditing: false,
    editedText: '',
    
    // 操作状态
    isSaving: false
  },

  onLoad(options) {
    console.log('结果页面加载，参数:', options);
    
    // 强制使用云存储链接
    if (options.fileID) {
      this.setData({
        originalImagePath: options.fileID
      });
    }
    
    // 从全局数据获取OCR结果
    const app = getApp();
    if (app.globalData.lastOCRResult) {
      this.setData({
        ocrResult: app.globalData.lastOCRResult.ocrResult || {},
        originalImagePath: app.globalData.lastOCRResult.imagePath || options.fileID || '',
        sourceType: app.globalData.lastOCRResult.sourceType || 'camera'
      });
    } else {
      console.error('未找到识别结果');
    }
    
    // 初始化编辑文本
    this.setData({
      editedText: this.data.ocrResult.text || ''
    });
  },

  /**
   * 开始编辑文本
   */
  startEdit() {
    this.setData({
      isEditing: true,
      editedText: this.data.ocrResult.text || ''
    });
  },

  /**
   * 取消编辑
   */
  cancelEdit() {
    this.setData({
      isEditing: false,
      editedText: this.data.ocrResult.text || ''
    });
  },

  /**
   * 保存编辑
   */
  saveEdit() {
    const editedText = this.data.editedText.trim();
    
    if (!editedText) {
      wx.showToast({
        title: '文本不能为空',
        icon: 'none'
      });
      return;
    }
    
    // 更新识别结果
    this.setData({
      'ocrResult.text': editedText,
      isEditing: false
    });
    
    wx.showToast({
      title: '修改已保存',
      icon: 'success'
    });
  },

  /**
   * 文本输入处理
   */
  onTextInput(e) {
    this.setData({
      editedText: e.detail.value
    });
  },

  /**
   * 复制文本
   */
  copyText() {
    const text = this.data.ocrResult.text;
    
    if (!text) {
      wx.showToast({
        title: '没有可复制的内容',
        icon: 'none'
      });
      return;
    }
    
    wx.setClipboardData({
      data: text,
      success: () => {
        wx.showToast({
          title: '已复制到剪贴板',
          icon: 'success'
        });
      },
      fail: () => {
        wx.showToast({
          title: '复制失败',
          icon: 'none'
        });
      }
    });
  },

  /**
   * 保存结果到本地
   */
  async saveResult() {
    if (this.data.isSaving) return;
    
    this.setData({ isSaving: true });
    
    try {
      wx.showLoading({
        title: '正在保存...',
        mask: true
      });
      
      // 构建保存数据
      const saveData = {
        id: Date.now(),
        text: this.data.ocrResult.text,
        confidence: this.data.ocrResult.confidence,
        questionType: this.data.ocrResult.questionType,
        subject: this.data.ocrResult.subject,
        difficulty: this.data.ocrResult.difficulty,
        imagePath: this.data.originalImagePath,
        sourceType: this.data.sourceType,
        createTime: new Date().toISOString(),
        updateTime: new Date().toISOString()
      };
      
      // 获取已保存的记录
      const savedResults = wx.getStorageSync('savedOCRResults') || [];
      savedResults.unshift(saveData);
      
      // 限制保存数量（最多100条）
      if (savedResults.length > 100) {
        savedResults.splice(100);
      }
      
      // 保存到本地存储
      wx.setStorageSync('savedOCRResults', savedResults);
      
      wx.hideLoading();
      
      wx.showModal({
        title: '保存成功',
        content: '识别结果已保存到本地记录',
        showCancel: false,
        success: () => {
          // 可以跳转到历史记录页面
          // wx.navigateTo({ url: '/pages/history/history' });
        }
      });
      
    } catch (error) {
      wx.hideLoading();
      console.error('保存结果失败:', error);
      
      wx.showToast({
        title: '保存失败',
        icon: 'error'
      });
    } finally {
      this.setData({ isSaving: false });
    }
  },

  /**
   * 重新识别
   */
  retryRecognition() {
    wx.showModal({
      title: '重新识别',
      content: '确定要重新识别这张图片吗？',
      success: (res) => {
        if (res.confirm) {
          // 返回相机页面重新识别
          wx.navigateBack({
            delta: 1
          });
        }
      }
    });
  },

  /**
   * 重新拍照
   */
  retakePhoto() {
    wx.showModal({
      title: '重新拍照',
      content: '确定要重新拍照吗？',
      success: (res) => {
        if (res.confirm) {
          // 返回相机页面
          wx.navigateBack({
            delta: 1
          });
        }
      }
    });
  },

  /**
   * 分享结果
   */
  shareResult() {
    const text = this.data.ocrResult.text;
    
    if (!text) {
      wx.showToast({
        title: '没有可分享的内容',
        icon: 'none'
      });
      return;
    }
    
    // 这里可以实现分享功能
    wx.showActionSheet({
      itemList: ['复制文本', '保存图片', '分享给朋友'],
      success: (res) => {
        switch (res.tapIndex) {
          case 0:
            this.copyText();
            break;
          case 1:
            this.saveImage();
            break;
          case 2:
            this.shareToFriend();
            break;
        }
      }
    });
  },

  /**
   * 保存图片
   */
  saveImage() {
    if (!this.data.originalImagePath) {
      wx.showToast({
        title: '没有可保存的图片',
        icon: 'none'
      });
      return;
    }
    
    wx.saveImageToPhotosAlbum({
      filePath: this.data.originalImagePath,
      success: () => {
        wx.showToast({
          title: '图片已保存到相册',
          icon: 'success'
        });
      },
      fail: (error) => {
        console.error('保存图片失败:', error);
        wx.showToast({
          title: '保存失败',
          icon: 'error'
        });
      }
    });
  },

  /**
   * 分享给朋友
   */
  shareToFriend() {
    // 实现分享逻辑
    wx.showToast({
      title: '分享功能开发中',
      icon: 'none'
    });
  },

  /**
   * 显示错误信息
   */
  showError(message) {
    wx.showModal({
      title: '错误',
      content: message,
      showCancel: false,
      success: () => {
        wx.navigateBack();
      }
    });
  },

  /**
   * 返回上一页
   */
  goBack() {
    wx.navigateBack();
  }
});
