// pages/settings/settings.js
import DatabaseManager from '../../utils/database.js';

Page({
  /**
   * 页面的初始数据
   */
  data: {
    loading: false,
    
    // 用户设置
    userSettings: {
      reminderEnabled: true,
      reminderTime: '19:00',
      reviewInterval: 1,
      practiceMode: 'random',
      difficultyLevel: 'medium',
      theme: 'auto',
      fontSize: 'medium',
      soundEnabled: true,
      vibrationEnabled: true,
      autoSync: true
    },
    
    // 计算后的标签文本 - 避免在WXML中使用复杂表达式
    reviewIntervalLabel: '1天',
    practiceModeLabel: '随机模式',
    difficultyLevelLabel: '中等',
    themeLabel: '跟随系统',
    fontSizeLabel: '中等',
    
    // 设置选项
    settingOptions: {
      reviewIntervals: [
        { value: 1, label: '1天' },
        { value: 3, label: '3天' },
        { value: 7, label: '1周' },
        { value: 14, label: '2周' },
        { value: 30, label: '1月' }
      ],
      practiceModes: [
        { value: 'random', label: '随机模式' },
        { value: 'sequential', label: '顺序模式' },
        { value: 'adaptive', label: '自适应' }
      ],
      difficultyLevels: [
        { value: 'easy', label: '简单' },
        { value: 'medium', label: '中等' },
        { value: 'hard', label: '困难' },
        { value: 'auto', label: '自动调整' }
      ],
      themes: [
        { value: 'light', label: '浅色主题' },
        { value: 'dark', label: '深色主题' },
        { value: 'auto', label: '跟随系统' }
      ],
      fontSizes: [
        { value: 'small', label: '小' },
        { value: 'medium', label: '中等' },
        { value: 'large', label: '大' },
        { value: 'xlarge', label: '特大' }
      ]
    },
    
    // 弹窗状态
    showTimePicker: false,
    showActionSheet: false,
    currentActionType: '',
    
    // 统计数据
    storageInfo: {
      usedStorage: 0,
      totalMistakes: 0,
      totalCourses: 0,
      cacheSize: 0
    },
    
    // 存储信息
    cacheSize: '0 MB',
    lastBackupTime: '未备份'
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this.loadUserSettings();
    this.loadStorageInfo();
  },

  /**
   * 导航返回
   */
  onNavBack() {
    wx.navigateBack();
  },

  /**
   * 加载用户设置
   */
  loadUserSettings() {
    try {
      const savedSettings = wx.getStorageSync('userSettings');
      if (savedSettings) {
        this.setData({
          userSettings: {
            ...this.data.userSettings,
            ...savedSettings
          }
        });
      }
      // 更新标签文本
      this.updateLabels();
    } catch (error) {
      console.error('加载用户设置失败:', error);
    }
  },

  /**
   * 更新标签文本 - 避免在WXML中使用复杂表达式
   */
  updateLabels() {
    const { userSettings, settingOptions } = this.data;
    
    // 查找对应的标签文本
    const reviewIntervalLabel = settingOptions.reviewIntervals.find(item => item.value === userSettings.reviewInterval)?.label || '1天';
    const practiceModeLabel = settingOptions.practiceModes.find(item => item.value === userSettings.practiceMode)?.label || '随机模式';
    const difficultyLevelLabel = settingOptions.difficultyLevels.find(item => item.value === userSettings.difficultyLevel)?.label || '中等';
    const themeLabel = settingOptions.themes.find(item => item.value === userSettings.theme)?.label || '跟随系统';
    const fontSizeLabel = settingOptions.fontSizes.find(item => item.value === userSettings.fontSize)?.label || '中等';
    
    this.setData({
      reviewIntervalLabel,
      practiceModeLabel,
      difficultyLevelLabel,
      themeLabel,
      fontSizeLabel
    });
  },

  /**
   * 切换开关设置
   */
  onToggleChange(e) {
    const { key } = e.currentTarget.dataset;
    const { value } = e.detail;
    
    const userSettings = { ...this.data.userSettings };
    userSettings[key] = value;
    
    this.setData({ userSettings });
    this.saveUserSettings(userSettings);
  },

  /**
   * 时间选择器变化
   */
  onTimeChange(e) {
    const { value } = e.detail;
    const userSettings = { ...this.data.userSettings };
    userSettings.reminderTime = value;
    
    this.setData({ userSettings });
    this.saveUserSettings(userSettings);
  },

  /**
   * 选择器变化
   */
  onPickerChange(e) {
    const { key } = e.currentTarget.dataset;
    const { value } = e.detail;
    const options = this.data.settingOptions[e.currentTarget.dataset.options];
    
    if (options && options[value]) {
      const userSettings = { ...this.data.userSettings };
      userSettings[key] = options[value].value;
      
      this.setData({ userSettings });
      this.updateLabels(); // 更新标签文本
      this.saveUserSettings(userSettings);
    }
  },

  /**
   * 保存用户设置
   */
  saveUserSettings(settings) {
    try {
      wx.setStorageSync('userSettings', settings);
      console.log('用户设置已保存:', settings);
    } catch (error) {
      console.error('保存用户设置失败:', error);
      wx.showToast({
        title: '设置保存失败',
        icon: 'error'
      });
    }
  },

  /**
   * 加载存储信息
   */
  async loadStorageInfo() {
    try {
      const userId = DatabaseManager.getCurrentUserId();
      
      // 获取存储统计
      const [mistakeResult, courseResult] = await Promise.all([
        DatabaseManager.getMistakes(userId, { pageSize: 1000 }),
        DatabaseManager.getCourses(userId, { pageSize: 1000 })
      ]);
      
      // 计算缓存大小
      const storageInfo = wx.getStorageInfoSync();
      
      this.setData({
        storageInfo: {
          usedStorage: Math.round(storageInfo.currentSize),
          totalMistakes: mistakeResult.success ? mistakeResult.data.length : 0,
          totalCourses: courseResult.success ? courseResult.data.length : 0,
          cacheSize: Math.round(storageInfo.currentSize * 0.3) // 估算缓存大小
        }
      });
      
    } catch (error) {
      console.error('加载存储信息失败:', error);
    }
  },

  /**
   * 应用主题
   */
  applyTheme(theme) {
    // 实际应用中可以在这里设置全局主题
    console.log('应用主题:', theme);
    wx.showToast({
      title: '主题已更改',
      icon: 'success'
    });
  },

  /**
   * 清理缓存
   */
  onClearCache() {
    wx.showModal({
      title: '清理缓存',
      content: '确定要清理应用缓存吗？这不会删除您的学习数据。',
      success: (res) => {
        if (res.confirm) {
          this.clearCache();
        }
      }
    });
  },

  /**
   * 执行清理缓存
   */
  clearCache() {
    try {
      // 清理特定的缓存数据，保留用户设置和重要数据
      const keysToKeep = ['userSettings', 'userInfo', 'userId'];
      const storageInfo = wx.getStorageInfoSync();
      
      storageInfo.keys.forEach(key => {
        if (!keysToKeep.includes(key)) {
          try {
            wx.removeStorageSync(key);
          } catch (error) {
            console.warn('清理缓存项失败:', key, error);
          }
        }
      });
      
      wx.showToast({
        title: '缓存清理完成',
        icon: 'success'
      });
      
      // 重新加载存储信息
      setTimeout(() => {
        this.loadStorageInfo();
      }, 1000);
      
    } catch (error) {
      console.error('清理缓存失败:', error);
      wx.showToast({
        title: '清理失败',
        icon: 'none'
      });
    }
  },

  /**
   * 数据备份
   */
  onDataBackup() {
    wx.showActionSheet({
      itemList: ['备份到云端', '导出数据', '恢复数据'],
      success: (res) => {
        switch (res.tapIndex) {
          case 0:
            this.backupToCloud();
            break;
          case 1:
            this.exportData();
            break;
          case 2:
            this.restoreData();
            break;
        }
      }
    });
  },

  /**
   * 备份到云端
   */
  async backupToCloud() {
    try {
      wx.showLoading({ title: '备份中...' });
      
      const userId = DatabaseManager.getCurrentUserId();
      
      // 获取所有数据
      const [mistakeResult, courseResult] = await Promise.all([
        DatabaseManager.getMistakes(userId, { pageSize: 1000 }),
        DatabaseManager.getCourses(userId, { pageSize: 1000 })
      ]);
      
      const backupData = {
        userId,
        timestamp: new Date().toISOString(),
        mistakes: mistakeResult.success ? mistakeResult.data : [],
        courses: courseResult.success ? courseResult.data : [],
        settings: this.data.userSettings
      };
      
      // 模拟云端备份（实际项目中应该调用真实的备份API）
      wx.setStorageSync('cloudBackup', backupData);
      
      wx.hideLoading();
      wx.showToast({
        title: '备份成功',
        icon: 'success'
      });
      
    } catch (error) {
      wx.hideLoading();
      console.error('备份失败:', error);
      wx.showToast({
        title: '备份失败',
        icon: 'none'
      });
    }
  },

  /**
   * 导出数据
   */
  exportData() {
    wx.showModal({
      title: '导出数据',
      content: '数据导出功能将在未来版本中提供',
      showCancel: false
    });
  },

  /**
   * 恢复数据
   */
  restoreData() {
    wx.showModal({
      title: '恢复数据',
      content: '确定要从云端恢复数据吗？这将覆盖当前的所有数据。',
      success: (res) => {
        if (res.confirm) {
          this.performDataRestore();
        }
      }
    });
  },

  /**
   * 执行数据恢复
   */
  performDataRestore() {
    try {
      const backupData = wx.getStorageSync('cloudBackup');
      if (!backupData) {
        wx.showToast({
          title: '没有找到备份数据',
          icon: 'none'
        });
        return;
      }
      
      // 恢复设置
      this.setData({
        userSettings: backupData.settings || this.data.userSettings
      });
      this.saveUserSettings();
      
      wx.showToast({
        title: '数据恢复完成',
        icon: 'success'
      });
      
    } catch (error) {
      console.error('数据恢复失败:', error);
      wx.showToast({
        title: '恢复失败',
        icon: 'none'
      });
    }
  },

  /**
   * 重置设置
   */
  onResetSettings() {
    wx.showModal({
      title: '重置设置',
      content: '确定要将所有设置恢复为默认值吗？',
      success: (res) => {
        if (res.confirm) {
          // 恢复默认设置
          this.setData({
            userSettings: {
              studyReminder: true,
              reminderTime: '19:00',
              reviewInterval: 'smart',
              practiceMode: 'mixed',
              difficultyLevel: 'adaptive',
              theme: 'auto',
              language: 'zh-cn',
              fontSize: 'medium',
              autoSync: true,
              wifiOnlySync: false,
              allowAnalytics: true,
              shareProgress: false,
              mistakeReminder: true,
              practiceReminder: true,
              achievementNotification: true
            }
          });
          
          this.saveUserSettings();
          
          wx.showToast({
            title: '设置已重置',
            icon: 'success'
          });
        }
      }
    });
  },

  /**
   * 意见反馈
   */
  onFeedback() {
    wx.navigateTo({
      url: '/pages/feedback/feedback'
    });
  },

  /**
   * 帮助中心
   */
  onHelp() {
    wx.navigateTo({
      url: '/pages/help/help'
    });
  },

  /**
   * 关于我们
   */
  onAbout() {
    wx.navigateTo({
      url: '/pages/about/about'
    });
  },

  /**
   * 检查更新
   */
  onCheckUpdate() {
    const updateManager = wx.getUpdateManager();
    
    updateManager.checkForUpdate();
    
    updateManager.onCheckForUpdate((res) => {
      if (res.hasUpdate) {
        wx.showModal({
          title: '发现新版本',
          content: '发现新版本，是否立即更新？',
          success: (modalRes) => {
            if (modalRes.confirm) {
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
    
    updateManager.onUpdateFailed(() => {
      wx.showToast({
        title: '更新失败',
        icon: 'none'
      });
    });
  },

  /**
   * 退出登录
   */
  onLogout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出当前账号吗？',
      success: (res) => {
        if (res.confirm) {
          // 清除用户数据
          wx.removeStorageSync('userId');
          wx.removeStorageSync('userInfo');
          
          // 跳转到登录页
          wx.reLaunch({
            url: '/pages/login/login'
          });
        }
      }
    });
  }
}) 