const app = getApp()
import DatabaseManager from '../../utils/database.js';

Page({
  data: {
    loading: true,
    // V0 data structure
    practiceOptions: [
      {
        title: "AI 智能练习",
        subtitle: "海量题库，智能推荐",
        icon: "/images/icons/white/brain.svg",
        gradient: "bg-grad-blue",
        count: "推荐题目",
        type: 'ai'
      },
      {
        title: "错题强化复习",
        subtitle: "道错题等你复习",
        icon: "/images/icons/white/homework.svg",
        gradient: "bg-grad-orange",
        count: "题",
        type: 'review'
      },
    ],
    todayStats: {
      practiced: 0,
      correct: 0,
      accuracy: 0,
      total: 0
    },
    recentRecords: [],
    reviewCount: 0 // For '错题强化复习' card
  },

  onLoad(options) {
    this.loadPracticeData()
  },

  onShow() {
    // 更新tabBar状态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setActiveTab(2);
    }
    
    // Reload data every time the page is shown to reflect updates
    this.loadPracticeData()
  },

  onPullDownRefresh() {
    this.loadPracticeData().then(() => {
      wx.stopPullDownRefresh()
    })
  },

  // 加载练习数据
  async loadPracticeData() {
    this.setData({ loading: true });
    console.log('加载练习页面数据...');
    
    try {
      // 加载真实的统计数据
      await this.loadRealData();
    } catch (error) {
      console.error('加载练习数据失败:', error);
      // 如果加载失败，设置默认值
      this.setDefaultData();
    }
    
    this.setData({ loading: false });
  },

  async loadRealData() {
    const userId = wx.getStorageSync('userId') || 'default_user';
    
    // 1. 获取今日统计
    const statsResult = await DatabaseManager.getTodayStats(userId);
    let todayStats = { practiced: 0, correct: 0, accuracy: 0, total: 0 };
    
    if (statsResult.success) {
      const stats = statsResult.data;
      todayStats = {
        practiced: stats.todayMistakes || 0,
        correct: stats.masteredCount || 0, 
        accuracy: stats.masteryRate || 0,
        total: stats.totalMistakes || 0
      };
      console.log('今日统计数据:', todayStats);
    }

    // 2. 获取错题数量（用于复习计数）
    const mistakesResult = await DatabaseManager.getMistakes(userId, { 
      pageSize: 100,
      filters: { status: 'all' }
    });
    
    let reviewCount = 0;
    if (mistakesResult.success && mistakesResult.data) {
      reviewCount = mistakesResult.data.length;
      console.log('错题数量:', reviewCount);
    }

    // 3. 获取复习记录（用于显示最近记录）
    const reviewResult = await DatabaseManager.getReviewRecords(userId, { pageSize: 3 });
    let recentRecords = [];
    
    if (reviewResult.success && reviewResult.data) {
      recentRecords = reviewResult.data.map((record, index) => ({
        type: "错题复习",
        subject: record.subject || "未知",
        time: this.formatRecentTime(record.reviewTime || record.createTime),
        duration: "已完成",
        score: record.isCorrect ? 100 : 0,
        icon: this.getSubjectIcon(record.subject),
        gradient: index % 3 === 0 ? "bg-grad-blue" : index % 3 === 1 ? "bg-grad-orange" : "bg-grad-green"
      }));
      console.log('最近复习记录:', recentRecords);
    }

    // 更新页面数据
    this.setData({
      todayStats: todayStats,
      recentRecords: recentRecords,
      reviewCount: reviewCount,
      'practiceOptions[1].subtitle': reviewCount > 0 ? `${reviewCount} 道错题等你复习` : '暂无错题需要复习',
      'practiceOptions[1].count': reviewCount > 0 ? `${reviewCount}题` : '0题',
    });
    
    console.log('练习页面数据加载完成');
  },

  setDefaultData() {
    // 设置默认空数据
    this.setData({
      todayStats: { practiced: 0, correct: 0, accuracy: 0, total: 0 },
      recentRecords: [],
      reviewCount: 0,
      'practiceOptions[1].subtitle': '暂无错题需要复习',
      'practiceOptions[1].count': '0题',
    });
  },

  // 格式化时间显示
  formatRecentTime(timeString) {
    if (!timeString) return '未知时间';
    
    const time = new Date(timeString);
    const now = new Date();
    const diffMs = now - time;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return `今天 ${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`;
    } else if (diffDays === 1) {
      return `昨天 ${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`;
    } else if (diffDays < 7) {
      return `${diffDays}天前`;
    } else {
      return `${time.getMonth() + 1}月${time.getDate()}日`;
    }
  },

  // 获取学科图标
  getSubjectIcon(subject) {
    const iconMap = {
      '数学': '/images/icons/white/maths.svg',
      '语文': '/images/icons/white/chinese.svg', 
      '英语': '/images/icons/white/english.svg'
    };
    return iconMap[subject] || '/images/icons/white/maths.svg';
  },



  // 跳转到练习配置页
  goToConfig(e) {
    const type = e.currentTarget.dataset.type;
    const url = `/pages/practice/config?type=${type}`;
    console.log(`准备跳转到: ${url}`);
    wx.navigateTo({
      url: url,
      success: () => {
        console.log(`跳转成功: ${url}`);
      },
      fail: (err) => {
        console.error(`跳转失败: ${url}`, err);
        wx.showToast({
          title: '页面跳转失败，请稍后重试',
          icon: 'none'
        });
      }
    });
  },

  // 跳转到练习结果示例页
  goToResult() {
    wx.navigateTo({ url: '/pages/practice/result' })
  },

  // Example navigation for record items
  onRecordTap(e) {
    const record = e.currentTarget.dataset.record;
    console.log("Tapped record:", record);
    // 根据记录类型跳转到相应页面
    if (record && record.type && record.type.indexOf('错题') !== -1) {
      // 跳转到复习配置
      wx.navigateTo({ url: '/pages/review/review' });
    } else {
      // 默认跳转到练习结果示例
      wx.navigateTo({ url: '/pages/practice/result' });
    }
  }
}) 
