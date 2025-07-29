// pages/practice/result.js
import LocalDB from '../../utils/local-db';

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
    score: 0
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(query) {
    const { localId } = query;
    if (localId) {
      const records = LocalDB.getPracticeRecords();
      const rec = records.find(r => r.id === localId);
      if (rec) {
        const score = this.calculateScore(rec);
        this.setData({ record: rec, score });
      }
    }
    this.setData({ reportId: query.reportId });
    this.fetchReport();
  },

  fetchReport() {
    this.setData({ isLoading: true });
    
    try {
      console.log('加载练习报告，报告ID:', this.data.reportId);
      
      // 目前没有真实的报告数据，显示简单的完成提示
      setTimeout(() => {
        this.setData({
          report: {
            id: this.data.reportId,
            accuracy: 0,
            score: 0,
            correctCount: 0,
            incorrectCount: 0,
            totalCount: 0,
            summaryText: '练习已完成',
            questions: []
          },
          isLoading: false
        });
        
        wx.showToast({
          title: '练习已完成',
          icon: 'success',
          duration: 2000
        });
      }, 500);
    } catch (error) {
      console.error('加载练习报告失败:', error);
      this.setData({ isLoading: false });
    }
  },

  reviewMistakes() {
    wx.showToast({ title: '功能开发中...', icon: 'none' });
    // TODO: 跳转到错题详情页或新的练习，只包含本次的错题
  },
  
  finish() {
    wx.switchTab({
      url: '/pages/home/home'
    });
  },

  viewQuestionDetail(e) {
    const { id } = e.currentTarget.dataset;
    wx.showToast({ title: `查看第${id}题详情 (开发中)`, icon: 'none' });
    // TODO: 跳转到题目详情页
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