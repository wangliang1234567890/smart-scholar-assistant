/**
 * 用户体验管理工具 - 全局UX管理
 * 统一处理加载状态、错误反馈、用户提示和界面交互
 * 优化点：统一错误处理、友好用户反馈、智能加载状态、无障碍支持
 */

import { errorHandler } from './error-handler';
import { debounce, throttle, deepClone } from './common';

class UXManager {
  constructor() {
    // 基础配置
    this.config = {
      enableHapticFeedback: true, // 触觉反馈
      enableSoundFeedback: false, // 声音反馈
      autoHideToast: true, // 自动隐藏提示
      toastDuration: 2000, // 提示持续时间
      maxRetryAttempts: 3, // 最大重试次数
      enableAccessibility: true, // 无障碍支持
      enableAnalytics: true // 用户行为分析
    };

    // 状态管理
    this.state = {
      loadingStates: new Map(), // 页面加载状态
      errorStates: new Map(), // 错误状态
      toastQueue: [], // 提示队列
      isProcessingToast: false,
      currentPage: '',
      userInteractions: [] // 用户交互记录
    };

    // 消息模板
    this.messageTemplates = {
      loading: {
        default: '加载中...',
        upload: '上传中...',
        download: '下载中...',
        processing: '处理中...',
        saving: '保存中...',
        analyzing: '分析中...',
        recognizing: '识别中...',
        generating: '生成中...'
      },
      success: {
        save: '保存成功',
        delete: '删除成功',
        upload: '上传成功',
        update: '更新成功',
        complete: '操作完成',
        submit: '提交成功'
      },
      error: {
        network: '网络连接失败，请检查网络后重试',
        timeout: '操作超时，请重试',
        server: '服务器错误，请稍后重试',
        permission: '权限不足，请联系管理员',
        notFound: '找不到相关内容',
        validation: '输入信息有误，请检查后重试',
        unknown: '操作失败，请重试'
      },
      warning: {
        unsaved: '有未保存的内容，确定要离开吗？',
        delete: '确定要删除这个项目吗？',
        clear: '确定要清空所有数据吗？',
        reset: '确定要重置设置吗？'
      }
    };

    // 错误分类
    this.errorCategories = {
      network: ['NETWORK_ERROR', 'ECONNRESET', 'ENOTFOUND', 'timeout'],
      permission: ['PERMISSION_DENIED', 'AUTH_ERROR', 'UNAUTHORIZED'],
      validation: ['INVALID_PARAMS', 'VALIDATION_ERROR', 'MISSING_REQUIRED'],
      server: ['SERVER_ERROR', 'INTERNAL_ERROR', 'SERVICE_UNAVAILABLE'],
      client: ['CLIENT_ERROR', 'INVALID_OPERATION', 'STATE_ERROR']
    };

    // 防抖和节流函数
    this.debouncedToast = debounce(this.processToastQueue.bind(this), 100);
    this.throttledAnalytics = throttle(this.recordUserInteraction.bind(this), 1000);

    this.init();
  }

  /**
   * 初始化UX管理器
   */
  init() {
    try {
      // 监听页面生命周期
      this.setupPageLifecycleMonitoring();
      
      // 设置错误边界
      this.setupGlobalErrorHandling();
      
      console.log('UX管理器初始化完成');
    } catch (error) {
      errorHandler.handle(error, {
        context: 'UXManager.init',
        level: 'warning'
      });
    }
  }

  /**
   * 设置页面生命周期监控
   */
  setupPageLifecycleMonitoring() {
    // 监听页面路由变化
    const originalNavigateTo = wx.navigateTo;
    const originalRedirectTo = wx.redirectTo;
    const originalSwitchTab = wx.switchTab;

    wx.navigateTo = (options) => {
      this.onPageNavigation('navigateTo', options.url);
      return originalNavigateTo.call(wx, options);
    };

    wx.redirectTo = (options) => {
      this.onPageNavigation('redirectTo', options.url);
      return originalRedirectTo.call(wx, options);
    };

    wx.switchTab = (options) => {
      this.onPageNavigation('switchTab', options.url);
      return originalSwitchTab.call(wx, options);
    };
  }

  /**
   * 设置全局错误处理
   */
  setupGlobalErrorHandling() {
    // 监听未处理的Promise rejection
    wx.onUnhandledRejection && wx.onUnhandledRejection((res) => {
      this.handleGlobalError(res.reason);
    });

    // 监听JS错误
    wx.onError && wx.onError((error) => {
      this.handleGlobalError(error);
    });
  }

  /**
   * 页面导航事件处理
   */
  onPageNavigation(type, url) {
    this.state.currentPage = url;
    
    // 清理当前页面的状态
    this.clearPageStates();
    
    // 记录用户行为
    this.recordUserInteraction('navigation', {
      type,
      url,
      timestamp: Date.now()
    });
  }

  /**
   * 显示加载状态
   * @param {string} key - 加载状态标识
   * @param {Object} options - 配置选项
   */
  showLoading(key = 'default', options = {}) {
    const {
      title = this.messageTemplates.loading.default,
      mask = true,
      duration = 0,
      page = this.state.currentPage
    } = options;

    try {
      // 记录加载状态
      this.state.loadingStates.set(key, {
        title,
        startTime: Date.now(),
        page,
        duration
      });

      // 显示加载框
      wx.showLoading({
        title,
        mask
      });

      // 如果设置了持续时间，自动隐藏
      if (duration > 0) {
        setTimeout(() => {
          this.hideLoading(key);
        }, duration);
      }

      // 触觉反馈
      if (this.config.enableHapticFeedback) {
        wx.vibrateShort && wx.vibrateShort({ type: 'light' });
      }

    } catch (error) {
      errorHandler.handleError(error, {
        context: 'UXManager.showLoading',
        level: 'warning'
      });
    }
  }

  /**
   * 隐藏加载状态
   * @param {string} key - 加载状态标识
   */
  hideLoading(key = 'default') {
    try {
      const loadingState = this.state.loadingStates.get(key);
      if (!loadingState) {
        return;
      }

      // 计算加载时间
      const loadingTime = Date.now() - loadingState.startTime;
      
      // 移除加载状态
      this.state.loadingStates.delete(key);

      // 如果没有其他加载状态，隐藏加载框
      if (this.state.loadingStates.size === 0) {
        wx.hideLoading();
      }

      // 记录加载时间
      this.recordUserInteraction('loading_complete', {
        key,
        duration: loadingTime,
        timestamp: Date.now()
      });

    } catch (error) {
      errorHandler.handleError(error, {
        context: 'UXManager.hideLoading',
        level: 'warning'
      });
    }
  }

  /**
   * 显示成功提示
   * @param {string} message - 提示消息
   * @param {Object} options - 配置选项
   */
  showSuccess(message, options = {}) {
    const {
      duration = this.config.toastDuration,
      icon = 'success',
      haptic = true
    } = options;

    this.showToast({
      title: message,
      icon,
      duration,
      haptic,
      type: 'success'
    });
  }

  /**
   * 显示错误提示
   * @param {string|Error} error - 错误信息或错误对象
   * @param {Object} options - 配置选项
   */
  showError(error, options = {}) {
    const {
      duration = this.config.toastDuration,
      allowRetry = false,
      retryCallback = null
    } = options;

    // 处理错误信息
    const errorMessage = this.formatErrorMessage(error);
    
    // 记录错误
    this.recordError(error, errorMessage);

    if (allowRetry && retryCallback) {
      // 显示可重试的错误对话框
      this.showRetryDialog(errorMessage, retryCallback);
    } else {
      // 显示普通错误提示
      this.showToast({
        title: errorMessage,
        icon: 'none',
        duration,
        haptic: true,
        type: 'error'
      });
    }
  }

  /**
   * 显示警告提示
   * @param {string} message - 警告消息
   * @param {Object} options - 配置选项
   */
  showWarning(message, options = {}) {
    const {
      duration = this.config.toastDuration,
      confirmCallback = null,
      cancelCallback = null
    } = options;

    if (confirmCallback) {
      // 显示确认对话框
      this.showConfirmDialog(message, confirmCallback, cancelCallback);
    } else {
      // 显示普通警告
      this.showToast({
        title: message,
        icon: 'none',
        duration,
        haptic: true,
        type: 'warning'
      });
    }
  }

  /**
   * 显示Toast提示
   * @param {Object} options - Toast选项
   */
  showToast(options) {
    const {
      title,
      icon = 'none',
      duration = this.config.toastDuration,
      haptic = false,
      type = 'info',
      mask = false
    } = options;

    // 添加到队列
    this.state.toastQueue.push({
      title,
      icon,
      duration,
      mask,
      haptic,
      type,
      timestamp: Date.now()
    });

    // 防抖处理队列
    this.debouncedToast();
  }

  /**
   * 处理Toast队列
   */
  async processToastQueue() {
    if (this.state.isProcessingToast || this.state.toastQueue.length === 0) {
      return;
    }

    this.state.isProcessingToast = true;

    try {
      const toast = this.state.toastQueue.shift();
      
      // 触觉反馈
      if (toast.haptic && this.config.enableHapticFeedback) {
        this.triggerHapticFeedback(toast.type);
      }

      // 显示Toast
      wx.showToast({
        title: toast.title,
        icon: toast.icon,
        duration: toast.duration,
        mask: toast.mask
      });

      // 等待Toast消失
      if (this.config.autoHideToast) {
        await new Promise(resolve => setTimeout(resolve, toast.duration));
      }

      // 处理下一个Toast
      if (this.state.toastQueue.length > 0) {
        setTimeout(() => {
          this.state.isProcessingToast = false;
          this.processToastQueue();
        }, 100);
      } else {
        this.state.isProcessingToast = false;
      }

    } catch (error) {
      this.state.isProcessingToast = false;
      errorHandler.handleError(error, {
        context: 'UXManager.processToastQueue',
        level: 'warning'
      });
    }
  }

  /**
   * 显示确认对话框
   * @param {string} content - 对话框内容
   * @param {Function} confirmCallback - 确认回调
   * @param {Function} cancelCallback - 取消回调
   */
  showConfirmDialog(content, confirmCallback, cancelCallback) {
    wx.showModal({
      title: '确认',
      content,
      confirmText: '确定',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm && confirmCallback) {
          confirmCallback();
        } else if (res.cancel && cancelCallback) {
          cancelCallback();
        }
      },
      fail: (error) => {
        errorHandler.handleError(error, {
          context: 'UXManager.showConfirmDialog',
          level: 'warning'
        });
      }
    });
  }

  /**
   * 显示重试对话框
   * @param {string} errorMessage - 错误消息
   * @param {Function} retryCallback - 重试回调
   */
  showRetryDialog(errorMessage, retryCallback) {
    wx.showModal({
      title: '操作失败',
      content: `${errorMessage}\n\n是否重试？`,
      confirmText: '重试',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm && retryCallback) {
          retryCallback();
        }
      }
    });
  }

  /**
   * 显示操作选择对话框
   * @param {Array} actions - 操作列表
   * @param {Function} callback - 选择回调
   */
  showActionSheet(actions, callback) {
    wx.showActionSheet({
      itemList: actions.map(action => action.name || action),
      success: (res) => {
        if (callback) {
          callback(res.tapIndex, actions[res.tapIndex]);
        }
      },
      fail: (error) => {
        if (error.errMsg !== 'showActionSheet:fail cancel') {
          errorHandler.handleError(error, {
            context: 'UXManager.showActionSheet',
            level: 'warning'
          });
        }
      }
    });
  }

  /**
   * 处理全局错误
   * @param {Error} error - 错误对象
   */
  handleGlobalError(error) {
    try {
      // 分类错误
      const errorCategory = this.categorizeError(error);
      
      // 格式化错误消息
      const errorMessage = this.formatErrorMessage(error);
      
      // 记录错误
      this.recordError(error, errorMessage);
      
      // 根据错误类型决定处理策略
      switch (errorCategory) {
        case 'network':
          this.handleNetworkError(error);
          break;
        case 'permission':
          this.handlePermissionError(error);
          break;
        case 'validation':
          this.handleValidationError(error);
          break;
        default:
          this.handleGenericError(error);
          break;
      }

    } catch (handlingError) {
      console.error('处理全局错误时出错:', handlingError);
    }
  }

  /**
   * 格式化错误消息
   * @param {string|Error} error - 错误信息
   * @returns {string} 格式化后的错误消息
   */
  formatErrorMessage(error) {
    if (typeof error === 'string') {
      return error;
    }

    if (error && error.message) {
      // 检查是否有友好的错误消息
      const category = this.categorizeError(error);
      if (this.messageTemplates.error[category]) {
        return this.messageTemplates.error[category];
      }
      
      // 处理常见错误
      const message = error.message.toLowerCase();
      if (message.includes('network') || message.includes('timeout')) {
        return this.messageTemplates.error.network;
      }
      if (message.includes('permission') || message.includes('auth')) {
        return this.messageTemplates.error.permission;
      }
      if (message.includes('not found')) {
        return this.messageTemplates.error.notFound;
      }
      
      return error.message;
    }

    return this.messageTemplates.error.unknown;
  }

  /**
   * 错误分类
   * @param {Error} error - 错误对象
   * @returns {string} 错误类别
   */
  categorizeError(error) {
    const errorCode = error.code || error.type || '';
    const errorMessage = error.message || '';

    for (const [category, keywords] of Object.entries(this.errorCategories)) {
      if (keywords.some(keyword => 
        errorCode.includes(keyword) || errorMessage.toLowerCase().includes(keyword)
      )) {
        return category;
      }
    }

    return 'unknown';
  }

  /**
   * 处理网络错误
   */
  handleNetworkError(error) {
    this.showError(this.messageTemplates.error.network, {
      allowRetry: true,
      retryCallback: () => {
        // 重新加载当前页面数据
        this.retryCurrentOperation();
      }
    });
  }

  /**
   * 处理权限错误
   */
  handlePermissionError(error) {
    this.showError(this.messageTemplates.error.permission);
    
    // 可能需要重新登录
    setTimeout(() => {
      wx.showModal({
        title: '权限不足',
        content: '请重新登录后再试',
        confirmText: '去登录',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({
              url: '/pages/login/login'
            });
          }
        }
      });
    }, 1000);
  }

  /**
   * 处理验证错误
   */
  handleValidationError(error) {
    this.showError(this.messageTemplates.error.validation);
  }

  /**
   * 处理通用错误
   */
  handleGenericError(error) {
    this.showError(error);
  }

  /**
   * 重试当前操作
   */
  retryCurrentOperation() {
    // 这里可以实现重试逻辑
    // 具体实现取决于当前页面和操作类型
    const pages = getCurrentPages();
    const currentPage = pages[pages.length - 1];
    
    if (currentPage && typeof currentPage.onRetry === 'function') {
      currentPage.onRetry();
    } else if (currentPage && typeof currentPage.onPullDownRefresh === 'function') {
      currentPage.onPullDownRefresh();
    }
  }

  /**
   * 触发触觉反馈
   * @param {string} type - 反馈类型
   */
  triggerHapticFeedback(type) {
    if (!this.config.enableHapticFeedback || !wx.vibrateShort) {
      return;
    }

    try {
      switch (type) {
        case 'success':
          wx.vibrateShort({ type: 'light' });
          break;
        case 'error':
          wx.vibrateShort({ type: 'medium' });
          break;
        case 'warning':
          wx.vibrateShort({ type: 'heavy' });
          break;
        default:
          wx.vibrateShort({ type: 'light' });
      }
    } catch (error) {
      // 静默处理触觉反馈错误
    }
  }

  /**
   * 记录用户交互
   * @param {string} action - 操作类型
   * @param {Object} data - 操作数据
   */
  recordUserInteraction(action, data) {
    if (!this.config.enableAnalytics) {
      return;
    }

    const interaction = {
      action,
      data,
      timestamp: Date.now(),
      page: this.state.currentPage
    };

    this.state.userInteractions.push(interaction);

    // 限制记录数量
    if (this.state.userInteractions.length > 1000) {
      this.state.userInteractions = this.state.userInteractions.slice(-500);
    }
  }

  /**
   * 记录错误
   * @param {Error} error - 错误对象
   * @param {string} message - 错误消息
   */
  recordError(error, message) {
    const errorRecord = {
      error: {
        code: error.code,
        message: error.message,
        stack: error.stack
      },
      formattedMessage: message,
      timestamp: Date.now(),
      page: this.state.currentPage,
      userAgent: wx.getSystemInfoSync()
    };

    this.state.errorStates.set(Date.now().toString(), errorRecord);
  }

  /**
   * 清理页面状态
   */
  clearPageStates() {
    // 清理当前页面的加载状态
    for (const [key, state] of this.state.loadingStates) {
      if (state.page === this.state.currentPage) {
        this.state.loadingStates.delete(key);
      }
    }

    // 隐藏加载框
    wx.hideLoading();
    
    // 隐藏Toast
    wx.hideToast();
  }

  /**
   * 获取页面加载状态
   * @param {string} key - 状态标识
   * @returns {boolean} 是否正在加载
   */
  isLoading(key = 'default') {
    return this.state.loadingStates.has(key);
  }

  /**
   * 获取UX统计信息
   * @returns {Object} 统计信息
   */
  getStats() {
    return {
      loadingStates: this.state.loadingStates.size,
      errorStates: this.state.errorStates.size,
      toastQueue: this.state.toastQueue.length,
      userInteractions: this.state.userInteractions.length,
      currentPage: this.state.currentPage
    };
  }

  /**
   * 重置UX管理器
   */
  reset() {
    this.state.loadingStates.clear();
    this.state.errorStates.clear();
    this.state.toastQueue = [];
    this.state.userInteractions = [];
    this.state.isProcessingToast = false;
    
    console.log('UX管理器已重置');
  }

  /**
   * 销毁UX管理器
   */
  destroy() {
    this.reset();
    this.clearPageStates();
    console.log('UX管理器已销毁');
  }
}

// 创建单例实例
const uxManager = new UXManager();

export default uxManager; 