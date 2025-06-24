// 云函数：login
const cloud = require('wx-server-sdk');

// 初始化云开发环境
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

/**
 * 用户登录云函数
 * 根据前端传来的code获取用户openid
 */
exports.main = async (event, context) => {
  const { code } = event;
  
  if (!code) {
    return {
      success: false,
      error: 'code参数不能为空'
    };
  }

  try {
    // 获取微信调用上下文
    const wxContext = cloud.getWXContext();
    
    return {
      success: true,
      openid: wxContext.OPENID,
      appid: wxContext.APPID,
      unionid: wxContext.UNIONID || null,
      timestamp: new Date().getTime()
    };
  } catch (error) {
    console.error('登录失败:', error);
    return {
      success: false,
      error: '登录失败，请重试',
      details: error.message
    };
  }
}; 