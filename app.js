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
  
  onLaunch(options) {
    console.log('小程序启动:', options);
    // 从缓存加载用户信息到store
    this.globalData.store.loadUserFromCache();
    // 获取系统信息
    this.getSystemInfo();
    // 检查更新
    this.checkUpdate();
    // 初始化云开发
    this.initCloud();
    // 初始化主题
    this.initTheme();
    
    // 其他启动逻辑...
  },

  onShow(options) {
    console.log('小程序显示:', options);
  },

  onHide() {
    console.log('小程序隐藏');
  },

  onError(msg) {
    console.error('小程序错误:', msg);
    // 错误上报
    this.reportError(msg);
  },

  // 获取系统信息
  getSystemInfo() {
    try {
      const systemInfo = wx.getSystemInfoSync();
      this.globalData.systemInfo = systemInfo;
      console.log('系统信息:', systemInfo);
      
      // 设置状态栏高度
      const statusBarHeight = systemInfo.statusBarHeight;
      const navBarHeight = 44; // 导航栏高度
      this.globalData.navBarHeight = statusBarHeight + navBarHeight;
    } catch (error) {
      console.error('获取系统信息失败:', error);
    }
  },

  // 检查更新
  checkUpdate() {
    if (wx.canIUse('getUpdateManager')) {
      const updateManager = wx.getUpdateManager();
      
      updateManager.onCheckForUpdate((res) => {
        console.log('检查更新结果:', res.hasUpdate);
      });

      updateManager.onUpdateReady(() => {
        wx.showModal({
          title: '更新提示',
          content: '新版本已经准备好，是否重启应用？',
          success: (res) => {
            if (res.confirm) {
              updateManager.applyUpdate();
            }
          }
        });
      });

      updateManager.onUpdateFailed(() => {
        console.error('新版本下载失败');
      });
    }
  },

  // 初始化云开发
  initCloud() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      wx.cloud.init({
        env: 'smart-study-dev-7g9k8l2m3n', // 开发环境ID（需要替换为实际环境）
        traceUser: true,
      });
      console.log('云开发初始化成功');
    }
  },

  // 初始化主题
  initTheme() {
    const theme = wx.getStorageSync('theme') || 'light';
    this.globalData.theme = theme;
  },

  // 错误上报
  reportError(error) {
    // 在开发环境下不上报
    if (this.globalData.systemInfo && this.globalData.systemInfo.platform === 'devtools') {
      return;
    }

    // 生产环境错误上报
    try {
      wx.cloud.callFunction({
        name: 'reportError',
        data: {
          error: error,
          timestamp: new Date().toISOString(),
          systemInfo: this.globalData.systemInfo,
          version: this.globalData.version
        }
      });
    } catch (err) {
      console.error('错误上报失败:', err);
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