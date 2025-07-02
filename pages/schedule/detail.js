Page({
  data: {
    courseId: null,
    course: null,
    isLoading: true,
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ courseId: options.id });
      this.fetchCourseDetail();
    } else {
      this.setData({ isLoading: false });
      wx.showToast({ title: '无效的课程ID', icon: 'error' });
    }
  },

  fetchCourseDetail() {
    this.setData({ isLoading: true });
    // 模拟API调用
    setTimeout(() => {
      this.setData({
        course: this.getMockCourse(this.data.courseId),
        isLoading: false,
      });
    }, 500);
  },

  editNotes() {
    wx.showToast({ title: '功能开发中', icon: 'none' });
  },

  manageHomework() {
    wx.showToast({ title: '功能开发中', icon: 'none' });
  },

  handleDelete() {
    wx.showModal({
      title: '确认删除',
      content: '删除后将无法恢复，确定要删除这个课程吗？',
      success: (res) => {
        if (res.confirm) {
          // TODO: 调用API删除
          wx.showLoading({ title: '删除中...' });
          setTimeout(() => {
            wx.hideLoading();
            wx.showToast({ title: '删除成功' });
            // 返回并刷新
            const pages = getCurrentPages();
            const prevPage = pages[pages.length - 2];
            if (prevPage) {
              prevPage.onLoad();
            }
            wx.navigateBack();
          }, 500);
        }
      },
    });
  },

  handleEdit() {
    wx.navigateTo({
      url: `/pages/schedule/add?id=${this.data.courseId}`,
    });
  },
  
  onPullDownRefresh() {
    this.fetchCourseDetail();
    wx.stopPullDownRefresh();
  },

  // --- Mock数据生成 ---
  getMockCourse(id) {
    return {
      id: id,
      name: '数学培优班（模拟数据）',
      teacher: '王老师',
      location: '学而思教育（XX路店）',
      date: '2024-05-22',
      startTime: '15:00',
      endTime: '17:00',
      statusText: '进行中',
      notes: '今天学习了小数的四则运算，重点掌握了除法部分。孩子在带余数的除法上还有些问题，需要多加练习。',
      homework: '完成《口算天天练》第25页。',
    };
  }
}); 