const { formatTime } = require("../../utils/util.js");
import LocalDB from '../../utils/local-db';
import DatabaseManager from '../../utils/database';

Page({
  data: {
    formData: {
      name: '',
      teacher: '',
      location: '',
      date: '',
      startTime: '09:00',
      endTime: '10:30',
      repeatType: 'none', // none, weekly
    },
    
    // Picker related
    showPicker: false,
    pickerType: 'date', // 'date', 'startTime', 'endTime'
    pickerValue: new Date().getTime(),
    minDate: new Date().getTime(),
    formatter(type, value) {
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
    // 默认设置今天为课程日期
    this.setData({
      'formData.date': formatTime(new Date(), 'yyyy-MM-dd')
    });
  },

  onFieldChange(e) {
    const { field } = e.currentTarget.dataset;
    this.setData({
      [`formData.${field}`]: e.detail
    });
  },

  // --- Picker Logic ---
  showPicker(e) {
    const { type } = e.currentTarget.dataset;
    let pickerValue;
    if (type === 'date') {
      pickerValue = new Date(this.data.formData.date).getTime();
    } else {
      const [hour, minute] = this.data.formData[type].split(':');
      const date = new Date();
      date.setHours(hour, minute);
      pickerValue = date.getTime();
    }

    this.setData({ 
      showPicker: true, 
      pickerType: type === 'date' ? 'date' : 'time',
      pickerValue: pickerValue
    });
  },

  hidePicker() {
    this.setData({ showPicker: false });
  },

  onPickerConfirm(e) {
    const { pickerType } = this.data;
    let value = e.detail;
    
    if (pickerType === 'date') {
      this.setData({ 'formData.date': formatTime(new Date(value), 'yyyy-MM-dd') });
    } else { // time
      this.setData({ [`formData.${pickerType}`]: value });
    }
    
    this.hidePicker();
  },

  // --- Form Submission ---
  async handleSubmit() {
    const { name, date, startTime, endTime } = this.data.formData;
    if (!name) {
      wx.showToast({ title: '请输入课程名称', icon: 'none' });
      return;
    }
    if (!date) {
      wx.showToast({ title: '请选择日期', icon: 'none' });
      return;
    }
    const toMinutes = (t) => {
      const [h,m] = t.split(':').map(Number);
      return h*60+m;
    };
    if (toMinutes(endTime) <= toMinutes(startTime)) {
      wx.showToast({ title: '结束时间必须晚于开始时间', icon: 'none' });
      return;
    }

    console.log('提交的表单数据:', this.data.formData);
    wx.showLoading({ title: '保存中...' });
    try {
      // 本地持久化
      const localCourse = {
        _id: `local_${Date.now()}`,
        ...this.data.formData,
        synced: false
      };
      LocalDB.saveCourse(localCourse);

      // 云端同步（忽略错误）
      try {
        await DatabaseManager.addCourse({
          ...this.data.formData
        });
        localCourse.synced = true;
      } catch(err) {
        console.warn('云端同步课程失败', err);
      }

      wx.hideLoading();
      wx.showToast({ title: '保存成功' });
      const pages = getCurrentPages();
      const prevPage = pages[pages.length - 2];
      if (prevPage && prevPage.route === 'pages/schedule/schedule') {
        prevPage.refreshCourses && prevPage.refreshCourses();
      }
      wx.navigateBack();
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: '保存失败', icon: 'none' });
    }
  }
}); 