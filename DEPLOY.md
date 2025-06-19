# 🚀 部署指南 - 同步到GitHub

## 📋 前置准备

1. **安装Git**
   ```bash
   # Windows: 下载并安装 https://git-scm.com/
   # macOS: 使用Homebrew
   brew install git
   
   # Ubuntu/Debian
   sudo apt install git
   ```

2. **配置Git用户信息**
   ```bash
   git config --global user.name "你的用户名"
   git config --global user.email "你的邮箱@example.com"
   ```

3. **创建GitHub仓库**
   - 登录 [GitHub](https://github.com/)
   - 点击右上角 "+" → "New repository"
   - 仓库名建议：`smart-scholar-assistant`
   - 设为Public（用于GitHub Pages）
   - **不要**勾选 "Add a README file"
   - 点击 "Create repository"

## 🔧 本地Git初始化

在项目根目录执行以下命令：

```bash
# 1. 初始化Git仓库
git init

# 2. 添加所有文件到暂存区
git add .

# 3. 创建首次提交
git commit -m "🎉 Initial commit: 智能学霸小助手高保真原型"

# 4. 设置主分支名为main
git branch -M main

# 5. 添加远程仓库（替换为你的GitHub用户名）
git remote add origin https://github.com/你的用户名/smart-scholar-assistant.git

# 6. 推送到GitHub
git push -u origin main
```

## 🌐 启用GitHub Pages

1. **进入仓库设置**
   - 在GitHub仓库页面点击 "Settings"
   - 在左侧菜单找到 "Pages"

2. **配置Pages**
   - Source: Deploy from a branch
   - Branch: main
   - Folder: / (root)
   - 点击 "Save"

3. **访问网站**
   - 等待2-5分钟构建完成
   - 访问：`https://你的用户名.github.io/smart-scholar-assistant/`

## 📝 后续更新流程

当你修改了代码后，使用以下命令同步：

```bash
# 1. 查看文件状态
git status

# 2. 添加修改的文件
git add .
# 或者添加特定文件
git add 文件名.html

# 3. 提交修改
git commit -m "✨ 添加新功能: 描述你的修改"

# 4. 推送到GitHub
git push origin main
```

## 🏷️ 提交信息规范

使用以下前缀让提交历史更清晰：

- `🎉` `:tada:` - 初始提交
- `✨` `:sparkles:` - 新功能
- `🐛` `:bug:` - Bug修复
- `📝` `:memo:` - 文档更新
- `💄` `:lipstick:` - UI/样式更新
- `♻️` `:recycle:` - 重构代码
- `⚡` `:zap:` - 性能优化
- `🔧` `:wrench:` - 配置文件修改

示例：
```bash
git commit -m "✨ 添加错题详情页面交互功能"
git commit -m "💄 优化首页布局和色彩搭配"
git commit -m "📝 更新README使用说明"
```

## 🔍 常用Git命令

```bash
# 查看仓库状态
git status

# 查看提交历史
git log --oneline

# 查看远程仓库信息
git remote -v

# 拉取最新代码
git pull origin main

# 查看文件差异
git diff

# 撤销工作区修改
git checkout -- 文件名

# 撤销暂存区文件
git reset HEAD 文件名

# 查看分支
git branch -a

# 创建并切换分支
git checkout -b 新分支名
```

## 🚨 故障排除

### 问题1：推送失败 (403错误)
```bash
# 解决方案：使用个人访问令牌
# 1. GitHub Settings → Developer settings → Personal access tokens
# 2. 生成新token，勾选repo权限
# 3. 使用token作为密码推送
```

### 问题2：SSL证书错误
```bash
# 临时解决（不推荐生产环境）
git config --global http.sslVerify false
```

### 问题3：文件过大
```bash
# 查看大文件
git ls-tree -r -t -l --full-name HEAD | sort -n -k 4

# 从历史中移除大文件
git filter-branch --force --index-filter 'git rm --cached --ignore-unmatch 大文件路径' --prune-empty --tag-name-filter cat -- --all
```

### 问题4：中文文件名乱码
```bash
git config --global core.quotepath false
```

## 📊 项目管理建议

### 分支管理策略
```bash
# 主分支：稳定版本
main

# 开发分支：新功能开发
git checkout -b feature/新功能名

# 修复分支：Bug修复
git checkout -b hotfix/bug描述

# 完成后合并到main
git checkout main
git merge feature/新功能名
git branch -d feature/新功能名
```

### 版本标签
```bash
# 创建版本标签
git tag -a v1.0.0 -m "版本 1.0.0: 初始原型完成"

# 推送标签
git push origin v1.0.0

# 查看所有标签
git tag -l
```

## 🎯 自动化部署

### GitHub Actions (可选)
创建 `.github/workflows/deploy.yml`：

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v2
    
    - name: Deploy to GitHub Pages
      uses: peaceiris/actions-gh-pages@v3
      with:
        github_token: ${{ secrets.GITHUB_TOKEN }}
        publish_dir: ./
```

## 📞 获取帮助

- **Git官方文档**: https://git-scm.com/doc
- **GitHub帮助**: https://docs.github.com/
- **GitHub Pages**: https://pages.github.com/

---

🎉 **恭喜！** 现在你的智能学霸小助手原型已经部署到GitHub，可以通过网址分享给其他人查看了！ 