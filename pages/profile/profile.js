const app = getApp()
import DatabaseManager from '../../utils/database.js';

Page({
  data: {
    // 用户信息
    userInfo: {
      nickName: '小星星',
      avatarUrl: '/images/default-avatar.png',
      level: 5,
      exp: 450,
    },
    // 统计数据
    stats: [
      {
        icon: '/images/icons/total-mistakes.svg',
        value: 128,
        label: '错题总数',
      },
      {
        icon: '/images/icons/level-badge.svg',
        value: 12,
        label: '获得成就',
      },
      {
        icon: '/images/icons/calendar-days.svg',
        value: 88,
        label: '学习天数',
      },
    ],
    // 功能菜单
    menuItems: [
      {
        icon: '/images/icons/trophy-color.svg',
        title: '我的成就',
        url: '/pages/achievements/achievements',
        bgColor: '#FFFBEB',
      },
      {
        icon: '/images/icons/report-color.svg',
        title: '学习报告',
        url: '/pages/report/report',
        bgColor: '#EBF5FF',
      },
      {
        icon: '/images/icons/children-color.svg',
        title: '孩子管理',
        url: '/pages/child/management',
        bgColor: '#E6F7F2',
      },
      {
        icon: '/images/icons/settings-color.svg',
        title: '设置中心',
        url: '/pages/settings/settings',
        bgColor: '#F3F4F6',
      },
      {
        icon: '/images/icons/info-color.svg',
        title: '关于我们',
        url: '/pages/about/about',
        bgColor: '#F0EFFF',
      },
    ],
    nextLevelExp: 1000,
    expRate: 0,
    achievements: {
      unlocked: 12,
      total: 50
    },
    studyDays: 88,
    loading: false,
    
    // 计算属性
    expProgressPercent: 0
  },

  onLoad(options) {
    // 在真实应用中，这里会从全局状态或API获取用户信息
    // this.setData({
    //   userInfo: getApp().globalData.userInfo
    // });
    this.calculateExpRate()
  },

  onShow() {
    // 更新tabBar状态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setActiveTab(4);
    }
    
    const app = getApp()
    if (app.globalData.userInfo) {
      this.setData({
        userInfo: { ...this.data.userInfo, ...app.globalData.userInfo }
      })
    }
    this.calculateExpRate()
  },

  onPullDownRefresh() {
    this.loadUserInfo()
    this.loadUserStats()
    wx.stopPullDownRefresh()
  },

  // 加载用户信息
  loadUserInfo() {
    // 尝试获取微信用户信息
    const userInfo = wx.getStorageSync('userInfo')
    if (userInfo) {
      this.setData({
        userInfo: {
          ...this.data.userInfo,
          ...userInfo
        }
      })
    }
  },

  // 加载用户统计数据
  async loadUserStats() {
    try {
      const userId = wx.getStorageSync('userId') || 'default_user';
      console.log('加载用户统计数据...');
      
      // 从数据库获取真实统计数据
      const statsResult = await DatabaseManager.getTodayStats(userId);
      
      if (statsResult.success) {
        const stats = {
          totalMistakes: statsResult.data.totalMistakes || 0,
          studyDays: Math.max(1, Math.floor((Date.now() - (new Date('2025-07-25')).getTime()) / (1000 * 60 * 60 * 24))), // 计算从第一次使用到现在的天数
          masteryRate: statsResult.data.masteryRate || 0,
          reviewTasks: statsResult.data.reviewTasks || 0
        };
        
        this.setData({ stats });
        console.log('用户统计数据加载完成:', stats);
      } else {
        // 设置默认统计数据
        this.setData({ 
          stats: {
            totalMistakes: 0,
            studyDays: 1,
            masteryRate: 0,
            reviewTasks: 0
          }
        });
      }
    } catch (error) {
      console.error('加载用户统计数据失败:', error);
      // 设置默认统计数据
      this.setData({ 
        stats: {
          totalMistakes: 0,
          studyDays: 1,
          masteryRate: 0,
          reviewTasks: 0
        }
      });
    }
  },

  // 编辑个人资料
  onEditProfile() {
    wx.navigateTo({
      url: '/pages/profile/edit'
    })
  },

  // 查看错题
  onViewMistakes() {
    wx.switchTab({
      url: '/pages/mistakes/mistakes'
    })
  },

  // 查看成就
  onViewAchievements() {
    wx.navigateTo({
      url: '/pages/achievements/achievements'
    })
  },

  // 查看报告
  onViewReport() {
    wx.navigateTo({
      url: '/pages/report/report'
    })
  },

  // 我的错题
  onMyMistakes() {
    wx.switchTab({
      url: '/pages/mistakes/mistakes'
    })
  },

  // 学习报告
  onStudyReport() {
    wx.navigateTo({
      url: '/pages/report/report'
    })
  },

  // 成就系统
  onAchievements() {
    wx.navigateTo({
      url: '/pages/achievements/achievements'
    })
  },

  // 孩子管理
  onChildManagement() {
    wx.navigateTo({
      url: '/pages/child/management'
    })
  },

  // 课程管理
  onCourseManagement() {
    wx.switchTab({
      url: '/pages/schedule/schedule'
    })
  },

  // 数据备份
  onDataBackup() {
    wx.showActionSheet({
      itemList: ['备份到云端', '从云端恢复', '导出数据', '导入数据'],
      success: (res) => {
        switch(res.tapIndex) {
          case 0:
            this.backupToCloud()
            break
          case 1:
            this.restoreFromCloud()
            break
          case 2:
            this.exportData()
            break
          case 3:
            this.importData()
            break
        }
      }
    })
  },

  // 应用设置
  onSettings() {
    wx.navigateTo({
      url: '/pages/settings/settings'
    })
  },

  // 帮助中心
  onHelp() {
    wx.navigateTo({
      url: '/pages/help/help'
    })
  },

  // 关于我们
  onAbout() {
    wx.navigateTo({
      url: '/pages/about/about'
    })
  },

  // 通用页面跳转
  navigateToPage(e) {
    const { url } = e.currentTarget.dataset;
    if (url) {
      wx.navigateTo({
        url,
        fail: () => {
          wx.showToast({
            title: '功能开发中',
            icon: 'none'
          });
        }
      });
    }
  },

  // 退出登录
  onLogout() {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          console.log('用户点击确定')
          getApp().globalData.userInfo = null
          wx.reLaunch({
            url: '/pages/login/login'
          })
        }
      }
    })
  },

  // 备份到云端
  backupToCloud() {
    wx.showModal({
      title: '功能开发中',
      content: '云端备份功能正在开发中，敬请期待！',
      showCancel: false
    });
  },

  // 从云端恢复
  restoreFromCloud() {
    wx.showModal({
      title: '功能开发中',
      content: '云端恢复功能正在开发中，敬请期待！',
      showCancel: false
    });
  },

  // 导出数据
  exportData() {
    wx.showToast({
      title: '功能开发中',
      icon: 'none'
    })
  },

  // 导入数据
  importData() {
    wx.showToast({
      title: '功能开发中',
      icon: 'none'
    })
  },

  calculateExpRate() {
    if (this.data.nextLevelExp > 0) {
      const rate = (this.data.userInfo.exp / this.data.nextLevelExp) * 100;
      const expProgressPercent = Math.min(rate, 100);
      this.setData({
        expRate: expProgressPercent,
        expProgressPercent
      })
    }
  },

  goToLogin() {
    wx.navigateTo({
      url: '/pages/login/login'
    });
  },

  onMenuItemTap(e) {
    const { url } = e.currentTarget.dataset;
    wx.navigateTo({
      url,
      fail: () => {
        wx.showToast({
          title: '页面不存在',
          icon: 'none',
        });
      },
    });
  },

  logout() {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          console.log('用户点击确定');
          // 执行退出登录逻辑，如清除本地缓存，跳转到登录页
          wx.reLaunch({
            url: '/pages/login/login',
          });
        }
      },
    });
  },
}) 
