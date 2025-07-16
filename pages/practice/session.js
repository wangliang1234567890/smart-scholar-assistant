import Dialog from '@vant/weapp/dialog/dialog';
import LocalDB from '../../utils/local-db';
import DatabaseManager from '../../utils/database';
import AIService from '../../utils/ai-service';

Page({
  data: {
    isLoading: true,
    practiceOptions: {}, // 练习参数
    questions: [], // 所有问题
    currentQuestionIndex: 0,
    userAnswers: {}, // { questionId: answer }
    
    // --- 衍变数据 ---
    currentQuestion: null,
    progress: 0,
    isLastQuestion: false,
    questionTypeMap: {
      'single_choice': '单选题',
      'multiple_choice': '多选题',
      'fill_blank': '填空题',
      'solve': '解答题'
    },
    
    // AI相关状态
    generatingQuestions: false,
    generationProgress: 0,
    generationStatus: '',
    
    // 批改相关状态
    isGrading: false,
    gradingStep: 0,
    gradingStatus: '',
    gradedCount: 0,
    
    // 弹窗状态
    showExitDialog: false,
    showSubmitDialog: false,
    
    // 计算属性
    remainingQuestions: 0,
    progressPercent: 0,
    submitMessage: '',
    progressRotation: 0,
    fillBlankCharCount: 0,
    solveCharCount: 0
  },

  onLoad(options) {
    console.log('练习页面加载，参数:', options);
    this.setData({ practiceOptions: options });
    this.fetchQuestions();
  },

  async fetchQuestions() {
    this.setData({ 
      isLoading: true,
      generatingQuestions: true,
      generationProgress: 0,
      generationStatus: '正在准备生成题目...',
      progressRotation: 0
    });

    try {
      // 使用AI服务生成题目
      const questionsResult = await this.generateQuestionsWithAI();
      
      if (questionsResult.success && questionsResult.questions.length > 0) {
        this.setData({
          questions: questionsResult.questions,
          isLoading: false,
          generatingQuestions: false,
          generationStatus: '题目生成完成！'
        });
        
        this.updateCurrentQuestion();
        
        // 显示生成成功提示
        wx.showToast({
          title: `成功生成${questionsResult.questions.length}道题目`,
          icon: 'success',
          duration: 2000
        });
      } else {
        throw new Error('题目生成失败');
      }
      
    } catch (error) {
      console.error('生成题目失败:', error);
      
      // 降级：使用模拟数据
      console.log('使用模拟数据作为降级方案');
      const mockQuestions = this.generateMockQuestions(this.data.practiceOptions);
      
      this.setData({
        questions: mockQuestions,
        isLoading: false,
        generatingQuestions: false,
        generationStatus: '使用样例题目'
      });
      
      this.updateCurrentQuestion();
      
      wx.showToast({
        title: '使用样例题目进行练习',
        icon: 'none',
        duration: 2000
      });
    }
  },

  // 使用AI服务生成题目
  async generateQuestionsWithAI() {
    const { subject = 'math', count = 5, difficulty = 'medium', knowledge } = this.data.practiceOptions;
    
    // 更新生成状态
    this.setData({
      generationProgress: 20,
      generationStatus: '正在分析练习需求...',
      progressRotation: 20 * 3.6 // 20% * 360度 / 100%
    });
    
    // 准备AI生成参数
    const generateParams = {
      subject: this.translateSubject(subject),
      grade: this.getCurrentGrade(),
      difficulty: this.translateDifficulty(difficulty),
      questionType: 'mixed',
      count: parseInt(count) || 5,
      knowledgePoints: knowledge ? knowledge.split(',') : []
    };
    
    console.log('AI生成参数:', generateParams);
    
    // 模拟生成进度更新
    this.startGenerationProgress();
    
    // 调用AI服务
    const result = await AIService.generateQuestions(generateParams);
    
    // 停止进度更新
    this.stopGenerationProgress();
    
    // 处理生成结果
    if (result.success && result.questions) {
      // 转换题目格式以适配现有的答题界面
      const processedQuestions = result.questions.map((q, index) => ({
        id: q.id || `ai_${Date.now()}_${index}`,
        type: this.translateQuestionType(q.type),
        title: q.content,
        stem: q.stem || '',
        options: q.options || [],
        correct: q.correctAnswer,
        explanation: q.explanation,
        knowledgePoints: q.knowledgePoints || [],
        difficulty: q.difficulty,
        source: 'ai_generated'
      }));
      
      this.setData({
        generationProgress: 100,
        generationStatus: '题目生成完成',
        progressRotation: 360
      });
      
      return {
        success: true,
        questions: processedQuestions,
        totalGenerated: processedQuestions.length
      };
    } else {
      throw new Error('AI服务返回格式错误');
    }
  },

  // 开始生成进度更新
  startGenerationProgress() {
    let progress = 20;
    const steps = [
      { progress: 40, status: '正在分析知识点结构...', delay: 800 },
      { progress: 60, status: '正在生成题目内容...', delay: 1200 },
      { progress: 80, status: '正在优化题目质量...', delay: 1000 },
      { progress: 95, status: '正在完成最后处理...', delay: 600 }
    ];
    
    let stepIndex = 0;
          const updateProgress = () => {
        if (stepIndex < steps.length && this.data.generatingQuestions) {
          const step = steps[stepIndex];
          this.setData({
            generationProgress: step.progress,
            generationStatus: step.status,
            progressRotation: (step.progress / 100) * 360
          });
          stepIndex++;
          
          this.generationTimer = setTimeout(updateProgress, step.delay);
        }
      };
    
    updateProgress();
  },

  // 停止生成进度更新
  stopGenerationProgress() {
    if (this.generationTimer) {
      clearTimeout(this.generationTimer);
      this.generationTimer = null;
    }
  },

  // 取消生成
  cancelGeneration() {
    this.stopGenerationProgress();
    
    wx.showModal({
      title: '取消生成',
      content: '确定要取消题目生成吗？',
      success: (res) => {
        if (res.confirm) {
          wx.navigateBack();
        } else {
          // 重新开始生成进度
          if (this.data.generatingQuestions) {
            this.startGenerationProgress();
          }
        }
      }
    });
  },

  // 翻译学科名称
  translateSubject(subject) {
    const subjectMap = {
      'math': '数学',
      'chinese': '语文', 
      'english': '英语',
      'physics': '物理',
      'chemistry': '化学'
    };
    return subjectMap[subject] || '数学';
  },

  // 翻译难度等级
  translateDifficulty(difficulty) {
    const difficultyMap = {
      'easy': 2,
      'medium': 3,
      'hard': 4
    };
    return difficultyMap[difficulty] || 3;
  },

  // 翻译题目类型
  translateQuestionType(type) {
    const typeMap = {
      'single_choice': 'single_choice',
      'multiple_choice': 'multiple_choice',
      'fill_blank': 'fill_blank',
      'solve': 'solve'
    };
    return typeMap[type] || 'single_choice';
  },

  // 获取难度文本
  getDifficultyText(difficulty) {
    const difficultyMap = {
      1: '很简单',
      2: '简单',
      3: '中等',
      4: '较难',
      5: '很难'
    };
    return difficultyMap[difficulty] || '中等';
  },

  // 获取当前年级
  getCurrentGrade() {
    try {
      const app = getApp();
      const userInfo = app.getUserInfo ? app.getUserInfo() : null;
      return userInfo?.grade || 3; // 默认三年级
    } catch (error) {
      return 3;
    }
  },

  updateCurrentQuestion() {
    const { questions, currentQuestionIndex, userAnswers } = this.data;
    if (questions.length > 0) {
      const current = JSON.parse(JSON.stringify(questions[currentQuestionIndex]));
      const answer = userAnswers[current.id] || (current.type==='multiple_choice'?[]:'');
      current.options = current.options.map(opt=>({
        ...opt,
        active: current.type==='multiple_choice' ? answer.includes(opt.value) : answer===opt.value
      }));
      
      // 添加难度文本
      current.difficultyText = this.getDifficultyText(current.difficulty);
      
      const progress = ((currentQuestionIndex + 1) / questions.length) * 100;
      
      // 计算字符数统计
      const currentAnswer = userAnswers[current.id] || '';
      const fillBlankCharCount = current.type === 'fill_blank' ? currentAnswer.length : 0;
      const solveCharCount = current.type === 'solve' ? currentAnswer.length : 0;
      
      this.setData({
        currentQuestion: current,
        progress: progress,
        progressPercent: Math.round(progress),
        isLastQuestion: currentQuestionIndex === questions.length - 1,
        fillBlankCharCount,
        solveCharCount
      });
    }
  },

  onAnswerChange(e) {
    const { id } = this.data.currentQuestion;
    this.setData({
      [`userAnswers.${id}`]: e.detail
    });
  },

  // 单选题选择
  onSingleSelect(e) {
    const value = e.currentTarget.dataset.value;
    const { id } = this.data.currentQuestion;
    
    this.setData({
      [`userAnswers.${id}`]: value
    });
    
    // 触发震动反馈
    wx.vibrateShort();
    
    this.updateCurrentQuestion();
  },

  // 多选题选择
  onMultiSelect(e) {
    const value = e.currentTarget.dataset.value;
    const { id } = this.data.currentQuestion;
    const currentAnswers = this.data.userAnswers[id] || [];
    
    let newAnswers;
    if (currentAnswers.includes(value)) {
      newAnswers = currentAnswers.filter(v => v !== value);
    } else {
      newAnswers = [...currentAnswers, value];
    }
    
    this.setData({
      [`userAnswers.${id}`]: newAnswers
    });
    
    // 触发震动反馈
    wx.vibrateShort();
    
    this.updateCurrentQuestion();
  },

  // 填空题输入
  onFillBlankInput(e) {
    const { id } = this.data.currentQuestion;
    const value = e.detail.value;
    this.setData({
      [`userAnswers.${id}`]: value,
      fillBlankCharCount: value.length
    });
  },

  // 解答题输入
  onSolveInput(e) {
    const { id } = this.data.currentQuestion;
    const value = e.detail.value;
    this.setData({
      [`userAnswers.${id}`]: value,
      solveCharCount: value.length
    });
  },

  prevQuestion() {
    if (this.data.currentQuestionIndex > 0) {
      this.setData({
        currentQuestionIndex: this.data.currentQuestionIndex - 1
      });
      this.updateCurrentQuestion();
      
      // 滚动到顶部
      wx.pageScrollTo({
        scrollTop: 0,
        duration: 300
      });
    }
  },

  nextQuestion() {
    if (this.data.isLastQuestion) {
      this.showSubmitConfirm();
    } else {
      this.setData({
        currentQuestionIndex: this.data.currentQuestionIndex + 1
      });
      this.updateCurrentQuestion();
      
      // 滚动到顶部
      wx.pageScrollTo({
        scrollTop: 0,
        duration: 300
      });
    }
  },

  // 显示退出确认
  showExitConfirm() {
    this.setData({
      showExitDialog: true
    });
  },

  // 确认退出
  confirmExit() {
    this.setData({
      showExitDialog: false
    });
    wx.navigateBack();
  },

  // 取消退出
  cancelExit() {
    this.setData({
      showExitDialog: false
    });
  },

  // 显示提交确认
  showSubmitConfirm() {
    // 检查答题完成情况
    const { questions, userAnswers } = this.data;
    const unansweredCount = questions.reduce((count, q) => {
      const answer = userAnswers[q.id];
      if (!answer || (Array.isArray(answer) && answer.length === 0)) {
        return count + 1;
      }
      return count;
    }, 0);
    
    // 生成提交消息
    const submitMessage = unansweredCount > 0 
      ? `您还有${unansweredCount}道题目未作答，确定要提交吗？`
      : `您已完成所有${questions.length}道题目，确定要提交答案吗？`;
    
    if (unansweredCount > 0) {
      this.setData({
        showSubmitDialog: true,
        unansweredCount,
        submitMessage
      });
    } else {
      this.setData({
        submitMessage
      });
      this.submitPractice();
    }
  },

  // 更新剩余题目数量
  updateRemainingQuestions() {
    const { questions, gradedCount = 0 } = this.data;
    const remainingQuestions = Math.max(0, questions.length - gradedCount);
    this.setData({
      remainingQuestions
    });
  },

  // 获取提交确认消息
  getSubmitMessage() {
    const { questions, unansweredCount = 0 } = this.data;
    if (unansweredCount > 0) {
      return `您还有${unansweredCount}道题目未作答，确定要提交吗？`;
    }
    return `您已完成所有${questions.length}道题目，确定要提交答案吗？`;
  },

  // 确认提交
  confirmSubmit() {
    this.setData({
      showSubmitDialog: false
    });
    this.submitPractice();
  },

  // 取消提交
  cancelSubmit() {
    this.setData({
      showSubmitDialog: false
    });
  },

  async submitPractice() {
    this.setData({
      isGrading: true,
      gradingStep: 0,
      gradingStatus: '正在准备批改...',
      gradedCount: 0
    });

    try {
          // 开始批改进度更新
    this.startGradingProgress();
    
    // 更新剩余题目数量
    this.updateRemainingQuestions();
      
      // 使用AI智能批改
      const gradingResults = await this.intelligentGrading();
      
      // 停止批改进度更新
      this.stopGradingProgress();
      
      // 计算最终成绩
      const finalScore = this.calculateFinalScore(gradingResults);
      
      // 保存练习记录
      const record = await this.savePracticeRecord(gradingResults, finalScore);
      
      // 跳转到结果页面
      wx.redirectTo({
        url: `/pages/practice/result?localId=${record.id}`
      });
      
    } catch (error) {
      console.error('提交练习失败:', error);
      
      // 停止批改进度更新
      this.stopGradingProgress();
      
      this.setData({
        isGrading: false
      });
      
      // 降级：使用简单批改
      this.submitWithSimpleGrading();
    }
  },

  // 开始批改进度更新
  startGradingProgress() {
    const { questions } = this.data;
    let step = 0;
    let gradedCount = 0;
    
    const steps = [
      { step: 1, status: '正在分析答案内容...', delay: 800 },
      { step: 2, status: '正在进行智能评分...', delay: 1500 },
      { step: 3, status: '正在生成详细报告...', delay: 1000 }
    ];
    
    const updateGradingProgress = () => {
      if (step < steps.length && this.data.isGrading) {
        const currentStep = steps[step];
        this.setData({
          gradingStep: currentStep.step,
          gradingStatus: currentStep.status
        });
        step++;
        
        this.gradingTimer = setTimeout(updateGradingProgress, currentStep.delay);
      }
    };
    
    // 模拟批改进度
    const updateGradedCount = () => {
      if (gradedCount < questions.length && this.data.isGrading) {
        gradedCount++;
        this.setData({
          gradedCount
        });
        
        // 更新剩余题目数量
        this.updateRemainingQuestions();
        
        const delay = 200 + Math.random() * 300; // 随机延迟
        this.gradingCountTimer = setTimeout(updateGradedCount, delay);
      }
    };
    
    updateGradingProgress();
    updateGradedCount();
  },

  // 停止批改进度更新
  stopGradingProgress() {
    if (this.gradingTimer) {
      clearTimeout(this.gradingTimer);
      this.gradingTimer = null;
    }
    
    if (this.gradingCountTimer) {
      clearTimeout(this.gradingCountTimer);
      this.gradingCountTimer = null;
    }
  },

  // AI智能批改
  async intelligentGrading() {
    const { questions, userAnswers } = this.data;
    const gradingResults = [];

    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      const userAnswer = userAnswers[question.id];
      const standardAnswer = question.correct;

      try {
        // 调用AI批改服务
        const gradingResult = await AIService.intelligentGrading(
          {
            type: question.type,
            content: question.title,
            subject: this.translateSubject(this.data.practiceOptions.subject)
          },
          userAnswer,
          standardAnswer
        );

        gradingResults.push({
          questionId: question.id,
          userAnswer,
          standardAnswer,
          isCorrect: gradingResult.isCorrect,
          score: gradingResult.score,
          feedback: gradingResult.feedback,
          analysis: gradingResult.analysis
        });

      } catch (error) {
        console.error(`题目${i+1}批改失败:`, error);
        
        // 降级：简单比较
        const isCorrect = this.simpleCompare(userAnswer, standardAnswer, question.type);
        gradingResults.push({
          questionId: question.id,
          userAnswer,
          standardAnswer,
          isCorrect,
          score: isCorrect ? 100 : 0,
          feedback: isCorrect ? '回答正确' : '回答错误',
          analysis: ''
        });
      }
    }

    return gradingResults;
  },

  // 简单答案比较
  simpleCompare(userAnswer, standardAnswer, questionType) {
    if (!userAnswer || !standardAnswer) return false;
    
    if (questionType === 'multiple_choice') {
      if (!Array.isArray(userAnswer)) return false;
      const userSorted = userAnswer.sort().join(',');
      const standardSorted = Array.isArray(standardAnswer) ? 
        standardAnswer.sort().join(',') : standardAnswer;
      return userSorted === standardSorted;
    } else {
      const userClean = userAnswer.toString().toLowerCase().trim();
      const standardClean = standardAnswer.toString().toLowerCase().trim();
      return userClean === standardClean;
    }
  },

  // 计算最终成绩
  calculateFinalScore(gradingResults) {
    if (gradingResults.length === 0) return 0;
    
    const correctCount = gradingResults.filter(r => r.isCorrect).length;
    const totalScore = gradingResults.reduce((sum, r) => sum + r.score, 0);
    const averageScore = totalScore / gradingResults.length;
    
    return {
      correctAnswers: correctCount,
      totalQuestions: gradingResults.length,
      accuracy: Math.round((correctCount / gradingResults.length) * 100),
      score: Math.round(averageScore),
      details: gradingResults
    };
  },

  // 保存练习记录
  async savePracticeRecord(gradingResults, finalScore) {
    const record = {
      id: `ai_practice_${Date.now()}`,
      timestamp: Date.now(),
      options: this.data.practiceOptions,
      questions: this.data.questions,
      answers: this.data.userAnswers,
      gradingResults,
      correctAnswers: finalScore.correctAnswers,
      totalQuestions: finalScore.totalQuestions,
      accuracy: finalScore.accuracy,
      score: finalScore.score,
      source: 'ai_generated',
      synced: false
    };

    // 保存到本地
    LocalDB.savePracticeRecord(record);

    // 尝试云端同步
    try {
      const app = getApp();
      const user = app.getUserInfo && app.getUserInfo();
      await DatabaseManager.savePracticeRecord({
        userId: user ? user._id : '',
        subject: this.translateSubject(this.data.practiceOptions.subject),
        difficulty: this.translateDifficulty(this.data.practiceOptions.difficulty),
        questionType: 'ai_generated',
        totalQuestions: finalScore.totalQuestions,
        correctAnswers: finalScore.correctAnswers,
        score: finalScore.score,
        accuracy: finalScore.accuracy,
        duration: 0,
        questions: this.data.questions,
        userAnswers: this.data.userAnswers,
        gradingDetails: gradingResults
      });
      record.synced = true;
    } catch(err) {
      console.warn('同步练习记录失败', err);
    }

    return record;
  },

  // 降级：简单批改提交
  async submitWithSimpleGrading() {
    wx.showLoading({
      title: '正在批改...',
      mask: true
    });

    try {
      // 计算成绩
      let correctAnswers = 0;
      this.data.questions.forEach(q=>{
        const userAns = this.data.userAnswers[q.id];
        if (!userAns) return;
        if (q.type==='single_choice') {
          if (userAns === q.correct) correctAnswers++;
        } else if (q.type==='multiple_choice') {
          if (Array.isArray(userAns) && userAns.sort().toString() === q.correct.sort().toString()) correctAnswers++;
        }
      });
      const total = this.data.questions.length;
      const score = total>0 ? Math.round((correctAnswers/total)*100) : 0;

      const record = {
        id: `local_${Date.now()}`,
        timestamp: Date.now(),
        options: this.data.practiceOptions,
        questions: this.data.questions,
        answers: this.data.userAnswers,
        correctAnswers,
        score,
        synced: false
      };
      LocalDB.savePracticeRecord(record);

      // 云端同步（忽略错误）
      try {
        const app = getApp();
        const user = app.getUserInfo && app.getUserInfo();
        await DatabaseManager.savePracticeRecord({
          userId: user ? user._id : '',
          subject: this.translateSubject(this.data.practiceOptions.subject),
          difficulty: this.translateDifficulty(this.data.practiceOptions.difficulty),
          questionType: 'mix',
          totalQuestions: total,
          correctAnswers: correctAnswers,
          score: score,
          duration: 0,
          questions: this.data.questions,
          userAnswers: this.data.userAnswers
        });
        record.synced = true;
      } catch(err) {
        console.warn('同步练习记录失败', err);
      }

      wx.hideLoading();
      
      wx.redirectTo({
        url: `/pages/practice/result?localId=${record.id}`
      });
      
    } catch (error) {
      wx.hideLoading();
      wx.showToast({
        title: '批改失败，请重试',
        icon: 'none'
      });
    }
  },

  // 页面卸载时清理定时器
  onUnload() {
    this.stopGenerationProgress();
    this.stopGradingProgress();
  },

  onHide() {
    this.stopGenerationProgress();
    this.stopGradingProgress();
  },

  // --- Mock数据生成（降级使用）---
  generateMockQuestions(options) {
    const { subject = 'math', count = 5 } = options;
    let mockData = [];
    
    const mathQuestions = [
      { 
        id: 'm1', 
        type: 'single_choice', 
        title: '计算：15 + 27 = ?', 
        stem: '请选择正确的答案。', 
        options: [
          {label: '32', value: 'A'}, 
          {label: '42', value: 'B'}, 
          {label: '45', value: 'C'}
        ], 
        correct: 'B',
        explanation: '15 + 27 = 42，这是基础的加法运算。',
        knowledgePoints: ['加法运算', '两位数加法'],
        difficulty: 2
      },
      { 
        id: 'm2', 
        type: 'single_choice', 
        title: '一个正方形有几条边？', 
        stem: '', 
        options: [
          {label: '3', value: 'A'}, 
          {label: '4', value: 'B'}, 
          {label: '5', value: 'C'}
        ], 
        correct: 'B',
        explanation: '正方形有4条边，这是基本的几何知识。',
        knowledgePoints: ['几何图形', '正方形'],
        difficulty: 1
      },
      { 
        id: 'm3', 
        type: 'multiple_choice', 
        title: '以下哪些是偶数？', 
        stem: '请选择所有符合条件的答案。', 
        options: [
          {label: '2', value: 'A'}, 
          {label: '7', value: 'B'}, 
          {label: '10', value: 'C'}, 
          {label: '13', value: 'D'}
        ], 
        correct: ['A','C'],
        explanation: '偶数是能被2整除的数，2和10都是偶数。',
        knowledgePoints: ['奇偶数', '数的性质'],
        difficulty: 2
      },
      { 
        id: 'm4', 
        type: 'fill_blank', 
        title: '9 × 8 = ___', 
        stem: '请计算乘法结果。', 
        options: [], 
        correct: '72',
        explanation: '9 × 8 = 72，这是乘法口诀表中的内容。',
        knowledgePoints: ['乘法口诀', '乘法运算'],
        difficulty: 2
      },
      { 
        id: 'm5', 
        type: 'solve', 
        title: '小明有15个苹果，吃了3个，又买了8个，现在有多少个苹果？', 
        stem: '请写出完整的解题过程。', 
        options: [], 
        correct: '20个苹果',
        explanation: '解题过程：15 - 3 + 8 = 20，答：现在有20个苹果。',
        knowledgePoints: ['应用题', '加减混合运算'],
        difficulty: 3
      },
    ];

    const chineseQuestions = [
      {
        id: 'c1',
        type: 'single_choice',
        title: '下面哪个字的读音是正确的？',
        stem: '请选择正确答案。',
        options: [
          {label: '读(dú)书', value: 'A'},
          {label: '读(dòu)书', value: 'B'},
          {label: '读(tú)书', value: 'C'}
        ],
        correct: 'A',
        explanation: '"读"字读作"dú"，是常用的读音。',
        knowledgePoints: ['拼音', '字音'],
        difficulty: 2
      }
    ];

    const englishQuestions = [
      {
        id: 'e1',
        type: 'single_choice',
        title: 'What color is the apple?',
        stem: 'Choose the correct answer.',
        options: [
          {label: 'Red', value: 'A'},
          {label: 'Blue', value: 'B'},
          {label: 'Yellow', value: 'C'}
        ],
        correct: 'A',
        explanation: 'Apple is usually red in color.',
        knowledgePoints: ['颜色词汇', '基础对话'],
        difficulty: 1
      }
    ];

    switch(subject) {
      case 'math': mockData = mathQuestions; break;
      case 'chinese': mockData = chineseQuestions; break;
      case 'english': mockData = englishQuestions; break;
      default: mockData = mathQuestions;
    }

    return mockData.slice(0, parseInt(count, 10));
  }
}); 