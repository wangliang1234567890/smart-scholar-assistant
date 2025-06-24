import AuthManager from '../../utils/auth';
import DatabaseManager from '../../utils/database';

Page({
  data: {
    loading: false,
    agreementChecked: false,
    canLogin: false
  },

  onLoad() {
    console.log('登录页面加载');
    this.checkLoginStatus();
  },

  onShow() {
    // 每次显示页面时检查登录状态
    this.checkCanLogin();
  },

  // 检查是否已经登录
  async checkLoginStatus() {
    try {
      const app = getApp();
      const userInfo = app.getUserInfo();
      
      if (userInfo) {
        // 如果已经登录，直接跳转到首页
        wx.switchTab({
          url: '/pages/home/home'
        });
        return;
      }

      // 检查微信登录状态
      const isValid = await AuthManager.checkLoginStatus();
      if (isValid) {
        // 微信登录状态有效，尝试获取用户信息
        const storedUserInfo = wx.getStorageSync('userInfo');
        if (storedUserInfo) {
          app.setUserInfo(storedUserInfo);
          wx.switchTab({
            url: '/pages/home/home'
          });
        }
      }
    } catch (error) {
      console.error('检查登录状态失败:', error);
    }
  },

  // 用户协议选择
  onAgreementChange(e) {
    const checked = e.detail.value.length > 0;
    this.setData({ 
      agreementChecked: checked,
      canLogin: checked 
    });
  },

  // 微信登录
  async onWxLogin() {
    if (!this.data.agreementChecked) {
      wx.showToast({
        title: '请先同意用户协议',
        icon: 'none'
      });
      return;
    }

    if (this.data.loading) return;

    try {
      this.setData({ loading: true });

      // 1. 微信登录获取openid
      const authResult = await AuthManager.wxLogin();
      console.log('微信登录成功:', authResult.openid);

      // 2. 获取用户授权信息
      const profileResult = await AuthManager.getUserProfile();
      console.log('获取用户信息成功:', profileResult.nickName);

      // 3. 检查用户是否已存在
      let userInfo = await DatabaseManager.getUserInfo(authResult.openid);

      if (!userInfo) {
        // 4. 新用户，创建用户记录
        const createResult = await DatabaseManager.createUser({
          openid: authResult.openid,
          nickName: profileResult.nickName,
          avatarUrl: profileResult.avatarUrl,
          grade: 1,
          subjects: ['数学', '语文', '英语'],
          level: 1,
          exp: 0
        });

        if (createResult.success) {
          userInfo = {
            _id: createResult.data._id,
            openid: authResult.openid,
            nickName: profileResult.nickName,
            avatarUrl: profileResult.avatarUrl,
            grade: 1,
            subjects: ['数学', '语文', '英语'],
            level: 1,
            exp: 0,
            totalMistakes: 0,
            masteredCount: 0
          };
        } else {
          throw new Error('创建用户失败');
        }
      }

      // 5. 保存用户信息到全局状态和本地存储
      const app = getApp();
      app.setUserInfo(userInfo);

      // 6. 显示欢迎信息
      wx.showToast({
        title: userInfo.totalMistakes > 0 ? '欢迎回来！' : '注册成功！',
        icon: 'success',
        duration: 1500
      });

      // 7. 跳转到首页
      setTimeout(() => {
        wx.switchTab({
          url: '/pages/home/home'
        });
      }, 1500);

    } catch (error) {
      console.error('登录失败:', error);
      this.handleLoginError(error);
    } finally {
      this.setData({ loading: false });
    }
  },

  // 处理登录错误
  handleLoginError(error) {
    let message = '登录失败，请重试';
    
    if (error.message) {
      if (error.message.includes('auth deny')) {
        message = '需要您的授权才能正常使用';
      } else if (error.message.includes('网络')) {
        message = '网络连接异常，请检查网络';
      } else if (error.message.includes('用户')) {
        message = error.message;
      }
    }

    wx.showModal({
      title: '登录失败',
      content: message,
      showCancel: false,
      confirmText: '知道了'
    });
  },

  // 检查是否可以登录
  checkCanLogin() {
    const { agreementChecked } = this.data;
    this.setData({ canLogin: agreementChecked });
  },

  // 查看用户协议
  onViewAgreement() {
    wx.showModal({
      title: '用户协议',
      content: '欢迎使用智能学霸小助手！我们承诺保护您的隐私，仅收集必要的学习数据用于提供更好的服务。您的所有学习记录都将安全存储，不会泄露给第三方。',
      showCancel: true,
      cancelText: '取消',
      confirmText: '同意'
    });
  },

  // 查看隐私政策
  onViewPrivacy() {
    wx.showModal({
      title: '隐私政策',
      content: '我们重视您的隐私权益。本应用仅会收集您的微信头像、昵称用于个性化展示，以及您的学习数据用于功能服务。所有数据都经过加密处理，不会用于其他商业用途。',
      showCancel: false,
      confirmText: '我知道了'
    });
  },

  // 游客模式（可选功能）
  onGuestMode() {
    wx.showModal({
      title: '游客模式',
      content: '游客模式下，您的学习数据将无法同步保存。建议登录后使用完整功能。',
      showCancel: true,
      cancelText: '取消',
      confirmText: '继续',
      success: (res) => {
        if (res.confirm) {
          // 创建游客用户信息
          const guestUserInfo = {
            _id: 'guest_' + Date.now(),
            openid: 'guest',
            nickName: '游客用户',
            avatarUrl: '/images/default-avatar.png',
            grade: 1,
            subjects: ['数学', '语文', '英语'],
            level: 1,
            exp: 0,
            totalMistakes: 0,
            masteredCount: 0,
            isGuest: true
          };
          
          const app = getApp();
          app.setUserInfo(guestUserInfo);
          
          wx.switchTab({
            url: '/pages/home/home'
          });
        }
      }
    });
  },

  // 获取系统信息用于展示
  getSystemInfo() {
    const app = getApp();
    return app.globalData.systemInfo || {};
  }
}); 