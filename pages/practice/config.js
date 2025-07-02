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

  startPractice: function() {
    // 参数校验
    if (!this.data.selectedSubject) {
      wx.showToast({
        title: '请选择一个学科',
        icon: 'none'
      });
      return;
    }

    const { practiceType, selectedSubject, selectedCount, selectedDifficulty, selectedKnowledgePoints } = this.data;
    
    // 跳转到答题页面，并传递参数
    // 注意：答题页面 pages/practice/session 我们之后创建
    wx.navigateTo({
      url: `/pages/practice/session?type=${practiceType}&subject=${selectedSubject}&count=${selectedCount}&difficulty=${selectedDifficulty}&knowledge=${selectedKnowledgePoints.join(',')}`,
      success: () => {
        console.log('跳转到答题页，参数：', this.data);
      },
      fail: (err) => {
        console.error('跳转失败', err);
        wx.showToast({
          title: '功能开发中，敬请期待！',
          icon: 'none'
        });
      }
    });
  }
})