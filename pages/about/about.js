// pages/about/about.js
Page({
  /**
   * 页面的初始数据
   */
  data: {
    // 应用信息
    appInfo: {
      name: '智能学霸小助手',
      version: '1.0.0',
      buildNumber: '2025012501',
      description: '基于AI技术的智能学习助手，帮助学生高效管理错题、制定学习计划，提升学习效果。',
      logo: '/images/app-logo-light.svg'
    },
    
    // 开发团队
    team: [
      {
        name: '产品经理',
        role: '产品设计与规划',
        avatar: '/images/default-avatar.png'
      },
      {
        name: '技术负责人',
        role: '架构设计与开发',
        avatar: '/images/default-avatar.png'
      },
      {
        name: 'AI算法工程师',
        role: 'AI模型训练与优化',
        avatar: '/images/default-avatar.png'
      },
      {
        name: 'UI设计师',
        role: '界面设计与用户体验',
        avatar: '/images/default-avatar.png'
      }
    ],
    
    // 功能特色
    features: [
      {
        icon: '/images/icons/camera.svg',
        title: '智能拍照识题',
        desc: '一键拍照，AI自动识别题目内容'
      },
      {
        icon: '/images/icons/brain.svg',
        title: 'AI个性化练习',
        desc: '基于错题分析，生成专属练习题'
      },
      {
        icon: '/images/icons/file-pen-line.svg',
        title: '错题本管理',
        desc: '科学的错题分类与复习提醒'
      },
      {
        icon: '/images/icons/homework.svg',
        title: '学习计划',
        desc: '智能制定个性化学习计划'
      }
    ],
    
    // 更新日志
    changelog: [
      {
        version: '1.0.0',
        date: '2025-01-25',
        changes: [
          '🎉 首次发布',
          '✨ 新增AI智能练习功能',
          '📸 支持拍照录题',
          '📚 完善错题本管理',
          '📅 课程表功能',
          '📊 学习数据分析'
        ]
      }
    ],
    
    // 联系方式
    contact: {
      email: 'support@smartstudy.com',
      website: 'https://www.smartstudy.com',
      wechat: 'SmartStudyApp'
    },
    
    // 法律信息
    legal: {
      privacy: '/pages/legal/privacy',
      terms: '/pages/legal/terms',
      copyright: '© 2025 智能学霸小助手团队'
    }
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    console.log('关于页面加载');
    this.loadAppInfo();
  },

  /**
   * 导航返回
   */
  onNavBack() {
    wx.navigateBack();
  },

  /**
   * 加载应用信息
   */
  loadAppInfo() {
    try {
      // 获取应用版本信息
      const systemInfo = wx.getSystemInfoSync();
      const { appInfo } = this.data;
      
      this.setData({
        appInfo: {
          ...appInfo,
          platform: systemInfo.platform,
          sdkVersion: systemInfo.SDKVersion
        }
      });
      
    } catch (error) {
      console.error('加载应用信息失败:', error);
    }
  },

  /**
   * 复制文本
   */
  copyText(e) {
    const { text } = e.currentTarget.dataset;
    wx.setClipboardData({
      data: text,
      success: () => {
        wx.showToast({
          title: '已复制到剪贴板',
          icon: 'success'
        });
      }
    });
  },

  /**
   * 发送邮件
   */
  sendEmail() {
    wx.showModal({
      title: '联系我们',
      content: `请发送邮件至：${this.data.contact.email}`,
      confirmText: '复制邮箱',
      success: (res) => {
        if (res.confirm) {
          this.copyText({
            currentTarget: {
              dataset: {
                text: this.data.contact.email
              }
            }
          });
        }
      }
    });
  },

  /**
   * 访问官网
   */
  visitWebsite() {
    wx.showModal({
      title: '访问官网',
      content: `官网地址：${this.data.contact.website}`,
      confirmText: '复制链接',
      success: (res) => {
        if (res.confirm) {
          this.copyText({
            currentTarget: {
              dataset: {
                text: this.data.contact.website
              }
            }
          });
        }
      }
    });
  },

  /**
   * 添加微信
   */
  addWechat() {
    wx.showModal({
      title: '添加微信',
      content: `微信号：${this.data.contact.wechat}`,
      confirmText: '复制微信号',
      success: (res) => {
        if (res.confirm) {
          this.copyText({
            currentTarget: {
              dataset: {
                text: this.data.contact.wechat
              }
            }
          });
        }
      }
    });
  },

  /**
   * 检查更新
   */
  checkUpdate() {
    const updateManager = wx.getUpdateManager();
    
    wx.showLoading({
      title: '检查更新中...'
    });
    
    updateManager.checkForUpdate();
    
    updateManager.onCheckForUpdate((res) => {
      wx.hideLoading();
      
      if (res.hasUpdate) {
        wx.showModal({
          title: '发现新版本',
          content: '发现新版本，是否立即更新？',
          success: (modalRes) => {
            if (modalRes.confirm) {
              wx.showLoading({
                title: '下载更新中...'
              });
              updateManager.applyUpdate();
            }
          }
        });
      } else {
        wx.showToast({
          title: '已是最新版本',
          icon: 'none'
        });
      }
    });
    
    updateManager.onUpdateReady(() => {
      wx.hideLoading();
      wx.showModal({
        title: '更新完成',
        content: '新版本已准备好，是否立即重启应用？',
        success: (res) => {
          if (res.confirm) {
            updateManager.applyUpdate();
          }
        }
      });
    });
    
    updateManager.onUpdateFailed(() => {
      wx.hideLoading();
      wx.showToast({
        title: '更新失败',
        icon: 'none'
      });
    });
  },

  /**
   * 查看隐私政策
   */
  viewPrivacy() {
    wx.navigateTo({
      url: this.data.legal.privacy
    });
  },

  /**
   * 查看用户协议
   */
  viewTerms() {
    wx.navigateTo({
      url: this.data.legal.terms
    });
  },

  /**
   * 意见反馈
   */
  feedback() {
    wx.navigateTo({
      url: '/pages/feedback/feedback'
    });
  },

  /**
   * 分享应用
   */
  shareApp() {
    return {
      title: this.data.appInfo.name,
      desc: this.data.appInfo.description,
      path: '/pages/home/home'
    };
  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {
    return this.shareApp();
  },

  /**
   * 分享到朋友圈
   */
  onShareTimeline() {
    return this.shareApp();
  }
})