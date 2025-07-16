import { store } from './store/index';

// 智能学霸小助手 - 应用入口文件
App({
  globalData: {
    store: store, // 挂载store
    userInfo: null,
    systemInfo: null,
    theme: 'light',
    version: '1.0.0'
  },
  
  onLaunch() {
    console.log('🚀 智能学霸小助手启动中...');
    
    try {
    // 初始化云开发
    this.initCloud();
      
      // 启动性能监控
      this.initPerformanceMonitor();
    
      // 验证基础功能
      this.verifyBasicFunctions();
      
      console.log('✅ 应用启动成功');
      
    } catch (error) {
      console.error('❌ 应用启动失败:', error);
      this.handleStartupError(error);
    }
  },

  onShow() {
    console.log('📱 应用前台显示');
  },

  onHide() {
    console.log('⏸️ 应用进入后台');
  },

  onError(error) {
    console.error('💥 应用运行时错误:', error);
    
    // 记录错误到本地
    const errors = wx.getStorageSync('app_errors') || [];
    errors.push({
      type: 'runtime_error',
      message: error,
      timestamp: Date.now(),
      stack: error.stack
    });
    
    // 只保留最近20个错误
    if (errors.length > 20) {
      errors.splice(0, errors.length - 20);
    }
    
    wx.setStorageSync('app_errors', errors);
  },

  // 初始化云开发
  initCloud() {
    try {
      if (wx.cloud) {
        wx.cloud.init({
          traceUser: true
        });
        console.log('☁️ 云开发初始化成功');
      } else {
        console.warn('⚠️ 云开发不可用');
      }
    } catch (error) {
      console.error('☁️ 云开发初始化失败:', error);
    }
  },

  // 初始化性能监控
  initPerformanceMonitor() {
    try {
      // 性能监控已在utils/performance-monitor.js中自动启动
      console.log('📊 性能监控已启动');
    } catch (error) {
      console.error('📊 性能监控启动失败:', error);
    }
  },

  // 验证基础功能
  verifyBasicFunctions() {
    try {
      // 验证存储功能
      wx.setStorageSync('startup_test', 'ok');
      const testValue = wx.getStorageSync('startup_test');
      if (testValue !== 'ok') {
        throw new Error('存储功能异常');
      }
      wx.removeStorageSync('startup_test');
      
      // 验证网络功能
      wx.getNetworkType({
          success: (res) => {
          console.log('🌐 网络状态:', res.networkType);
        },
        fail: (error) => {
          console.warn('🌐 获取网络状态失败:', error);
        }
      });
      
      console.log('✅ 基础功能验证通过');
      
    } catch (error) {
      console.error('❌ 基础功能验证失败:', error);
      throw error;
    }
  },

  // 处理启动错误
  handleStartupError(error) {
    // 显示错误提示
    setTimeout(() => {
      wx.showModal({
        title: '启动异常',
        content: '应用启动时遇到问题，请重启小程序或联系客服。',
        showCancel: false,
        confirmText: '我知道了'
      });
    }, 1000);
  },

  // 获取用户信息
  getUserInfo() {
    return wx.getStorageSync('userInfo') || null;
  },

  // 设置用户信息
  setUserInfo(userInfo) {
    wx.setStorageSync('userInfo', userInfo);
  },

  // 获取应用版本信息
  getAppInfo() {
    try {
      const accountInfo = wx.getAccountInfoSync();
      return {
        version: accountInfo.miniProgram.version || 'dev',
        envVersion: accountInfo.miniProgram.envVersion || 'develop'
      };
    } catch (error) {
      console.error('获取应用信息失败:', error);
      return {
        version: 'unknown',
        envVersion: 'unknown'
      };
    }
  },

  // 工具方法：获取用户信息
  getUserInfo() {
    return this.globalData.userInfo;
  },

  // 工具方法：设置用户信息
  setUserInfo(userInfo) {
    this.globalData.userInfo = userInfo;
    // 持久化存储
    wx.setStorageSync('userInfo', userInfo);
  },

  // 工具方法：清除用户信息
  clearUserInfo() {
    this.globalData.userInfo = null;
    wx.removeStorageSync('userInfo');
  }
}); 