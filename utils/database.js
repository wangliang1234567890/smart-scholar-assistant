// 智能学霸小助手 - 数据库操作工具类
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
  }

  /**
   * 创建用户
   * @param {Object} userInfo - 用户信息
   * @returns {Promise<Object>} 创建结果
   */
  async createUser(userInfo) {
    try {
      const result = await this.db.collection(this.collections.USERS).add({
        data: {
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
            difficulty: 3
          },
          createTime: new Date(),
          updateTime: new Date()
        }
      });
      
      console.log('用户创建成功:', result._id);
      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error('创建用户失败:', error);
      throw this.handleError(error, '创建用户失败');
    }
  }

  /**
   * 获取用户信息
   * @param {string} openid - 用户openid
   * @returns {Promise<Object|null>} 用户信息
   */
  async getUserInfo(openid) {
    if (!openid) {
      throw new Error('openid不能为空');
    }

    try {
      const result = await this.db.collection(this.collections.USERS)
        .where({ openid })
        .get();
      
      if (result.data.length > 0) {
        return result.data[0];
      }
      return null;
    } catch (error) {
      console.error('获取用户信息失败:', error);
      throw this.handleError(error, '获取用户信息失败');
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
      const result = await this.db.collection(this.collections.USERS)
        .doc(userId)
        .update({
          data: {
            ...updateData,
            updateTime: new Date()
          }
        });
      
      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error('更新用户信息失败:', error);
      throw this.handleError(error, '更新用户信息失败');
    }
  }

  /**
   * 添加错题
   * @param {Object} mistakeData - 错题数据
   * @returns {Promise<Object>} 添加结果
   */
  async addMistake(mistakeData) {
    try {
      const result = await this.db.collection(this.collections.MISTAKES).add({
        data: {
          userId: mistakeData.userId,
          subject: mistakeData.subject,
          chapter: mistakeData.chapter || '',
          difficulty: mistakeData.difficulty || 3,
          question: mistakeData.question,
          answer: mistakeData.answer,
          userAnswer: mistakeData.userAnswer || '',
          explanation: mistakeData.explanation || '',
          images: mistakeData.images || [],
          tags: mistakeData.tags || [],
          status: 'unknown', // unknown/learning/mastered
          reviewCount: 0,
          lastReviewTime: null,
          nextReviewTime: mistakeData.nextReviewTime || this.calculateNextReviewTime(0),
          createTime: new Date()
        }
      });
      
      // 更新用户错题总数
      await this.updateUserMistakeCount(mistakeData.userId, 1);
      
      console.log('错题添加成功:', result._id);
      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error('添加错题失败:', error);
      throw this.handleError(error, '添加错题失败');
    }
  }

  /**
   * 获取错题列表
   * @param {string} userId - 用户ID
   * @param {Object} options - 查询选项
   * @returns {Promise<Array>} 错题列表
   */
  async getMistakes(userId, options = {}) {
    try {
      const {
        subject = '',
        status = '',
        page = 1,
        pageSize = 20,
        sortBy = 'createTime',
        sortOrder = 'desc'
      } = options;

      let query = this.db.collection(this.collections.MISTAKES)
        .where({ userId });

      // 按学科筛选
      if (subject && subject !== '全部') {
        query = query.where({ subject });
      }

      // 按状态筛选
      if (status) {
        query = query.where({ status });
      }

      // 排序
      query = query.orderBy(sortBy, sortOrder);

      // 分页
      const skip = (page - 1) * pageSize;
      query = query.skip(skip).limit(pageSize);

      const result = await query.get();
      
      return {
        success: true,
        data: result.data,
        total: result.data.length,
        hasMore: result.data.length === pageSize
      };
    } catch (error) {
      console.error('获取错题列表失败:', error);
      throw this.handleError(error, '获取错题列表失败');
    }
  }

  /**
   * 获取错题详情
   * @param {string} mistakeId - 错题ID
   * @returns {Promise<Object>} 错题详情
   */
  async getMistakeById(mistakeId) {
    try {
      const result = await this.db.collection(this.collections.MISTAKES)
        .doc(mistakeId)
        .get();
      
      if (result.data) {
        return {
          success: true,
          data: result.data
        };
      } else {
        throw new Error('错题不存在');
      }
    } catch (error) {
      console.error('获取错题详情失败:', error);
      throw this.handleError(error, '获取错题详情失败');
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
      const updateData = {
        status,
        lastReviewTime: new Date()
      };

      // 如果是标记为已掌握，设置下次复习时间为更远
      if (status === 'mastered') {
        updateData.nextReviewTime = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30天后
      } else {
        // 获取当前复习次数计算下次复习时间
        const mistake = await this.getMistakeById(mistakeId);
        const reviewCount = mistake.data.reviewCount || 0;
        updateData.reviewCount = reviewCount + 1;
        updateData.nextReviewTime = this.calculateNextReviewTime(reviewCount + 1);
      }

      const result = await this.db.collection(this.collections.MISTAKES)
        .doc(mistakeId)
        .update({
          data: updateData
        });
      
      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error('更新错题状态失败:', error);
      throw this.handleError(error, '更新错题状态失败');
    }
  }

  /**
   * 获取今日学习统计
   * @param {string} userId - 用户ID
   * @returns {Promise<Object>} 统计数据
   */
  async getTodayStats(userId) {
    try {
      const today = new Date();
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

      // 今日添加的错题数量
      const todayMistakes = await this.db.collection(this.collections.MISTAKES)
        .where({
          userId,
          createTime: this.db.command.gte(todayStart).and(this.db.command.lt(todayEnd))
        })
        .count();

      // 总错题数量
      const totalMistakes = await this.db.collection(this.collections.MISTAKES)
        .where({ userId })
        .count();

      // 待复习任务数量
      const reviewTasks = await this.db.collection(this.collections.MISTAKES)
        .where({
          userId,
          nextReviewTime: this.db.command.lte(new Date()),
          status: this.db.command.neq('mastered')
        })
        .count();

      // 已掌握错题数量
      const masteredCount = await this.db.collection(this.collections.MISTAKES)
        .where({
          userId,
          status: 'mastered'
        })
        .count();

      return {
        success: true,
        data: {
          todayMistakes: todayMistakes.total || 0,
          totalMistakes: totalMistakes.total || 0,
          reviewTasks: reviewTasks.total || 0,
          masteredCount: masteredCount.total || 0,
          masteryRate: totalMistakes.total > 0 ? 
            Math.round((masteredCount.total / totalMistakes.total) * 100) : 0
        }
      };
    } catch (error) {
      console.error('获取今日统计失败:', error);
      throw this.handleError(error, '获取今日统计失败');
    }
  }

  /**
   * 保存练习记录
   * @param {Object} practiceData - 练习数据
   * @returns {Promise<Object>} 保存结果
   */
  async savePracticeRecord(practiceData) {
    try {
      const result = await this.db.collection(this.collections.PRACTICE_RECORDS).add({
        data: {
          userId: practiceData.userId,
          subject: practiceData.subject,
          difficulty: practiceData.difficulty,
          questionType: practiceData.questionType,
          totalQuestions: practiceData.totalQuestions,
          correctAnswers: practiceData.correctAnswers,
          score: practiceData.score,
          duration: practiceData.duration, // 用时（秒）
          questions: practiceData.questions || [],
          userAnswers: practiceData.userAnswers || [],
          createTime: new Date()
        }
      });
      
      // 更新用户经验值
      const expGain = Math.floor(practiceData.score / 10);
      await this.updateUserExp(practiceData.userId, expGain);
      
      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error('保存练习记录失败:', error);
      throw this.handleError(error, '保存练习记录失败');
    }
  }

  /**
   * 更新用户错题数量
   * @param {string} userId - 用户ID
   * @param {number} increment - 增量
   */
  async updateUserMistakeCount(userId, increment) {
    try {
      await this.db.collection(this.collections.USERS)
        .doc(userId)
        .update({
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
      await this.db.collection(this.collections.USERS)
        .doc(userId)
        .update({
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
    const intervals = [1, 2, 4, 7, 15, 30]; // 天数间隔
    const intervalDays = intervals[Math.min(reviewCount, intervals.length - 1)];
    return new Date(Date.now() + intervalDays * 24 * 60 * 60 * 1000);
  }

  /**
   * 错误处理
   * @param {Error} error - 原始错误
   * @param {string} message - 用户友好的错误信息
   * @returns {Error} 处理后的错误
   */
  handleError(error, message) {
    const handledError = new Error(message);
    handledError.originalError = error;
    handledError.code = error.code || 'UNKNOWN_ERROR';
    return handledError;
  }

  /**
   * 添加课程
   * @param {Object} courseData - 课程数据
   * @returns {Promise<Object>} 添加结果
   */
  async addCourse(courseData) {
    try {
      const result = await this.db.collection(this.collections.COURSES).add({
        data: {
          ...courseData,
          createTime: new Date()
        }
      });
      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error('添加课程失败:', error);
      throw this.handleError(error, '添加课程失败');
    }
  }
}

export default new DatabaseManager(); 