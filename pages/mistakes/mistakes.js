import DatabaseManager from '../../utils/database';
import LocalDB from '../../utils/local-db';
import { SUBJECTS, DIFFICULTY_LABELS } from '../../utils/constants';
import { store } from '../../store/index';

Page({
  data: {
    // 错题列表
    mistakes: [],
    filteredMistakes: [],
    loading: true,
    refreshing: false,
    hasMore: true,
    page: 1,
    pageSize: 20,
    
    // 筛选条件
    filters: {
      subject: 'all',
      status: 'all',
      difficulty: 'all'
    },
    
    // 界面控制
    showFilterTags: true,
    showActionSheet: false,
    currentMistakeId: '',
    searchKeyword: '',
    
    // 操作弹窗选项
    actionSheetActions: [
      { name: '编辑', color: '#1890ff' },
      { name: '加入复习计划', color: '#52c41a' },
      { name: '删除', color: '#f5222d' }
    ],
    
    // 筛选选项
    subjects: ['全部', ...SUBJECTS],
    statuses: [
      { label: '全部', value: 'all' },
      { label: '新错题', value: 'new' },
      { label: '复习中', value: 'reviewing' },
      { label: '已掌握', value: 'mastered' }
    ],
    difficulties: [
      { label: '全部', value: 'all' },
      ...Object.entries(DIFFICULTY_LABELS).map(([value, label]) => ({ label, value: parseInt(value) }))
    ],
    
    // 统计数据
    statistics: {
      total: 0,
      new: 0,
      reviewing: 0,
      mastered: 0
    },
    
    // 用户信息
    userInfo: null
  },

  onLoad(options) {
    console.log('错题本页面加载');
    
    // 检查是否有从其他页面传来的筛选条件
    if (options && options.subject) {
      this.setData({
        'filters.subject': options.subject
      });
    }

    this.loadMistakes();
    this.loadStatistics();
  },

  onShow() {
    // 每次显示时，根据登录和游客状态决定行为
    // 直接从 store 读取状态
    const isLoggedIn = store.isLoggedIn || false;
    const isGuestMode = store.isGuestMode || false;
    
    if (!isLoggedIn && !isGuestMode) {
      // 既没登录，也没进入游客模式，才跳转到登录页
      wx.redirectTo({
        url: '/pages/login/login'
      });
      return; // 立即停止后续操作
    }

    // 刷新数据
    this.refreshData();
  },

  onUnload() {
    // 清理绑定
  },

  // 刷新数据
  async refreshData() {
    this.setData({
      refreshing: true,
      page: 1,
      hasMore: true
    });
    
    await Promise.all([
      this.loadMistakes(true),
      this.loadStatistics()
    ]);
    
    this.setData({ refreshing: false });
    wx.stopPullDownRefresh();
  },

  onPullDownRefresh() {
    this.refreshData();
  },

  onReachBottom() {
    this.loadMoreMistakes();
  },

  // 加载错题列表
  async loadMistakes(reset = false) {
    // 直接从 store 读取状态
    const isLoggedIn = store.isLoggedIn || false;
    const isGuestMode = store.isGuestMode || false;

    // 游客模式：使用本地示例数据
    if (isGuestMode) {
      if (reset) {
        this.setData({ loading: true });
      }

      const sampleMistakes = [
        {
          _id: 'guest1',
          subject: '数学',
          status: 'new',
          difficulty: 1,
          question: '计算：25 × 4 = ?',
          answer: '100',
          createTime: new Date(Date.now() - 86400000),
          reviewCount: 2
        },
        {
          _id: 'guest2',
          subject: '语文',
          status: 'reviewing',
          difficulty: 2,
          question: '下列词语中，字音完全正确的一组是?',
          answer: '请查看答案解析',
          createTime: new Date(Date.now() - 2 * 86400000),
          reviewCount: 1
        },
        {
          _id: 'guest3',
          subject: '英语',
          status: 'new',
          difficulty: 2,
          question: 'Choose the correct answer: I ___ to school yesterday.',
          answer: 'went',
          createTime: new Date(Date.now() - 3 * 86400000),
          reviewCount: 0
        }
      ];

      const transformed = this.transformMistakes(reset ? sampleMistakes : [...this.data.mistakes, ...sampleMistakes]);

      this.setData({
        mistakes: transformed,
        filteredMistakes: transformed,
        hasMore: false,
        loading: false
      });

      // 更新统计
      this.loadStatistics();
      return;
    }
    
    // 如果未登录则改为本地存储读取
    if (!isLoggedIn) {
      // 使用本地持久化
      const all = LocalDB.getMistakes();
      const transformed = this.transformMistakes(all);
      this.setData({
        mistakes: transformed,
        filteredMistakes: transformed,
        loading: false,
        hasMore: false,
      });
      this.loadStatistics();
      return;
    }

    try {
      if (reset) {
        this.setData({ 
          loading: true,
          mistakes: [],
          page: 1 
        });
      }

      const { page, pageSize, userInfo } = this.data;
      
      // 将当前筛选条件转换为DatabaseManager需要的参数
      const filterOptions = this.buildFilters();

      const result = await DatabaseManager.getMistakes(userInfo._id, {
        page,
        pageSize,
        subject: filterOptions.subject || '',
        status: filterOptions.status || '',
        // 其他可选参数如difficulty等可在后端自行处理
      });

      if (result && result.success) {
        const list = Array.isArray(result.data) ? result.data : [];
        const transformed = this.transformMistakes(reset ? list : [...this.data.mistakes, ...list]);
        
        this.setData({
          mistakes: transformed,
          filteredMistakes: transformed,
          hasMore: list.length === pageSize,
          loading: false
        });
      } else {
        throw new Error('加载失败');
      }

    } catch (error) {
      console.error('加载错题失败:', error);
      this.setData({ loading: false });
      this.showError('加载失败，请重试');
    }
  },

  // 加载更多错题
  async loadMoreMistakes() {
    if (!this.data.hasMore || this.data.loading) return;

    this.setData({
      page: this.data.page + 1
    });
    
    await this.loadMistakes();
  },

  // 加载统计数据
  async loadStatistics() {
    // 直接根据已加载的错题列表计算统计数据，避免后端依赖
    const { mistakes } = this.data;
    const stats = {
      total: mistakes.length,
      new: mistakes.filter(m => m.status === 'new').length,
      reviewing: mistakes.filter(m => m.status === 'reviewing').length,
      mastered: mistakes.filter(m => m.status === 'mastered').length
    };

    this.setData({ statistics: stats });
  },

  // 构建筛选条件
  buildFilters() {
    const { filters, searchKeyword } = this.data;
    const conditions = {};

    if (filters.subject !== '全部') {
      conditions.subject = filters.subject;
    }

    if (filters.status !== '全部') {
      conditions.status = filters.status;
    }

    if (filters.difficulty !== '全部') {
      conditions.difficulty = parseInt(filters.difficulty);
    }

    if (searchKeyword.trim()) {
      conditions.keyword = searchKeyword.trim();
    }

    return conditions;
  },

  // 应用筛选
  applyFilters() {
    this.setData({
      showFilterDropdown: false
    });
    this.refreshData();
  },

  // 筛选器相关方法
  onFilterMenuClick(e) {
    const index = e.detail.value;
    this.setData({
      filterActiveIndex: index,
      showFilterDropdown: true
    });
  },

  onFilterMenuClose() {
    this.setData({
      showFilterDropdown: false
    });
  },

  // 学科筛选
  onSubjectFilterChange(e) {
    const index = e.detail.value;
    this.setData({
      'filters.subject': this.data.subjects[index]
    });
    this.applyFilters();
  },

  // 状态筛选
  onStatusFilterChange(e) {
    const index = e.detail.value;
    this.setData({
      'filters.status': this.data.statuses[index].value
    });
    this.applyFilters();
  },

  // 难度筛选
  onDifficultyFilterChange(e) {
    const index = e.detail.value;
    this.setData({
      'filters.difficulty': this.data.difficulties[index].value
    });
    this.applyFilters();
  },

  // 搜索相关方法
  toggleSearch() {
    this.setData({
      showSearch: !this.data.showSearch,
      searchKeyword: ''
    });
    
    if (!this.data.showSearch) {
      this.applyFilters();
    }
  },

  onSearchInput(e) {
    this.setData({
      searchKeyword: e.detail.value
    });
  },

  onSearchConfirm() {
    this.applyFilters();
  },

  onSearchClear() {
    this.setData({
      searchKeyword: ''
    });
    this.applyFilters();
  },

  // 错题操作
  onMistakeClick(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/mistakes/detail?id=${id}`
    });
  },

  // 标记为已掌握
  async markAsMastered(e) {
    const { id } = e.currentTarget.dataset;
    
    try {
      wx.showLoading({
        title: '更新中...',
        mask: true
      });

      const result = await DatabaseManager.updateMistakeStatus(id, 'mastered');
      
      wx.hideLoading();

      if (result.success) {
        wx.showToast({
          title: '已标记为掌握！',
          icon: 'success'
        });

        // 更新本地数据
        const mistakes = this.data.mistakes.map(mistake => {
          if (mistake._id === id) {
            return { ...mistake, status: 'mastered', masteredTime: new Date() };
          }
          return mistake;
        });

        this.setData({ 
          mistakes,
          filteredMistakes: mistakes 
        });

        this.loadStatistics();
      } else {
        throw new Error('更新失败');
      }

    } catch (error) {
      wx.hideLoading();
      console.error('标记掌握失败:', error);
      this.showError('操作失败，请重试');
    }
  },

  // 删除错题
  onDeleteMistake(e) {
    const { id, question } = e.currentTarget.dataset;
    
    wx.showModal({
      title: '确认删除',
      content: `确定要删除这道错题吗？`,
      showCancel: true,
      cancelText: '取消',
      confirmText: '删除',
      confirmColor: '#EF4444',
      success: async (res) => {
        if (res.confirm) {
          await this.deleteMistake(id);
        }
      }
    });
  },

  async deleteMistake(id) {
    try {
      wx.showLoading({ title: '删除中...', mask: true });
      const result = await DatabaseManager.deleteMistake(id);
      wx.hideLoading();

      if (result.success) {
        wx.showToast({ title: '删除成功！', icon: 'success' });
        // 更新本地数据
        const mistakes = this.data.mistakes.filter(item => item._id !== id);
        this.setData({ mistakes, filteredMistakes: mistakes });
        this.loadStatistics();
      } else {
        throw new Error('删除失败');
      }
    } catch (error) {
      wx.hideLoading();
      console.error('删除错题失败:', error);
      this.showError('删除失败，请重试');
    }
  },

  // 开始练习
  startPractice() {
    if (this.data.statistics.total === 0) {
      wx.showToast({ title: '暂无错题可练习', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: '/pages/practice/practice' });
  },

  // 跳转拍照录题
  goToCamera() {
    wx.navigateTo({ url: '/pages/camera/camera' });
  },

  // 跳转手动录入
  goToAddManual() {
    wx.navigateTo({ url: '/pages/mistakes/add' });
  },

  // 状态、难度、时间格式化工具
  getSubjectColor(subject) {
    const colors = ['#4A90E2', '#F8D568', '#50E3C2', '#F76D6D', '#B497E0', '#FF8C69'];
    let hash = 0;
    for (let i = 0; i < subject.length; i++) {
      hash = subject.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash % colors.length);
    return colors[index];
  },

  getStatusText(status) {
    const map = { new: '新错题', reviewing: '复习中', mastered: '已掌握' };
    return map[status] || status;
  },

  getStatusColor(status) {
    const map = { new: '#F76D6D', reviewing: '#F8D568', mastered: '#50E3C2' };
    return map[status] || '#888888';
  },

  getDifficultyText(difficulty) {
    const item = this.data.difficulties.find(d => d.value === difficulty);
    return item ? item.label : '未知';
  },

  formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  },

  // 通用错误提示
  showError(message) {
    wx.showModal({ title: '提示', content: message, showCancel: false });
  },

  // 转换错题数据，添加显示所需的格式化字段
  transformMistakes(list) {
    return list.map(item => ({
      ...item,
      subjectColor: this.getSubjectColor(item.subject),
      subjectInitial: item.subject.charAt(0),
      statusText: this.getStatusText(item.status),
      difficultyText: this.getDifficultyText(item.difficulty),
      createTimeFormatted: this.formatDate(item.createTime),
      questionTitle: this.getQuestionTitle(item.question)
    }));
  },

  // 获取题目标题（截取前30个字符）
  getQuestionTitle(question) {
    if (!question) return '';
    return question.length > 30 ? question.substring(0, 30) + '...' : question;
  },

  // 筛选相关方法
  toggleFilter() {
    this.setData({
      showFilterTags: !this.data.showFilterTags
    });
  },

  // 设置筛选条件
  setFilter(e) {
    const { type, value } = e.currentTarget.dataset;
    
    this.setData({
      [`filters.${type}`]: value
    });
    
    this.applyFilters();
  },

  // 根据状态筛选
  filterByStatus(e) {
    const status = e.currentTarget.dataset.status;
    
    this.setData({
      'filters.status': status,
      'filters.subject': 'all'
    });
    
    this.applyFilters();
  },

  // 获取科目数量
  getSubjectCount(subject) {
    if (subject === 'all' || subject === '全部') {
      return this.data.mistakes.length;
    }
    return this.data.mistakes.filter(item => item.subject === subject).length;
  },

  // 查看详细分析
  viewAnalysis() {
    wx.navigateTo({
      url: '/pages/report/report'
    });
  },

  // 显示错题操作菜单
  showMistakeActions(e) {
    const { id } = e.currentTarget.dataset;
    
    this.setData({
      currentMistakeId: id,
      showActionSheet: true
    });
  },

  // 操作选择
  onActionSelect(e) {
    const { name } = e.detail;
    const { currentMistakeId } = this.data;
    
    switch (name) {
      case '编辑':
        this.editMistake(currentMistakeId);
        break;
      case '加入复习计划':
        this.addToReviewPlan(currentMistakeId);
        break;
      case '删除':
        this.confirmDeleteMistake(currentMistakeId);
        break;
    }
    
    this.setData({ showActionSheet: false });
  },

  // 关闭操作弹窗
  onActionSheetClose() {
    this.setData({ showActionSheet: false });
  },

  // 编辑错题
  editMistake(id) {
    wx.navigateTo({
      url: `/pages/mistakes/add?id=${id}`
    });
  },

  // 加入复习计划
  addToReviewPlan(id) {
    const mistake = this.data.mistakes.find(item => item._id === id);
    if (!mistake) {
      wx.showToast({
        title: '错题不存在',
        icon: 'error'
      });
      return;
    }

    // 检查错题状态
    if (mistake.status === 'mastered') {
      wx.showModal({
        title: '已掌握题目',
        content: '该错题已标记为已掌握，是否要重新加入复习计划？',
        success: (res) => {
          if (res.confirm) {
            this.showReviewPlanOptions(mistake);
          }
        }
      });
      return;
    }

    // 检查是否已经在复习计划中
    const now = new Date();
    const nextReviewTime = mistake.nextReviewTime ? new Date(mistake.nextReviewTime) : null;
    
    if (nextReviewTime && nextReviewTime > now) {
      const timeText = this.formatDate(mistake.nextReviewTime);
      wx.showModal({
        title: '已在复习计划中',
        content: `该错题已安排在 ${timeText} 复习，是否要重新安排复习时间？`,
        success: (res) => {
          if (res.confirm) {
            this.showReviewPlanOptions(mistake);
          }
        }
      });
    } else {
      this.showReviewPlanOptions(mistake);
    }
  },

  // 显示复习计划选项
  showReviewPlanOptions(mistake) {
    wx.showActionSheet({
      itemList: [
        '立即加入今日复习',
        '3天后复习',
        '1周后复习',
        '2周后复习',
        '1个月后复习'
      ],
      success: (res) => {
        this.setReviewTime(mistake, res.tapIndex);
      },
      fail: () => {
        console.log('用户取消选择');
      }
    });
  },

  // 设置复习时间
  setReviewTime(mistake, planIndex) {
    const reviewTimes = [
      0,           // 立即复习
      3,           // 3天后
      7,           // 1周后  
      14,          // 2周后
      30           // 1个月后
    ];
    
    const days = reviewTimes[planIndex];
    const reviewTime = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    
    wx.showLoading({ title: '加入复习计划...' });
    
    // TODO: 调用真实API更新复习时间
    setTimeout(() => {
      wx.hideLoading();
      
      // 更新本地数据
      const mistakes = this.data.mistakes.map(item => {
        if (item._id === mistake._id) {
          return {
            ...item,
            nextReviewTime: this.formatDate(reviewTime),
            status: days === 0 ? 'reviewing' : item.status,
            lastReviewTime: days === 0 ? this.formatDate(new Date()) : item.lastReviewTime
          };
        }
        return item;
      });
      
      this.setData({
        mistakes,
        filteredMistakes: mistakes
      });
      
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
    }, 500);
  },



  // 确认删除错题
  confirmDeleteMistake(id) {
    const mistake = this.data.mistakes.find(item => item._id === id);
    if (!mistake) return;

    wx.showModal({
      title: '确认删除',
      content: `确定要删除这道${mistake.subject}错题吗？`,
      showCancel: true,
      cancelText: '取消',
      confirmText: '删除',
      confirmColor: '#f5222d',
      success: (res) => {
        if (res.confirm) {
          this.deleteMistake(id);
        }
      }
    });
  }
});