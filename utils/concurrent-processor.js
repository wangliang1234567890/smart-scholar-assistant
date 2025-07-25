/**
 * 并发处理工具类 - 优化版
 * 提供任务队列、批量处理、限流等功能
 * 优化点：智能调度、优先级队列、错误恢复、性能监控
 */

import { errorHandler } from './error-handler';
import { debounce, throttle, deepClone } from './common';

class ConcurrentProcessor {
  constructor() {
    // 任务队列配置
    this.config = {
      maxConcurrency: 5, // 默认最大并发数
      retryAttempts: 3, // 默认重试次数
      retryDelay: 1000, // 默认重试延迟
      timeout: 30000, // 默认超时时间
      enablePriority: true, // 启用优先级
      enableMetrics: true, // 启用指标收集
      queueLimit: 1000, // 队列最大长度
      adaptiveConcurrency: true // 自适应并发控制
    };

    // 任务队列 - 按类型分组
    this.taskQueues = new Map();
    
    // 活跃任务追踪
    this.activeTasks = new Map();
    
    // 并发限制 - 按类型设置
    this.concurrencyLimits = new Map([
      ['default', 5],
      ['ocr', 2],
      ['ai', 3],
      ['upload', 2],
      ['image', 4],
      ['network', 6]
    ]);

    // 性能统计
    this.stats = {
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      cancelledTasks: 0,
      averageExecutionTime: 0,
      averageWaitTime: 0,
      peakConcurrency: 0,
      queueSizes: new Map(),
      typeStats: new Map() // 按类型统计
    };

    // 自适应控制
    this.adaptiveControl = {
      enabled: true,
      lastAdjustment: 0,
      adjustmentInterval: 30000, // 30秒调整一次
      performanceWindow: [], // 性能窗口
      windowSize: 10 // 窗口大小
    };

    // 防抖和节流函数
    this.debouncedStatsLog = debounce(this.logStats.bind(this), 5000);
    this.throttledAdjustConcurrency = throttle(this.adjustConcurrency.bind(this), 10000);

    this.init();
  }

  /**
   * 初始化处理器
   */
  init() {
    try {
      // 初始化队列
      this.initializeQueues();
      
      // 启动自适应控制
      if (this.config.adaptiveConcurrency) {
        this.startAdaptiveControl();
      }
      
      console.log('并发处理器初始化完成');
    } catch (error) {
      errorHandler.handleError(error, {
        context: 'ConcurrentProcessor.init',
        level: 'warning'
      });
    }
  }

  /**
   * 初始化队列
   */
  initializeQueues() {
    for (const [type] of this.concurrencyLimits) {
      this.taskQueues.set(type, []);
      this.stats.queueSizes.set(type, 0);
      this.stats.typeStats.set(type, {
        executed: 0,
        failed: 0,
        avgTime: 0,
        lastExecuted: 0
      });
    }
  }

  /**
   * 设置并发限制
   * @param {string} type - 任务类型
   * @param {number} limit - 并发限制
   */
  static setLimit(type, limit) {
    if (this.instance) {
      this.instance.setLimit(type, limit);
    }
  }

  /**
   * 设置并发限制
   * @param {string} type - 任务类型
   * @param {number} limit - 并发限制
   */
  setLimit(type, limit) {
    this.concurrencyLimits.set(type, Math.max(1, limit));
    
    // 确保队列存在
    if (!this.taskQueues.has(type)) {
      this.taskQueues.set(type, []);
      this.stats.queueSizes.set(type, 0);
      this.stats.typeStats.set(type, {
        executed: 0,
        failed: 0,
        avgTime: 0,
        lastExecuted: 0
      });
    }
  }

  /**
   * 添加任务到队列
   * @param {string} type - 任务类型
   * @param {Function} task - 任务函数
   * @param {Object} options - 选项
   * @returns {Promise} 任务执行结果
   */
  async addTask(type = 'default', task, options = {}) {
    try {
      const {
        priority = 0,
        timeout = this.config.timeout,
        retries = this.config.retryAttempts,
        retryDelay = this.config.retryDelay,
        taskId = this.generateTaskId(),
        metadata = {}
      } = options;

      // 检查队列长度限制
      const queue = this.getOrCreateQueue(type);
      if (queue.length >= this.config.queueLimit) {
        throw new Error(`任务队列已满 (${type}): ${queue.length}/${this.config.queueLimit}`);
      }

      const taskWrapper = {
        id: taskId,
        type,
        task,
        priority,
        timeout,
        retries,
        retryDelay,
        attempts: 0,
        createTime: Date.now(),
        startTime: null,
        endTime: null,
        status: 'pending',
        metadata,
        promise: null,
        resolve: null,
        reject: null
      };

      // 创建Promise包装器
      const promise = new Promise((resolve, reject) => {
        taskWrapper.resolve = resolve;
        taskWrapper.reject = reject;
      });
      taskWrapper.promise = promise;

      // 添加到队列
      this.insertTaskByPriority(queue, taskWrapper);
      this.updateQueueSize(type);
      this.stats.totalTasks++;

      // 触发任务处理
      this.processQueue(type);

      return promise;

    } catch (error) {
      errorHandler.handleError(error, {
        context: 'ConcurrentProcessor.addTask',
        level: 'error',
        extra: { type, options }
      });
      throw error;
    }
  }

  /**
   * 获取或创建队列
   */
  getOrCreateQueue(type) {
    if (!this.taskQueues.has(type)) {
      this.setLimit(type, this.config.maxConcurrency);
    }
    return this.taskQueues.get(type);
  }

  /**
   * 按优先级插入任务
   */
  insertTaskByPriority(queue, task) {
    if (!this.config.enablePriority) {
      queue.push(task);
      return;
    }

    // 按优先级降序插入
    let insertIndex = queue.length;
    for (let i = 0; i < queue.length; i++) {
      if (queue[i].priority < task.priority) {
        insertIndex = i;
        break;
      }
    }
    queue.splice(insertIndex, 0, task);
  }

  /**
   * 处理队列
   */
  async processQueue(type) {
    const queue = this.taskQueues.get(type);
    const limit = this.concurrencyLimits.get(type) || this.config.maxConcurrency;
    const activeKey = `${type}_active`;
    
    if (!this.activeTasks.has(activeKey)) {
      this.activeTasks.set(activeKey, 0);
    }

    const currentActive = this.activeTasks.get(activeKey);
    
    // 检查是否可以处理更多任务
    if (currentActive >= limit || queue.length === 0) {
      return;
    }

    const task = queue.shift();
    if (!task) return;

    this.updateQueueSize(type);
    this.activeTasks.set(activeKey, currentActive + 1);
    
    // 更新峰值并发数
    const totalActive = Array.from(this.activeTasks.values()).reduce((sum, count) => sum + count, 0);
    this.stats.peakConcurrency = Math.max(this.stats.peakConcurrency, totalActive);

    // 执行任务
    this.executeTask(task).finally(() => {
      this.activeTasks.set(activeKey, this.activeTasks.get(activeKey) - 1);
      // 继续处理队列
      setImmediate(() => this.processQueue(type));
    });

    // 继续处理更多任务（如果还有容量）
    if (currentActive + 1 < limit && queue.length > 0) {
      setImmediate(() => this.processQueue(type));
    }
  }

  /**
   * 执行单个任务
   */
  async executeTask(taskWrapper) {
    const { id, task, timeout, retries, retryDelay, type } = taskWrapper;
    
    taskWrapper.startTime = Date.now();
    taskWrapper.status = 'running';
    taskWrapper.attempts++;

    // 计算等待时间
    const waitTime = taskWrapper.startTime - taskWrapper.createTime;
    this.updateAverageWaitTime(waitTime);

    try {
      // 执行任务（带超时控制）
      const result = await this.executeWithTimeout(task, timeout);
      
      taskWrapper.endTime = Date.now();
      taskWrapper.status = 'completed';
      
      // 更新统计信息
      this.updateTaskStats(taskWrapper, true);
      
      taskWrapper.resolve(result);

    } catch (error) {
      taskWrapper.endTime = Date.now();
      
      // 检查是否需要重试
      if (taskWrapper.attempts < retries && this.shouldRetry(error)) {
        console.warn(`任务 ${id} 执行失败，准备重试 (${taskWrapper.attempts}/${retries}):`, error.message);
        
        // 延迟后重试
        setTimeout(() => {
          taskWrapper.status = 'pending';
          taskWrapper.startTime = null;
          const queue = this.taskQueues.get(type);
          this.insertTaskByPriority(queue, taskWrapper);
          this.updateQueueSize(type);
          this.processQueue(type);
        }, retryDelay * taskWrapper.attempts); // 指数退避
        
        return;
      }

      // 重试耗尽，标记为失败
      taskWrapper.status = 'failed';
      this.updateTaskStats(taskWrapper, false);
      
      errorHandler.handleError(error, {
        context: 'ConcurrentProcessor.executeTask',
        level: 'warning',
        extra: { taskId: id, type, attempts: taskWrapper.attempts }
      });

      taskWrapper.reject(error);
    }
  }

  /**
   * 带超时执行任务
   */
  async executeWithTimeout(task, timeout) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`任务执行超时 (${timeout}ms)`));
      }, timeout);

      Promise.resolve(task())
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * 判断是否应该重试
   */
  shouldRetry(error) {
    // 网络错误、超时错误等可以重试
    const retryableErrors = [
      'timeout',
      'network',
      'ECONNRESET',
      'ENOTFOUND',
      'ECONNREFUSED'
    ];

    const errorMessage = error.message.toLowerCase();
    return retryableErrors.some(keyword => errorMessage.includes(keyword));
  }

  /**
   * 更新任务统计信息
   */
  updateTaskStats(taskWrapper, success) {
    const { type, startTime, endTime } = taskWrapper;
    const executionTime = endTime - startTime;

    if (success) {
      this.stats.completedTasks++;
    } else {
      this.stats.failedTasks++;
    }

    // 更新平均执行时间
    const completedCount = this.stats.completedTasks;
    if (completedCount > 0) {
      this.stats.averageExecutionTime = (
        (this.stats.averageExecutionTime * (completedCount - 1) + executionTime) 
        / completedCount
      );
    }

    // 更新类型统计
    const typeStats = this.stats.typeStats.get(type);
    if (typeStats) {
      if (success) {
        typeStats.executed++;
        typeStats.avgTime = (
          (typeStats.avgTime * (typeStats.executed - 1) + executionTime)
          / typeStats.executed
        );
      } else {
        typeStats.failed++;
      }
      typeStats.lastExecuted = Date.now();
    }

    // 更新自适应控制性能窗口
    if (this.adaptiveControl.enabled) {
      this.updatePerformanceWindow(type, executionTime, success);
    }

    // 防抖记录统计
    this.debouncedStatsLog();
  }

  /**
   * 更新平均等待时间
   */
  updateAverageWaitTime(waitTime) {
    const totalTasks = this.stats.totalTasks;
    if (totalTasks > 0) {
      this.stats.averageWaitTime = (
        (this.stats.averageWaitTime * (totalTasks - 1) + waitTime)
        / totalTasks
      );
    }
  }

  /**
   * 更新队列大小统计
   */
  updateQueueSize(type) {
    const queue = this.taskQueues.get(type);
    this.stats.queueSizes.set(type, queue ? queue.length : 0);
  }

  /**
   * 批量处理任务
   * @param {string} type - 任务类型
   * @param {Array} tasks - 任务数组
   * @param {Object} options - 选项
   * @returns {Promise<Array>} 批量执行结果
   */
  async batch(type, tasks, options = {}) {
    try {
      const {
        concurrent = this.concurrencyLimits.get(type) || this.config.maxConcurrency,
        failFast = false
      } = options;

      if (!Array.isArray(tasks) || tasks.length === 0) {
        return [];
      }

      // 分批处理
      const batches = this.createBatches(tasks, concurrent);
      const results = [];

      for (const batch of batches) {
        const batchPromises = batch.map(task => 
          this.addTask(type, task, options)
        );

        if (failFast) {
          // 快速失败模式
          const batchResults = await Promise.all(batchPromises);
          results.push(...batchResults);
        } else {
          // 容错模式
          const batchResults = await Promise.allSettled(batchPromises);
          results.push(...batchResults);
        }
      }

      return results;

    } catch (error) {
      errorHandler.handleError(error, {
        context: 'ConcurrentProcessor.batch',
        level: 'error',
        extra: { type, taskCount: tasks.length }
      });
      throw error;
    }
  }

  /**
   * 创建批次
   */
  createBatches(tasks, batchSize) {
    const batches = [];
    for (let i = 0; i < tasks.length; i += batchSize) {
      batches.push(tasks.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * 取消任务
   * @param {string} taskId - 任务ID
   * @returns {boolean} 是否取消成功
   */
  cancelTask(taskId) {
    try {
      for (const [type, queue] of this.taskQueues) {
        const taskIndex = queue.findIndex(task => task.id === taskId);
        if (taskIndex !== -1) {
          const task = queue.splice(taskIndex, 1)[0];
          task.status = 'cancelled';
          task.reject(new Error('任务已取消'));
          this.stats.cancelledTasks++;
          this.updateQueueSize(type);
          return true;
        }
      }
      return false;
    } catch (error) {
      errorHandler.handleError(error, {
        context: 'ConcurrentProcessor.cancelTask',
        level: 'warning',
        extra: { taskId }
      });
      return false;
    }
  }

  /**
   * 取消类型的所有任务
   * @param {string} type - 任务类型
   * @returns {number} 取消的任务数量
   */
  cancelTasksByType(type) {
    try {
      const queue = this.taskQueues.get(type);
      if (!queue) return 0;

      const cancelledCount = queue.length;
      queue.forEach(task => {
        task.status = 'cancelled';
        task.reject(new Error('任务已取消'));
      });

      queue.length = 0;
      this.stats.cancelledTasks += cancelledCount;
      this.updateQueueSize(type);

      return cancelledCount;
    } catch (error) {
      errorHandler.handleError(error, {
        context: 'ConcurrentProcessor.cancelTasksByType',
        level: 'warning',
        extra: { type }
      });
      return 0;
    }
  }

  /**
   * 启动自适应并发控制
   */
  startAdaptiveControl() {
    if (!this.adaptiveControl.enabled) return;

    setInterval(() => {
      this.throttledAdjustConcurrency();
    }, this.adaptiveControl.adjustmentInterval);
  }

  /**
   * 调整并发数
   */
  adjustConcurrency() {
    if (!this.adaptiveControl.enabled) return;

    const now = Date.now();
    if (now - this.adaptiveControl.lastAdjustment < this.adaptiveControl.adjustmentInterval) {
      return;
    }

    try {
      for (const [type, stats] of this.stats.typeStats) {
        const currentLimit = this.concurrencyLimits.get(type);
        const queueSize = this.stats.queueSizes.get(type) || 0;
        const avgTime = stats.avgTime || 0;

        let newLimit = currentLimit;

        // 如果队列积压且性能良好，增加并发
        if (queueSize > 5 && avgTime < 5000) { // 队列超过5个任务且平均执行时间小于5秒
          newLimit = Math.min(currentLimit + 1, 10); // 最大10个并发
        }
        // 如果执行时间过长，减少并发
        else if (avgTime > 10000) { // 平均执行时间超过10秒
          newLimit = Math.max(currentLimit - 1, 1); // 最小1个并发
        }

        if (newLimit !== currentLimit) {
          this.setLimit(type, newLimit);
          console.log(`自适应调整 ${type} 并发数: ${currentLimit} -> ${newLimit}`);
        }
      }

      this.adaptiveControl.lastAdjustment = now;

    } catch (error) {
      errorHandler.handleError(error, {
        context: 'ConcurrentProcessor.adjustConcurrency',
        level: 'warning'
      });
    }
  }

  /**
   * 更新性能窗口
   */
  updatePerformanceWindow(type, executionTime, success) {
    const window = this.adaptiveControl.performanceWindow;
    
    window.push({
      type,
      time: executionTime,
      success,
      timestamp: Date.now()
    });

    // 保持窗口大小
    if (window.length > this.adaptiveControl.windowSize) {
      window.shift();
    }
  }

  /**
   * 生成任务ID
   */
  generateTaskId() {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 获取队列状态
   * @param {string} type - 任务类型（可选）
   * @returns {Object} 队列状态
   */
  getQueueStatus(type = null) {
    if (type) {
      const queue = this.taskQueues.get(type);
      const activeKey = `${type}_active`;
      return {
        type,
        queueLength: queue ? queue.length : 0,
        activeTasksCount: this.activeTasks.get(activeKey) || 0,
        concurrencyLimit: this.concurrencyLimits.get(type) || 0
      };
    }

    const status = {};
    for (const [queueType] of this.taskQueues) {
      status[queueType] = this.getQueueStatus(queueType);
    }
    return status;
  }

  /**
   * 获取所有队列状态
   */
  static getAllQueueStatus() {
    if (this.instance) {
      return this.instance.getQueueStatus();
    }
    return {};
  }

  /**
   * 记录统计信息
   */
  logStats() {
    if (!this.config.enableMetrics) return;

    const totalTasks = this.stats.totalTasks;
    const successRate = totalTasks > 0 ? (this.stats.completedTasks / totalTasks) * 100 : 0;

    console.log('并发处理统计:', {
      totalTasks,
      completed: this.stats.completedTasks,
      failed: this.stats.failedTasks,
      cancelled: this.stats.cancelledTasks,
      successRate: `${successRate.toFixed(2)}%`,
      avgExecutionTime: `${this.stats.averageExecutionTime.toFixed(0)}ms`,
      avgWaitTime: `${this.stats.averageWaitTime.toFixed(0)}ms`,
      peakConcurrency: this.stats.peakConcurrency,
      activeQueues: Array.from(this.stats.queueSizes.entries())
        .filter(([, size]) => size > 0)
        .length
    });
  }

  /**
   * 获取详细统计信息
   */
  getStats() {
    return {
      summary: deepClone(this.stats),
      queues: this.getQueueStatus(),
      limits: Object.fromEntries(this.concurrencyLimits),
      config: deepClone(this.config),
      adaptive: deepClone(this.adaptiveControl)
    };
  }

  /**
   * 暂停所有队列处理
   */
  pauseAll() {
    // 实现暂停逻辑
    this.config.paused = true;
  }

  /**
   * 恢复所有队列处理
   */
  resumeAll() {
    this.config.paused = false;
    // 触发所有队列处理
    for (const type of this.taskQueues.keys()) {
      this.processQueue(type);
    }
  }

  /**
   * 清空所有队列
   */
  clearAll() {
    try {
      let cancelledCount = 0;
      
      for (const [type, queue] of this.taskQueues) {
        queue.forEach(task => {
          task.status = 'cancelled';
          task.reject(new Error('队列已清空'));
        });
        cancelledCount += queue.length;
        queue.length = 0;
        this.updateQueueSize(type);
      }

      this.stats.cancelledTasks += cancelledCount;
      console.log(`已清空所有队列，取消了 ${cancelledCount} 个任务`);

    } catch (error) {
      errorHandler.handleError(error, {
        context: 'ConcurrentProcessor.clearAll',
        level: 'warning'
      });
    }
  }

  /**
   * 重置统计信息
   */
  resetStats() {
    this.stats = {
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      cancelledTasks: 0,
      averageExecutionTime: 0,
      averageWaitTime: 0,
      peakConcurrency: 0,
      queueSizes: new Map(),
      typeStats: new Map()
    };

    // 重新初始化类型统计
    for (const type of this.taskQueues.keys()) {
      this.stats.queueSizes.set(type, 0);
      this.stats.typeStats.set(type, {
        executed: 0,
        failed: 0,
        avgTime: 0,
        lastExecuted: 0
      });
    }

    console.log('并发处理统计已重置');
  }

  /**
   * 销毁处理器
   */
  destroy() {
    try {
      this.clearAll();
      this.taskQueues.clear();
      this.activeTasks.clear();
      this.concurrencyLimits.clear();
      this.adaptiveControl.enabled = false;
      
      console.log('并发处理器已销毁');
    } catch (error) {
      errorHandler.handleError(error, {
        context: 'ConcurrentProcessor.destroy',
        level: 'warning'
      });
    }
  }
}

// 创建单例实例
const concurrentProcessor = new ConcurrentProcessor();

export default concurrentProcessor; 