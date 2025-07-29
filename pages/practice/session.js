import Dialog from '@vant/weapp/dialog/dialog';
import DatabaseManager from '../../utils/database.js';

Page({
  data: {
    practiceType: 'ai',
    questions: [],
    currentIndex: 0,
    currentQuestion: null,
    userAnswer: null,
    userAnswerText: '',
    showResult: false,
    loading: true,
    totalQuestions: 0,
    showExitDialog: false,
    showSubmitDialog: false,
    submitMessage: '确定要提交答案吗？',
    examTitle: '',
    generatingQuestions: false,
    isGrading: false,
    isLoading: false
  },

  onLoad(options) {
    console.log('练习页面加载，参数:', options);
    
    if (options.type === 'review' && options.mistakes) {
      try {
        const mistakesData = JSON.parse(decodeURIComponent(options.mistakes));
        console.log('解析到的错题数据:', mistakesData);
        
        // 详细打印第一条数据的结构
        if (mistakesData.length > 0) {
          console.log('第一条错题详细数据:', JSON.stringify(mistakesData[0], null, 2));
        }
        
        // 转换错题数据为练习题目格式
        const questions = this.convertMistakesToQuestions(mistakesData);
        console.log('转换后的题目数据:', questions);
        
        // 详细打印第一条转换后的数据
        if (questions.length > 0) {
          console.log('第一条转换后详细数据:', JSON.stringify(questions[0], null, 2));
        }
        
        this.setData({
          practiceType: 'review',
          questions: questions,
          currentQuestion: questions[0] || null,
          totalQuestions: questions.length,
          currentIndex: 0,
          loading: false,
          userAnswer: null,
          userAnswerText: ''
        });
        
        // 打印设置后的页面数据
        console.log('页面数据设置完成:', {
          currentIndex: this.data.currentIndex,
          totalQuestions: this.data.totalQuestions,
          currentQuestion: this.data.currentQuestion
        });
        
      } catch (error) {
        console.error('解析错题数据失败:', error);
        this.showError('数据解析失败');
      }
    } else if (options.type === 'exam' && options.questions) {
      // 处理从试卷页面跳转过来的情况
      try {
        const questionsData = JSON.parse(decodeURIComponent(options.questions));
        console.log('解析到的试卷题目数据:', questionsData);
        
        // 转换试卷题目格式
        const questions = this.convertExamQuestionsToSession(questionsData);
        console.log('转换后的题目数据:', questions);
        
        this.setData({
          practiceType: 'exam',
          questions: questions,
          currentQuestion: questions[0] || null,
          totalQuestions: questions.length,
          currentIndex: 0,
          loading: false,
          examTitle: options.title || 'AI智能练习试卷',
          userAnswer: null,
          userAnswerText: ''
        });
        
        console.log('试卷答题页面数据设置完成:', {
          currentIndex: this.data.currentIndex,
          totalQuestions: this.data.totalQuestions,
          currentQuestion: this.data.currentQuestion
        });
        
        // 调试第一题的详细信息
        if (questions[0]) {
          console.log('第一题详细信息:', {
            type: questions[0].type,
            options: questions[0].options,
            optionsLength: questions[0].options ? questions[0].options.length : 0,
            question: questions[0].question
          });
        }
        
      } catch (error) {
        console.error('解析试卷题目数据失败:', error);
        this.showError('试卷数据解析失败');
      }
    } else if (options.type === 'ai') {
      this.loadAIQuestions();
    } else {
      // 默认情况，加载示例题目
      console.log('未知类型或缺少参数，加载示例题目');
      this.loadAIQuestions();
    }
  },

  // 转换错题数据为练习题目格式
  convertMistakesToQuestions(mistakes) {
    return mistakes.map((mistake, index) => {
      console.log(`转换第${index + 1}条错题:`, mistake);
      
      // 获取基础题目内容
      let questionContent = mistake.question || mistake.content || mistake.title || '题目内容缺失';
      
      // 清理题目内容
      let cleanQuestion = this.cleanQuestionContent(questionContent);
      
      // 处理选项：首先尝试使用原有选项
      let processedOptions = [];
      let questionType = 'input'; // 默认为填空题
      
      if (mistake.options && Array.isArray(mistake.options) && mistake.options.length > 0) {
        // 使用原有选项
        processedOptions = mistake.options.map(option => {
          if (typeof option === 'string') {
            return option.replace(/^[A-Z]\.\s*/, '').trim();
          }
          return option;
        });
        questionType = 'choice';
        console.log(`使用原有选项:`, processedOptions);
      } else if (mistake.choices && Array.isArray(mistake.choices) && mistake.choices.length > 0) {
        // 使用choices字段
        processedOptions = mistake.choices;
        questionType = 'choice';
        console.log(`使用choices字段:`, processedOptions);
      } else {
        // 智能提取选项
        console.log(`智能提取选项，题目内容:`, cleanQuestion);
        
        // 1. 尝试从题目内容中提取选项
        const extractedOptions = this.extractOptionsFromContent(cleanQuestion);
        if (extractedOptions.length > 0) {
          processedOptions = extractedOptions;
          questionType = 'choice';
          console.log(`提取到选项:`, extractedOptions);
        } else {
          // 2. 检测题目类型
          const detectedType = this.detectQuestionType(cleanQuestion);
          questionType = detectedType;
          console.log(`检测题目类型:`, detectedType);
          
          // 3. 如果题目暗示是选择题但没有具体选项，生成通用选项
          if (this.isLikelyChoiceQuestion(cleanQuestion)) {
            processedOptions = this.generateGenericOptions(cleanQuestion);
            if (processedOptions.length > 0) {
              questionType = 'choice';
              console.log(`生成通用选项:`, processedOptions);
            }
          }
        }
      }
      
      const converted = {
        id: mistake._id || `question_${index}`,
        question: cleanQuestion,
        options: processedOptions,
        correctAnswer: mistake.correctAnswer || mistake.answer || mistake.solution || '',
        analysis: mistake.analysis || mistake.explanation || mistake.解析 || '',
        subject: this.formatSubject(mistake.subject || mistake.学科 || 'unknown'),
        difficulty: this.formatDifficulty(mistake.difficulty || mistake.难度),
        type: questionType,
        userAnswer: mistake.userAnswer || mistake.我的答案 || '',
        mistakeReason: mistake.mistakeReason || mistake.错误原因 || ''
      };
      
      console.log(`转换结果:`, converted);
      return converted;
    });
  },

  // 转换试卷题目格式为答题页面格式
  convertExamQuestionsToSession(examQuestions) {
    return examQuestions.map((question, index) => {
      console.log(`转换第${index + 1}道试卷题目:`, question);
      
      // 清理和格式化题目内容
      let cleanQuestion = this.cleanQuestionContent(question.content || question.question || '题目内容缺失');
      
      // 处理选项格式
      let processedOptions = [];
      let questionType = 'input'; // 默认为填空题
      
              if (question.options && Array.isArray(question.options) && question.options.length > 0) {
          processedOptions = question.options.map(option => {
            if (typeof option === 'string') {
              return option.replace(/^[A-Z]\.\s*/, '').trim();
            }
            return option;
          });
        questionType = 'choice'; // 有选项的为选择题
              } else {
          // 尝试从题目内容中提取选项
          const extractedOptions = this.extractOptionsFromContent(cleanQuestion);
          if (extractedOptions.length > 0) {
            processedOptions = extractedOptions;
            questionType = 'choice';
          } else {
            // 检测题目类型
            const detectedType = this.detectQuestionType(cleanQuestion);
            questionType = detectedType;
            
            // 如果题目暗示是选择题但没有具体选项，生成通用选项
            if (this.isLikelyChoiceQuestion(cleanQuestion)) {
              processedOptions = this.generateGenericOptions(cleanQuestion);
              if (processedOptions.length > 0) {
                questionType = 'choice';
              }
            }
          }
                }
      
      // 统一题目格式
      const converted = {
        id: question.id || `exam_question_${index}`,
        question: cleanQuestion,
        options: processedOptions,
        correctAnswer: question.correctAnswer || '',
        analysis: question.explanation || question.analysis || '',
        subject: this.formatSubject(question.subject || question.sectionName || 'math'),
        difficulty: this.formatDifficulty(question.difficulty),
        type: questionType,
        scorePerQuestion: question.scorePerQuestion || 5,
        userAnswer: '', // 初始化用户答案
        sectionName: question.sectionName || '',
        knowledgePoints: question.knowledgePoints || [],
        tip: question.tip || ''
      };
      
      console.log(`转换结果:`, converted);
      return converted;
    });
  },

  // 格式化难度显示
  formatDifficulty(difficulty) {
    const difficultyMap = {
      1: '简单',
      2: '较易', 
      3: '中等',
      4: '较难',
      5: '困难',
      'easy': '简单',
      'medium': '中等',
      'hard': '困难'
    };
    return difficultyMap[difficulty] || '中等';
  },

  // 格式化题目类型
  formatQuestionType(type) {
    const typeMap = {
      'single_choice': 'choice',
      'multiple_choice': 'choice',
      'fill_blank': 'input',
      'short_answer': 'input',
      'judge': 'choice'
    };
    return typeMap[type] || 'choice';
  },

  // 格式化学科显示
  formatSubject(subject) {
    const subjectMap = {
      'math': '数学',
      'chinese': '语文',
      'english': '英语',
      'physics': '物理',
      'chemistry': '化学',
      'biology': '生物',
      'history': '历史',
      'geography': '地理',
      'politics': '政治'
    };
    return subjectMap[subject] || subject || '数学';
  },

  // 清理题目内容格式
  cleanQuestionContent(content) {
    if (!content) return '题目内容缺失';
    
    return content
      // 移除多余的换行符和空白
      .replace(/\n+/g, '\n')
      .replace(/\s+/g, ' ')
      // 移除OCR识别的格式标记
      .replace(/图片中的文字内容如下：/g, '')
      .replace(/\*\*题目\*\*：/g, '题目：')
      .replace(/\*\*图示内容\*\*：/g, '')
      .replace(/\*\*答案\*\*：/g, '答案：')
      // 清理多余的标点和空格
      .replace(/↵+/g, '\n')
      .replace(/\s*\n\s*/g, '\n')
      .replace(/^\s+|\s+$/g, '')
      // 限制题目长度，避免过长影响显示
      .substring(0, 200);
  },

  // 从题目内容中提取选项
  extractOptionsFromContent(content) {
    const options = [];
    
    // 匹配 A、B、C、D 或 A. B. C. D. 格式的选项
    const optionPattern = /([A-D])[.、：]?\s*([^A-D\n]{1,50}?)(?=[A-D][.、：]|$)/g;
    let match;
    
    while ((match = optionPattern.exec(content)) !== null) {
      const optionText = match[2].trim();
      if (optionText && optionText.length > 0 && optionText.length < 50) {
        options.push(optionText);
      }
    }
    
    // 如果没找到标准格式，尝试其他模式
    if (options.length === 0) {
      // 查找"选项："后的内容
      const choiceMatch = content.match(/选项[：:]\s*([A-D].*?)(?:\n|$)/);
      if (choiceMatch) {
        const choiceText = choiceMatch[1];
        const choices = choiceText.split(/[A-D][.、：]/).filter(item => item.trim());
        if (choices.length > 1) {
          choices.forEach(choice => {
            const cleaned = choice.trim().substring(0, 30);
            if (cleaned) options.push(cleaned);
          });
        }
      }
    }
    
    return options.slice(0, 4); // 最多4个选项
  },

  // 检测题目类型
  detectQuestionType(content) {
    const lowerContent = content.toLowerCase();
    
    // 包含空白、填空相关关键词
    if (lowerContent.includes('____') || lowerContent.includes('填空') || 
        lowerContent.includes('空白') || lowerContent.includes('？') || 
        lowerContent.includes('多少') || lowerContent.includes('计算')) {
      return 'input';
    }
    
    // 包含解答、简述等关键词
    if (lowerContent.includes('简述') || lowerContent.includes('解答') || 
        lowerContent.includes('说明') || lowerContent.includes('分析') ||
        lowerContent.includes('解释') || content.length > 150) {
      return 'short_answer';
    }
    
    // 默认为填空题
    return 'input';
  },

  // 判断是否可能是选择题
  isLikelyChoiceQuestion(content) {
    const lowerContent = content.toLowerCase();
    
    // 包含选择、选项等关键词
    if (lowerContent.includes('选择') || lowerContent.includes('选项') ||
        lowerContent.includes('下列') || lowerContent.includes('下面') ||
        lowerContent.includes('哪个') || lowerContent.includes('哪种') ||
        lowerContent.includes('正确') || lowerContent.includes('错误')) {
      return true;
    }
    
    // 包含A、B、C、D字母提示
    if (content.includes('A') && content.includes('B') && 
        content.includes('C') && content.includes('D')) {
      return true;
    }
    
    return false;
  },

  // 生成通用选项
  generateGenericOptions(content) {
    const lowerContent = content.toLowerCase();
    
    // 数学题通用选项
    if (lowerContent.includes('数学') || lowerContent.includes('计算') ||
        lowerContent.includes('立方体') || lowerContent.includes('图形')) {
      return [
        '圆锥体',
        '圆柱体', 
        '球体',
        '棱锥体'
      ];
    }
    
    // 包含数字的题目
    if (/\d+/.test(content)) {
      return [
        '正确',
        '错误',
        '不确定',
        '无法判断'
      ];
    }
    
    // 通用选择选项
    return [
      '选项A',
      '选项B',
      '选项C', 
      '选项D'
    ];
  },

  // 加载AI题目（从错题生成）
  async loadAIQuestions() {
    console.log('开始加载AI题目...');
    this.setData({ loading: true });
    
    try {
      const userId = wx.getStorageSync('userId') || 'default_user';
      
      // 从错题库中获取题目
      const mistakesResult = await DatabaseManager.getMistakes(userId, { 
        pageSize: 5,
        filters: { status: 'all' }
      });
      
      if (mistakesResult.success && mistakesResult.data && mistakesResult.data.length > 0) {
        console.log('从错题库获取到题目:', mistakesResult.data.length);
        
        // 转换错题为练习题目格式
        const questions = this.convertMistakesToQuestions(mistakesResult.data);
        
        this.setData({
          practiceType: 'ai',
          questions: questions,
          currentQuestion: questions[0] || null,
          totalQuestions: questions.length,
          currentIndex: 0,
          loading: false,
          userAnswer: null,
          userAnswerText: ''
        });
        
        console.log('AI题目加载完成');
      } else {
        console.log('暂无错题数据，显示提示');
        this.showNoQuestionsError();
      }
    } catch (error) {
      console.error('加载AI题目失败:', error);
      this.showNoQuestionsError();
    }
  },
  
  // 显示无题目的错误信息
  showNoQuestionsError() {
    this.setData({ loading: false });
    wx.showModal({
      title: '暂无题目',
      content: '您还没有录入错题，请先通过拍照或手动添加一些错题，然后再来练习。',
      showCancel: true,
      cancelText: '返回',
      confirmText: '去添加',
      success: (res) => {
        if (res.confirm) {
          wx.navigateTo({ url: '/pages/camera/camera' });
        } else {
          wx.navigateBack();
        }
      }
    });
  },

  // 显示错误信息
  showError(message) {
    this.setData({ loading: false });
    wx.showModal({
      title: '加载失败',
      content: message,
      showCancel: false,
      success: () => {
        wx.navigateBack();
      }
    });
  },

  // 选择答案
  onSelectAnswer(e) {
    const { index, answer } = e.currentTarget.dataset;
    if (index !== undefined && answer !== undefined) {
      this.setData({ 
        userAnswer: parseInt(index),
        userAnswerText: answer || ''
      });
    }
  },

  // 处理用户输入（填空题和简答题）
  onAnswerInput(e) {
    const value = e.detail.value || '';
    this.setData({ 
      userAnswer: value,
      userAnswerText: value
    });
  },

  // 下一题 - 修复方法名
  nextQuestion() {
    const { currentIndex, questions } = this.data;
    
    if (currentIndex < questions.length - 1) {
      const nextIndex = currentIndex + 1;
      this.setData({
        currentIndex: nextIndex,
        currentQuestion: questions[nextIndex],
        userAnswer: null,
        userAnswerText: ''
      });
    } else {
      // 完成练习
      this.completePractice();
    }
  },

  // 上一题
  prevQuestion() {
    const { currentIndex, questions } = this.data;
    
    if (currentIndex > 0) {
      const prevIndex = currentIndex - 1;
      this.setData({
        currentIndex: prevIndex,
        currentQuestion: questions[prevIndex],
        userAnswer: null,
        userAnswerText: ''
      });
    }
  },

  // 完成练习
  completePractice() {
    wx.redirectTo({
      url: '/pages/practice/result?type=' + this.data.practiceType
    });
  },

  // 退出确认弹窗相关方法
  confirmExit() {
    this.setData({ showExitDialog: false });
    wx.navigateBack();
  },

  cancelExit() {
    this.setData({ showExitDialog: false });
  },

  // 提交确认弹窗相关方法
  confirmSubmit() {
    this.setData({ showSubmitDialog: false });
    this.completePractice();
  },

  cancelSubmit() {
    this.setData({ showSubmitDialog: false });
  },

  // 显示退出弹窗
  showExitDialog() {
    this.setData({ showExitDialog: true });
  }
}); 
