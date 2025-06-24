// 智能学霸小助手 - 用户认证工具类
class AuthManager {
  constructor() {
    this.loginPromise = null;
  }

  /**
   * 微信登录获取openid
   * @returns {Promise<Object>} 登录结果
   */
  async wxLogin() {
    try {
      // 防止重复调用
      if (this.loginPromise) {
        return await this.loginPromise;
      }

      this.loginPromise = this._doWxLogin();
      const result = await this.loginPromise;
      this.loginPromise = null;
      
      return result;
    } catch (error) {
      this.loginPromise = null;
      throw error;
    }
  }

  /**
   * 执行微信登录
   * @private
   */
  async _doWxLogin() {
    try {
      // 1. 调用wx.login获取code
      const loginRes = await this.promisify(wx.login)();
      
      if (!loginRes.code) {
        throw new Error('获取登录凭证失败');
      }

      // 2. 调用云函数获取openid
      const cloudRes = await wx.cloud.callFunction({
        name: 'login',
        data: {
          code: loginRes.code
        }
      });

      if (!cloudRes.result || !cloudRes.result.openid) {
        throw new Error('获取用户身份失败');
      }

      console.log('微信登录成功:', cloudRes.result.openid);
      return cloudRes.result;
    } catch (error) {
      console.error('微信登录失败:', error);
      throw new Error('登录失败，请重试');
    }
  }

  /**
   * 获取用户基本信息（头像、昵称）
   * @returns {Promise<Object>} 用户信息
   */
  async getUserProfile() {
    try {
      const res = await this.promisify(wx.getUserProfile)({
        desc: '用于完善用户资料，提供更好的学习体验'
      });
      
      console.log('获取用户信息成功:', res.userInfo.nickName);
      return res.userInfo;
    } catch (error) {
      console.error('获取用户信息失败:', error);
      // 如果用户拒绝授权，返回默认信息
      if (error.errMsg && error.errMsg.includes('auth deny')) {
        throw new Error('需要您的授权才能正常使用小程序功能');
      }
      throw new Error('获取用户信息失败');
    }
  }

  /**
   * 检查登录状态
   * @returns {Promise<boolean>} 是否已登录
   */
  async checkLoginStatus() {
    try {
      const session = await this.promisify(wx.checkSession)();
      console.log('登录状态有效');
      return true;
    } catch (error) {
      console.log('登录状态已过期');
      return false;
    }
  }

  /**
   * 获取手机号（需要用户主动触发）
   * @param {Object} e - 事件对象
   * @returns {Promise<Object>} 手机号信息
   */
  async getPhoneNumber(e) {
    try {
      if (e.detail.errMsg !== 'getPhoneNumber:ok') {
        throw new Error('获取手机号失败');
      }

      // 调用云函数解密手机号
      const result = await wx.cloud.callFunction({
        name: 'getPhoneNumber',
        data: {
          cloudID: e.detail.cloudID,
          encryptedData: e.detail.encryptedData,
          iv: e.detail.iv
        }
      });

      if (result.result && result.result.phoneNumber) {
        console.log('获取手机号成功');
        return result.result;
      } else {
        throw new Error('解析手机号失败');
      }
    } catch (error) {
      console.error('获取手机号失败:', error);
      throw new Error('获取手机号失败');
    }
  }

  /**
   * 获取用户地理位置
   * @param {string} type - 位置类型：wgs84/gcj02
   * @returns {Promise<Object>} 位置信息
   */
  async getLocation(type = 'gcj02') {
    try {
      // 检查位置权限
      const authRes = await this.promisify(wx.getSetting)();
      
      if (!authRes.authSetting['scope.userLocation']) {
        // 请求位置权限
        await this.promisify(wx.authorize)({
          scope: 'scope.userLocation'
        });
      }

      // 获取位置信息
      const locationRes = await this.promisify(wx.getLocation)({
        type,
        isHighAccuracy: true
      });

      console.log('获取位置成功:', locationRes);
      return locationRes;
    } catch (error) {
      console.error('获取位置失败:', error);
      
      if (error.errMsg && error.errMsg.includes('auth deny')) {
        throw new Error('需要位置权限才能使用此功能');
      }
      throw new Error('获取位置信息失败');
    }
  }

  /**
   * 选择位置
   * @returns {Promise<Object>} 选择的位置信息
   */
  async chooseLocation() {
    try {
      const locationRes = await this.promisify(wx.chooseLocation)();
      console.log('选择位置成功:', locationRes);
      return locationRes;
    } catch (error) {
      console.error('选择位置失败:', error);
      
      if (error.errMsg && error.errMsg.includes('cancel')) {
        throw new Error('用户取消选择位置');
      }
      throw new Error('选择位置失败');
    }
  }

  /**
   * 检查相机权限
   * @returns {Promise<boolean>} 是否有相机权限
   */
  async checkCameraAuth() {
    try {
      const authRes = await this.promisify(wx.getSetting)();
      
      if (authRes.authSetting['scope.camera'] === false) {
        // 用户曾经拒绝过相机权限
        return false;
      }
      
      if (authRes.authSetting['scope.camera'] === undefined) {
        // 用户还没有被询问过相机权限
        try {
          await this.promisify(wx.authorize)({
            scope: 'scope.camera'
          });
          return true;
        } catch (error) {
          return false;
        }
      }
      
      return true;
    } catch (error) {
      console.error('检查相机权限失败:', error);
      return false;
    }
  }

  /**
   * 打开设置页面
   */
  openSetting() {
    wx.openSetting({
      success: (res) => {
        console.log('设置页面返回:', res.authSetting);
      },
      fail: (error) => {
        console.error('打开设置页面失败:', error);
      }
    });
  }

  /**
   * 登出清理
   */
  logout() {
    try {
      // 清除本地存储的用户信息
      wx.removeStorageSync('userInfo');
      wx.removeStorageSync('userToken');
      
      // 清除全局用户信息
      const app = getApp();
      if (app) {
        app.clearUserInfo();
      }
      
      console.log('用户登出成功');
    } catch (error) {
      console.error('登出失败:', error);
    }
  }

  /**
   * Promise化微信API
   * @param {Function} fn - 微信API函数
   * @returns {Function} Promise化的函数
   */
  promisify(fn) {
    return (options = {}) => {
      return new Promise((resolve, reject) => {
        fn({
          ...options,
          success: resolve,
          fail: reject
        });
      });
    };
  }

  /**
   * 检查网络状态
   * @returns {Promise<Object>} 网络状态信息
   */
  async getNetworkType() {
    try {
      const networkRes = await this.promisify(wx.getNetworkType)();
      console.log('网络状态:', networkRes.networkType);
      return networkRes;
    } catch (error) {
      console.error('获取网络状态失败:', error);
      return { networkType: 'unknown' };
    }
  }

  /**
   * 监听网络状态变化
   * @param {Function} callback - 回调函数
   */
  onNetworkStatusChange(callback) {
    wx.onNetworkStatusChange(callback);
  }

  /**
   * 获取系统信息
   * @returns {Promise<Object>} 系统信息
   */
  async getSystemInfo() {
    try {
      const systemInfo = await this.promisify(wx.getSystemInfo)();
      console.log('系统信息:', systemInfo);
      return systemInfo;
    } catch (error) {
      console.error('获取系统信息失败:', error);
      return {};
    }
  }
}

export default new AuthManager(); 