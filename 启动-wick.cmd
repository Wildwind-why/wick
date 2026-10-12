@echo off
chcp 65001 >nul
title wick 2.1
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo [缺少 Node.js] 没有找到 node 命令。
  echo 请到 https://nodejs.org/zh-cn/download 安装 LTS 版本，然后重新双击本文件。
  echo.
  echo [Node.js not found] Install the LTS build, then run this file again.
  echo.
  pause
  exit /b 1
)

echo.
echo 正在启动 wick 2.1，启动成功后会自动打开浏览器。
echo 请保持本窗口开着；手动地址：http://127.0.0.1:8127/?lang=zh
echo.
node tools\serve.cjs --open
if errorlevel 1 (
  echo.
  echo 启动失败，请把上面的错误文字发给项目负责人。
  echo Startup failed. Share the error above with the project owner.
)
pause
