#!/bin/bash
echo "🚀 开始上传智能学霸小助手到GitHub..."

# 检查Git是否安装
if ! command -v git &> /dev/null; then
    echo "❌ 请先安装Git: https://git-scm.com/"
    exit 1
fi

# 初始化并上传
git init
git add .
git commit -m "🎉 智能学霸小助手 v1.0 - AI图片识别与错题管理"
git branch -M main
git remote add origin https://github.com/wangliang1234567890/smart-scholar-assistant.git
git push -u origin main

echo "✅ 上传完成！"