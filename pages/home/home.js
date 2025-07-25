import DatabaseManager from '../../utils/database';
import { SUBJECTS } from '../../utils/constants';
import { createStoreBindings } from 'mobx-miniprogram-bindings';
import { store } from '../../store/index';
import errorHandler from '../../utils/error-handler';
import { debounce, formatNumber, loadingManager, promisifyWxApi } from '../../utils/common';

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
    this.initPage();
  },

  onShow() {
    console.log('首页显示');
    
    // 更新tabBar状态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setActiveTab(0);
    }
    
    // 更新页面数据
    this.updatePageData();
    
    // 刷新数据（防抖处理）
    this.debouncedRefresh();
  },

  onReady() {
    console.log('首页准备完成');
    this.initStoreBinding();
  },

  onUnload() {
    console.log('首页卸载');
    this.destroyStoreBinding();
    loadingManager.clearLoading('home_data');
  },

  onPullDownRefresh() {
    this.refreshData().finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  /**
   * 初始化页面
   */
  initPage() {
    this.setData({
      greeting: this.getGreeting()
    });

    // 创建防抖刷新函数
    this.debouncedRefresh = debounce(this.refreshData.bind(this), 500);
    
    // 初始加载数据
    this.loadInitialData();
  },

  /**
   * 初始化Store绑定
   */
  initStoreBinding() {
    try {
      this.storeBindings = createStoreBindings(this, {
        store,
        fields: ['userInfo', 'isLoggedIn', 'isGuestMode'],
        actions: [],
      });
    } catch (error) {
      errorHandler.handle(error, {
        scene: 'home_store_binding',
        showToast: false
      });
    }
  },

  /**
   * 销毁Store绑定
   */
  destroyStoreBinding() {
    if (this.storeBindings) {
      this.storeBindings.destroyStoreBindings();
    }
  },

  /**
   * 更新页面数据
   */
  updatePageData() {
    const currentTime = new Date();
    const greeting = this.getGreeting(currentTime);
    
    if (this.data.greeting !== greeting) {
      this.setData({ greeting });
    }
  },

  /**
   * 加载初始数据
   */
  async loadInitialData() {
    if (loadingManager.isLoading('home_initial')) return;
    
    loadingManager.setLoading('home_initial', true);
    this.setData({ loading: true });

    try {
      await this.loadDashboardData();
    } catch (error) {
      errorHandler.handle(error, {
        scene: 'home_initial_load',
        showToast: true
      });
    } finally {
      loadingManager.setLoading('home_initial', false);
      this.setData({ loading: false });
    }
  },

  /**
   * 刷新数据
   */
  async refreshData() {
    if (loadingManager.isLoading('home_refresh')) return;
    
    loadingManager.setLoading('home_refresh', true);
    this.setData({ refreshing: true });

    try {
      await this.loadDashboardData();
      
      // 显示刷新成功提示
      wx.showToast({
        title: '刷新成功',
        icon: 'success',
        duration: 1000
      });
    } catch (error) {
      errorHandler.handle(error, {
        scene: 'home_refresh_data',
        showToast: true
      });
    } finally {
      loadingManager.setLoading('home_refresh', false);
      this.setData({ refreshing: false });
    }
  },

  /**
   * 处理快捷操作点击
   */
  handleActionTap(e) {
    try {
      const path = e.currentTarget.dataset.path;
      
      if (!path) {
        throw new Error('无效的路径');
      }

      // Tab页面使用switchTab，其他页面使用navigateTo
      const tabPages = [
        '/pages/home/home', 
        '/pages/mistakes/mistakes', 
        '/pages/practice/practice', 
        '/pages/schedule/schedule', 
        '/pages/profile/profile'
      ];
      
      if (tabPages.includes(path)) {
        wx.switchTab({ url: path });
      } else {
        wx.navigateTo({ url: path });
      }
    } catch (error) {
      errorHandler.handle(error, {
        scene: 'home_action_tap',
        showToast: true
      });
    }
  },

  /**
   * 处理学科统计点击
   */
  onSubjectTap(e) {
    try {
      const { subject } = e.currentTarget.dataset;
      
      if (!subject) {
        throw new Error('无效的学科');
      }

      wx.navigateTo({
        url: `/pages/mistakes/mistakes?subject=${encodeURIComponent(subject)}`
      });
    } catch (error) {
      errorHandler.handle(error, {
        scene: 'home_subject_tap',
        showToast: true
      });
    }
  },

  /**
   * 查看报告
   */
  onViewReport() {
    this.navigateToPage('/pages/report/report');
  },

  /**
   * 查看所有错题
   */
  onViewAllMistakes() {
    wx.switchTab({
      url: '/pages/mistakes/mistakes'
    });
  },

  /**
   * 查看复习任务
   */
  onViewReview() {
    this.navigateToPage('/pages/review/review');
  },

  /**
   * 进入个人中心
   */
  onProfile() {
    wx.switchTab({
      url: '/pages/profile/profile'
    });
  },

  /**
   * 安全的页面导航
   */
  navigateToPage(url) {
    try {
      if (!url) {
        throw new Error('无效的页面路径');
      }
      
      wx.navigateTo({
        url,
        fail: (error) => {
          errorHandler.handle(error, {
            scene: 'home_navigation',
            showToast: true
          });
        }
      });
    } catch (error) {
      errorHandler.handle(error, {
        scene: 'home_navigation',
        showToast: true
      });
    }
  },

  /**
   * 获取问候语
   */
  getGreeting(date = new Date()) {
    const hour = date.getHours();
    
    if (hour < 6) return '深夜好';
    if (hour < 9) return '早上好';
    if (hour < 12) return '上午好';
    if (hour < 14) return '中午好';
    if (hour < 18) return '下午好';
    if (hour < 22) return '晚上好';
    return '夜深了';
  },

  /**
   * 加载仪表板数据
   */
  async loadDashboardData() {
    // 游客模式处理
    if (this.data.isGuestMode || !this.data.userInfo) {
      this.setGuestModeData();
      return;
    }
    
    const userId = this.data.userInfo._id || this.data.userInfo.id;
    
    if (!userId) {
      this.setGuestModeData();
      return;
    }

    try {
      // 获取今日统计数据
      const statsResult = await DatabaseManager.getTodayStats(userId);
      
      if (statsResult.success) {
        const stats = statsResult.data;
        
        this.setData({
          studyStats: {
            todayMistakes: stats.todayMistakes,
            reviewTasks: stats.reviewTasks,
            masteredCount: stats.masteredCount,
            masteryRate: stats.masteryRate,
            totalMistakes: stats.totalMistakes,
            latestMistakes: []
          },
          hasMistakes: stats.totalMistakes > 0
        });

        // 如果有错题，加载学科统计
        if (stats.totalMistakes > 0) {
          await this.loadSubjectStats(userId);
        } else {
          this.setData({ subjectStats: [] });
        }
      } else {
        // 数据库查询失败，使用默认数据
        this.setDefaultData();
      }
    } catch (error) {
      console.error('加载仪表板数据失败:', error);
      this.setDefaultData();
      throw error;
    }
  },

  /**
   * 加载学科统计数据
   */
  async loadSubjectStats(userId) {
    try {
      const subjectStats = [];
      
      // 并行查询各学科数据
      const subjectPromises = SUBJECTS.slice(0, 3).map(async subject => {
        const result = await DatabaseManager.getMistakes(userId, {
          subject,
          pageSize: 100
        });
        
        if (result.success && result.data.length > 0) {
          const mistakes = result.data;
          const masteredCount = mistakes.filter(m => m.status === 'mastered').length;
          const masteryRate = Math.round((masteredCount / mistakes.length) * 100);
          
          return {
            name: subject,
            masteryRate,
            totalMistakes: mistakes.length,
            masteredCount
          };
        }
        return null;
      });

      const results = await Promise.all(subjectPromises);
      const validStats = results.filter(stat => stat !== null);
      
      this.setData({
        subjectStats: validStats
      });
    } catch (error) {
      console.error('加载学科统计失败:', error);
      // 不影响主要功能，只是不显示学科统计
      this.setData({ subjectStats: [] });
    }
  },

  /**
   * 设置游客模式数据
   */
  setGuestModeData() {
    this.setData({
      studyStats: {
        todayMistakes: 0,
        totalMistakes: 0,
        reviewTasks: 0,
        masteredCount: 0,
        masteryRate: 0,
        latestMistakes: []
      },
      hasMistakes: false,
      subjectStats: []
    });
  },

  /**
   * 设置默认数据
   */
  setDefaultData() {
    this.setData({
      studyStats: {
        todayMistakes: 0,
        totalMistakes: 0,
        reviewTasks: 0,
        masteredCount: 0,
        masteryRate: 0,
        latestMistakes: []
      },
      hasMistakes: false,
      subjectStats: []
    });
  },

  // 快捷操作方法（保持向后兼容）
  goToCamera() {
    this.navigateToPage('/pages/camera/camera');
  },

  goToAddManual() {
    this.navigateToPage('/pages/mistakes/add');
  },

  goToAiPractice() {
    wx.switchTab({ url: '/pages/practice/practice' });
  },

  goToReview() {
    wx.switchTab({ url: '/pages/mistakes/mistakes' });
  },

  viewReport() {
    this.navigateToPage('/pages/report/report');
  }
}); 