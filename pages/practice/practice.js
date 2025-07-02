const app = getApp()

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
    this.setData({ loading: true })
    // In a real app, you would fetch data from an API here.
    // We'll use mock data for now.
    await this.loadMockData();
    this.setData({ loading: false })
  },

  loadMockData() {
    // Mock data based on V0 design
    const todayStats = {
      practiced: 9,
      correct: 6,
      accuracy: 67,
      total: 9
    };

    const recentRecords = [
      {
        type: "AI智能练习",
        subject: "数学",
        time: "今天 14:30",
        duration: "用时25分钟",
        score: 80,
        icon: "/images/icons/white/maths.svg",
        gradient: "bg-grad-blue",
      },
      {
        type: "错题复习",
        subject: "语文",
        time: "昨天 16:45",
        duration: "用时15分钟",
        score: 62,
        icon: "/images/icons/white/chinese.svg",
        gradient: "bg-grad-orange",
      },
      {
        type: "分科练习",
        subject: "英语",
        time: "昨天 10:20",
        duration: "用时30分钟",
        score: 80,
        icon: "/images/icons/white/english.svg",
        gradient: "bg-grad-green",
      },
    ];

    const reviewCount = 44;

    this.setData({
      todayStats: todayStats,
      recentRecords: recentRecords,
      reviewCount: reviewCount,
      'practiceOptions[1].subtitle': `${reviewCount} 道错题等你复习`,
      'practiceOptions[1].count': `${reviewCount}题`,
    });
    
    return Promise.resolve();
  },

  // 加载今日统计
  loadTodayStats() {
    return new Promise((resolve) => {
      // 模拟API调用
      setTimeout(() => {
        const stats = {
          practiced: Math.floor(Math.random() * 15) + 5,
          correct: Math.floor(Math.random() * 10) + 5,
          accuracy: Math.floor(Math.random() * 30) + 70
        }
        this.setData({ todayStats: stats })
        resolve(stats)
      }, 300)
    })
  },

  // 加载学科数据
  loadSubjectData() {
    return new Promise((resolve) => {
      // 模拟API调用，这里应该从后端获取实际数据
      setTimeout(() => {
        const subjects = this.data.subjectData.map(subject => ({
          ...subject,
          mistakeCount: Math.floor(Math.random() * 50) + 10,
          masteryRate: Math.floor(Math.random() * 40) + 60
        }))
        
        this.setData({ 
          subjectData: subjects,
          reviewCount: subjects.reduce((sum, s) => sum + Math.floor(s.mistakeCount * 0.3), 0)
        })
        resolve(subjects)
      }, 500)
    })
  },

  // 加载最近记录
  loadRecentRecords() {
    return new Promise((resolve) => {
      // 模拟API调用
      setTimeout(() => {
        const records = this.data.recentRecords
        this.setData({ recentRecords: records })
        resolve(records)
      }, 400)
    })
  },

  // 跳转到练习配置页
  goToConfig(e) {
    const type = e.currentTarget.dataset.type;
    // 'review' type should also go to config, but might have specific settings
    const url = `/pages/practice/config?type=${type}`;
    console.log(`准备跳转到: ${url}`);
    wx.navigateTo({
      url: url,
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
    // Navigate to a result page, e.g.
    // wx.navigateTo({ url: `/pages/practice/result?id=${record.id}` })
    wx.showToast({
      title: `查看 ${record.type} 记录`,
      icon: 'none'
    })
  }
}) 