/**
 * 性能监控工具 - 优化版
 * 实时收集和分析应用性能数据
 * 优化点：内存管理、数据压缩、智能采样、异步处理
 */

import { errorHandler } from './error-handler';
import { debounce, throttle, deepClone } from './common';

class PerformanceMonitor {
  constructor() {
    this.isMonitoring = false;
    this.monitoringInterval = null;
    this.performanceData = {
      app: {
        startTime: Date.now(),
        launchTime: 0,
        pageLoadTimes: new Map(), // 使用Map提高查找性能
        navigationTimes: new Map(),
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
        calls: new Map(), // 优化API调用数据结构
        errors: [],
        latencies: [],
        successRates: new Map()
      }
    };
    
    // 性能阈值配置
    this.thresholds = {
      pageLoadTime: 3000,
      apiLatency: 5000,
      memoryUsage: 100,
      errorRate: 0.05,
      maxDataPoints: 1000, // 限制数据点数量
      sampleInterval: 5000 // 采样间隔
    };

    // 优化配置
    this.config = {
      enableSmartSampling: true, // 智能采样
      enableDataCompression: true, // 数据压缩
      enableAsyncProcessing: true, // 异步处理
      maxMemoryUsage: 10 * 1024 * 1024, // 10MB内存限制
      compressionRatio: 0.1 // 压缩比例
    };

    // 性能监控状态
    this.monitoring = {
      currentMemoryUsage: 0,
      lastCleanup: Date.now(),
      cleanupInterval: 60000, // 1分钟清理间隔
      isProcessing: false
    };

    // 防抖和节流函数
    this.debouncedCollectData = debounce(this.collectSystemData.bind(this), 1000);
    this.throttledLogPerformance = throttle(this.logPerformanceMetric.bind(this), 100);

    this.initMonitoring();
  }

  /**
   * 初始化监控系统
   */
  async initMonitoring() {
    try {
      // 设置页面性能监控
      this.setupPagePerformanceMonitoring();
      
      // 设置API性能监控
      this.setupAPIPerformanceMonitoring();
      
      // 设置内存管理
      this.setupMemoryManagement();
      
      // 启动后台清理任务
      this.startCleanupTask();
      
      console.log('性能监控初始化完成');
    } catch (error) {
      errorHandler.handleError(error, {
        context: 'PerformanceMonitor.initMonitoring',
        level: 'warning'
      });
    }
  }

  /**
   * 设置页面性能监控
   */
  setupPagePerformanceMonitoring() {
    // 监听页面加载事件
    const originalOnLoad = wx.onPageLoad || function() {};
    const originalOnShow = wx.onPageShow || function() {};

    wx.onPageLoad = (options) => {
      const startTime = Date.now();
      this.recordPageEvent('load', { page: getCurrentPages().pop()?.route, startTime });
      return originalOnLoad.call(this, options);
    };

    wx.onPageShow = () => {
      this.recordPageEvent('show', { page: getCurrentPages().pop()?.route });
      return originalOnShow.call(this);
    };
  }

  /**
   * 设置API性能监控
   */
  setupAPIPerformanceMonitoring() {
    // 拦截wx.request
    const originalRequest = wx.request;
    wx.request = (options) => {
      const startTime = Date.now();
      const apiKey = `${options.method || 'GET'}_${options.url}`;
      
      const originalSuccess = options.success || function() {};
      const originalFail = options.fail || function() {};

      options.success = (res) => {
        this.recordAPICall(apiKey, {
          latency: Date.now() - startTime,
          success: true,
          statusCode: res.statusCode
        });
        return originalSuccess(res);
      };

      options.fail = (error) => {
        this.recordAPICall(apiKey, {
          latency: Date.now() - startTime,
          success: false,
          error: error.errMsg
        });
        return originalFail(error);
      };

      return originalRequest(options);
    };
  }

  /**
   * 设置内存管理
   */
  setupMemoryManagement() {
    // 定期检查内存使用情况
    setInterval(() => {
      this.checkMemoryUsage();
    }, this.monitoring.cleanupInterval);
  }

  /**
   * 检查内存使用情况
   */
  checkMemoryUsage() {
    try {
      const memoryInfo = wx.getSystemInfoSync();
      this.monitoring.currentMemoryUsage = this.calculateDataSize();

      if (this.monitoring.currentMemoryUsage > this.config.maxMemoryUsage) {
        console.warn('性能监控内存使用过高，开始清理');
        this.performDataCleanup();
      }

      // 记录内存使用情况
      if (this.config.enableSmartSampling) {
        this.smartSampleSystemData('memory', {
          used: this.monitoring.currentMemoryUsage,
          available: memoryInfo.memorySize || 0,
          timestamp: Date.now()
        });
      }
    } catch (error) {
      errorHandler.handleError(error, {
        context: 'PerformanceMonitor.checkMemoryUsage',
        level: 'warning'
      });
    }
  }

  /**
   * 智能采样系统数据
   */
  smartSampleSystemData(type, data) {
    const typeData = this.performanceData.system[type];
    
    // 如果数据点过多，进行采样
    if (typeData.length >= this.thresholds.maxDataPoints) {
      const sampleSize = Math.floor(typeData.length * this.config.compressionRatio);
      const sampledData = this.sampleArray(typeData, sampleSize);
      this.performanceData.system[type] = sampledData;
    }
    
    typeData.push(data);
  }

  /**
   * 数组采样
   */
  sampleArray(array, sampleSize) {
    if (array.length <= sampleSize) return array;
    
    const step = array.length / sampleSize;
    const sampled = [];
    
    for (let i = 0; i < array.length; i += step) {
      sampled.push(array[Math.floor(i)]);
    }
    
    return sampled;
  }

  /**
   * 记录页面事件
   */
  recordPageEvent(event, data) {
    try {
      const pageData = {
        event,
        timestamp: Date.now(),
        ...data
      };

      if (event === 'load') {
        this.performanceData.app.pageLoadTimes.set(data.page, Date.now() - data.startTime);
      }

      // 使用节流防止过度记录
      this.throttledLogPerformance('page', pageData);
    } catch (error) {
      errorHandler.handleError(error, {
        context: 'PerformanceMonitor.recordPageEvent',
        level: 'info'
      });
    }
  }

  /**
   * 记录API调用
   */
  recordAPICall(apiKey, metrics) {
    try {
      if (!this.performanceData.api.calls.has(apiKey)) {
        this.performanceData.api.calls.set(apiKey, []);
      }

      const callData = {
        timestamp: Date.now(),
        ...metrics
      };

      this.performanceData.api.calls.get(apiKey).push(callData);
      this.performanceData.api.latencies.push(metrics.latency);

      // 更新成功率
      this.updateSuccessRate(apiKey, metrics.success);

      // 检查是否超过阈值
      if (metrics.latency > this.thresholds.apiLatency) {
        console.warn(`API响应时间过长: ${apiKey} - ${metrics.latency}ms`);
      }
    } catch (error) {
      errorHandler.handleError(error, {
        context: 'PerformanceMonitor.recordAPICall',
        level: 'info'
      });
    }
  }

  /**
   * 更新成功率
   */
  updateSuccessRate(apiKey, success) {
    if (!this.performanceData.api.successRates.has(apiKey)) {
      this.performanceData.api.successRates.set(apiKey, { total: 0, success: 0 });
    }

    const rate = this.performanceData.api.successRates.get(apiKey);
    rate.total++;
    if (success) rate.success++;
  }

  /**
   * 开始监控
   */
  startMonitoring() {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.performanceData.app.startTime = Date.now();

    // 启动定期数据收集
    this.monitoringInterval = setInterval(() => {
      if (this.config.enableAsyncProcessing) {
        // 异步处理避免阻塞主线程
        setTimeout(() => this.debouncedCollectData(), 0);
      } else {
        this.debouncedCollectData();
      }
    }, this.thresholds.sampleInterval);

    console.log('性能监控已启动');
  }

  /**
   * 停止监控
   */
  stopMonitoring() {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    console.log('性能监控已停止');
  }

  /**
   * 收集系统数据
   */
  async collectSystemData() {
    if (this.monitoring.isProcessing) return;
    
    this.monitoring.isProcessing = true;
    
    try {
      const systemInfo = wx.getSystemInfoSync();
      const timestamp = Date.now();

      // 系统信息
      const systemData = {
        timestamp,
        platform: systemInfo.platform,
        version: systemInfo.version,
        screenWidth: systemInfo.screenWidth,
        screenHeight: systemInfo.screenHeight,
        pixelRatio: systemInfo.pixelRatio
      };

      // 网络信息
      const networkInfo = await this.getNetworkInfo();
      if (networkInfo) {
        this.smartSampleSystemData('network', {
          ...networkInfo,
          timestamp
        });
      }

      // 电池信息
      const batteryInfo = await this.getBatteryInfo();
      if (batteryInfo) {
        this.smartSampleSystemData('battery', {
          ...batteryInfo,
          timestamp
        });
      }

    } catch (error) {
      errorHandler.handleError(error, {
        context: 'PerformanceMonitor.collectSystemData',
        level: 'info'
      });
    } finally {
      this.monitoring.isProcessing = false;
    }
  }

  /**
   * 获取网络信息
   */
  getNetworkInfo() {
    return new Promise((resolve) => {
      wx.getNetworkType({
        success: (res) => resolve(res),
        fail: () => resolve(null)
      });
    });
  }

  /**
   * 获取电池信息
   */
  getBatteryInfo() {
    return new Promise((resolve) => {
      wx.getBatteryInfo({
        success: (res) => resolve(res),
        fail: () => resolve(null)
      });
    });
  }

  /**
   * 记录性能指标
   */
  logPerformanceMetric(type, data) {
    try {
      if (this.config.enableDataCompression) {
        // 压缩数据减少内存占用
        data = this.compressData(data);
      }

      console.log(`性能指标 [${type}]:`, data);
    } catch (error) {
      // 静默处理日志错误
    }
  }

  /**
   * 压缩数据
   */
  compressData(data) {
    // 简单的数据压缩：移除不必要的字段
    const compressed = { ...data };
    
    // 移除可能占用大量内存的字段
    delete compressed.rawData;
    delete compressed.debugInfo;
    
    return compressed;
  }

  /**
   * 执行数据清理
   */
  performDataCleanup() {
    try {
      const now = Date.now();
      
      // 清理过期的页面加载时间
      for (const [page, timestamp] of this.performanceData.app.pageLoadTimes) {
        if (now - timestamp > 24 * 60 * 60 * 1000) { // 24小时
          this.performanceData.app.pageLoadTimes.delete(page);
        }
      }

      // 清理系统数据
      Object.keys(this.performanceData.system).forEach(key => {
        const data = this.performanceData.system[key];
        if (data.length > this.thresholds.maxDataPoints) {
          this.performanceData.system[key] = data.slice(-this.thresholds.maxDataPoints);
        }
      });

      // 清理API调用数据
      for (const [apiKey, calls] of this.performanceData.api.calls) {
        if (calls.length > this.thresholds.maxDataPoints) {
          this.performanceData.api.calls.set(apiKey, calls.slice(-this.thresholds.maxDataPoints));
        }
      }

      // 清理延迟数据
      if (this.performanceData.api.latencies.length > this.thresholds.maxDataPoints) {
        this.performanceData.api.latencies = this.performanceData.api.latencies.slice(-this.thresholds.maxDataPoints);
      }

      this.monitoring.lastCleanup = now;
      console.log('性能数据清理完成');
    } catch (error) {
      errorHandler.handleError(error, {
        context: 'PerformanceMonitor.performDataCleanup',
        level: 'warning'
      });
    }
  }

  /**
   * 启动清理任务
   */
  startCleanupTask() {
    setInterval(() => {
      if (Date.now() - this.monitoring.lastCleanup > this.monitoring.cleanupInterval) {
        this.performDataCleanup();
      }
    }, this.monitoring.cleanupInterval);
  }

  /**
   * 计算数据大小
   */
  calculateDataSize() {
    try {
      return JSON.stringify(this.performanceData).length;
    } catch {
      return 0;
    }
  }

  /**
   * 获取性能报告
   */
  getPerformanceReport() {
    try {
      const report = {
        summary: {
          monitoringTime: Date.now() - this.performanceData.app.startTime,
          totalAPIRequests: Array.from(this.performanceData.api.calls.values()).reduce((sum, calls) => sum + calls.length, 0),
          averageResponseTime: this.calculateAverageLatency(),
          errorRate: this.calculateErrorRate(),
          memoryUsage: this.monitoring.currentMemoryUsage
        },
        details: deepClone(this.performanceData),
        recommendations: this.generateRecommendations()
      };

      return report;
    } catch (error) {
      errorHandler.handleError(error, {
        context: 'PerformanceMonitor.getPerformanceReport',
        level: 'warning'
      });
      return null;
    }
  }

  /**
   * 计算平均延迟
   */
  calculateAverageLatency() {
    const latencies = this.performanceData.api.latencies;
    if (latencies.length === 0) return 0;
    
    return latencies.reduce((sum, latency) => sum + latency, 0) / latencies.length;
  }

  /**
   * 计算错误率
   */
  calculateErrorRate() {
    let totalRequests = 0;
    let errorRequests = 0;

    for (const [apiKey, rate] of this.performanceData.api.successRates) {
      totalRequests += rate.total;
      errorRequests += (rate.total - rate.success);
    }

    return totalRequests > 0 ? errorRequests / totalRequests : 0;
  }

  /**
   * 生成优化建议
   */
  generateRecommendations() {
    const recommendations = [];
    
    const averageLatency = this.calculateAverageLatency();
    if (averageLatency > this.thresholds.apiLatency) {
      recommendations.push('API响应时间过长，建议优化网络请求或使用缓存');
    }

    const errorRate = this.calculateErrorRate();
    if (errorRate > this.thresholds.errorRate) {
      recommendations.push('错误率过高，建议检查错误处理和重试机制');
    }

    if (this.monitoring.currentMemoryUsage > this.config.maxMemoryUsage * 0.8) {
      recommendations.push('内存使用率较高，建议优化数据结构和清理策略');
    }

    return recommendations;
  }

  /**
   * 重置监控数据
   */
  reset() {
    this.stopMonitoring();
    this.performanceData = {
      app: {
        startTime: Date.now(),
        launchTime: 0,
        pageLoadTimes: new Map(),
        navigationTimes: new Map(),
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
        calls: new Map(),
        errors: [],
        latencies: [],
        successRates: new Map()
      }
    };
    this.monitoring.currentMemoryUsage = 0;
    this.monitoring.lastCleanup = Date.now();
  }
}

// 创建单例实例
const performanceMonitor = new PerformanceMonitor();

export default performanceMonitor; 