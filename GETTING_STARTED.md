# 智能学霸小助手 - 快速开始指南

## 📋 开发环境要求

### 必备工具
1. **微信开发者工具** v1.06.0 或更高版本
   - 下载地址：https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html
2. **Node.js** v16.0.0 或更高版本
3. **Git** 用于版本控制

### 开发账号
1. 微信小程序开发账号
2. 微信云开发环境（需要开通）

## 🚀 快速启动

### 1. 项目设置
```bash
# 1. 克隆项目（如果使用Git）
git clone [repository-url]
cd smart-study-assistant

# 2. 安装依赖
npm install
```

### 2. 配置微信开发者工具
1. 打开微信开发者工具
2. 选择"导入项目"
3. 选择项目目录
4. 填写小程序AppID（在 `project.config.json` 中修改）
5. 项目名称：智能学霸小助手

### 3. 云开发配置
1. 在微信开发者工具中点击"云开发"
2. 开通云开发服务
3. 创建环境（建议创建开发环境和生产环境）
4. 复制环境ID，更新以下文件：
   - `app.js` 中的环境ID
   - `utils/constants.js` 中的云开发配置

### 4. 部署云函数
```bash
# 在微信开发者工具中
# 1. 右键 cloud/functions/login 文件夹
# 2. 选择"上传并部署：云端安装依赖"
```

### 5. 初始化数据库
在云开发控制台中创建以下集合：
- `users` - 用户信息
- `mistakes` - 错题记录
- `practice_records` - 练习记录
- `courses` - 课程安排
- `review_records` - 复习记录

## 📝 开发流程

### 1. 开发分支管理
```bash
# 创建功能分支
git checkout -b feature/错题本功能

# 开发完成后
git add .
git commit -m "feat: 实现错题本基础功能"
git push origin feature/错题本功能
```

### 2. 代码规范
- 遵循项目中的 `代码规范.md` 文件
- 使用 ESLint 进行代码检查
- 提交前确保代码格式正确

### 3. 测试流程
1. 在微信开发者工具中预览和调试
2. 真机测试（扫码预览）
3. 确保所有功能正常工作

## 🛠️ 常用开发命令

### NPM Scripts
```bash
# 开发模式（实际开发在微信开发者工具中进行）
npm run dev

# 代码检查
npm run lint

# 修复代码格式
npm run lint:fix
```

### 微信开发者工具操作
1. **编译预览**：Ctrl+Shift+E
2. **真机调试**：点击"预览"按钮
3. **上传代码**：点击"上传"按钮
4. **调试控制台**：F12 或点击调试器

## 📁 项目结构说明

```
smart-study-assistant/
├── app.js                 # 应用入口，全局配置
├── app.json              # 应用配置，页面路由
├── app.wxss              # 全局样式，CSS变量
├── pages/                # 页面目录
│   ├── home/            # 首页
│   ├── mistakes/        # 错题本（待开发）
│   ├── camera/          # 拍照录题（待开发）
│   ├── practice/        # AI练习（待开发）
│   ├── schedule/        # 课程表（待开发）
│   └── profile/         # 个人中心（待开发）
├── components/           # 自定义组件（待创建）
├── utils/               # 工具类
│   ├── database.js      # 数据库操作
│   ├── auth.js          # 用户认证
│   └── constants.js     # 常量定义
├── cloud/               # 云开发
│   └── functions/       # 云函数
│       └── login/       # 登录函数
├── images/              # 图片资源（待添加）
└── styles/              # 样式文件（待创建）
```

## 🔧 开发技巧

### 1. 调试技巧
- 使用 `console.log()` 进行调试
- 善用微信开发者工具的调试器
- 检查网络请求和响应
- 使用云开发控制台查看数据

### 2. 性能优化
- 图片使用适当尺寸和格式
- 避免频繁的数据库查询
- 使用缓存机制
- 合理使用组件化

### 3. 常见问题
1. **云函数调用失败**：检查环境ID和权限配置
2. **样式不生效**：检查CSS变量是否正确引用
3. **数据库操作失败**：检查集合权限和字段类型
4. **页面跳转异常**：检查路由配置和参数传递

## 📖 相关文档

- [微信小程序官方文档](https://developers.weixin.qq.com/miniprogram/dev/framework/)
- [微信云开发文档](https://developers.weixin.qq.com/miniprogram/dev/wxcloud/basis/getting-started.html)
- [Vant Weapp 组件库](https://vant-contrib.gitee.io/vant-weapp/#/home)
- [项目开发周期计划](./开发周期计划.md)
- [详细开发指南](./详细开发指南.md)
- [代码规范](./代码规范.md)

## 🆘 获取帮助

如果在开发过程中遇到问题：
1. 查看微信开发者工具的控制台错误信息
2. 检查云开发控制台的日志
3. 参考项目文档和代码注释
4. 联系开发团队获取支持

---

**开发愉快！** 🎉 