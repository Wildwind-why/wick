@echo off
chcp 65001 >nul
title wick 2.1 - LAN
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
echo 局域网演示模式：终端会打印一个两台设备都能打开的地址。
echo 手机和电脑要连同一个 Wi-Fi。局域网 HTTP 是明文演示，请使用虚构数据。
echo.
node tools\serve.cjs --lan --open
if errorlevel 1 (
  echo.
  echo 启动失败，请把上面的错误文字发给项目负责人。
  echo Startup failed. Share the error above with the project owner.
)
pause
