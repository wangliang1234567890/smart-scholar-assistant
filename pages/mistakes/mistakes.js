import DatabaseManager from '../../utils/database';
import LocalDB from '../../utils/local-db';
import { SUBJECTS, DIFFICULTY_LABELS } from '../../utils/constants';
import { store } from '../../store/index';
import errorHandler from '../../utils/error-handler';
import uxManager from '../../utils/ux-manager';
import { debounce } from '../../utils/common';

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
    searchKeyword: '', // 确保是字符串类型
    
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
    try {
      // 更新tabBar状态
      if (typeof this.getTabBar === 'function' && this.getTabBar()) {
        this.getTabBar().setActiveTab(1);
      }
      
      // 每次显示时，根据登录和游客状态决定行为
      const isLoggedIn = store.isLoggedIn || false;
      const isGuestMode = store.isGuestMode || false;
      
      if (!isLoggedIn && !isGuestMode) {
        // 既没登录，也没进入游客模式，才跳转到登录页
        wx.redirectTo({
          url: '/pages/login/login'
        });
        return;
      }

      // 刷新数据
      this.refreshData();
    } catch (error) {
      this.handlePageError(error, '页面显示失败');
    }
  },

  onUnload() {
    // 清理资源
    this.cleanup();
  },

  onPullDownRefresh() {
    this.refreshData(true);
  },

  onReachBottom() {
    this.loadMoreMistakes();
  },

  // 重试方法 - 供UX管理器调用
  onRetry() {
    this.refreshData();
  },

  /**
   * 初始化页面
   */
  async initializePage() {
    try {
      uxManager.showLoading('init', { title: '加载错题数据...' });
      
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
      
      uxManager.hideLoading('init');
      
      // 延迟加载数据，给页面渲染时间
      setTimeout(() => {
        this.loadMistakes().catch(error => {
          console.warn('延迟加载错题失败:', error);
        });
        this.loadStatistics().catch(error => {
          console.warn('延迟加载统计失败:', error);
        });
      }, 500);
      
    } catch (error) {
      uxManager.hideLoading('init');
      this.handlePageError(error, '初始化页面失败');
    }
  },

  /**
   * 刷新数据
   */
  async refreshData(isManualRefresh = false) {
    try {
      if (isManualRefresh) {
        this.setData({ refreshing: true });
        uxManager.showLoading('refresh', { title: '刷新中...', duration: 0 });
      }

      // 重置分页
      this.setData({
        page: 1,
        hasMore: true,
        mistakes: [],
        hasError: false
      });

      await Promise.all([
        this.loadMistakes(),
        this.loadStatistics()
      ]);

      if (isManualRefresh) {
        uxManager.hideLoading('refresh');
        uxManager.showSuccess('刷新成功');
        this.setData({ refreshing: false });
        wx.stopPullDownRefresh();
      }

    } catch (error) {
      if (isManualRefresh) {
        uxManager.hideLoading('refresh');
        this.setData({ refreshing: false });
        wx.stopPullDownRefresh();
      }
      
      this.handlePageError(error, '刷新数据失败', true);
    }
  },

  /**
   * 加载错题列表
   */
  async loadMistakes() {
    try {
      const { page, pageSize, filters } = this.data;
      
      // 获取用户ID - 优先从store获取，降级到游客模式
      let userId = null;
      try {
        userId = store.userInfo?.openid || store.userInfo?.id;
        if (!userId && store.isGuestMode) {
          userId = 'guest_user'; // 游客模式使用固定ID
        }
      } catch (e) {
        console.warn('获取用户ID失败，使用游客模式:', e);
        userId = 'guest_user';
      }

      if (!userId) {
        throw new Error('无法获取用户身份信息');
      }
      
      // 构建查询选项
      const queryOptions = {
        page,
        pageSize,
        sortBy: 'createTime',
        sortOrder: 'desc'
      };

      // 添加筛选条件
      if (filters.subject !== 'all') {
        queryOptions.subject = filters.subject;
      }
      if (filters.status !== 'all') {
        queryOptions.status = filters.status;
      }
      
      console.log('加载错题参数:', { userId, queryOptions });
      
      // 加载数据 - 添加降级处理
      let result;
      try {
        result = await DatabaseManager.getMistakes(userId, queryOptions);
      } catch (dbError) {
        console.warn('数据库查询失败，使用模拟数据:', dbError);
        // 提供模拟数据
        result = {
          success: true,
          data: []
        };
      }

      if (result.success) {
        // 确保数据是数组类型
        const newMistakes = Array.isArray(result.data) ? result.data : [];
        const currentMistakes = Array.isArray(this.data.mistakes) ? this.data.mistakes : [];
        const allMistakes = page === 1 ? newMistakes : [...currentMistakes, ...newMistakes];
        
        this.setData({
          mistakes: allMistakes,
          filteredMistakes: allMistakes, // 确保初始化
          hasMore: newMistakes.length === pageSize,
          loading: false,
          isEmpty: allMistakes.length === 0,
          emptyMessage: this.getEmptyMessage()
        });

        // 应用筛选
        this.applyFilters();
        
      } else {
        throw new Error(result.error || '加载错题失败');
      }

    } catch (error) {
      this.setData({ loading: false });
      throw error;
    }
  },

  /**
   * 加载更多错题
   */
  async loadMoreMistakes() {
    if (!this.data.hasMore || this.data.loading) {
      return;
    }

    try {
      uxManager.showLoading('loadMore', { title: '加载更多...', duration: 0 });
      
      this.setData({
        page: this.data.page + 1,
        loading: true
      });

      await this.loadMistakes();
      
      uxManager.hideLoading('loadMore');
      
    } catch (error) {
      uxManager.hideLoading('loadMore');
      this.handlePageError(error, '加载更多失败', true);
    }
  },

  /**
   * 加载统计数据
   */
  async loadStatistics() {
    try {
      // 获取用户ID
      let userId = null;
      try {
        userId = store.userInfo?.openid || store.userInfo?.id;
        if (!userId && store.isGuestMode) {
          userId = 'guest_user';
        }
      } catch (e) {
        console.warn('获取用户ID失败，使用游客模式:', e);
        userId = 'guest_user';
      }

      if (!userId) {
        console.warn('无法获取用户ID，跳过统计数据加载');
        return;
      }

      // 使用简单的方式获取统计数据 - 分别查询各状态的数量
      let allMistakes, newMistakes, reviewingMistakes, masteredMistakes;
      
      try {
        [allMistakes, newMistakes, reviewingMistakes, masteredMistakes] = await Promise.all([
          DatabaseManager.getMistakes(userId, { pageSize: 1000 }), // 获取所有错题来计算总数
          DatabaseManager.getMistakes(userId, { status: 'new', pageSize: 1 }),
          DatabaseManager.getMistakes(userId, { status: 'reviewing', pageSize: 1 }), 
          DatabaseManager.getMistakes(userId, { status: 'mastered', pageSize: 1 })
        ]);
      } catch (dbError) {
        console.warn('统计数据查询失败，使用默认值:', dbError);
        // 提供默认的成功响应
        allMistakes = newMistakes = reviewingMistakes = masteredMistakes = {
          success: true,
          data: []
        };
      }

      // 计算统计数据
      const statistics = {
        total: 0,
        new: 0,
        reviewing: 0,
        mastered: 0
      };

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



  /**
   * 应用筛选条件
   */
  applyFilters() {
    const { mistakes, filters, searchKeyword } = this.data;
    
    let filtered = [...mistakes];

    // 搜索过滤 - 确保 searchKeyword 是字符串
    const keyword = String(searchKeyword || '').trim();
    if (keyword) {
      const lowerKeyword = keyword.toLowerCase();
      filtered = filtered.filter(mistake => 
        (mistake.question || '').toLowerCase().includes(lowerKeyword) ||
        (mistake.subject || '').toLowerCase().includes(lowerKeyword) ||
        (mistake.tags || []).some(tag => (tag || '').toLowerCase().includes(lowerKeyword))
      );
    }

    this.setData({
      filteredMistakes: filtered,
      isEmpty: filtered.length === 0,
      emptyMessage: this.getEmptyMessage()
    });
  },

  /**
   * 搜索错题
   */
  onSearchInput(e) {
    const keyword = e.detail.value || ''; // 确保是字符串
    this.setData({ searchKeyword: keyword });
    this.debouncedSearch();
  },

  /**
   * 执行搜索
   */
  performSearch() {
    this.applyFilters();
  },

  /**
   * 搜索确认
   */
  onSearchConfirm(e) {
    const keyword = e.detail.value || ''; // 确保是字符串
    this.setData({ searchKeyword: keyword });
    this.performSearch();
  },

  /**
   * 清空搜索
   */
  onSearchClear() {
    this.setData({ searchKeyword: '' }); // 确保是空字符串
    this.performSearch();
  },

  /**
   * 筛选条件改变
   */
  onFilterChange(e) {
    const { filterType, value } = e.currentTarget.dataset;
    
    this.setData({
      [`filters.${filterType}`]: value
    });

    // 重新加载数据
    this.setData({
      page: 1,
      mistakes: [],
      hasMore: true
    });

    this.loadMistakes().catch(error => {
      this.handlePageError(error, '筛选失败', true);
    });
  },

  /**
   * 设置筛选条件 - 模板调用的方法
   */
  setFilter(e) {
    const { type, value } = e.currentTarget.dataset;
    
    if (!type) {
      console.warn('筛选类型未指定');
      return;
    }

    try {
      // 更新筛选条件
      this.setData({
        [`filters.${type}`]: value
      });

      // 重新加载数据
      this.setData({
        page: 1,
        mistakes: [],
        hasMore: true
      });

      uxManager.showLoading('filter', { title: '筛选中...', duration: 500 });
      
      this.loadMistakes().then(() => {
        uxManager.hideLoading('filter');
      }).catch(error => {
        uxManager.hideLoading('filter');
        this.handlePageError(error, '筛选失败', true);
      });

    } catch (error) {
      this.handlePageError(error, '设置筛选条件失败');
    }
  },

  /**
   * 按状态筛选错题
   */
  filterByStatus(e) {
    const { status } = e.currentTarget.dataset;
    
    if (!status) {
      console.warn('筛选状态未指定');
      return;
    }

    try {
      // 更新筛选条件
      this.setData({
        'filters.status': status
      });

      // 重新加载数据
      this.setData({
        page: 1,
        mistakes: [],
        hasMore: true
      });

      uxManager.showLoading('filter', { title: '筛选中...', duration: 500 });
      
      this.loadMistakes().then(() => {
        uxManager.hideLoading('filter');
      }).catch(error => {
        uxManager.hideLoading('filter');
        this.handlePageError(error, '筛选失败', true);
      });

    } catch (error) {
      this.handlePageError(error, '按状态筛选失败');
    }
  },

  /**
   * 查看详细分析
   */
  viewAnalysis() {
    try {
      wx.navigateTo({
        url: '/pages/report/report'
      });
    } catch (error) {
      this.handlePageError(error, '打开分析页面失败');
    }
  },

  /**
   * 跳转到拍照页面
   */
  goToCamera() {
    try {
      wx.navigateTo({
        url: '/pages/camera/camera'
      });
    } catch (error) {
      this.handlePageError(error, '打开拍照页面失败');
    }
  },

  /**
   * 错题项目点击
   */
  onMistakeItemTap(e) {
    const { mistakeId } = e.currentTarget.dataset;
    
    if (!mistakeId) {
      uxManager.showError('错题信息无效');
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

  /**
   * 错题点击 - 模板调用的方法
   */
  onMistakeClick(e) {
    const { id } = e.currentTarget.dataset;
    
    if (!id) {
      uxManager.showError('错题信息无效');
      return;
    }

    try {
      wx.navigateTo({
        url: `/pages/mistakes/detail?id=${id}`
      });
    } catch (error) {
      this.handlePageError(error, '打开错题详情失败');
    }
  },

  /**
   * 显示操作菜单
   */
  onMistakeAction(e) {
    const { mistakeId } = e.currentTarget.dataset;
    
    if (!mistakeId) {
      uxManager.showError('错题信息无效');
      return;
    }

    this.setData({
      currentMistakeId: mistakeId,
      showActionSheet: true
    });
  },

  /**
   * 显示错题操作菜单 - 模板调用的方法
   */
  showMistakeActions(e) {
    e.stopPropagation(); // 阻止事件冒泡
    const { id } = e.currentTarget.dataset;
    
    if (!id) {
      uxManager.showError('错题信息无效');
      return;
    }

    this.setData({
      currentMistakeId: id,
      showActionSheet: true
    });
  },

  /**
   * 操作菜单选择
   */
  onActionSheetSelect(e) {
    const { index } = e.detail;
    const action = this.data.actionSheetActions[index];
    const mistakeId = this.data.currentMistakeId;

    this.setData({ showActionSheet: false });

    switch (action.name) {
      case '编辑':
        this.editMistake(mistakeId);
        break;
      case '加入复习计划':
        this.addToReviewPlan(mistakeId);
        break;
      case '删除':
        this.deleteMistake(mistakeId);
        break;
    }
  },

  /**
   * 操作选择 - 模板调用的方法
   */
  onActionSelect(e) {
    const { index } = e.detail;
    const action = this.data.actionSheetActions[index];
    const mistakeId = this.data.currentMistakeId;

    this.setData({ showActionSheet: false });

    if (!mistakeId) {
      uxManager.showError('操作失败：错题信息无效');
      return;
    }

    try {
      switch (action.name) {
        case '编辑':
          this.editMistake(mistakeId);
          break;
        case '加入复习计划':
          this.addToReviewPlan(mistakeId);
          break;
        case '删除':
          this.deleteMistake(mistakeId);
          break;
        default:
          uxManager.showError('未知操作');
      }
    } catch (error) {
      this.handlePageError(error, '操作失败');
    }
  },

  /**
   * 操作菜单关闭
   */
  onActionSheetClose() {
    this.setData({ 
      showActionSheet: false,
      currentMistakeId: ''
    });
  },

  /**
   * 编辑错题
   */
  editMistake(mistakeId) {
    try {
      wx.navigateTo({
        url: `/pages/mistakes/add?id=${mistakeId}&mode=edit`
      });
    } catch (error) {
      this.handlePageError(error, '打开编辑页面失败');
    }
  },

  /**
   * 加入复习计划
   */
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

  /**
   * 删除错题
   */
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

  /**
   * 添加新错题
   */
  onAddMistake() {
    try {
      wx.navigateTo({
        url: '/pages/mistakes/add'
      });
    } catch (error) {
      this.handlePageError(error, '打开添加页面失败');
    }
  },

  /**
   * 获取空状态消息
   */
  getEmptyMessage() {
    const { filters, searchKeyword } = this.data;
    
    // 确保 searchKeyword 是字符串类型
    const keyword = String(searchKeyword || '').trim();
    if (keyword) {
      return '没有找到相关错题';
    }
    
    if (filters.subject !== 'all' || filters.status !== 'all' || filters.difficulty !== 'all') {
      return '没有符合条件的错题';
    }
    
    return '还没有错题记录\n点击右下角按钮添加错题';
  },

  /**
   * 处理页面错误
   */
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

  /**
   * 清理资源
   */
  cleanup() {
    // 清理防抖函数
    if (this.debouncedSearch) {
      this.debouncedSearch = null;
    }
    
    // 清理UX状态
    uxManager.clearPageStates();
  }
});