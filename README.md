# 智能学霸小助手 (Smart Scholar Assistant)

[![微信小程序](https://img.shields.io/badge/微信-小程序-brightgreen)](https://developers.weixin.qq.com/miniprogram/dev/)
[![云开发](https://img.shields.io/badge/云开发-enabled-blue)](https://developers.weixin.qq.com/miniprogram/dev/wxcloud/basis/getting-started.html)
[![AI驱动](https://img.shields.io/badge/AI-驱动-orange)](https://ai.baidu.com/)
[![状态管理](https://img.shields.io/badge/状态管理-MobX-purple)](https://github.com/mobxjs/mobx)
[![UI组件](https://img.shields.io/badge/UI组件-Vant%20Weapp-red)](https://vant-contrib.gitee.io/vant-weapp/)

## 📱 项目简介

**智能学霸小助手**是一款专为小学生设计的AI学习辅助微信小程序，通过先进的人工智能技术解决学生在错题整理、专项训练和学习管理方面的痛点。项目采用微信小程序云开发架构，集成OCR识别、AI题目生成、智能批改等核心功能。

## 🎯 核心功能特性

### 📚 智能错题管理系统
- **📸 拍照录题与OCR识别**：支持拍照自动识别题目内容，智能提取文字
- **✏️ 手动录入功能**：支持手动添加错题，灵活补充学习内容
- **🏷️ 智能分类管理**：按学科、难度、状态自动分类整理
- **📊 学习统计分析**：实时统计错题数量、掌握率、复习进度

### 🧠 AI智能练习系统
- **⚙️ 个性化练习配置**：自定义学科、知识点、难度、题量
- **🤖 AI题目生成**：基于错题智能生成变式练习题
- **📝 在线答题与批改**：实时答题，AI智能批改反馈
- **📈 成绩记录与分析**：完整的练习记录和成绩趋势分析

### 📅 智能课程表管理
- **⏰ 课程信息管理**：添加、编辑、删除课程安排
- **🔔 智能提醒系统**：课程提醒、作业提醒
- **📝 课堂笔记功能**：记录重点内容，便于复习
- **📊 学习进度跟踪**：可视化展示学习进度

### 🔄 科学复习提醒
- **🧮 艾宾浩斯遗忘曲线**：基于科学记忆曲线安排复习
- **🎯 个性化复习计划**：智能推送每日复习任务
- **📤 复习状态管理**：追踪错题复习状态和掌握程度

### 👤 用户中心与设置
- **📊 学习报告分析**：详细的学习数据分析和建议
- **⚙️ 个性化设置**：学习偏好、提醒设置、难度调节
- **🏆 成就激励系统**：学习徽章、等级系统、积分奖励

## 🛠️ 技术架构

### 前端技术栈
- **框架**: 微信小程序原生开发
- **状态管理**: [MobX](https://github.com/mobxjs/mobx) - 响应式状态管理
- **UI组件库**: [Vant Weapp](https://vant-contrib.gitee.io/vant-weapp/) - 高质量UI组件库
- **图标资源**: FontAwesome 6.4.0
- **工具库**: ES6+、Promise、async/await

### 后端技术栈
- **云开发**: 微信小程序云开发
- **数据库**: 云数据库 (MongoDB-like)
- **云函数**: Node.js serverless
- **云存储**: 微信云存储服务

### AI服务集成
- **OCR识别**: 百度OCR API / 腾讯云OCR API
- **AI题目生成**: 百度文心一言 / OpenAI GPT API
- **智能批改**: 自研智能批改算法 + AI辅助

## 📁 项目结构

```
smart1.0/
├── app.js                          # 应用入口文件
├── app.json                        # 应用配置文件
├── app.wxss                        # 全局样式文件
├── sitemap.json                    # 站点地图配置
├── project.config.json             # 项目配置文件
├── project.private.config.json     # 私有配置文件
├── package.json                    # 依赖配置
├── package-lock.json               # 依赖锁定文件
│
├── pages/                          # 页面目录
│   ├── login/                      # 登录页面
│   ├── home/                       # 首页
│   ├── mistakes/                   # 错题本页面
│   │   ├── mistakes.*              # 错题列表
│   │   ├── add.*                   # 添加错题
│   │   └── detail.*                # 错题详情
│   ├── practice/                   # 练习页面
│   │   ├── practice.*              # 练习首页
│   │   ├── config.*                # 练习配置
│   │   ├── session.*               # 练习会话
│   │   └── result.*                # 练习结果
│   ├── schedule/                   # 课程表页面
│   │   ├── schedule.*              # 课程表列表
│   │   ├── add.*                   # 添加课程
│   │   └── detail.*                # 课程详情
│   ├── profile/                    # 个人中心
│   ├── settings/                   # 设置页面
│   ├── review/                     # 复习页面
│   ├── report/                     # 学习报告
│   ├── camera/                     # 拍照识别
│   └── feedback/                   # 反馈页面
│
├── cloud/                          # 云函数目录
│   └── functions/
│       ├── ai-grading/             # AI智能批改云函数
│       ├── ai-question-generator/  # AI题目生成云函数
│       ├── ocr-recognition/        # OCR识别云函数
│       └── login/                  # 登录云函数
│
├── components/                     # 自定义组件
│   ├── section-header/             # 章节头部组件
│   ├── stats-grid/                 # 统计网格组件
│   └── v0-button/                  # 自定义按钮组件
│
├── custom-tab-bar/                 # 自定义底部导航
│
├── utils/                          # 工具类
│   ├── ai-service.js               # AI服务集成
│   ├── auth.js                     # 身份认证
│   ├── database.js                 # 数据库操作
│   ├── local-db.js                 # 本地数据存储
│   ├── image-processor.js          # 图片处理
│   ├── cache-manager.js            # 缓存管理
│   ├── concurrent-processor.js     # 并发处理
│   ├── performance-monitor.js      # 性能监控
│   ├── constants.js                # 常量定义
│   └── util.js                     # 通用工具
│
├── store/                          # 状态管理
│   └── index.js                    # MobX状态存储
│
├── images/                         # 图片资源
│   ├── icons/                      # 图标资源
│   ├── tab/                        # 底部导航图标
│   └── *.png/svg                   # 其他图片资源
│
├── styles/                         # 样式文件
├── scripts/                        # 脚本文件
└── miniprogram_npm/                # npm包构建目录
```

## 🚀 快速开始

### 环境要求
- **Node.js**: ≥ 16.0.0
- **微信开发者工具**: 最新稳定版
- **微信小程序账号**: 已注册并开通云开发

### 安装步骤

1. **克隆项目**
```bash
git clone https://github.com/wangliang1234567890/smart-scholar-assistant.git
cd smart-scholar-assistant
```

2. **安装依赖**
```bash
npm install
```

3. **配置云开发**
```bash
# 在微信开发者工具中
# 1. 打开项目
# 2. 点击"云开发"按钮
# 3. 创建云环境（如果没有）
# 4. 获取环境ID配置到项目中
```

4. **构建npm包**
```bash
# 在微信开发者工具中
# 工具 -> 构建npm
```

5. **部署云函数**
```bash
# 在微信开发者工具中
# 右键云函数目录 -> 创建并部署：云端安装依赖
```

6. **配置AI服务** (可选)
```bash
# 在云函数环境变量中配置
BAIDU_API_KEY=your_baidu_api_key
BAIDU_SECRET_KEY=your_baidu_secret_key
WENXIN_API_KEY=your_wenxin_api_key
WENXIN_SECRET_KEY=your_wenxin_secret_key
```

### 开发调试

1. **本地开发**
```bash
# 使用微信开发者工具打开项目
# 选择项目目录：smart-scholar-assistant
# AppID：wxa69518e6c8e2a20b
```

2. **真机预览**
```bash
# 在开发者工具中点击"预览"
# 使用微信扫码在真机上测试
```

3. **云函数调试**
```bash
# 在云开发控制台中查看云函数日志
# 使用本地调试功能测试云函数
```

## 📊 功能模块详解

### 1. 错题管理模块
- **数据模型**: `utils/database.js` - 错题CRUD操作
- **页面组件**: `pages/mistakes/` - 错题列表、详情、添加
- **本地存储**: `utils/local-db.js` - 离线数据支持

### 2. AI服务模块
- **OCR识别**: `cloud/functions/ocr-recognition/` - 图片文字识别
- **题目生成**: `cloud/functions/ai-question-generator/` - 智能题目生成
- **智能批改**: `cloud/functions/ai-grading/` - 答案批改分析

### 3. 练习系统
- **配置页面**: `pages/practice/config.js` - 练习参数设置
- **答题页面**: `pages/practice/session.js` - 在线答题界面
- **结果分析**: `pages/practice/result.js` - 成绩统计分析

### 4. 用户系统
- **身份认证**: `utils/auth.js` - 微信登录集成
- **状态管理**: `store/index.js` - MobX全局状态
- **数据同步**: 云数据库实时同步

## 🔧 开发配置

### 环境变量配置
```javascript
// 在云函数中配置环境变量
{
  "OCR_PROVIDER": "baidu",           // OCR服务提供商
  "AI_PROVIDER": "wenxin",           // AI服务提供商
  "BAIDU_API_KEY": "your_key",       // 百度API密钥
  "BAIDU_SECRET_KEY": "your_secret", // 百度API密钥
  "WENXIN_API_KEY": "your_key",      // 文心一言API密钥
  "WENXIN_SECRET_KEY": "your_secret" // 文心一言API密钥
}
```

### 云数据库集合结构
```javascript
// 用户集合 (users)
{
  _id: "user_id",
  openid: "wx_openid", 
  nickName: "用户昵称",
  avatarUrl: "头像URL",
  grade: 1,                    // 年级
  subjects: ["数学", "语文"],   // 学科
  level: 5,                    // 等级
  exp: 450,                    // 经验值
  totalMistakes: 128,          // 总错题数
  masteredCount: 45,           // 已掌握数
  settings: {...}              // 个人设置
}

// 错题集合 (mistakes)
{
  _id: "mistake_id",
  userId: "user_id",
  subject: "数学",             // 学科
  difficulty: 3,               // 难度(1-5)
  question: "题目内容",
  answer: "正确答案", 
  userAnswer: "用户答案",
  explanation: "解析",
  images: ["图片URL"],         // 题目图片
  status: "unknown",           // unknown/learning/mastered
  reviewCount: 0,              // 复习次数
  nextReviewTime: Date,        // 下次复习时间
  createTime: Date
}

// 练习记录集合 (practice_records)
{
  _id: "record_id",
  userId: "user_id",
  subject: "数学",
  difficulty: 3,
  totalQuestions: 10,          // 题目总数
  correctAnswers: 8,           // 正确数量
  score: 80,                   // 得分
  duration: 300,               // 用时(秒)
  questions: [...],            // 题目详情
  userAnswers: [...],          // 用户答案
  createTime: Date
}
```

## 📈 性能优化

### 1. 数据缓存策略
- **本地缓存**: `utils/cache-manager.js` - 智能缓存管理
- **云端同步**: 增量数据同步，减少网络请求
- **图片优化**: `utils/image-processor.js` - 自动压缩和格式转换

### 2. 并发处理优化
- **请求限制**: `utils/concurrent-processor.js` - 并发请求控制
- **任务队列**: 异步任务排队处理
- **错误重试**: 智能重试机制

### 3. 性能监控
- **实时监控**: `utils/performance-monitor.js` - 性能数据收集
- **用户行为**: 操作埋点和分析
- **错误追踪**: 自动错误收集和上报

## 🧪 测试与部署

### 开发测试
```bash
# 开发环境测试
npm run dev

# 代码检查
npm run lint
npm run lint:fix

# 功能测试
# 在微信开发者工具中进行真机调试
```

### 生产部署
```bash
# 构建生产版本
npm run build

# 上传代码
# 在微信开发者工具中点击"上传"
# 在微信公众平台提交审核

# 云函数部署
# 右键云函数 -> 上传并部署
```

## 📋 开发计划

### 已完成功能 ✅
- [x] 微信小程序基础框架搭建
- [x] 用户登录和身份认证系统
- [x] 错题管理完整功能（CRUD）
- [x] AI智能练习配置和答题系统
- [x] 课程表管理功能
- [x] OCR图片识别集成
- [x] AI题目生成云函数
- [x] 智能批改系统
- [x] 本地数据存储和云端同步
- [x] 性能监控和优化
- [x] 状态管理（MobX）集成
- [x] UI组件库（Vant Weapp）集成

### 开发中功能 🚧
- [ ] 错题复习提醒完善
- [ ] 学习报告生成优化
- [ ] AI服务稳定性提升
- [ ] 更多学科和题型支持

### 计划功能 📅
- [ ] 离线模式支持
- [ ] 语音识别功能
- [ ] 家长监控功能
- [ ] 学习社区功能
- [ ] 数据导出功能

## 🎨 设计规范

### UI设计原则
- **简洁明了**: 适合小学生使用的简洁界面
- **色彩友好**: 护眼配色，减少视觉疲劳
- **交互自然**: 符合微信小程序交互规范
- **响应迅速**: 优化加载速度和响应时间

### 开发规范
- **代码规范**: ESLint + Prettier代码格式化
- **组件化**: 可复用组件开发
- **模块化**: 功能模块清晰分离
- **文档化**: 完整的代码注释和文档

## 🤝 贡献指南

我们欢迎任何形式的贡献！

### 贡献方式
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
- 🧪 测试用例添加

### 开发规范
- 遵循现有代码风格
- 添加必要的注释和文档
- 提交前运行代码检查
- 确保功能完整性测试

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 📞 联系我们

- **🌐 项目主页**: [GitHub仓库](https://github.com/wangliang1234567890/smart-scholar-assistant)
- **📧 问题反馈**: [Issues](https://github.com/wangliang1234567890/smart-scholar-assistant/issues)
- **📱 小程序体验**: 使用微信扫描小程序码体验

## 🙏 致谢

感谢以下开源项目和服务：

- [微信小程序官方文档](https://developers.weixin.qq.com/miniprogram/dev/) - 小程序开发框架
- [MobX](https://github.com/mobxjs/mobx) - 状态管理库
- [Vant Weapp](https://vant-contrib.gitee.io/vant-weapp/) - UI组件库
- [百度AI开放平台](https://ai.baidu.com/) - AI服务支持
- [腾讯云](https://cloud.tencent.com/) - 云服务支持

## 📊 项目统计

- **📁 文件数量**: 100+ 源代码文件
- **💻 代码行数**: 15,000+ 行代码
- **🔧 云函数**: 4个核心云函数
- **📱 页面数量**: 17个功能页面
- **🎨 组件数量**: 20+ 自定义组件
- **📦 依赖包**: 基础依赖 + AI服务集成

---

⭐ **如果这个项目对您有帮助，请给个Star支持一下！您的支持是我们持续改进的动力！** ⭐