// pages/mistakes/add.js
import {
  SUBJECTS,
  DIFFICULTY_LABELS
} from '../../utils/constants';
import DatabaseManager from '../../utils/database'; // 使用现有的数据库模块
import LocalDB from '../../utils/local-db';
// 移除错误引用：import databaseManager from '../../utils/database-manager.js';

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
    difficulties: [
      { value: 1, label: '简单' },
      { value: 3, label: '中等' },
      { value: 5, label: '困难' }
    ],
    
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

  async loadMistakeData(mistakeId) {
    try {
      wx.showLoading({ title: '加载中...', mask: true });
      
      const result = await DatabaseManager.getMistakeById(mistakeId);
      
      if (result.success) {
        const mistake = result.data;
        this.setData({
          formData: {
            question: mistake.question || '',
            answer: mistake.answer || '',
            analysis: mistake.analysis || '',
            subject: mistake.subject || '数学',
            difficulty: mistake.difficulty || 2,
            imageUrl: mistake.imageUrl || ''
          }
        });
        
        // 如果有图片，更新fileList
        if (mistake.imageUrl) {
          this.setData({
            fileList: [{
              url: mistake.imageUrl,
              name: '题目图片'
            }]
          });
        }
      } else {
        throw new Error(result.error || '加载失败');
      }
      
      wx.hideLoading();
      
    } catch (error) {
      wx.hideLoading();
      console.error('加载错题数据失败:', error);
      wx.showToast({ title: '加载失败', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
    }
  },

  onFieldChange(e) {
    const { field } = e.currentTarget.dataset;
    this.setData({
      [`formData.${field}`]: e.detail
    });
  },

  // 图片上传
  onImageUpload() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFilePaths[0];
        
        // 更新fileList显示
        this.setData({
          fileList: [{
            url: tempFilePath,
            name: '题目图片'
          }],
          'formData.imageUrl': tempFilePath
        });
      },
      fail: (error) => {
        console.error('选择图片失败:', error);
        wx.showToast({ title: '选择图片失败', icon: 'none' });
      }
    });
  },

  // 删除图片
  onImageDelete() {
    this.setData({
      fileList: [],
      'formData.imageUrl': ''
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
      const result = await DatabaseManager.addMistake(formData);
      // 本地持久化
      LocalDB.saveMistake({ _id: `local_${Date.now()}`, ...formData });
      this.setData({ isSubmitting: false });
      wx.hideLoading();
      wx.showToast({ title: '保存成功' });
      
      // 触发错题添加事件，通知相关页面更新数据
      const EventManager = require('../../utils/event-manager.js').default;
      const { EVENT_TYPES } = require('../../utils/event-manager.js');
      
      EventManager.emit(EVENT_TYPES.MISTAKE_ADDED, {
        mistake: result.data || formData,
        timestamp: Date.now()
      });
      
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

  },

  // 增强：保存错题到数据库
  async saveMistake() {
    const { formData } = this.data;
    
    // 验证必填字段
    if (!formData.question.trim()) {
      wx.showToast({
        title: '请输入题目内容',
        icon: 'none'
      });
      return;
    }
    
    wx.showLoading({ title: '保存中...' });
    
    try {
      // 使用现有的DatabaseManager保存
      const result = await DatabaseManager.saveMistake({
        question: formData.question,
        subject: formData.subject,
        difficulty: formData.difficulty,
        myAnswer: formData.myAnswer || formData.answer, // 兼容现有字段
        correctAnswer: formData.correctAnswer || formData.answer,
        analysis: formData.analysis,
        imageUrl: formData.imageUrl,
        tags: formData.tags || [],
        source: 'manual'
      });
      
      if (result.success) {
        // 本地持久化（保持现有逻辑）
        LocalDB.saveMistake({ _id: result.data._id, ...formData });
        
        wx.hideLoading();
        wx.showToast({
          title: '保存成功',
          icon: 'success'
        });
        
        // 返回错题本页面
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      } else {
        throw new Error(result.message || '保存失败');
      }
      
    } catch (error) {
      wx.hideLoading();
      console.error('保存错题失败:', error);
      wx.showToast({
        title: '保存失败，请重试',
        icon: 'error'
      });
    }
  },

  // 添加AI辅助功能
  async getAIHelp() {
    const { question } = this.data.formData;
    
    if (!question.trim()) {
      wx.showToast({ title: '请先输入题目', icon: 'none' });
      return;
    }
    
    try {
      wx.showLoading({ title: 'AI分析中...', mask: true });
      
      // 调用AI服务获取解析
      const app = getApp();
      if (app.globalData.aiService) {
        const result = await app.globalData.aiService.analyzeQuestion(question);
        
        if (result.success) {
          this.setData({
            'formData.analysis': result.analysis,
            'formData.subject': result.subject || this.data.formData.subject,
            'formData.difficulty': result.difficulty || this.data.formData.difficulty
          });
          
          wx.showToast({ title: 'AI分析完成', icon: 'success' });
        }
      }
      
      wx.hideLoading();
      
    } catch (error) {
      wx.hideLoading();
      console.error('AI分析失败:', error);
      wx.showToast({ title: 'AI分析失败', icon: 'none' });
    }
  }
})
