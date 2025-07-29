const { formatTime } = require("../../utils/util.js");

Page({
  data: {
    courseId: null,
    course: null,
    isLoading: true,
  },

  onLoad(options) {
    if (options.id) {
      this.setData({
        courseId: options.id,
      });
      this.fetchCourseDetail();
    } else {
      this.setData({ isLoading: false });
      wx.showToast({
        title: '无效的课程ID',
        icon: 'error'
      });
    }
  },

  onReady() {

  },

  onShow() {

  },

  onHide() {

  },

  onUnload() {

  },

  onPullDownRefresh() {
    this.fetchCourseDetail();
    wx.stopPullDownRefresh();
  },

  onReachBottom() {

  },

  onShareAppMessage() {

  },

  // 获取课程详情
  fetchCourseDetail() {
    this.setData({ isLoading: true });
    
    try {
      // 目前没有课程数据库，显示暂无课程
      console.log('课程详情暂无数据，课程ID:', this.data.courseId);
      
      setTimeout(() => {
        this.setData({
          course: null,
          isLoading: false,
        });
        
        wx.showModal({
          title: '暂无课程',
          content: '当前还没有添加任何课程，请先添加课程后再查看详情。',
          showCancel: false,
          confirmText: '返回',
          success: () => {
            wx.navigateBack();
          }
        });
      }, 300);
    } catch (error) {
      console.error('获取课程详情失败:', error);
      this.setData({ isLoading: false });
    }
  },

  // 返回上一页
  goBack() {
    wx.navigateBack();
  },

  // 切换作业完成状态
  toggleHomework(e) {
    const id = e.currentTarget.dataset.id;
    const course = this.data.course;
    const homework = course.homework.map(item => {
      if (item.id === id) {
        return { ...item, completed: !item.completed };
      }
      return item;
    });

    this.setData({
      'course.homework': homework
    });

    wx.showToast({
      title: homework.find(item => item.id === id).completed ? '已完成' : '取消完成',
      icon: 'success'
    });
  },

  // 提醒设置切换
  onReminderToggle(e) {
    const enabled = e.detail;
    this.setData({
      'course.reminderEnabled': enabled
    });

    wx.showToast({
      title: enabled ? '已开启提醒' : '已关闭提醒',
      icon: 'success'
    });
  },

  // 删除课程
  handleDelete() {
    wx.showModal({
      title: '确认删除',
      content: '删除后将无法恢复，确定要删除这个课程吗？',
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
            if (prevPage && prevPage.route === 'pages/schedule/schedule') {
              prevPage.loadAllCourses && prevPage.loadAllCourses();
            }
            wx.navigateBack();
          }, 500);
        }
      },
    });
  },

  // 编辑课程
  handleEdit() {
    // 跳转到编辑页面
    wx.navigateTo({
      url: `/pages/schedule/add?id=${this.data.courseId}`,
    });
  },


}); 