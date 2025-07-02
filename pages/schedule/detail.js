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
    // TODO: 调用真实API获取数据
    // 模拟API调用
    setTimeout(() => {
      const mockData = this.getMockCourse(this.data.courseId);
      this.setData({
        course: mockData,
        isLoading: false,
      });
    }, 500);
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

  // --- Mock数据生成 ---
  getMockCourse(id) {
    // 模拟一条详细数据
    const detail = {
      id: id,
      name: '数学辅导',
      subject: 'math',
      subjectShort: '数',
      teacher: '张老师',
      teacherAvatar: '/images/default-avatar.png',
      location: '教室A101',
      startTime: '09:00',
      endTime: '10:30',
      duration: 90,
      courseType: '线下课程',
      status: 'ongoing',
      statusText: '进行中',
      
      // 新增的课程统计数据
      completedLessons: 8,
      totalLessons: 12,
      completionRate: 67,
      
      // 课程详细信息
      scheduleTime: '2025-07-01 09:00-10:30',
      description: '小学数学基础知识复习，包括加减乘除运算、分数计算、几何图形认识等内容。通过练习题和互动游戏的方式，帮助学生巩固数学基础。',
      
      // 课后作业
      homework: [
        {
          id: 1,
          title: '完成练习册第15-18页',
          completed: true
        },
        {
          id: 2,
          title: '背诵乘法口诀表',
          completed: false
        },
        {
          id: 3,
          title: '预习下节课内容',
          completed: false
        }
      ],
      
      // 所需材料
      materials: [
        {
          name: '数学练习册',
          type: '教材'
        },
        {
          name: '计算器',
          type: '工具'
        },
        {
          name: '草稿纸',
          type: '文具'
        },
        {
          name: '文具',
          type: '文具'
        }
      ],
      
      // 提醒设置
      reminderEnabled: true
    };

    return detail;
  }
}); 