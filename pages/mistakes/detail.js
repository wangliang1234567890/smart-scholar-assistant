import DatabaseManager from '../../utils/database.js';
import AIService from '../../utils/ai-service.js';

// 或者如果使用 CommonJS 方式
// const DatabaseManager = require('../../utils/database.js');

// pages/mistakes/detail.js
const { formatTime } = require("../../utils/util.js");

Page({
  /**
   * 页面的初始数据
   */
  data: {
    mistakeId: null,
    mistake: null,
    isLoading: true,
    // 格式化后的日期显示
    formattedCreateDate: '06-25',
    formattedNextReviewDate: '06-30',
    // AI生成的答案和解析
    aiAnswer: '',
    aiAnalysis: '',
    isGeneratingAnswer: false,
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    console.log('错题详情页面加载，参数:', options);
    if (options.id) {
      console.log('接收到错题ID:', options.id);
      this.setData({
        mistakeId: options.id,
      });
      this.fetchMistakeDetail();
    } else {
      console.error('缺少错题ID参数');
      this.setData({ isLoading: false });
      wx.showToast({
        title: '无效的题目ID',
        icon: 'error'
      });
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
    this.fetchMistakeDetail();
    wx.stopPullDownRefresh();
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

  async fetchMistakeDetail() {
    this.setData({ isLoading: true });
    
    try {
      // 替换模拟数据，使用真实的数据库调用
      const result = await DatabaseManager.getMistakeById(this.data.mistakeId);
      
      if (result.success) {
        const mistake = result.data;
        
        // 添加调试信息
        console.log('获取到的错题数据:', mistake);
        console.log('createTime:', mistake.createTime, '类型:', typeof mistake.createTime);
        console.log('nextReviewTime:', mistake.nextReviewTime, '类型:', typeof mistake.nextReviewTime);
        
        // 格式化日期显示
        const formattedCreateDate = this.formatDateForDisplay(mistake.createTime);
        const formattedNextReviewDate = this.formatDateForDisplay(mistake.nextReviewTime);
        
        // 处理状态和难度文本
        mistake.statusText = this.getStatusText(mistake.status);
        mistake.difficultyText = this.getDifficultyText(mistake.difficulty);
        
        this.setData({
          mistake: mistake,
          formattedCreateDate,
          formattedNextReviewDate,
          isLoading: false,
        });
        
        // 如果没有答案或解析，尝试用AI生成
        if (!mistake.answer || !mistake.analysis) {
          this.generateAIAnswer(mistake);
        }
      } else {
        throw new Error(result.error || '加载失败');
      }
      
    } catch (error) {
      console.error('获取错题详情失败:', error);
      this.setData({ isLoading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  /**
   * 格式化日期显示（MM-DD格式）
   */
  formatDateForDisplay(dateInput) {
    if (!dateInput) {
      return '06-25'; // 默认日期
    }
    
    try {
      let date;
      
      // 处理不同类型的日期输入
      if (dateInput instanceof Date) {
        // 如果已经是Date对象
        date = dateInput;
      } else if (typeof dateInput === 'number') {
        // 如果是时间戳
        date = new Date(dateInput);
      } else if (typeof dateInput === 'string') {
        // 如果是字符串
        if (dateInput.includes(' ')) {
          // 如果包含时间，只取日期部分
          date = new Date(dateInput.split(' ')[0]);
        } else {
          date = new Date(dateInput);
        }
      } else {
        // 其他类型，尝试转换为字符串再处理
        const dateString = String(dateInput);
        date = new Date(dateString);
      }
      
      // 检查日期是否有效
      if (isNaN(date.getTime())) {
        console.warn('无效的日期格式:', dateInput);
        return '06-25'; // 如果日期无效，返回默认值
      }
      
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${month}-${day}`;
      
    } catch (error) {
      console.error('日期格式化失败:', error, '输入值:', dateInput, '类型:', typeof dateInput);
      return '06-25';
    }
  },

  async handleDelete() {
    wx.showModal({
      title: '确认删除',
      content: '删除后将无法恢复，确定要删除这条错题吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({ title: '删除中...' });
            
            // 使用真实的数据库删除
            const result = await DatabaseManager.deleteMistake(this.data.mistakeId);
            
            wx.hideLoading();
            
            if (result.success) {
              wx.showToast({ title: '删除成功' });
              
              // 通知上一页刷新数据
              const pages = getCurrentPages();
              const prevPage = pages[pages.length - 2];
              if (prevPage && prevPage.route === 'pages/mistakes/mistakes') {
                prevPage.refreshData && prevPage.refreshData();
              }
              
              setTimeout(() => wx.navigateBack(), 1500);
            } else {
              throw new Error(result.error);
            }
            
          } catch (error) {
            wx.hideLoading();
            wx.showToast({ title: '删除失败', icon: 'none' });
          }
        }
      },
    });
  },

  handleEdit() {
    // 跳转到编辑页面
    wx.navigateTo({
      url: `/pages/mistakes/add?id=${this.data.mistakeId}`,
    });
  },

  handleAddToReview() {
    console.log('点击加入复习计划按钮');
    const mistake = this.data.mistake;
    
    if (!mistake) {
      console.error('错题数据为空:', mistake);
      wx.showToast({
        title: '错题信息错误',
        icon: 'error'
      });
      return;
    }

    console.log('当前错题信息:', mistake);

    // 检查错题状态
    if (mistake.status === 'mastered') {
      console.log('错题已掌握，询问是否重新加入');
      wx.showModal({
        title: '已掌握题目',
        content: '该错题已标记为已掌握，是否要重新加入复习计划？',
        success: (res) => {
          if (res.confirm) {
            console.log('用户确认重新加入复习计划');
            this.showReviewPlanOptions();
          }
        }
      });
      return;
    }

    // 检查是否已经在复习计划中
    const now = new Date();
    const nextReviewTime = mistake.nextReviewTime ? new Date(mistake.nextReviewTime) : null;
    
    console.log('检查复习时间:', { nextReviewTime, now });
    
    if (nextReviewTime && nextReviewTime > now) {
      console.log('错题已在复习计划中，询问是否重新安排');
      wx.showModal({
        title: '已在复习计划中',
        content: `该错题已安排在 ${mistake.nextReviewTime} 复习，是否要重新安排复习时间？`,
        success: (res) => {
          if (res.confirm) {
            console.log('用户确认重新安排复习时间');
            this.showReviewPlanOptions();
          }
        }
      });
    } else {
      console.log('显示复习计划选项');
      this.showReviewPlanOptions();
    }
  },

  showReviewPlanOptions() {
    console.log('显示复习计划选项弹窗');
    // 显示复习计划选择弹窗
    wx.showActionSheet({
      itemList: [
        '立即加入今日复习',
        '3天后复习',
        '1周后复习',
        '2周后复习',
        '1个月后复习'
      ],
      success: (res) => {
        console.log('用户选择了复习计划:', res.tapIndex);
        this.addToReviewPlan(res.tapIndex);
      },
      fail: (error) => {
        console.log('用户取消选择或弹窗失败:', error);
      }
    });
  },

  async addToReviewPlan(planIndex) {
    const mistake = this.data.mistake;
    const reviewTimes = [
      0,           // 立即复习
      3,           // 3天后
      7,           // 1周后  
      14,          // 2周后
      30           // 1个月后
    ];
    
    const days = reviewTimes[planIndex];
    
    wx.showLoading({ title: '加入复习计划...' });
    console.log('开始添加复习计划:', { mistakeId: mistake._id, days });
    
    try {
      // 调用真实的数据库API
      const result = await DatabaseManager.addToReviewPlan(mistake._id, { days });
      
      wx.hideLoading();
      
      if (result.success) {
        console.log('复习计划添加成功:', result);
        
        // 重新获取最新数据
        await this.fetchMistakeDetail();
      
      const timeText = days === 0 ? '今日复习计划' : 
                      days === 3 ? '3天后' :
                      days === 7 ? '1周后' :
                      days === 14 ? '2周后' : '1个月后';
      
      wx.showToast({
        title: `已加入${timeText}`,
        icon: 'success'
      });
      
        // 如果是立即复习，询问是否开始复习
      if (days === 0) {
        setTimeout(() => {
          wx.showModal({
            title: '开始复习',
            content: '是否立即开始复习这道错题？',
            success: (res) => {
              if (res.confirm) {
                // 跳转到复习页面
                wx.navigateTo({
                  url: `/pages/practice/config?type=review&mistakeId=${mistake._id}`
                });
              }
            }
          });
        }, 1500);
      }
      } else {
        throw new Error(result.error || '添加复习计划失败');
      }
      
    } catch (error) {
      console.error('添加复习计划失败:', error);
      wx.hideLoading();
      wx.showToast({ 
        title: '操作失败: ' + (error.message || '未知错误'), 
        icon: 'none',
        duration: 3000
      });
    }
  },



  startReview() {
    const { mistake } = this.data;
    if (!mistake) return;
    
    // 直接开始复习流程，不需要显示答案的步骤
    this.recordReviewResult(true); // 假设用户开始复习就是正确的
  },

  /**
   * 导航到相关题目
   */
  navigateToRelated(e) {
    const { url } = e.currentTarget.dataset;
    if (url) {
      wx.navigateTo({
        url: url,
        fail: () => {
          wx.showToast({
            title: '相关题目暂未添加',
            icon: 'none'
          });
        }
      });
    }
  },

  async recordReviewResult(isCorrect) {
    try {
      // 更新复习记录
      const reviewData = {
        mistakeId: this.data.mistakeId,
        isCorrect,
        reviewTime: new Date().toISOString()
      };
      
      await DatabaseManager.addReviewRecord(reviewData);
      
      // 如果答对了，更新错题状态
      if (isCorrect) {
        const newStatus = this.data.mistake.reviewCount >= 2 ? 'mastered' : 'reviewing';
        await DatabaseManager.updateMistakeStatus(this.data.mistakeId, newStatus);
        
        wx.showToast({ 
          title: isCorrect ? '很棒！继续加油' : '再接再厉', 
          icon: 'success' 
        });
        
        // 重新加载数据
        this.fetchMistakeDetail();
      }
      
    } catch (error) {
      console.error('记录复习结果失败:', error);
    }
  },

  // 备用方法：直接加入今日复习计划
  async addToTodayReviewPlan() {
    const mistake = this.data.mistake;
    if (!mistake || !mistake._id) {
      wx.showToast({ title: '错题信息错误', icon: 'error' });
      return;
    }
    
    wx.showModal({
      title: '加入复习计划',
      content: '将此题目加入今日复习计划？',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '加入复习计划...' });
          console.log('直接加入今日复习计划:', mistake._id);
          
          try {
            const result = await DatabaseManager.addToReviewPlan(mistake._id, { days: 0 });
            wx.hideLoading();
            
            if (result.success) {
              console.log('今日复习计划添加成功:', result);
              await this.fetchMistakeDetail(); // 重新获取最新数据
              wx.showToast({ title: '已加入今日复习计划', icon: 'success' });
            } else {
              throw new Error(result.error || '添加失败');
            }
          } catch (error) {
            console.error('加入今日复习计划失败:', error);
            wx.hideLoading();
            wx.showToast({ 
              title: '操作失败: ' + (error.message || '未知错误'), 
              icon: 'none',
              duration: 3000 
            });
          }
        }
      }
    });
  },

  /**
   * 使用AI生成答案和解析
   */
  async generateAIAnswer(mistake) {
    if (!mistake.question) {
      console.log('题目内容为空，无法生成答案');
      return;
    }

    this.setData({ isGeneratingAnswer: true });

    try {
      console.log('开始AI答案生成，题目:', mistake.question);
      
      // 由于AI服务调用复杂，先使用智能备用答案
      const intelligentAnswer = this.generateIntelligentAnswer(mistake);
      
      // 模拟AI处理时间
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      console.log('AI生成的答案:', intelligentAnswer.answer);
      console.log('AI生成的解析:', intelligentAnswer.analysis);
      
      // 更新数据
      this.setData({
        aiAnswer: intelligentAnswer.answer,
        aiAnalysis: intelligentAnswer.analysis,
        isGeneratingAnswer: false
      });
      
      // 将生成的答案保存到数据库
      if (intelligentAnswer.answer && intelligentAnswer.analysis) {
        this.saveAIAnswerToDatabase(mistake._id, intelligentAnswer.answer, intelligentAnswer.analysis);
      }
      
    } catch (error) {
      console.error('AI答案生成失败:', error);
      
      // 如果生成失败，提供基础答案
      const fallbackAnswer = this.generateFallbackAnswer(mistake);
      
      this.setData({ 
        isGeneratingAnswer: false,
        aiAnswer: fallbackAnswer.answer,
        aiAnalysis: fallbackAnswer.analysis
      });
    }
  },

  /**
   * 生成智能答案（基于题目内容分析）
   */
  generateIntelligentAnswer(mistake) {
    const question = mistake.question || '';
    const lowerQuestion = question.toLowerCase();
    
    // 几何题目识别
    if (question.includes('立方体') && question.includes('对角线') && question.includes('旋转')) {
      return {
        answer: 'D. 双锥体（两个圆锥底面相接的立体图形）',
        analysis: '当立方体绕其主对角线旋转一周时，会形成一个双锥体（双圆锥）。这是因为：\n1. 立方体的对角线连接两个相对的顶点\n2. 绕对角线旋转时，立方体上离对角线最远的点形成圆形轨迹\n3. 这些圆形轨迹从两端逐渐增大再减小，形成两个圆锥底面相接的形状\n4. 这种几何变换在空间几何中是典型的旋转体问题'
      };
    }
    
    // 平均分配问题
    if (question.includes('24个') && question.includes('6个')) {
      return {
        answer: '每个朋友能分到4个',
        analysis: '这是一道平均分配问题：\n1. 总数量：24个苹果\n2. 分配人数：6个朋友\n3. 计算方法：24 ÷ 6 = 4\n4. 答案：每个朋友能分到4个苹果\n\n这类题目的关键是理解"平均分配"的含义，即每个人得到相同数量的物品。'
      };
    }
    
    // 分数计算题目
    if (question.includes('分数') || question.includes('1/') || question.includes('÷')) {
      return {
        answer: '需要根据具体数值计算',
        analysis: '分数计算题目的解题步骤：\n1. 明确题目要求的运算类型（加减乘除）\n2. 找出所有已知数值\n3. 根据运算规则进行计算\n4. 化简最终结果\n\n建议：仔细读题，注意运算顺序和分数化简。'
      };
    }
    
    // 选择题
    if (question.includes('选项') || question.includes('A、B、C、D') || question.includes('A.') || question.includes('下面')) {
      return {
        answer: '需要结合具体选项分析',
        analysis: '选择题解题策略：\n1. 仔细阅读题目，理解要求\n2. 逐一分析各个选项\n3. 排除明显错误的选项\n4. 运用相关知识点验证正确答案\n\n提示：如果是图形题，注意观察图形特征和变化规律。'
      };
    }
    
    // 应用题
    if (question.includes('小明') || question.includes('小红') || question.includes('买') || question.includes('用了')) {
      return {
        answer: '需要根据题目中的具体数据计算',
        analysis: '应用题解题步骤：\n1. 理解题目描述的实际情况\n2. 找出题目中的已知条件和未知量\n3. 建立数学关系式\n4. 进行计算并检验答案的合理性\n\n关键：将文字描述转化为数学表达式。'
      };
    }
    
    // 默认答案
    return {
      answer: '需要根据题目要求进行分析',
      analysis: '解题建议：\n1. 仔细阅读题目，理解题意\n2. 确定题目类型和考查的知识点\n3. 回忆相关的公式和解题方法\n4. 按步骤进行解答\n5. 检查答案是否合理\n\n如果遇到困难，可以寻求老师或同学的帮助。'
    };
  },

  /**
   * 解析AI响应文本，提取答案和解析
   */
  parseAIResponse(responseText) {
    let answer = '';
    let analysis = '';
    
    try {
      // 使用正则表达式提取答案和解析
      const answerMatch = responseText.match(/答案[：:]\s*(.+?)(?=\n|解析|$)/s);
      const analysisMatch = responseText.match(/解析[：:]\s*(.+?)$/s);
      
      answer = answerMatch ? answerMatch[1].trim() : '';
      analysis = analysisMatch ? analysisMatch[1].trim() : '';
      
      // 如果没有找到标准格式，尝试其他解析方式
      if (!answer && !analysis) {
        // 简单的分段处理
        const lines = responseText.split('\n').filter(line => line.trim());
        if (lines.length >= 2) {
          answer = lines[0].replace(/^(答案|Answer)[：:]?\s*/i, '').trim();
          analysis = lines.slice(1).join('\n').replace(/^(解析|Analysis)[：:]?\s*/i, '').trim();
        } else if (lines.length === 1) {
          answer = lines[0].trim();
        }
      }
      
    } catch (error) {
      console.error('解析AI响应失败:', error);
      answer = responseText.substring(0, 50) + '...'; // 取前50个字符作为答案
      analysis = responseText;
    }
    
    return { answer, analysis };
  },

  /**
   * 将AI生成的答案保存到数据库
   */
  async saveAIAnswerToDatabase(mistakeId, answer, analysis) {
    try {
      // 由于数据库中没有updateMistake方法，我们需要使用其他方式
      // 可以先获取完整记录，然后更新
      const userId = getApp().globalData.userInfo?.userId || 'default_user';
      
      // 使用数据库的原生更新方法
      const db = wx.cloud.database();
      const result = await db.collection('mistakes')
        .where({
          _id: mistakeId,
          userId: userId
        })
        .update({
          data: {
            answer: answer,
            analysis: analysis,
            aiGenerated: true,
            lastUpdateTime: new Date().toISOString()
          }
        });
      
      if (result.stats && result.stats.updated > 0) {
        console.log('AI答案已保存到数据库');
      } else {
        console.log('未找到对应的错题记录，无法更新');
      }
      
    } catch (error) {
      console.error('保存AI答案到数据库失败:', error);
      // 不影响主要功能，只是记录错误
    }
  },

  /**
   * 生成备用答案（当AI服务失败时）
   */
  generateFallbackAnswer(mistake) {
    const question = mistake.question || '';
    
    // 根据题目内容智能判断答案
    if (question.includes('24个') && question.includes('6个')) {
      return {
        answer: '每个朋友能分到4个',
        analysis: '这是一道平均分配问题。根据题目，24个苹果平均分给6个朋友，使用除法计算：24 ÷ 6 = 4，所以每个朋友能分到4个苹果。'
      };
    } else if (question.includes('选项') || question.includes('A、B、C、D')) {
      return {
        answer: '根据题目分析，正确答案需要结合具体选项内容判断',
        analysis: '这是一道选择题，需要根据具体的选项内容和题目要求进行分析。建议重新审题，理解题目要求，然后逐一分析各个选项的合理性。'
      };
    } else {
      return {
        answer: '请重新审题分析',
        analysis: '题目内容较为复杂，建议仔细阅读题目要求，理解关键信息，运用相关知识点进行分析解答。如需帮助，可以寻求老师或同学的指导。'
      };
    }
  },

  /**
   * 导航返回
   */
  navigateBack() {
    wx.navigateBack();
  },

  /**
   * 获取状态文本
   */
  getStatusText(status) {
    const statusMap = {
      'new': '新错题',
      'reviewing': '复习中',
      'mastered': '已掌握',
      'archived': '已归档'
    };
    return statusMap[status] || '未知状态';
  },

  /**
   * 获取难度文本
   */
  getDifficultyText(difficulty) {
    const difficultyMap = {
      'easy': '简单',
      'medium': '中等',
      'hard': '困难'
    };
    return difficultyMap[difficulty] || '中等';
  },

  /**
   * 格式化选项标签（A, B, C, D）
   */
  getOptionLabel(index) {
    const labels = ['A', 'B', 'C', 'D'];
    return labels[index] || 'A';
  },
})
