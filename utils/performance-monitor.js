/**
 * 性能监控工具
 * 实时收集和分析应用性能数据
 */

import CacheManager from './cache-manager';
import ConcurrentProcessor from './concurrent-processor';
import AIService from './ai-service';

class PerformanceMonitor {
  constructor() {
    this.isMonitoring = false;
    this.monitoringInterval = null;
    this.performanceData = {
      app: {
        startTime: Date.now(),
        launchTime: 0,
        pageLoadTimes: {},
        navigationTimes: {},
        errorCount: 0,
        crashCount: 0
      },
      system: {
        memory: [],
        cpu: [],
        network: [],
        battery: []
      },
      user: {
        actions: [],
        sessions: [],
        preferences: {}
      },
      api: {
        calls: [],
        errors: [],
        latencies: [],
        successRates: {}
      }
    };
    
    this.thresholds = {
      pageLoadTime: 3000,  // 3秒
      apiLatency: 5000,    // 5秒
      memoryUsage: 100,    // 100MB
      errorRate: 0.05      // 5%
    };

    this.initMonitoring();
  }

  /**
   * 初始化监控
   */
  initMonitoring() {
    // 监听应用生命周期
    this.setupAppLifecycleMonitoring();
    
    // 监听页面性能
    this.setupPagePerformanceMonitoring();
    
    // 监听网络状态
    this.setupNetworkMonitoring();
    
    // 监听错误
    this.setupErrorMonitoring();
    
    // 启动定时监控
    this.startPeriodicMonitoring();
  }

  /**
   * 设置应用生命周期监控
   */
  setupAppLifecycleMonitoring() {
    // 监听应用启动
    wx.onAppShow(() => {
      const now = Date.now();
      this.performanceData.app.launchTime = now - this.performanceData.app.startTime;
      this.recordUserAction('app_show', { timestamp: now });
    });

    // 监听应用隐藏
    wx.onAppHide(() => {
      this.recordUserAction('app_hide', { timestamp: Date.now() });
      this.savePerformanceData();
    });

    // 监听内存警告
    wx.onMemoryWarning((res) => {
      this.recordSystemEvent('memory_warning', {
        level: res.level,
        timestamp: Date.now()
      });
    });
  }

  /**
   * 设置页面性能监控
   */
  setupPagePerformanceMonitoring() {
    const originalPage = Page;
    const self = this;
    
    Page = function(options) {
      const originalOnLoad = options.onLoad;
      const originalOnShow = options.onShow;
      const originalOnReady = options.onReady;
      
      // 页面加载监控
      options.onLoad = function(...args) {
        const startTime = Date.now();
        this.__pageStartTime = startTime;
        
        if (originalOnLoad) {
          originalOnLoad.apply(this, args);
        }
      };

      // 页面显示监控
      options.onShow = function(...args) {
        const startTime = Date.now();
        
        if (originalOnShow) {
          originalOnShow.apply(this, args);
        }
        
        // 记录页面切换时间
        if (this.__pageStartTime) {
          const loadTime = Date.now() - this.__pageStartTime;
          self.recordPageLoad(this.route, loadTime);
        }
      };

      // 页面渲染完成监控
      options.onReady = function(...args) {
        if (this.__pageStartTime) {
          const renderTime = Date.now() - this.__pageStartTime;
          self.recordPageRender(this.route, renderTime);
        }
        
        if (originalOnReady) {
          originalOnReady.apply(this, args);
        }
      };

      return originalPage(options);
    };
  }

  /**
   * 设置网络监控
   */
  setupNetworkMonitoring() {
    // 监听网络状态变化
    wx.onNetworkStatusChange((res) => {
      this.recordNetworkStatus({
        isConnected: res.isConnected,
        networkType: res.networkType,
        timestamp: Date.now()
      });
    });

    // 包装wx.request方法
    const originalRequest = wx.request;
    const self = this;
    
    wx.request = function(options) {
      const startTime = Date.now();
      const originalSuccess = options.success;
      const originalFail = options.fail;
      
      options.success = function(res) {
        const latency = Date.now() - startTime;
        self.recordApiCall({
          url: options.url,
          method: options.method || 'GET',
          statusCode: res.statusCode,
          latency,
          success: true,
          timestamp: startTime
        });
        
        if (originalSuccess) {
          originalSuccess(res);
        }
      };
      
      options.fail = function(error) {
        const latency = Date.now() - startTime;
        self.recordApiCall({
          url: options.url,
          method: options.method || 'GET',
          error: error.errMsg,
          latency,
          success: false,
          timestamp: startTime
        });
        
        if (originalFail) {
          originalFail(error);
        }
      };
      
      return originalRequest(options);
    };
  }

  /**
   * 设置错误监控
   */
  setupErrorMonitoring() {
    // 监听小程序错误
    wx.onError((error) => {
      this.recordError({
        type: 'runtime_error',
        message: error,
        timestamp: Date.now(),
        stack: error.stack || ''
      });
    });

    // 监听Promise未处理的rejection
    wx.onUnhandledRejection((res) => {
      this.recordError({
        type: 'unhandled_rejection',
        message: res.reason,
        timestamp: Date.now(),
        promise: res.promise
      });
    });
  }

  /**
   * 启动定时监控
   */
  startPeriodicMonitoring() {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    this.monitoringInterval = setInterval(() => {
      this.collectSystemMetrics();
    }, 30000); // 每30秒收集一次系统指标
  }

  /**
   * 停止监控
   */
  stopMonitoring() {
    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  /**
   * 收集系统指标
   */
  async collectSystemMetrics() {
    try {
      // 收集系统信息
      const systemInfo = this.getSystemInfo();
      
      // 收集网络信息
      const networkInfo = await this.getNetworkInfo();
      
      // 收集缓存统计
      const cacheStats = await CacheManager.getStats();
      
      // 收集并发处理统计
      const concurrencyStats = ConcurrentProcessor.getAllQueueStatus();
      
      // 收集AI服务统计
      const aiStats = await AIService.getPerformanceStats();
      
      // 记录系统指标
      this.recordSystemMetrics({
        timestamp: Date.now(),
        system: systemInfo,
        network: networkInfo,
        cache: cacheStats,
        concurrency: concurrencyStats,
        ai: aiStats
      });
      
    } catch (error) {
      console.error('收集系统指标失败:', error);
    }
  }

  /**
   * 获取系统信息（新API）
   */
  getSystemInfo() {
    try {
      const deviceInfo = wx.getDeviceInfo();
      const windowInfo = wx.getWindowInfo();
      const appBaseInfo = wx.getAppBaseInfo();
      
      return {
        model: deviceInfo.model,
        system: deviceInfo.system,
        version: deviceInfo.version || appBaseInfo.version,
        platform: deviceInfo.platform,
        brand: deviceInfo.brand,
        screenWidth: windowInfo.screenWidth,
        screenHeight: windowInfo.screenHeight,
        pixelRatio: windowInfo.pixelRatio,
        SDKVersion: appBaseInfo.SDKVersion
      };
    } catch (error) {
      console.warn('使用新API获取系统信息失败，降级使用旧API:', error);
      return wx.getSystemInfoSync();
    }
  }

  /**
   * 获取网络信息
   */
  getNetworkInfo() {
    return new Promise((resolve) => {
      wx.getNetworkType({
        success: (res) => {
          resolve({
            networkType: res.networkType,
            isConnected: res.networkType !== 'none'
          });
        },
        fail: () => {
          resolve({
            networkType: 'unknown',
            isConnected: false
          });
        }
      });
    });
  }

  /**
   * 记录页面加载时间
   */
  recordPageLoad(route, loadTime) {
    if (!this.performanceData.app.pageLoadTimes[route]) {
      this.performanceData.app.pageLoadTimes[route] = [];
    }
    
    this.performanceData.app.pageLoadTimes[route].push({
      loadTime,
      timestamp: Date.now()
    });

    // 检查是否超过阈值
    if (loadTime > this.thresholds.pageLoadTime) {
      this.recordPerformanceAlert('slow_page_load', {
        route,
        loadTime,
        threshold: this.thresholds.pageLoadTime
      });
    }
  }

  /**
   * 记录页面渲染时间
   */
  recordPageRender(route, renderTime) {
    console.log(`页面 ${route} 渲染完成，耗时 ${renderTime}ms`);
  }

  /**
   * 记录API调用
   */
  recordApiCall(callData) {
    this.performanceData.api.calls.push(callData);
    
    // 记录延迟
    this.performanceData.api.latencies.push({
      url: callData.url,
      latency: callData.latency,
      timestamp: callData.timestamp
    });

    // 更新成功率统计
    const urlKey = callData.url.split('?')[0]; // 去除查询参数
    if (!this.performanceData.api.successRates[urlKey]) {
      this.performanceData.api.successRates[urlKey] = {
        total: 0,
        success: 0
      };
    }
    
    this.performanceData.api.successRates[urlKey].total++;
    if (callData.success) {
      this.performanceData.api.successRates[urlKey].success++;
    }

    // 检查延迟阈值
    if (callData.latency > this.thresholds.apiLatency) {
      this.recordPerformanceAlert('slow_api_call', {
        url: callData.url,
        latency: callData.latency,
        threshold: this.thresholds.apiLatency
      });
    }

    // 记录错误
    if (!callData.success) {
      this.performanceData.api.errors.push({
        url: callData.url,
        error: callData.error,
        timestamp: callData.timestamp
      });
    }
  }

  /**
   * 记录用户行为
   */
  recordUserAction(action, data = {}) {
    this.performanceData.user.actions.push({
      action,
      ...data,
      timestamp: Date.now()
    });
  }

  /**
   * 记录系统事件
   */
  recordSystemEvent(event, data = {}) {
    console.log('系统事件:', event, data);
  }

  /**
   * 记录网络状态
   */
  recordNetworkStatus(status) {
    this.performanceData.system.network.push(status);
  }

  /**
   * 记录系统指标
   */
  recordSystemMetrics(metrics) {
    this.performanceData.system.memory.push({
      timestamp: metrics.timestamp,
      usage: metrics.cache.memory.usage
    });

    // 限制数据量，只保留最近的100条记录
    Object.keys(this.performanceData.system).forEach(key => {
      if (this.performanceData.system[key].length > 100) {
        this.performanceData.system[key] = this.performanceData.system[key].slice(-100);
      }
    });
  }

  /**
   * 记录错误
   */
  recordError(error) {
    this.performanceData.app.errorCount++;
    console.error('应用错误:', error);
    
    // 保存错误到本地存储
    const errors = wx.getStorageSync('app_errors') || [];
    errors.push(error);
    
    // 只保留最近的50个错误
    if (errors.length > 50) {
      errors.splice(0, errors.length - 50);
    }
    
    wx.setStorageSync('app_errors', errors);
  }

  /**
   * 记录性能告警
   */
  recordPerformanceAlert(type, data) {
    console.warn('性能告警:', type, data);
    
    const alerts = wx.getStorageSync('performance_alerts') || [];
    alerts.push({
      type,
      ...data,
      timestamp: Date.now()
    });
    
    // 只保留最近的20个告警
    if (alerts.length > 20) {
      alerts.splice(0, alerts.length - 20);
    }
    
    wx.setStorageSync('performance_alerts', alerts);
  }

  /**
   * 获取性能报告
   */
  getPerformanceReport() {
    const now = Date.now();
    const appRunTime = now - this.performanceData.app.startTime;
    
    // 计算平均页面加载时间
    const avgPageLoadTimes = {};
    Object.keys(this.performanceData.app.pageLoadTimes).forEach(route => {
      const times = this.performanceData.app.pageLoadTimes[route];
      const avg = times.reduce((sum, item) => sum + item.loadTime, 0) / times.length;
      avgPageLoadTimes[route] = Math.round(avg);
    });

    // 计算API成功率
    const apiSuccessRates = {};
    Object.keys(this.performanceData.api.successRates).forEach(url => {
      const stats = this.performanceData.api.successRates[url];
      apiSuccessRates[url] = (stats.success / stats.total * 100).toFixed(1) + '%';
    });

    // 计算平均API延迟
    const recentLatencies = this.performanceData.api.latencies.slice(-20);
    const avgApiLatency = recentLatencies.length > 0 ? 
      recentLatencies.reduce((sum, item) => sum + item.latency, 0) / recentLatencies.length : 0;

    return {
      summary: {
        appRunTime: Math.round(appRunTime / 1000), // 秒
        launchTime: this.performanceData.app.launchTime,
        errorCount: this.performanceData.app.errorCount,
        avgPageLoadTime: this.calculateOverallAvgPageLoadTime(),
        avgApiLatency: Math.round(avgApiLatency)
      },
      details: {
        pageLoadTimes: avgPageLoadTimes,
        apiSuccessRates,
        recentErrors: wx.getStorageSync('app_errors') || [],
        performanceAlerts: wx.getStorageSync('performance_alerts') || []
      },
      timestamp: now
    };
  }

  /**
   * 计算总体平均页面加载时间
   */
  calculateOverallAvgPageLoadTime() {
    let totalTime = 0;
    let totalCount = 0;
    
    Object.values(this.performanceData.app.pageLoadTimes).forEach(times => {
      times.forEach(item => {
        totalTime += item.loadTime;
        totalCount++;
      });
    });
    
    return totalCount > 0 ? Math.round(totalTime / totalCount) : 0;
  }

  /**
   * 保存性能数据
   */
  savePerformanceData() {
    try {
      const report = this.getPerformanceReport();
      wx.setStorageSync('performance_report', report);
      
      // 同步到云端（可选）
      this.syncToCloud(report);
      
    } catch (error) {
      console.error('保存性能数据失败:', error);
    }
  }

  /**
   * 同步到云端
   */
  async syncToCloud(report) {
    try {
      await wx.cloud.database().collection('performance_reports').add({
        data: {
          ...report,
          userId: this.getUserId(),
          appVersion: this.getAppVersion()
        }
      });
    } catch (error) {
      console.error('同步性能数据到云端失败:', error);
    }
  }

  /**
   * 获取用户ID
   */
  getUserId() {
    // 获取匿名用户ID或微信openid
    return wx.getStorageSync('user_id') || 'anonymous';
  }

  /**
   * 获取应用版本
   */
  getAppVersion() {
    const accountInfo = wx.getAccountInfoSync();
    return accountInfo.miniProgram.version || 'dev';
  }

  /**
   * 设置性能阈值
   */
  setThresholds(newThresholds) {
    this.thresholds = {
      ...this.thresholds,
      ...newThresholds
    };
  }

  /**
   * 清理历史数据
   */
  cleanup() {
    // 清理超过7天的数据
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    
    // 清理API调用记录
    this.performanceData.api.calls = this.performanceData.api.calls.filter(
      call => call.timestamp > sevenDaysAgo
    );
    
    // 清理用户行为记录
    this.performanceData.user.actions = this.performanceData.user.actions.filter(
      action => action.timestamp > sevenDaysAgo
    );
    
    // 清理系统指标
    Object.keys(this.performanceData.system).forEach(key => {
      this.performanceData.system[key] = this.performanceData.system[key].filter(
        item => item.timestamp > sevenDaysAgo
      );
    });
  }

  /**
   * 生成性能诊断建议
   */
  generateDiagnosticSuggestions() {
    const report = this.getPerformanceReport();
    const suggestions = [];

    // 检查页面加载时间
    if (report.summary.avgPageLoadTime > this.thresholds.pageLoadTime) {
      suggestions.push({
        type: 'performance',
        level: 'warning',
        message: '页面加载时间较长，建议优化页面资源和代码'
      });
    }

    // 检查API延迟
    if (report.summary.avgApiLatency > this.thresholds.apiLatency) {
      suggestions.push({
        type: 'network',
        level: 'warning', 
        message: 'API调用延迟较高，建议检查网络环境或优化接口'
      });
    }

    // 检查错误率
    const apiCalls = this.performanceData.api.calls.length;
    const apiErrors = this.performanceData.api.errors.length;
    if (apiCalls > 0 && (apiErrors / apiCalls) > this.thresholds.errorRate) {
      suggestions.push({
        type: 'reliability',
        level: 'error',
        message: 'API错误率较高，建议检查接口稳定性'
      });
    }

    return suggestions;
  }
}

// 导出单例
export default new PerformanceMonitor(); 