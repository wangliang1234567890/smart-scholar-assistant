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
    currentTime: new Date(),
    
    // 存储信息
    cacheSize: '计算中...',
    lastBackupTime: '未备份'
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this.loadUserSettings();
    this.loadStorageInfo();
    this.updateLabels();
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    // 每次显示时更新存储信息
    this.loadStorageInfo();
  },

  /**
   * 加载用户设置
   */
  loadUserSettings() {
    try {
      const savedSettings = wx.getStorageSync('userSettings');
      if (savedSettings) {
        this.setData({
          userSettings: { ...this.data.userSettings, ...savedSettings }
        });
        this.updateLabels();
      }
    } catch (error) {
      console.error('加载设置失败:', error);
    }
  },

  /**
   * 保存用户设置
   */
  saveUserSettings() {
    try {
      wx.setStorageSync('userSettings', this.data.userSettings);
      console.log('设置已保存');
    } catch (error) {
      console.error('保存设置失败:', error);
    }
  },

  /**
   * 更新标签文本
   */
  updateLabels() {
    const { userSettings, settingOptions } = this.data;
    
    // 更新复习间隔标签
    const reviewInterval = settingOptions.reviewIntervals.find(
      item => item.value === userSettings.reviewInterval
    );
    
    // 更新练习模式标签
    const practiceMode = settingOptions.practiceModes.find(
      item => item.value === userSettings.practiceMode
    );
    
    // 更新难度等级标签
    const difficultyLevel = settingOptions.difficultyLevels.find(
      item => item.value === userSettings.difficultyLevel
    );
    
    // 更新主题标签
    const theme = settingOptions.themes.find(
      item => item.value === userSettings.theme
    );
    
    // 更新字体大小标签
    const fontSize = settingOptions.fontSizes.find(
      item => item.value === userSettings.fontSize
    );
    
    this.setData({
      reviewIntervalLabel: reviewInterval ? reviewInterval.label : '1天',
      practiceModeLabel: practiceMode ? practiceMode.label : '随机模式',
      difficultyLevelLabel: difficultyLevel ? difficultyLevel.label : '中等',
      themeLabel: theme ? theme.label : '跟随系统',
      fontSizeLabel: fontSize ? fontSize.label : '中等'
    });
  },

  /**
   * 加载存储信息
   */
  async loadStorageInfo() {
    try {
      // 获取存储信息
      const storageInfo = wx.getStorageInfoSync();
      const cacheSizeKB = storageInfo.currentSize || 0;
      
      // 格式化缓存大小
      let formattedSize = '0 MB';
      if (cacheSizeKB < 1024) {
        formattedSize = `${cacheSizeKB} KB`;
      } else {
        const sizeMB = (cacheSizeKB / 1024).toFixed(1);
        formattedSize = `${sizeMB} MB`;
      }
      
      // 获取最后备份时间
      const lastBackup = wx.getStorageSync('lastBackupTime');
      const backupTimeText = lastBackup ? 
        new Date(lastBackup).toLocaleDateString('zh-CN') : '未备份';
      
      this.setData({
        cacheSize: formattedSize,
        lastBackupTime: backupTimeText
      });
      
    } catch (error) {
      console.error('加载存储信息失败:', error);
      this.setData({
        cacheSize: '0 MB',
        lastBackupTime: '未备份'
      });
    }
  },

  /**
   * 开关切换事件
   */
  onToggleChange(event) {
    const { key } = event.currentTarget.dataset;
    const value = event.detail;
    
    this.setData({
      [`userSettings.${key}`]: value
    });
    
    this.saveUserSettings();
    
    // 提供触觉反馈
    if (this.data.userSettings.vibrationEnabled) {
      wx.vibrateShort();
    }
    
    // 特殊处理
    if (key === 'theme') {
      this.applyTheme(value);
    }
  },

  /**
   * 选择器改变事件
   */
  onPickerChange(event) {
    const { key, options } = event.currentTarget.dataset;
    const index = event.detail.value;
    const selectedOption = this.data.settingOptions[options][index];
    
    this.setData({
      [`userSettings.${key}`]: selectedOption.value
    });
    
    this.saveUserSettings();
    this.updateLabels();
    
    // 提供触觉反馈
    if (this.data.userSettings.vibrationEnabled) {
      wx.vibrateShort();
    }
  },

  /**
   * 时间选择
   */
  onTimeChange(event) {
    const time = event.detail.value;
    
    this.setData({
      'userSettings.reminderTime': time
    });
    
    this.saveUserSettings();
    
    wx.showToast({
      title: `提醒时间已设为 ${time}`,
      icon: 'success'
    });
  },

  /**
   * 显示时间选择器
   */
  showTimePicker() {
    const time = this.data.userSettings.reminderTime.split(':');
    const currentTime = new Date();
    currentTime.setHours(parseInt(time[0]), parseInt(time[1]), 0, 0);
    
    this.setData({
      showTimePicker: true,
      currentTime: currentTime
    });
  },

  /**
   * 隐藏时间选择器
   */
  hideTimePicker() {
    this.setData({
      showTimePicker: false
    });
  },

  /**
   * 确认时间选择
   */
  confirmTime(event) {
    const selectedTime = new Date(event.detail);
    const hours = selectedTime.getHours().toString().padStart(2, '0');
    const minutes = selectedTime.getMinutes().toString().padStart(2, '0');
    const timeString = `${hours}:${minutes}`;
    
    this.setData({
      'userSettings.reminderTime': timeString,
      showTimePicker: false
    });
    
    this.saveUserSettings();
    
    wx.showToast({
      title: `提醒时间已设为 ${timeString}`,
      icon: 'success'
    });
  },

  /**
   * 应用主题
   */
  applyTheme(theme) {
    // 实际应用中可以在这里设置全局主题
    console.log('应用主题:', theme);
    
    // 可以通过CSS变量或者App全局状态来实现主题切换
    // 这里只是示例
    const app = getApp();
    if (app.globalData) {
      app.globalData.theme = theme;
    }
    
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
      // 显示加载
      wx.showLoading({
        title: '清理中...'
      });
      
      // 清理特定的缓存数据，保留用户设置和重要数据
      const keysToKeep = ['userSettings', 'userInfo', 'userId', 'lastBackupTime'];
      const storageInfo = wx.getStorageInfoSync();
      
      let clearedCount = 0;
      storageInfo.keys.forEach(key => {
        if (!keysToKeep.includes(key) && key.indexOf('cache_') === 0) {
          try {
            wx.removeStorageSync(key);
            clearedCount++;
          } catch (error) {
            console.warn('清理缓存项失败:', key, error);
          }
        }
      });
      
      wx.hideLoading();
      
      wx.showToast({
        title: `清理完成，释放 ${clearedCount} 项`,
        icon: 'success'
      });
      
      // 重新加载存储信息
      setTimeout(() => {
        this.loadStorageInfo();
      }, 1500);
      
    } catch (error) {
      console.error('清理缓存失败:', error);
      wx.hideLoading();
      wx.showToast({
        title: '清理失败',
        icon: 'none'
      });
    }
  },

  /**
   * 数据备份
   */
  async onDataBackup() {
    try {
      wx.showLoading({
        title: '备份中...'
      });
      
      const userId = DatabaseManager.getCurrentUserId();
      
      // 获取所有需要备份的数据
      const [mistakeResult, courseResult, reviewResult, practiceResult] = await Promise.all([
        DatabaseManager.getMistakes(userId, { pageSize: 1000 }),
        DatabaseManager.getCourses(userId, { pageSize: 1000 }),
        DatabaseManager.getReviewRecords(userId, { pageSize: 1000 }),
        DatabaseManager.getPracticeRecords(userId, { pageSize: 1000 })
      ]);
      
      const backupData = {
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        settings: this.data.userSettings,
        mistakes: mistakeResult.success ? mistakeResult.data : [],
        courses: courseResult.success ? courseResult.data : [],
        reviews: reviewResult.success ? reviewResult.data : [],
        practices: practiceResult.success ? practiceResult.data : []
      };
      
      // 保存备份到本地存储
      wx.setStorageSync('lastBackupData', backupData);
      wx.setStorageSync('lastBackupTime', Date.now());
      
      wx.hideLoading();
      
      const dataCount = backupData.mistakes.length + backupData.courses.length;
      
      wx.showToast({
        title: `备份完成，${dataCount} 条数据`,
        icon: 'success'
      });
      
      // 更新备份时间显示
      this.setData({
        lastBackupTime: new Date().toLocaleDateString('zh-CN')
      });
      
    } catch (error) {
      console.error('数据备份失败:', error);
      wx.hideLoading();
      wx.showToast({
        title: '备份失败',
        icon: 'none'
      });
    }
  },

  /**
   * 导航到其他页面
   */
  onNavigateToPage(event) {
    const { url } = event.currentTarget.dataset;
    if (url) {
      wx.navigateTo({
        url: url,
        fail: (error) => {
          console.error('页面跳转失败:', error);
          wx.showToast({
            title: '页面暂未开放',
            icon: 'none'
          });
        }
      });
    }
  }
}) 