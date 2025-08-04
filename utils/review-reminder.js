/**
 * 智能复习提醒管理器
 * 基于艾宾浩斯遗忘曲线的智能复习提醒系统
 */
import DatabaseManager from './database.js';
import { REVIEW_INTERVALS } from './constants.js';

class ReviewReminderManager {
  constructor() {
    // 复习间隔配置（天）- 基于艾宾浩斯遗忘曲线优化
    this.baseIntervals = REVIEW_INTERVALS;
    
    // 复习提醒配置
    this.reminderConfig = {
      // 提醒时间范围
      earlyReminderHours: 2,    // 提前2小时提醒
      lateReminderDays: 3,      // 逾期3天内仍提醒
      maxOverdueDays: 7,        // 最大逾期天数
      
      // 复习效果权重
      weights: {
        difficulty: 0.3,        // 题目难度权重
        errorFrequency: 0.4,    // 错误频率权重
        lastAccuracy: 0.3       // 上次复习准确率权重
      }
    };
    
    // 复习状态定义
    this.reviewStates = {
      PENDING: 'pending',       // 待复习
      DUE: 'due',              // 到期复习
      OVERDUE: 'overdue',      // 逾期复习
      URGENT: 'urgent'         // 紧急复习（超过最大逾期天数）
    };
  }

  /**
   * 获取用户的复习提醒
   * @param {string} userId 用户ID
   * @returns {Object} 复习提醒数据
   */
  async getReviewReminders(userId) {
    try {
      console.log('获取复习提醒数据...');
      
      // 获取所有错题
      const mistakesResult = await DatabaseManager.getMistakes(userId, { 
        pageSize: 500,
        filters: { status: 'all' }
      });
      
      if (!mistakesResult.success) {
        throw new Error('获取错题数据失败');
      }
      
      const mistakes = mistakesResult.data || [];
      
      // 分析复习状态
      const reviewData = this.analyzeReviewStatus(mistakes);
      
      // 生成复习提醒
      const reminders = this.generateReminders(reviewData);
      
      console.log('复习提醒生成完成:', reminders);
      return {
        success: true,
        data: reminders
      };
      
    } catch (error) {
      console.error('获取复习提醒失败:', error);
      return {
        success: false,
        error: error.message,
        data: this.getEmptyReminders()
      };
    }
  }

  /**
   * 分析复习状态
   */
  analyzeReviewStatus(mistakes) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const reviewStats = {
      total: 0,
      pending: [],
      due: [],
      overdue: [],
      urgent: [],
      completed: 0
    };
    
    mistakes.forEach(mistake => {
      // 跳过已归档的错题
      if (mistake.isArchived) return;
      
      // 统计已掌握的错题
      if (mistake.reviewLevel >= 5) {
        reviewStats.completed++;
        return;
      }
      
      reviewStats.total++;
      
      // 如果没有复习时间，跳过
      if (!mistake.nextReviewTime) {
        return;
      }
      
      const reviewTime = new Date(mistake.nextReviewTime);
      const daysDiff = (reviewTime - today) / (1000 * 60 * 60 * 24);
      
      // 根据时间差分类
      if (daysDiff > 1) {
        // 未来复习
        reviewStats.pending.push({
          ...mistake,
          daysDiff: Math.ceil(daysDiff),
          state: this.reviewStates.PENDING
        });
      } else if (daysDiff >= -1) {
        // 今明两天复习
        reviewStats.due.push({
          ...mistake,
          daysDiff: Math.ceil(daysDiff),
          state: this.reviewStates.DUE
        });
      } else if (daysDiff >= -this.reminderConfig.maxOverdueDays) {
        // 逾期但未超过最大逾期天数
        reviewStats.overdue.push({
          ...mistake,
          daysDiff: Math.ceil(Math.abs(daysDiff)),
          state: this.reviewStates.OVERDUE
        });
      } else {
        // 紧急复习（超过最大逾期天数）
        reviewStats.urgent.push({
          ...mistake,
          daysDiff: Math.ceil(Math.abs(daysDiff)),
          state: this.reviewStates.URGENT
        });
      }
    });
    
    // 按紧急程度排序
    reviewStats.due.sort((a, b) => a.daysDiff - b.daysDiff);
    reviewStats.overdue.sort((a, b) => b.daysDiff - a.daysDiff);
    reviewStats.urgent.sort((a, b) => b.daysDiff - a.daysDiff);
    
    return reviewStats;
  }

  /**
   * 生成复习提醒
   */
  generateReminders(reviewData) {
    const reminders = {
      summary: {
        total: reviewData.total,
        due: reviewData.due.length,
        overdue: reviewData.overdue.length,
        urgent: reviewData.urgent.length,
        completed: reviewData.completed,
        completionRate: reviewData.total > 0 
          ? Math.round((reviewData.completed / (reviewData.total + reviewData.completed)) * 100)
          : 0
      },
      
      // 主要提醒
      primaryReminder: this.getPrimaryReminder(reviewData),
      
      // 今日复习计划
      todayPlan: this.generateTodayPlan(reviewData),
      
      // 本周复习计划
      weeklyPlan: this.generateWeeklyPlan(reviewData),
      
      // 复习建议
      suggestions: this.generateReviewSuggestions(reviewData),
      
      timestamp: Date.now()
    };
    
    return reminders;
  }

  /**
   * 获取主要提醒
   */
  getPrimaryReminder(reviewData) {
    const { due, overdue, urgent } = reviewData;
    
    if (urgent.length > 0) {
      return {
        type: 'urgent',
        title: '紧急复习提醒',
        message: `有${urgent.length}道错题已逾期${urgent[0].daysDiff}天，需要立即复习`,
        count: urgent.length,
        icon: 'warning',
        color: '#F56565',
        action: 'review_urgent'
      };
    }
    
    if (overdue.length > 0) {
      return {
        type: 'overdue',
        title: '逾期复习提醒',
        message: `有${overdue.length}道错题已逾期，建议尽快复习`,
        count: overdue.length,
        icon: 'clock',
        color: '#ED8936',
        action: 'review_overdue'
      };
    }
    
    if (due.length > 0) {
      return {
        type: 'due',
        title: '今日复习计划',
        message: `今天需要复习${due.length}道错题`,
        count: due.length,
        icon: 'calendar',
        color: '#4299E1',
        action: 'review_today'
      };
    }
    
    return {
      type: 'none',
      title: '暂无复习任务',
      message: '当前没有需要复习的错题，继续保持！',
      count: 0,
      icon: 'check',
      color: '#48BB78',
      action: null
    };
  }

  /**
   * 生成今日复习计划
   */
  generateTodayPlan(reviewData) {
    const { due, overdue, urgent } = reviewData;
    const todayTasks = [...urgent, ...overdue, ...due];
    
    // 按优先级排序：urgent > overdue > due
    todayTasks.sort((a, b) => {
      const priority = { urgent: 3, overdue: 2, due: 1 };
      return priority[b.state] - priority[a.state];
    });
    
    return {
      total: todayTasks.length,
      tasks: todayTasks.slice(0, 10), // 最多显示10个
      subjects: this.groupBySubject(todayTasks),
      estimatedTime: this.calculateEstimatedTime(todayTasks.length)
    };
  }

  /**
   * 生成本周复习计划
   */
  generateWeeklyPlan(reviewData) {
    const { pending, due, overdue, urgent } = reviewData;
    const allTasks = [...urgent, ...overdue, ...due, ...pending];
    
    // 按日期分组
    const weeklyTasks = {};
    const today = new Date();
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const dateKey = this.formatDate(date);
      weeklyTasks[dateKey] = {
        date: dateKey,
        dayName: this.getDayName(date),
        tasks: [],
        count: 0
      };
    }
    
    allTasks.forEach(task => {
      if (task.state === this.reviewStates.PENDING) {
        const taskDate = new Date(task.nextReviewTime);
        const dateKey = this.formatDate(taskDate);
        
        if (weeklyTasks[dateKey]) {
          weeklyTasks[dateKey].tasks.push(task);
          weeklyTasks[dateKey].count++;
        }
      } else {
        // 逾期和今日任务都归入今天
        const todayKey = this.formatDate(today);
        weeklyTasks[todayKey].tasks.push(task);
        weeklyTasks[todayKey].count++;
      }
    });
    
    return Object.values(weeklyTasks);
  }

  /**
   * 生成复习建议
   */
  generateReviewSuggestions(reviewData) {
    const suggestions = [];
    const { total, completed, due, overdue, urgent } = reviewData;
    
    // 计算完成率
    const completionRate = total > 0 
      ? Math.round((completed / (total + completed)) * 100)
      : 0;
    
    // 基于复习状况给出建议
    if (urgent.length > 0) {
      suggestions.push({
        type: 'urgent_action',
        title: '立即复习逾期错题',
        description: '长时间未复习的错题容易被遗忘，建议立即复习',
        priority: 'high'
      });
    }
    
    if (overdue.length > 5) {
      suggestions.push({
        type: 'review_frequency',
        title: '增加复习频率',
        description: '逾期错题较多，建议每天安排固定时间复习',
        priority: 'medium'
      });
    }
    
    if (completionRate < 30) {
      suggestions.push({
        type: 'foundation',
        title: '注重基础巩固',
        description: '掌握率较低，建议先巩固基础知识点',
        priority: 'medium'
      });
    }
    
    if (due.length > 0) {
      suggestions.push({
        type: 'daily_plan',
        title: '制定每日复习计划',
        description: `今天需要复习${due.length}道错题，建议分时段进行`,
        priority: 'low'
      });
    }
    
    return suggestions;
  }

  /**
   * 按学科分组
   */
  groupBySubject(tasks) {
    const subjectMap = {};
    
    tasks.forEach(task => {
      const subject = task.subject || '其他';
      if (!subjectMap[subject]) {
        subjectMap[subject] = { subject, count: 0, tasks: [] };
      }
      subjectMap[subject].count++;
      subjectMap[subject].tasks.push(task);
    });
    
    return Object.values(subjectMap).sort((a, b) => b.count - a.count);
  }

  /**
   * 计算预估时间
   */
  calculateEstimatedTime(taskCount) {
    // 平均每道题复习时间：3分钟
    const avgTimePerTask = 3;
    const totalMinutes = taskCount * avgTimePerTask;
    
    if (totalMinutes < 60) {
      return `约${totalMinutes}分钟`;
    } else {
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      return minutes > 0 ? `约${hours}小时${minutes}分钟` : `约${hours}小时`;
    }
  }

  /**
   * 优化复习间隔（考虑错误频率、难度等因素）
   */
  calculateOptimizedInterval(mistake, reviewResult = null) {
    const baseLevel = mistake.reviewLevel || 0;
    let baseInterval = this.baseIntervals[Math.min(baseLevel, this.baseIntervals.length - 1)];
    
    // 调整因子
    let adjustmentFactor = 1.0;
    
    // 1. 根据题目难度调整
    if (mistake.difficulty) {
      const difficultyMap = { easy: 0.8, medium: 1.0, hard: 1.3, very_hard: 1.5 };
      adjustmentFactor *= difficultyMap[mistake.difficulty] || 1.0;
    }
    
    // 2. 根据错误频率调整
    if (mistake.errorCount > 3) {
      adjustmentFactor *= 0.7; // 错误频率高，缩短间隔
    }
    
    // 3. 根据上次复习结果调整
    if (reviewResult) {
      if (reviewResult.isCorrect) {
        adjustmentFactor *= 1.2; // 答对了，延长间隔
      } else {
        adjustmentFactor *= 0.6; // 答错了，缩短间隔
      }
    }
    
    // 计算最终间隔
    const finalInterval = Math.max(1, Math.round(baseInterval * adjustmentFactor));
    
    return {
      originalInterval: baseInterval,
      adjustmentFactor,
      finalInterval,
      nextReviewTime: new Date(Date.now() + finalInterval * 24 * 60 * 60 * 1000).toISOString()
    };
  }

  /**
   * 标记复习完成
   */
  async markReviewCompleted(mistakeId, reviewResult) {
    try {
      // 计算优化后的复习间隔
      const mistakeResult = await DatabaseManager.getMistakeById(mistakeId);
      if (!mistakeResult.success) {
        throw new Error('获取错题信息失败');
      }
      
      const mistake = mistakeResult.data;
      const intervalInfo = this.calculateOptimizedInterval(mistake, reviewResult);
      
      // 更新错题复习信息
      const updateData = {
        lastReviewTime: new Date().toISOString(),
        nextReviewTime: intervalInfo.nextReviewTime,
        reviewLevel: Math.min((mistake.reviewLevel || 0) + 1, 10),
        lastReviewResult: reviewResult.isCorrect,
        updateTime: new Date().toISOString()
      };
      
      // 如果连续答对足够次数，标记为已掌握
      if (reviewResult.isCorrect && updateData.reviewLevel >= 5) {
        updateData.status = 'mastered';
      }
      
      const result = await DatabaseManager.updateMistake(mistakeId, updateData);
      
      return {
        success: result.success,
        intervalInfo,
        newLevel: updateData.reviewLevel
      };
      
    } catch (error) {
      console.error('标记复习完成失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 工具方法
   */
  formatDate(date) {
    return date.toISOString().split('T')[0];
  }

  getDayName(date) {
    const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return days[date.getDay()];
  }

  getEmptyReminders() {
    return {
      summary: { total: 0, due: 0, overdue: 0, urgent: 0, completed: 0, completionRate: 0 },
      primaryReminder: { type: 'none', title: '暂无数据', message: '', count: 0, icon: 'info', color: '#888', action: null },
      todayPlan: { total: 0, tasks: [], subjects: [], estimatedTime: '0分钟' },
      weeklyPlan: [],
      suggestions: [],
      timestamp: Date.now()
    };
  }
}

export default new ReviewReminderManager(); 