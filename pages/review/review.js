const app = getApp()

Page({
  data: {
    loading: false,
    pageTitle: '智能复习',
    pageSubtitle: '科学复习，高效提升',
    
    // 复习统计数据
    reviewStats: {
      pending: 20,    // 待复习
      completed: 10,  // 已复习
      accuracy: 86    // 正确率
    },
    
    // 复习模式
    reviewModes: [
      {
        id: 'quick',
        name: '快速复习',
        desc: '5分钟快速复习',
        color: '#F59E0B',
        iconText: '⚡',
        action: 'onQuickReview'
      },
      {
        id: 'subject',
        name: '分科复习',
        desc: '按学科分类复习',
        color: '#4F46E5',
        iconText: '📚',
        action: 'onSubjectReview'
      },
      {
        id: 'systematic',
        name: '系统复习',
        desc: '按遗忘曲线复习',
        color: '#8B5CF6',
        iconText: '🧠',
        action: 'onSystematicReview'
      }
    ],
    
    // 学科进度
    subjectProgress: [
      {
        id: 'math',
        name: '数学',
        progress: 8,
        total: 12,
        percentage: 67,
        urgency: 'urgent',
        urgencyText: '紧急',
        urgencyColor: '#EF4444'
      },
      {
        id: 'chinese',
        name: '语文',
        progress: 6,
        total: 8,
        percentage: 75,
        urgency: 'medium',
        urgencyText: '中等',
        urgencyColor: '#F59E0B'
      },
      {
        id: 'english',
        name: '英语',
        progress: 4,
        total: 4,
        percentage: 100,
        urgency: 'completed',
        urgencyText: '完成',
        urgencyColor: '#10B981'
      }
    ],
    
    // 最近复习记录
    recentReviews: [
      {
        id: 1,
        title: '数学错题复习',
        date: '今天 15:30',
        count: 5,
        accuracy: 80,
        subject: '数学'
      },
      {
        id: 2,
        title: '语文错题复习',
        date: '昨天 16:20',
        count: 8,
        accuracy: 62,
        subject: '语文'
      }
    ]
  },

  onLoad(options) {
    // 获取系统信息设置导航栏高度
    const systemInfo = wx.getSystemInfoSync()
    const statusBarHeight = systemInfo.statusBarHeight
    const navBarHeight = 44 // iOS导航栏标准高度
    
    this.setData({
      statusBarHeight,
      navBarHeight,
      totalNavHeight: statusBarHeight + navBarHeight
    })
    
    this.loadReviewData()
  },

  onShow() {
    this.loadReviewStats()
  },

  onPullDownRefresh() {
    this.loadReviewData()
    wx.stopPullDownRefresh()
  },

  // 自定义导航栏事件
  onBack() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack()
    } else {
      wx.switchTab({
        url: '/pages/home/home'
      })
    }
  },

  onMenu() {
    wx.showActionSheet({
      itemList: ['设置提醒', '复习统计', '导出数据'],
      success: (res) => {
        switch (res.tapIndex) {
          case 0:
            wx.showToast({ title: '设置提醒功能开发中', icon: 'none' })
            break
          case 1:
            wx.navigateTo({ url: '/pages/report/report' })
            break
          case 2:
            wx.showToast({ title: '导出数据功能开发中', icon: 'none' })
            break
        }
      }
    })
  },

  // 加载复习数据
  loadReviewData() {
    this.setData({ loading: true })
    
    Promise.all([
      this.loadReviewStats(),
      this.loadSubjectProgress(),
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
          pending: Math.floor(Math.random() * 20) + 15,
          completed: Math.floor(Math.random() * 15) + 5,
          accuracy: Math.floor(Math.random() * 20) + 70
        }
        
        this.setData({ reviewStats: stats })
        resolve(stats)
      }, 300)
    })
  },

  // 加载学科进度
  loadSubjectProgress() {
    return new Promise((resolve) => {
      setTimeout(() => {
        // 模拟动态数据
        const subjects = this.data.subjectProgress.map(subject => ({
          ...subject,
          progress: Math.floor(Math.random() * subject.total) + 1
        }))
        
        this.setData({ subjectProgress: subjects })
        resolve(subjects)
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

  // 复习模式点击处理
  onModeClick(e) {
    const { mode } = e.currentTarget.dataset
    const action = mode.action
    
    if (this[action]) {
      this[action]()
    }
  },

  // 快速复习
  onQuickReview() {
    if (this.data.reviewStats.pending === 0) {
      wx.showToast({
        title: '暂无待复习题目',
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
    const subjects = this.data.subjectProgress.filter(s => s.progress < s.total)
    
    if (subjects.length === 0) {
      wx.showToast({
        title: '所有学科都已复习完成',
        icon: 'none'
      })
      return
    }
    
    wx.showActionSheet({
      itemList: subjects.map(s => `${s.name} (${s.total - s.progress}题)`),
      success: (res) => {
        const subject = subjects[res.tapIndex]
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
    wx.showToast({ title: '功能开发中', icon: 'none' })
  },

  // 学科进度点击
  onSubjectClick(e) {
    const { subject } = e.currentTarget.dataset
    
    if (subject.progress >= subject.total) {
      wx.showToast({
        title: '该学科已复习完成',
        icon: 'none'
      })
      return
    }
    
    wx.navigateTo({
      url: `/pages/practice/config?type=review&mode=subject&subject=${subject.name}`
    })
  },

  // 查看所有复习记录
  onViewAllReviews() {
    wx.showToast({ title: '功能开发中', icon: 'none' })
  },

  // 复习记录点击
  onReviewClick(e) {
    const { review } = e.currentTarget.dataset
    wx.showToast({ title: '功能开发中', icon: 'none' })
  },

  // 去录题
  onAddMistakes() {
    wx.switchTab({
      url: '/pages/mistakes/mistakes'
    })
  }
}) 