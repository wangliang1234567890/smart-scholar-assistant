// 云函数：login
const cloud = require('wx-server-sdk');

// 初始化云开发环境
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

/**
 * 用户登录云函数
 * 根据前端传来的code获取用户openid
 */
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  // 1. 从数据库查询该用户是否存在
  const userRecord = await db.collection('users').where({
    _openid: openid
  }).get();

  if (userRecord.data.length > 0) {
    // 2. 如果用户已存在，更新登录时间并返回用户信息
    const user = userRecord.data[0];
    await db.collection('users').doc(user._id).update({
      data: {
        lastLoginTime: db.serverDate()
      }
    });
    return {
      success: true,
      message: '登录成功',
      data: user
    };
  } else {
    // 3. 如果用户不存在，创建新用户记录
    const {
      userInfo
    } = event;
    if (!userInfo) {
      return {
        success: false,
        message: '缺少用户信息，注册失败'
      };
    }

    const newUser = {
      _openid: openid,
      nickName: userInfo.nickName,
      avatarUrl: userInfo.avatarUrl,
      level: 1,
      exp: 0,
      totalMistakes: 0,
      studyDays: 0,
      createTime: db.serverDate(),
      lastLoginTime: db.serverDate()
    };

    const addUserResult = await db.collection('users').add({
      data: newUser
    });

    return {
      success: true,
      message: '注册并登录成功',
      data: {
        _id: addUserResult._id,
        ...newUser
      }
    };
  }
}; 