// 确保必要的导入
import { generateUUID } from './common.js';
const { formatTime } = require('./util.js');

// 简单的重试函数实现
async function withRetry(fn, maxRetries = 2, delay = 1000) {
  let lastError;
  
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}

// 简单的错误处理器
const errorHandler = {
  handle(error, options = {}) {
    console.error('数据库操作错误:', error);
    
    if (options.showToast) {
      wx.showToast({
        title: options.message || '操作失败',
        icon: 'none'
      });
    }
    
    return {
      success: false,
      error: error.message || '未知错误',
      message: options.message || '操作失败'
    };
  }
};

// 导入复习间隔常量
import { REVIEW_INTERVALS } from './constants.js';

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
    
    // 重试配置
    this.retryOptions = {
      maxRetries: 2,
      delay: 1000
    };
    
    // 缓存配置
    this.cache = {
      todayStats: null,
      todayStatsTime: 0,
      cacheDuration: 5 * 60 * 1000 // 5分钟缓存
    };
  }

  /**
   * 验证必需参数
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
   * 获取当前用户ID
   */
  getCurrentUserId() {
    return wx.getStorageSync('userId') || 'default_user';
  }

  /**
   * 获取错题列表 - 优化版
   */
  async getMistakes(userId, options = {}) {
    try {
      if (!userId) {
        userId = this.getCurrentUserId();
      }
      
      const {
        subject = '',
        status = '',
        difficulty = '',
        keyword = '',
        page = 1,
        pageSize = 20,
        sortBy = 'createTime',
        sortOrder = 'desc'
      } = options;

      // 构建查询条件
      let whereCondition = { 
        userId,
        isArchived: false
      };

      // 动态添加筛选条件
      if (subject && subject !== 'all') {
        whereCondition.subject = subject;
      }
      
      if (status && status !== 'all') {
        whereCondition.status = status;
      }
      
      if (difficulty && difficulty !== 'all') {
        whereCondition.difficulty = parseInt(difficulty);
      }

      let query = this.db.collection(this.collections.MISTAKES).where(whereCondition);

      // 关键词搜索（如果提供）
      if (keyword) {
        query = query.where({
          question: this.db.RegExp({
            regexp: keyword,
            options: 'i'
          })
        });
      }

      // 执行查询
      const result = await withRetry(
        () => query
          .orderBy(sortBy, sortOrder)
          .skip((page - 1) * pageSize)
          .limit(pageSize)
          .get(),
        this.retryOptions.maxRetries,
        this.retryOptions.delay
      );

      return {
        success: true,
        data: result.data || [],
        total: result.data.length,
        page,
        pageSize
      };

    } catch (error) {
      return errorHandler.handle(error, {
        scene: 'database_get_mistakes',
        showToast: false
      });
    }
  }

  /**
   * 获取今日统计数据 - 带缓存优化
   */
  async getTodayStats(userId) {
    try {
      if (!userId) {
        userId = this.getCurrentUserId();
      }
      
      // 检查缓存
      const now = Date.now();
      if (this.cache.todayStats && 
          now - this.cache.todayStatsTime < this.cache.cacheDuration) {
        return {
          success: true,
          data: this.cache.todayStats,
          cached: true
        };
      }
      
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      
      // 并行执行多个查询
      const [todayMistakes, reviewTasks, totalMistakes, masteredMistakes] = await Promise.all([
        // 今日新增错题
        withRetry(
          () => this.db.collection(this.collections.MISTAKES)
            .where({
              userId,
              createTime: this.db.command.gte(startOfDay)
            })
            .count(),
          this.retryOptions.maxRetries,
          this.retryOptions.delay
        ),
        
        // 需要复习的错题
        withRetry(
          () => this.db.collection(this.collections.MISTAKES)
            .where({
              userId,
              nextReviewTime: this.db.command.lte(new Date()),
              isArchived: false
            })
            .count(),
          this.retryOptions.maxRetries,
          this.retryOptions.delay
        ),
        
        // 总错题数
        withRetry(
          () => this.db.collection(this.collections.MISTAKES)
            .where({
              userId,
              isArchived: false
            })
            .count(),
          this.retryOptions.maxRetries,
          this.retryOptions.delay
        ),
        
        // 已掌握错题数
        withRetry(
          () => this.db.collection(this.collections.MISTAKES)
            .where({
              userId,
              reviewLevel: this.db.command.gte(5),
              isArchived: false
            })
            .count(),
          this.retryOptions.maxRetries,
          this.retryOptions.delay
        )
      ]);

      const masteryRate = totalMistakes.total > 0 
        ? Math.round((masteredMistakes.total / totalMistakes.total) * 100) 
        : 0;

      const statsData = {
        todayMistakes: todayMistakes.total,
        reviewTasks: reviewTasks.total,
        totalMistakes: totalMistakes.total,
        masteredCount: masteredMistakes.total,
        masteryRate
      };

      // 更新缓存
      this.cache.todayStats = statsData;
      this.cache.todayStatsTime = now;

      return {
        success: true,
        data: statsData
      };

    } catch (error) {
      return errorHandler.handle(error, {
        scene: 'database_get_today_stats',
        showToast: false
      });
    }
  }

  /**
   * 保存错题 - 增强版
   */
  async saveMistake(mistakeData) {
    try {
      this.validateRequired(mistakeData, ['userId', 'question']);
      
      const now = new Date();
      const dataToSave = {
        ...mistakeData,
        _id: mistakeData._id || generateUUID(),
        status: mistakeData.status || 'new',
        reviewLevel: mistakeData.reviewLevel || 0,
        reviewCount: mistakeData.reviewCount || 0,
        difficulty: mistakeData.difficulty || 3,
        subject: mistakeData.subject || 'unknown',
        createTime: now.toISOString(),
        updateTime: now.toISOString(),
        isArchived: false,
        nextReviewTime: null
      };
      
      console.log('保存错题数据:', dataToSave);
      
      const result = await withRetry(
        () => this.db.collection(this.collections.MISTAKES).add({
          data: dataToSave
        }),
        this.retryOptions.maxRetries,
        this.retryOptions.delay
      );
      
      // 清除缓存
      this.cache.todayStats = null;
      
      return {
        success: true,
        data: { _id: result._id, ...dataToSave }
      };
      
    } catch (error) {
      return errorHandler.handle(error, {
        scene: 'database_save_mistake',
        showToast: true,
        message: '保存错题失败'
      });
    }
  }

  /**
   * 获取复习记录 - 优化版
   */
  async getReviewRecords(userId, options = {}) {
    try {
      if (!userId) {
        userId = this.getCurrentUserId();
      }
      
      const { 
        pageSize = 20, 
        pageIndex = 0,
        startDate = null,
        endDate = null 
      } = options;
      
      let whereCondition = { userId };
      
      // 日期范围筛选
      if (startDate && endDate) {
        whereCondition.reviewTime = this.db.command.and([
          this.db.command.gte(new Date(startDate)),
          this.db.command.lte(new Date(endDate))
        ]);
      }
      
      const result = await withRetry(
        () => this.db.collection(this.collections.REVIEW_RECORDS)
          .where(whereCondition)
          .orderBy('reviewTime', 'desc')
          .skip(pageIndex * pageSize)
          .limit(pageSize)
          .get(),
        this.retryOptions.maxRetries,
        this.retryOptions.delay
      );
      
      return {
        success: true,
        data: result.data,
        total: result.data.length,
        pageIndex,
        pageSize
      };
      
    } catch (error) {
      return errorHandler.handle(error, {
        scene: 'database_get_review_records',
        showToast: false
      });
    }
  }

  /**
   * 保存练习结果 - 新增方法
   */
  async savePracticeResult(userId, practiceData) {
    try {
      // 验证基本参数
      if (!userId) {
        throw new Error('缺少用户ID');
      }
      
      if (!practiceData || typeof practiceData !== 'object') {
        throw new Error('缺少练习数据');
      }
      
      // 确保必要字段存在，提供默认值
      const dataToValidate = {
        userId,
        practiceId: practiceData.practiceId || `practice_${Date.now()}`,
        type: practiceData.type || 'unknown',
        title: practiceData.title || '练习记录',
        totalQuestions: practiceData.totalQuestions || 0,
        answeredQuestions: practiceData.answeredQuestions || 0,
        correctCount: practiceData.correctCount || 0,
        incorrectCount: practiceData.incorrectCount || 0,
        accuracy: practiceData.accuracy || 0,
        score: practiceData.score || 0,
        duration: practiceData.duration || 0,
        startTime: practiceData.startTime || Date.now(),
        endTime: practiceData.endTime || Date.now(),
        completionRate: practiceData.completionRate || 0,
        answerDetails: practiceData.answerDetails || []
      };
      
      const now = new Date();
      const finalData = {
        ...dataToValidate,
        _id: generateUUID(),
        practiceTime: now.toISOString(),
        createTime: now.toISOString()
      };
      
      console.log('保存练习记录:', {
        practiceId: finalData.practiceId,
        type: finalData.type,
        totalQuestions: finalData.totalQuestions,
        answeredQuestions: finalData.answeredQuestions,
        score: finalData.score
      });
      
      const result = await withRetry(
        () => this.db.collection(this.collections.PRACTICE_RECORDS).add({
          data: finalData
        }),
        this.retryOptions.maxRetries,
        this.retryOptions.delay
      );
      
      console.log('练习记录保存成功:', result._id);
      
      return {
        success: true,
        data: { _id: result._id, ...finalData }
      };
      
    } catch (error) {
      console.error('保存练习结果详细错误:', error);
      return errorHandler.handle(error, {
        scene: 'database_save_practice_result',
        showToast: true,
        message: '保存练习结果失败'
      });
    }
  }

  /**
   * 获取练习记录 - 新增方法
   */
  async getPracticeRecords(userId, options = {}) {
    try {
      if (!userId) {
        userId = this.getCurrentUserId();
      }
      
      const { 
        pageSize = 20, 
        pageIndex = 0,
        subject = '',
        type = ''
      } = options;
      
      let whereCondition = { userId };
      
      if (subject && subject !== 'all') {
        whereCondition.subject = subject;
      }
      
      if (type && type !== 'all') {
        whereCondition.practiceType = type;
      }
      
      const result = await withRetry(
        () => this.db.collection(this.collections.PRACTICE_RECORDS)
          .where(whereCondition)
          .orderBy('practiceTime', 'desc')
          .skip(pageIndex * pageSize)
          .limit(pageSize)
          .get(),
        this.retryOptions.maxRetries,
        this.retryOptions.delay
      );
      
      return {
        success: true,
        data: result.data,
        total: result.data.length
      };
      
    } catch (error) {
      return errorHandler.handle(error, {
        scene: 'database_get_practice_records',
        showToast: false
      });
    }
  }

  /**
   * 计算下次复习时间 - 艾宾浩斯曲线
   */
  calculateNextReviewTime(reviewLevel = 0, lastReviewTime = null) {
    const now = new Date();
    const level = Math.min(reviewLevel, REVIEW_INTERVALS.length - 1);
    const daysToAdd = REVIEW_INTERVALS[level];
    
    const nextReviewTime = new Date(now.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
    
    return {
      nextReviewTime: nextReviewTime.toISOString(),
      daysInterval: daysToAdd,
      reviewLevel: reviewLevel + 1
    };
  }

  /**
   * 添加到复习计划 - 智能版
   */
  async addToReviewPlan(mistakeId, options = {}) {
    try {
      if (!mistakeId) {
        throw new Error('错题ID不能为空');
      }

      const userId = this.getCurrentUserId();
      const { 
        days = 0,
        forceUpdate = false,
        useSmartInterval = true // 使用智能间隔
      } = options;
      
      // 获取错题当前信息
      const mistakeResult = await this.getMistakeById(mistakeId);
      if (!mistakeResult.success) {
        throw new Error('未找到该错题');
      }
      
      const mistake = mistakeResult.data;
      let reviewTime, updateData;
      
      if (useSmartInterval && mistake.reviewLevel !== undefined) {
        // 使用艾宾浩斯曲线计算
        const reviewInfo = this.calculateNextReviewTime(mistake.reviewLevel, mistake.lastReviewTime);
        updateData = {
          nextReviewTime: reviewInfo.nextReviewTime,
          reviewLevel: reviewInfo.reviewLevel,
          updateTime: new Date().toISOString()
        };
      } else {
        // 使用指定天数
        reviewTime = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
        updateData = {
          nextReviewTime: reviewTime.toISOString(),
          updateTime: new Date().toISOString()
        };
      }
      
      // 如果是立即复习，更新状态为 reviewing
      if (days === 0) {
        updateData.status = 'reviewing';
        updateData.lastReviewTime = new Date().toISOString();
      }
      
      const result = await withRetry(
        () => this.db.collection(this.collections.MISTAKES)
          .where({
            _id: mistakeId,
            userId
          })
          .update({
            data: updateData
          }),
        this.retryOptions.maxRetries,
        this.retryOptions.delay
      );
      
      if (result.stats && result.stats.updated > 0) {
        // 清除缓存
        this.cache.todayStats = null;
        
        return {
          success: true,
          data: {
            mistakeId,
            nextReviewTime: updateData.nextReviewTime,
            message: days === 0 ? '已加入今日复习计划' : `已安排复习计划`
          }
        };
      } else {
        throw new Error('更新失败');
      }
      
    } catch (error) {
      return errorHandler.handle(error, {
        scene: 'database_add_to_review_plan',
        showToast: true,
        message: '添加复习计划失败'
      });
    }
  }

  /**
   * 批量更新错题状态 - 新增方法
   */
  async batchUpdateMistakes(mistakeIds, updateData) {
    try {
      this.validateRequired({ mistakeIds, updateData }, ['mistakeIds', 'updateData']);
      
      const userId = this.getCurrentUserId();
      const finalUpdateData = {
        ...updateData,
        updateTime: new Date().toISOString()
      };
      
      const result = await withRetry(
        () => this.db.collection(this.collections.MISTAKES)
          .where({
            _id: this.db.command.in(mistakeIds),
            userId
          })
          .update({
            data: finalUpdateData
          }),
        this.retryOptions.maxRetries,
        this.retryOptions.delay
      );
      
      // 清除缓存
      this.cache.todayStats = null;
      
      return {
        success: true,
        data: {
          updated: result.stats.updated,
          mistakeIds
        }
      };
      
    } catch (error) {
      return errorHandler.handle(error, {
        scene: 'database_batch_update_mistakes',
        showToast: true,
        message: '批量更新失败'
      });
    }
  }

  /**
   * 搜索错题 - 新增方法
   */
  async searchMistakes(userId, keyword, options = {}) {
    try {
      if (!userId) {
        userId = this.getCurrentUserId();
      }
      
      if (!keyword || keyword.trim() === '') {
        return {
          success: true,
          data: [],
          message: '请输入搜索关键词'
        };
      }
      
      const { pageSize = 20, pageIndex = 0 } = options;
      
      const result = await withRetry(
        () => this.db.collection(this.collections.MISTAKES)
          .where({
            userId,
            isArchived: false,
            question: this.db.RegExp({
              regexp: keyword.trim(),
              options: 'i'
            })
          })
          .orderBy('createTime', 'desc')
          .skip(pageIndex * pageSize)
          .limit(pageSize)
          .get(),
        this.retryOptions.maxRetries,
        this.retryOptions.delay
      );
      
      return {
        success: true,
        data: result.data,
        total: result.data.length,
        keyword
      };
      
    } catch (error) {
      return errorHandler.handle(error, {
        scene: 'database_search_mistakes',
        showToast: false
      });
    }
  }

  /**
   * 获取周统计数据 - 新增方法
   */
  async getWeeklyStats(userId) {
    try {
      if (!userId) {
        userId = this.getCurrentUserId();
      }
      
      const now = new Date();
      const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      const [weeklyMistakes, weeklyPractice] = await Promise.all([
        withRetry(
          () => this.db.collection(this.collections.MISTAKES)
            .where({
              userId,
              createTime: this.db.command.gte(weekStart)
            })
            .get(),
          this.retryOptions.maxRetries,
          this.retryOptions.delay
        ),
        
        withRetry(
          () => this.db.collection(this.collections.PRACTICE_RECORDS)
            .where({
              userId,
              practiceTime: this.db.command.gte(weekStart)
            })
            .get(),
          this.retryOptions.maxRetries,
          this.retryOptions.delay
        )
      ]);
      
      return {
        success: true,
        data: {
          weeklyMistakesCount: weeklyMistakes.data.length,
          weeklyPracticeCount: weeklyPractice.data.length,
          weeklyMistakes: weeklyMistakes.data,
          weeklyPractice: weeklyPractice.data
        }
      };
      
    } catch (error) {
      return errorHandler.handle(error, {
        scene: 'database_get_weekly_stats',
        showToast: false
      });
    }
  }

  /**
   * 更新错题数据
   */
  async updateMistake(mistakeId, updateData) {
    try {
      if (!mistakeId) {
        throw new Error('错题ID不能为空');
      }
      
      if (!updateData || typeof updateData !== 'object') {
        throw new Error('更新数据不能为空');
      }

      const userId = this.getCurrentUserId();
      
      // 添加更新时间
      const dataToUpdate = {
        ...updateData,
        updateTime: new Date().toISOString()
      };
      
      const result = await withRetry(
        () => this.db.collection(this.collections.MISTAKES)
          .where({
            _id: mistakeId,
            userId
          })
          .update({
            data: dataToUpdate
          }),
        this.retryOptions.maxRetries,
        this.retryOptions.delay
      );
      
      // 清除缓存
      this.cache.todayStats = null;
      
      return {
        success: result.stats && result.stats.updated > 0,
        data: result
      };
      
    } catch (error) {
      return errorHandler.handle(error, {
        scene: 'database_update_mistake',
        showToast: false,
        message: '更新错题失败'
      });
    }
  }

  /**
   * 更新错题状态
   */
  async updateMistakeStatus(mistakeId, status) {
    try {
      if (!mistakeId || !status) {
        throw new Error('错题ID和状态不能为空');
      }

      const userId = this.getCurrentUserId();
      
      const result = await withRetry(
        () => this.db.collection(this.collections.MISTAKES)
          .where({
            _id: mistakeId,
            userId
          })
          .update({
            data: {
              status,
              updateTime: new Date().toISOString()
            }
          }),
        this.retryOptions.maxRetries,
        this.retryOptions.delay
      );
      
      // 清除缓存
      this.cache.todayStats = null;
      
      return {
        success: result.stats && result.stats.updated > 0,
        data: result
      };
      
    } catch (error) {
      return errorHandler.handle(error, {
        scene: 'database_update_mistake_status',
        showToast: true,
        message: '更新状态失败'
      });
    }
  }

  /**
   * 删除错题
   */
  async deleteMistake(mistakeId) {
    try {
      if (!mistakeId) {
        throw new Error('错题ID不能为空');
      }

      const userId = this.getCurrentUserId();
      
      const result = await withRetry(
        () => this.db.collection(this.collections.MISTAKES)
          .where({
            _id: mistakeId,
            userId
          })
          .remove(),
        this.retryOptions.maxRetries,
        this.retryOptions.delay
      );
      
      if (result.stats && result.stats.removed > 0) {
        // 清除缓存
        this.cache.todayStats = null;
        
        return {
          success: true,
          data: result
        };
      } else {
        throw new Error('未找到该错题或删除失败');
      }
      
    } catch (error) {
      return errorHandler.handle(error, {
        scene: 'database_delete_mistake',
        showToast: true,
        message: '删除错题失败'
      });
    }
  }

  /**
   * 根据ID获取错题详情
   */
  async getMistakeById(id) {
    try {
      if (!id) {
        throw new Error('错题ID不能为空');
      }

      const userId = this.getCurrentUserId();

      const result = await withRetry(
        () => this.db.collection(this.collections.MISTAKES)
          .where({
            _id: id,
            userId
          })
          .get(),
        this.retryOptions.maxRetries,
        this.retryOptions.delay
      );

      if (result.data && result.data.length > 0) {
        return {
          success: true,
          data: result.data[0]
        };
      } else {
        // 兜底：本地缓存查找
        const localMistakes = wx.getStorageSync('mistakes') || [];
        const localMistake = localMistakes.find(item => item._id === id);
        
        if (localMistake) {
          console.log('从本地缓存获取错题:', id);
          return { 
            success: true, 
            data: localMistake 
          };
        }
        
        return {
          success: false,
          error: '未找到该错题'
        };
      }

    } catch (error) {
      return errorHandler.handle(error, {
        scene: 'database_get_mistake_by_id',
        showToast: false
      });
    }
  }

  /**
   * 清除缓存 - 工具方法
   */
  clearCache() {
    this.cache.todayStats = null;
    this.cache.todayStatsTime = 0;
    console.log('数据库缓存已清除');
  }

  /**
   * 获取数据库状态信息 - 调试方法
   */
  async getDatabaseStatus() {
    try {
      const collections = [];
      
      for (const [name, collection] of Object.entries(this.collections)) {
        try {
          const count = await this.db.collection(collection).count();
          collections.push({
            name,
            collection,
            count: count.total,
            status: 'active'
          });
        } catch (error) {
          collections.push({
            name,
            collection,
            count: 0,
            status: 'error',
            error: error.message
          });
        }
      }
      
      return {
        success: true,
        data: {
          collections,
          cache: {
            todayStatsTime: this.cache.todayStatsTime,
            hasTodayStats: !!this.cache.todayStats
          },
          retryOptions: this.retryOptions
        }
      };
      
    } catch (error) {
      return errorHandler.handle(error, {
        scene: 'database_get_status',
        showToast: false
      });
    }
  }

  /**
   * 格式化日期为 YYYY-MM-DD 格式
   */
  formatDate(date) {
    return formatTime(date, 'yyyy-MM-dd');
  }

  // ==================== 课程管理相关方法 ====================

  /**
   * 添加课程
   */
  async addCourse(courseData) {
    try {
      const userId = this.getCurrentUserId();
      
      const course = {
        ...courseData,
        userId,
        _id: undefined, // 让数据库自动生成ID
        createTime: new Date().toISOString(),
        updateTime: new Date().toISOString(),
        status: 'active'
      };
      
      const result = await withRetry(
        () => this.db.collection(this.collections.COURSES).add({
          data: course
        }),
        this.retryOptions.maxRetries,
        this.retryOptions.delay
      );
      
      return {
        success: true,
        data: { _id: result._id, ...course },
        message: '课程添加成功'
      };
      
    } catch (error) {
      return errorHandler.handle(error, {
        scene: 'database_add_course',
        showToast: true,
        message: '添加课程失败'
      });
    }
  }

  /**
   * 获取课程列表
   */
  async getCourses(userId, options = {}) {
    try {
      const {
        page = 1,
        pageSize = 50,
        startDate,
        endDate,
        subject,
        status = 'active'
      } = options;
      
      let whereCondition = {
        userId,
        status
      };
      
      // 添加日期范围筛选
      if (startDate && endDate) {
        whereCondition.date = this.db.command.gte(startDate).and(this.db.command.lte(endDate));
      }
      
      // 添加学科筛选
      if (subject && subject !== 'all') {
        whereCondition.subject = subject;
      }
      
      const result = await withRetry(
        () => this.db.collection(this.collections.COURSES)
          .where(whereCondition)
          .orderBy('date', 'asc')
          .orderBy('startTime', 'asc')
          .skip((page - 1) * pageSize)
          .limit(pageSize)
          .get(),
        this.retryOptions.maxRetries,
        this.retryOptions.delay
      );
      
      return {
        success: true,
        data: result.data || [],
        total: result.data ? result.data.length : 0,
        message: '获取课程列表成功'
      };
      
    } catch (error) {
      return errorHandler.handle(error, {
        scene: 'database_get_courses',
        showToast: false,
        message: '获取课程列表失败'
      });
    }
  }

  /**
   * 获取指定日期的课程
   */
  async getCoursesByDate(userId, date) {
    try {
      const result = await withRetry(
        () => this.db.collection(this.collections.COURSES)
          .where({
            userId,
            date,
            status: 'active'
          })
          .orderBy('startTime', 'asc')
          .get(),
        this.retryOptions.maxRetries,
        this.retryOptions.delay
      );
      
      return {
        success: true,
        data: result.data || [],
        message: '获取当日课程成功'
      };
      
    } catch (error) {
      return errorHandler.handle(error, {
        scene: 'database_get_courses_by_date',
        showToast: false,
        message: '获取当日课程失败'
      });
    }
  }

  /**
   * 更新课程
   */
  async updateCourse(courseId, updateData) {
    try {
      const result = await withRetry(
        () => this.db.collection(this.collections.COURSES)
          .doc(courseId)
          .update({
            data: {
              ...updateData,
              updateTime: new Date().toISOString()
            }
          }),
        this.retryOptions.maxRetries,
        this.retryOptions.delay
      );
      
      return {
        success: true,
        data: result,
        message: '课程更新成功'
      };
      
    } catch (error) {
      return errorHandler.handle(error, {
        scene: 'database_update_course',
        showToast: true,
        message: '更新课程失败'
      });
    }
  }

  /**
   * 删除课程
   */
  async deleteCourse(courseId) {
    try {
      // 软删除：将状态设为 deleted
      const result = await withRetry(
        () => this.db.collection(this.collections.COURSES)
          .doc(courseId)
          .update({
            data: {
              status: 'deleted',
              deleteTime: new Date().toISOString(),
              updateTime: new Date().toISOString()
            }
          }),
        this.retryOptions.maxRetries,
        this.retryOptions.delay
      );
      
      return {
        success: true,
        data: result,
        message: '课程删除成功'
      };
      
    } catch (error) {
      return errorHandler.handle(error, {
        scene: 'database_delete_course',
        showToast: true,
        message: '删除课程失败'
      });
    }
  }

  /**
   * 获取课程统计数据
   */
  async getCourseStats(userId) {
    try {
      const now = new Date();
      const today = this.formatDate(now);
      const tomorrow = this.formatDate(new Date(now.getTime() + 24 * 60 * 60 * 1000));
      
      // 并行获取统计数据
      const [todayResult, tomorrowResult, totalResult] = await Promise.all([
        // 今日课程
        withRetry(
          () => this.db.collection(this.collections.COURSES)
            .where({
              userId,
              date: today,
              status: 'active'
            })
            .count(),
          this.retryOptions.maxRetries,
          this.retryOptions.delay
        ),
        // 明日课程
        withRetry(
          () => this.db.collection(this.collections.COURSES)
            .where({
              userId,
              date: tomorrow,
              status: 'active'
            })
            .count(),
          this.retryOptions.maxRetries,
          this.retryOptions.delay
        ),
        // 总课程数
        withRetry(
          () => this.db.collection(this.collections.COURSES)
            .where({
              userId,
              status: 'active'
            })
            .count(),
          this.retryOptions.maxRetries,
          this.retryOptions.delay
        )
      ]);
      
      return {
        success: true,
        data: {
          todayCourses: todayResult.total || 0,
          tomorrowCourses: tomorrowResult.total || 0,
          totalCourses: totalResult.total || 0
        },
        message: '获取课程统计成功'
      };
      
    } catch (error) {
      return errorHandler.handle(error, {
        scene: 'database_get_course_stats',
        showToast: false,
        message: '获取课程统计失败'
      });
    }
  }
}

// 确保导出的是单例
export default new DatabaseManager(); 
