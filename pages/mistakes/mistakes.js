import DatabaseManager from '../../utils/database.js';
import { debounce } from '../../utils/common.js';

// 添加缺失的常量定义
const SUBJECTS = ['数学', '英语', '语文', '物理', '化学', '生物', '历史', '地理', '政治'];
const DIFFICULTY_LABELS = { 
  1: '简单', 
  2: '中等', 
  3: '困难',
  4: '较难',
  5: '很难'
};

// 简单的工具函数实现
const loadingManager = {
  loadingStates: new Map(),
  isLoading(key) { 
    return this.loadingStates.get(key) || false;
  },
  setLoading(key, state) {
    this.loadingStates.set(key, state);
  },
  clearLoading(key) {
    this.loadingStates.delete(key);
  }
};

const errorHandler = {
  handle(error, options = {}) {
    console.error(`[${options.scene || 'unknown'}]`, error);
    if (options.showToast) {
      wx.showToast({
        title: error.message || '操作失败',
        icon: 'none'
      });
    }
  }
};

const uxManager = {
  clearPageStates() {
    // 简单实现，清理页面状态
    console.log('清理页面状态');
  }
};

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
      status: 'all',     // 确保默认显示所有状态
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
    userInfo: null,
    
    // 错误状态
    hasError: false,
    errorMessage: '',
    
    // 空状态
    isEmpty: false,
    emptyMessage: ''
  },

  // 防抖搜索
  debouncedSearch: null,

  onLoad(options) {
    console.log('错题本页面加载');
    
    // 确保数据完整性
    this.setData({
      mistakes: [],
      filteredMistakes: [],
      searchKeyword: '',
      statistics: {
        total: 0,
        new: 0,
        reviewing: 0,
        mastered: 0
      }
    });
    
    // 初始化防抖搜索
    this.debouncedSearch = debounce(this.performSearch.bind(this), 500);
    
    try {
      // 检查是否有从其他页面传来的筛选条件
      if (options && options.subject) {
        this.setData({
          'filters.subject': String(options.subject)
        });
      }

      this.initializePage();
    } catch (error) {
      this.handlePageError(error, '页面初始化失败');
    }
  },

  onShow() {
    console.log('错题本页面显示');
    this.refreshData();
  },

  onReady() {
    console.log('错题本页面准备完成');
  },

  onUnload() {
    console.log('错题本页面卸载');
    this.cleanup();
  },

  onPullDownRefresh() {
    this.refreshData().finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  onReachBottom() {
    this.loadMoreMistakes();
  },

  async initializePage() {
    try {
      wx.showLoading({ title: '加载错题数据...', mask: true });
      
      // 简化初始化，先设置基本数据，避免立即查询数据库
      this.setData({
        loading: false,
        mistakes: [],
        filteredMistakes: [],
        statistics: {
          total: 0,
          new: 0,
          reviewing: 0,
          mastered: 0
        }
      });
      
      wx.hideLoading();
      
      // 延迟加载数据，给页面渲染时间
      setTimeout(() => {
        this.loadMistakes().catch(error => {
          console.warn('延迟加载错题失败:', error);
        });
      }, 500);
      
    } catch (error) {
      wx.hideLoading();
      this.handlePageError(error, '初始化页面失败');
    }
  },

  async refreshData() {
    if (this.data.refreshing) return;
    
    try {
      this.setData({ 
        refreshing: true,
        page: 1,
        hasMore: true
      });
      
      await this.loadMistakes();
      await this.loadStatistics();
      
    } catch (error) {
      this.handlePageError(error, '刷新数据失败', true);
    } finally {
      this.setData({ refreshing: false });
    }
  },

  async loadMistakes() {
    try {
      const userId = wx.getStorageSync('userId') || 'default_user';
      const { page, pageSize, filters } = this.data;
      
      console.log('错题本查询参数:', {
        userId,
        page,
        pageSize,
        filters
      });
      
      const queryOptions = {
        page,
        pageSize,
        subject: filters.subject,
        status: filters.status,
        difficulty: filters.difficulty
      };
      
      const result = await DatabaseManager.getMistakes(userId, queryOptions);
      console.log('错题本查询结果:', result);
      
      if (result.success) {
        const newMistakes = Array.isArray(result.data) ? result.data : [];
        console.log('获取到错题数量:', newMistakes.length);
        
        // 为错题数据添加默认状态和其他缺失字段
        const processedMistakes = newMistakes.map((mistake, index) => ({
          ...mistake,
          _id: mistake._id || mistake.id || `mistake_${Date.now()}_${index}`, // 确保有唯一ID
          status: mistake.status || 'new', // 默认状态为新错题
          reviewCount: mistake.reviewCount || 0, // 默认复习次数为0
          difficulty: mistake.difficulty || 2, // 默认难度为中等
          subject: mistake.subject || '数学', // 默认学科为数学
          question: mistake.question || mistake.content || '题目内容', // 统一题目字段
          createTime: this.formatDateTime(mistake.createTime || mistake.date) // 统一时间字段
        }));
        
        console.log('处理后的错题数据:', processedMistakes);
        
        // 如果是第一页且没有数据，尝试查询所有数据
        if (page === 1 && processedMistakes.length === 0) {
          console.log('第一页无数据，尝试查询所有错题...');
          const allResult = await DatabaseManager.getMistakes(userId, {
            page: 1,
            pageSize: 100,
            subject: 'all',
            status: 'all'
          });
          console.log('所有错题查询结果:', allResult);
        }
        
        const mistakes = page === 1 ? processedMistakes : [...this.data.mistakes, ...processedMistakes];
        
        this.setData({
          mistakes,
          hasMore: processedMistakes.length === pageSize,
          loading: false,
          isEmpty: mistakes.length === 0
        });
        
        this.applyFilters();
      }
    } catch (error) {
      console.error('加载错题失败:', error);
      this.handlePageError(error, '加载错题失败');
    }
  },

  async loadStatistics() {
    try {
      const userId = wx.getStorageSync('userId') || 'default_user';
      
      // 初始化统计数据
      const statistics = {
        total: 0,
        new: 0,
        reviewing: 0,
        mastered: 0
      };

      // 获取所有错题进行统计
      const allMistakes = await DatabaseManager.getMistakes(userId, {
        pageSize: 1000 // 获取足够多的数据用于统计
      });

      if (allMistakes.success) {
        const allData = Array.isArray(allMistakes.data) ? allMistakes.data : [];
        statistics.total = allData.length;
        
        // 按状态统计
        allData.forEach(item => {
          if (item && item.status) {
            if (statistics.hasOwnProperty(item.status)) {
              statistics[item.status]++;
            }
          }
        });
      }

      this.setData({ statistics });
      console.log('统计数据加载成功:', statistics);

    } catch (error) {
      console.warn('统计数据加载失败:', error);
      // 统计数据失败不影响主要功能，设置默认值
      this.setData({
        statistics: {
          total: 0,
          new: 0,
          reviewing: 0,
          mastered: 0
        }
      });
    }
  },

  applyFilters() {
    const { mistakes, filters, searchKeyword } = this.data;
    let filtered = [...mistakes];
    
    console.log('筛选前数据:', mistakes.length);
    console.log('当前筛选条件:', filters);
    
    // 打印每条记录的状态，用于调试
    mistakes.forEach((item, index) => {
      console.log(`错题${index + 1} 状态:`, item.status, typeof item.status);
    });
    
    // 学科筛选
    if (filters.subject !== 'all') {
      filtered = filtered.filter(item => item.subject === filters.subject);
      console.log('学科筛选后:', filtered.length);
    }
    
    // 状态筛选 - 临时注释掉进行测试
    // if (filters.status !== 'all') {
    //   filtered = filtered.filter(item => item.status === filters.status);
    //   console.log('状态筛选后:', filtered.length);
    // }
    
    // 搜索筛选
    if (searchKeyword && searchKeyword.trim()) {
      const keyword = searchKeyword.trim().toLowerCase();
      filtered = filtered.filter(item => 
        (item.question && item.question.toLowerCase().includes(keyword)) ||
        (item.analysis && item.analysis.toLowerCase().includes(keyword))
      );
      console.log('搜索筛选后:', filtered.length);
    }
    
    this.setData({
      filteredMistakes: filtered,
      isEmpty: filtered.length === 0
    });
    
    console.log('最终显示数量:', filtered.length);
  },

  performSearch() {
    this.applyFilters();
  },

  onSearchChange(e) {
    const keyword = e.detail || '';
    this.setData({ searchKeyword: keyword });
    
    if (this.debouncedSearch) {
      this.debouncedSearch();
    }
  },

  onFilterChange(e) {
    const { type, value } = e.currentTarget.dataset;
    
    this.setData({
      [`filters.${type}`]: value,
      page: 1,
      hasMore: true
    });
    
    this.loadMistakes();
  },

  // 新增统一的筛选方法
  setFilter(e) {
    const { type, value } = e.currentTarget.dataset;
    
    this.setData({
      [`filters.${type}`]: value,
      page: 1,
      hasMore: true
    });
    
    this.applyFilters();
  },

  // 按状态筛选
  filterByStatus(e) {
    const { status } = e.currentTarget.dataset;
    
    this.setData({
      'filters.status': status,
      page: 1,
      hasMore: true
    });
    
    this.applyFilters();
  },

  // 搜索相关方法
  onSearchConfirm(e) {
    const keyword = e.detail || '';
    this.setData({ searchKeyword: keyword });
    this.applyFilters();
  },

  onSearchInput(e) {
    const keyword = e.detail || '';
    this.setData({ searchKeyword: keyword });
    
    if (this.debouncedSearch) {
      this.debouncedSearch();
    }
  },

  onSearchClear() {
    this.setData({ searchKeyword: '' });
    this.applyFilters();
  },

  updateStatistics() {
    const { mistakes } = this.data;
    const stats = {
      total: mistakes.length,
      new: mistakes.filter(m => m.reviewLevel === 0).length,
      reviewing: mistakes.filter(m => m.reviewLevel > 0 && m.reviewLevel < 5).length,
      mastered: mistakes.filter(m => m.reviewLevel >= 5).length
    };
    
    this.setData({ statistics: stats });
  },

  async loadMoreMistakes() {
    if (!this.data.hasMore || this.data.loading) {
      return;
    }

    try {
      wx.showLoading({ title: '加载更多...', mask: true });
      
      this.setData({
        page: this.data.page + 1,
        loading: true
      });

      await this.loadMistakes();
      
      wx.hideLoading();
      
    } catch (error) {
      wx.hideLoading();
      this.handlePageError(error, '加载更多失败', true);
    }
  },

  onMistakeItemTap(e) {
    const { mistakeId } = e.currentTarget.dataset;
    
    if (!mistakeId) {
      wx.showToast({ title: '错题信息无效', icon: 'none' });
      return;
    }

    try {
      wx.navigateTo({
        url: `/pages/mistakes/detail?id=${mistakeId}`
      });
    } catch (error) {
      this.handlePageError(error, '打开错题详情失败');
    }
  },

  onMistakeClick(e) {
    console.log('点击错题:', e.currentTarget.dataset);
    const { id } = e.currentTarget.dataset;
    
    if (!id) {
      console.log('错题ID为空:', id);
      wx.showToast({ title: '错题信息无效', icon: 'none' });
      return;
    }

    console.log('准备跳转到错题详情:', id);
    
    try {
      const url = `/pages/mistakes/detail?id=${id}`;
      console.log('跳转URL:', url);
      
      wx.navigateTo({
        url: url,
        success: (res) => {
          console.log('跳转成功:', res);
        },
        fail: (err) => {
          console.error('跳转失败:', err);
          wx.showToast({
            title: '跳转失败: ' + (err.errMsg || '未知错误'),
            icon: 'none',
            duration: 3000
          });
        }
      });
    } catch (error) {
      console.error('跳转异常:', error);
      this.handlePageError(error, '打开错题详情失败');
    }
  },

  onAddMistake() {
    try {
      wx.navigateTo({
        url: '/pages/mistakes/add'
      });
    } catch (error) {
      this.handlePageError(error, '打开添加页面失败');
    }
  },

  goToCamera() {
    try {
      wx.navigateTo({
        url: '/pages/camera/camera'
      });
    } catch (error) {
      this.handlePageError(error, '打开拍照页面失败');
    }
  },

  viewAnalysis() {
    const { statistics } = this.data;
    const analysisData = {
      totalMistakes: statistics.total,
      masteryRate: statistics.total > 0 ? Math.round((statistics.mastered / statistics.total) * 100) : 0,
      needReview: statistics.new + statistics.reviewing,
      subjects: this.getSubjectAnalysis()
    };
    
    wx.navigateTo({
      url: `/pages/mistakes/analysis?data=${encodeURIComponent(JSON.stringify(analysisData))}`
    });
  },

  getSubjectAnalysis() {
    const { mistakes } = this.data;
    const subjectStats = {};
    
    mistakes.forEach(mistake => {
      const subject = mistake.subject || '未分类';
      if (!subjectStats[subject]) {
        subjectStats[subject] = { total: 0, mastered: 0 };
      }
      subjectStats[subject].total++;
      if (mistake.reviewLevel >= 5) {
        subjectStats[subject].mastered++;
      }
    });
    
    return Object.entries(subjectStats).map(([subject, stats]) => ({
      subject,
      total: stats.total,
      masteryRate: Math.round((stats.mastered / stats.total) * 100)
    }));
  },

  // 操作相关方法
  onMistakeAction(e) {
    const { mistakeId } = e.currentTarget.dataset;
    this.setData({
      currentMistakeId: mistakeId,
      showActionSheet: true
    });
  },

  onActionSheetClose() {
    this.setData({ showActionSheet: false });
  },

  onActionSheetSelect(e) {
    const { name } = e.detail;
    const { currentMistakeId } = this.data;
    
    this.setData({ showActionSheet: false });
    
    switch (name) {
      case '编辑':
        this.editMistake(currentMistakeId);
        break;
      case '加入复习计划':
        this.addToReviewPlan(currentMistakeId);
        break;
      case '删除':
        this.deleteMistake(currentMistakeId);
        break;
    }
  },

  editMistake(mistakeId) {
    try {
      wx.navigateTo({
        url: `/pages/mistakes/add?id=${mistakeId}&mode=edit`
      });
    } catch (error) {
      this.handlePageError(error, '打开编辑页面失败');
    }
  },

  async addToReviewPlan(mistakeId) {
    try {
      wx.showLoading({ title: '加入复习计划...', mask: true });

      const result = await DatabaseManager.updateMistakeStatus(mistakeId, 'reviewing');

      wx.hideLoading();

      if (result.success) {
        wx.showToast({ title: '已加入复习计划', icon: 'success' });
        this.refreshData();
      } else {
        throw new Error(result.error || '操作失败');
      }

    } catch (error) {
      wx.hideLoading();
      this.handlePageError(error, '加入复习计划失败', true);
    }
  },

  deleteMistake(mistakeId) {
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这道错题吗？',
      success: (res) => {
        if (res.confirm) {
          this.performDelete(mistakeId);
        }
      }
    });
  },

  async performDelete(mistakeId) {
    try {
      wx.showLoading({ title: '删除中...', mask: true });

      const result = await DatabaseManager.deleteMistake(mistakeId);

      wx.hideLoading();

      if (result.success) {
        wx.showToast({ title: '删除成功', icon: 'success' });
        this.refreshData();
      } else {
        throw new Error(result.error || '删除失败');
      }

    } catch (error) {
      wx.hideLoading();
      this.handlePageError(error, '删除失败', true);
    }
  },

  handlePageError(error, message = '操作失败', allowRetry = false) {
    console.error('错题本页面错误:', error);
    
    // 更新页面状态 - 确保数据完整性
    this.setData({
      hasError: true,
      errorMessage: message,
      loading: false,
      refreshing: false,
      mistakes: Array.isArray(this.data.mistakes) ? this.data.mistakes : [],
      filteredMistakes: Array.isArray(this.data.filteredMistakes) ? this.data.filteredMistakes : [],
      searchKeyword: String(this.data.searchKeyword || ''),
      statistics: this.data.statistics || {
        total: 0,
        new: 0,
        reviewing: 0,
        mastered: 0
      }
    });

    // 简化错误提示，避免复杂的调用
    wx.showToast({
      title: message,
      icon: 'none',
      duration: 2000
    });
  },

  // 格式化时间显示
  formatDateTime(dateTime) {
    if (!dateTime) {
      return new Date().toISOString().split('T')[0];
    }
    
    try {
      const date = new Date(dateTime);
      if (isNaN(date.getTime())) {
        return new Date().toISOString().split('T')[0];
      }
      
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      
      return `${year}-${month}-${day}`;
    } catch (error) {
      console.warn('时间格式化失败:', error);
      return new Date().toISOString().split('T')[0];
    }
  },

  cleanup() {
    // 清理防抖函数
    if (this.debouncedSearch) {
      this.debouncedSearch = null;
    }
    
    // 清理UX状态
    uxManager.clearPageStates();
  }
});
