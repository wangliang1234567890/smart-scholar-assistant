// 智能学霸小助手 - 数据库操作工具类
import errorHandler from './error-handler';
import { withRetry, generateUUID, safeJsonParse } from './common';
import { REVIEW_INTERVALS, MISTAKE_STATUS } from './constants';

class DatabaseManager {
  constructor() {
    this.db = wx.cloud.database();
    this.collections = {
      USERS: 'users',
      MISTAKES: 'mistakes',
      PRACTICE_RECORDS: 'practice_records',
      COURSES: 'courses',
      REVIEW_RECORDS: 'review_records'
    };
    
    // 添加重试机制的数据库操作
    this.retryOptions = {
      maxRetries: 2,
      delay: 1000
    };
  }

  /**
   * 验证必需参数
   * @param {Object} params - 参数对象
   * @param {Array} required - 必需参数名称数组
   * @throws {Error} 参数验证失败时抛出错误
   */
  validateRequired(params, required) {
    const missing = required.filter(key => 
      params[key] === undefined || params[key] === null || params[key] === ''
    );
    
    if (missing.length > 0) {
      throw new Error(`缺少必需参数: ${missing.join(', ')}`);
    }
  }

  /**
   * 创建用户
   * @param {Object} userInfo - 用户信息
   * @returns {Promise<Object>} 创建结果
   */
  async createUser(userInfo) {
    try {
      this.validateRequired(userInfo, ['openid']);
      
      const userData = {
        _id: generateUUID(),
        openid: userInfo.openid,
        nickName: userInfo.nickName || '',
        avatarUrl: userInfo.avatarUrl || '',
        grade: userInfo.grade || 1,
        subjects: userInfo.subjects || ['数学', '语文', '英语'],
        level: 1,
        exp: 0,
        totalMistakes: 0,
        masteredCount: 0,
        settings: {
          reminderEnabled: true,
          autoReview: true,
          difficulty: 3,
          ...userInfo.settings
        },
        createTime: new Date(),
        updateTime: new Date()
      };

      const result = await withRetry(
        () => this.db.collection(this.collections.USERS).add({ data: userData }),
        this.retryOptions.maxRetries,
        this.retryOptions.delay
      );
      
      console.log('用户创建成功:', result._id);
      return {
        success: true,
        data: { ...userData, _id: result._id }
      };
    } catch (error) {
      return errorHandler.handle(error, {
        scene: 'database_create_user',
        showToast: true
      });
    }
  }

  /**
   * 获取用户信息
   * @param {string} openid - 用户openid
   * @returns {Promise<Object|null>} 用户信息
   */
  async getUserInfo(openid) {
    try {
      this.validateRequired({ openid }, ['openid']);

      const result = await withRetry(
        () => this.db.collection(this.collections.USERS).where({ openid }).get(),
        this.retryOptions.maxRetries,
        this.retryOptions.delay
      );
      
      return result.data.length > 0 ? result.data[0] : null;
    } catch (error) {
      errorHandler.handle(error, {
        scene: 'database_get_user',
        showToast: false
      });
      return null;
    }
  }

  /**
   * 更新用户信息
   * @param {string} userId - 用户ID
   * @param {Object} updateData - 更新数据
   * @returns {Promise<Object>} 更新结果
   */
  async updateUser(userId, updateData) {
    try {
      this.validateRequired({ userId }, ['userId']);
      
      if (!updateData || Object.keys(updateData).length === 0) {
        throw new Error('更新数据不能为空');
      }

      const sanitizedData = this.sanitizeUpdateData(updateData);
      sanitizedData.updateTime = new Date();

      const result = await withRetry(
        () => this.db.collection(this.collections.USERS).doc(userId).update({
          data: sanitizedData
        }),
        this.retryOptions.maxRetries,
        this.retryOptions.delay
      );
      
      return {
        success: true,
        data: result
      };
    } catch (error) {
      return errorHandler.handle(error, {
        scene: 'database_update_user',
        showToast: true
      });
    }
  }

  /**
   * 添加错题
   * @param {Object} mistakeData - 错题数据
   * @returns {Promise<Object>} 添加结果
   */
  async addMistake(mistakeData) {
    try {
      this.validateRequired(mistakeData, ['userId', 'subject', 'question', 'answer']);
      
      const mistakeRecord = {
        _id: generateUUID(),
        userId: mistakeData.userId,
        subject: mistakeData.subject,
        chapter: mistakeData.chapter || '',
        difficulty: this.validateDifficulty(mistakeData.difficulty),
        question: mistakeData.question.trim(),
        answer: mistakeData.answer.trim(),
        userAnswer: mistakeData.userAnswer || '',
        explanation: mistakeData.explanation || '',
        images: mistakeData.images || [],
        tags: mistakeData.tags || [],
        status: MISTAKE_STATUS.UNKNOWN,
        reviewCount: 0,
        lastReviewTime: null,
        nextReviewTime: mistakeData.nextReviewTime || this.calculateNextReviewTime(0),
        createTime: new Date()
      };

      const result = await withRetry(
        () => this.db.collection(this.collections.MISTAKES).add({ data: mistakeRecord }),
        this.retryOptions.maxRetries,
        this.retryOptions.delay
      );
      
      // 更新用户错题总数
      await this.updateUserMistakeCount(mistakeData.userId, 1);
      
      console.log('错题添加成功:', result._id);
      return {
        success: true,
        data: { ...mistakeRecord, _id: result._id }
      };
    } catch (error) {
      return errorHandler.handle(error, {
        scene: 'database_add_mistake',
        showToast: true
      });
    }
  }

  /**
   * 获取错题列表
   * @param {string} userId - 用户ID
   * @param {Object} options - 查询选项
   * @returns {Promise<Object>} 错题列表结果
   */
  async getMistakes(userId, options = {}) {
    try {
      this.validateRequired({ userId }, ['userId']);
      
      const {
        subject = '',
        status = '',
        page = 1,
        pageSize = 20,
        sortBy = 'createTime',
        sortOrder = 'desc'
      } = options;

      // 验证分页参数
      const validatedPage = Math.max(1, parseInt(page));
      const validatedPageSize = Math.min(100, Math.max(1, parseInt(pageSize)));

      let query = this.db.collection(this.collections.MISTAKES).where({ userId });

      // 构建查询条件
      if (subject && subject !== '全部') {
        query = query.where({ subject });
      }
      if (status && Object.values(MISTAKE_STATUS).includes(status)) {
        query = query.where({ status });
      }

      // 排序和分页
      query = query.orderBy(sortBy, sortOrder);
      const skip = (validatedPage - 1) * validatedPageSize;
      query = query.skip(skip).limit(validatedPageSize);

      const result = await withRetry(
        () => query.get(),
        this.retryOptions.maxRetries,
        this.retryOptions.delay
      );
      
      return {
        success: true,
        data: result.data,
        pagination: {
          page: validatedPage,
          pageSize: validatedPageSize,
          total: result.data.length,
          hasMore: result.data.length === validatedPageSize
        }
      };
    } catch (error) {
      return errorHandler.handle(error, {
        scene: 'database_get_mistakes',
        showToast: true
      });
    }
  }

  /**
   * 获取错题详情
   * @param {string} mistakeId - 错题ID
   * @returns {Promise<Object>} 错题详情
   */
  async getMistakeById(mistakeId) {
    try {
      this.validateRequired({ mistakeId }, ['mistakeId']);

      const result = await withRetry(
        () => this.db.collection(this.collections.MISTAKES).doc(mistakeId).get(),
        this.retryOptions.maxRetries,
        this.retryOptions.delay
      );
      
      if (!result.data) {
        throw new Error('错题不存在');
      }
      
      return {
        success: true,
        data: result.data
      };
    } catch (error) {
      return errorHandler.handle(error, {
        scene: 'database_get_mistake_detail',
        showToast: true
      });
    }
  }

  /**
   * 更新错题状态
   * @param {string} mistakeId - 错题ID
   * @param {string} status - 新状态
   * @returns {Promise<Object>} 更新结果
   */
  async updateMistakeStatus(mistakeId, status) {
    try {
      this.validateRequired({ mistakeId, status }, ['mistakeId', 'status']);
      
      if (!Object.values(MISTAKE_STATUS).includes(status)) {
        throw new Error('无效的错题状态');
      }

      const updateData = {
        status,
        lastReviewTime: new Date()
      };

      if (status === MISTAKE_STATUS.MASTERED) {
        // 已掌握，设置较长的复习间隔
        updateData.nextReviewTime = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      } else {
        // 获取当前复习次数并更新
        const mistake = await this.getMistakeById(mistakeId);
        if (mistake.success) {
          const reviewCount = (mistake.data.reviewCount || 0) + 1;
          updateData.reviewCount = reviewCount;
          updateData.nextReviewTime = this.calculateNextReviewTime(reviewCount);
        }
      }

      const result = await withRetry(
        () => this.db.collection(this.collections.MISTAKES).doc(mistakeId).update({
          data: updateData
        }),
        this.retryOptions.maxRetries,
        this.retryOptions.delay
      );
      
      return {
        success: true,
        data: result
      };
    } catch (error) {
      return errorHandler.handle(error, {
        scene: 'database_update_mistake_status',
        showToast: true
      });
    }
  }

  /**
   * 删除错题
   * @param {string} mistakeId - 错题ID
   * @returns {Promise<Object>} 操作结果
   */
  async deleteMistake(mistakeId) {
    try {
      this.validateRequired({ mistakeId }, ['mistakeId']);

      const result = await withRetry(
        () => this.db.collection(this.collections.MISTAKES).doc(mistakeId).remove(),
        this.retryOptions.maxRetries,
        this.retryOptions.delay
      );
      
      return {
        success: true,
        data: result
      };
    } catch (error) {
      return errorHandler.handle(error, {
        scene: 'database_delete_mistake',
        showToast: true
      });
    }
  }

  /**
   * 获取今日学习统计
   * @param {string} userId - 用户ID
   * @returns {Promise<Object>} 统计数据
   */
  async getTodayStats(userId) {
    try {
      this.validateRequired({ userId }, ['userId']);
      
      const today = new Date();
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

      // 并行查询多个统计数据
      const [todayMistakes, totalMistakes, reviewTasks, masteredCount] = await Promise.all([
        this.db.collection(this.collections.MISTAKES).where({
          userId,
          createTime: this.db.command.gte(todayStart).and(this.db.command.lt(todayEnd))
        }).count(),
        
        this.db.collection(this.collections.MISTAKES).where({ userId }).count(),
        
        this.db.collection(this.collections.MISTAKES).where({
          userId,
          nextReviewTime: this.db.command.lte(new Date()),
          status: this.db.command.neq(MISTAKE_STATUS.MASTERED)
        }).count(),
        
        this.db.collection(this.collections.MISTAKES).where({
          userId,
          status: MISTAKE_STATUS.MASTERED
        }).count()
      ]);

      const totalCount = totalMistakes.total || 0;
      const masteredCountValue = masteredCount.total || 0;
      
      return {
        success: true,
        data: {
          todayMistakes: todayMistakes.total || 0,
          totalMistakes: totalCount,
          reviewTasks: reviewTasks.total || 0,
          masteredCount: masteredCountValue,
          masteryRate: totalCount > 0 ? Math.round((masteredCountValue / totalCount) * 100) : 0
        }
      };
    } catch (error) {
      return errorHandler.handle(error, {
        scene: 'database_get_today_stats',
        showToast: false
      });
    }
  }

  /**
   * 保存练习记录
   * @param {Object} practiceData - 练习数据
   * @returns {Promise<Object>} 保存结果
   */
  async savePracticeRecord(practiceData) {
    try {
      this.validateRequired(practiceData, [
        'userId', 'subject', 'totalQuestions', 'correctAnswers', 'score'
      ]);
      
      const practiceRecord = {
        _id: generateUUID(),
        userId: practiceData.userId,
        subject: practiceData.subject,
        difficulty: this.validateDifficulty(practiceData.difficulty),
        questionType: practiceData.questionType || 'mixed',
        totalQuestions: Math.max(1, parseInt(practiceData.totalQuestions)),
        correctAnswers: Math.max(0, parseInt(practiceData.correctAnswers)),
        score: Math.min(100, Math.max(0, parseInt(practiceData.score))),
        duration: Math.max(0, parseInt(practiceData.duration || 0)),
        questions: practiceData.questions || [],
        userAnswers: practiceData.userAnswers || [],
        createTime: new Date()
      };

      const result = await withRetry(
        () => this.db.collection(this.collections.PRACTICE_RECORDS).add({
          data: practiceRecord
        }),
        this.retryOptions.maxRetries,
        this.retryOptions.delay
      );
      
      // 更新用户经验值
      const expGain = Math.floor(practiceRecord.score / 10);
      if (expGain > 0) {
        await this.updateUserExp(practiceData.userId, expGain);
      }
      
      return {
        success: true,
        data: { ...practiceRecord, _id: result._id }
      };
    } catch (error) {
      return errorHandler.handle(error, {
        scene: 'database_save_practice_record',
        showToast: true
      });
    }
  }

  /**
   * 更新用户错题数量
   * @param {string} userId - 用户ID
   * @param {number} increment - 增量
   */
  async updateUserMistakeCount(userId, increment) {
    try {
      await this.db.collection(this.collections.USERS).doc(userId).update({
        data: {
          totalMistakes: this.db.command.inc(increment),
          updateTime: new Date()
        }
      });
    } catch (error) {
      console.error('更新用户错题数量失败:', error);
    }
  }

  /**
   * 更新用户经验值
   * @param {string} userId - 用户ID
   * @param {number} expGain - 经验值增量
   */
  async updateUserExp(userId, expGain) {
    try {
      await this.db.collection(this.collections.USERS).doc(userId).update({
        data: {
          exp: this.db.command.inc(expGain),
          updateTime: new Date()
        }
      });
    } catch (error) {
      console.error('更新用户经验值失败:', error);
    }
  }

  /**
   * 计算下次复习时间（基于艾宾浩斯遗忘曲线）
   * @param {number} reviewCount - 复习次数
   * @returns {Date} 下次复习时间
   */
  calculateNextReviewTime(reviewCount) {
    const intervalIndex = Math.min(reviewCount, REVIEW_INTERVALS.length - 1);
    const intervalDays = REVIEW_INTERVALS[intervalIndex];
    return new Date(Date.now() + intervalDays * 24 * 60 * 60 * 1000);
  }

  /**
   * 验证难度值
   * @param {number} difficulty - 难度值
   * @returns {number} 验证后的难度值
   */
  validateDifficulty(difficulty) {
    const diff = parseInt(difficulty);
    return isNaN(diff) ? 3 : Math.min(5, Math.max(1, diff));
  }

  /**
   * 清理更新数据，移除不允许的字段
   * @param {Object} data - 原始数据
   * @returns {Object} 清理后的数据
   */
  sanitizeUpdateData(data) {
    const forbiddenFields = ['_id', '_openid', 'createTime'];
    const sanitized = {};
    
    Object.keys(data).forEach(key => {
      if (!forbiddenFields.includes(key)) {
        sanitized[key] = data[key];
      }
    });
    
    return sanitized;
  }

  /**
   * 添加课程
   * @param {Object} courseData - 课程数据
   * @returns {Promise<Object>} 添加结果
   */
  async addCourse(courseData) {
    try {
      this.validateRequired(courseData, ['userId', 'name', 'time']);
      
      const course = {
        _id: generateUUID(),
        ...courseData,
        createTime: new Date()
      };

      const result = await withRetry(
        () => this.db.collection(this.collections.COURSES).add({ data: course }),
        this.retryOptions.maxRetries,
        this.retryOptions.delay
      );
      
      return {
        success: true,
        data: { ...course, _id: result._id }
      };
    } catch (error) {
      return errorHandler.handle(error, {
        scene: 'database_add_course',
        showToast: true
      });
    }
  }
}

export default new DatabaseManager(); 