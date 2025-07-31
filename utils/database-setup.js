/**
 * 数据库初始化和索引管理
 * 注意：根据小程序后台的索引建议，建议创建以下索引以提升查询性能：
 * 
 * mistakes 集合建议索引：
 * 1. { userId: 1, createTime: 1 }  - 用于按用户和创建时间查询
 * 2. { userId: 1, isArchived: 1 }  - 用于按用户和归档状态查询  
 * 3. { userId: 1, isArchived: 1, nextReviewTime: 1 } - 用于复习计划查询
 * 4. { userId: 1, isArchived: 1, reviewLevel: 1 } - 用于按掌握程度查询
 * 5. { userId: 1, isArchived: 1, createTime: -1 } - 用于按时间倒序查询
 * 
 * review_records 集合建议索引：
 * 1. { userId: 1, reviewTime: -1 } - 用于按用户和复习时间查询
 * 
 * practice_records 集合建议索引：
 * 1. { userId: 1, practiceTime: -1 } - 用于按用户和练习时间查询
 * 
 * 可通过小程序云开发控制台的快速创建索引链接创建这些索引。
 */

const cloud = require('wx-server-sdk');

// 数据库集合名称常量
const COLLECTIONS = {
  MISTAKES: 'mistakes',
  REVIEW_RECORDS: 'review_records', 
  PRACTICE_RECORDS: 'practice_records',
  USER_PROFILES: 'user_profiles'
};

/**
 * 初始化数据库集合和基础数据
 */
async function initializeDatabase() {
  console.log('📚 开始初始化数据库...');
  
  try {
    const db = cloud.database();
    
    // 检查集合是否存在，如果不存在则创建
    for (const [key, collectionName] of Object.entries(COLLECTIONS)) {
      try {
        await db.collection(collectionName).limit(1).get();
        console.log(`✅ 集合 ${collectionName} 已存在`);
      } catch (error) {
        if (error.errCode === -1) {
          console.log(`📝 创建集合 ${collectionName}...`);
          // 注意：云开发会在第一次写入时自动创建集合
        }
      }
    }
    
    console.log('✅ 数据库初始化完成');
    console.log('💡 提示：如需优化查询性能，请参考文件头部的索引建议在云开发控制台创建相应索引');
    
    return { success: true };
    
  } catch (error) {
    console.error('❌ 数据库初始化失败:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 验证数据库连接
 */
async function validateDatabaseConnection() {
  try {
    const db = cloud.database();
    await db.collection(COLLECTIONS.MISTAKES).limit(1).get();
    return { success: true, message: '数据库连接正常' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

module.exports = {
  initializeDatabase,
  validateDatabaseConnection,
  COLLECTIONS
};