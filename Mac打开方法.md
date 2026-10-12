# Mac 打开 wick

Safari 显示“无法连接 localhost”表示浏览器没有连上本机服务，单凭这一页不能确定是 Node 未安装、启动命令失败、终端已关闭还是地址问题。

## 推荐步骤

1. 完整解压压缩包，进入 wick-2.1 文件夹。
2. 从 https://nodejs.org/zh-cn/download 安装 macOS 的 Node.js LTS 版本。已有合适版本可跳过。
3. 双击 **start-mac.command**。它自动进入正确文件夹，检查 Node，启动成功后再打开浏览器。
4. 保持终端窗口开启。手动访问地址为 **http://127.0.0.1:8127/?lang=zh**。

如果双击提示执行权限不足，打开“终端”，输入 `bash` 加一个空格，把 **start-mac.command 文件本身**拖进终端，再回车。脚本会自行进入项目文件夹，无需另外输入 cd。

## 已经拿到旧包，也可直接操作

在终端输入 `cd` 加一个空格，把包含 index.html 和 tools 的解压文件夹拖进终端，回车。然后逐行执行：

```sh
node -v
node tools/serve.cjs
```

出现 wick 2.1 和地址后，再访问 http://127.0.0.1:8127/?lang=zh。终端要保持开启；服务器运行时命令不会立即结束，这是正常状态。

## 常见输出

| 终端显示 | 含义和处理 |
| --- | --- |
| command not found: node | 没安装 Node 或 PATH 尚未生效；安装后重新打开终端 |
| Cannot find module .../tools/serve.cjs | 进入的文件夹不对；使用新启动脚本或重新 cd 到项目根目录 |
| EADDRINUSE | 8127 被占用；若已有 wick 运行，直接打开地址。也可用下面的命令选择其他端口 |
| wick 2.1: http://127.0.0.1:8127/?lang=zh | 服务已监听；保持窗口，打开显示的完整 http 地址 |

换端口（在项目目录运行）：

```sh
PORT=8128 node tools/serve.cjs
```

然后打开 http://127.0.0.1:8128/?lang=zh。

localhost 和 127.0.0.1 都指正在使用的那台电脑，浏览器会按两个不同网站保存本机数据；首次排查请固定使用同一个地址。要让两台设备互发消息，按 README 的同一局域网中继步骤操作。

本次在 Windows 上核验服务器启动与压缩包脚本权限；没有实体 Mac，不能将脚本检查当作 Mac 实测。若仍失败，请提供终端实际输出，浏览器错误页不足以确定原因。
