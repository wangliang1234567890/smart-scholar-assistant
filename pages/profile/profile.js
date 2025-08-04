const app = getApp()
import DatabaseManager from '../../utils/database.js';
import EventManager, { EVENT_TYPES } from '../../utils/event-manager.js';
import CloudFunctionTester from '../../utils/cloud-function-test.js';

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
        value: 0,
        label: '错题总数',
        key: 'totalMistakes'
      },
      {
        icon: '/images/icons/level-badge.svg',
        value: 0,
        label: '获得成就',
        key: 'achievements'
      },
      {
        icon: '/images/icons/calendar-days.svg',
        value: 0,
        label: '学习天数',
        key: 'studyDays'
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
      unlocked: 0,
      total: 50
    },
    studyDays: 0,
    loading: false,
    
    // 计算属性
    expProgressPercent: 0,
    
    // 详细统计数据
    detailedStats: {
      totalMistakes: 0,
      masteredMistakes: 0,
      reviewingMistakes: 0,
      newMistakes: 0,
      masteryRate: 0,
      totalCourses: 0,
      todayCourses: 0,
      weeklyProgress: 0
    }
  },

  onLoad(options) {
    console.log('个人中心页面加载');
    this.loadUserData();
  },

  onShow() {
    // 更新tabBar状态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({
        selected: 3 // 个人中心是第4个tab（索引3）
      });
    }
    
    // 刷新数据
    this.refreshUserData();
  },

  /**
   * 加载用户数据
   */
  async loadUserData() {
    this.setData({ loading: true });
    
    try {
      // 并行加载用户信息和统计数据
      await Promise.all([
        this.loadUserInfo(),
        this.loadUserStats(),
        this.loadUserAchievements()
      ]);
      
      // 计算经验进度
      this.calculateExpRate();
      
    } catch (error) {
      console.error('加载用户数据失败:', error);
    } finally {
      this.setData({ loading: false });
    }
  },

  /**
   * 刷新用户数据
   */
  async refreshUserData() {
    try {
      await Promise.all([
        this.loadUserStats(),
        this.loadUserAchievements()
      ]);
      this.calculateExpRate();
    } catch (error) {
      console.error('刷新用户数据失败:', error);
    }
  },

  /**
   * 加载用户基本信息
   */
  loadUserInfo() {
    try {
      // 从本地存储获取用户信息
      const storedUserInfo = wx.getStorageSync('userInfo');
      console.log('本地存储的用户信息:', storedUserInfo);
      
      if (storedUserInfo) {
        const userInfo = {
          ...this.data.userInfo,
          ...storedUserInfo,
          hasAuthorized: true
        };
        console.log('设置用户信息:', userInfo);
        this.setData({ userInfo });
      } else {
        // 检查全局状态
        const globalUserInfo = app.globalData.userInfo;
        console.log('全局用户信息:', globalUserInfo);
        if (globalUserInfo) {
          const userInfo = {
            ...this.data.userInfo,
            ...globalUserInfo
          };
          console.log('使用全局用户信息:', userInfo);
          this.setData({ userInfo });
        }
      }
    } catch (error) {
      console.error('加载用户信息失败:', error);
    }
  },

  /**
   * 获取微信用户信息
   */
  async getUserProfile() {
    try {
      wx.showLoading({ title: '获取信息中...', mask: true });
      
      const res = await new Promise((resolve, reject) => {
        wx.getUserProfile({
          desc: '用于完善用户资料', // 声明获取用户个人信息后的用途
          success: resolve,
          fail: reject
        });
      });
      
      console.log('获取用户信息成功:', res.userInfo);
      
      const userInfo = {
        nickName: res.userInfo.nickName,
        avatarUrl: res.userInfo.avatarUrl,
        hasAuthorized: true
      };
      
      // 保存到本地存储
      wx.setStorageSync('userInfo', userInfo);
      
      // 更新全局状态
      app.globalData.userInfo = userInfo;
      
      // 更新页面数据
      this.setData({
        userInfo: {
          ...this.data.userInfo,
          ...userInfo
        }
      });
      
      // 触发用户信息更新事件
      EventManager.emit(EVENT_TYPES.USER_INFO_UPDATED, {
        userInfo,
        timestamp: Date.now()
      });
      
      wx.hideLoading();
      wx.showToast({
        title: '获取信息成功',
        icon: 'success'
      });
      
    } catch (error) {
      wx.hideLoading();
      console.error('获取用户信息失败:', error);
      
      if (error.errMsg && error.errMsg.includes('auth deny')) {
        wx.showModal({
          title: '提示',
          content: '获取用户信息被拒绝，将使用默认头像和昵称',
          showCancel: false
        });
      } else {
        wx.showToast({
          title: '获取信息失败',
          icon: 'error'
        });
      }
    }
  },

  /**
   * 处理头像点击 - 获取用户信息
   */
  onAvatarTap() {
    const { userInfo } = this.data;
    
    // 如果还没有授权或使用的是默认头像，则获取用户信息
    if (!userInfo.hasAuthorized || userInfo.avatarUrl === '/images/default-avatar.png') {
      wx.showModal({
        title: '获取头像和昵称',
        content: '获取您的微信头像和昵称，用于个性化显示',
        confirmText: '确定',
        cancelText: '暂不',
        success: (res) => {
          if (res.confirm) {
            this.getUserProfile();
          }
        }
      });
    } else {
      // 已授权的用户可以重新获取
      wx.showActionSheet({
        itemList: ['重新获取头像昵称', '使用默认头像', '🔧 测试云函数'],
        success: (res) => {
          if (res.tapIndex === 0) {
            this.getUserProfile();
          } else if (res.tapIndex === 1) {
            this.resetToDefault();
          } else if (res.tapIndex === 2) {
            this.testCloudFunction();
          }
        }
      });
    }
  },

  /**
   * 测试云函数（开发调试用）
   */
  async testCloudFunction() {
    try {
      wx.showLoading({ title: '测试中...', mask: true });
      
      const result = await CloudFunctionTester.testAIQuestionGenerator();
      
      wx.hideLoading();
      CloudFunctionTester.showTestResult(result);
      
    } catch (error) {
      wx.hideLoading();
      console.error('测试云函数失败:', error);
      wx.showModal({
        title: '测试失败',
        content: `错误信息：${error.message || '未知错误'}`,
        showCancel: false
      });
    }
  },

  /**
   * 重置为默认头像和昵称
   */
  resetToDefault() {
    const defaultUserInfo = {
      nickName: '小星星',
      avatarUrl: '/images/default-avatar.png',
      hasAuthorized: false
    };
    
    // 移除本地存储
    wx.removeStorageSync('userInfo');
    
    // 更新全局状态
    app.globalData.userInfo = defaultUserInfo;
    
    // 更新页面数据
    this.setData({
      userInfo: {
        ...this.data.userInfo,
        ...defaultUserInfo
      }
    });
    
    wx.showToast({
      title: '已重置为默认',
      icon: 'success'
    });
  },

  // 加载用户统计数据 - 优化后的实现
  async loadUserStats() {
    try {
      const userId = DatabaseManager.getCurrentUserId();
      console.log('加载用户统计数据...');
      
      // 并行获取各种统计数据
      const [mistakeStatsResult, courseStatsResult, reviewStatsResult] = await Promise.all([
        DatabaseManager.getTodayStats(userId),
        DatabaseManager.getCourseStats(userId),
        DatabaseManager.getReviewRecords(userId, { pageSize: 100 })
      ]);
      
      let detailedStats = {
        totalMistakes: 0,
        masteredMistakes: 0,
        reviewingMistakes: 0,
        newMistakes: 0,
        masteryRate: 0,
        totalCourses: 0,
        todayCourses: 0,
        weeklyProgress: 0
      };
      
      // 处理错题统计
      if (mistakeStatsResult.success) {
        const stats = mistakeStatsResult.data;
        detailedStats = {
          ...detailedStats,
          totalMistakes: stats.totalMistakes || 0,
          masteredMistakes: stats.masteredCount || 0,
          reviewingMistakes: stats.reviewTasks || 0,
          newMistakes: stats.todayMistakes || 0,
          masteryRate: stats.masteryRate || 0
        };
      }
      
      // 处理课程统计
      if (courseStatsResult.success) {
        detailedStats.totalCourses = courseStatsResult.data.totalCourses || 0;
        detailedStats.todayCourses = courseStatsResult.data.todayCourses || 0;
      }
      
      // 计算学习天数
      const studyDays = Math.max(1, Math.floor((Date.now() - (new Date('2025-01-25')).getTime()) / (1000 * 60 * 60 * 24)));
      
      // 计算本周学习进度
      if (reviewStatsResult.success) {
        const weeklyReviews = this.calculateWeeklyProgress(reviewStatsResult.data);
        detailedStats.weeklyProgress = weeklyReviews;
      }
      
      // 更新显示的统计数据
      const updatedStats = this.data.stats.map(stat => {
        switch (stat.key) {
          case 'totalMistakes':
            return { ...stat, value: detailedStats.totalMistakes };
          case 'achievements':
            return { ...stat, value: this.data.achievements.unlocked };
          case 'studyDays':
            return { ...stat, value: studyDays };
          default:
            return stat;
        }
      });
      
      this.setData({ 
        stats: updatedStats,
        detailedStats,
        studyDays
      });
      
      console.log('用户统计数据加载完成:', detailedStats);
      
    } catch (error) {
      console.error('加载用户统计数据失败:', error);
      // 设置默认统计数据
      this.setData({
        detailedStats: {
          totalMistakes: 0,
          masteredMistakes: 0,
          reviewingMistakes: 0,
          newMistakes: 0,
          masteryRate: 0,
          totalCourses: 0,
          todayCourses: 0,
          weeklyProgress: 0
        }
      });
    }
  },

  /**
   * 加载用户成就数据
   */
  async loadUserAchievements() {
    try {
      // 模拟成就系统（实际项目中应该从数据库获取）
      const { totalMistakes, masteryRate, studyDays } = this.data.detailedStats;
      
      let unlockedAchievements = 0;
      
      // 基于统计数据计算解锁的成就
      if (totalMistakes >= 10) unlockedAchievements++; // 初学者
      if (totalMistakes >= 50) unlockedAchievements++; // 勤奋学习者
      if (totalMistakes >= 100) unlockedAchievements++; // 学习达人
      if (masteryRate >= 50) unlockedAchievements++; // 半数掌握
      if (masteryRate >= 80) unlockedAchievements++; // 优秀学生
      if (studyDays >= 7) unlockedAchievements++; // 一周坚持
      if (studyDays >= 30) unlockedAchievements++; // 一月坚持
      if (studyDays >= 100) unlockedAchievements++; // 百日坚持
      
      // 根据成就数量计算等级和经验
      const level = Math.floor(unlockedAchievements / 2) + 1;
      const exp = (unlockedAchievements % 2) * 500 + Math.min(totalMistakes * 5, 500);
      
      this.setData({
        achievements: {
          unlocked: unlockedAchievements,
          total: 50
        },
        userInfo: {
          ...this.data.userInfo,
          level,
          exp
        }
      });
      
      console.log('成就数据加载完成:', { unlockedAchievements, level, exp });
      
    } catch (error) {
      console.error('加载成就数据失败:', error);
    }
  },

  /**
   * 计算本周学习进度
   */
  calculateWeeklyProgress(reviewRecords) {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    const weeklyReviews = reviewRecords.filter(record => {
      const reviewTime = new Date(record.reviewTime || record.createTime);
      return reviewTime >= oneWeekAgo;
    });
    
    return weeklyReviews.length;
  },

  /**
   * 计算经验进度
   */
  calculateExpRate() {
    const { level, exp } = this.data.userInfo;
    const currentLevelExp = level * 1000; // 每级需要1000经验
    const expInCurrentLevel = exp % 1000;
    const expRate = (expInCurrentLevel / 1000) * 100;
    
    this.setData({
      expRate,
      expProgressPercent: Math.round(expRate),
      nextLevelExp: currentLevelExp
    });
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

  // 菜单项点击事件
  onMenuItemTap(e) {
    const url = e.currentTarget.dataset.url;
    if (url) {
      wx.navigateTo({
        url
      });
    }
  },

  // 成就页面
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

  // 设置页面
  onSettings() {
    wx.navigateTo({
      url: '/pages/settings/settings'
    })
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.refreshUserData().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  // 分享
  onShareAppMessage() {
    return {
      title: `我在智能学霸小助手已学习${this.data.studyDays}天，掌握了${this.data.detailedStats.masteredMistakes}道题目！`,
      path: '/pages/home/home'
    };
  }
}) 
