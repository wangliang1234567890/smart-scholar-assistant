/**
 * 统一错误处理工具类
 * 提供标准化的错误处理和用户反馈机制
 */

import { ERROR_CODES } from './constants';

class ErrorHandler {
  constructor() {
    this.errorHistory = [];
    this.maxHistorySize = 50;
  }

  /**
   * 处理业务错误
   * @param {Error|string} error - 错误对象或错误信息
   * @param {Object} options - 配置选项
   * @param {boolean} options.showToast - 是否显示Toast提示
   * @param {boolean} options.logError - 是否记录错误日志
   * @param {string} options.scene - 错误场景
   * @returns {Object} 标准化错误对象
   */
  handle(error, options = {}) {
    const {
      showToast = true,
      logError = true,
      scene = 'unknown'
    } = options;

    // 标准化错误对象
    const standardError = this.standardizeError(error, scene);

    // 记录错误日志
    if (logError) {
      this.logError(standardError);
    }

    // 显示用户提示
    if (showToast) {
      this.showUserFeedback(standardError);
    }

    return standardError;
  }

  /**
   * 标准化错误对象
   * @param {Error|string} error - 原始错误
   * @param {string} scene - 错误场景
   * @returns {Object} 标准化错误对象
   */
  standardizeError(error, scene) {
    let standardError = {
      code: ERROR_CODES.UNKNOWN_ERROR,
      message: '未知错误',
      userMessage: '操作失败，请稍后重试',
      scene: scene,
      timestamp: Date.now(),
      stack: null
    };

    if (typeof error === 'string') {
      standardError.message = error;
      standardError.userMessage = this.getUserFriendlyMessage(error);
    } else if (error instanceof Error) {
      standardError.message = error.message;
      standardError.stack = error.stack;
      standardError.code = error.code || ERROR_CODES.UNKNOWN_ERROR;
      standardError.userMessage = this.getUserFriendlyMessage(error.message);
    } else if (typeof error === 'object') {
      // 微信小程序错误对象
      standardError.code = error.errCode || error.errno || ERROR_CODES.UNKNOWN_ERROR;
      standardError.message = error.errMsg || error.message || '未知错误';
      standardError.userMessage = this.getUserFriendlyMessage(standardError.message);
    }

    return standardError;
  }

  /**
   * 获取用户友好的错误信息
   * @param {string} originalMessage - 原始错误信息
   * @returns {string} 用户友好的错误信息
   */
  getUserFriendlyMessage(originalMessage) {
    const messageMap = {
      'network error': '网络连接失败，请检查网络设置',
      'timeout': '操作超时，请稍后重试',
      'permission denied': '权限不足，请检查授权设置',
      'invalid params': '参数错误，请检查输入内容',
      'server error': '服务器异常，请稍后重试',
      '云函数不存在': 'AI服务暂时不可用，请稍后重试',
      '云函数执行超时': 'AI处理超时，请稍后重试',
      '云函数执行异常': 'AI服务异常，请稍后重试',
      '存储功能异常': '本地存储异常，请重启应用',
      '获取网络状态失败': '网络状态检测失败',
      '添加错题失败': '添加错题失败，请稍后重试',
      '获取错题列表失败': '获取错题列表失败，请稍后重试',
      '保存练习记录失败': '保存练习记录失败，请稍后重试'
    };

    // 检查是否有匹配的友好信息
    for (const [key, value] of Object.entries(messageMap)) {
      if (originalMessage.includes(key)) {
        return value;
      }
    }

    // 默认友好信息
    return '操作失败，请稍后重试';
  }

  /**
   * 记录错误日志
   * @param {Object} error - 标准化错误对象
   */
  logError(error) {
    // 添加到错误历史
    this.errorHistory.push(error);
    
    // 限制历史记录大小
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory.shift();
    }

    // 控制台输出
    console.error(`[${error.scene}] ${error.message}`, {
      code: error.code,
      timestamp: error.timestamp,
      stack: error.stack
    });

    // 持久化关键错误
    if (this.isCriticalError(error)) {
      this.persistError(error);
    }
  }

  /**
   * 判断是否为关键错误
   * @param {Object} error - 错误对象
   * @returns {boolean} 是否为关键错误
   */
  isCriticalError(error) {
    const criticalCodes = [
      ERROR_CODES.AUTH_EXPIRED,
      ERROR_CODES.PERMISSION_DENIED,
      ERROR_CODES.SERVER_ERROR
    ];
    
    return criticalCodes.includes(error.code) || 
           error.message.includes('云函数') ||
           error.message.includes('存储功能异常');
  }

  /**
   * 持久化错误信息
   * @param {Object} error - 错误对象
   */
  persistError(error) {
    try {
      const persistedErrors = wx.getStorageSync('critical_errors') || [];
      persistedErrors.push(error);
      
      // 只保留最近10个关键错误
      if (persistedErrors.length > 10) {
        persistedErrors.shift();
      }
      
      wx.setStorageSync('critical_errors', persistedErrors);
    } catch (e) {
      console.error('持久化错误失败:', e);
    }
  }

  /**
   * 显示用户反馈
   * @param {Object} error - 错误对象
   */
  showUserFeedback(error) {
    // 根据错误严重程度选择反馈方式
    if (this.isCriticalError(error)) {
      wx.showModal({
        title: '操作失败',
        content: error.userMessage,
        showCancel: false,
        confirmText: '我知道了'
      });
    } else {
      wx.showToast({
        title: error.userMessage,
        icon: 'none',
        duration: 2000,
        mask: false
      });
    }
  }

  /**
   * 清除错误历史
   */
  clearHistory() {
    this.errorHistory = [];
    try {
      wx.removeStorageSync('critical_errors');
    } catch (e) {
      console.error('清除错误历史失败:', e);
    }
  }

  /**
   * 获取错误统计
   * @returns {Object} 错误统计信息
   */
  getErrorStats() {
    const stats = {
      total: this.errorHistory.length,
      critical: 0,
      byScene: {},
      byCode: {},
      recent: this.errorHistory.slice(-5)
    };

    this.errorHistory.forEach(error => {
      // 统计关键错误
      if (this.isCriticalError(error)) {
        stats.critical++;
      }

      // 按场景统计
      stats.byScene[error.scene] = (stats.byScene[error.scene] || 0) + 1;

      // 按错误码统计
      stats.byCode[error.code] = (stats.byCode[error.code] || 0) + 1;
    });

    return stats;
  }

  /**
   * 创建异步操作包装器
   * @param {Function} asyncFn - 异步函数
   * @param {Object} options - 配置选项
   * @returns {Function} 包装后的函数
   */
  wrapAsync(asyncFn, options = {}) {
    return async (...args) => {
      try {
        return await asyncFn(...args);
      } catch (error) {
        return this.handle(error, {
          scene: options.scene || 'async_operation',
          ...options
        });
      }
    };
  }
}

// 导出单例
export default new ErrorHandler(); 