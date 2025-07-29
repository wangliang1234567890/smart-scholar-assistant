const app = getApp()
import DatabaseManager from '../../utils/database.js';

Page({
  data: {
    loading: false,
    refreshing: false,
    pageTitle: '智能复习',
    pageSubtitle: '科学复习，高效提升',
    
    // 复习统计数据
    reviewStats: {
      pending: 0,      // 待复习
      completed: 0,    // 已复习
      accuracy: 0,     // 正确率
      totalMistakes: 0,// 总错题数
      masteryRate: 0   // 掌握率
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
    
    // 学科进度（动态加载）
    subjectProgress: [],
    
    // 最近复习记录（动态加载）
    recentReviews: []
  },

  async onLoad() {
    console.log('复习页面加载');
    await this.loadAllData();
  },

  async onShow() {
    console.log('复习页面显示');
    // 每次显示时刷新数据，确保最新状态
    await this.loadAllData();
  },

  async onPullDownRefresh() {
    console.log('下拉刷新复习数据');
    this.setData({ refreshing: true });
    await this.loadAllData();
    this.setData({ refreshing: false });
    wx.stopPullDownRefresh();
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
      itemList: ['设置提醒', '复习统计', '导出数据', '清除缓存'],
      success: (res) => {
        switch (res.tapIndex) {
          case 0:
            this.onSetReminder();
            break;
          case 1:
            wx.navigateTo({ url: '/pages/report/report' });
            break;
          case 2:
            this.onExportData();
            break;
          case 3:
            this.onClearCache();
            break;
        }
      }
    });
  },

  /**
   * 加载所有数据
   */
  async loadAllData() {
    this.setData({ loading: true });
    
    try {
      console.log('开始加载复习数据');
      
      // 并行加载多种数据
      const [
        reviewStatsResult,
        subjectProgressResult,
        recentReviewsResult
      ] = await Promise.all([
        this.loadReviewStats(),
        this.loadSubjectProgress(),
        this.loadRecentReviews()
      ]);
      
      console.log('复习数据加载完成:', {
        reviewStats: reviewStatsResult,
        subjectProgress: subjectProgressResult.length,
        recentReviews: recentReviewsResult.length
      });
      
    } catch (error) {
      console.error('加载复习数据失败:', error);
      wx.showToast({
        title: '数据加载失败',
        icon: 'error'
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  /**
   * 加载复习统计数据 - 使用真实数据
   */
  async loadReviewStats() {
    try {
      const userId = DatabaseManager.getCurrentUserId();
      
      // 获取今日统计
      const todayStatsResult = await DatabaseManager.getTodayStats(userId);
      if (!todayStatsResult.success) {
        throw new Error('获取今日统计失败');
      }
      
      // 获取需要复习的错题（今天应该复习的）
      const now = new Date();
      const mistakesResult = await DatabaseManager.getMistakes(userId, {
        pageSize: 100 // 获取更多数据以便统计
      });
      
      if (!mistakesResult.success) {
        throw new Error('获取错题列表失败');
      }
      
      // 计算需要复习的错题数量
      const allMistakes = mistakesResult.data;
      const pendingReview = allMistakes.filter(mistake => {
        if (!mistake.nextReviewTime) return false;
        const reviewTime = new Date(mistake.nextReviewTime);
        return reviewTime <= now && mistake.status !== 'mastered';
      });
      
      // 获取最近复习记录来计算准确率
      const reviewRecordsResult = await DatabaseManager.getReviewRecords(userId, {
        pageSize: 50
      });
      
      let accuracy = 0;
      let completed = 0;
      
      if (reviewRecordsResult.success && reviewRecordsResult.data.length > 0) {
        const recentRecords = reviewRecordsResult.data;
        completed = recentRecords.length;
        
        // 计算平均准确率
        const totalAccuracy = recentRecords.reduce((sum, record) => {
          return sum + (record.accuracy || 0);
        }, 0);
        accuracy = recentRecords.length > 0 ? Math.round(totalAccuracy / recentRecords.length) : 0;
      }
      
      const reviewStats = {
        pending: pendingReview.length,
        completed: completed,
        accuracy: accuracy,
        totalMistakes: todayStatsResult.data.totalMistakes,
        masteryRate: todayStatsResult.data.masteryRate
      };
      
      this.setData({ reviewStats });
      console.log('复习统计加载成功:', reviewStats);
      
      return reviewStats;
      
    } catch (error) {
      console.error('加载复习统计失败:', error);
      // 设置默认值
      const defaultStats = {
        pending: 0,
        completed: 0,
        accuracy: 0,
        totalMistakes: 0,
        masteryRate: 0
      };
      this.setData({ reviewStats: defaultStats });
      return defaultStats;
    }
  },

  /**
   * 加载学科进度 - 使用真实数据
   */
  async loadSubjectProgress() {
    try {
      const userId = DatabaseManager.getCurrentUserId();
      const mistakesResult = await DatabaseManager.getMistakes(userId, {
        pageSize: 200 // 获取足够多的数据
      });
      
      if (!mistakesResult.success) {
        throw new Error('获取错题数据失败');
      }
      
      const allMistakes = mistakesResult.data;
      const now = new Date();
      
      // 按学科分组统计
      const subjectMap = new Map();
      
      allMistakes.forEach(mistake => {
        const subject = mistake.subject || 'unknown';
        if (!subjectMap.has(subject)) {
          subjectMap.set(subject, {
            id: subject,
            name: this.getSubjectDisplayName(subject),
            total: 0,
            needReview: 0,
            completed: 0
          });
        }
        
        const subjectData = subjectMap.get(subject);
        subjectData.total++;
        
        // 判断是否需要复习
        if (mistake.nextReviewTime) {
          const reviewTime = new Date(mistake.nextReviewTime);
          if (reviewTime <= now && mistake.status !== 'mastered') {
            subjectData.needReview++;
          }
        }
        
        // 判断是否已掌握
        if (mistake.status === 'mastered' || mistake.reviewLevel >= 5) {
          subjectData.completed++;
        }
      });
      
      // 转换为数组并计算进度
      const subjectProgress = Array.from(subjectMap.values()).map(subject => {
        const percentage = subject.total > 0 ? Math.round((subject.completed / subject.total) * 100) : 0;
        const progress = subject.completed;
        
        // 确定紧急程度
        let urgency, urgencyText, urgencyColor;
        if (percentage >= 90) {
          urgency = 'completed';
          urgencyText = '完成';
          urgencyColor = '#10B981';
        } else if (subject.needReview > 5) {
          urgency = 'urgent';
          urgencyText = '紧急';
          urgencyColor = '#EF4444';
        } else if (subject.needReview > 0) {
          urgency = 'medium';
          urgencyText = '中等';
          urgencyColor = '#F59E0B';
        } else {
          urgency = 'low';
          urgencyText = '较少';
          urgencyColor = '#6B7280';
        }
        
        return {
          ...subject,
          progress,
          percentage,
          urgency,
          urgencyText,
          urgencyColor
        };
      }).sort((a, b) => b.needReview - a.needReview); // 按需要复习数量排序
      
      this.setData({ subjectProgress });
      console.log('学科进度加载成功:', subjectProgress);
      
      return subjectProgress;
      
    } catch (error) {
      console.error('加载学科进度失败:', error);
      this.setData({ subjectProgress: [] });
      return [];
    }
  },

  /**
   * 加载最近复习记录 - 使用真实数据
   */
  async loadRecentReviews() {
    try {
      const userId = DatabaseManager.getCurrentUserId();
      const reviewRecordsResult = await DatabaseManager.getReviewRecords(userId, {
        pageSize: 10,
        pageIndex: 0
      });
      
      if (!reviewRecordsResult.success) {
        throw new Error('获取复习记录失败');
      }
      
      const recentReviews = reviewRecordsResult.data.map(record => ({
        id: record._id,
        title: this.generateReviewTitle(record),
        date: this.formatReviewDate(record.reviewTime || record.createTime),
        count: record.questionCount || 0,
        accuracy: record.accuracy || 0,
        subject: record.subject || '综合',
        type: record.reviewType || 'practice'
      }));
      
      this.setData({ recentReviews });
      console.log('最近复习记录加载成功:', recentReviews.length);
      
      return recentReviews;
      
    } catch (error) {
      console.error('加载复习记录失败:', error);
      this.setData({ recentReviews: [] });
      return [];
    }
  },

  /**
   * 复习模式点击处理
   */
  onModeClick(e) {
    const { mode } = e.currentTarget.dataset;
    const action = mode.action;
    
    if (this[action]) {
      this[action]();
    }
  },

  /**
   * 快速复习 - 智能选择最需要复习的错题
   */
  async onQuickReview() {
    try {
      wx.showLoading({ title: '准备复习题目...' });
      
      const userId = DatabaseManager.getCurrentUserId();
      const mistakesResult = await DatabaseManager.getMistakes(userId, {
        pageSize: 50
      });
      
      if (!mistakesResult.success) {
        throw new Error('获取错题失败');
      }
      
      // 筛选需要复习的错题
      const now = new Date();
      const needReviewMistakes = mistakesResult.data.filter(mistake => {
        if (!mistake.nextReviewTime) return false;
        const reviewTime = new Date(mistake.nextReviewTime);
        return reviewTime <= now && mistake.status !== 'mastered';
      });
      
      if (needReviewMistakes.length === 0) {
        wx.hideLoading();
        wx.showModal({
          title: '暂无复习内容',
          content: '当前没有需要复习的错题，是否进行随机练习？',
          success: async (res) => {
            if (res.confirm) {
              // 随机选择一些错题进行练习
              const randomMistakes = mistakesResult.data
                .filter(m => m.status !== 'mastered')
                .slice(0, 5);
              
              if (randomMistakes.length > 0) {
                this.navigateToReview(randomMistakes, 'random');
              } else {
                wx.showToast({
                  title: '暂无可练习的错题',
                  icon: 'none'
                });
              }
            }
          }
        });
        return;
      }
      
      // 按优先级排序：复习次数少的、间隔时间长的优先
      const sortedMistakes = needReviewMistakes.sort((a, b) => {
        const aReviewCount = a.reviewCount || 0;
        const bReviewCount = b.reviewCount || 0;
        
        if (aReviewCount !== bReviewCount) {
          return aReviewCount - bReviewCount; // 复习次数少的优先
        }
        
        const aReviewTime = new Date(a.nextReviewTime || 0);
        const bReviewTime = new Date(b.nextReviewTime || 0);
        return aReviewTime - bReviewTime; // 应该复习时间早的优先
      });
      
      // 选择前5题进行快速复习
      const quickReviewMistakes = sortedMistakes.slice(0, 5);
      
      wx.hideLoading();
      this.navigateToReview(quickReviewMistakes, 'quick');
      
    } catch (error) {
      console.error('启动快速复习失败:', error);
      wx.hideLoading();
      wx.showToast({
        title: '启动失败，请重试',
        icon: 'error'
      });
    }
  },

  /**
   * 分科复习
   */
  async onSubjectReview() {
    try {
      wx.showLoading({ title: '加载学科数据...' });
      
      const userId = DatabaseManager.getCurrentUserId();
      const mistakesResult = await DatabaseManager.getMistakes(userId, {
        pageSize: 100
      });
      
      if (!mistakesResult.success) {
        throw new Error('获取错题失败');
      }
      
      // 获取所有学科
      const subjectSet = new Set();
      mistakesResult.data.forEach(mistake => {
        if (mistake.subject && mistake.subject !== 'unknown') {
          subjectSet.add(mistake.subject);
        }
      });
      
      const subjects = Array.from(subjectSet);
      
      if (subjects.length === 0) {
        wx.hideLoading();
        wx.showToast({
          title: '暂无学科数据',
          icon: 'none'
        });
        return;
      }
      
      wx.hideLoading();
      
      wx.showActionSheet({
        itemList: subjects.map(subject => this.getSubjectDisplayName(subject)),
        success: async (res) => {
          const selectedSubject = subjects[res.tapIndex];
          await this.startSubjectReview(selectedSubject);
        }
      });
      
    } catch (error) {
      console.error('启动分科复习失败:', error);
      wx.hideLoading();
      wx.showToast({
        title: '加载失败，请重试',
        icon: 'error'
      });
    }
  },

  /**
   * 开始学科复习
   */
  async startSubjectReview(subject) {
    try {
      wx.showLoading({ title: '准备复习题目...' });
      
      const userId = DatabaseManager.getCurrentUserId();
      const mistakesResult = await DatabaseManager.getMistakes(userId, {
        subject: subject,
        pageSize: 50
      });
      
      if (!mistakesResult.success) {
        throw new Error('获取学科错题失败');
      }
      
      // 筛选需要复习的错题
      const now = new Date();
      const subjectMistakes = mistakesResult.data.filter(mistake => {
        if (mistake.status === 'mastered') return false;
        if (!mistake.nextReviewTime) return true; // 从未复习的也算需要复习
        const reviewTime = new Date(mistake.nextReviewTime);
        return reviewTime <= now;
      });
      
      wx.hideLoading();
      
      if (subjectMistakes.length === 0) {
        const subjectName = this.getSubjectDisplayName(subject);
        wx.showToast({
          title: `${subjectName}暂无需复习题目`,
          icon: 'none'
        });
        return;
      }
      
      this.navigateToReview(subjectMistakes, 'subject', subject);
      
    } catch (error) {
      console.error('开始学科复习失败:', error);
      wx.hideLoading();
      wx.showToast({
        title: '启动失败，请重试',
        icon: 'error'
      });
    }
  },

  /**
   * 系统复习 - 基于艾宾浩斯遗忘曲线
   */
  async onSystematicReview() {
    try {
      wx.showLoading({ title: '分析复习计划...' });
      
      const userId = DatabaseManager.getCurrentUserId();
      const mistakesResult = await DatabaseManager.getMistakes(userId, {
        pageSize: 100
      });
      
      if (!mistakesResult.success) {
        throw new Error('获取错题失败');
      }
      
      // 使用艾宾浩斯遗忘曲线算法分析复习计划
      const systematicMistakes = this.analyzeSystematicReview(mistakesResult.data);
      
      wx.hideLoading();
      
      if (systematicMistakes.length === 0) {
        wx.showModal({
          title: '系统复习',
          content: '当前没有需要系统复习的错题。系统复习基于艾宾浩斯遗忘曲线，会在最佳时间安排复习。',
          showCancel: false
        });
        return;
      }
      
      // 显示复习计划详情
      wx.showModal({
        title: '系统复习计划',
        content: `根据遗忘曲线分析，为您准备了${systematicMistakes.length}道题目。建议每天按计划复习，效果最佳。`,
        confirmText: '开始复习',
        success: (res) => {
          if (res.confirm) {
            this.navigateToReview(systematicMistakes, 'systematic');
          }
        }
      });
      
    } catch (error) {
      console.error('启动系统复习失败:', error);
      wx.hideLoading();
      wx.showToast({
        title: '分析失败，请重试',
        icon: 'error'
      });
    }
  },

  /**
   * 分析系统复习计划 - 艾宾浩斯遗忘曲线
   */
  analyzeSystematicReview(mistakes) {
    const now = new Date();
    const systematicMistakes = [];
    
    mistakes.forEach(mistake => {
      // 跳过已掌握的错题
      if (mistake.status === 'mastered' || mistake.reviewLevel >= 6) {
        return;
      }
      
      // 计算复习优先级
      let priority = 0;
      const reviewLevel = mistake.reviewLevel || 0;
      const lastReviewTime = mistake.lastReviewTime ? new Date(mistake.lastReviewTime) : null;
      const nextReviewTime = mistake.nextReviewTime ? new Date(mistake.nextReviewTime) : null;
      
      // 从未复习过的错题优先级最高
      if (!lastReviewTime) {
        priority = 1000;
      } else if (nextReviewTime && nextReviewTime <= now) {
        // 已到复习时间的错题
        const overdueDays = Math.max(0, Math.floor((now - nextReviewTime) / (24 * 60 * 60 * 1000)));
        priority = 500 + overdueDays * 10; // 逾期越久优先级越高
      } else if (reviewLevel < 3) {
        // 复习次数较少的错题
        priority = 300 - reviewLevel * 50;
      }
      
      if (priority > 0) {
        systematicMistakes.push({
          ...mistake,
          priority
        });
      }
    });
    
    // 按优先级排序
    systematicMistakes.sort((a, b) => b.priority - a.priority);
    
    // 返回前20题，避免一次性复习太多
    return systematicMistakes.slice(0, 20);
  },

  /**
   * 导航到复习页面
   */
  navigateToReview(mistakes, reviewType, subject = '') {
    if (!mistakes || mistakes.length === 0) {
      wx.showToast({
        title: '没有复习内容',
        icon: 'none'
      });
      return;
    }
    
    const url = `/pages/practice/session?type=review&reviewType=${reviewType}&subject=${subject}&mistakes=${encodeURIComponent(JSON.stringify(mistakes))}`;
    
    wx.navigateTo({
      url: url,
      success: () => {
        console.log(`开始${reviewType}复习，题目数量:`, mistakes.length);
      },
      fail: (error) => {
        console.error('导航到复习页面失败:', error);
        wx.showToast({
          title: '跳转失败',
          icon: 'error'
        });
      }
    });
  },

  /**
   * 学科进度点击
   */
  async onSubjectClick(e) {
    const { subject } = e.currentTarget.dataset;
    
    if (subject.percentage >= 90) {
      wx.showToast({
        title: '该学科已基本掌握',
        icon: 'none'
      });
      return;
    }
    
    await this.startSubjectReview(subject.id);
  },

  /**
   * 查看所有复习记录
   */
  async onViewAllReviews() {
    wx.navigateTo({
      url: '/pages/report/report?tab=review',
      fail: () => {
        wx.showToast({
          title: '功能开发中',
          icon: 'none'
        });
      }
    });
  },

  /**
   * 复习记录点击
   */
  onReviewClick(e) {
    const { review } = e.currentTarget.dataset;
    
    wx.showModal({
      title: '复习记录详情',
      content: `复习时间：${review.date}\n题目数量：${review.count}题\n正确率：${review.accuracy}%\n学科：${review.subject}`,
      showCancel: false
    });
  },

  /**
   * 去录题
   */
  onAddMistakes() {
    wx.switchTab({
      url: '/pages/mistakes/mistakes'
    });
  },

  /**
   * 设置提醒
   */
  onSetReminder() {
    wx.showModal({
      title: '复习提醒',
      content: '提醒功能将在后续版本中推出，敬请期待！',
      showCancel: false
    });
  },

  /**
   * 导出数据
   */
  onExportData() {
    wx.showModal({
      title: '导出数据',
      content: '数据导出功能将在后续版本中推出，敬请期待！',
      showCancel: false
    });
  },

  /**
   * 清除缓存
   */
  onClearCache() {
    wx.showModal({
      title: '清除缓存',
      content: '确定要清除复习数据缓存吗？清除后需要重新加载数据。',
      success: (res) => {
        if (res.confirm) {
          DatabaseManager.clearCache();
          wx.showToast({
            title: '缓存已清除',
            icon: 'success'
          });
          setTimeout(() => {
            this.loadAllData();
          }, 1000);
        }
      }
    });
  },

  /**
   * 工具方法：获取学科显示名称
   */
  getSubjectDisplayName(subject) {
    const subjectMap = {
      'math': '数学',
      'chinese': '语文', 
      'english': '英语',
      'physics': '物理',
      'chemistry': '化学',
      'biology': '生物',
      'history': '历史',
      'geography': '地理',
      'politics': '政治'
    };
    return subjectMap[subject] || subject;
  },

  /**
   * 工具方法：格式化复习日期
   */
  formatReviewDate(dateStr) {
    if (!dateStr) return '未知时间';
    
    const date = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const reviewDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    const diffDays = Math.floor((today - reviewDate) / (24 * 60 * 60 * 1000));
    
    if (diffDays === 0) {
      return `今天 ${date.toTimeString().slice(0, 5)}`;
    } else if (diffDays === 1) {
      return `昨天 ${date.toTimeString().slice(0, 5)}`;
    } else if (diffDays < 7) {
      return `${diffDays}天前`;
    } else {
      return `${date.getMonth() + 1}月${date.getDate()}日`;
    }
  },

  /**
   * 工具方法：生成复习标题
   */
  generateReviewTitle(record) {
    const subject = this.getSubjectDisplayName(record.subject || '综合');
    const type = record.reviewType || 'practice';
    
    const typeMap = {
      'quick': '快速复习',
      'subject': '分科复习', 
      'systematic': '系统复习',
      'random': '随机练习',
      'practice': '错题练习'
    };
    
    return `${subject}${typeMap[type] || '复习'}`;
  }
}); 
