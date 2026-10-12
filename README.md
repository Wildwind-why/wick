# wick 2.1 — 留住最后 1% 电量里最重要的消息

**主题：1% Battery · Engineering & Social Impact**

wick 是可运行的应急通信原型：完整保留消息内容，在本机离线排队；可选择明确标注的模拟链路，也可通过局域网中继完成另一端解码、保存和确认。编解码与资源模型可以逐项检查。**真实射频接入和硬件节电效果尚未验证。**

![wick 首屏](screenshots/01-hero.png)

## 在线预览

**<https://wick-one-percent.app.workbuddy.host/>**

已部署 2.1 版本（含局域网中继服务），点开即用，不需要安装任何东西。线上是 HTTPS，Service Worker 与离线能力可以正常验证。

## 马上运行

本地运行只需要 **Node.js 18+**（[下载 LTS 版本](https://nodejs.org/zh-cn/download)）。无需第三方运行时包，无构建步骤。

| 系统 | 怎么做 |
| --- | --- |
| **macOS** | 完整解压后进入 `wick-2.1` 文件夹，双击 **`start-mac.command`**。启动成功后会自动打开浏览器 |
| **Windows** | 完整解压后进入 `wick-2.1` 文件夹，双击 **`启动-wick.cmd`**，保持窗口开启 |
| **任意系统（手动）** | 在项目目录执行 `node tools/serve.cjs`，再打开浏览器访问 **http://localhost:8127/?lang=zh** |

双击 `start-mac.command` 提示执行权限不足时：打开「终端」，输入 `bash` 加一个空格，把该脚本拖进终端，再回车。脚本会自行进入正确目录。Mac 端排查看 [Mac 打开方法](Mac打开方法.md)。

**局域网双端演示**：电脑运行 `node tools/serve.cjs --lan`（Windows 可双击 `启动-局域网演示.cmd`），两台设备打开终端打印的同一个 LAN 地址。

服务器提供静态页面与可选消息中继，默认只监听本机。只看静态作品可用 `python -m http.server 8000`，但该方式**不提供消息中继**。直接双击 `index.html` 无法可靠运行模块与离线缓存。

## 三个可演示的结果

1. **消息不失真**：输入“12 人被困，没有饮水 🚨”，中文、emoji、数字、否定词、大小写和空白完整往返。不会把 SOS 猜成“安全”。1% 模式保留所有消息字段。
2. **断网不丢队列**：消息先落本机 IndexedDB，刷新仍在；恢复链路后按紧急优先、每批最多 12 条持续发送，直到全部处理或遇到故障。
3. **确认有依据**：模拟完成与对端确认分别计数。中继接收不等于对端收到；只有另一个客户端解码并保存后返回回执，才记“对端确认”。超时保留消息供重试。

## 双端收发演示

同一电脑上，用两个独立浏览器配置，例如 Edge 普通窗口与隐私窗口，打开同一地址。两端进入第 04 节，选择“局域网中继”，填相同的 16–80 位字母数字口令后连接，再发消息。

两台物理设备演示时：

1. 电脑和手机连接同一个 Wi-Fi，电脑运行 `node tools/serve.cjs --lan`，或双击 `启动-局域网演示.cmd`。
2. 两端打开控制台打印的同一个 LAN 地址，如 `http://192.168.x.x:8127/?lang=zh#offline`。
3. 填相同口令并连接。发送端排队 → 接收端展示消息 → 发送端显示“对端确认”。
4. 停止对端或使用只有自己的新口令组，消息约 10 秒后仍留在待重试队列。按“发送队列”可重试。

设备互相看不到时，检查同一 Wi-Fi、客户端隔离与防火墙对 Node 的入站许可。这依赖运行中的中继电脑，不等于手机直连或 mesh。多人组的一次确认代表至少一个其他客户端确认，不代表所有成员收到或人工阅读。

**局域网 HTTP 是明文演示，请使用虚构数据。** 口令用于分组，不是端到端加密；回执不是密码学身份认证。中继在内存存储消息，最多保留一小时，服务器停止即清空；浏览器收发记录保留在本机。正式演示前应现场进行双设备演练，本次自动化使用两个隔离浏览器会话。

## 离线与 1% 模式

首次在 localhost 或 HTTPS 加载后，等第 04 节显示外壳完整缓存 **44/44**，再断网刷新。离线打开和排队可继续使用，真正发送仍需要链路。

普通 LAN IP 的 HTTP 不满足 Service Worker 安全上下文要求，局域网收发与离线缓存应分别验证。第一次打开且未缓存过的离线设备不能加载网站。

- `?mode=eco`：首次访问不请求字体；停止持续画布动画与遥测采样，保留完整消息。
- `?lang=zh` / `?lang=en`：中英双语。
- `?still=1`：静态演示与截图。
- `?demo=1`：七步引导。
- 数据按浏览器和网站地址分别存储，更换端口/地址不会共享原队列。

## 实现与边界

| 部分 | 已实现 | 边界 |
| --- | --- | --- |
| v2 帧 | 词典、位置/时间差分、UTF-8 字面量、CRC、逐字往返检查 | 可解码 v1；旧版已丢失原文无法恢复 |
| 本机队列 | IndexedDB、紧急优先、多批发送、中断重试、确认后事务归档 | 存储禁用时降级内存并标注，刷新会丢失内存数据 |
| LAN 中继 | 实际 HTTP 传输、收件箱、解码保存后回执 | 无 LoRa/BLE 驱动、mesh、密钥交换、生产认证 |
| 能量模型 | 电量/制式/批量交互、待机与发送核算、场景推演 | 系数未标定；未完整计入重试、扫描、分片、接收等开销 |
| 加密实验 | ChaCha20-Poly1305 公开向量、坏标签与重放演示 | 公开演示密钥；无第三方审计；未接入中继 |
| 离线外壳 | SW 缓存应用资源，不缓存中继 API | 需预加载且处于 localhost / HTTPS |

最短结构化示例为 6 B，加密实验增加 25 B。这不是任意文本、任意无线链路的总成本：中文/自由文本可能更大。基线是**构造的 JSON 信封**，不是微信、短信或 Meshtastic 实测。节省与排名必须连同消息、封装、批量和模型假设说明；可发条数是仅发送上限，不是实测送达数量。

本作品的创新表达：**完整语义、紧急优先、可检查的字节成本与可信的确认状态，组成低资源通信的可运行闭环。**

## 功能实现状态（如实标注）

规则要求 README 里写的功能必须在代码里存在。下表每一项都给出可核对的文件；**未实现的部分单独列出，不做美化**。

### 已实现

| 功能 | 状态 | 证据文件 |
| --- | --- | --- |
| 自研二进制编解码（encode / decode / measure） | ✅ 已实现 | `src/core/codec.js` |
| 位级打包、varint、zigzag、CRC-8 | ✅ 已实现 | `src/core/bits.js` |
| 126 词字典 + 6-bit 文本打包（含转义） | ✅ 已实现 | `src/core/dictionary.js` |
| UTF-8 字面量：中文 / emoji / 空白完整往返 | ✅ 已实现 | `src/core/codec.js` + 内核测试 |
| 位置差分编码（1/10000 度 ≈ 11 米） | ✅ 已实现 | `src/core/codec.js` |
| 消息类型：check-in / need / sitrep / ack / beacon | ✅ 已实现 | `src/core/codec.js` |
| 帧完整性校验与坏帧拒绝 | ✅ 已实现 | `src/core/bits.js` |
| 往返校验（编码→解码→比对）实时显示 | ✅ 已实现 | `src/ui/bench.js` |
| 对称加密：ChaCha20-Poly1305（RFC 8439） | ✅ 已实现 | `src/core/cipher.js`（对照 §2.3.2 / §2.4.2 / §2.5.2 / §2.8.2 官方向量） |
| 密封帧格式：算法标识 + 随机数 + 认证标签（25 B 开销） | ✅ 已实现 | `src/core/secure.js` |
| 防重放（单调计数器）与伪造帧拒绝 | ✅ 已实现 | `src/core/secure.js` + 第 02 节交互 |
| 主流聊天软件信封基线（可审计） | ✅ 已实现 | `src/core/baseline.js` |
| 5 种无线电 × 5 种能量来源的能耗模型 | ✅ 已实现 | `src/core/energy.js` |
| 电量预算引擎（可发条数 / 可维持时间 / 固定 vs 按字节） | ✅ 已实现 | `src/core/budget.js` |
| 无线电按「送达条数」排名 | ✅ 已实现 | `src/core/budget.js` + `src/ui/lab.js` |
| 1% 模式（产品层：舍弃位置 / 时间 / 文采） | ✅ 已实现 | `src/core/budget.js` |
| 1% 模式（页面层：零字体字节、关动效、退系统字体） | ✅ 已实现 | `src/ui/settings.js` + `assets/css/motion.css` |
| Service Worker 预缓存整套外壳 | ✅ 已实现 | `sw.js` + `src/main.js`；实测 **44/44** |
| 离线状态如实上报（不谎报「已缓存」） | ✅ 已实现 | `src/ui/offline.js` 的 `reportWorkerState()` |
| IndexedDB 本地发件队列（含内存降级） | ✅ 已实现 | `src/core/store.js` |
| 紧急优先 + 分批发送 + 中断重试 | ✅ 已实现 | `src/core/sync.js` |
| **局域网真实收发（2.1 新增）** | ✅ 已实现 | `src/ui/relay.js` + `tools/serve.cjs` |
| **对端确认回执（2.1 新增，不把「上传成功」当作「送达」）** | ✅ 已实现 | `src/core/sync.js` + `tools/serve.cjs`（`/api/ack`、`/api/receipts`） |
| 逐分钟现场推演（4 个场景，确定性随机种子） | ✅ 已实现 | `src/core/sim.js` |
| 结果导出为 PNG 成绩卡（本机 canvas，无上传） | ✅ 已实现 | `src/ui/sharecard.js` |
| 中英双语（两份语言表键集一致） | ✅ 已实现 | `src/ui/lang/en.js` + `src/ui/lang/zh.js` |
| 四套浏览器测试（共 115 项断言） | ✅ 已实现 | `tests/codec / page / offline / regression .test.html` |

### 未实现（如实标注，不做美化）

| 未实现 | 说明 |
| --- | --- |
| 真实射频接入 | 传输层是模拟链路 + 局域网 HTTP 中继；没有 LoRa / BLE / 蜂窝驱动 |
| 多设备组网 / mesh / 多跳中继 | 中继是跑在一台电脑上的内存服务，不是 mesh，也不是手机直连 |
| 密钥交换协议 | 算法与帧格式是真的，**密钥怎么安全到达对方没有实现** |
| 端到端加密的局域网传输 | 局域网中继是**明文 HTTP**（页面已标注，演示请用虚构数据） |
| 密码实现的第三方审计 | 标签比较是恒时的，但没有做过审计 |
| 硬件功耗实测 | 能量系数是估算、未标定；未完整计入重试 / 扫描 / 分片 / 接收开销 |

## 核心文件清单

| 路径 | 作用 |
| --- | --- |
| `index.html` | 单页应用入口（七个分区全部在这一个页面里） |
| `sw.js` | Service Worker：外壳预缓存（43 条 + 目录入口）+ 运行时缓存，**不缓存中继 API** |
| `manifest.webmanifest` | PWA 清单 |
| `src/main.js` | 引导模块：按序挂载各分区（存储模块必须最后挂载） |
| **`src/core/`** | **纯逻辑层**（无 `document` / `window`，可直接在 Worker 与测试页里跑） |
| `src/core/codec.js` | 编解码、消息类型、位置与时间差分 |
| `src/core/bits.js` | 位级读写、varint / zigzag / CRC-8 |
| `src/core/dictionary.js` | 126 词字典与 6-bit 文本打包 |
| `src/core/cipher.js` | ChaCha20-Poly1305（RFC 8439） |
| `src/core/secure.js` | 密封帧格式、计数器防重放 |
| `src/core/baseline.js` | 主流聊天软件信封基线 |
| `src/core/energy.js` | 5 无线电 × 5 能量来源的能耗模型 |
| `src/core/budget.js` | 电量预算引擎、1% 模式裁剪规则 |
| `src/core/store.js` | IndexedDB / 内存降级的本地存储 |
| `src/core/sync.js` | 发件队列、分批、重试与状态机（`queued / sending / sent / failed / simulated`） |
| `src/core/sim.js` | 逐分钟场景推演 |
| **`src/ui/`** | **界面层**（每个分区一个模块） |
| `src/ui/relay.js` | **局域网中继客户端（2.1 核心新增）** |
| `src/ui/offline.js` | 第 04 节：发件队列、中继接线、离线状态如实上报 |
| `src/ui/hero.js` | 首屏烛焰 Canvas 与**真实每帧脚本耗时**测量 |
| `src/ui/telemetry.js` | 顶栏遥测（`script / frame`） |
| `src/ui/settings.js` | 1% 模式与语言切换 |
| `src/ui/lang/en.js`、`zh.js` | 双语键集（两边必须同增同删） |
| `src/workers/codec.worker.js` | 编解码压测（20 000 帧） |
| `src/workers/sim.worker.js` | 场景推演 Worker |
| `assets/css/tokens.css` | **设计令牌的单一真相源** |
| `assets/css/app.css`、`base.css`、`motion.css` | 分区样式 / 基础样式 / 动效与降级 |
| `tools/serve.cjs` | **本地服务器 + 中继 API（零依赖，2.1 新增）** |
| `tools/run-tests.cjs` | 自动跑四套测试 + 断网 / 字体 / 双会话 / 布局检查 |
| `tools/pack.py` | 打包并自校验资源引用 |
| `tools/shoot-screenshots.py` | 重拍 `screenshots/` |
| `tools/build-budget-data.py` | 重算体积表（会改 `src/ui/budget-data.js`） |
| `tests/codec.test.html` | 内核测试（58 项） |
| `tests/page.test.html` | 整页集成测试（25 项） |
| `tests/offline.test.html` | 离线外壳测试（7 项，需真实浏览器） |
| `tests/regression.test.html` | 回归测试（25 项，2.1 新增） |
| `start-mac.command` / `启动-wick.cmd` | macOS / Windows 一键启动器 |
| `启动-局域网演示.cmd` | Windows 局域网双端演示启动器（绑 `0.0.0.0`） |

## 验证

以下页面可直接在浏览器打开：

| 地址 | 断言数 |
| --- | ---: |
| /tests/codec.test.html | 58 |
| /tests/page.test.html | 25 |
| /tests/offline.test.html | 7 |
| /tests/regression.test.html | 25 |
| 合计 | **115** |

开发环境有 Playwright 与 Chrome/Edge 时执行 `node tools/run-tests.cjs`。它自动启动本机服务器，运行四套测试，验证断网刷新、字体请求、双会话收发、无人接收不误报、API 不缓存、360/390 px 布局并更新截图。BROWSER_PATH 可指定浏览器位置。Playwright 仅用于开发验证，不是运行依赖。

`python tools/build-budget-data.py` 重算文件体积；`python tools/pack.py 2.1-final` 打包并核对资源引用。gzip 表是文件大小测量，不是服务器实测传输流量。

## 材料

[Mac 打开方法](Mac打开方法.md) · [演示讲稿](DEMO.md) · [修复记录](CHANGELOG.md) · [交接验收](HANDOFF.md) · [协作约定](CONTRIBUTING.md) · [AI 声明](AI_USAGE.md) · [过程整理](ai-logs/README.md) · [来源](CREDITS.md)
