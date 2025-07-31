import DatabaseManager from '../../utils/database.js';

// 或者如果使用 CommonJS 方式
// const DatabaseManager = require('../../utils/database.js');

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
    console.log('错题详情页面加载，参数:', options);
    if (options.id) {
      console.log('接收到错题ID:', options.id);
      this.setData({
        mistakeId: options.id,
      });
      this.fetchMistakeDetail();
    } else {
      console.error('缺少错题ID参数');
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

  async fetchMistakeDetail() {
    this.setData({ isLoading: true });
    
    try {
      // 替换模拟数据，使用真实的数据库调用
      const result = await DatabaseManager.getMistakeById(this.data.mistakeId);
      
      if (result.success) {
        this.setData({
          mistake: result.data,
          isLoading: false,
        });
      } else {
        throw new Error(result.error || '加载失败');
      }
      
    } catch (error) {
      console.error('获取错题详情失败:', error);
      this.setData({ isLoading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  async handleDelete() {
    wx.showModal({
      title: '确认删除',
      content: '删除后将无法恢复，确定要删除这条错题吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({ title: '删除中...' });
            
            // 使用真实的数据库删除
            const result = await DatabaseManager.deleteMistake(this.data.mistakeId);
            
            wx.hideLoading();
            
            if (result.success) {
              wx.showToast({ title: '删除成功' });
              
              // 通知上一页刷新数据
              const pages = getCurrentPages();
              const prevPage = pages[pages.length - 2];
              if (prevPage && prevPage.route === 'pages/mistakes/mistakes') {
                prevPage.refreshData && prevPage.refreshData();
              }
              
              setTimeout(() => wx.navigateBack(), 1500);
            } else {
              throw new Error(result.error);
            }
            
          } catch (error) {
            wx.hideLoading();
            wx.showToast({ title: '删除失败', icon: 'none' });
          }
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
    console.log('点击加入复习计划按钮');
    const mistake = this.data.mistake;
    
    if (!mistake) {
      console.error('错题数据为空:', mistake);
      wx.showToast({
        title: '错题信息错误',
        icon: 'error'
      });
      return;
    }

    console.log('当前错题信息:', mistake);

    // 检查错题状态
    if (mistake.status === 'mastered') {
      console.log('错题已掌握，询问是否重新加入');
      wx.showModal({
        title: '已掌握题目',
        content: '该错题已标记为已掌握，是否要重新加入复习计划？',
        success: (res) => {
          if (res.confirm) {
            console.log('用户确认重新加入复习计划');
            this.showReviewPlanOptions();
          }
        }
      });
      return;
    }

    // 检查是否已经在复习计划中
    const now = new Date();
    const nextReviewTime = mistake.nextReviewTime ? new Date(mistake.nextReviewTime) : null;
    
    console.log('检查复习时间:', { nextReviewTime, now });
    
    if (nextReviewTime && nextReviewTime > now) {
      console.log('错题已在复习计划中，询问是否重新安排');
      wx.showModal({
        title: '已在复习计划中',
        content: `该错题已安排在 ${mistake.nextReviewTime} 复习，是否要重新安排复习时间？`,
        success: (res) => {
          if (res.confirm) {
            console.log('用户确认重新安排复习时间');
            this.showReviewPlanOptions();
          }
        }
      });
    } else {
      console.log('显示复习计划选项');
      this.showReviewPlanOptions();
    }
  },

  showReviewPlanOptions() {
    console.log('显示复习计划选项弹窗');
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
        console.log('用户选择了复习计划:', res.tapIndex);
        this.addToReviewPlan(res.tapIndex);
      },
      fail: (error) => {
        console.log('用户取消选择或弹窗失败:', error);
      }
    });
  },

  async addToReviewPlan(planIndex) {
    const mistake = this.data.mistake;
    const reviewTimes = [
      0,           // 立即复习
      3,           // 3天后
      7,           // 1周后  
      14,          // 2周后
      30           // 1个月后
    ];
    
    const days = reviewTimes[planIndex];
    
    wx.showLoading({ title: '加入复习计划...' });
    console.log('开始添加复习计划:', { mistakeId: mistake._id, days });
    
    try {
      // 调用真实的数据库API
      const result = await DatabaseManager.addToReviewPlan(mistake._id, { days });
      
      wx.hideLoading();
      
      if (result.success) {
        console.log('复习计划添加成功:', result);
        
        // 重新获取最新数据
        await this.fetchMistakeDetail();
      
      const timeText = days === 0 ? '今日复习计划' : 
                      days === 3 ? '3天后' :
                      days === 7 ? '1周后' :
                      days === 14 ? '2周后' : '1个月后';
      
      wx.showToast({
        title: `已加入${timeText}`,
        icon: 'success'
      });
      
        // 如果是立即复习，询问是否开始复习
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
      } else {
        throw new Error(result.error || '添加复习计划失败');
      }
      
    } catch (error) {
      console.error('添加复习计划失败:', error);
      wx.hideLoading();
      wx.showToast({ 
        title: '操作失败: ' + (error.message || '未知错误'), 
        icon: 'none',
        duration: 3000
      });
    }
  },



  startReview() {
    const { mistake } = this.data;
    if (!mistake) return;
    
    wx.showModal({
      title: '开始复习',
      content: '请在心中默答这道题，然后点击确定查看答案',
      success: (res) => {
        if (res.confirm) {
          this.showAnswer();
        }
      }
    });
  },

  showAnswer() {
    const { mistake } = this.data;
    wx.showModal({
      title: '正确答案',
      content: `答案：${mistake.answer}\n\n${mistake.analysis ? '解析：' + mistake.analysis : ''}`,
      confirmText: '答对了',
      cancelText: '答错了',
      success: (res) => {
        this.recordReviewResult(res.confirm);
      }
    });
  },

  async recordReviewResult(isCorrect) {
    try {
      // 更新复习记录
      const reviewData = {
        mistakeId: this.data.mistakeId,
        isCorrect,
        reviewTime: new Date().toISOString()
      };
      
      await DatabaseManager.addReviewRecord(reviewData);
      
      // 如果答对了，更新错题状态
      if (isCorrect) {
        const newStatus = this.data.mistake.reviewCount >= 2 ? 'mastered' : 'reviewing';
        await DatabaseManager.updateMistakeStatus(this.data.mistakeId, newStatus);
        
        wx.showToast({ 
          title: isCorrect ? '很棒！继续加油' : '再接再厉', 
          icon: 'success' 
        });
        
        // 重新加载数据
        this.fetchMistakeDetail();
      }
      
    } catch (error) {
      console.error('记录复习结果失败:', error);
    }
  },

  // 备用方法：直接加入今日复习计划
  async addToTodayReviewPlan() {
    const mistake = this.data.mistake;
    if (!mistake || !mistake._id) {
      wx.showToast({ title: '错题信息错误', icon: 'error' });
      return;
    }
    
    wx.showModal({
      title: '加入复习计划',
      content: '将此题目加入今日复习计划？',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '加入复习计划...' });
          console.log('直接加入今日复习计划:', mistake._id);
          
          try {
            const result = await DatabaseManager.addToReviewPlan(mistake._id, { days: 0 });
            wx.hideLoading();
            
            if (result.success) {
              console.log('今日复习计划添加成功:', result);
              await this.fetchMistakeDetail(); // 重新获取最新数据
              wx.showToast({ title: '已加入今日复习计划', icon: 'success' });
            } else {
              throw new Error(result.error || '添加失败');
            }
          } catch (error) {
            console.error('加入今日复习计划失败:', error);
            wx.hideLoading();
            wx.showToast({ 
              title: '操作失败: ' + (error.message || '未知错误'), 
              icon: 'none',
              duration: 3000 
            });
          }
        }
      }
    });
  }
})
