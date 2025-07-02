import LocalDB from '../../utils/local-db';

const app = getApp()

Page({
  data: {
    title: '课程表',
    subtitle: '', // 将由js动态生成
    selectedFullDate: null,
    swiperWeeks: [],
    swiperCurrent: 1,
    baseDateForSwiper: new Date(),
    todayCourses: [], // 先设置为空数组
    allCourses: [], // 存放所有模拟课程
    loading: false,
    showCalendar: false, // 控制全屏日历的显示
    calendarFormatter: null, // 日历格式化函数
  },

  onLoad(options) {
    this.initMockData();
    this.updateSwiperWeeks(new Date());
    this.setData({
      calendarFormatter: this.formatCalendarDay.bind(this)
    });
  },

  onShow() {
    const { selectedFullDate } = this.data;
    if (selectedFullDate) {
      this.loadCoursesForDate(selectedFullDate);
    }
  },

  initMockData() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const todayDate = String(today.getDate()).padStart(2, '0');

    // 创建今天和明天的课程
    const mockCourses = [
      {
        id: 1,
        date: `${year}-${month}-${todayDate}`,
        name: '数学培优班',
        teacher: '王老师',
        location: '学而思教育中心',
        startTime: '15:00',
        endTime: '17:00',
      },
      {
        id: 2,
        date: `${year}-${month}-${todayDate}`,
        name: '英语口语课',
        teacher: 'Jessica',
        location: '在线教室',
        startTime: '19:00',
        endTime: '20:30',
      },
      {
        id: 3,
        date: new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10), // 明天
        name: '编程思维训练',
        teacher: '李老师',
        location: '少年宫302',
        startTime: '10:00',
        endTime: '11:30',
      }
    ];
    this.setData({ allCourses: mockCourses });
  },

  formatCalendarDay(day) {
    const date = new Date(day.date);
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

    const hasCourse = this.data.allCourses.some(course => course.date === dateStr);

    if (hasCourse) {
      day.bottomInfo = '有课';
    }

    if (day.type === 'today') {
      day.topInfo = '今天';
    }

    return day;
  },

  formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // 核心函数：生成包含上一周、当前周、下一周数据的数组
  updateSwiperWeeks(baseDate) {
    const weeks = [-1, 0, 1].map(offset => {
      const date = new Date(baseDate);
      date.setDate(date.getDate() + offset * 7);
      return this.generateWeekData(date);
    });

    const todayStr = this.formatDate(new Date());
    this.setData({
      swiperWeeks: weeks,
      baseDateForSwiper: baseDate,
      selectedFullDate: this.data.selectedFullDate || todayStr,
    }, () => {
      if (!this.data.todayCourses.length) {
        this.loadCoursesForDate(this.data.selectedFullDate);
      }
    });
  },

  // 生成单周的数据
  generateWeekData(baseDate) {
    const days = ['一', '二', '三', '四', '五', '六', '日'];
    const weekData = { weekId: Math.random(), days: [] };
    const startOfWeek = new Date(baseDate);
    const dayOffset = startOfWeek.getDay() === 0 ? -6 : 1 - startOfWeek.getDay();
    startOfWeek.setDate(startOfWeek.getDate() + dayOffset);
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      const fullDateStr = this.formatDate(date);
      const hasCourse = this.data.allCourses.some(c => c.date === fullDateStr);
      weekData.days.push({
        dayName: `周${days[i]}`,
        date: date.getDate(),
        fullDate: fullDateStr,
        hasCourse: hasCourse,
      });
    }
    return weekData;
  },

  // Swiper 滑动事件
  onSwiperChange(e) {
    const { current, source } = e.detail;
    if (source === 'touch') {
      const newBaseDate = new Date(this.data.baseDateForSwiper);
      if (current === 0) { // Swiped left
        newBaseDate.setDate(newBaseDate.getDate() - 7);
      } else if (current === 2) { // Swiped right
        newBaseDate.setDate(newBaseDate.getDate() + 7);
      }
      this.updateSwiperWeeks(newBaseDate);
      this.setData({ swiperCurrent: 1 }); // Reset to middle
    }
  },

  onDateSelect(e) {
    const fullDate = e.currentTarget.dataset.date;
    this.setData({ selectedFullDate: fullDate });
    this.loadCoursesForDate(fullDate);
  },

  onConfirmCalendar(event) {
    const selectedDateObj = event.detail;
    this.updateSwiperWeeks(selectedDateObj);
    this.setData({ 
      showCalendar: false,
      selectedFullDate: this.formatDate(selectedDateObj),
    });
    this.loadCoursesForDate(this.formatDate(selectedDateObj));
  },

  navigateToAddCourse() {
    wx.navigateTo({
      url: '/pages/schedule/add',
    });
  },

  loadCoursesForDate(date) {
    // 这里应是从数据库加载课程的真实逻辑
    console.log(`正在为日期 ${date} 加载课程...`);
    const courses = this.data.allCourses.filter(c => c.date === date);
    this.setData({ todayCourses: courses });
  },

  // 课程详情
  onCourseDetail(e) {
    const { course } = e.currentTarget.dataset
    wx.navigateTo({
      url: `/pages/schedule/detail?id=${course.id}`
    })
  },

  // 导航到课程地点
  onNavigation(e) {
    e.stopPropagation()
    const { course } = e.currentTarget.dataset
    
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        wx.openLocation({
          latitude: res.latitude,
          longitude: res.longitude,
          name: course.location,
          address: course.location
        })
      },
      fail: () => {
        wx.showToast({
          title: '获取位置失败',
          icon: 'none'
        })
      }
    })
  },

  // 记笔记
  onTakeNotes(e) {
    e.stopPropagation()
    const { course } = e.currentTarget.dataset
    
    wx.navigateTo({
      url: `/pages/notes/edit?courseId=${course.id}&courseName=${course.name}`
    })
  },

  // 打开日历
  onCalendar() {
    wx.showActionSheet({
      itemList: ['查看月历', '选择日期范围', '导出课程表'],
      success: (res) => {
        switch(res.tapIndex) {
          case 0:
            this.showMonthCalendar()
            break
          case 1:
            this.selectDateRange()
            break
          case 2:
            this.exportSchedule()
            break
        }
      }
    })
  },

  // 显示月历
  showMonthCalendar() {
    wx.showToast({
      title: '功能开发中',
      icon: 'none'
    })
  },

  // 选择日期范围
  selectDateRange() {
    wx.showToast({
      title: '功能开发中',
      icon: 'none'
    })
  },

  // 导出课程表
  exportSchedule() {
    wx.showToast({
      title: '功能开发中',
      icon: 'none'
    })
  },

  // 显示/隐藏全屏日历
  showCalendar() {
    this.setData({ showCalendar: true });
  },

  onCloseCalendar() {
    this.setData({ showCalendar: false });
  },
}) 