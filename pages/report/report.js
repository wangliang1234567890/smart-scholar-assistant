const app = getApp()

Page({
  data: {
    loading: false,
    showChart: false,
    currentPeriod: {
      title: '本周报告',
      startDate: '2024-01-15',
      endDate: '2024-01-21'
    },
    reportData: {
      totalMistakes: 35,
      mistakeChange: 5,
      studyTime: 12.5,
      timeChange: 2.3,
      masteryRate: 82,
      masteryChange: 8,
      studyDays: 6,
      daysChange: 1,
      trend: '进步中'
    },
    subjectStats: [
      {
        name: '数学',
        icon: 'calculator',
        mistakeCount: 15,
        masteryRate: 78,
        trend: 'up',
        trendText: '提升3%'
      },
      {
        name: '语文',
        icon: 'description',
        mistakeCount: 12,
        masteryRate: 85,
        trend: 'up',
        trendText: '提升5%'
      },
      {
        name: '英语',
        icon: 'chat',
        mistakeCount: 8,
        masteryRate: 90,
        trend: 'stable',
        trendText: '保持稳定'
      }
    ],
    suggestions: [
      {
        id: 1,
        type: 'urgent',
        icon: 'warning-o',
        iconColor: '#EF4444',
        title: '数学需要重点关注',
        description: '错题数量较多，建议增加练习时间',
        actionText: '去练习',
        actionType: 'danger'
      },
      {
        id: 2,
        type: 'good',
        icon: 'success',
        iconColor: '#10B981',
        title: '英语表现优秀',
        description: '掌握率很高，继续保持',
        actionText: '查看详情',
        actionType: 'primary'
      }
    ],
    achievements: [
      {
        id: 1,
        name: '连续学习',
        description: '连续学习7天',
        icon: 'medal-o',
        earned: true
      },
      {
        id: 2,
        name: '错题克星',
        description: '单日复习20道错题',
        icon: 'fire-o',
        earned: false
      }
    ]
  },

  onLoad(options) {
    this.loadReportData()
  },

  onShow() {
    this.refreshReport()
  },

  onPullDownRefresh() {
    this.loadReportData()
    wx.stopPullDownRefresh()
  },

  // 加载报告数据
  loadReportData() {
    this.setData({ loading: true })
    
    Promise.all([
      this.loadOverallStats(),
      this.loadSubjectStats(),
      this.loadSuggestions(),
      this.loadAchievements()
    ]).then(() => {
      this.setData({ loading: false })
      if (this.data.showChart) {
        this.drawChart()
      }
    })
  },

  // 加载整体统计
  loadOverallStats() {
    return new Promise((resolve) => {
      setTimeout(() => {
        const reportData = {
          totalMistakes: Math.floor(Math.random() * 50) + 20,
          mistakeChange: Math.floor(Math.random() * 10) - 5,
          studyTime: (Math.random() * 20 + 5).toFixed(1),
          timeChange: (Math.random() * 5 - 2.5).toFixed(1),
          masteryRate: Math.floor(Math.random() * 30) + 70,
          masteryChange: Math.floor(Math.random() * 20) - 10,
          studyDays: Math.floor(Math.random() * 7) + 1,
          daysChange: Math.floor(Math.random() * 3) - 1,
          trend: ['进步中', '稳定', '需努力'][Math.floor(Math.random() * 3)]
        }
        this.setData({ reportData })
        resolve(reportData)
      }, 500)
    })
  },

  // 加载学科统计
  loadSubjectStats() {
    return new Promise((resolve) => {
      setTimeout(() => {
        const subjects = this.data.subjectStats.map(subject => ({
          ...subject,
          mistakeCount: Math.floor(Math.random() * 20) + 5,
          masteryRate: Math.floor(Math.random() * 40) + 60
        }))
        this.setData({ subjectStats: subjects })
        resolve(subjects)
      }, 300)
    })
  },

  // 加载建议
  loadSuggestions() {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(this.data.suggestions)
      }, 200)
    })
  },

  // 加载成就
  loadAchievements() {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(this.data.achievements)
      }, 100)
    })
  },

  // 刷新报告
  refreshReport() {
    this.loadOverallStats()
  },

  // 切换周期
  onPeriodChange() {
    wx.showActionSheet({
      itemList: ['本周报告', '本月报告', '学期报告', '自定义时间'],
      success: (res) => {
        const periods = [
          { title: '本周报告', startDate: '2024-01-15', endDate: '2024-01-21' },
          { title: '本月报告', startDate: '2024-01-01', endDate: '2024-01-31' },
          { title: '学期报告', startDate: '2023-09-01', endDate: '2024-01-31' },
          { title: '自定义时间', startDate: '选择开始', endDate: '选择结束' }
        ]
        
        if (res.tapIndex < 3) {
          this.setData({ 
            currentPeriod: periods[res.tapIndex]
          })
          this.loadReportData()
        } else {
          this.showDatePicker()
        }
      }
    })
  },

  // 显示日期选择器
  showDatePicker() {
    wx.showToast({
      title: '功能开发中',
      icon: 'none'
    })
  },

  // 切换图表/列表视图
  onToggleChart() {
    const showChart = !this.data.showChart
    this.setData({ showChart })
    
    if (showChart) {
      // 延迟绘制，确保canvas准备好
      setTimeout(() => {
        this.drawChart()
      }, 100);
    }
  },

  // 绘制图表
  drawChart() {
    const query = wx.createSelectorQuery()
    query.select('#subjectChart')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res[0] || !res[0].node) {
          console.error("无法获取canvas节点");
          wx.showToast({
            title: '图表加载失败',
            icon: 'none'
          });
          return;
        }

        const canvas = res[0].node
        const ctx = canvas.getContext('2d')

        const dpr = wx.getSystemInfoSync().pixelRatio
        const canvasWidth = res[0].width
        const canvasHeight = res[0].height
        canvas.width = canvasWidth * dpr
        canvas.height = canvasHeight * dpr
        ctx.scale(dpr, dpr)

        this.renderChart(ctx, canvasWidth, canvasHeight)
      })
  },

  renderChart(ctx, width, height) {
    const data = this.data.subjectStats;
    if (!data || data.length === 0) {
      this.drawEmptyState(ctx, width, height, "暂无学科数据");
      return;
    }

    // 清空画布
    ctx.clearRect(0, 0, width, height);

    const padding = { top: 40, right: 30, bottom: 40, left: 40 };
    const chartArea = {
      width: width - padding.left - padding.right,
      height: height - padding.top - padding.bottom,
    };
    const barWidth = 20;
    const gap = (chartArea.width - data.length * barWidth) / (data.length + 1);

    // 绘制坐标轴
    this.drawAxes(ctx, padding, width, height);
    this.drawYAxisLabels(ctx, padding, chartArea);


    // 绘制柱状图
    data.forEach((item, index) => {
      const x = padding.left + gap * (index + 1) + barWidth * index;
      
      // 绘制错题数柱子
      const mistakeBarHeight = (item.mistakeCount / 50) * chartArea.height; // 假设最大错题数为50
      ctx.fillStyle = '#60A5FA'; // 蓝色
      ctx.fillRect(x, height - padding.bottom - mistakeBarHeight, barWidth, mistakeBarHeight);

      // 绘制掌握率柱子 (这里用线表示)
      const masteryY = height - padding.bottom - (item.masteryRate / 100) * chartArea.height;
      ctx.beginPath();
      ctx.moveTo(x - 5, masteryY);
      ctx.lineTo(x + barWidth + 5, masteryY);
      ctx.strokeStyle = '#34D399'; // 绿色
      ctx.lineWidth = 2;
      ctx.stroke();

      // 绘制X轴标签
      ctx.fillStyle = '#6B7280';
      ctx.textAlign = 'center';
      ctx.fillText(item.name, x + barWidth / 2, height - padding.bottom + 20);
    });

    // 绘制图例
    this.drawLegend(ctx, width, padding);
  },

  drawAxes(ctx, padding, width, height) {
    ctx.beginPath();
    ctx.strokeStyle = '#E5E7EB';
    // Y轴
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, height - padding.bottom);
    // X轴
    ctx.lineTo(width - padding.right, height - padding.bottom);
    ctx.stroke();
  },

  drawYAxisLabels(ctx, padding, chartArea) {
    ctx.fillStyle = '#9CA3AF';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';

    // 掌握率
    for (let i = 0; i <= 5; i++) {
      const y = padding.top + chartArea.height * (1 - i / 5);
      const label = i * 20;
      ctx.fillText(`${label}%`, padding.left - 8, y + 3);
    }

    // 错题数 - 假设最大50
    ctx.textAlign = 'left';
    for (let i = 0; i <= 5; i++) {
        const y = padding.top + chartArea.height * (1 - i / 5);
        const label = i * 10;
        ctx.fillText(`${label}`, padding.left + chartArea.width + 8, y + 3);
    }
  },
  
  drawLegend(ctx, width, padding) {
      ctx.fillStyle = '#60A5FA';
      ctx.fillRect(padding.left, 10, 10, 10);
      ctx.fillStyle = '#6B7280';
      ctx.fillText('错题数', padding.left + 15, 18);

      ctx.strokeStyle = '#34D399';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(padding.left + 70, 15);
      ctx.lineTo(padding.left + 80, 15);
      ctx.stroke();
      ctx.fillStyle = '#6B7280';
      ctx.fillText('掌握率', padding.left + 85, 18);
  },
  
  drawEmptyState(ctx, width, height, text) {
      ctx.clearRect(0, 0, width, height);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#9CA3AF';
      ctx.fillText(text, width / 2, height / 2);
  },

  // 学科详情
  onSubjectDetail(e) {
    const { subject } = e.currentTarget.dataset
    wx.navigateTo({
      url: `/pages/subjects/detail?name=${subject.name}`
    })
  },

  // 建议操作
  onSuggestionAction(e) {
    const { suggestion } = e.currentTarget.dataset
    
    if (suggestion.actionText === '去练习') {
      wx.switchTab({
        url: '/pages/practice/practice'
      })
    } else {
      wx.navigateTo({
        url: `/pages/subjects/detail?name=数学`
      })
    }
  },

  // 查看所有成就
  onViewAllAchievements() {
    wx.navigateTo({
      url: '/pages/achievements/achievements'
    })
  },

  // 导出报告
  onExportReport() {
    wx.showLoading({
      title: '生成中...'
    })
    
    setTimeout(() => {
      wx.hideLoading()
      wx.showShareMenu({
        withShareTicket: true,
        success: () => {
          wx.showToast({
            title: '请选择分享方式',
            icon: 'none'
          })
        }
      })
    }, 1500)
  },

  // 打印报告
  onPrintReport() {
    wx.navigateTo({
      url: '/pages/print/report'
    })
  }
}) 