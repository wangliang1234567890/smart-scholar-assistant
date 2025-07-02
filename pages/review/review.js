const app = getApp()

Page({
  data: {
    loading: false,
    // 改造后的数据，用于传入组件
    reviewStats: [],
    // 原始数据，用于页面逻辑判断
    _rawReviewStats: { 
      total: 0,
      urgent: 0 
    },
    subjectReview: [
      {
        name: '数学',
        icon: 'calculator',
        total: 12,
        reviewed: 8,
        reviewedRate: 67,
        urgency: 'high',
        urgencyText: '紧急'
      },
      {
        name: '语文',
        icon: 'description',
        total: 8,
        reviewed: 6,
        reviewedRate: 75,
        urgency: 'medium',
        urgencyText: '中等'
      },
      {
        name: '英语',
        icon: 'chat',
        total: 4,
        reviewed: 4,
        reviewedRate: 100,
        urgency: 'low',
        urgencyText: '较低'
      }
    ],
    recentReviews: [
      {
        id: 1,
        title: '数学错题复习',
        date: '今天 15:30',
        count: 5,
        accuracy: 80
      },
      {
        id: 2,
        title: '语文错题复习',
        date: '昨天 16:20',
        count: 8,
        accuracy: 62
      }
    ]
  },

  onLoad(options) {
    this.loadReviewData()
  },

  onShow() {
    this.loadReviewStats()
  },

  onPullDownRefresh() {
    this.loadReviewData()
    wx.stopPullDownRefresh()
  },

  // 加载复习数据
  loadReviewData() {
    this.setData({ loading: true })
    
    Promise.all([
      this.loadReviewStats(),
      this.loadSubjectReview(),
      this.loadRecentReviews()
    ]).then(() => {
      this.setData({ loading: false })
    })
  },

  // 加载复习统计
  loadReviewStats() {
    return new Promise((resolve) => {
      setTimeout(() => {
        const stats = {
          total: Math.floor(Math.random() * 30) + 10,
          completed: Math.floor(Math.random() * 20) + 5,
          accuracy: Math.floor(Math.random() * 30) + 60,
          urgent: Math.floor(Math.random() * 10) + 3
        }
        
        const formattedStats = [
          { value: stats.total, label: '待复习' },
          { value: stats.completed, label: '已复习' },
          { value: `${stats.accuracy}%`, label: '正确率' }
        ];

        this.setData({ 
          _rawReviewStats: stats,
          reviewStats: formattedStats
        })
        resolve(stats)
      }, 300)
    })
  },

  // 加载学科复习数据
  loadSubjectReview() {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(this.data.subjectReview)
      }, 200)
    })
  },

  // 加载最近复习记录
  loadRecentReviews() {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(this.data.recentReviews)
      }, 100)
    })
  },

  // 快速复习
  onQuickReview() {
    if (this.data._rawReviewStats.urgent === 0) {
      wx.showToast({
        title: '暂无紧急复习题目',
        icon: 'none'
      })
      return
    }
    
    wx.navigateTo({
      url: '/pages/practice/config?type=review&mode=quick'
    })
  },

  // 分科复习
  onSubjectReview() {
    wx.showActionSheet({
      itemList: this.data.subjectReview.map(s => `${s.name} (${s.total - s.reviewed}题)`),
      success: (res) => {
        const subject = this.data.subjectReview[res.tapIndex]
        wx.navigateTo({
          url: `/pages/practice/config?type=review&mode=subject&subject=${subject.name}`
        })
      }
    })
  },

  // 系统复习
  onSystematicReview() {
    wx.navigateTo({
      url: '/pages/practice/config?type=review&mode=systematic'
    })
  },

  // 查看所有学科
  onViewAllSubjects() {
    wx.showToast({ title: '功能开发中', icon: 'none' });
  },

  // 学科复习详情
  onSubjectReviewDetail(e) {
    const { subject } = e.currentTarget.dataset
    wx.navigateTo({
      url: `/pages/practice/config?type=review&mode=subject&subject=${subject.name}`
    })
  },

  // 查看所有复习记录
  onViewAllReviews() {
    wx.showToast({ title: '功能开发中', icon: 'none' });
  },

  // 复习详情
  onReviewDetail(e) {
    const { review } = e.currentTarget.dataset
    wx.showToast({ title: '功能开发中', icon: 'none' });
  },

  // 去录题
  onAddMistakes() {
    wx.switchTab({
      url: '/pages/mistakes/mistakes'
    })
  }
}) 