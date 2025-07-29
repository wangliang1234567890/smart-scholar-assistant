import DatabaseManager from '../../utils/database.js';

const app = getApp();

// pages/practice/config.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    pageTitle: 'AI 智能练习',
    practiceType: 'ai', // 'ai' or 'review'
    
    // --- 可选项 ---
    subjects: [
      { label: '数学', value: 'math', color: '#4A90E2', icon: '/images/icons/subject-math.svg' },
      { label: '语文', value: 'chinese', color: '#F5A623', icon: '/images/icons/subject-chinese.svg' },
      { label: '英语', value: 'english', color: '#50E3C2', icon: '/images/icons/subject-english.svg' }
    ],
    questionCounts: [10, 20, 30],
    difficulties: [
      { label: '简单', value: 'easy' },
      { label: '中等', value: 'medium' },
      { label: '困难', value: 'hard' }
    ],
    knowledgePoints: {
      math: [
        { label: '两位数加减', value: 'math_2digit_add_subtract' },
        { label: '乘法口诀', value: 'math_multiplication_table' },
        { label: '图形认知', value: 'math_geometry_cognition' },
        { label: '时间与货币', value: 'math_time_money' },
      ],
      chinese: [
        { label: '拼音', value: 'chinese_pinyin' },
        { label: '识字', value: 'chinese_character' },
        { label: '古诗', value: 'chinese_poem' },
      ],
      english: [
        { label: '字母表', value: 'english_alphabet' },
        { label: '简单词汇', value: 'english_vocabulary' },
        { label: '日常对话', value: 'english_conversation' },
      ]
    },

    // --- 用户选择 ---
    selectedSubject: 'math',
    selectedCount: 10,
    selectedDifficulty: 'medium',
    selectedKnowledgePoints: [],
    selectedKnowledgePointsMap: {},
    currentKnowledgePoints: []
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    if (options.type === 'review') {
      this.setData({
        pageTitle: '错题强化复习',
        practiceType: 'review'
      });
      wx.setNavigationBarTitle({
        title: '错题强化复习'
      });
    } else {
      wx.setNavigationBarTitle({
        title: 'AI 智能练习'
      });
    }
    // 初始化当前知识点
    const initPoints = this.data.knowledgePoints[this.data.selectedSubject] || [];
    this.setData({
      currentKnowledgePoints: initPoints.map(item => ({ ...item, active: false }))
    });
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

  },

  // --- 事件处理 ---
  selectSubject: function(e) {
    const newSubject = e.currentTarget.dataset.value;
    const newPoints = this.data.knowledgePoints[newSubject] || [];
    const updatedPoints = newPoints.map(item => ({ ...item, active: false }));
    this.setData({
      selectedSubject: newSubject,
      selectedKnowledgePoints: [],
      selectedKnowledgePointsMap: {},
      currentKnowledgePoints: updatedPoints
    });
  },

  selectCount: function(e) {
    this.setData({
      selectedCount: e.currentTarget.dataset.value
    });
  },

  selectDifficulty: function(e) {
    this.setData({
      selectedDifficulty: e.currentTarget.dataset.value
    });
  },

  selectKnowledgePoint: function(e) {
    const { value } = e.currentTarget.dataset;
    const { selectedKnowledgePoints } = this.data;
    const index = selectedKnowledgePoints.indexOf(value);
    
    if (index > -1) {
      // 如果已经选中，则取消选中
      selectedKnowledgePoints.splice(index, 1);
      const map = { ...this.data.selectedKnowledgePointsMap };
      delete map[value];
      this.setData({ selectedKnowledgePointsMap: map });
    } else {
      // 否则，添加选中
      selectedKnowledgePoints.push(value);
      this.setData({ [`selectedKnowledgePointsMap.${value}`]: true });
    }

    this.setData({
      selectedKnowledgePoints: selectedKnowledgePoints
    });
    this.updateKnowledgePointsActive();
  },

  updateKnowledgePointsActive() {
    const { currentKnowledgePoints, selectedKnowledgePoints } = this.data;
    const updated = currentKnowledgePoints.map(item => ({
      ...item,
      active: selectedKnowledgePoints.includes(item.value)
    }));
    this.setData({ currentKnowledgePoints: updated });
  },

  async startPractice() {
    try {
      const { practiceType } = this.data;
      
      if (practiceType === 'review') {
        const userId = wx.getStorageSync('userId') || 'default_user';
        
        // 直接使用导入的 DatabaseManager 实例
        const result = await DatabaseManager.getMistakes(userId, {
          page: 1,
          pageSize: 50,
          sortBy: 'createTime',
          sortOrder: 'desc'
        });
        
        if (result.success && result.data.length > 0) {
          // 跳转到答题页面
          wx.navigateTo({
            url: `/pages/practice/session?type=review&mistakes=${JSON.stringify(result.data)}`
          });
        } else {
          wx.showToast({
            title: '暂无错题可复习',
            icon: 'none'
          });
        }
      } else {
        // AI练习模式的处理
        wx.navigateTo({
          url: '/pages/practice/session?type=ai'
        });
      }
      
    } catch (error) {
      console.error('启动练习失败:', error);
      wx.showToast({
        title: '启动失败，请重试',
        icon: 'none'
      });
    }
  },

  // 测试AI练习功能
  async testAIPractice() {
    try {
      wx.showLoading({ title: '测试AI服务...' });
      
      const aiService = getApp().globalData.aiService;
      
      // 1. 测试题目生成服务
      console.log('1. 测试题目生成服务...');
      const testResult = await aiService.testQuestionGeneration();
      console.log('题目生成测试结果:', testResult);
      
      // 2. 测试基于错题生成练习题（如果有错题的话）
      const db = getApp().globalData.databaseManager;
      const mistakesResult = await db.getMistakes('default_user', { pageSize: 1 });
      
      if (mistakesResult.success && mistakesResult.data.length > 0) {
        console.log('2. 测试基于错题生成练习题...');
        const mistake = mistakesResult.data[0];
        
        const practiceResult = await aiService.generatePracticeFromMistake(mistake._id, {
          count: 3,
          types: ['single_choice', 'fill_blank']
        });
        
        console.log('练习题生成结果:', practiceResult);
        
        if (practiceResult.success) {
          // 3. 测试生成试卷
          console.log('3. 测试生成试卷...');
          const examResult = await aiService.generateExamPaper(practiceResult.questions, {
            title: '测试试卷',
            totalScore: 100,
            timeLimit: 30
          });
          
          console.log('试卷生成结果:', examResult);
        }
      }
      
      wx.hideLoading();
      wx.showToast({
        title: '测试完成，请查看控制台',
        icon: 'success'
      });
      
    } catch (error) {
      wx.hideLoading();
      console.error('AI练习功能测试失败:', error);
      wx.showToast({
        title: '测试失败: ' + error.message,
        icon: 'none'
      });
    }
  },

  // 生成试卷
  async generateExamPaper() {
    try {
      wx.showLoading({ title: '准备生成试卷...' });
      
      const userId = wx.getStorageSync('userId') || 'default_user';
      const mistakesResult = await DatabaseManager.getMistakes(userId, { pageSize: 10 });
      
      if (mistakesResult.success && mistakesResult.data.length > 0) {
        // 跳转到试卷页面
        const questionsData = encodeURIComponent(JSON.stringify(mistakesResult.data));
        wx.navigateTo({
          url: `/pages/practice/exam?questions=${questionsData}`
        });
      } else {
        // 生成示例试卷
        wx.navigateTo({
          url: '/pages/practice/exam'
        });
      }
      
      wx.hideLoading();
      
    } catch (error) {
      wx.hideLoading();
      console.error('生成试卷失败:', error);
      wx.showToast({
        title: '生成失败，请重试',
        icon: 'none'
      });
    }
  }
})
