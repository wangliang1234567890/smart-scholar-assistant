import DatabaseManager from '../../utils/database';
import { SUBJECTS } from '../../utils/constants';

Page({
  data: {
    userInfo: null,
    studyStats: {
      todayMistakes: 0,
      totalMistakes: 0,
      reviewTasks: 0,
      masteredCount: 0,
      masteryRate: 0
    },
    quickActions: [
      {
        icon: 'photograph',
        title: '拍照录题',
        desc: '快速录入错题',
        color: '#4F46E5',
        path: '/pages/camera/camera'
      },
      {
        icon: 'edit',
        title: '手动录入',
        desc: '手工添加错题',
        color: '#10B981',
        path: '/pages/mistakes/add'
      },
      {
        icon: 'play-circle',
        title: 'AI练习',
        desc: '智能生成题目',
        color: '#F59E0B',
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
    loading: true,
    refreshing: false
  },

  onLoad() {
    console.log('首页加载');
    this.checkUserLogin();
  },

  onShow() {
    console.log('首页显示');
    // 每次显示时刷新数据
    if (this.data.userInfo) {
      this.loadStudyData();
    }
  },

  onPullDownRefresh() {
    console.log('下拉刷新');
    this.refreshData();
  },

  onReachBottom() {
    console.log('触底加载');
  },

  // 检查用户登录状态
  async checkUserLogin() {
    try {
      const app = getApp();
      const userInfo = app.getUserInfo();
      
      if (userInfo) {
        this.setData({ userInfo });
        await this.loadStudyData();
      } else {
        // 跳转到登录页
        wx.redirectTo({
          url: '/pages/login/login'
        });
      }
    } catch (error) {
      console.error('检查登录状态失败:', error);
      this.handleError('获取用户信息失败');
    }
  },

  // 加载学习数据
  async loadStudyData() {
    try {
      this.setData({ loading: true });
      
      const userId = this.data.userInfo._id;
      
      // 并行加载数据
      const [statsResult, subjectStatsResult] = await Promise.all([
        DatabaseManager.getTodayStats(userId),
        this.loadSubjectStats(userId)
      ]);
      
      if (statsResult.success) {
        this.setData({ 
          studyStats: statsResult.data,
          subjectStats: subjectStatsResult
        });
      }
      
    } catch (error) {
      console.error('加载学习数据失败:', error);
      this.handleError('加载数据失败');
    } finally {
      this.setData({ loading: false });
    }
  },

  // 加载各学科统计
  async loadSubjectStats(userId) {
    try {
      const subjectStats = [];
      
      for (const subject of SUBJECTS.slice(0, 3)) { // 只显示前3个学科
        const result = await DatabaseManager.getMistakes(userId, {
          subject,
          pageSize: 1
        });
        
        if (result.success) {
          subjectStats.push({
            name: subject,
            count: result.total || 0,
            icon: this.getSubjectIcon(subject)
          });
        }
      }
      
      return subjectStats;
    } catch (error) {
      console.error('加载学科统计失败:', error);
      return [];
    }
  },

  // 获取学科图标
  getSubjectIcon(subject) {
    const iconMap = {
      '数学': 'calculator',
      '语文': 'font-o',
      '英语': 'underway',
      '物理': 'tosend',
      '化学': 'experiment'
    };
    return iconMap[subject] || 'records';
  },

  // 刷新数据
  async refreshData() {
    try {
      this.setData({ refreshing: true });
      await this.loadStudyData();
      
      wx.showToast({
        title: '刷新成功',
        icon: 'success',
        duration: 1500
      });
    } catch (error) {
      this.handleError('刷新失败');
    } finally {
      this.setData({ refreshing: false });
      wx.stopPullDownRefresh();
    }
  },

  // 快捷操作点击
  onQuickAction(e) {
    const { path } = e.currentTarget.dataset;
    
    if (path === '/pages/camera/camera') {
      // 检查相机权限
      this.checkCameraPermission().then(hasPermission => {
        if (hasPermission) {
          wx.navigateTo({ url: path });
        }
      });
    } else {
      wx.navigateTo({ url: path });
    }
  },

  // 检查相机权限
  async checkCameraPermission() {
    try {
      const authRes = await this.promisify(wx.getSetting)();
      
      if (authRes.authSetting['scope.camera'] === false) {
        // 用户曾经拒绝过
        wx.showModal({
          title: '需要相机权限',
          content: '拍照录题功能需要使用相机，请在设置中开启相机权限',
          confirmText: '去设置',
          success: (res) => {
            if (res.confirm) {
              wx.openSetting();
            }
          }
        });
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('检查相机权限失败:', error);
      return false;
    }
  },

  // 学科点击
  onSubjectTap(e) {
    const { subject } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/mistakes/mistakes?subject=${encodeURIComponent(subject)}`
    });
  },

  // 查看更多统计
  onViewReport() {
    wx.navigateTo({
      url: '/pages/report/report'
    });
  },

  // 查看所有错题
  onViewAllMistakes() {
    wx.switchTab({
      url: '/pages/mistakes/mistakes'
    });
  },

  // 查看复习任务
  onViewReview() {
    wx.navigateTo({
      url: '/pages/review/review'
    });
  },

  // 个人中心
  onProfile() {
    wx.switchTab({
      url: '/pages/profile/profile'
    });
  },

  // 工具方法：Promise化微信API
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

  // 错误处理
  handleError(message) {
    wx.showToast({
      title: message,
      icon: 'none',
      duration: 2000
    });
  },

  // 获取时间问候语
  getGreeting() {
    const hour = new Date().getHours();
    if (hour < 6) return '夜深了';
    if (hour < 9) return '早上好';
    if (hour < 12) return '上午好';
    if (hour < 14) return '中午好';
    if (hour < 18) return '下午好';
    if (hour < 22) return '晚上好';
    return '夜深了';
  },

  // 格式化数字
  formatNumber(num) {
    if (num < 1000) return num.toString();
    if (num < 10000) return (num / 1000).toFixed(1) + 'k';
    return (num / 10000).toFixed(1) + 'w';
  }
}); 