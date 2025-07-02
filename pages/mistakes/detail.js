// pages/mistakes/detail.js
const { formatTime } = require("../../utils/util.js");

Page({

  /**
   * 页面的初始数据
   */
  data: {
    mistakeId: null,
    mistake: null,
    isLoading: true,
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    if (options.id) {
      this.setData({
        mistakeId: options.id,
      });
      this.fetchMistakeDetail();
    } else {
      this.setData({ isLoading: false });
      wx.showToast({
        title: '无效的题目ID',
        icon: 'error'
      });
    }
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
    this.fetchMistakeDetail();
    wx.stopPullDownRefresh();
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

  fetchMistakeDetail() {
    this.setData({ isLoading: true });
    // TODO: 调用真实API获取数据
    // 模拟API调用
    setTimeout(() => {
      const mockData = this.getMockMistake(this.data.mistakeId);
      this.setData({
        mistake: mockData,
        isLoading: false,
      });
    }, 500);
  },

  handleDelete() {
    wx.showModal({
      title: '确认删除',
      content: '删除后将无法恢复，确定要删除这条错题吗？',
      success: (res) => {
        if (res.confirm) {
          console.log('用户点击确定');
          // TODO: 调用API删除
          wx.showLoading({ title: '删除中...' });
          setTimeout(() => {
            wx.hideLoading();
            wx.showToast({ title: '删除成功' });
            // 返回上一页并通知刷新
            const pages = getCurrentPages();
            const prevPage = pages[pages.length - 2];
            if (prevPage && prevPage.route === 'pages/mistakes/mistakes') {
              prevPage.refreshData();
            }
            wx.navigateBack();
          }, 500);
        }
      },
    });
  },

  handleEdit() {
    // 跳转到编辑页面
    wx.navigateTo({
      url: `/pages/mistakes/add?id=${this.data.mistakeId}`,
    });
  },

  handleAddToReview() {
    const mistake = this.data.mistake;
    if (!mistake) {
      wx.showToast({
        title: '错题信息错误',
        icon: 'error'
      });
      return;
    }

    // 检查错题状态
    if (mistake.status === 'mastered') {
      wx.showModal({
        title: '已掌握题目',
        content: '该错题已标记为已掌握，是否要重新加入复习计划？',
        success: (res) => {
          if (res.confirm) {
            this.showReviewPlanOptions();
          }
        }
      });
      return;
    }

    // 检查是否已经在复习计划中
    const now = new Date();
    const nextReviewTime = mistake.nextReviewTime ? new Date(mistake.nextReviewTime) : null;
    
    if (nextReviewTime && nextReviewTime > now) {
      wx.showModal({
        title: '已在复习计划中',
        content: `该错题已安排在 ${mistake.nextReviewTime} 复习，是否要重新安排复习时间？`,
        success: (res) => {
          if (res.confirm) {
            this.showReviewPlanOptions();
          }
        }
      });
    } else {
      this.showReviewPlanOptions();
    }
  },

  showReviewPlanOptions() {
    // 显示复习计划选择弹窗
    wx.showActionSheet({
      itemList: [
        '立即加入今日复习',
        '3天后复习',
        '1周后复习',
        '2周后复习',
        '1个月后复习'
      ],
      success: (res) => {
        this.addToReviewPlan(res.tapIndex);
      },
      fail: () => {
        console.log('用户取消选择');
      }
    });
  },

  addToReviewPlan(planIndex) {
    const mistake = this.data.mistake;
    const reviewTimes = [
      0,           // 立即复习
      3,           // 3天后
      7,           // 1周后  
      14,          // 2周后
      30           // 1个月后
    ];
    
    const days = reviewTimes[planIndex];
    const reviewTime = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    
    wx.showLoading({ title: '加入复习计划...' });
    
    // TODO: 调用真实API更新复习时间
    setTimeout(() => {
      wx.hideLoading();
      
      // 更新本地数据
      const updatedMistake = {
        ...mistake,
        nextReviewTime: formatTime(reviewTime),
        status: days === 0 ? 'reviewing' : mistake.status,
        lastReviewTime: days === 0 ? formatTime(new Date()) : mistake.lastReviewTime
      };
      
      this.setData({
        mistake: updatedMistake
      });
      
      const timeText = days === 0 ? '今日复习计划' : 
                      days === 3 ? '3天后' :
                      days === 7 ? '1周后' :
                      days === 14 ? '2周后' : '1个月后';
      
      wx.showToast({
        title: `已加入${timeText}`,
        icon: 'success'
      });
      
      // 如果是立即复习，可以跳转到复习页面
      if (days === 0) {
        setTimeout(() => {
          wx.showModal({
            title: '开始复习',
            content: '是否立即开始复习这道错题？',
            success: (res) => {
              if (res.confirm) {
                // 跳转到复习页面
                wx.navigateTo({
                  url: `/pages/practice/config?type=review&mistakeId=${mistake._id}`
                });
              }
            }
          });
        }, 1500);
      }
    }, 500);
  },

  // --- Mock数据生成 ---
  getMockMistake(id) {
    // 模拟难度和状态的文本转换
    const difficultyMap = {1: '简单', 2: '中等', 3: '困难'};
    const statusMap = {new: '新录入', reviewing: '复习中', mastered: '已掌握'};
    
    // 模拟一条详细数据
    const detail = {
      _id: id,
      question: `这是题目ID为 ${id} 的模拟错题。题目内容是关于二次函数 y = ax^2 + bx + c 的性质判断，请找出下列描述中错误的一项。`,
      imageUrl: 'https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/2c13b73cde894371a39a046c82334888~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1080&h=1080&s=134887&e=png&f=1080',
      answer: '选项C是错误的。因为当 a > 0 时，抛物线开口向上，函数有最小值，没有最大值。',
      analysis: '本题考查二次函数的基本性质。需要掌握开口方向、对称轴、顶点坐标以及单调性等核心知识点。根据题目给出的函数，可以逐一判断选项的正确性。',
      subject: '数学',
      difficulty: 2,
      status: 'reviewing',
      createTime: formatTime(new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)), // 模拟2天前创建
      reviewCount: 3,
      lastReviewTime: formatTime(new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)), // 模拟1天前复习
      nextReviewTime: formatTime(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)), // 模拟3天后复习
    };

    // 添加转换后的文本
    detail.difficultyText = difficultyMap[detail.difficulty];
    detail.statusText = statusMap[detail.status];

    return detail;
  }
})