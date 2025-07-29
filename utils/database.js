// 确保必要的导入
import { generateUUID } from './common.js';

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
   * 获取错题列表
   */
  async getMistakes(userId, options = {}) {
    try {
      if (!userId) {
        userId = wx.getStorageSync('userId') || 'default_user';
      }
      
      const {
        subject = '',
        status = '',
        page = 1,
        pageSize = 20,
        sortBy = 'createTime',
        sortOrder = 'desc'
      } = options;

      let query = this.db.collection(this.collections.MISTAKES).where({ 
        userId,
        isArchived: false  // 只排除已归档的
      });

      // 只在明确指定时才应用筛选
      if (subject && subject !== 'all' && subject !== '') {
        query = query.where({ subject });
      }
      
      if (status && status !== 'all' && status !== '') {
        query = query.where({ status });
      }

      const result = await query
        .orderBy(sortBy, sortOrder)
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .get();

      return {
        success: true,
        data: result.data || []
      };
    } catch (error) {
      console.error('获取错题失败:', error);
      return {
        success: false,
        error: error.message,
        data: []
      };
    }
  }

  /**
   * 获取今日统计数据
   */
  async getTodayStats(userId) {
    try {
      if (!userId) {
        userId = wx.getStorageSync('userId') || 'default_user';
      }
      
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      
      // 获取今日新增错题
      const todayMistakes = await withRetry(
        () => this.db.collection(this.collections.MISTAKES)
          .where({
            userId,
            createTime: this.db.command.gte(startOfDay)
          })
          .count(),
        this.retryOptions.maxRetries,
        this.retryOptions.delay
      );

      // 获取需要复习的错题
      const reviewTasks = await withRetry(
        () => this.db.collection(this.collections.MISTAKES)
          .where({
            userId,
            nextReviewTime: this.db.command.lte(new Date()),
            isArchived: false
          })
          .count(),
        this.retryOptions.maxRetries,
        this.retryOptions.delay
      );

      // 获取总错题数
      const totalMistakes = await withRetry(
        () => this.db.collection(this.collections.MISTAKES)
          .where({
            userId,
            isArchived: false
          })
          .count(),
        this.retryOptions.maxRetries,
        this.retryOptions.delay
      );

      // 获取已掌握错题数
      const masteredMistakes = await withRetry(
        () => this.db.collection(this.collections.MISTAKES)
          .where({
            userId,
            reviewLevel: this.db.command.gte(5),
            isArchived: false
          })
          .count(),
        this.retryOptions.maxRetries,
        this.retryOptions.delay
      );

      const masteryRate = totalMistakes.total > 0 
        ? Math.round((masteredMistakes.total / totalMistakes.total) * 100) 
        : 0;

      return {
        success: true,
        data: {
          todayMistakes: todayMistakes.total,
          reviewTasks: reviewTasks.total,
          totalMistakes: totalMistakes.total,
          masteredCount: masteredMistakes.total,
          masteryRate
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
   * 保存错题
   */
  async saveMistake(mistakeData) {
    try {
      // 确保状态字段有默认值
      const dataToSave = {
        ...mistakeData,
        status: mistakeData.status || 'new',  // 默认为 'new'
        createTime: new Date().toISOString(),
        updateTime: new Date().toISOString(),
        isArchived: false
      };
      
      console.log('保存错题数据:', dataToSave);
      
      const result = await this.db.collection(this.collections.MISTAKES).add({
        data: dataToSave
      });
      
      return {
        success: true,
        data: { _id: result._id, ...dataToSave }
      };
    } catch (error) {
      console.error('保存错题失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 添加 getReviewRecords 方法
  async getReviewRecords(userId, options = {}) {
    try {
      const { pageSize = 20, pageIndex = 0 } = options;
      
      const db = wx.cloud.database();
      const result = await db.collection('review_records')
        .where({
          userId: userId
        })
        .orderBy('reviewTime', 'desc')
        .skip(pageIndex * pageSize)
        .limit(pageSize)
        .get();
      
      return {
        success: true,
        data: result.data,
        total: result.data.length
      };
      
    } catch (error) {
      console.error('获取复习记录失败:', error);
      return {
        success: false,
        error: error.message,
        data: []
      };
    }
  }

  // 添加 getTodayMistakes 方法
  async getTodayMistakes(userId, todayStart) {
    try {
      const db = wx.cloud.database();
      const result = await db.collection('mistakes')
        .where({
          userId: userId,
          createTime: db.command.gte(todayStart)
        })
        .get();
      
      return {
        success: true,
        data: result.data
      };
      
    } catch (error) {
      console.error('获取今日错题失败:', error);
      return {
        success: false,
        error: error.message,
        data: []
      };
    }
  }

  // 添加 addReviewRecord 方法
  async addReviewRecord(reviewData) {
    try {
      const db = wx.cloud.database();
      const result = await db.collection('review_records').add({
        data: {
          ...reviewData,
          createTime: db.serverDate(),
          userId: wx.getStorageSync('userId') || 'default_user'
        }
      });
      
      return {
        success: true,
        data: result
      };
      
    } catch (error) {
      console.error('添加复习记录失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 添加 addToReviewPlan 方法
  async addToReviewPlan(mistakeId, options = {}) {
    try {
      if (!mistakeId) {
        throw new Error('错题ID不能为空');
      }

      const userId = wx.getStorageSync('userId') || 'default_user';
      const { 
        days = 0,  // 默认立即复习（今日复习）
        forceUpdate = false  // 是否强制更新（即使已在复习计划中）
      } = options;
      
      // 计算复习时间
      const reviewTime = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
      const now = new Date();
      
      // 准备更新的数据
      const updateData = {
        nextReviewTime: reviewTime.toISOString(),
        updateTime: now.toISOString()
      };
      
      // 如果是立即复习，更新状态为 reviewing
      if (days === 0) {
        updateData.status = 'reviewing';
        updateData.lastReviewTime = now.toISOString();
      }
      
      console.log('添加到复习计划:', { mistakeId, updateData });
      
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
        console.log('复习计划添加成功:', result);
        return {
          success: true,
          data: {
            mistakeId,
            nextReviewTime: reviewTime.toISOString(),
            message: days === 0 ? '已加入今日复习计划' : `已安排${days}天后复习`
          }
        };
      } else {
        throw new Error('未找到该错题或更新失败');
      }
      
    } catch (error) {
      console.error('添加复习计划失败:', error);
      return {
        success: false,
        error: error.message || '添加复习计划失败'
      };
    }
  }

  // 添加 updateMistakeStatus 方法
  async updateMistakeStatus(mistakeId, status) {
    try {
      if (!mistakeId || !status) {
        throw new Error('错题ID和状态不能为空');
      }

      const userId = wx.getStorageSync('userId') || 'default_user';
      
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
      
      return {
        success: result.stats && result.stats.updated > 0,
        data: result
      };
      
    } catch (error) {
      console.error('更新错题状态失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 添加 deleteMistake 方法
  async deleteMistake(mistakeId) {
    try {
      if (!mistakeId) {
        throw new Error('错题ID不能为空');
      }

      const userId = wx.getStorageSync('userId') || 'default_user';
      
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
        console.log('错题删除成功:', mistakeId);
        return {
          success: true,
          data: result
        };
      } else {
        throw new Error('未找到该错题或删除失败');
      }
      
    } catch (error) {
      console.error('删除错题失败:', error);
      return {
        success: false,
        error: error.message || '删除错题失败'
      };
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

      const userId = wx.getStorageSync('userId') || 'default_user';

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
      console.error('获取错题详情失败:', error);
      return {
        success: false,
        error: error.message || '获取错题详情失败',
        data: null
      };
    }
  }
}

// 确保导出的是单例
export default new DatabaseManager(); 
