import { observable, action } from 'mobx-miniprogram';

export const store = observable({
  // 用户相关状态
  userInfo: null,
  isLoggedIn: false,
  isGuestMode: false,

  // UI状态
  isLoading: false,

  // Actions
  // 使用 action 包装方法，推荐用于修改 observable 的方法
  login: action(function (userInfo) {
    this.userInfo = userInfo;
    this.isLoggedIn = true;
    this.isGuestMode = false;
    wx.setStorageSync('userInfo', userInfo); // 持久化存储
  }),

  logout: action(function () {
    this.userInfo = null;
    this.isLoggedIn = false;
    this.isGuestMode = false;
    wx.removeStorageSync('userInfo');
  }),

  enterGuestMode: action(function () {
    this.isGuestMode = true;
    this.isLoggedIn = false;
    this.userInfo = null;
  }),

  exitGuestMode: action(function () {
    this.isGuestMode = false;
  }),

  setLoading: action(function (loading) {
    this.isLoading = loading;
  }),
  
  // 用于应用启动时，从缓存加载用户信息
  loadUserFromCache: action(function() {
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo) {
      this.userInfo = userInfo;
      this.isLoggedIn = true;
      this.isGuestMode = false;
    }
  })
}); 