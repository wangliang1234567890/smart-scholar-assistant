import { store } from './store/index';
import aiService from './utils/ai-service.js';

App({
  globalData: {
    store: store,
    aiService: aiService,
    userInfo: null,
    systemInfo: null,
    theme: 'light',
    version: '1.0.0'
  },
  
  onLaunch() {
    console.log('🚀 智能学霸小助手启动中...');
    
    try {
      // 初始化云开发
      if (!wx.cloud) {
        console.error('请使用 2.2.3 或以上的基础库以使用云能力');
      } else {
        wx.cloud.init({
          env: 'cloud1-9gms5vr2451418c9', // 修正为正确的环境ID
          traceUser: true,
        });
      }
      
      // 🔧 确保数据库管理器初始化
      try {
        const DatabaseManager = require('./utils/database');
        console.log('✅ 数据库管理器初始化成功');
        this.globalData.DatabaseManager = DatabaseManager;
      } catch (error) {
        console.error('❌ 数据库管理器初始化失败:', error);
      }
      
      // 确保AI服务正确初始化
      if (this.globalData.aiService) {
        console.log('✅ AI服务已加载:', this.globalData.aiService);
        
        // 测试AI服务是否可用
        if (typeof this.globalData.aiService.analyzeQuestionFromImage === 'function') {
          console.log('✅ AI图片分析服务可用');
        } else {
          console.error('❌ AI图片分析服务不可用');
        }
        
        if (typeof this.globalData.aiService.recognizeText === 'function') {
          console.log('✅ AI文字识别方法可用（兼容接口）');
        } else {
          console.error('❌ AI文字识别方法不可用');
        }
      } else {
        console.error('❌ AI服务未加载');
      }
      

      
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
    // 加载用户信息到store
    this.loadUserToStore();
  },

  onHide() {
    console.log('⏸️ 应用进入后台');
    // 保存关键数据
    this.saveAppState();
  },

  onError(error) {
    console.error('💥 应用运行时错误:', error);
    
    // 记录错误到本地
    this.recordError({
      type: 'runtime_error',
      message: error.message || error,
      timestamp: Date.now(),
      stack: error.stack
    });
  },

  // 初始化云开发
  initCloud() {
    try {
      if (wx.cloud) {
        wx.cloud.init({
          env: 'cloud1-9gms5vr2451418c9',
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



  // 验证基础功能
  verifyBasicFunctions() {
    try {
      // 验证存储功能
      const testKey = 'startup_test';
      const testValue = 'ok';
      
      wx.setStorageSync(testKey, testValue);
      const readValue = wx.getStorageSync(testKey);
      
      if (readValue !== testValue) {
        throw new Error('存储功能异常');
      }
      
      wx.removeStorageSync(testKey);
      
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

  // 加载用户信息到store
  loadUserToStore() {
    try {
      const userInfo = this.getUserInfo();
      if (userInfo && this.globalData.store) {
        this.globalData.store.loadUserFromCache();
      }
    } catch (error) {
      console.error('加载用户信息到store失败:', error);
    }
  },

  // 保存应用状态
  saveAppState() {
    try {
      // 保存store状态
      if (this.globalData.store && this.globalData.store.userInfo) {
        wx.setStorageSync('userInfo', this.globalData.store.userInfo);
      }
    } catch (error) {
      console.error('保存应用状态失败:', error);
    }
  },

  // 记录错误
  recordError(errorInfo) {
    try {
      const errors = wx.getStorageSync('app_errors') || [];
      errors.push(errorInfo);
      
      // 只保留最近20个错误
      if (errors.length > 20) {
        errors.splice(0, errors.length - 20);
      }
      
      wx.setStorageSync('app_errors', errors);
    } catch (error) {
      console.error('记录错误失败:', error);
    }
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

  // 用户信息管理方法
  getUserInfo() {
    try {
      return wx.getStorageSync('userInfo') || null;
    } catch (error) {
      console.error('获取用户信息失败:', error);
      return null;
    }
  },

  setUserInfo(userInfo) {
    try {
      this.globalData.userInfo = userInfo;
      wx.setStorageSync('userInfo', userInfo);
    } catch (error) {
      console.error('设置用户信息失败:', error);
    }
  },

  clearUserInfo() {
    try {
      this.globalData.userInfo = null;
      wx.removeStorageSync('userInfo');
      if (this.globalData.store) {
        this.globalData.store.logout();
      }
    } catch (error) {
      console.error('清除用户信息失败:', error);
    }
  }
}); 







