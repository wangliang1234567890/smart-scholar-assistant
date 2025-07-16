import DatabaseManager from '../../utils/database';
import { SUBJECTS } from '../../utils/constants';
import { createStoreBindings } from 'mobx-miniprogram-bindings';
import { store } from '../../store/index';

const app = getApp();

Page({
  data: {
    userInfo: null,
    isLoggedIn: false,
    isGuestMode: false,
    studyStats: {
      todayMistakes: 0,
      reviewTasks: 0,
      masteredCount: 0,
      masteryRate: 0,
      totalMistakes: 0,
      latestMistakes: []
    },
    hasMistakes: true,
    loading: false,
    quickActions: [
      {
        icon: 'camera-action',
        title: '拍照录题',
        path: '/pages/camera/camera'
      },
      {
        icon: 'edit-action',
        title: '手动录入',
        path: '/pages/mistakes/add'
      },
      {
        icon: 'ai-practice',
        title: 'AI练习',
        path: '/pages/practice/config'
      },
      {
        icon: 'clock',
        title: '复习提醒',
        desc: '查看复习任务',
        color: '#EF4444',
        path: '/pages/review/review'
      }
    ],
    subjectStats: [],
    refreshing: false,
    greeting: ''
  },

  onLoad() {
    console.log('首页加载');
    this.storeBindings = createStoreBindings(this, {
      store,
      fields: ['userInfo', 'isLoggedIn', 'isGuestMode'],
      actions: [],
    });
  },

  onShow() {
    console.log('首页显示');
    if (!store.isLoggedIn && !store.isGuestMode) {
      wx.reLaunch({
        url: '/pages/login/login',
      });
      return;
    }
    
    this.loadDashboardData();
    this.setData({ greeting: this.getGreeting() });
  },

  onUnload() {
    this.storeBindings.destroyStoreBindings();
  },

  onPullDownRefresh() {
    if (this.data.isLoggedIn) {
      this.setData({ refreshing: true });
      this.loadDashboardData().then(() => {
        this.setData({ refreshing: false });
        wx.stopPullDownRefresh();
      });
    } else {
      wx.stopPullDownRefresh();
    }
  },

  onReachBottom() {
    console.log('触底加载');
  },

  handleActionTap(e) {
    const path = e.currentTarget.dataset.path;
    // 仅当目标是底部 tabBar 页面时使用 switchTab，其余使用 navigateTo
    const tabPages = ['/pages/home/home', '/pages/mistakes/mistakes', '/pages/practice/practice', '/pages/schedule/schedule', '/pages/profile/profile'];
    if (tabPages.includes(path)) {
      wx.switchTab({ url: path });
    } else {
      wx.navigateTo({ url: path });
    }
  },

  onSubjectTap(e) {
    const { subject } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/mistakes/mistakes?subject=${encodeURIComponent(subject)}`
    });
  },

  onViewReport() {
    wx.navigateTo({ url: '/pages/report/report' });
  },

  onViewAllMistakes() {
    wx.switchTab({
      url: '/pages/mistakes/mistakes'
    });
  },

  onViewReview() {
    wx.navigateTo({
      url: '/pages/review/review'
    });
  },

  onProfile() {
    wx.switchTab({
      url: '/pages/profile/profile'
    });
  },

  promisify(fn) {
    return (options = {}) => {
      return new Promise((resolve, reject) => {
        fn({
          ...options,
          success: resolve,
          fail: reject
        });
      });
    };
  },

  handleError(message) {
    wx.showToast({
      title: message,
      icon: 'none',
      duration: 2000
    });
  },

  getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return '上午好';
    if (hour < 18) return '下午好';
    return '晚上好';
  },

  formatNumber(num) {
    if (num < 1000) return num.toString();
    if (num < 10000) return (num / 1000).toFixed(1) + 'k';
    return (num / 10000).toFixed(1) + 'w';
  },

  async loadDashboardData() {
    if (this.data.userInfo && this.data.userInfo.isGuest) {
      this.setData({
        loading: false,
        studyStats: {
          todayMistakes: 0,
          totalMistakes: 0,
          reviewTasks: 0,
        },
        hasMistakes: false,
        subjectStats: []
      });
      return;
    }
    
    if (this.data.loading) return;
    this.setData({ loading: true });

    try {
      await new Promise(resolve => setTimeout(resolve, 800));

      const mockData = {
        studyStats: {
          todayMistakes: 5,
          reviewTasks: 12,
          masteredCount: 88,
          masteryRate: 75,
          totalMistakes: 118
        },
        subjectStats: [{
          name: '数学',
          masteryRate: 80,
          totalMistakes: 50
        }, {
          name: '语文',
          masteryRate: 70,
          totalMistakes: 40
        }, {
          name: '英语',
          masteryRate: 85,
          totalMistakes: 28
        }],
        hasMistakes: true
      };

      this.setData({
        studyStats: mockData.studyStats,
        subjectStats: mockData.subjectStats,
        hasMistakes: mockData.hasMistakes,
      });

    } catch (error) {
      console.error('加载首页数据失败:', error);
      wx.showToast({
        title: '加载数据失败',
        icon: 'none'
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  goToCamera: function() {
    wx.navigateTo({ url: '/pages/camera/camera' });
  },

  goToAddManual: function() {
    wx.navigateTo({ url: '/pages/mistakes/add' });
  },

  goToAiPractice: function() {
    wx.switchTab({ url: '/pages/practice/practice' });
  },

  goToReview: function() {
    wx.switchTab({ url: '/pages/mistakes/mistakes' });
  },

  viewReport: function() {
    wx.navigateTo({ url: '/pages/report/report' });
  }
}); 