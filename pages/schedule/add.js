const { formatTime } = require("../../utils/util.js");
import LocalDB from '../../utils/local-db';
import DatabaseManager from '../../utils/database';

Page({
  data: {
    formData: {
      name: '',
      subject: 'math', // 默认选择数学
      teacher: '',
      date: '',
      startTime: '09:00',
      endTime: '10:30',
      location: '',
      courseType: 'offline', // 默认选择线下课程
      description: '',
      reminderEnabled: true,
      repeatEnabled: false,
    },
    
    // 科目数据
    subjects: [
      { value: 'math', name: '数学', short: '数' },
      { value: 'chinese', name: '语文', short: '语' },
      { value: 'english', name: '英语', short: '英' },
      { value: 'science', name: '科学', short: '科' },
      { value: 'art', name: '美术', short: '美' },
      { value: 'music', name: '音乐', short: '音' },
    ],
    
    // 课程类型数据
    courseTypes: [
      { value: 'offline', name: '线下课程' },
      { value: 'online', name: '在线课程' },
      { value: 'experiment', name: '实验课程' },
      { value: 'outdoor', name: '户外活动' },
    ],
    
    // 选择器相关
    showDatePicker: false,
    showTimePicker: false,
    currentTimeType: '', // 'startTime' 或 'endTime'
    datePickerValue: new Date(),
    timePickerValue: '09:00', // 修复：时间选择器需要字符串格式
    minDate: new Date(),
    
    // 日期格式化器
    dateFormatter(type, value) {
      if (type === 'year') {
        return `${value}年`;
      }
      if (type === 'month') {
        return `${value}月`;
      }
      return value;
    },
  },

  onLoad(options) {
    // 如果是编辑模式，加载现有数据
    if (options.id) {
      this.loadCourseData(options.id);
    }
    
    // 设置默认日期为今天
    this.setData({
      'formData.date': formatTime(new Date(), 'yyyy-MM-dd')
    });
  },

  // 输入框变化
  onFieldChange(e) {
    const { field } = e.currentTarget.dataset;
    const value = e.detail.value || e.detail;
    this.setData({
      [`formData.${field}`]: value
    });
  },

  // 选择科目
  selectSubject(e) {
    const { value } = e.currentTarget.dataset;
    this.setData({
      'formData.subject': value
    });
  },

  // 选择课程类型
  selectCourseType(e) {
    const { value } = e.currentTarget.dataset;
    this.setData({
      'formData.courseType': value
    });
  },

  // 提醒开关切换
  onReminderToggle(e) {
    this.setData({
      'formData.reminderEnabled': e.detail
    });
  },

  // 重复开关切换
  onRepeatToggle(e) {
    this.setData({
      'formData.repeatEnabled': e.detail
    });
  },

  // --- 日期选择器 ---
  showDatePicker() {
    const currentDate = this.data.formData.date ? 
      new Date(this.data.formData.date) : 
      new Date();
    
    this.setData({
      showDatePicker: true,
      datePickerValue: currentDate
    });
  },

  hideDatePicker() {
    this.setData({
      showDatePicker: false
    });
  },

  onDateConfirm(e) {
    const date = formatTime(new Date(e.detail), 'yyyy-MM-dd');
    this.setData({
      'formData.date': date,
      showDatePicker: false
    });
  },

  // --- 时间选择器 ---
  showTimePicker(e) {
    const { type } = e.currentTarget.dataset;
    const currentTime = this.data.formData[type];
    const [hour, minute] = currentTime.split(':');
    const date = new Date();
    date.setHours(parseInt(hour), parseInt(minute));
    
    this.setData({
      showTimePicker: true,
      currentTimeType: type,
      timePickerValue: date
    });
  },

  hideTimePicker() {
    this.setData({
      showTimePicker: false
    });
  },

  onTimeConfirm(e) {
    const time = e.detail;
    const { currentTimeType } = this.data;
    
    this.setData({
      [`formData.${currentTimeType}`]: time,
      showTimePicker: false
    });
  },

  // --- 表单提交 ---
  async handleSubmit() {
    const { name, subject, date, startTime, endTime } = this.data.formData;
    
    // 表单验证
    if (!name.trim()) {
      wx.showToast({ title: '请输入课程名称', icon: 'none' });
      return;
    }
    if (!date) {
      wx.showToast({ title: '请选择上课日期', icon: 'none' });
      return;
    }
    
    // 时间验证
    const toMinutes = (timeStr) => {
      const [h, m] = timeStr.split(':').map(Number);
      return h * 60 + m;
    };
    
    if (toMinutes(endTime) <= toMinutes(startTime)) {
      wx.showToast({ title: '结束时间必须晚于开始时间', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '保存中...' });
    
    try {
      // 构建课程数据
      const courseData = {
        ...this.data.formData,
        name: this.data.formData.name.trim(),
        duration: toMinutes(endTime) - toMinutes(startTime),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // 使用真实数据库操作
      const result = await DatabaseManager.addCourse(courseData);

      if (result.success) {
        // 同时保存到本地存储作为缓存
        const localCourse = {
          _id: result.data._id,
          ...courseData,
          synced: true
        };
        LocalDB.saveCourse(localCourse);

        wx.hideLoading();
        wx.showToast({ 
          title: '保存成功',
          icon: 'success',
          duration: 1500
        });
        
        // 通知上级页面刷新
        setTimeout(() => {
          const pages = getCurrentPages();
          const prevPage = pages[pages.length - 2];
          if (prevPage && prevPage.route === 'pages/schedule/schedule') {
            // 调用新的数据加载方法
            prevPage.loadScheduleData && prevPage.loadScheduleData();
          }
          wx.navigateBack();
        }, 1500);
      } else {
        throw new Error(result.message || '保存失败');
      }
      
    } catch (error) {
      wx.hideLoading();
      console.error('保存课程失败:', error);
      
      // 数据库保存失败时，保存到本地作为未同步数据
      try {
        const localCourse = {
          _id: `local_${Date.now()}`,
          ...this.data.formData,
          name: this.data.formData.name.trim(),
          duration: toMinutes(endTime) - toMinutes(startTime),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          synced: false
        };
        LocalDB.saveCourse(localCourse);
        
        wx.showToast({ 
          title: '已保存到本地，将稍后同步',
          icon: 'none',
          duration: 2000
        });
        
        setTimeout(() => {
          const pages = getCurrentPages();
          const prevPage = pages[pages.length - 2];
          if (prevPage && prevPage.route === 'pages/schedule/schedule') {
            prevPage.loadScheduleData && prevPage.loadScheduleData();
          }
          wx.navigateBack();
        }, 2000);
      } catch (localError) {
        console.error('本地保存也失败:', localError);
        wx.showToast({ 
          title: '保存失败，请重试',
          icon: 'error',
          duration: 2000
        });
      }
    }
  },

  // 加载课程数据（编辑模式）
  loadCourseData(courseId) {
    // TODO: 根据ID加载课程数据
    console.log('加载课程数据:', courseId);
  }
}); 