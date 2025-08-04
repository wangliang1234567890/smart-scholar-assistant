import LocalDB from '../../utils/local-db';
import { formatTime } from '../../utils/util';
import DatabaseManager from '../../utils/database.js';

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
    loading: false,
    
    // 统计数据
    courseStats: {
      today: 0,
      tomorrow: 0,
      total: 0
    }
  },

  onLoad(options) {
    console.log('课程表页面加载');
    this.initializeData();
    this.setData({
      calendarFormatter: this.formatCalendarDay.bind(this)
    });
  },

  onShow() {
    // 更新tabBar状态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({
        selected: 4 // 课程表是第5个tab（索引4）
      });
    }
    
    // 刷新数据
    this.loadScheduleData();
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
    this.loadScheduleData();
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

  // 加载课程表数据 - 优化后的真实数据加载
  async loadScheduleData() {
    console.log('开始加载课程表数据...');
    
    try {
      this.setData({ loading: true });
      
      const userId = DatabaseManager.getCurrentUserId();
      
      // 计算日期范围（当前周）
      const startDate = this.formatDate(this.data.currentWeekDates[0]);
      const endDate = this.formatDate(this.data.currentWeekDates[6]);
      
      // 并行加载课程数据和统计数据
      const [coursesResult, statsResult, todayCoursesResult] = await Promise.all([
        DatabaseManager.getCourses(userId, {
          startDate,
          endDate,
          pageSize: 100
        }),
        DatabaseManager.getCourseStats(userId),
        DatabaseManager.getCoursesByDate(userId, this.formatDate(this.data.selectedDate))
      ]);
      
      // 处理课程列表
      if (coursesResult.success) {
        const allCourses = this.processCourseData(coursesResult.data);
        this.setData({ allCourses });
        console.log('课程列表加载成功:', allCourses.length, '条');
      } else {
        console.warn('课程列表加载失败:', coursesResult.message);
        this.setData({ allCourses: [] });
      }
      
      // 处理统计数据
      if (statsResult.success) {
        this.setData({ 
          courseStats: {
            today: statsResult.data.todayCourses,
            tomorrow: statsResult.data.tomorrowCourses,
            total: statsResult.data.totalCourses
          }
        });
        console.log('课程统计加载成功:', statsResult.data);
      }
      
      // 处理今日课程
      if (todayCoursesResult.success) {
        const todayCourses = this.processCourseData(todayCoursesResult.data);
        this.setData({ todayCourses });
        console.log('今日课程加载成功:', todayCourses.length, '条');
      } else {
        this.setData({ todayCourses: [] });
      }
      
      // 重新生成周视图以显示课程标记
      this.generateCurrentWeek(this.data.selectedDate);
      
    } catch (error) {
      console.error('加载课程表数据失败:', error);
      wx.showToast({
        title: '加载失败，请重试',
        icon: 'none'
      });
      
      // 设置空数据
      this.setData({ 
        allCourses: [],
        todayCourses: [],
        courseStats: { today: 0, tomorrow: 0, total: 0 }
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  /**
   * 处理课程数据，确保格式统一
   */
  processCourseData(rawCourses) {
    if (!Array.isArray(rawCourses)) {
      return [];
    }
    
    return rawCourses.map(course => {
      // 确保课程数据格式正确
      return {
        _id: course._id,
        name: course.name || '未命名课程',
        subject: course.subject || 'other',
        teacher: course.teacher || '',
        date: course.date,
        startTime: course.startTime || '09:00',
        endTime: course.endTime || '10:30',
        location: course.location || '',
        courseType: course.courseType || 'offline',
        description: course.description || '',
        reminderEnabled: course.reminderEnabled !== false,
        repeatEnabled: course.repeatEnabled === true,
        status: course.status || 'active',
        createTime: course.createTime || course.createdAt,
        updateTime: course.updateTime || course.updatedAt
      };
    });
  },

  // 格式化日期
  formatDate(date) {
    if (!date) return '';
    
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
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
      url: `/pages/schedule/detail?id=${course._id}`
    });
  },

  // 添加课程
  navigateToAddCourse() {
    wx.navigateTo({
      url: '/pages/schedule/add'
    });
  },

  // 加载所有课程 - 优化后的实现
  async loadAllCourses() {
    console.log('加载所有课程...');
    
    try {
      const userId = DatabaseManager.getCurrentUserId();
      
      const result = await DatabaseManager.getCourses(userId, {
        pageSize: 1000 // 获取更多课程
      });
      
      if (result.success) {
        const allCourses = this.processCourseData(result.data);
        this.setData({ allCourses });
        console.log('所有课程加载完成:', allCourses.length, '条');
        
        // 更新当前选中日期的课程
        this.loadCoursesForDate(this.data.selectedDate);
      } else {
        console.warn('加载所有课程失败:', result.message);
      }
      
    } catch (error) {
      console.error('加载所有课程失败:', error);
    }
  },

  // 加载指定日期的课程 - 优化后的实现
  async loadCoursesForDate(date) {
    if (!date) return;
    
    try {
      const userId = DatabaseManager.getCurrentUserId();
      const dateStr = this.formatDate(date);
      
      const result = await DatabaseManager.getCoursesByDate(userId, dateStr);
      
      if (result.success) {
        const courses = this.processCourseData(result.data);
        this.setData({ 
          todayCourses: courses,
          selectedDayCount: courses.length
        });
        console.log(`${dateStr} 的课程:`, courses.length, '条');
      } else {
        this.setData({ 
          todayCourses: [],
          selectedDayCount: 0
        });
      }
      
    } catch (error) {
      console.error('加载指定日期课程失败:', error);
      this.setData({ 
        todayCourses: [],
        selectedDayCount: 0
      });
    }
  },

  /**
   * 获取指定日期的课程数量（用于日历标记）
   */
  getCourseCountForDate(date) {
    const dateStr = this.formatDate(date);
    return this.data.allCourses.filter(course => course.date === dateStr).length;
  },

  /**
   * 删除课程
   */
  async deleteCourse(courseId) {
    try {
      wx.showLoading({ title: '删除中...' });
      
      const result = await DatabaseManager.deleteCourse(courseId);
      
      if (result.success) {
        wx.showToast({
          title: '删除成功',
          icon: 'success'
        });
        
        // 刷新数据
        this.loadScheduleData();
      } else {
        throw new Error(result.message || '删除失败');
      }
      
    } catch (error) {
      console.error('删除课程失败:', error);
      wx.showToast({
        title: '删除失败',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
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