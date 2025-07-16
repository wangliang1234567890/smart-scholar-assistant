/**
 * 并发处理工具类
 * 提供任务队列、批量处理、限流等功能
 */

class ConcurrentProcessor {
  constructor() {
    this.taskQueues = new Map(); // 不同类型的任务队列
    this.activeRequests = new Map(); // 活跃请求计数
    this.requestLimits = {
      default: 5,
      ocr: 2,
      ai: 3,
      upload: 2
    };
    
    this.stats = {
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      averageExecutionTime: 0
    };
  }

  /**
   * 添加任务到队列
   * @param {string} type - 任务类型
   * @param {Function} task - 任务函数
   * @param {Object} options - 选项
   * @returns {Promise} 任务执行结果
   */
  async addTask(type = 'default', task, options = {}) {
    const {
      priority = 0,
      timeout = 30000,
      retries = 2,
      retryDelay = 1000
    } = options;

    const taskId = this.generateTaskId();
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
      endTime: null
    };

    // 获取或创建队列
    if (!this.taskQueues.has(type)) {
      this.taskQueues.set(type, []);
    }

    const queue = this.taskQueues.get(type);
    
    // 按优先级插入
    const insertIndex = queue.findIndex(t => t.priority < priority);
    if (insertIndex === -1) {
      queue.push(taskWrapper);
    } else {
      queue.splice(insertIndex, 0, taskWrapper);
    }

    this.stats.totalTasks++;

    // 立即尝试执行
    this.processQueue(type);

    // 返回Promise
    return new Promise((resolve, reject) => {
      taskWrapper.resolve = resolve;
      taskWrapper.reject = reject;
    });
  }

  /**
   * 处理指定类型的队列
   * @param {string} type - 队列类型
   */
  async processQueue(type) {
    const queue = this.taskQueues.get(type);
    if (!queue || queue.length === 0) {
      return;
    }

    const limit = this.requestLimits[type] || this.requestLimits.default;
    const activeCount = this.activeRequests.get(type) || 0;

    if (activeCount >= limit) {
      return; // 达到并发限制
    }

    const task = queue.shift();
    if (!task) {
      return;
    }

    // 增加活跃请求计数
    this.activeRequests.set(type, activeCount + 1);

    try {
      await this.executeTask(task);
    } catch (error) {
      console.error('任务执行失败:', error);
    } finally {
      // 减少活跃请求计数
      const currentCount = this.activeRequests.get(type) || 1;
      this.activeRequests.set(type, Math.max(0, currentCount - 1));
      
      // 继续处理队列
      setImmediate(() => this.processQueue(type));
    }
  }

  /**
   * 执行单个任务
   * @param {Object} taskWrapper - 任务包装器
   */
  async executeTask(taskWrapper) {
    const { task, timeout, retries, retryDelay, resolve, reject } = taskWrapper;
    
    taskWrapper.attempts++;
    taskWrapper.startTime = Date.now();

    try {
      // 设置超时
      const timeoutPromise = new Promise((_, timeoutReject) => {
        setTimeout(() => timeoutReject(new Error('任务执行超时')), timeout);
      });

      // 执行任务
      const result = await Promise.race([
        task(),
        timeoutPromise
      ]);

      taskWrapper.endTime = Date.now();
      this.updateStats(taskWrapper, true);
      resolve(result);

    } catch (error) {
      taskWrapper.endTime = Date.now();
      
      // 重试逻辑
      if (taskWrapper.attempts < retries + 1) {
        console.log(`任务${taskWrapper.id}第${taskWrapper.attempts}次失败，${retryDelay}ms后重试:`, error.message);
        
        setTimeout(() => {
          this.executeTask(taskWrapper);
        }, retryDelay * taskWrapper.attempts); // 指数退避
        
        return;
      }

      // 重试次数用完，失败
      this.updateStats(taskWrapper, false);
      reject(error);
    }
  }

  /**
   * 批量处理任务
   * @param {Array} tasks - 任务数组
   * @param {Object} options - 选项
   * @returns {Promise<Array>} 批量处理结果
   */
  async batchProcess(tasks, options = {}) {
    const {
      type = 'batch',
      batchSize = 5,
      delay = 100
    } = options;

    const results = [];
    const errors = [];

    // 分批处理
    for (let i = 0; i < tasks.length; i += batchSize) {
      const batch = tasks.slice(i, i + batchSize);
      const batchPromises = batch.map((task, index) => 
        this.addTask(type, task, { ...options, priority: tasks.length - i - index })
          .then(result => ({ success: true, result, index: i + index }))
          .catch(error => ({ success: false, error, index: i + index }))
      );

      try {
        const batchResults = await Promise.all(batchPromises);
        
        for (const result of batchResults) {
          if (result.success) {
            results[result.index] = result.result;
          } else {
            errors[result.index] = result.error;
          }
        }

        // 批次间延迟
        if (i + batchSize < tasks.length && delay > 0) {
          await this.delay(delay);
        }

      } catch (error) {
        console.error('批处理失败:', error);
        
        // 记录失败的批次
        for (let j = 0; j < batch.length; j++) {
          errors[i + j] = error;
        }
      }
    }

    return {
      results,
      errors,
      successCount: results.filter(r => r !== undefined).length,
      errorCount: errors.filter(e => e !== undefined).length,
      totalCount: tasks.length
    };
  }

  /**
   * 限流器 - 限制函数调用频率
   * @param {Function} func - 要限流的函数
   * @param {number} maxCalls - 最大调用次数
   * @param {number} window - 时间窗口(毫秒)
   * @returns {Function} 限流后的函数
   */
  throttle(func, maxCalls = 10, window = 1000) {
    const calls = [];
    
    return async (...args) => {
      const now = Date.now();
      
      // 清理过期的调用记录
      while (calls.length > 0 && calls[0] < now - window) {
        calls.shift();
      }
      
      // 检查是否超出限制
      if (calls.length >= maxCalls) {
        const waitTime = calls[0] + window - now;
        await this.delay(waitTime);
        return this.throttle(func, maxCalls, window)(...args);
      }
      
      calls.push(now);
      return await func(...args);
    };
  }

  /**
   * 防抖器 - 限制函数调用频率
   * @param {Function} func - 要防抖的函数
   * @param {number} delay - 延迟时间(毫秒)
   * @returns {Function} 防抖后的函数
   */
  debounce(func, delay = 300) {
    let timeoutId;
    
    return (...args) => {
      clearTimeout(timeoutId);
      
      return new Promise((resolve, reject) => {
        timeoutId = setTimeout(async () => {
          try {
            const result = await func(...args);
            resolve(result);
          } catch (error) {
            reject(error);
          }
        }, delay);
      });
    };
  }

  /**
   * 并发控制装饰器
   * @param {string} type - 任务类型
   * @param {Function} func - 要装饰的函数
   * @param {Object} options - 选项
   * @returns {Function} 装饰后的函数
   */
  concurrent(type, func, options = {}) {
    return (...args) => {
      return this.addTask(type, () => func(...args), options);
    };
  }

  /**
   * 任务管道 - 串联执行多个任务
   * @param {Array} tasks - 任务数组
   * @param {any} initialValue - 初始值
   * @param {Object} options - 选项
   * @returns {Promise} 管道执行结果
   */
  async pipeline(tasks, initialValue, options = {}) {
    const { type = 'pipeline', stopOnError = true } = options;
    
    let result = initialValue;
    const results = [];
    
    for (let i = 0; i < tasks.length; i++) {
      try {
        const task = tasks[i];
        result = await this.addTask(type, () => task(result), {
          ...options,
          priority: tasks.length - i
        });
        results.push({ success: true, result, step: i });
        
      } catch (error) {
        results.push({ success: false, error, step: i });
        
        if (stopOnError) {
          throw error;
        }
      }
    }
    
    return {
      finalResult: result,
      stepResults: results,
      success: results.every(r => r.success)
    };
  }

  /**
   * 重试机制
   * @param {Function} func - 要重试的函数
   * @param {Object} options - 重试选项
   * @returns {Promise} 重试结果
   */
  async retry(func, options = {}) {
    const {
      maxAttempts = 3,
      delay = 1000,
      backoff = 'exponential', // linear, exponential, fixed
      retryCondition = () => true
    } = options;

    let lastError;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await func();
        
      } catch (error) {
        lastError = error;
        
        if (attempt === maxAttempts || !retryCondition(error)) {
          throw error;
        }
        
        // 计算延迟时间
        let retryDelay = delay;
        if (backoff === 'exponential') {
          retryDelay = delay * Math.pow(2, attempt - 1);
        } else if (backoff === 'linear') {
          retryDelay = delay * attempt;
        }
        
        console.log(`重试第${attempt}次，${retryDelay}ms后执行:`, error.message);
        await this.delay(retryDelay);
      }
    }
    
    throw lastError;
  }

  /**
   * 获取队列状态
   * @param {string} type - 队列类型
   * @returns {Object} 队列状态
   */
  getQueueStatus(type) {
    const queue = this.taskQueues.get(type) || [];
    const activeCount = this.activeRequests.get(type) || 0;
    const limit = this.requestLimits[type] || this.requestLimits.default;
    
    return {
      queueSize: queue.length,
      activeRequests: activeCount,
      maxConcurrent: limit,
      utilization: (activeCount / limit) * 100
    };
  }

  /**
   * 获取所有队列状态
   * @returns {Object} 所有队列状态
   */
  getAllQueueStatus() {
    const status = {};
    
    // 获取所有队列类型
    const allTypes = new Set([
      ...this.taskQueues.keys(),
      ...this.activeRequests.keys(),
      ...Object.keys(this.requestLimits)
    ]);
    
    for (const type of allTypes) {
      status[type] = this.getQueueStatus(type);
    }
    
    return {
      queues: status,
      globalStats: this.stats
    };
  }

  /**
   * 设置并发限制
   * @param {string} type - 任务类型
   * @param {number} limit - 并发限制数
   */
  setLimit(type, limit) {
    this.requestLimits[type] = limit;
  }

  /**
   * 清空指定队列
   * @param {string} type - 队列类型
   */
  clearQueue(type) {
    const queue = this.taskQueues.get(type);
    if (queue) {
      // 拒绝所有等待的任务
      queue.forEach(task => {
        if (task.reject) {
          task.reject(new Error('队列已清空'));
        }
      });
      
      this.taskQueues.set(type, []);
    }
  }

  /**
   * 清空所有队列
   */
  clearAllQueues() {
    for (const type of this.taskQueues.keys()) {
      this.clearQueue(type);
    }
  }

  /**
   * 暂停队列处理
   * @param {string} type - 队列类型
   */
  pauseQueue(type) {
    const queue = this.taskQueues.get(type);
    if (queue) {
      queue.paused = true;
    }
  }

  /**
   * 恢复队列处理
   * @param {string} type - 队列类型
   */
  resumeQueue(type) {
    const queue = this.taskQueues.get(type);
    if (queue) {
      queue.paused = false;
      this.processQueue(type);
    }
  }

  /**
   * 更新统计信息
   * @param {Object} taskWrapper - 任务包装器
   * @param {boolean} success - 是否成功
   */
  updateStats(taskWrapper, success) {
    if (success) {
      this.stats.completedTasks++;
    } else {
      this.stats.failedTasks++;
    }
    
    // 更新平均执行时间
    if (taskWrapper.startTime && taskWrapper.endTime) {
      const executionTime = taskWrapper.endTime - taskWrapper.startTime;
      const totalCompleted = this.stats.completedTasks;
      
      this.stats.averageExecutionTime = (
        (this.stats.averageExecutionTime * (totalCompleted - 1) + executionTime) / totalCompleted
      );
    }
  }

  /**
   * 生成任务ID
   * @returns {string} 任务ID
   */
  generateTaskId() {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 延迟函数
   * @param {number} ms - 延迟毫秒数
   * @returns {Promise} Promise对象
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 销毁处理器
   */
  destroy() {
    this.clearAllQueues();
    this.taskQueues.clear();
    this.activeRequests.clear();
  }
}

// 导出单例
export default new ConcurrentProcessor(); 