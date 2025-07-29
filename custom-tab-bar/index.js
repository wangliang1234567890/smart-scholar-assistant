const app = getApp();

Component({
  data: {
    selectedIndex: 0,
    color: "#6B7280",
    selectedColor: "#4F46E5", // 与app.json保持一致
    list: [
      {
        pagePath: "/pages/home/home",
        text: "首页",
        iconPath: "/images/tab/home.svg",
        selectedIconPath: "/images/tab/home_active.svg"
      },
      {
        pagePath: "/pages/mistakes/mistakes",
        text: "错题本",
        iconPath: "/images/tab/mistakes.svg",
        selectedIconPath: "/images/tab/mistakes_active.svg"
      },
      {
        pagePath: "/pages/practice/practice",
        text: "练习",
        iconPath: "/images/tab/practice.svg",
        selectedIconPath: "/images/tab/practice_active.svg"
      },
      {
        pagePath: "/pages/schedule/schedule",
        text: "课程表",
        iconPath: "/images/tab/schedule.svg",
        selectedIconPath: "/images/tab/schedule_active.svg"
      },
      {
        pagePath: "/pages/profile/profile",
        text: "我的",
        iconPath: "/images/tab/profile.svg",
        selectedIconPath: "/images/tab/profile_active.svg"
      }
    ]
  },
  
  attached() {
    this.updateTabBarState()
  },

  ready() {
    this.updateTabBarState()
  },

  methods: {
    switchTab(e) {
      const data = e.currentTarget.dataset
      const url = data.path
      const index = data.index
      
      console.log('TabBar点击:', { url, index })
      
      // 立即更新选中状态，提升用户体验
      this.setData({
        selectedIndex: index
      })
      
      wx.switchTab({
        url,
        success: () => {
          console.log('页面切换成功:', url)
          // 延迟更新状态，确保页面已经切换完成
          setTimeout(() => {
            this.updateTabBarState()
          }, 100)
        },
        fail: (err) => {
          console.error('页面切换失败:', err, url)
          // 切换失败时恢复原状态
          this.updateTabBarState()
        }
      })
    },

    updateTabBarState() {
      const pages = getCurrentPages()
      if (!pages || pages.length === 0) {
        console.warn('TabBar: 没有找到页面栈')
        return
      }
      
      const currentPage = pages[pages.length - 1]
      if (!currentPage) {
        console.warn('TabBar: 当前页面为空')
        return
      }
      
      const route = currentPage.route
      console.log('TabBar 当前路由:', route)
      
      // 标准化路由格式，确保匹配正确
      const normalizedRoute = route.startsWith('/') ? route : `/${route}`
      
      const index = this.data.list.findIndex(item => {
        const itemPath = item.pagePath
        console.log('TabBar 比较路由:', { normalizedRoute, itemPath })
        return itemPath === normalizedRoute
      })
      
      console.log('TabBar 匹配结果:', { route: normalizedRoute, index })
      
      if (index !== -1 && index !== this.data.selectedIndex) {
        console.log('TabBar 更新状态:', { oldIndex: this.data.selectedIndex, newIndex: index })
        this.setData({
          selectedIndex: index
        })
      } else if (index === -1) {
        console.warn('TabBar: 未找到匹配的tab页:', normalizedRoute)
      }
    },

    // 提供外部调用接口，用于页面主动更新tabBar状态
    setActiveTab(index) {
      if (typeof index === 'number' && index >= 0 && index < this.data.list.length) {
        this.setData({
          selectedIndex: index
        })
      }
    }
  }
}) 



