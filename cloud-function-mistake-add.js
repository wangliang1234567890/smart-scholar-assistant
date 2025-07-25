// 云函数入口文件
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const db = cloud.database()
  
  try {
    // 添加错题到数据库
    const result = await db.collection('mistakes').add({
      data: {
        image: event.fileID,
        subject: event.subject,
        knowledge: event.knowledge,
        difficulty: event.difficulty,
        question: event.question || '',
        answer: event.answer || '',
        userAnswer: event.userAnswer || '',
        explanation: event.explanation || '',
        status: 'unknown', // unknown, learning, mastered
        reviewCount: 0,
        nextReviewTime: null,
        createdAt: db.serverDate(),
        updateTime: db.serverDate()
      }
    })
    
    console.log('错题添加成功:', result._id)
    return { 
      success: true, 
      data: result,
      message: '错题添加成功'
    }
  } catch (error) {
    console.error('添加错题失败:', error)
    return { 
      success: false, 
      error: error.message,
      message: '添加错题失败'
    }
  }
} 