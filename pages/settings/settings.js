import { getUserInfo, updateUserSettings } from '../../utils/auth'

Page({
  data: {
    userInfo: {
      nickname: '智能学霸',
      grade: '高一',
      avatar: ''
    },
    selectedSubjects: ['数学', '语文', '英语'],
    settings: {
      studyReminder: true,
      reminderTime: '19:00',
      soundEnabled: true,
      eyeProtection: false,
      dailyGoal: 20,
      recordVisible: true
    },
    lastBackupTime: '2024-01-15',
    cacheSize: '45.2MB',
    appVersion: '1.0.0',
    
    // 弹出层控制
    showTimePicker: false,
    showGoalPicker: false,
    currentTime: '19:00',
    goalColumns: [
      { text: '10题', value: 10 },
      { text: '20题', value: 20 },
      { text: '30题', value: 30 },
      { text: '50题', value: 50 },
      { text: '100题', value: 100 }
    ]
  },

  onLoad(options) {
    this.loadUserInfo()
    this.loadSettings()
  },

  onShow() {
    // 页面显示时重新加载数据
    this.loadUserInfo()
  },

  onPullDownRefresh() {
    this.loadUserInfo()
    this.loadSettings()
    wx.stopPullDownRefresh()
  },

  // 加载用户信息
  async loadUserInfo() {
    try {
      const userInfo = await getUserInfo()
      this.setData({ userInfo })
    } catch (error) {
      console.error('加载用户信息失败:', error)
    }
  },

  // 加载设置信息
  loadSettings() {
    const settings = wx.getStorageSync('userSettings') || this.data.settings
    this.setData({ settings })
  },

  // 编辑个人资料
  editProfile() {
    wx.navigateTo({
      url: '/pages/profile/edit/edit'
    })
  },

  // 修改年级
  editGrade() {
    const grades = ['小学一年级', '小学二年级', '小学三年级', '小学四年级', '小学五年级', '小学六年级',
                   '初一', '初二', '初三', '高一', '高二', '高三']
    
    wx.showActionSheet({
      itemList: grades,
      success: (res) => {
        const selectedGrade = grades[res.tapIndex]
        this.setData({
          'userInfo.grade': selectedGrade
        })
        this.updateUserInfo()
      }
    })
  },

  // 编辑学科偏好
  editSubjects() {
    wx.navigateTo({
      url: '/pages/subjects/select/select'
    })
  },

  // 学习提醒开关
  onReminderChange(e) {
    const checked = e.detail
    this.setData({
      'settings.studyReminder': checked
    })
    this.saveSettings()
    
    if (checked) {
      this.scheduleNotification()
    } else {
      this.cancelNotification()
    }
  },

  // 设置学习时间
  setStudyTime() {
    this.setData({ 
      showTimePicker: true,
      currentTime: this.data.settings.reminderTime
    })
  },

  // 确认时间选择
  confirmTime(e) {
    const time = e.detail
    this.setData({
      'settings.reminderTime': time,
      showTimePicker: false
    })
    this.saveSettings()
    this.scheduleNotification()
  },

  // 隐藏时间选择器
  hideTimePicker() {
    this.setData({ showTimePicker: false })
  },

  // 音效开关
  onSoundChange(e) {
    const checked = e.detail
    this.setData({
      'settings.soundEnabled': checked
    })
    this.saveSettings()
  },

  // 护眼模式开关
  onEyeProtectionChange(e) {
    const checked = e.detail
    this.setData({
      'settings.eyeProtection': checked
    })
    this.saveSettings()
    
    // 调整页面样式
    if (checked) {
      wx.setBackgroundColor({
        backgroundColor: '#2d3748',
        backgroundColorTop: '#2d3748',
        backgroundColorBottom: '#2d3748'
      })
    } else {
      wx.setBackgroundColor({
        backgroundColor: '#f8fafc',
        backgroundColorTop: '#f8fafc',
        backgroundColorBottom: '#f8fafc'
      })
    }
  },

  // 设置每日目标
  setDailyGoal() {
    this.setData({ showGoalPicker: true })
  },

  // 确认目标选择
  confirmGoal(e) {
    const value = e.detail.value
    this.setData({
      'settings.dailyGoal': value,
      showGoalPicker: false
    })
    this.saveSettings()
  },

  // 隐藏目标选择器
  hideGoalPicker() {
    this.setData({ showGoalPicker: false })
  },

  // 学习记录可见性
  onRecordVisibleChange(e) {
    const checked = e.detail
    this.setData({
      'settings.recordVisible': checked
    })
    this.saveSettings()
  },

  // 修改密码
  changePassword() {
    wx.navigateTo({
      url: '/pages/auth/change-password/change-password'
    })
  },

  // 数据备份
  dataBackup() {
    wx.showLoading({ title: '备份中...' })
    
    setTimeout(() => {
      wx.hideLoading()
      this.setData({
        lastBackupTime: new Date().toISOString().split('T')[0]
      })
      wx.showToast({
        title: '备份成功',
        icon: 'success'
      })
    }, 2000)
  },

  // 清理缓存
  clearCache() {
    wx.showModal({
      title: '确认操作',
      content: '确定要清除本地缓存吗？这可能会导致部分数据需要重新加载。',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '清理中...' });
          try {
            wx.clearStorageSync();
            setTimeout(() => {
              wx.hideLoading();
              wx.showToast({
                title: '清理完成',
                icon: 'success'
              });
            }, 1000);
          } catch (e) {
            wx.hideLoading();
            wx.showToast({
              title: '清理失败',
              icon: 'error'
            });
          }
        }
      }
    })
  },

  // 检查更新
  checkUpdate() {
    wx.showLoading({ title: '检查中...' })
    
    setTimeout(() => {
      wx.hideLoading()
      wx.showToast({
        title: '已是最新版本',
        icon: 'success'
      })
    }, 1000)
  },

  // 关于我们
  aboutUs() {
    wx.navigateTo({
      url: '/pages/about/about'
    })
  },

  // 意见反馈
  feedback() {
    wx.navigateTo({
      url: '/pages/feedback/feedback'
    })
  },

  // 退出登录
  logout() {
    wx.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          // 清除用户数据
          wx.clearStorageSync()
          
          // 跳转到登录页
          wx.reLaunch({
            url: '/pages/login/login'
          })
        }
      }
    })
  },

  // 保存设置
  saveSettings() {
    wx.setStorageSync('userSettings', this.data.settings)
  },

  // 更新用户信息
  async updateUserInfo() {
    try {
      await updateUserSettings(this.data.userInfo)
      wx.showToast({
        title: '保存成功',
        icon: 'success'
      })
    } catch (error) {
      console.error('更新用户信息失败:', error)
      wx.showToast({
        title: '保存失败',
        icon: 'error'
      })
    }
  },

  // 安排通知
  scheduleNotification() {
    // 这里可以集成推送通知功能
    console.log('安排学习提醒:', this.data.settings.reminderTime)
  },

  // 取消通知
  cancelNotification() {
    console.log('取消学习提醒')
  }
}) 