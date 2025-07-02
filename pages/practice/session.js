import Dialog from '@vant/weapp/dialog/dialog';
import LocalDB from '../../utils/local-db';
import DatabaseManager from '../../utils/database';

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
      'fill_in_blank': '填空题'
    }
  },

  onLoad(options) {
    this.setData({ practiceOptions: options });
    this.fetchQuestions();
  },

  fetchQuestions() {
    this.setData({ isLoading: true });
    // 模拟网络请求和AI生成题目
    setTimeout(() => {
      const mockQuestions = this.generateMockQuestions(this.data.practiceOptions);
      this.setData({
        questions: mockQuestions,
        isLoading: false,
      });
      this.updateCurrentQuestion();
    }, 1500); // 模拟1.5秒加载
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
      this.setData({
        currentQuestion: current,
        progress: ((currentQuestionIndex + 1) / questions.length) * 100,
        isLastQuestion: currentQuestionIndex === questions.length - 1,
      });
    }
  },

  onAnswerChange(e) {
    const { id } = this.data.currentQuestion;
    this.setData({
      [`userAnswers.${id}`]: e.detail
    });
  },

  prevQuestion() {
    if (this.data.currentQuestionIndex > 0) {
      this.setData({
        currentQuestionIndex: this.data.currentQuestionIndex - 1
      });
      this.updateCurrentQuestion();
    }
  },

  nextQuestion() {
    if (this.data.isLastQuestion) {
      this.submitPractice();
    } else {
      this.setData({
        currentQuestionIndex: this.data.currentQuestionIndex + 1
      });
      this.updateCurrentQuestion();
    }
  },

  async submitPractice() {
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
        subject: this.data.practiceOptions.subject,
        difficulty: this.data.practiceOptions.difficulty,
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

    wx.showLoading({ title: '正在提交...' });
    setTimeout(() => {
      wx.hideLoading();
      wx.redirectTo({
        url: `/pages/practice/result?localId=${record.id}`
      });
    }, 500);
  },

  showExitConfirm() {
    Dialog.confirm({
      title: '确认退出',
      message: '退出后将不会保存本次练习记录，确定要退出吗？',
    }).then(() => {
      wx.navigateBack();
    }).catch(() => {
      // on cancel
    });
  },

  // --- Mock数据生成 ---
  generateMockQuestions(options) {
    const { subject = 'math', count = 5 } = options;
    let mockData = [];
    
    const mathQuestions = [
      { id: 'm1', type: 'single_choice', title: '计算：15 + 27 = ?', stem: '请选择正确的答案。', options: [{label: '32', value: 'A'}, {label: '42', value: 'B'}, {label: '45', value: 'C'}], correct: 'B'},
      { id: 'm2', type: 'single_choice', title: '一个正方形有几条边？', stem: '', options: [{label: '3', value: 'A'}, {label: '4', value: 'B'}, {label: '5', value: 'C'}], correct: 'B'},
      { id: 'm3', type: 'multiple_choice', title: '以下哪些是偶数？', stem: '请选择所有符合条件的答案。', options: [{label: '2', value: 'A'}, {label: '7', value: 'B'}, {label: '10', value: 'C'}, {label: '13', value: 'D'}], correct: ['A','C']},
      { id: 'm4', type: 'single_choice', title: '9 x 8 = ?', stem: '', options: [{label: '64', value: 'A'}, {label: '72', value: 'B'}, {label: '81', value: 'C'}], correct: 'B'},
      { id: 'm5', type: 'single_choice', title: '100 - 55 = ?', stem: '', options: [{label: '45', value: 'A'}, {label: '35', value: 'B'}, {label: '55', value: 'C'}], correct: 'A'},
    ];
    // TODO: 添加更多其他学科的模拟数据...

    switch(subject) {
      case 'math': mockData = mathQuestions; break;
      // case 'chinese': mockData = chineseQuestions; break;
      // case 'english': mock-data = englishQuestions; break;
      default: mockData = mathQuestions;
    }

    return mockData.slice(0, parseInt(count, 10));
  },

  onSingleSelect(e) {
    const { value } = e.currentTarget.dataset;
    const { id } = this.data.currentQuestion;
    this.setData({ [`userAnswers.${id}`]: value }, ()=>{
      this.updateCurrentQuestion();
    });
  },

  onMultiSelect(e) {
    const { value } = e.currentTarget.dataset;
    const { id } = this.data.currentQuestion;
    const arr = this.data.userAnswers[id] ? [...this.data.userAnswers[id]] : [];
    const idx = arr.indexOf(value);
    if (idx > -1) arr.splice(idx,1); else arr.push(value);
    this.setData({ [`userAnswers.${id}`]: arr }, ()=>{
      this.updateCurrentQuestion();
    });
  }
}); 