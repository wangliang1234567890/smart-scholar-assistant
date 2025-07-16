import LocalDB from '../../utils/local-db';
import { formatTime } from '../../utils/util';

const app = getApp()

Page({
  data: {
    // 基础数据
    weekText: '',
    viewMode: 'week', // week | day
    selectedDate: null,
    selectedDayCount: 0,
    
    // 日历相关
    weekDays: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
    currentWeekDates: [],
    showCalendar: false,
    calendarFormatter: null,
    
    // 课程数据
    todayCourses: [],
    allCourses: [],
    loading: false
  },

  onLoad(options) {
    console.log('课程表页面加载');
    this.initializeData();
    this.setData({
      calendarFormatter: this.formatCalendarDay.bind(this)
    });
  },

  onShow() {
    this.loadAllCourses();
    if (this.data.selectedDate) {
      this.loadCoursesForDate(this.data.selectedDate);
    }
  },

  // 初始化数据
  initializeData() {
    const today = new Date();
    const todayStr = this.formatDate(today);
    
    this.setData({
      selectedDate: todayStr,
      weekText: this.getWeekText(today)
    });
    
    this.generateCurrentWeek(today);
    this.initMockData();
  },

  // 生成当前周的日期数据
  generateCurrentWeek(baseDate) {
    const week = [];
    const today = new Date();
    const todayStr = this.formatDate(today);
    
    // 获取周一的日期
    const monday = new Date(baseDate);
    const dayOfWeek = monday.getDay();
    const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    monday.setDate(monday.getDate() + daysToMonday);
    
    // 生成一周的日期
    for (let i = 0; i < 7; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      const dateStr = this.formatDate(date);
      const courses = this.getCoursesByDate(dateStr);
      
      const dayData = {
        date: date.getDate(),
        fullDate: dateStr,
        isToday: dateStr === todayStr,
        isSelected: dateStr === this.data.selectedDate,
        hasCourse: courses.length > 0,
        courses: courses
      };
      
      console.log(`日期生成: ${i}`, dayData); // 调试日志
      week.push(dayData);
    }
    
    console.log('完整周数据:', week); // 调试日志
    
    this.setData({
      currentWeekDates: week,
      selectedDayCount: this.getCoursesByDate(this.data.selectedDate).length
    });
  },

  // 初始化模拟数据
  initMockData() {
    const today = new Date();
    const mockCourses = [
      {
        id: 1,
        name: '数学辅导',
        subject: 'math',
        subjectShort: '数',
        teacher: '张老师',
        teacherAvatar: '/images/default-avatar.png',
        location: '教室A101',
        startTime: '09:00',
        endTime: '10:30',
        duration: 90,
        date: this.formatDate(today),
        courseType: '线下课程',
        description: '小学数学基础知识复习，包括加减乘除运算、分数计算、几何图形认识等内容。通过练习题和互动游戏的方式，帮助学生巩固数学基础。',
        hasReminder: true
      },
      {
        id: 2,
        name: '英语口语',
        subject: 'english',
        subjectShort: '英',
        teacher: 'Lisa老师',
        teacherAvatar: '/images/default-avatar.png',
        location: '在线教室',
        startTime: '14:00',
        endTime: '15:00',
        duration: 60,
        date: this.formatDate(today),
        courseType: '在线课程',
        description: '英语口语练习和对话',
        hasReminder: true
      },
      // 明天的课程
      {
        id: 3,
        name: '语文阅读',
        subject: 'chinese',
        subjectShort: '语',
        teacher: '王老师',
        teacherAvatar: '/images/default-avatar.png',
        location: '教室B102',
        startTime: '10:00',
        endTime: '11:30',
        duration: 90,
        date: this.formatDate(new Date(today.getTime() + 24 * 60 * 60 * 1000)),
        courseType: '线下课程',
        description: '语文阅读理解训练',
        hasReminder: false
      }
    ];
    
    this.setData({ 
      allCourses: mockCourses,
      todayCourses: this.getCoursesByDate(this.data.selectedDate)
    });
    
    // 重新生成周视图以显示课程标记
    this.generateCurrentWeek(today);
  },

  // 格式化日期
  formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // 获取周文本
  getWeekText(date) {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    
    // 计算是第几周
    const firstDay = new Date(year, 0, 1);
    const dayOfYear = Math.floor((date - firstDay) / (24 * 60 * 60 * 1000)) + 1;
    const weekOfYear = Math.ceil(dayOfYear / 7);
    
    return `${year}年${month}月 第${weekOfYear}周`;
  },

  // 根据日期获取课程
  getCoursesByDate(dateStr) {
    return this.data.allCourses.filter(course => course.date === dateStr);
  },

  // 视图模式切换
  switchViewMode(e) {
    const mode = e.currentTarget.dataset.mode;
    this.setData({ viewMode: mode });
  },

  // 选择日期
  onDateSelect(e) {
    const date = e.currentTarget.dataset.date;
    const courses = this.getCoursesByDate(date);
    
    // 更新选中状态
    const updatedWeekDates = this.data.currentWeekDates.map(item => ({
      ...item,
      isSelected: item.fullDate === date
    }));
    
    this.setData({
      selectedDate: date,
      selectedDayCount: courses.length,
      todayCourses: courses,
      currentWeekDates: updatedWeekDates
    });
  },

  // 课程详情
  onCourseDetail(e) {
    const course = e.currentTarget.dataset.course;
    wx.navigateTo({
      url: `/pages/schedule/detail?id=${course.id}`
    });
  },

  // 添加课程
  navigateToAddCourse() {
    wx.navigateTo({
      url: '/pages/schedule/add'
    });
  },

  // 加载所有课程
  loadAllCourses() {
    // TODO: 从数据库加载课程
    console.log('加载所有课程');
  },

  // 加载指定日期的课程
  loadCoursesForDate(date) {
    const courses = this.getCoursesByDate(date);
    this.setData({
      todayCourses: courses,
      selectedDayCount: courses.length
    });
  },

  // 日历格式化
  formatCalendarDay(day) {
    const dateStr = this.formatDate(new Date(day.date));
    const courses = this.getCoursesByDate(dateStr);
    
    if (courses.length > 0) {
      day.bottomInfo = `${courses.length}课`;
    }
    
    if (day.type === 'today') {
      day.topInfo = '今天';
    }
    
    return day;
  },

  // 显示日历
  showCalendar() {
    this.setData({ showCalendar: true });
  },

  // 关闭日历
  onCloseCalendar() {
    this.setData({ showCalendar: false });
  },

  // 日历确认
  onConfirmCalendar(event) {
    const selectedDate = new Date(event.detail);
    const dateStr = this.formatDate(selectedDate);
    
    this.setData({
      showCalendar: false,
      selectedDate: dateStr,
      weekText: this.getWeekText(selectedDate)
    });
    
    this.generateCurrentWeek(selectedDate);
    this.loadCoursesForDate(dateStr);
  }
}) 