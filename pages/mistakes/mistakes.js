import DatabaseManager from '../../utils/database.js';
import { debounce } from '../../utils/common.js';
import EventManager, { EVENT_TYPES } from '../../utils/event-manager.js';

// 常量定义
const SUBJECTS = ['数学', '英语', '语文', '物理', '化学', '生物', '历史', '地理', '政治'];
const DIFFICULTY_LABELS = { 
  1: '简单', 
  2: '中等', 
  3: '困难',
  4: '较难',
  5: '很难'
};

// 排序选项
const SORT_OPTIONS = [
  { label: '按时间排序', value: 'createTime', order: 'desc' },
  { label: '按难度排序', value: 'difficulty', order: 'desc' },
  { label: '按复习次数', value: 'reviewCount', order: 'asc' },
  { label: '按掌握程度', value: 'reviewLevel', order: 'asc' }
];

Page({
  data: {
    // 错题数据
    mistakes: [],
    filteredMistakes: [],
    selectedMistakes: [], // 选中的错题ID列表
    isSelectionMode: false, // 是否处于选择模式
    
    // 页面状态
    loading: false,
    refreshing: false,
    searching: false,
    hasMore: true,
    page: 1,
    pageSize: 20,
    
    // 筛选和搜索
    filters: {
      subject: 'all',
      status: 'all',
      difficulty: 'all',
      sortBy: 'createTime',
      sortOrder: 'desc'
    },
    searchKeyword: '',
    showAdvancedSearch: false,
    
    // 界面控制
    showFilterPanel: false,
    showSortPanel: false,
    showBatchActions: false,
    
    // 选项数据
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
    sortOptions: SORT_OPTIONS,
    
    // 统计数据
    statistics: {
      total: 0,
      new: 0,
      reviewing: 0,
      mastered: 0
    },
    
    // 批量操作选项
    batchActions: [
      { id: 'addToReview', name: '加入复习计划', icon: 'play-circle-o', color: '#52c41a' },
      { id: 'updateStatus', name: '更新状态', icon: 'edit', color: '#1890ff' },
      { id: 'delete', name: '批量删除', icon: 'delete-o', color: '#f5222d' }
    ],
    
    // 状态
    isEmpty: false,
    hasError: false,
    errorMessage: ''
  },

  // 防抖搜索函数
  debouncedSearch: null,

  async onLoad(options) {
    console.log('错题本页面加载');
    
    // 初始化防抖搜索
    this.debouncedSearch = debounce(this.performSearch.bind(this), 300);
    
    // 注册事件监听器
    EventManager.on(EVENT_TYPES.MISTAKE_ADDED, 'onMistakeAdded', this);
    EventManager.on(EVENT_TYPES.MISTAKE_UPDATED, 'onMistakeUpdated', this);
    EventManager.on(EVENT_TYPES.MISTAKE_DELETED, 'onMistakeDeleted', this);
    
    // 处理传入的筛选参数
    if (options && options.subject) {
      this.setData({
        'filters.subject': String(options.subject)
      });
    }

    await this.initializeData();
  },

  async onShow() {
    console.log('错题本页面显示');
    // 每次显示时刷新数据，确保最新状态
    await this.refreshData();
  },

  async onPullDownRefresh() {
    await this.refreshData();
    wx.stopPullDownRefresh();
  },

  onReachBottom() {
    this.loadMoreMistakes();
  },

  /**
   * 初始化数据
   */
  async initializeData() {
    this.setData({ loading: true });
    
    try {
      // 并行加载数据
      await Promise.all([
        this.loadMistakes(),
        this.loadStatistics()
      ]);
      
      console.log('错题本数据初始化完成');
      
    } catch (error) {
      console.error('初始化数据失败:', error);
      this.showError('数据加载失败', error);
    } finally {
      this.setData({ loading: false });
    }
  },

  /**
   * 刷新数据
   */
  async refreshData() {
    if (this.data.refreshing) return;
    
    this.setData({ 
      refreshing: true,
      page: 1,
      hasMore: true,
      selectedMistakes: [],
      isSelectionMode: false
    });
    
    try {
      await Promise.all([
        this.loadMistakes(),
        this.loadStatistics()
      ]);
    } catch (error) {
      console.error('刷新数据失败:', error);
      this.showError('刷新失败', error);
    } finally {
      this.setData({ refreshing: false });
    }
  },

  /**
   * 加载错题列表 - 使用优化后的数据库方法
   */
  async loadMistakes() {
    try {
      const userId = DatabaseManager.getCurrentUserId();
      const { page, pageSize, filters } = this.data;
      
      // 构建查询参数
      const queryOptions = {
        page,
        pageSize,
        subject: filters.subject === 'all' ? '' : filters.subject,
        status: filters.status === 'all' ? '' : filters.status,
        difficulty: filters.difficulty === 'all' ? '' : filters.difficulty,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder
      };
      
      console.log('加载错题，查询参数:', queryOptions);
      
      const result = await DatabaseManager.getMistakes(userId, queryOptions);
      
      if (result.success) {
        const newMistakes = this.processMistakesData(result.data);
        const mistakes = page === 1 ? newMistakes : [...this.data.mistakes, ...newMistakes];
        
        this.setData({
          mistakes,
          hasMore: newMistakes.length === pageSize,
          isEmpty: mistakes.length === 0
        });
        
        // 应用客户端筛选
        this.applyClientFilters();
        
        console.log(`加载错题成功: ${newMistakes.length} 条，总计: ${mistakes.length} 条`);
      } else {
        throw new Error(result.error || '获取错题失败');
      }
      
    } catch (error) {
      console.error('加载错题失败:', error);
      this.showError('加载错题失败', error);
    }
  },

  /**
   * 处理错题数据，确保格式统一
   */
  processMistakesData(rawMistakes) {
    return rawMistakes.map((mistake, index) => ({
      ...mistake,
      _id: mistake._id || mistake.id || `mistake_${Date.now()}_${index}`,
      status: mistake.status || 'new',
      reviewCount: mistake.reviewCount || 0,
      reviewLevel: mistake.reviewLevel || 0,
      difficulty: mistake.difficulty || 2,
      subject: mistake.subject || '数学',
      question: mistake.question || mistake.content || '题目内容',
      createTime: mistake.createTime || new Date().toISOString(),
      updateTime: mistake.updateTime || mistake.createTime || new Date().toISOString(),
      // 添加计算字段
      displayTime: this.formatDisplayTime(mistake.createTime),
      difficultyLabel: DIFFICULTY_LABELS[mistake.difficulty] || '中等',
      needReview: this.shouldReview(mistake),
      masteryRate: this.calculateMasteryRate(mistake)
    }));
  },

  /**
   * 判断是否需要复习
   */
  shouldReview(mistake) {
    if (!mistake.nextReviewTime) return mistake.status === 'new';
    const reviewTime = new Date(mistake.nextReviewTime);
    const now = new Date();
    return reviewTime <= now && mistake.status !== 'mastered';
  },

  /**
   * 计算掌握程度
   */
  calculateMasteryRate(mistake) {
    const level = mistake.reviewLevel || 0;
    return Math.min(100, level * 20); // 每级20%
  },

  /**
   * 加载统计数据 - 使用缓存优化
   */
  async loadStatistics() {
    try {
      const userId = DatabaseManager.getCurrentUserId();
      const statsResult = await DatabaseManager.getTodayStats(userId);
      
      if (statsResult.success) {
        const todayStats = statsResult.data;
        
        // 获取详细的状态统计
        const mistakesResult = await DatabaseManager.getMistakes(userId, { pageSize: 1000 });
        
        if (mistakesResult.success) {
          const allMistakes = mistakesResult.data;
          const statistics = {
            total: todayStats.totalMistakes,
            new: allMistakes.filter(m => m.status === 'new').length,
            reviewing: allMistakes.filter(m => m.status === 'reviewing').length,
            mastered: allMistakes.filter(m => m.status === 'mastered').length
          };
          
          this.setData({ statistics });
          console.log('统计数据加载成功:', statistics);
        }
      }
      
    } catch (error) {
      console.error('加载统计数据失败:', error);
      // 设置默认统计数据
      this.setData({
        statistics: { total: 0, new: 0, reviewing: 0, mastered: 0 }
      });
    }
  },

  /**
   * 智能搜索 - 使用数据库搜索方法
   */
  async performSearch() {
    const { searchKeyword } = this.data;
    
    if (!searchKeyword || searchKeyword.trim() === '') {
      this.applyClientFilters();
      return;
    }
    
    this.setData({ searching: true });
    
    try {
      const userId = DatabaseManager.getCurrentUserId();
      const result = await DatabaseManager.searchMistakes(userId, searchKeyword.trim(), {
        pageSize: 100
      });
      
      if (result.success) {
        const searchResults = this.processMistakesData(result.data);
        this.setData({
          filteredMistakes: searchResults,
          isEmpty: searchResults.length === 0
        });
        
        console.log(`搜索完成: "${searchKeyword}" 找到 ${searchResults.length} 条结果`);
      }
      
    } catch (error) {
      console.error('搜索失败:', error);
      this.showError('搜索失败', error);
    } finally {
      this.setData({ searching: false });
    }
  },

  /**
   * 应用客户端筛选（非搜索情况下）
   */
  applyClientFilters() {
    const { mistakes, filters, searchKeyword } = this.data;
    
    // 如果有搜索关键词，则不应用客户端筛选
    if (searchKeyword && searchKeyword.trim()) {
      return;
    }
    
    let filtered = [...mistakes];
    
    // 状态筛选
    if (filters.status !== 'all') {
      filtered = filtered.filter(item => item.status === filters.status);
    }
    
    // 学科筛选（数据库级别已筛选，这里主要是兜底）
    if (filters.subject !== 'all') {
      filtered = filtered.filter(item => item.subject === filters.subject);
    }
    
    // 难度筛选（数据库级别已筛选，这里主要是兜底）
    if (filters.difficulty !== 'all') {
      filtered = filtered.filter(item => item.difficulty === filters.difficulty);
    }
    
    // 客户端排序（增强数据库排序）
    filtered = this.applySorting(filtered);
    
    this.setData({
      filteredMistakes: filtered,
      isEmpty: filtered.length === 0
    });
  },

  /**
   * 应用排序
   */
  applySorting(mistakes) {
    const { sortBy, sortOrder } = this.data.filters;
    
    return mistakes.sort((a, b) => {
      let aValue = a[sortBy];
      let bValue = b[sortBy];
      
      // 特殊排序逻辑
      if (sortBy === 'createTime' || sortBy === 'updateTime') {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      }
      
      const result = aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      return sortOrder === 'desc' ? -result : result;
    });
  },

  /**
   * 加载更多错题
   */
  async loadMoreMistakes() {
    if (!this.data.hasMore || this.data.loading) return;
    
    this.setData({
      page: this.data.page + 1,
      loading: true
    });
    
    try {
      await this.loadMistakes();
    } catch (error) {
      console.error('加载更多失败:', error);
      this.showError('加载更多失败', error);
    } finally {
      this.setData({ loading: false });
    }
  },

  // ======== 搜索和筛选相关方法 ========

  onSearchInput(e) {
    const keyword = e.detail || '';
    this.setData({ searchKeyword: keyword });
    
    if (this.debouncedSearch) {
      this.debouncedSearch();
    }
  },

  onSearchConfirm(e) {
    const keyword = e.detail || '';
    this.setData({ searchKeyword: keyword });
    this.performSearch();
  },

  onSearchClear() {
    this.setData({ searchKeyword: '' });
    this.applyClientFilters();
  },

  toggleAdvancedSearch() {
    this.setData({
      showAdvancedSearch: !this.data.showAdvancedSearch
    });
  },

  onFilterChange(e) {
    const { type, value } = e.currentTarget.dataset;
    
    this.setData({
      [`filters.${type}`]: value,
      page: 1,
      hasMore: true
    });
    
    this.refreshData();
  },

  filterByStatus(e) {
    const { status } = e.currentTarget.dataset;
    
    this.setData({
      'filters.status': status,
      page: 1,
      hasMore: true,
      showFilterPanel: false
    });
    
    this.refreshData();
  },

  onSortChange(e) {
    const { sort, order } = e.currentTarget.dataset;
    
    this.setData({
      'filters.sortBy': sort,
      'filters.sortOrder': order,
      showSortPanel: false,
      page: 1,
      hasMore: true
    });
    
    this.refreshData();
  },

  toggleFilterPanel() {
    this.setData({
      showFilterPanel: !this.data.showFilterPanel
    });
  },

  toggleSortPanel() {
    this.setData({
      showSortPanel: !this.data.showSortPanel
    });
  },

  // ======== 选择和批量操作相关方法 ========

  toggleSelectionMode() {
    const isSelectionMode = !this.data.isSelectionMode;
    this.setData({
      isSelectionMode,
      selectedMistakes: [],
      showBatchActions: isSelectionMode
    });
  },

  onMistakeSelect(e) {
    const { id } = e.currentTarget.dataset;
    const { selectedMistakes } = this.data;
    
    let newSelected = [...selectedMistakes];
    const index = newSelected.indexOf(id);
    
    if (index > -1) {
      newSelected.splice(index, 1);
    } else {
      newSelected.push(id);
    }
    
    this.setData({
      selectedMistakes: newSelected,
      showBatchActions: newSelected.length > 0
    });
  },

  selectAll() {
    const { filteredMistakes } = this.data;
    const allIds = filteredMistakes.map(item => item._id);
    
    this.setData({
      selectedMistakes: allIds,
      showBatchActions: allIds.length > 0
    });
  },

  clearSelection() {
    this.setData({
      selectedMistakes: [],
      showBatchActions: false,
      isSelectionMode: false
    });
  },

  async onBatchAction(e) {
    const { action } = e.currentTarget.dataset;
    const { selectedMistakes } = this.data;
    
    if (selectedMistakes.length === 0) {
      wx.showToast({ title: '请先选择错题', icon: 'none' });
      return;
    }
    
    switch (action) {
      case 'addToReview':
        await this.batchAddToReview();
        break;
      case 'updateStatus':
        this.showStatusSelector();
        break;
      case 'delete':
        this.confirmBatchDelete();
        break;
    }
  },

  /**
   * 批量加入复习计划
   */
  async batchAddToReview() {
    const { selectedMistakes } = this.data;
    
    try {
      wx.showLoading({ title: '处理中...', mask: true });
      
      const result = await DatabaseManager.batchUpdateMistakes(selectedMistakes, {
        status: 'reviewing',
        nextReviewTime: new Date().toISOString()
      });
      
      if (result.success) {
        wx.showToast({ title: `${result.data.updated} 道题已加入复习计划`, icon: 'success' });
        this.clearSelection();
        await this.refreshData();
      } else {
        throw new Error(result.error);
      }
      
    } catch (error) {
      console.error('批量加入复习计划失败:', error);
      this.showError('操作失败', error);
    } finally {
      wx.hideLoading();
    }
  },

  showStatusSelector() {
    const statusOptions = this.data.statuses.filter(s => s.value !== 'all');
    
    wx.showActionSheet({
      itemList: statusOptions.map(s => s.label),
      success: async (res) => {
        const selectedStatus = statusOptions[res.tapIndex];
        await this.batchUpdateStatus(selectedStatus.value);
      }
    });
  },

  async batchUpdateStatus(status) {
    const { selectedMistakes } = this.data;
    
    try {
      wx.showLoading({ title: '更新中...', mask: true });
      
      const result = await DatabaseManager.batchUpdateMistakes(selectedMistakes, {
        status: status
      });
      
      if (result.success) {
        wx.showToast({ title: `${result.data.updated} 道题状态已更新`, icon: 'success' });
        this.clearSelection();
        await this.refreshData();
      } else {
        throw new Error(result.error);
      }
      
    } catch (error) {
      console.error('批量更新状态失败:', error);
      this.showError('更新失败', error);
    } finally {
      wx.hideLoading();
    }
  },

  confirmBatchDelete() {
    const { selectedMistakes } = this.data;
    
    wx.showModal({
      title: '确认删除',
      content: `确定要删除选中的 ${selectedMistakes.length} 道错题吗？此操作不可恢复！`,
      confirmColor: '#f5222d',
      success: (res) => {
        if (res.confirm) {
          this.batchDelete();
        }
      }
    });
  },

  async batchDelete() {
    const { selectedMistakes } = this.data;
    
    try {
      wx.showLoading({ title: '删除中...', mask: true });
      
      // 逐个删除（数据库管理器暂时不支持批量删除）
      let deletedCount = 0;
      for (const mistakeId of selectedMistakes) {
        const result = await DatabaseManager.deleteMistake(mistakeId);
        if (result.success) {
          deletedCount++;
        }
      }
      
      wx.showToast({ title: `已删除 ${deletedCount} 道错题`, icon: 'success' });
      this.clearSelection();
      await this.refreshData();
      
    } catch (error) {
      console.error('批量删除失败:', error);
      this.showError('删除失败', error);
    } finally {
      wx.hideLoading();
    }
  },

  // ======== 单个错题操作相关方法 ========

  onMistakeClick(e) {
    const { id } = e.currentTarget.dataset;
    
    // 如果处于选择模式，则选择/取消选择
    if (this.data.isSelectionMode) {
      this.onMistakeSelect(e);
      return;
    }
    
    // 正常模式下跳转到详情页
    if (!id) {
      wx.showToast({ title: '错题信息无效', icon: 'none' });
      return;
    }
    
    wx.navigateTo({
      url: `/pages/mistakes/detail?id=${id}`,
      fail: (error) => {
        console.error('跳转失败:', error);
        this.showError('跳转失败', error);
      }
    });
  },

  async addSingleToReview(e) {
    const { id } = e.currentTarget.dataset;
    
    try {
      wx.showLoading({ title: '加入复习计划...', mask: true });
      
      const result = await DatabaseManager.addToReviewPlan(id);
      
      if (result.success) {
        wx.showToast({ title: '已加入复习计划', icon: 'success' });
        await this.refreshData();
      } else {
        throw new Error(result.error);
      }
      
    } catch (error) {
      console.error('加入复习计划失败:', error);
      this.showError('操作失败', error);
    } finally {
      wx.hideLoading();
    }
  },

  editMistake(e) {
    const { id } = e.currentTarget.dataset;
    
    wx.navigateTo({
      url: `/pages/mistakes/add?id=${id}&mode=edit`,
      fail: (error) => {
        console.error('跳转编辑页面失败:', error);
        this.showError('跳转失败', error);
      }
    });
  },

  // ======== 导航和其他方法 ========

  onAddMistake() {
    wx.navigateTo({
      url: '/pages/mistakes/add'
    });
  },

  goToCamera() {
    wx.navigateTo({
      url: '/pages/camera/camera'
    });
  },

  viewAnalysis() {
    const { statistics, filteredMistakes } = this.data;
    
    // 生成分析数据
    const analysisData = {
      ...statistics,
      masteryRate: statistics.total > 0 ? Math.round((statistics.mastered / statistics.total) * 100) : 0,
      subjectStats: this.generateSubjectStats(filteredMistakes),
      difficultyStats: this.generateDifficultyStats(filteredMistakes),
      weeklyProgress: this.generateWeeklyProgress(filteredMistakes)
    };
    
    wx.navigateTo({
      url: `/pages/mistakes/analysis?data=${encodeURIComponent(JSON.stringify(analysisData))}`
    });
  },

  generateSubjectStats(mistakes) {
    const stats = {};
    mistakes.forEach(mistake => {
      const subject = mistake.subject || '未分类';
      if (!stats[subject]) {
        stats[subject] = { total: 0, mastered: 0 };
      }
      stats[subject].total++;
      if (mistake.status === 'mastered') {
        stats[subject].mastered++;
      }
    });
    
    return Object.entries(stats).map(([subject, data]) => ({
      subject,
      total: data.total,
      mastered: data.mastered,
      masteryRate: Math.round((data.mastered / data.total) * 100)
    }));
  },

  generateDifficultyStats(mistakes) {
    const stats = {};
    mistakes.forEach(mistake => {
      const difficulty = mistake.difficulty || 2;
      if (!stats[difficulty]) {
        stats[difficulty] = { total: 0, mastered: 0 };
      }
      stats[difficulty].total++;
      if (mistake.status === 'mastered') {
        stats[difficulty].mastered++;
      }
    });
    
    return Object.entries(stats).map(([difficulty, data]) => ({
      difficulty: parseInt(difficulty),
      label: DIFFICULTY_LABELS[difficulty] || '中等',
      total: data.total,
      mastered: data.mastered,
      masteryRate: Math.round((data.mastered / data.total) * 100)
    }));
  },

  generateWeeklyProgress(mistakes) {
    // 简单的周进度统计，实际应该从数据库获取
    const now = new Date();
    const weekDays = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dayMistakes = mistakes.filter(m => {
        const createDate = new Date(m.createTime);
        return createDate.toDateString() === date.toDateString();
      });
      
      weekDays.push({
        date: date.toISOString().split('T')[0],
        count: dayMistakes.length
      });
    }
    
    return weekDays;
  },

  // ======== 工具方法 ========

  formatDisplayTime(dateStr) {
    if (!dateStr) return '未知时间';
    
    const date = new Date(dateStr);
    const now = new Date();
    const diffTime = now - date;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return '今天';
    } else if (diffDays === 1) {
      return '昨天';
    } else if (diffDays < 7) {
      return `${diffDays}天前`;
    } else {
      return `${date.getMonth() + 1}月${date.getDate()}日`;
    }
  },

  showError(message, error) {
    console.error(message, error);
    this.setData({
      hasError: true,
      errorMessage: message
    });
    
    wx.showToast({
      title: message,
      icon: 'none',
      duration: 2000
    });
  },

  onUnload() {
    // 清理防抖函数
    if (this.debouncedSearch) {
      this.debouncedSearch = null;
    }
    
    // 移除事件监听器
    EventManager.off(EVENT_TYPES.MISTAKE_ADDED, this);
    EventManager.off(EVENT_TYPES.MISTAKE_UPDATED, this);
    EventManager.off(EVENT_TYPES.MISTAKE_DELETED, this);
  },

  /**
   * 处理错题添加事件
   */
  onMistakeAdded(data) {
    console.log('收到错题添加事件:', data);
    // 重新加载错题数据和统计信息
    this.loadMistakes();
    this.loadStatistics();
  },

  /**
   * 处理错题更新事件
   */
  onMistakeUpdated(data) {
    console.log('收到错题更新事件:', data);
    // 重新加载数据以确保最新状态
    this.loadMistakes();
    this.loadStatistics();
  },

  /**
   * 处理错题删除事件
   */
  onMistakeDeleted(data) {
    console.log('收到错题删除事件:', data);
    // 重新加载数据
    this.loadMistakes();
    this.loadStatistics();
  }
});
