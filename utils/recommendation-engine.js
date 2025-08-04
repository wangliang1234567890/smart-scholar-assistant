/**
 * 智能推荐引擎
 * 基于错题分析结果，提供个性化学习建议和练习推荐
 */
import DatabaseManager from './database.js';

class RecommendationEngine {
  constructor() {
    this.weightConfig = {
      // 推荐权重配置
      weakSubject: 0.4,      // 薄弱学科权重
      reviewUrgency: 0.3,    // 复习紧急度权重
      learningProgress: 0.2, // 学习进度权重
      difficulty: 0.1        // 难度适配权重
    };
    
    this.thresholds = {
      // 阈值配置
      weakMasteryRate: 60,   // 薄弱学科掌握率阈值（低于此值认为薄弱）
      urgentReviewDays: 3,   // 紧急复习天数阈值
      newMistakeLimit: 5     // 新错题数量限制
    };
  }

  /**
   * 生成智能推荐
   * @param {string} userId 用户ID
   * @param {Object} options 推荐选项
   * @returns {Object} 推荐结果
   */
  async generateRecommendations(userId, options = {}) {
    try {
      console.log('开始生成智能推荐...');
      
      // 1. 获取用户数据
      const userData = await this.getUserAnalysisData(userId);
      
      if (!userData || userData.totalMistakes === 0) {
        return this.getDefaultRecommendations();
      }
      
      // 2. 分析用户学习状况
      const analysis = this.analyzeUserStatus(userData);
      
      // 3. 生成推荐策略
      const strategies = this.generateStrategies(analysis);
      
      // 4. 生成具体推荐
      const recommendations = this.buildRecommendations(strategies, userData);
      
      console.log('智能推荐生成完成:', recommendations);
      return recommendations;
      
    } catch (error) {
      console.error('生成智能推荐失败:', error);
      return this.getDefaultRecommendations();
    }
  }

  /**
   * 获取用户分析数据
   */
  async getUserAnalysisData(userId) {
    const [mistakesResult, reviewResult, practiceResult] = await Promise.all([
      DatabaseManager.getMistakes(userId, { pageSize: 100 }),
      DatabaseManager.getReviewRecords(userId, { pageSize: 50 }),
      DatabaseManager.getPracticeRecords(userId, { pageSize: 20 })
    ]);

    if (!mistakesResult.success) {
      return null;
    }

    const mistakes = mistakesResult.data || [];
    const reviews = reviewResult.success ? reviewResult.data || [] : [];
    const practices = practiceResult.success ? practiceResult.data || [] : [];

    return {
      mistakes,
      reviews,
      practices,
      totalMistakes: mistakes.length,
      ...this.calculateBasicStats(mistakes),
      ...this.calculateSubjectStats(mistakes),
      ...this.calculateReviewStats(mistakes, reviews),
      ...this.calculatePracticeStats(practices)
    };
  }

  /**
   * 计算基础统计
   */
  calculateBasicStats(mistakes) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const newMistakes = mistakes.filter(m => {
      const createDate = new Date(m.createTime);
      return createDate >= today;
    }).length;
    
    const masteredCount = mistakes.filter(m => m.reviewLevel >= 5).length;
    const reviewingCount = mistakes.filter(m => m.reviewLevel > 0 && m.reviewLevel < 5).length;
    
    return {
      newMistakes,
      masteredCount,
      reviewingCount,
      masteryRate: mistakes.length > 0 ? Math.round((masteredCount / mistakes.length) * 100) : 0
    };
  }

  /**
   * 计算学科统计
   */
  calculateSubjectStats(mistakes) {
    const subjectMap = {};
    
    mistakes.forEach(mistake => {
      const subject = mistake.subject || '其他';
      
      if (!subjectMap[subject]) {
        subjectMap[subject] = {
          total: 0,
          mastered: 0,
          needReview: 0,
          weakPoints: []
        };
      }
      
      subjectMap[subject].total++;
      
      if (mistake.reviewLevel >= 5) {
        subjectMap[subject].mastered++;
      } else {
        subjectMap[subject].needReview++;
      }
    });
    
    // 计算掌握率并标记薄弱学科
    const subjects = Object.keys(subjectMap).map(subject => {
      const stats = subjectMap[subject];
      const masteryRate = stats.total > 0 ? Math.round((stats.mastered / stats.total) * 100) : 0;
      
      return {
        subject,
        ...stats,
        masteryRate,
        isWeak: masteryRate < this.thresholds.weakMasteryRate
      };
    });
    
    // 按薄弱程度排序
    subjects.sort((a, b) => a.masteryRate - b.masteryRate);
    
    return {
      subjects,
      weakestSubject: subjects[0] || null,
      weakSubjects: subjects.filter(s => s.isWeak)
    };
  }

  /**
   * 计算复习统计
   */
  calculateReviewStats(mistakes, reviews) {
    const now = new Date();
    
    // 需要复习的错题（基于复习时间）
    const urgentReviews = mistakes.filter(mistake => {
      if (!mistake.nextReviewTime) return false;
      
      const reviewTime = new Date(mistake.nextReviewTime);
      const daysDiff = (now - reviewTime) / (1000 * 60 * 60 * 24);
      
      return daysDiff >= 0; // 已到复习时间
    });
    
    // 紧急复习（超期）
    const overdueReviews = mistakes.filter(mistake => {
      if (!mistake.nextReviewTime) return false;
      
      const reviewTime = new Date(mistake.nextReviewTime);
      const daysDiff = (now - reviewTime) / (1000 * 60 * 60 * 24);
      
      return daysDiff > this.thresholds.urgentReviewDays;
    });
    
    return {
      urgentReviews: urgentReviews.length,
      overdueReviews: overdueReviews.length,
      recentReviews: reviews.filter(r => {
        const reviewDate = new Date(r.reviewTime);
        const daysDiff = (now - reviewDate) / (1000 * 60 * 60 * 24);
        return daysDiff <= 7; // 最近7天的复习
      }).length
    };
  }

  /**
   * 计算练习统计
   */
  calculatePracticeStats(practices) {
    const recentPractices = practices.filter(p => {
      const practiceDate = new Date(p.createTime);
      const daysDiff = (Date.now() - practiceDate) / (1000 * 60 * 60 * 24);
      return daysDiff <= 7; // 最近7天
    });
    
    const avgAccuracy = recentPractices.length > 0 
      ? Math.round(recentPractices.reduce((sum, p) => sum + (p.accuracy || 0), 0) / recentPractices.length)
      : 0;
    
    return {
      recentPractices: recentPractices.length,
      avgAccuracy,
      needsPractice: avgAccuracy < 70 // 准确率低于70%需要加强练习
    };
  }

  /**
   * 分析用户学习状况
   */
  analyzeUserStatus(userData) {
    const {
      totalMistakes,
      newMistakes,
      masteryRate,
      weakSubjects,
      urgentReviews,
      overdueReviews,
      avgAccuracy,
      needsPractice
    } = userData;
    
    return {
      // 学习阶段
      learningStage: this.determineLearningStage(totalMistakes, masteryRate),
      
      // 主要问题
      primaryIssues: this.identifyPrimaryIssues(userData),
      
      // 推荐优先级
      priorities: this.calculatePriorities(userData)
    };
  }

  /**
   * 确定学习阶段
   */
  determineLearningStage(totalMistakes, masteryRate) {
    if (totalMistakes < 10) return 'beginner';
    if (masteryRate < 30) return 'foundation';
    if (masteryRate < 70) return 'improvement';
    return 'advanced';
  }

  /**
   * 识别主要问题
   */
  identifyPrimaryIssues(userData) {
    const issues = [];
    
    if (userData.overdueReviews > 5) {
      issues.push('review_overdue');
    }
    
    if (userData.weakSubjects.length > 2) {
      issues.push('multiple_weak_subjects');
    }
    
    if (userData.avgAccuracy < 60) {
      issues.push('low_accuracy');
    }
    
    if (userData.newMistakes > this.thresholds.newMistakeLimit) {
      issues.push('too_many_new_mistakes');
    }
    
    return issues;
  }

  /**
   * 计算推荐优先级
   */
  calculatePriorities(userData) {
    const priorities = [];
    
    // 复习优先级
    if (userData.overdueReviews > 0) {
      priorities.push({
        type: 'review',
        urgency: Math.min(userData.overdueReviews / 10, 1),
        description: '有错题需要及时复习'
      });
    }
    
    // 薄弱学科优先级
    if (userData.weakSubjects.length > 0) {
      priorities.push({
        type: 'weak_subject',
        urgency: userData.weakSubjects.length / 5,
        subject: userData.weakestSubject?.subject,
        description: `${userData.weakestSubject?.subject}掌握率较低`
      });
    }
    
    // 练习优先级
    if (userData.needsPractice) {
      priorities.push({
        type: 'practice',
        urgency: (100 - userData.avgAccuracy) / 100,
        description: '需要加强练习提高准确率'
      });
    }
    
    return priorities.sort((a, b) => b.urgency - a.urgency);
  }

  /**
   * 生成推荐策略
   */
  generateStrategies(analysis) {
    const strategies = [];
    
    analysis.priorities.forEach(priority => {
      switch (priority.type) {
        case 'review':
          strategies.push(this.createReviewStrategy(priority));
          break;
        case 'weak_subject':
          strategies.push(this.createWeakSubjectStrategy(priority));
          break;
        case 'practice':
          strategies.push(this.createPracticeStrategy(priority));
          break;
      }
    });
    
    return strategies;
  }

  /**
   * 创建复习策略
   */
  createReviewStrategy(priority) {
    return {
      type: 'review',
      title: '复习提醒',
      description: '有错题到了复习时间，及时复习有助于巩固记忆',
      action: 'start_review',
      urgency: priority.urgency,
      icon: 'review-action',
      color: '#FF6B35'
    };
  }

  /**
   * 创建薄弱学科策略
   */
  createWeakSubjectStrategy(priority) {
    return {
      type: 'weak_subject',
      title: `加强${priority.subject}练习`,
      description: `${priority.subject}掌握率较低，建议重点练习`,
      action: 'practice_subject',
      subject: priority.subject,
      urgency: priority.urgency,
      icon: 'ai-practice',
      color: '#4F46E5'
    };
  }

  /**
   * 创建练习策略
   */
  createPracticeStrategy(priority) {
    return {
      type: 'practice',
      title: 'AI智能练习',
      description: '通过练习提高准确率，巩固知识点',
      action: 'ai_practice',
      urgency: priority.urgency,
      icon: 'ai-practice',
      color: '#10B981'
    };
  }

  /**
   * 构建推荐结果
   */
  buildRecommendations(strategies, userData) {
    // 限制推荐数量
    const topStrategies = strategies.slice(0, 3);
    
    return {
      recommendations: topStrategies,
      summary: {
        totalMistakes: userData.totalMistakes,
        masteryRate: userData.masteryRate,
        weakSubjects: userData.weakSubjects.length,
        urgentReviews: userData.urgentReviews
      },
      tips: this.generateTips(userData),
      timestamp: Date.now()
    };
  }

  /**
   * 生成学习提示
   */
  generateTips(userData) {
    const tips = [];
    
    if (userData.masteryRate < 50) {
      tips.push('建议每天坚持复习，循序渐进提高掌握率');
    }
    
    if (userData.weakSubjects.length > 0) {
      tips.push(`重点关注${userData.weakSubjects[0]?.subject}，制定专项练习计划`);
    }
    
    if (userData.avgAccuracy < 70) {
      tips.push('做题时注意仔细审题，避免因马虎导致的错误');
    }
    
    return tips;
  }

  /**
   * 获取默认推荐（新用户或无数据）
   */
  getDefaultRecommendations() {
    return {
      recommendations: [
        {
          type: 'get_started',
          title: '开始录入错题',
          description: '拍照或手动录入错题，建立你的专属错题本',
          action: 'add_mistake',
          urgency: 1,
          icon: 'camera-action',
          color: '#4F46E5'
        },
        {
          type: 'explore',
          title: '探索AI功能',
          description: '体验AI智能练习，让学习更高效',
          action: 'ai_practice',
          urgency: 0.5,
          icon: 'ai-practice',
          color: '#10B981'
        }
      ],
      summary: {
        totalMistakes: 0,
        masteryRate: 0,
        weakSubjects: 0,
        urgentReviews: 0
      },
      tips: [
        '开始录入错题，智能分析将帮助你更好地学习',
        '坚持使用错题本，养成良好的学习习惯'
      ],
      timestamp: Date.now()
    };
  }
}

export default new RecommendationEngine(); 