const app = getApp()
import DatabaseManager from '../../utils/database.js';

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

  async onLoad() {
    this.loadReviewData();
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

  // 新增：加载真实复习数据
  async loadReviewData() {
    this.setData({ loading: true });
    
    try {
      const dbManager = DatabaseManager;  // 直接使用单例对象
      const reviewMistakes = await dbManager.getMistakes({ needReview: true });
      const todayStats = await dbManager.getStudyStats('today');
      
      this.setData({
        'reviewStats.pending': reviewMistakes.length,
        'reviewStats.completed': todayStats.practiceCount,
        'reviewStats.accuracy': todayStats.correctRate,
        loading: false
      });
      
      this.updateSubjectProgress(reviewMistakes);
    } catch (error) {
      console.error('加载复习数据失败:', error);
      this.setData({ loading: false });
    }
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

  // 增强：快速复习功能
  async onQuickReview() {
    try {
      const dbManager = DatabaseManager;  // 修复这里
      const reviewMistakes = await dbManager.getMistakes({ needReview: true });
      
      if (reviewMistakes.length === 0) {
        wx.showToast({
          title: '暂无需要复习的题目',
          icon: 'none'
        });
        return;
      }

      const quickReviewMistakes = reviewMistakes.slice(0, 5);
      
      wx.navigateTo({
        url: `/pages/practice/session?type=review&mistakes=${encodeURIComponent(JSON.stringify(quickReviewMistakes))}`
      });
    } catch (error) {
      console.error('启动快速复习失败:', error);
      wx.showToast({
        title: '启动失败，请重试',
        icon: 'error'
      });
    }
  },

  // 增强：分科复习
  async onSubjectReview() {
    try {
      const dbManager = DatabaseManager;  // 修复这里
      const mistakes = await dbManager.getMistakes();
      const subjects = [...new Set(mistakes.map(m => m.subject))];
      
      wx.showActionSheet({
        itemList: subjects,
        success: async (res) => {
          const selectedSubject = subjects[res.tapIndex];
          const subjectMistakes = await dbManager.getMistakes({ 
            subject: selectedSubject,
            needReview: true 
          });
          
          if (subjectMistakes.length === 0) {
            wx.showToast({
              title: `${selectedSubject}暂无需复习题目`,
              icon: 'none'
            });
            return;
          }
          
          wx.navigateTo({
            url: `/pages/practice/session?type=review&subject=${selectedSubject}&mistakes=${encodeURIComponent(JSON.stringify(subjectMistakes))}`
          });
        }
      });
    } catch (error) {
      console.error('启动分科复习失败:', error);
    }
  },

  // 系统复习
  onSystematicReview() {
    wx.navigateTo({
      url: '/pages/practice/config?type=review&mode=systematic'
    })
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
