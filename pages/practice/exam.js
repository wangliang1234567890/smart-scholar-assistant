const app = getApp();
import DatabaseManager from '../../utils/database.js';
import { getSystemInfo } from '../../utils/common.js';

Page({
  data: {
    loading: false,
    examPaper: null,
    showAnswers: false,
    printMode: false,
    examConfig: {
      title: 'AI智能练习试卷',
      subtitle: '基于错题生成的个性化练习',
      totalScore: 100,
      timeLimit: 60,
      instructions: [
        '请仔细阅读题目，选择最佳答案',
        '单选题请选择唯一正确答案',
        '填空题请填写准确答案',
        '注意合理分配答题时间'
      ]
    }
  },

  onLoad(options) {
    console.log('试卷页面加载，参数:', options);
    
    if (options.mistakeId) {
      this.generateExamFromMistake(options.mistakeId);
    } else if (options.questions) {
      try {
        const questions = JSON.parse(decodeURIComponent(options.questions));
        this.generateExamFromQuestions(questions);
      } catch (error) {
        console.error('解析题目数据失败:', error);
        this.showError('题目数据格式错误');
      }
    } else {
      // 默认从数据库获取错题生成试卷
      this.loadMistakesAndGenerate();
    }
  },

  // 从数据库加载错题并生成试卷
  async loadMistakesAndGenerate() {
    try {
      this.setData({ loading: true });
      
      const userId = wx.getStorageSync('userId') || 'default_user';
      const result = await DatabaseManager.getMistakes(userId, {
        page: 1,
        pageSize: 10,
        status: 'new' // 优先选择新错题
      });
      
      if (result.success && result.data.length > 0) {
        // 基于错题生成练习题
        await this.generateExamFromMistakes(result.data);
      } else {
        // 如果没有错题，生成示例试卷
        console.log('没有找到错题，生成示例试卷');
        this.generateSampleExam();
      }
      
    } catch (error) {
      console.error('加载错题失败:', error);
      this.generateSampleExam();
    } finally {
      this.setData({ loading: false });
    }
  },

  // 基于错题生成试卷
  async generateExamFromMistake(mistakeId) {
    try {
      this.setData({ loading: true });
      
      // 获取特定错题
      const mistake = await this.getMistakeById(mistakeId);
      if (mistake) {
        await this.generateExamFromMistakes([mistake]);
      } else {
        this.showError('错题不存在');
      }
      
    } catch (error) {
      console.error('生成试卷失败:', error);
      this.showError('生成试卷失败: ' + error.message);
    } finally {
      this.setData({ loading: false });
    }
  },

  // 获取错题详情
  async getMistakeById(mistakeId) {
    try {
      const userId = wx.getStorageSync('userId') || 'default_user';
      const result = await DatabaseManager.getMistakes(userId);
      
      if (result.success) {
        return result.data.find(item => item._id === mistakeId);
      }
      return null;
    } catch (error) {
      console.error('获取错题失败:', error);
      return null;
    }
  },

  // 基于错题列表生成试卷
  async generateExamFromMistakes(mistakes) {
    try {
      const aiService = app.globalData.aiService;
      
      if (aiService && typeof aiService.generateQuestionsFromMistakes === 'function') {
        // 使用AI服务生成题目
        const result = await aiService.generateQuestionsFromMistakes(mistakes, {
          count: 5,
          types: ['single_choice', 'fill_blank', 'short_answer']
        });
        
        if (result.success) {
          await this.createExamPaper(result.questions);
        } else {
          throw new Error('AI生成题目失败');
        }
      } else {
        // AI服务不可用时，基于错题创建简化版题目
        const questions = this.convertMistakesToQuestions(mistakes);
        await this.createExamPaper(questions);
      }
      
    } catch (error) {
      console.error('基于错题生成试卷失败:', error);
      // 降级到示例试卷
      this.generateSampleExam();
    }
  },

  // 将错题转换为练习题目
  convertMistakesToQuestions(mistakes) {
    return mistakes.slice(0, 5).map((mistake, index) => ({
      id: `mistake_${mistake._id || index}`,
      type: 'single_choice',
      content: mistake.question || mistake.content || `题目 ${index + 1}`,
      options: this.generateOptionsForMistake(mistake),
      correctAnswer: 'A',
      explanation: mistake.explanation || '这是基于您的错题生成的练习题',
      difficulty: mistake.difficulty || 3,
      subject: mistake.subject || 'math',
      source: 'mistake'
    }));
  },

  // 为错题生成选项
  generateOptionsForMistake(mistake) {
    const correctAnswer = mistake.answer || mistake.correctAnswer || '正确答案';
    return [
      `A. ${correctAnswer}`,
      'B. 选项2',
      'C. 选项3', 
      'D. 选项4'
    ];
  },

  // 基于题目列表生成试卷
  async generateExamFromQuestions(questions) {
    try {
      this.setData({ loading: true });
      await this.createExamPaper(questions);
    } catch (error) {
      console.error('生成试卷失败:', error);
      this.showError('生成试卷失败');
    } finally {
      this.setData({ loading: false });
    }
  },

  // 创建试卷
  async createExamPaper(questions) {
    if (!questions || questions.length === 0) {
      throw new Error('没有题目数据');
    }

    // 按题型分组
    const sections = this.groupQuestionsByType(questions);
    
    // 计算总分和元数据
    const metadata = this.calculateExamMetadata(sections);
    
    const examPaper = {
      config: {
        ...this.data.examConfig,
        totalScore: metadata.totalScore,
        timeLimit: Math.max(30, questions.length * 3) // 每题3分钟
      },
      sections: sections,
      metadata: metadata,
      createTime: new Date()
    };
    
    this.setData({
      examPaper: examPaper
    });
    
    console.log('试卷生成成功:', examPaper);
  },

  // 按题型分组题目
  groupQuestionsByType(questions) {
    const typeMap = {
      single_choice: { name: '一、单选题', scorePerQuestion: 5 },
      multiple_choice: { name: '二、多选题', scorePerQuestion: 8 },
      fill_blank: { name: '三、填空题', scorePerQuestion: 6 },
      short_answer: { name: '四、简答题', scorePerQuestion: 10 },
      judge: { name: '五、判断题', scorePerQuestion: 4 }
    };
    
    const sections = [];
    const grouped = {};
    
    // 分组
    questions.forEach(question => {
      const type = question.type || 'single_choice';
      if (!grouped[type]) {
        grouped[type] = [];
      }
      grouped[type].push(question);
    });
    
    // 创建章节
    Object.keys(grouped).forEach(type => {
      const config = typeMap[type] || typeMap.single_choice;
      const questionList = grouped[type];
      
      sections.push({
        type: type,
        name: config.name,
        questions: questionList,
        scorePerQuestion: config.scorePerQuestion,
        totalScore: questionList.length * config.scorePerQuestion
      });
    });
    
    return sections;
  },

  // 计算试卷元数据
  calculateExamMetadata(sections) {
    let totalScore = 0;
    let questionCount = 0;
    
    sections.forEach(section => {
      totalScore += section.totalScore;
      questionCount += section.questions.length;
    });
    
    return {
      totalScore: totalScore,
      questionCount: questionCount,
      sectionCount: sections.length
    };
  },

  // 显示无错题提示
  generateSampleExam() {
    console.log('没有错题数据，显示提示');
    
    this.setData({ 
      loading: false,
      examPaper: null 
    });
    
    wx.showModal({
      title: '暂无错题',
      content: '您还没有录入任何错题。请先通过拍照或手动添加一些错题，然后再来生成练习试卷。',
      showCancel: true,
      cancelText: '返回',
      confirmText: '去添加',
      success: (res) => {
        if (res.confirm) {
          // 跳转到拍照页面
          wx.navigateTo({
            url: '/pages/camera/camera'
          });
        } else {
          // 返回练习页面
          wx.navigateBack();
        }
      }
    });
  },

  // 切换答案显示
  toggleAnswers() {
    this.setData({
      showAnswers: !this.data.showAnswers
    });
  },

  // 进入打印模式
  enterPrintMode() {
    if (!this.data.examPaper) {
      wx.showToast({ title: '试卷未生成', icon: 'none' });
      return;
    }
    
    this.setData({ printMode: true });
    
    // 延迟调用打印
    setTimeout(() => {
      this.printExam();
    }, 500);
  },

  // 退出打印模式
  exitPrintMode() {
    this.setData({ printMode: false });
  },

  // 打印试卷
  printExam() {
    // 在小程序中，我们可以生成图片或PDF供用户保存
    this.generatePrintableImage();
  },

  // 生成可打印图片
  async generatePrintableImage() {
    try {
      wx.showLoading({ title: '生成打印版本...' });
      
      // 创建canvas绘制试卷
      const query = wx.createSelectorQuery();
      query.select('#examCanvas').fields({ node: true, size: true });
      
      query.exec((res) => {
        if (res[0]) {
          this.drawExamToCanvas(res[0]);
        } else {
          wx.hideLoading();
          wx.showToast({ title: '打印功能暂不可用', icon: 'none' });
        }
      });
      
    } catch (error) {
      console.error('生成打印版本失败:', error);
      wx.hideLoading();
      wx.showToast({ title: '生成失败', icon: 'none' });
    }
  },

  // 在canvas上绘制试卷
  drawExamToCanvas(canvasInfo) {
    const canvas = canvasInfo.node;
    const ctx = canvas.getContext('2d');
    const dpr = getSystemInfo().pixelRatio || 2;
    
    canvas.width = canvasInfo.width * dpr;
    canvas.height = canvasInfo.height * dpr;
    ctx.scale(dpr, dpr);
    
    // 绘制试卷内容
    this.drawExamContent(ctx, canvasInfo.width, canvasInfo.height);
    
    // 保存为图片
    setTimeout(() => {
      wx.canvasToTempFilePath({
        canvas: canvas,
        success: (res) => {
          this.saveExamImage(res.tempFilePath);
        },
        fail: (error) => {
          console.error('生成图片失败:', error);
          wx.hideLoading();
          wx.showToast({ title: '生成失败', icon: 'none' });
        }
      });
    }, 1000);
  },

  // 绘制试卷内容
  drawExamContent(ctx, width, height) {
    const { examPaper } = this.data;
    if (!examPaper) return;
    
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
    
    let y = 40;
    
    // 绘制标题
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(examPaper.config.title, width / 2, y);
    y += 40;
    
    // 绘制副标题
    ctx.font = '16px sans-serif';
    ctx.fillText(examPaper.config.subtitle, width / 2, y);
    y += 60;
    
    // 绘制题目
    ctx.textAlign = 'left';
    ctx.font = '14px sans-serif';
    
    examPaper.sections.forEach((section, sectionIndex) => {
      // 绘制章节标题
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText(`${section.name}`, 20, y);
      y += 30;
      
      ctx.font = '14px sans-serif';
      
      section.questions.forEach((question, questionIndex) => {
        // 绘制题目
        const questionText = `${questionIndex + 1}. ${question.content}`;
        ctx.fillText(questionText, 30, y);
        y += 25;
        
        // 绘制选项
        if (question.options) {
          question.options.forEach(option => {
            ctx.fillText(`   ${option}`, 40, y);
            y += 20;
          });
        }
        
        y += 15; // 题目间距
        
        // 防止内容超出画布
        if (y > height - 100) {
          return;
        }
      });
      
      y += 20; // 章节间距
    });
  },

  // 保存试卷图片
  saveExamImage(tempFilePath) {
    wx.saveImageToPhotosAlbum({
      filePath: tempFilePath,
      success: () => {
        wx.hideLoading();
        wx.showToast({
          title: '试卷已保存到相册',
          icon: 'success'
        });
        this.exitPrintMode();
      },
      fail: (error) => {
        console.error('保存图片失败:', error);
        wx.hideLoading();
        wx.showToast({
          title: '保存失败，请检查权限',
          icon: 'none'
        });
      }
    });
  },

  // 开始答题
  startAnswering() {
    if (!this.data.examPaper) {
      wx.showToast({ title: '试卷未生成', icon: 'none' });
      return;
    }
    
    // 准备题目数据
    const allQuestions = [];
    this.data.examPaper.sections.forEach(section => {
      section.questions.forEach(question => {
        allQuestions.push({
          ...question,
          sectionName: section.name,
          scorePerQuestion: section.scorePerQuestion
        });
      });
    });
    
    if (allQuestions.length === 0) {
      wx.showToast({ title: '没有可答题目', icon: 'none' });
      return;
    }
    
    // 跳转到答题页面
    try {
      const questionsData = encodeURIComponent(JSON.stringify(allQuestions));
      wx.navigateTo({
        url: `/pages/practice/session?type=exam&questions=${questionsData}&title=${this.data.examPaper.config.title}`
      });
    } catch (error) {
      console.error('跳转答题页失败:', error);
      wx.showToast({ title: '启动答题失败', icon: 'none' });
    }
  },

  // 显示错误
  showError(message) {
    wx.showModal({
      title: '提示',
      content: message,
      showCancel: false,
      confirmText: '我知道了'
    });
  }
});