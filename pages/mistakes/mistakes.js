import DatabaseManager from '../../utils/database';
import { SUBJECTS, DIFFICULTY_LEVELS } from '../../utils/constants';

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
      subject: '全部',
      status: '全部',
      difficulty: '全部'
    },
    
    // 筛选选项
    subjects: ['全部', ...SUBJECTS],
    statuses: [
      { label: '全部', value: '全部' },
      { label: '新错题', value: 'new' },
      { label: '复习中', value: 'reviewing' },
      { label: '已掌握', value: 'mastered' }
    ],
    difficulties: [
      { label: '全部', value: '全部' },
      ...DIFFICULTY_LEVELS
    ],
    
    // 界面控制
    showFilterDropdown: false,
    filterActiveIndex: 0,
    searchKeyword: '',
    showSearch: false,
    
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

  onLoad() {
    console.log('错题本页面加载');
    this.getUserInfo();
    this.loadMistakes();
    this.loadStatistics();
  },

  onShow() {
    // 每次显示时刷新数据
    this.refreshData();
  },

  onPullDownRefresh() {
    this.refreshData();
  },

  onReachBottom() {
    this.loadMoreMistakes();
  },

  // 获取用户信息
  getUserInfo() {
    const app = getApp();
    const userInfo = app.getUserInfo();
    
    if (userInfo) {
      this.setData({ userInfo });
    } else {
      // 未登录，跳转到登录页
      wx.redirectTo({
        url: '/pages/login/login'
      });
    }
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

  // 加载错题列表
  async loadMistakes(reset = false) {
    if (!this.data.userInfo) return;

    try {
      if (reset) {
        this.setData({ 
          loading: true,
          mistakes: [],
          page: 1 
        });
      }

      const { page, pageSize, userInfo } = this.data;
      
      const result = await DatabaseManager.getMistakes({
        userId: userInfo._id,
        page: page,
        pageSize: pageSize,
        filters: this.buildFilters()
      });

      if (result.success) {
        const newMistakes = reset ? result.data : [...this.data.mistakes, ...result.data];
        
        this.setData({
          mistakes: newMistakes,
          filteredMistakes: newMistakes,
          hasMore: result.data.length === pageSize,
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
    if (!this.data.userInfo) return;

    try {
      const result = await DatabaseManager.getMistakeStatistics(this.data.userInfo._id);
      
      if (result.success) {
        this.setData({
          statistics: result.data
        });
      }
    } catch (error) {
      console.error('加载统计数据失败:', error);
    }
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
      content: `确定要删除这道错题吗？\n"${question.slice(0, 20)}..."`,
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
      wx.showLoading({
        title: '删除中...',
        mask: true
      });

      const result = await DatabaseManager.deleteMistake(id);
      
      wx.hideLoading();

      if (result.success) {
        wx.showToast({
          title: '删除成功！',
          icon: 'success'
        });

        // 更新本地数据
        const mistakes = this.data.mistakes.filter(mistake => mistake._id !== id);
        this.setData({ 
          mistakes,
          filteredMistakes: mistakes 
        });

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
      wx.showToast({
        title: '暂无错题可练习',
        icon: 'none'
      });
      return;
    }

    wx.navigateTo({
      url: '/pages/practice/practice'
    });
  },

  // 拍照添加
  goToCamera() {
    wx.navigateTo({
      url: '/pages/camera/camera'
    });
  },

  // 手动添加
  goToAddManual() {
    wx.navigateTo({
      url: '/pages/mistakes/add'
    });
  },

  // 工具方法
  getStatusText(status) {
    const statusMap = {
      'new': '新错题',
      'reviewing': '复习中',
      'mastered': '已掌握'
    };
    return statusMap[status] || status;
  },

  getStatusColor(status) {
    const colorMap = {
      'new': '#EF4444',
      'reviewing': '#F59E0B',
      'mastered': '#10B981'
    };
    return colorMap[status] || '#6B7280';
  },

  getDifficultyText(difficulty) {
    const item = DIFFICULTY_LEVELS.find(d => d.value === difficulty);
    return item ? item.label : '未知';
  },

  formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return '今天';
    } else if (days === 1) {
      return '昨天';
    } else if (days < 7) {
      return `${days}天前`;
    } else {
      return date.toLocaleDateString();
    }
  },

  // 错误处理
  showError(message) {
    wx.showModal({
      title: '提示',
      content: message,
      showCancel: false,
      confirmText: '知道了'
    });
  }
}); 