import DatabaseManager from '../../utils/database.js';
import { debounce } from '../../utils/common.js';

// 添加缺失的常量定义
const SUBJECTS = ['数学', '英语', '语文', '物理', '化学', '生物', '历史', '地理', '政治'];

// 简单的工具函数实现
const loadingManager = {
  loadingStates: new Map(),
  isLoading(key) {
    return this.loadingStates.get(key) || false;
  },
  setLoading(key, state) {
    this.loadingStates.set(key, state);
  },
  clearLoading(key) {
    this.loadingStates.delete(key);
  }
};

const errorHandler = {
  handle(error, options = {}) {
    console.error(`[${options.scene || 'unknown'}]`, error);
    if (options.showToast) {
      wx.showToast({
        title: error.message || '操作失败',
        icon: 'none'
      });
    }
  }
};

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
        path: '/pages/practice/practice'
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
    this.refreshData();
  },

  onReady() {
    console.log('首页准备完成');
    // 移除不存在的方法调用
  },

  onUnload() {
    console.log('首页卸载');
    loadingManager.clearLoading('home_data');
  },

  onPullDownRefresh() {
    this.refreshData().finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  // 添加缺失的简单防抖函数
  createSimpleDebounce(func, delay) {
    let timeoutId;
    return function(...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
  },

  /**
   * 初始化页面
   */
  async initPage() {
    try {
      this.debouncedRefresh = this.createSimpleDebounce(() => {
        this.loadRealStudyStats();
      }, 1000);
      
      await this.loadRealStudyStats();
    } catch (error) {
      console.error('初始化页面失败:', error);
    }
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
  refreshData() {
    try {
      if (this.debouncedRefresh) {
        this.debouncedRefresh();
      } else {
        this.loadRealStudyStats();
      }
    } catch (error) {
      console.error('刷新数据失败:', error);
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
  },

  // 新增：加载真实学习统计（使用现有的DatabaseManager）
  async loadRealStudyStats() {
    try {
      loadingManager.setLoading('home_data', true);
      
      const userId = wx.getStorageSync('userId') || 'default_user';
      
      // 获取今日数据
      const today = new Date();
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      
      // 并行获取各种统计数据
      const [mistakesResult, reviewResult, todayResult] = await Promise.all([
        DatabaseManager.getMistakes(userId, { pageSize: 1000 }),
        DatabaseManager.getReviewRecords(userId, { pageSize: 100 }),
        DatabaseManager.getTodayMistakes(userId, todayStart)
      ]);
      
      // 处理错题统计
      const allMistakes = mistakesResult.success ? mistakesResult.data : [];
      const todayMistakes = todayResult.success ? todayResult.data : [];
      
      // 计算各种统计指标
      const stats = {
        todayMistakes: todayMistakes.length,
        totalMistakes: allMistakes.length,
        reviewTasks: allMistakes.filter(m => m.status === 'reviewing').length,
        masteredCount: allMistakes.filter(m => m.status === 'mastered').length,
        masteryRate: allMistakes.length > 0 ? 
          Math.round((allMistakes.filter(m => m.status === 'mastered').length / allMistakes.length) * 100) : 0,
        latestMistakes: allMistakes.slice(0, 5) // 最新5道错题
      };
      
      // 学科统计
      const subjectStats = this.calculateSubjectStats(allMistakes);
      
      this.setData({
        studyStats: stats,
        subjectStats,
        hasMistakes: allMistakes.length > 0,
        loading: false
      });
      
      console.log('学习统计加载完成:', stats);
      
    } catch (error) {
      console.error('加载学习统计失败:', error);
      this.setDefaultData();
    } finally {
      loadingManager.clearLoading('home_data');
    }
  },

  // 计算学科统计
  calculateSubjectStats(mistakes) {
    const subjectMap = {};
    
    mistakes.forEach(mistake => {
      const subject = mistake.subject || '未分类';
      if (!subjectMap[subject]) {
        subjectMap[subject] = {
          name: subject,
          total: 0,
          mastered: 0,
          reviewing: 0,
          new: 0
        };
      }
      
      subjectMap[subject].total++;
      if (mistake.status === 'mastered') subjectMap[subject].mastered++;
      else if (mistake.status === 'reviewing') subjectMap[subject].reviewing++;
      else subjectMap[subject].new++;
    });
    
    return Object.values(subjectMap).map(subject => ({
      ...subject,
      masteryRate: subject.total > 0 ? Math.round((subject.mastered / subject.total) * 100) : 0
    }));
  },

  // 添加快速操作优化
  async handleQuickAction(actionType) {
    try {
      switch (actionType) {
        case 'camera':
          wx.navigateTo({ url: '/pages/camera/camera' });
          break;
          
        case 'manual':
          wx.navigateTo({ url: '/pages/mistakes/add' });
          break;
          
        case 'review':
          await this.startQuickReview();
          break;
          
        case 'practice':
          wx.navigateTo({ url: '/pages/practice/config' });
          break;
          
        default:
          wx.showToast({ title: '功能开发中', icon: 'none' });
      }
    } catch (error) {
      errorHandler.handle(error, {
        scene: 'home_quick_action',
        showToast: true
      });
    }
  },

  // 快速复习功能
  async startQuickReview() {
    try {
      const userId = wx.getStorageSync('userId') || 'default_user';
      const result = await DatabaseManager.getMistakes(userId, {
        status: 'reviewing',
        pageSize: 5
      });
      
      if (result.success && result.data.length > 0) {
        // 跳转到复习页面，传递错题数据
        const mistakesData = encodeURIComponent(JSON.stringify(result.data));
        wx.navigateTo({
          url: `/pages/review/review?type=quick&data=${mistakesData}`
        });
      } else {
        wx.showToast({ title: '暂无需要复习的题目', icon: 'none' });
      }
      
    } catch (error) {
      console.error('启动快速复习失败:', error);
      wx.showToast({ title: '启动失败', icon: 'none' });
    }
  },

  // 优化首页的复习入口
  async startTodayReview() {
    try {
      const dbManager = DatabaseManager;  // 确保这里也是正确的
      const reviewTasks = await dbManager.getTodayReviewTasks();
      
      if (reviewTasks.length === 0) {
        wx.showModal({
          title: '暂无复习任务',
          content: '今日暂无需要复习的题目，是否查看错题本？',
          success: (res) => {
            if (res.confirm) {
              wx.switchTab({ url: '/pages/mistakes/mistakes' });
            }
          }
        });
        return;
      }
      
      wx.navigateTo({
        url: `/pages/review/session?tasks=${encodeURIComponent(JSON.stringify(reviewTasks))}`
      });
    } catch (error) {
      console.error('启动复习失败:', error);
    }
  }
}); 
