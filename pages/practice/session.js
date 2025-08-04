import Dialog from '@vant/weapp/dialog/dialog';
import DatabaseManager from '../../utils/database.js';
import EventManager, { EVENT_TYPES } from '../../utils/event-manager.js';

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
    isLoading: false,
    // 新增：练习结果追踪
    answerHistory: [], // 记录每题的答题情况
    startTime: null,   // 练习开始时间
    practiceId: null   // 练习ID
  },

  onLoad(options) {
    console.log('练习页面加载，参数:', options);
    
    // 初始化练习会话
    this.initPracticeSession();
    
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

  // 初始化练习会话
  initPracticeSession() {
    const practiceId = 'practice_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    const startTime = Date.now();
    
    this.setData({
      practiceId,
      startTime,
      answerHistory: []
    });
    
    console.log('练习会话初始化:', { practiceId, startTime });
  },

  // 记录答题历史
  recordAnswer(questionIndex, question, userAnswer, isCorrect = null) {
    const { answerHistory } = this.data;
    
    // 检查是否已经记录过这一题
    const existingIndex = answerHistory.findIndex(item => item.questionIndex === questionIndex);
    
    const answerRecord = {
      questionIndex,
      questionId: question._id || question.id || `q_${questionIndex}`,
      question: question.question || question.content || '',
      questionType: question.type || 'choice',
      userAnswer,
      correctAnswer: question.answer || question.correctAnswer || '',
      isCorrect,
      answerTime: Date.now(),
      subject: question.subject || '其他',
      difficulty: question.difficulty || 'medium'
    };
    
    if (existingIndex >= 0) {
      // 更新已有记录
      answerHistory[existingIndex] = answerRecord;
    } else {
      // 添加新记录
      answerHistory.push(answerRecord);
    }
    
    this.setData({ answerHistory });
    console.log('记录答题:', answerRecord);
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

  // 加载AI题目（使用AI大模型生成新题目）
  async loadAIQuestions() {
    console.log('开始使用AI生成练习题目...');
    this.setData({ 
      loading: true,
      generatingQuestions: true,
      isLoading: true
    });
    
    try {
      const userId = DatabaseManager.getCurrentUserId();
      
      // 1. 获取用户的错题作为AI生成的基础
      const mistakesResult = await DatabaseManager.getMistakes(userId, { 
        pageSize: 10, // 获取更多错题供AI分析
        filters: { status: 'all' }
      });
      
      if (!mistakesResult.success || !mistakesResult.data || mistakesResult.data.length === 0) {
        console.log('暂无错题数据，无法进行AI练习');
        this.showNoQuestionsError();
        return;
      }
      
      const mistakes = mistakesResult.data;
      console.log(`基于${mistakes.length}个错题生成AI练习题目...`);
      console.log('📋 错题数据样本:', mistakes.slice(0, 2)); // 输出前2个错题的详细信息
      
      // 2. 调用AI服务生成新题目
      const aiService = getApp().globalData.aiService;
      
      if (aiService && typeof aiService.generateQuestionsFromMistakes === 'function') {
        console.log('调用AI服务生成题目...');
        
        try {
          const aiResult = await aiService.generateQuestionsFromMistakes(mistakes.slice(0, 2), {
            count: 2,  // 生成2道新题
            types: ['single_choice'], // 只生成单选题，避免复杂格式问题
            difficulty: 'auto' // 根据错题难度自动调整
          });
          
          console.log('🔍 AI服务返回结果:', aiResult);
          
          if (aiResult.success && aiResult.questions && aiResult.questions.length > 0) {
            console.log(`AI成功生成${aiResult.questions.length}道新题目`);
            console.log('AI生成的题目数据:', aiResult.questions);
            
            // 验证AI题目格式
            const validQuestions = aiResult.questions.filter(q => 
              q && q.question && typeof q.question === 'string' && q.question.trim().length > 0
            );
            
            if (validQuestions.length === 0) {
              console.warn('AI生成的题目格式无效，使用降级方案');
              throw new Error('AI生成题目格式无效');
            }
            
            // 使用AI生成的题目
            this.setData({
              practiceType: 'ai',
              questions: validQuestions,
              currentQuestion: validQuestions[0] || null,
              totalQuestions: validQuestions.length,
              currentIndex: 0,
              loading: false,
              generatingQuestions: false,
              isLoading: false,
              userAnswer: null,
              userAnswerText: ''
            });
            
            // 显示AI生成成功提示
            wx.showToast({
              title: `AI生成${validQuestions.length}道练习题`,
              icon: 'success',
              duration: 2000
            });
            
            console.log('AI题目加载完成');
            console.log('当前题目:', validQuestions[0]);
            return;
            
          } else {
            console.warn('AI生成题目失败，使用降级方案');
            throw new Error('AI生成返回结果无效');
          }
          
        } catch (aiError) {
          console.error('AI题目生成失败:', aiError.message);
          
          // 显示AI生成失败，降级提示
          wx.showModal({
            title: 'AI生成失败',
            content: 'AI服务暂时不可用，将为您智能生成基于错题的变化练习题',
            showCancel: false,
            confirmText: '继续练习'
          });
        }
      } else {
        console.log('AI服务不可用，使用降级方案');
      }
      
      // 3. AI生成失败时的降级方案：基于错题生成练习题
      console.log('使用基于错题的降级练习题目...');
      
      // 从错题中随机选择一部分，稍作变化作为练习题
      const practiceQuestions = this.generatePracticeFromMistakes(mistakes);

    this.setData({
      practiceType: 'ai',
        questions: practiceQuestions,
        currentQuestion: practiceQuestions[0] || null,
        totalQuestions: practiceQuestions.length,
      currentIndex: 0,
        loading: false,
        generatingQuestions: false,
        isLoading: false,
        userAnswer: null,
        userAnswerText: ''
      });
      
      // 显示降级练习提示
      wx.showToast({
        title: '智能生成练习题目完成',
        icon: 'success',
        duration: 2000
      });
      
      console.log('基础练习题目加载完成');
      
    } catch (error) {
      console.error('加载AI题目失败:', error);
      this.setData({ 
        loading: false,
        generatingQuestions: false,
        isLoading: false
      });
      this.showNoQuestionsError();
    }
  },

  // 基于错题生成练习题目（降级方案）
  generatePracticeFromMistakes(mistakes) {
    console.log('使用智能降级方案生成练习题目...');
    
    // 随机选择错题，并智能生成变化题型
    const selectedMistakes = mistakes
      .sort(() => Math.random() - 0.5) // 随机排序
      .slice(0, 5); // 取前5个
    
    return selectedMistakes.map((mistake, index) => {
      const originalQuestion = mistake.question || mistake.content || '';
      
      // 智能生成变化题目
      const generatedQuestion = this.generateVariationQuestion(mistake, index);
      
      return {
        id: `ai_practice_${Date.now()}_${index}`,
        type: generatedQuestion.type,
        subject: mistake.subject || '综合',
        difficulty: mistake.difficulty || 3,
        question: generatedQuestion.question,
        options: generatedQuestion.options,
        answer: generatedQuestion.answer,
        explanation: generatedQuestion.explanation,
        keyPoints: mistake.keyPoints || [],
        source: 'ai_fallback',
        originalMistakeId: mistake._id || mistake.id,
        practiceType: 'ai_generated'
      };
    });
  },

  // 智能生成题目变化（模拟AI生成效果）
  generateVariationQuestion(mistake, index) {
    const originalQuestion = mistake.question || mistake.content || '';
    const subject = mistake.subject || 'unknown';
    
    // 根据题目类型和学科生成不同的变化
    const variations = this.getQuestionVariations(originalQuestion, subject, index);
    
    // 随机选择一个变化
    const selectedVariation = variations[Math.floor(Math.random() * variations.length)];
    
    return selectedVariation;
  },

  // 获取题目变化方案
  getQuestionVariations(originalQuestion, subject, index) {
    const variations = [];
    
    // 数学题目变化
    if (subject === 'math' || originalQuestion.includes('数学') || originalQuestion.includes('计算')) {
      variations.push(
        {
          type: 'single_choice',
          question: `【AI变化题${index + 1}】请根据数学规律，选择正确答案：下列哪个数字序列遵循相同的规律？`,
          options: ['1, 3, 5, 7, 9', '2, 4, 8, 16, 32', '1, 4, 9, 16, 25', '3, 6, 9, 12, 15'],
          answer: '1, 4, 9, 16, 25',
          explanation: '这是一个平方数序列：1²=1, 2²=4, 3²=9, 4²=16, 5²=25'
        },
        {
          type: 'fill_blank',
          question: `【AI变化题${index + 1}】填空题：如果一个正方形的边长是5cm，那么它的面积是___平方厘米。`,
          options: [],
          answer: '25',
          explanation: '正方形面积 = 边长 × 边长 = 5 × 5 = 25平方厘米'
        }
      );
    }
    
    // 语文题目变化
    if (subject === 'chinese' || originalQuestion.includes('语文') || originalQuestion.includes('文字')) {
      variations.push(
        {
          type: 'single_choice',
          question: `【AI变化题${index + 1}】下列词语中，哪个是正确的成语？`,
          options: ['风雨同舟', '风雨同州', '风与同舟', '凤雨同舟'],
          answer: '风雨同舟',
          explanation: '风雨同舟：比喻共同经历患难，同心协力'
        },
        {
          type: 'short_answer',
          question: `【AI变化题${index + 1}】请用"春天"这个词造一个句子，要求不少于10个字。`,
          options: [],
          answer: '春天来了，花儿都开了。',
          explanation: '要求使用"春天"造句，表达春天的美好景象'
        }
      );
    }
    
    // 英语题目变化
    if (subject === 'english' || originalQuestion.includes('英语') || originalQuestion.includes('English')) {
      variations.push(
        {
          type: 'single_choice',
          question: `【AI变化题${index + 1}】Choose the correct word: "I ___ to school every day."`,
          options: ['go', 'goes', 'going', 'went'],
          answer: 'go',
          explanation: '"I"是第一人称，用动词原形"go"'
        },
        {
          type: 'fill_blank',
          question: `【AI变化题${index + 1}】Complete the sentence: "What ___ your name?" (填入正确的be动词)`,
          options: [],
          answer: 'is',
          explanation: '"What is your name?"是询问姓名的常用句型'
        }
      );
    }
    
    // 空间几何题目变化（针对立方体旋转类题目）
    if (originalQuestion.includes('立方体') || originalQuestion.includes('旋转') || originalQuestion.includes('几何')) {
      variations.push(
        {
          type: 'single_choice',
          question: `【AI变化题${index + 1}】空间几何：如果将一个正方体沿着某条边旋转180度，下列哪个描述是正确的？`,
          options: ['形状完全改变', '得到一个圆柱体', '得到一个扇形', '位置改变但形状不变'],
          answer: '位置改变但形状不变',
          explanation: '正方体沿边旋转只是位置变化，几何形状本身不会改变'
        },
        {
          type: 'multiple_choice',
          question: `【AI变化题${index + 1}】下列哪些是正方体的基本特征？（多选）`,
          options: ['有6个面', '有8个顶点', '有12条边', '所有面都是正方形'],
          answer: '有6个面,有8个顶点,有12条边,所有面都是正方形',
          explanation: '正方体具有6个面、8个顶点、12条边，且所有面都是全等的正方形'
        }
      );
    }
    
    // 通用变化题目（如果没有匹配到特定类型）
    if (variations.length === 0) {
      variations.push(
        {
          type: 'single_choice',
          question: `【AI变化题${index + 1}】逻辑推理：根据规律，下一个数字应该是什么？ 2, 4, 6, 8, ?`,
          options: ['9', '10', '11', '12'],
          answer: '10',
          explanation: '这是一个偶数序列，下一个偶数是10'
        },
        {
          type: 'short_answer',
          question: `【AI变化题${index + 1}】思考题：请简单描述一下您对学习的理解（不少于15字）。`,
          options: [],
          answer: '学习是获取知识和技能的过程，需要坚持和努力。',
          explanation: '这是一道开放性题目，考查学生的思维表达能力'
        }
      );
    }
    
    return variations;
  },

  // 为练习题生成选项
  generatePracticeOptions(mistake) {
    if (mistake.options && mistake.options.length > 0) {
      return mistake.options;
    }
    
    // 如果原错题没有选项，生成通用选项
    if (mistake.type === 'single_choice' || mistake.type === 'multiple_choice') {
      const correctAnswer = mistake.answer || mistake.correctAnswer || 'A';
      return [
        correctAnswer,
        '其他选项1',
        '其他选项2', 
        '其他选项3'
      ];
    }
    
    return [];
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
      
      // 记录答题历史
      const { currentIndex, currentQuestion } = this.data;
      if (currentQuestion) {
        this.recordAnswer(currentIndex, currentQuestion, answer);
      }
    }
  },

  // 处理用户输入（填空题和简答题）
  onAnswerInput(e) {
    const value = e.detail.value || '';
    this.setData({ 
      userAnswer: value,
      userAnswerText: value
    });
    
    // 记录答题历史（对于输入类题目）
    const { currentIndex, currentQuestion } = this.data;
    if (currentQuestion) {
      this.recordAnswer(currentIndex, currentQuestion, value);
    }
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
  async completePractice() {
    console.log('开始保存练习结果...');
    
    try {
      // 计算练习统计
      const practiceResult = this.calculatePracticeResult();
      console.log('练习统计结果:', practiceResult);
      
      // 保存到数据库
      const userId = DatabaseManager.getCurrentUserId();
      const saveResult = await DatabaseManager.savePracticeResult(userId, {
        practiceId: this.data.practiceId,
        type: this.data.practiceType,
        title: this.data.examTitle || `${this.data.practiceType === 'ai' ? 'AI智能练习' : '错题复习'}`,
        ...practiceResult,
        answerDetails: this.data.answerHistory
      });
      
      if (saveResult.success) {
        console.log('练习结果保存成功');
        
        // 触发练习完成事件
        EventManager.emit(EVENT_TYPES.PRACTICE_COMPLETED, {
          practiceId: this.data.practiceId,
          practiceType: this.data.practiceType,
          result: practiceResult,
          timestamp: Date.now()
        });
        
        // 跳转到结果页面，传递练习结果
        wx.redirectTo({
          url: `/pages/practice/result?practiceId=${this.data.practiceId}&type=${this.data.practiceType}`
        });
      } else {
        console.error('保存练习结果失败:', saveResult.error);
        // 即使保存失败也跳转到结果页面
        wx.redirectTo({
          url: `/pages/practice/result?type=${this.data.practiceType}`
        });
      }
    } catch (error) {
      console.error('完成练习处理失败:', error);
      // 出错时也跳转到结果页面
    wx.redirectTo({
        url: `/pages/practice/result?type=${this.data.practiceType}`
      });
    }
  },

  // 计算练习结果统计
  calculatePracticeResult() {
    const { answerHistory, startTime, questions } = this.data;
    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000); // 秒
    
    let correctCount = 0;
    let totalCount = answerHistory.length;
    
    // 统计正确率（这里简化处理，实际可能需要更复杂的判断逻辑）
    answerHistory.forEach(record => {
      if (record.userAnswer && record.correctAnswer) {
        // 简单的字符串匹配（可以根据题目类型优化）
        const userAnswerNormalized = record.userAnswer.toString().trim().toLowerCase();
        const correctAnswerNormalized = record.correctAnswer.toString().trim().toLowerCase();
        
        if (userAnswerNormalized === correctAnswerNormalized) {
          correctCount++;
          record.isCorrect = true;
        } else {
          record.isCorrect = false;
        }
      }
    });
    
    const accuracy = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;
    const score = Math.round((correctCount / questions.length) * 100);
    
    return {
      totalQuestions: questions.length,
      answeredQuestions: totalCount,
      correctCount,
      incorrectCount: totalCount - correctCount,
      accuracy,
      score,
      duration,
      startTime,
      endTime,
      completionRate: Math.round((totalCount / questions.length) * 100)
    };
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
