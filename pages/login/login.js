// pages/login/login.js
import { store } from '../../store/index';
const app = getApp();

Page({
  data: {
    isLoading: false,
  },

  onLoad: function (options) {
    // You can add logic here to check if the user is already logged in
    // and redirect them if necessary.
  },

  handleGetUserInfo(e) {
    if (this.data.isLoading) return;
    
    // 检查用户是否授权
    if (e.detail.userInfo) {
      console.log('用户已授权', e.detail.userInfo);
      this.setData({ isLoading: true });
      this.loginWithUserInfo(e.detail.userInfo);
    } else {
      console.log('用户拒绝授权');
      wx.showToast({
        title: '您需要授权才能登录',
        icon: 'none'
      });
    }
  },

  loginWithUserInfo(userInfo) {
    // 调用云函数进行登录或注册
    wx.cloud.callFunction({
      name: 'login',
      data: {
        userInfo: userInfo
      },
      success: (cloudRes) => {
        const result = cloudRes.result;
        if (result.success) {
          // 登录成功
          console.log('登录/注册成功', result.data);
          
          // 使用Store来更新用户信息
          store.login(result.data);

          wx.showToast({
            title: '登录成功',
            icon: 'success',
          });

          // 跳转到首页
          setTimeout(() => {
            wx.switchTab({
              url: '/pages/home/home',
            });
          }, 1500);

        } else {
          // 登录失败
          wx.showToast({
            title: result.message || '登录失败',
            icon: 'none'
          });
          this.setData({ isLoading: false });
        }
      },
      fail: (err) => {
        console.error('云函数调用失败', err);
        wx.showToast({
          title: '服务开小差了，请重试',
          icon: 'none'
        });
        this.setData({ isLoading: false });
      }
    });
  },

  handleGuestLogin() {
    // 游客模式 - 使用专门的游客模式方法
    store.enterGuestMode();
    
    wx.switchTab({
      url: '/pages/home/home'
    });
  },

  // Handles the checkbox change event
  onAgreeChange: function (e) {
    this.setData({
      hasAgreed: e.detail,
    });
  },

  // Opens the user agreement page (placeholder)
  openAgreement: function() {
    wx.showModal({
      title: '用户协议',
      content: '这里是用户协议的详细内容，目前正在快马加鞭完善中...',
      showCancel: false
    });
  },

  // Opens the privacy policy page (placeholder)
  openPrivacy: function() {
    wx.showModal({
      title: '隐私政策',
      content: '这里是隐私政策的详细内容，我们十分重视您的隐私安全，具体条款敬请期待。',
      showCancel: false
    });
  }
});