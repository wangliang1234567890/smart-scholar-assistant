// pages/mistakes/add.js
import {
  SUBJECTS,
  DIFFICULTY_LABELS
} from '../../utils/constants';
import DatabaseManager from '../../utils/database';
import LocalDB from '../../utils/local-db';

Page({

  /**
   * 页面的初始数据
   */
  data: {
    mode: 'add', // 'add' or 'edit'
    mistakeId: null,
    
    // 表单数据
    formData: {
      question: '',
      answer: '',
      analysis: '',
      subject: '数学',
      difficulty: 2,
      imageUrl: ''
    },
    fileList: [], // 用于Uploader组件
    
    // 选项
    subjects: SUBJECTS,
    difficulties: Object.entries(DIFFICULTY_LABELS).map(([value, label]) => ({
      label,
      value: parseInt(value)
    })),
    
    isSubmitting: false,
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    if (options.id) {
      // 编辑模式
      this.setData({
        mode: 'edit',
        mistakeId: options.id
      });
      wx.setNavigationBarTitle({ title: '编辑错题' });
      this.loadMistakeData(options.id);
    } else {
      // 新增模式
      wx.setNavigationBarTitle({ title: '录入新错题' });
    }
  },

  loadMistakeData(id) {
    // TODO: 调用真实API获取错题数据
    wx.showLoading({ title: '加载中...' });
    setTimeout(() => {
      const mockData = { // 模拟返回的数据
        question: `这是题目ID为 ${id} 的模拟错题。`,
        answer: '这是模拟的答案。',
        analysis: '这是模拟的解析。',
        subject: '数学',
        difficulty: 2,
        imageUrl: 'https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/2c13b73cde894371a39a046c82334888~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image'
      };
      this.setData({
        formData: mockData,
        fileList: mockData.imageUrl ? [{ url: mockData.imageUrl }] : []
      });
      wx.hideLoading();
    }, 500);
  },

  onFieldChange(e) {
    const { field } = e.currentTarget.dataset;
    this.setData({
      [`formData.${field}`]: e.detail
    });
  },

  // 图片上传
  afterRead(event) {
    const { file } = event.detail;
    // TODO: 实现真实的上传逻辑
    wx.showLoading({ title: '上传中...' });
    setTimeout(() => {
      wx.hideLoading();
      // 模拟上传成功
      const mockUrl = file.url; // 暂时用本地路径代替
      this.setData({ 
        'formData.imageUrl': mockUrl,
        fileList: [{ url: mockUrl }]
      });
    }, 1000);
  },

  deleteImage() {
    this.setData({
      'formData.imageUrl': '',
      fileList: []
    });
  },

  // 提交
  async handleSubmit() {
    const { formData } = this.data;
    if (!formData.question || !formData.answer) {
      wx.showToast({
        title: '题目和答案不能为空',
        icon: 'none'
      });
      return;
    }
    
    this.setData({ isSubmitting: true });
    // TODO: 调用真实API提交数据
    wx.showLoading({ title: '保存中...' });
    try {
      await DatabaseManager.addMistake(formData);
      // 本地持久化
      LocalDB.saveMistake({ _id: `local_${Date.now()}`, ...formData });
      this.setData({ isSubmitting: false });
      wx.hideLoading();
      wx.showToast({ title: '保存成功' });
      
      // 通知上一页刷新数据并返回
      const pages = getCurrentPages();
      const prevPage = pages[pages.length - 2];
      if (prevPage && (prevPage.route === 'pages/mistakes/mistakes' || prevPage.route === 'pages/mistakes/detail')) {
        prevPage.onLoad(prevPage.options); // 简单粗暴地刷新
      }
      wx.navigateBack();
    } catch (error) {
      this.setData({ isSubmitting: false });
      wx.hideLoading();
      wx.showToast({ title: '保存失败', icon: 'none' });
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

  }
})