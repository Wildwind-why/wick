# wick 2.1 · 交接与验收

源码仍在旧目录名 wick-2.0，应用与提交包版本为 2.1。勿交旧 zip 或旧线上镜像。

运行：node tools/serve.cjs → http://localhost:8127/?lang=zh。Windows 可用两个启动器，LAN 版本显式使用 --lan。

## 当前状态

v2 UTF-8 保留完整原文；eco 不删字段；修正每分钟待机 60 倍低估、封装重复计算、预算不刷新。队列支持紧急优先、多批、中断重试、确认后归档；模拟与真实回执分开。可选 Node 中继实际传输。SW wick-v2.1 缓存 44 项应用资源，API 不缓存。

四套测试：58 + 25 + 7 + 25 = 115。tools/run-tests.cjs 自动运行测试、端到端流程和截图；run-tests.js 兼容转发到新入口。Playwright 是开发工具，应用无需安装包；可设置 BROWSER_PATH 指定浏览器。

本机开发依赖可用 PowerShell 设置（其他机器请使用自己的 Playwright 安装或手动打开四个测试页）：

```powershell
$env:NODE_PATH="$env:USERPROFILE\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules"
node tools/run-tests.cjs
```

验证覆盖：完整文本、超长拒绝、位置/时间、能耗公式、字段占用、跨批、优先级、并发、部分 ACK、中断恢复、存储失败；浏览器断网、IDB、双会话、无接收端、API 不缓存及窄屏布局。

尚未验证：两台物理设备与各种手机浏览器、LoRa/BLE、真实低电量功耗。LAN 中继无生产认证或加密；不应宣传为可部署救援系统。旧损坏消息无法恢复原文。

## 维护顺序

1. 修改源码与相关回归用例；客户端模块更新时同步 sw.js。
2. python tools/build-budget-data.py
3. node tools/run-tests.cjs
4. python tools/pack.py 2.1-final
5. 在新目录解压抽查启动，更新外层上传清单的大小和 SHA-256。

不要引用历史日志中的续航和提升倍数。初版备份保留在项目外的评审资料/wick-2.0-before-fixes.zip。

