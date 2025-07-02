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
    // 模拟网络请求获取报告详情
    setTimeout(() => {
      const mockReport = this.generateMockReport(this.data.reportId);
      this.setData({
        report: mockReport,
        isLoading: false
      });
    }, 1200);
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

  // --- Mock数据生成 ---
  generateMockReport(reportId) {
    // 实际应用中，这里会用 reportId 去请求后端数据
    // 我们这里简单模拟一个固定的结果
    const questions = [
      { id: 'q1', title: '计算：15 + 27 = ?', isCorrect: true },
      { id: 'q2', title: '一个正方形有几条边？', isCorrect: true },
      { id: 'q3', title: '以下哪些是偶数？', isCorrect: false },
      { id: 'q4', title: '9 x 8 = ?', isCorrect: true },
      { id: 'q5', title: '100 - 55 = ?', isCorrect: false },
    ];
    
    const correctCount = questions.filter(q => q.isCorrect).length;
    const totalCount = questions.length;
    const accuracy = totalCount > 0 ? (correctCount / totalCount) * 100 : 0;
    
    let summaryText = '';
    if (accuracy === 100) summaryText = '太棒了，全部正确！';
    else if (accuracy >= 80) summaryText = '表现不错，继续努力！';
    else if (accuracy >= 60) summaryText = '及格了，再接再厉！';
    else summaryText = '要加油哦，错题需要重点复习！';

    return {
      id: reportId,
      accuracy: accuracy,
      score: Math.round(accuracy),
      correctCount: correctCount,
      incorrectCount: totalCount - correctCount,
      totalCount: totalCount,
      summaryText: summaryText,
      questions: questions,
    };
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