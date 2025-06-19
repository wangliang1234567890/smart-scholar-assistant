# 智能学霸小助手 (Smart Scholar Assistant)

[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-Live%20Demo-blue)](https://your-username.github.io/smart-scholar-assistant/)
[![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/HTML)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=flat&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)

## 📱 项目简介

AI 赋能的小学智能学习辅助小程序高保真原型，专为小学生及其家长设计。通过先进的人工智能技术，解决小学阶段学生在错题整理、专项训练上的痛点，并提供便捷的课外培训班日程管理功能。

## 🎯 核心功能

### 📚 智能错题本与AI精练
- **📸 错题快速录入与智能识别**：拍照录入、OCR识别、自动分类
- **🧠 AI专项训练题目生成**：基于错题智能生成变式练习题
- **📝 在线作答与智能批改**：即时反馈，自动收录再错题目
- **🖨️ AI题目/试卷智能排版与打印**：一键生成标准试卷格式

### 📅 智能课表与日程管理
- **⏰ 课程信息便捷录入**：支持周期性设置、自定义标签
- **🔔 微信服务通知智能提醒**：多维度提醒时间设置
- **🗒️ 课后笔记与作业管理**：记录重点、作业跟踪

### 🔄 智能复习提醒（基于记忆曲线）
- **🧮 艾宾浩斯遗忘曲线算法**：科学计算最佳复习时间
- **📤 每日错题复习任务推送**：个性化复习计划
- **🎯 专属复习模式**：智能筛选待复习题目

### 🏆 激励与趣味化设计
- **🎖️ 成就系统**：积分奖励、虚拟勋章、等级晋升
- **✨ 虚拟奖励**：积分兑换、主题装饰
- **📊 学习进度可视化**：趣味化图表展示

## 🚀 在线预览

[🔗 点击查看在线演示](https://your-username.github.io/smart-scholar-assistant/)

## 📱 原型页面

### 主要界面（8个）
1. **🏠 首页** - 学习概览和今日任务
2. **📚 错题本** - 错题管理和分类筛选
3. **📸 拍照录题** - 相机界面和OCR识别
4. **🧠 AI练习** - 智能题目生成和在线答题
5. **📅 课程表** - 课程安排和日程管理
6. **🔄 智能复习** - 基于遗忘曲线的复习计划
7. **📊 学习报告** - 数据分析和AI学习建议
8. **👤 个人中心** - 用户信息和设置管理

### 分支界面（5个）
1. **📖 错题详情** - 详细解析和知识点说明
2. **🔍 识别结果** - OCR识别后的内容编辑
3. **📝 课程详情** - 课程信息和历史记录
4. **🏆 我的成就** - 勋章展示和激励系统
5. **⚙️ 设置页面** - 应用设置和偏好配置

## 🛠️ 技术栈

- **前端框架**: HTML5 + CSS3 + JavaScript (ES6+)
- **UI框架**: [Tailwind CSS](https://tailwindcss.com/) - 快速构建现代化界面
- **图标库**: [FontAwesome 6.4.0](https://fontawesome.com/) - 丰富的图标资源
- **设备适配**: iPhone 15 Pro (393px × 852px) 尺寸优化
- **交互设计**: 原生JavaScript实现页面跳转和动画效果

## 🎨 设计特色

- **🍎 iOS原生风格**: 真实状态栏、圆角设计、毛玻璃效果
- **🎯 儿童友好界面**: 清新配色、简洁布局、易于理解
- **⚡ 流畅交互体验**: 平滑动画、即时反馈、hover效果
- **📱 高保真原型**: 商业级视觉质量，可直接用于开发参考

## 🚀 快速开始

### 本地运行

1. **克隆仓库**
```bash
git clone https://github.com/your-username/smart-scholar-assistant.git
cd smart-scholar-assistant
```

2. **启动本地服务器**
```bash
# 使用Python
python -m http.server 8000

# 使用Node.js
npx http-server

# 使用Live Server (VS Code扩展)
# 右键 index.html -> Open with Live Server
```

3. **打开浏览器**
```
http://localhost:8000
```

### GitHub Pages 部署

1. Fork 这个仓库
2. 进入仓库设置 Settings > Pages
3. 选择 Source: Deploy from a branch
4. 选择 Branch: main / (root)
5. 保存后等待几分钟即可通过 `https://your-username.github.io/smart-scholar-assistant/` 访问

## 📱 使用指南

### 体验完整流程

1. **错题录入流程**
   - 首页 → 点击"拍照录题" → 拍照 → 查看识别结果 → 保存到错题本

2. **错题练习流程**
   - 错题本 → 选择错题 → 查看详情 → 生成AI练习 → 完成练习

3. **课程管理流程**
   - 课程表 → 点击课程 → 查看详情 → 设置提醒/记笔记

4. **成就查看流程**
   - 个人中心 → 我的成就 → 查看勋章和进度

### 交互功能

- **🔄 页面跳转**: 点击按钮可在不同页面间跳转
- **✨ 视觉反馈**: 跳转时有高亮动画和平滑滚动
- **📱 模拟交互**: 拍照、数据提交、设置切换等真实反馈

## 📁 项目结构

```
smart-scholar-assistant/
├── index.html              # 主入口页面（展示所有原型）
├── home.html               # 首页
├── mistakes.html           # 错题本
├── camera.html             # 拍照录题
├── ai-practice.html        # AI练习
├── schedule.html           # 课程表
├── review.html             # 智能复习
├── report.html             # 学习报告
├── profile.html            # 个人中心
├── mistake-detail.html     # 错题详情
├── camera-result.html      # 识别结果
├── course-detail.html      # 课程详情
├── achievements.html       # 我的成就
├── settings.html           # 设置页面
├── README.md               # 项目说明
└── .gitignore             # Git忽略文件
```

## 🎯 产品特点

### 解决的核心问题

- **📝 错题整理效率低下**: 传统纸质错题本 → AI智能错题管理
- **🎯 缺乏个性化练习**: 通用题目 → AI生成变式题目
- **🧠 学习内容易遗忘**: 无复习机制 → 科学记忆曲线复习
- **📅 培训班日程混乱**: 手动管理 → 智能提醒和日程管理
- **👨‍👩‍👧‍👦 家长辅导压力大**: 难以跟踪进度 → 详细学习报告和数据分析

### 目标用户

- **🧒 小学生**: 1-6年级学生，需要学习辅助和错题管理
- **👨‍👩‍👧‍👦 家长**: 关注孩子学习进度，希望科学辅导
- **👨‍🏫 教师**: 需要了解学生学习情况，个性化教学

## 🔧 开发计划

### MVP阶段
- [x] 高保真原型设计
- [x] 核心页面交互逻辑
- [x] 用户界面设计规范
- [ ] 后端API设计
- [ ] 微信小程序框架搭建

### 功能迭代
- [ ] OCR识别接口集成
- [ ] AI题目生成算法
- [ ] 用户数据存储
- [ ] 微信服务通知
- [ ] 学习数据分析

### 技术优化
- [ ] 性能优化
- [ ] 离线功能支持
- [ ] 数据同步机制
- [ ] 安全性增强

## 🤝 贡献指南

我们欢迎任何形式的贡献！

1. **🍴 Fork 项目**
2. **🌟 创建特性分支** (`git checkout -b feature/AmazingFeature`)
3. **💾 提交更改** (`git commit -m 'Add some AmazingFeature'`)
4. **📤 推送到分支** (`git push origin feature/AmazingFeature`)
5. **🔄 创建 Pull Request**

### 贡献类型
- 🐛 Bug修复
- ✨ 新功能开发
- 📝 文档改进
- 🎨 UI/UX优化
- 🚀 性能优化

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 📞 联系我们

- **项目链接**: [https://github.com/your-username/smart-scholar-assistant](https://github.com/your-username/smart-scholar-assistant)
- **在线演示**: [https://your-username.github.io/smart-scholar-assistant/](https://your-username.github.io/smart-scholar-assistant/)
- **问题反馈**: [Issues](https://github.com/your-username/smart-scholar-assistant/issues)

## 🙏 致谢

- [Tailwind CSS](https://tailwindcss.com/) - 优秀的CSS框架
- [FontAwesome](https://fontawesome.com/) - 丰富的图标库
- [Unsplash](https://unsplash.com/) - 提供的免费图片资源

---

⭐ 如果这个项目对您有帮助，请给个Star支持一下！