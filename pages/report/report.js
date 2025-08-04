// pages/report/report.js
import DatabaseManager from '../../utils/database.js';

Page({
  /**
   * 页面的初始数据
   */
  data: {
    loading: true,
    
    // 报告时间范围
    timeRange: 'week', // week, month, year
    timeRangeOptions: [
      { value: 'week', label: '本周' },
      { value: 'month', label: '本月' },
      { value: 'year', label: '本年' }
    ],
    currentTimeRangeLabel: '本周', // 添加当前时间范围标签
    
    // 综合数据
    overview: {
      totalMistakes: 0,
      masteredCount: 0,
      reviewCount: 0,
      practiceTime: 0,
      masteryRate: 0,
      improvementRate: 0
    },
    
    // 学科分析
    subjectAnalysis: [],
    
    // 难度分析
    difficultyAnalysis: [],
    
    // 时间趋势
    timeTrend: {
      daily: [],
      weekly: [],
      monthly: []
    },
    
    // 学习效率
    efficiency: {
      averageTime: 0,
      accuracyRate: 0,
      completionRate: 0,
      focusLevel: 85
    },
    
    // 学习习惯
    habits: {
      bestTimeSlot: '19:00-21:00',
      averageSessionTime: 25,
      preferredDifficulty: 'medium',
      preferredDifficultyText: '中等', // 添加难度文本
      mostActiveDay: '周日'
    },
    
    // 学习建议
    suggestions: [],
    
    // 成就解锁
    achievements: {
      recent: [],
      progress: []
    },
    
    // 对比数据
    comparison: {
      lastWeek: 0,
      lastMonth: 0,
      improvement: 0
    }
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    console.log('学习报告页面加载');
    this.loadReportData();
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    // 如果是从其他页面返回，刷新数据
    if (!this.data.loading) {
      this.refreshData();
    }
  },

  /**
   * 导航返回
   */
  onNavBack() {
    wx.navigateBack();
  },

  /**
   * 加载报告数据
   */
  async loadReportData() {
    try {
      this.setData({ loading: true });
      
      const userId = DatabaseManager.getCurrentUserId();
      
      // 并行加载各种数据
      await Promise.all([
        this.loadOverviewData(userId),
        this.loadSubjectAnalysis(userId),
        this.loadDifficultyAnalysis(userId),
        this.loadTimeTrend(userId),
        this.loadEfficiencyData(userId),
        this.loadHabitsData(userId),
        this.loadAchievements(userId)
      ]);
      
      // 生成学习建议
      this.generateSuggestions();
      
    } catch (error) {
      console.error('加载报告数据失败:', error);
      wx.showToast({
        title: '加载失败，请重试',
        icon: 'none'
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  /**
   * 加载概览数据
   */
  async loadOverviewData(userId) {
    try {
      const [statsResult, mistakesResult] = await Promise.all([
        DatabaseManager.getTodayStats(userId),
        DatabaseManager.getMistakes(userId, { pageSize: 1000 })
      ]);
      
      if (statsResult.success) {
        const stats = statsResult.data;
        const overview = {
          totalMistakes: stats.totalMistakes || 0,
          masteredCount: stats.masteredCount || 0,
          reviewCount: stats.reviewTasks || 0,
          practiceTime: this.calculatePracticeTime(mistakesResult.data),
          masteryRate: stats.masteryRate || 0,
          improvementRate: this.calculateImprovementRate(mistakesResult.data)
        };
        
        this.setData({ overview });
        console.log('概览数据加载完成:', overview);
      }
      
    } catch (error) {
      console.error('加载概览数据失败:', error);
    }
  },

  /**
   * 加载学科分析
   */
  async loadSubjectAnalysis(userId) {
    try {
      const result = await DatabaseManager.getMistakes(userId, { pageSize: 1000 });
      
      if (result.success) {
        const subjectMap = {};
        const subjects = ['数学', '英语', '语文', '物理', '化学', '生物', '历史', '地理', '政治'];
        
        // 初始化学科数据
        subjects.forEach(subject => {
          subjectMap[subject] = {
            name: subject,
            total: 0,
            mastered: 0,
            accuracy: 0,
            improvement: 0,
            timeSpent: 0,
            color: this.getSubjectColor(subject)
          };
        });
        
        // 统计学科数据
        result.data.forEach(mistake => {
          const subject = mistake.subject || '其他';
          if (subjectMap[subject]) {
            subjectMap[subject].total++;
            if (mistake.reviewLevel >= 3 || mistake.status === 'mastered') {
              subjectMap[subject].mastered++;
            }
          }
        });
        
        // 计算准确率和改进度
        const subjectAnalysis = Object.values(subjectMap)
          .filter(subject => subject.total > 0)
          .map(subject => {
            subject.accuracy = subject.total > 0 ? Math.round((subject.mastered / subject.total) * 100) : 0;
            subject.improvement = Math.floor(Math.random() * 20) + 5; // 模拟改进度
            subject.timeSpent = Math.floor(Math.random() * 60) + 30; // 模拟学习时间
            return subject;
          })
          .sort((a, b) => b.total - a.total);
        
        this.setData({ subjectAnalysis });
        console.log('学科分析完成:', subjectAnalysis);
      }
      
    } catch (error) {
      console.error('加载学科分析失败:', error);
    }
  },

  /**
   * 加载难度分析
   */
  async loadDifficultyAnalysis(userId) {
    try {
      const result = await DatabaseManager.getMistakes(userId, { pageSize: 1000 });
      
      if (result.success) {
        const difficultyMap = {
          1: { level: 1, name: '简单', total: 0, mastered: 0, accuracy: 0, color: '#10B981' },
          2: { level: 2, name: '中等', total: 0, mastered: 0, accuracy: 0, color: '#F59E0B' },
          3: { level: 3, name: '困难', total: 0, mastered: 0, accuracy: 0, color: '#EF4444' },
          4: { level: 4, name: '较难', total: 0, mastered: 0, accuracy: 0, color: '#8B5CF6' },
          5: { level: 5, name: '很难', total: 0, mastered: 0, accuracy: 0, color: '#EC4899' }
        };
        
        result.data.forEach(mistake => {
          const difficulty = mistake.difficulty || 2;
          if (difficultyMap[difficulty]) {
            difficultyMap[difficulty].total++;
            if (mistake.reviewLevel >= 3 || mistake.status === 'mastered') {
              difficultyMap[difficulty].mastered++;
            }
          }
        });
        
        const difficultyAnalysis = Object.values(difficultyMap)
          .filter(item => item.total > 0)
          .map(item => {
            item.accuracy = item.total > 0 ? Math.round((item.mastered / item.total) * 100) : 0;
            return item;
          });
        
        this.setData({ difficultyAnalysis });
        console.log('难度分析完成:', difficultyAnalysis);
      }
      
    } catch (error) {
      console.error('加载难度分析失败:', error);
    }
  },

  /**
   * 加载时间趋势
   */
  async loadTimeTrend(userId) {
    try {
      const result = await DatabaseManager.getMistakes(userId, { pageSize: 1000 });
      
      if (result.success) {
        const now = new Date();
        const timeTrend = {
          daily: this.generateDailyTrend(result.data, now),
          weekly: this.generateWeeklyTrend(result.data, now),
          monthly: this.generateMonthlyTrend(result.data, now)
        };
        
        this.setData({ timeTrend });
        console.log('时间趋势分析完成:', timeTrend);
      }
      
    } catch (error) {
      console.error('加载时间趋势失败:', error);
    }
  },

  /**
   * 加载效率数据
   */
  async loadEfficiencyData(userId) {
    try {
      const [mistakesResult, reviewResult] = await Promise.all([
        DatabaseManager.getMistakes(userId, { pageSize: 1000 }),
        DatabaseManager.getReviewRecords(userId, { pageSize: 500 })
      ]);
      
      const efficiency = {
        averageTime: 0,
        accuracyRate: 0,
        completionRate: 0,
        focusLevel: 85
      };
      
      if (mistakesResult.success) {
        const mistakes = mistakesResult.data;
        const mastered = mistakes.filter(m => m.reviewLevel >= 3 || m.status === 'mastered').length;
        efficiency.accuracyRate = mistakes.length > 0 ? Math.round((mastered / mistakes.length) * 100) : 0;
      }
      
      if (reviewResult.success) {
        const reviews = reviewResult.data;
        efficiency.averageTime = reviews.length > 0 ? Math.round(reviews.reduce((sum, r) => sum + (r.timeSpent || 30), 0) / reviews.length) : 30;
        efficiency.completionRate = Math.min(95, Math.round(reviews.length / 10) + 60);
      }
      
      this.setData({ efficiency });
      console.log('效率数据加载完成:', efficiency);
      
    } catch (error) {
      console.error('加载效率数据失败:', error);
    }
  },

  /**
   * 加载学习习惯
   */
  async loadHabitsData(userId) {
    try {
      const result = await DatabaseManager.getMistakes(userId, { pageSize: 1000 });
      
      if (result.success) {
        const mistakes = result.data;
        const habits = this.analyzeHabits(mistakes);
        
        // 添加难度文本转换
        const difficultyTextMap = {
          'easy': '简单',
          'medium': '中等',
          'hard': '困难'
        };
        
        habits.preferredDifficultyText = difficultyTextMap[habits.preferredDifficulty] || '中等';
        
        this.setData({ habits });
        console.log('学习习惯分析完成:', habits);
      }
      
    } catch (error) {
      console.error('加载学习习惯失败:', error);
    }
  },

  /**
   * 加载成就数据
   */
  async loadAchievements(userId) {
    try {
      // 基于现有数据模拟成就系统
      const { overview, subjectAnalysis } = this.data;
      
      const achievements = {
        recent: [],
        progress: []
      };
      
      // 最近解锁的成就
      if (overview.totalMistakes >= 10) {
        achievements.recent.push({
          id: 'beginner',
          name: '初学者',
          desc: '记录了第一批错题',
          icon: '🎯',
          unlockedAt: '2025-01-20'
        });
      }
      
      if (overview.masteryRate >= 50) {
        achievements.recent.push({
          id: 'half_master',
          name: '半数掌握',
          desc: '掌握率达到50%',
          icon: '📈',
          unlockedAt: '2025-01-22'
        });
      }
      
      // 进度中的成就
      achievements.progress.push({
        id: 'master_100',
        name: '百题掌握',
        desc: '掌握100道错题',
        icon: '🏆',
        current: overview.masteredCount,
        target: 100,
        progress: Math.min(100, Math.round((overview.masteredCount / 100) * 100))
      });
      
      this.setData({ achievements });
      console.log('成就数据加载完成:', achievements);
      
    } catch (error) {
      console.error('加载成就数据失败:', error);
    }
  },

  /**
   * 生成学习建议
   */
  generateSuggestions() {
    const suggestions = [];
    const { overview, subjectAnalysis, difficultyAnalysis, efficiency } = this.data;
    
    // 基于掌握率的建议
    if (overview.masteryRate < 30) {
      suggestions.push({
        type: 'warning',
        title: '加强基础练习',
        desc: '当前掌握率较低，建议多做基础题目巩固知识点',
        action: '开始练习',
        actionUrl: '/pages/practice/practice'
      });
    } else if (overview.masteryRate >= 80) {
      suggestions.push({
        type: 'success',
        title: '尝试挑战题',
        desc: '基础掌握良好，可以尝试更有挑战性的题目',
        action: 'AI练习',
        actionUrl: '/pages/practice/practice'
      });
    }
    
    // 基于学科分析的建议
    const weakSubject = subjectAnalysis.find(s => s.accuracy < 50);
    if (weakSubject) {
      suggestions.push({
        type: 'info',
        title: `重点关注${weakSubject.name}`,
        desc: `${weakSubject.name}的掌握率偏低，建议加强针对性练习`,
        action: '专项练习',
        actionUrl: `/pages/practice/practice?subject=${weakSubject.name}`
      });
    }
    
    // 基于效率的建议
    if (efficiency.averageTime > 60) {
      suggestions.push({
        type: 'tip',
        title: '提高答题速度',
        desc: '平均答题时间较长，可以通过限时练习提高速度',
        action: '限时练习',
        actionUrl: '/pages/practice/practice?mode=timed'
      });
    }
    
    this.setData({ suggestions });
    console.log('学习建议生成完成:', suggestions);
  },

  /**
   * 辅助方法
   */
  calculatePracticeTime(mistakes) {
    // 估算练习时间（分钟）
    return mistakes ? mistakes.length * 2.5 : 0;
  },

  calculateImprovementRate(mistakes) {
    // 计算改进率
    if (!mistakes || mistakes.length === 0) return 0;
    
    const recentMistakes = mistakes.filter(m => {
      const createTime = new Date(m.createTime || m.createdAt);
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      return createTime >= weekAgo;
    });
    
    const mastered = recentMistakes.filter(m => m.reviewLevel >= 3 || m.status === 'mastered').length;
    return recentMistakes.length > 0 ? Math.round((mastered / recentMistakes.length) * 100) : 0;
  },

  getSubjectColor(subject) {
    const colorMap = {
      '数学': '#4285F4',
      '英语': '#34A853',
      '语文': '#EA4335',
      '物理': '#FBBC05',
      '化学': '#9C27B0',
      '生物': '#FF5722',
      '历史': '#795548',
      '地理': '#607D8B',
      '政治': '#E91E63'
    };
    return colorMap[subject] || '#9E9E9E';
  },

  generateDailyTrend(mistakes, now) {
    const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const dailyData = new Array(7).fill(0);
    
    mistakes.forEach(mistake => {
      const createTime = new Date(mistake.createTime || mistake.createdAt);
      const dayOfWeek = createTime.getDay();
      dailyData[dayOfWeek]++;
    });
    
    return dailyData.map((count, index) => ({
      day: days[index],
      count,
      date: new Date(now.getTime() - (6 - index) * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    }));
  },

  generateWeeklyTrend(mistakes, now) {
    // 生成最近4周的数据
    const weeks = [];
    for (let i = 3; i >= 0; i--) {
      const weekStart = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
      const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
      
      const weekMistakes = mistakes.filter(m => {
        const createTime = new Date(m.createTime || m.createdAt);
        return createTime >= weekStart && createTime < weekEnd;
      });
      
      weeks.push({
        week: `第${4-i}周`,
        count: weekMistakes.length,
        start: weekStart.toISOString().split('T')[0]
      });
    }
    
    return weeks;
  },

  generateMonthlyTrend(mistakes, now) {
    // 生成最近6个月的数据
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const nextMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      
      const monthMistakes = mistakes.filter(m => {
        const createTime = new Date(m.createTime || m.createdAt);
        return createTime >= monthDate && createTime < nextMonth;
      });
      
      months.push({
        month: `${monthDate.getMonth() + 1}月`,
        count: monthMistakes.length,
        date: monthDate.toISOString().split('T')[0]
      });
    }
    
    return months;
  },

  analyzeHabits(mistakes) {
    // 分析学习习惯
    const timeSlots = {};
    const days = {};
    let totalTime = 0;
    
    mistakes.forEach(mistake => {
      const createTime = new Date(mistake.createTime || mistake.createdAt);
      const hour = createTime.getHours();
      const day = createTime.getDay();
      
      // 统计时间段
      const slot = this.getTimeSlot(hour);
      timeSlots[slot] = (timeSlots[slot] || 0) + 1;
      
      // 统计星期
      const dayName = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][day];
      days[dayName] = (days[dayName] || 0) + 1;
      
      totalTime += 2.5; // 假设每题平均2.5分钟
    });
    
    const bestTimeSlot = Object.keys(timeSlots).reduce((a, b) => timeSlots[a] > timeSlots[b] ? a : b, '19:00-21:00');
    const mostActiveDay = Object.keys(days).reduce((a, b) => days[a] > days[b] ? a : b, '周日');
    
    return {
      bestTimeSlot,
      averageSessionTime: Math.round(totalTime / Math.max(mistakes.length / 10, 1)),
      preferredDifficulty: 'medium', // 可以基于实际数据计算
      mostActiveDay
    };
  },

  getTimeSlot(hour) {
    if (hour >= 6 && hour < 9) return '06:00-09:00';
    if (hour >= 9 && hour < 12) return '09:00-12:00';
    if (hour >= 12 && hour < 14) return '12:00-14:00';
    if (hour >= 14 && hour < 17) return '14:00-17:00';
    if (hour >= 17 && hour < 19) return '17:00-19:00';
    if (hour >= 19 && hour < 21) return '19:00-21:00';
    if (hour >= 21 && hour < 23) return '21:00-23:00';
    return '23:00-06:00';
  },

  /**
   * 事件处理
   */
  onTimeRangeChange(e) {
    const { value } = e.detail;
    const selectedRange = this.data.timeRangeOptions[value];
    
    this.setData({
      timeRange: selectedRange.value,
      currentTimeRangeLabel: selectedRange.label
    });
    
    // 重新加载数据
    this.refreshData();
  },

  async refreshData() {
    wx.showLoading({ title: '刷新中...' });
    try {
      await this.loadReportData();
    } finally {
      wx.hideLoading();
    }
  },

  navigateToSuggestion(e) {
    const { url } = e.currentTarget.dataset;
    if (url) {
      wx.navigateTo({
        url,
        fail: () => {
          wx.switchTab({ url });
        }
      });
    }
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh() {
    this.refreshData().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  /**
   * 分享
   */
  onShareAppMessage() {
    const { overview } = this.data;
    return {
      title: `我的学习报告：掌握率${overview.masteryRate}%，已掌握${overview.masteredCount}道题目！`,
      path: '/pages/home/home'
    };
  }
}) 