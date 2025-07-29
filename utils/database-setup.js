/**
 * 数据库索引设置脚本
 * 在云开发控制台执行或通过云函数创建
 */

// 1. mistakes 集合索引
// 组合索引: userId + isArchived + createTime
db.collection('mistakes').createIndex({
  "userId": 1,
  "isArchived": 1, 
  "createTime": -1
});

// 2. mistakes 集合索引 (按时间查询)
// 组合索引: userId + createTime
db.collection('mistakes').createIndex({
  "userId": 1,
  "createTime": 1
});

// 3. review_records 集合索引
// 组合索引: userId + reviewTime
db.collection('review_records').createIndex({
  "userId": 1,
  "reviewTime": -1
});