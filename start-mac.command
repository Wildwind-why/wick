#!/bin/bash
# macOS starter: works from Finder or `bash /path/to/start-mac.command`.
# Uses the user's installed Node.js; never installs software or changes settings.
SCRIPT_DIR="$(cd -- "$(dirname -- "$0")" && pwd)"
if ! cd "$SCRIPT_DIR"; then
  echo "Cannot open the project folder. / 无法进入项目文件夹。"
  read -r -p "Press Return to close. / 按回车关闭。 "
  exit 1
fi

if [ ! -f "tools/serve.cjs" ]; then
  echo "Unzip the entire project first; keep this script next to the tools folder."
  echo "请先完整解压项目，start-mac.command 应与 tools 文件夹放在一起。"
  read -r -p "Press Return to close. / 按回车关闭。 "
  exit 1
fi

WICK_NODE="$(command -v node 2>/dev/null || true)"
if [ -z "$WICK_NODE" ]; then
  for candidate in /usr/local/bin/node /opt/homebrew/bin/node; do
    if [ -x "$candidate" ]; then WICK_NODE="$candidate"; break; fi
  done
fi
if [ -z "$WICK_NODE" ]; then
  echo "Node.js was not found. / 没有找到 Node.js。"
  echo "Install the macOS LTS version, then run this starter again:"
  echo "请安装 macOS 的 LTS 版本，再重新运行："
  echo "https://nodejs.org/zh-cn/download"
  read -r -p "Press Return to close. / 按回车关闭。 "
  exit 1
fi

if ! "$WICK_NODE" -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 18 ? 0 : 1)'; then
  echo "Please install a current Node.js LTS version. / 请安装当前 Node.js LTS 版本。"
  echo "https://nodejs.org/zh-cn/download"
  read -r -p "Press Return to close. / 按回车关闭。 "
  exit 1
fi

echo "Starting wick. The browser opens after the server is ready."
echo "正在启动 wick，启动成功后会自动打开浏览器。请保持此终端开启。"
"$WICK_NODE" tools/serve.cjs --open "$@"
WICK_EXIT=$?
if [ "$WICK_EXIT" -ne 0 ]; then
  echo "Startup failed. Please share the terminal error shown above."
  echo "启动失败，请把上方终端错误文字发给项目负责人。"
fi
read -r -p "Press Return to close. / 按回车关闭。 "
exit "$WICK_EXIT"
