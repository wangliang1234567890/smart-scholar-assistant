@echo off
echo 正在部署智能学霸小助手云函数...

echo.
echo ========================
echo 部署 AI题目生成云函数
echo ========================
cd cloud/functions/ai-question-generator
call npm install
echo AI题目生成云函数依赖安装完成

cd ../../../

echo.
echo ========================
echo 部署完成提示
echo ========================
echo 请在微信开发者工具中：
echo 1. 打开云开发控制台
echo 2. 选择云函数选项卡  
echo 3. 右键点击 ai-question-generator 函数
echo 4. 选择 "云端安装依赖" 或 "上传并部署"
echo 5. 等待部署完成

echo.
echo 部署脚本执行完毕！
pause 