const app = getApp();

Component({
  data: {
    selectedIndex: 0,
    color: "#6B7280",
    selectedColor: "#4A90E2",
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

  methods: {
    switchTab(e) {
      const data = e.currentTarget.dataset
      const url = data.path
      const index = data.index
      
      wx.switchTab({
        url,
        success: () => {
          this.setData({
            selectedIndex: index
          })
          this.updateTabBarState()
        }
      })
    },

    updateTabBarState() {
      const page = getCurrentPages().pop()
      if (!page) return
      
      const route = page.route
      const index = this.data.list.findIndex(item => 
        item.pagePath === `/${route}`
      )
      
      if (index !== -1) {
        const list = this.data.list.map((item, i) => ({
          ...item,
          active: i === index
        }))
        
        this.setData({
          selectedIndex: index,
          list
        })
      }
    }
  }
}) 