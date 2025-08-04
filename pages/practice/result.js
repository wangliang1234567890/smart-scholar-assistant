// pages/practice/result.js
import LocalDB from '../../utils/local-db';
import DatabaseManager from '../../utils/database.js';

Page({

  /**
   * 页面的初始数据
   */
  data: {
    isLoading: true,
    reportId: null,
    report: {},
    gradientColor: { '0%': '#FFD1D1', '100%': '#4A90E2' },
    record: null,
    score: 0,
    practiceId: null, // Added practiceId
    practiceType: 'ai' // Added practiceType
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(query) {
    console.log('练习结果页面加载，参数:', query);
    
    const practiceId = query.practiceId || null;
    const practiceType = query.type || 'ai';
    
    this.setData({ 
      practiceId,
      practiceType
    });
    
    if (practiceId) {
      // 从数据库加载练习结果
      this.loadPracticeResult(practiceId);
    } else {
      console.log('没有practiceId，使用默认结果');
      // 兼容旧版本，使用默认数据
      this.setDefaultResult();
    }
  },

  // 从数据库加载练习结果
  async loadPracticeResult(practiceId) {
    console.log('加载练习结果:', practiceId);
    this.setData({ isLoading: true });
    
    try {
      const userId = DatabaseManager.getCurrentUserId();
      const result = await DatabaseManager.getPracticeRecords(userId, {
        practiceId,
        pageSize: 1
      });
      
      if (result.success && result.data && result.data.length > 0) {
        const practiceRecord = result.data[0];
        console.log('练习记录:', practiceRecord);
        
        // 设置练习结果数据
        this.setData({
          report: {
            id: practiceRecord.practiceId,
            type: practiceRecord.type,
            title: practiceRecord.title,
            accuracy: practiceRecord.accuracy || 0,
            score: practiceRecord.score || 0,
            correctCount: practiceRecord.correctCount || 0,
            incorrectCount: practiceRecord.incorrectCount || 0,
            totalCount: practiceRecord.totalQuestions || 0,
            answeredCount: practiceRecord.answeredQuestions || 0,
            duration: practiceRecord.duration || 0,
            completionRate: practiceRecord.completionRate || 0,
            startTime: practiceRecord.startTime,
            endTime: practiceRecord.endTime,
            createTime: practiceRecord.createTime
          },
          record: practiceRecord,
          score: practiceRecord.score || 0,
          isLoading: false
        });
        
        console.log('练习结果数据设置完成');
      } else {
        console.log('未找到练习记录，使用默认数据');
        this.setDefaultResult();
      }
    } catch (error) {
      console.error('加载练习结果失败:', error);
      this.setDefaultResult();
    }
  },

  // 设置默认结果（兼容处理）
  setDefaultResult() {
    this.setData({
      isLoading: false,
      report: {
        id: 'default',
        type: this.data.practiceType,
        title: '练习已完成',
        accuracy: 0,
        score: 0,
        correctCount: 0,
        incorrectCount: 0,
        totalCount: 0,
        answeredCount: 0,
        duration: 0,
        completionRate: 0
      }
    });
  },

  fetchReport() {
    // 已移至loadPracticeResult方法，保留空方法避免报错
    console.log('fetchReport方法已重构为loadPracticeResult');
  },

  // 格式化练习用时
  formatDuration(seconds) {
    if (!seconds || seconds === 0) return '0秒';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    let result = '';
    if (hours > 0) result += `${hours}小时`;
    if (minutes > 0) result += `${minutes}分钟`;
    if (secs > 0) result += `${secs}秒`;
    
    return result || '0秒';
  },

  // 查看题目详情
  viewQuestionDetail(e) {
    const { index } = e.currentTarget.dataset;
    console.log('查看题目详情:', index);
    
    // 这里可以扩展显示题目详情的功能
    wx.showModal({
      title: '题目详情',
      content: '题目详情功能开发中',
      showCancel: false
    });
  },

  // 返回首页
  backToHome() {
    wx.switchTab({
      url: '/pages/home/home'
    });
  },

  // 再次练习
  practiceAgain() {
    const { practiceType } = this.data;
    
    if (practiceType === 'ai') {
      wx.navigateTo({
        url: '/pages/practice/config?type=ai'
      });
    } else if (practiceType === 'review') {
      wx.navigateTo({
        url: '/pages/practice/practice'
      });
    } else {
      wx.switchTab({
        url: '/pages/practice/practice'
      });
    }
  },

  reviewMistakes() {
    try {
      const { record } = this.data;
      
      if (!record || !record.answerDetails) {
        wx.showToast({ title: '暂无错题数据', icon: 'none' });
        return;
      }
      
      // 筛选出错题数据
      const wrongAnswers = record.answerDetails.filter(item => 
        item.isCorrect === false || item.isCorrect === null && item.userAnswer !== item.correctAnswer
      );
      
      if (wrongAnswers.length === 0) {
        wx.showToast({ title: '本次练习全部正确，无错题', icon: 'success' });
        return;
      }
      
      console.log('本次练习错题:', wrongAnswers);
      
      // 转换错题数据格式，适配错题详情页面
      const mistakesData = wrongAnswers.map((item, index) => ({
        _id: item.questionId || `wrong_${index}`,
        question: item.question,
        userAnswer: item.userAnswer,
        correctAnswer: item.correctAnswer,
        answer: item.correctAnswer,
        subject: item.subject || '其他',
        difficulty: item.difficulty || 'medium',
        questionType: item.questionType || 'choice',
        reviewLevel: 0,
        isFromPractice: true, // 标记来源于练习
        practiceId: record.practiceId
      }));
      
      // 跳转到练习错题查看页面
      wx.navigateTo({
        url: `/pages/practice/session?type=review&mistakes=${encodeURIComponent(JSON.stringify(mistakesData))}&title=${encodeURIComponent('本次练习错题复习')}&practiceId=${record.practiceId}`
      });
      
    } catch (error) {
      console.error('查看错题失败:', error);
      wx.showToast({ title: '查看错题失败', icon: 'error' });
    }
  },
  
  finish() {
    wx.switchTab({
      url: '/pages/home/home'
    });
  },

  calculateScore(rec) {
    // 简单评分：单选/多选完全正确算1分
    let total = 0;
    rec.questions.forEach(q => {
      const userAns = rec.answers[q.id];
      if (!userAns) return;
      if (q.type === 'single_choice') {
        if (userAns === q.correct) total += 1;
      } else if (q.type === 'multiple_choice') {
        if (Array.isArray(userAns) && userAns.sort().toString() === q.correct.sort().toString()) {
          total += 1;
        }
      }
    });
    return total;
  },



  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {

  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {

  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {

  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {

  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {

  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {

  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {

  }
})