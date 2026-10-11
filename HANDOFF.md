# HANDOFF · wick — 交接给下一位（人或 agent）

> 用途：让接手者不必重新解释背景就能继续修改。本文只写**可执行的事实**、**不可破坏的约束**和**已知短板**。
> 一句话定位：wick 不是一个「讲 1% 故事的网站」，而是一个**能跑起来的应急通信原型**——自研超紧凑编解码 + 手写 ChaCha20-Poly1305 + 电量预算引擎 + 离线 store-and-forward；网站本身再用 1% 模式演示同一份纪律。

---

## 1. 当前状态（截至本版本）

| 部分 | 状态 | 证据 |
| --- | --- | --- |
| 编解码（字典 + varint + 差分 + 6-bit + CRC-8） | ✅ 可用 | `tests/codec.test.html` 58 项全通过 |
| 对称加密（ChaCha20-Poly1305，RFC 8439） | ✅ 可用 | 同上，对照 §2.3.2 / §2.4.2 / §2.5.2 / §2.8.2 官方向量 |
| 密封帧（算法标识 + 随机数后缀 + 认证标签，25 B 开销） | ✅ 可用 | `src/core/secure.js`；第 02 节下半有收据 |
| 防重放（单调计数器）与伪造帧拒绝 | ✅ 可用 | 第 02 节按钮可当场伪造；测试断言 |
| 电量预算引擎（5 无线电 × 5 能量来源） | ✅ 可用 | 第 03 节交互 + 内核测试第 8 组断言 |
| 离线 store-and-forward（SW + IndexedDB） | ✅ 可用 | 第 04 节；真实浏览器实测 43/43 已缓存 |
| 逐分钟现场推演（4 场景） | ✅ 可用 | 第 05 节；Worker 内运行 |
| 结果导出为 PNG 成绩卡 | ✅ 可用 | 第 05 节按钮；本机 canvas 绘制 |
| 七步引导演示（`?demo=1`） | ✅ 可用 | `src/ui/tour.js`；方向键 + Esc |
| 图表的数据表版本 | ✅ 可用 | 第 05 节 `<details>`，13 行 × 3 列 |
| 1% 模式（页面级降级） | ✅ 可用 | 顶栏开关；`?mode=eco` 深链 |
| 中英双语（含中文术语对照） | ✅ 可用 | 顶栏切换；只下载当前语言；271 键两边一致 |
| 整页集成测试 | ✅ 25 项 | `tests/page.test.html` |
| 离线外壳端到端测试 | ✅ 7 项 | `tests/offline.test.html`（需真实浏览器） |
| 启动自检（模块失败清单 + 外壳状态） | ✅ 可用 | `window.__wick` |
| Service Worker 注册 | ✅ 可用 | `src/main.js` 的 `registerOfflineShell()` |
| 打包一致性校验 | ✅ 可用 | `tools/pack.py` 的 `verify()` |
| 截图与体积表 | ✅ 可复现 | `tools/shoot-screenshots.py`、`tools/build-budget-data.py` |
| 真实射频 / 多设备 / 多跳中继 | ❌ 未做 | 传输层是模拟的 |
| 密钥交换协议 | ❌ 未做 | 算法与帧格式是真的；密钥怎么到对方手里没有实现（见第 6 节第 2 条） |
| 密码实现的侧信道审计 / 第三方评审 | ❌ 未做 | 标签比较是恒时的，但没有做过审计（见第 6 节第 3 条） |

---

## 2. 30 秒跑起来

```bash
cd wick
python3 -m http.server 8000        # Service Worker 需要 http:// 或 https://
# 打开 http://localhost:8000
```

**四套验证命令**（都不需要 Node、不需要装包）：

```bash
open http://localhost:8000/tests/codec.test.html     # 58 项内核断言
open http://localhost:8000/tests/page.test.html      # 25 项整页断言
python3 tools/build-budget-data.py                   # 重算体积表（会改 src/ui/budget-data.js）
python3 tools/shoot-screenshots.py 8000              # 重拍 screenshots/（需先起服务器）
```

无头运行测试（CI 式）——注意 Chrome 在无头下不会自己退出，所以要么用超时包一层，要么直接看 DOM：

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --disable-gpu --no-sandbox --virtual-time-budget=30000 \
  --dump-dom "http://127.0.0.1:8000/tests/codec.test.html" | grep -o '[0-9]* passed · [0-9]* failed'
```

**无头环境的三条实测经验**（踩过的坑，省得再踩）：

1. 单纯 `--dump-dom` 之后 Chrome 不会退出，脚本要自己 `killpg`，否则整个调用会被挂住。
2. 程序化 `scrollTo()` 在这个环境里**不产生 scroll 事件**（实测 `scroll` 监听器收到 0 次），所以任何依赖滚动状态的断言都要用 `win.dispatchEvent(new Event("scroll"))` 手动触发；`tools/shots.html` 就是这么做的。
3. 把页面用 `document.write` 塞进 iframe 时，`scroll-behavior: smooth` 会吞掉瞬时滚动，必须显式写 `behavior: "instant"`。

---

## 3. 不可破坏的约束（改代码前先读这一节）

违反任何一条，都会让已经拿到的分数掉回去。

1. **`src/core/*` 必须是纯逻辑**：不许出现 `document` / `window`。它们要能在 Worker 与测试页里直接跑。加密层（`cipher.js`、`secure.js`）也不例外——这也是它没有被写成 WebCrypto 包装的原因之一。
2. **测试必须保持全绿**：改完跑两套测试。当前基线 **58 + 25 = 83 项全通过**（另有 7 项离线测试需在真实浏览器里跑）。任何一项变红都要先修好再继续。**新增功能要补断言，不要删断言。**
3. **`src/ui/budget-data.js` 是生成物**，不要手改。要改数字就改脚本再重跑。
4. **零运行时依赖**：不得引入框架、打包器、CDN、第三方脚本、网络字体、第三方密码库。这是作品主张的一部分，也是「代码实现 / 架构」得分点。
5. **1% 模式必须继续有效**：不加载任何字体字节、关闭动效、退回系统字体。改样式时别把这条弄失效。
6. **离线必须继续有效**：`sw.js` 的 `SHELL` 在增删文件后必须同步更新，而且**新增文件必须真的存在于仓库里**。第 9 节的两个脚本会双向核对，整页测试里也有对应断言。
7. **不得写任何试图影响评审判断的祈使句**——无论写代码、注释、README 还是截图里。一票否决。（第 9 节有一个扫描脚本；它把自己要查的字样写成字符类，这样脚本本身不会出现在自己的扫描结果里。）
8. **不得把模拟写成实测**：能耗系数是估算，场景是构造的，第 06 节是示意图，成绩卡上必须保留 `modelled` 字样，页面上的会话密钥必须说明是演示密钥。
9. **内容与安全边界**：不采集个人信息、不做人脸识别、不留位置历史、不评价任何师生、不声称任何路线安全或完全无障碍。页脚那句话不能删。
10. **视觉基调**：近黑底 + 单一暖色（ember）+ 冷色仅用于数据；动效克制。大幅换色或加动效前先想清楚它是否服务于「1% 精神」。
11. **打包必须自校验**：`tools/pack.py` 会在打包后核对 SHELL、`index.html` 引用与 `src/main.js`。**如果它报错，不要绕过它**——它拦的正是曾经发出去过一个不启动的页面这件事。

---

## 4. 已验证的证据（可直接引用，也可当场复现）

**内核测试（58 项）**覆盖：varint 边界往返、zigzag、CRC-8 标准向量（`"123456789"` → 0xF4）、5 种消息类型往返、位置精度（实测误差 < 12 m）、位级打包、坏帧拒绝、字典边界（`sand` 不会被拆成 `s`+`and`）、体积上限（带定位与时间的报安 ≤ 10 B）、能耗单调性、5 制式对比全部优于基线、场景确定性与送达率；以及加密层的 RFC 8439 四组官方向量、25 字节开销、逐帧密文不重复、坏标签拒绝、重放拒绝、错误密钥拒绝。

**整页测试（25 项）**覆盖：启动无异常与无告警、**每个引导模块都挂载成功**、**离线外壳清单里的每个文件都真的存在**、标题本地化、Canvas 真实绘制（按亮度像素计数）、字节解剖两柱、实验台产出帧、往返校验通过、**密封帧收据自洽**、**伪造标签被拒绝**、**重放被拒绝**、预算读数、无线电排名、图表两条序列、**图表数据表**、离线队列初始化、**成绩卡导出为 PNG**、**引导演示默认关闭且可开可关**、情境卡片与网络图、第 07 节四分区、1% 模式往返、中英切换可逆、**两份语言表键集完全一致（271 键）**。

**实测数字**（`tools/build-budget-data.py`，gzip）：

```
关键路径合计      188,615 B
  其中字体         84,383 B   ← 1% 模式完全不请求
去掉字体后        104,232 B
javascript         76,981 B
运行时第三方依赖         0
```

**场景结果**（地震安置点，2G，336 小时）：wick 送达 6,929 条、撑满 336 h、2,139 次传输；基线送达 3,487 条、179 h 后失声。

**离线自检方法**：起服务器 → 打开页面 → DevTools → Application → Service Workers 确认 active，Cache Storage 里 `wick-v2` 应有 **43 条**记录（`SHELL` 的 43 个条目：42 个文件 + 目录入口 `./`）；然后勾 Offline 刷新，页面应完整回来、第 04 节仍显示 `service worker: active · shell cached`。如果条目数是 0，说明有文件没找到 —— 跑第 9 节的脚本。

**离线承诺的端到端实测**（`tests/offline.test.html`，在真实浏览器里打开即可复现）：

```
scope /                                   ← 已注册，作用域覆盖整站
activated · active                        ← 已激活
{"version":"wick-v2","total":43,"cached":43,"missing":[],"failed":[]}
第 04 节显示：active · shell cached · 43/43
```

这一页把应用装进一个**有真实 URL 的同源 iframe**——因为 Service Worker 无法在 `document.write` 出来的文档里注册，而整页测试正是那样装载页面的。它需要真实的 worker 生命周期，所以无头 `--dump-dom` 环境跑不了（那里 Cache API 的 promise 不 settle，而且为了结束进程必须 SIGKILL，CacheStorage 来不及刷盘）。**跑法就是打开它**，页面会自己打印结论。

**从服务端侧看到的证据**（同一次会话的访问日志）：`/sw.js` 被请求 1 次（注册），`SHELL` 里的每个路径各被请求 2 次（页面加载一次 + worker 的 `precache()` 用 `cache: "reload"` 再拉一次）。这是「预缓存真的发出了请求」的直接证据，不需要读浏览器的内部状态。

**安装逻辑的确定性验证**：把 `sw.js` 载入一个 `self`/`caches`/`fetch` 都是替身的上下文，手动调用 install 处理器与 message 处理器。实测：43 条全部入缓存、引导模块与 manifest 图标都在、无重复键；把一个条目改成 404 时，**其余 42 条照常入缓存，失败条目被记录并可通过消息通道读回**（`{cached: 42, total: 43, missing: ['./assets/icon.svg'], failed: ['./assets/icon.svg (404)']}`）；worker 被重启（内存清空）后仍能通过**读缓存**正确回答，而不是依赖某个已经消失的变量。

---

## 5. 文件地图（改哪里）

| 想改什么 | 动哪个文件 |
| --- | --- |
| 词表 / 编码规则 | `src/core/dictionary.js`、`src/core/codec.js` |
| 密码算法 | `src/core/cipher.js`（改完必须重跑 RFC 向量断言） |
| 密封帧格式 / 计数器 / 防重放 | `src/core/secure.js` |
| 第 02 节密封帧面板 | `src/ui/seal.js` + `index.html` 的 `#sealed` + `assets/css/app.css` 末段 |
| 能耗系数 / 增加制式或电池 | `src/core/energy.js`（两张表是纯数据，可直接替换） |
| 1% 模式的取舍条款 | `src/core/budget.js` 的 `ECO_TRIMMING` |
| 对照基线的构成 | `src/core/baseline.js`（并在 README 第 8 节同步） |
| 现场场景 | `src/core/sim.js` 的 `SCENARIOS` |
| 成绩卡版式 | `src/ui/sharecard.js` |
| 引导演示的步骤与文案 | `src/ui/tour.js` 的 `STEPS` + `src/ui/lang/*.js` 的 `tour.s1…s7` |
| 图表的数据表 | `src/ui/field.js` 的 `paint()` 尾段 |
| 离线队列策略 | `src/core/sync.js`、`src/ui/offline.js` |
| 文案（中/英） | `src/ui/lang/en.js`、`src/ui/lang/zh.js`（**必须同增同删**） |
| 版式与视觉 | `assets/css/tokens.css`（令牌）→ `app.css`（分区）→ `motion.css`（动效） |
| 1% 模式的页面级行为 | `src/ui/settings.js` + `motion.css` 的 eco 段落 |
| 引导顺序与失败隔离 | `src/main.js` |
| 离线缓存清单 | `sw.js` 的 `SHELL`（**新增文件必须加，而且必须真的存在**） |
| 离线注册与外壳状态上报 | `src/main.js` 的 `registerOfflineShell()`、`src/ui/offline.js` 的 `reportWorkerState()` |
| 「能否承载 worker」的判断 | `src/ui/dom.js` 的 `workerUnsupportedReason()`（`file://`、无 API、`document.write` 文档三种情况） |
| 文档与提交说明 | `README.md`、`AI_USAGE.md`、`DEMO.md`、`CREDITS.md` |

---

## 6. 已知短板与下一步（按性价比排序）

这一节是**诚实的欠账清单**，也是接手者最该先看的地方。

1. **传输层仍然是模拟的（当前最大短板，加密完成后它排到第一位）**。没有 LoRa / BLE / 蜂窝驱动。加密把「内容被偷看」这一条堵上了，但「消息怎么真的发出去」还是模型。可行路径：把 `src/core/sync.js` 的 `LINKS` 抽象成可注入的 transport 接口，并附一个 Web Bluetooth 适配器骨架（哪怕只跑通两台设备之间的收发演示，也把「原型」抬到「可对接」）。
2. **密钥交换没有实现**。`cipher.js` 与 `secure.js` 是真的，测试向量是公开可核对的；但「会话密钥怎么安全地到对方手里」没有协议，代码里的密钥由部署方在离线渠道自行约定，页面用的是印出来的演示密钥。可行的下一步：实现一个基于短码的密钥派生（需要 SHA-256/HKDF，`cipher.js` 里已有 ChaCha20 可作 HKDF 的 PRF 基础），并做一次中间人风险的如实说明。
3. **密码实现没有审计**。标签比较是恒时的（无分支按位或），但没有做过侧信道审计，也没有第三方评审。README 与 DEMO 都把这条写在明面上。**不要把它说成「已审计」**。
4. **无障碍还能再进一步**：第 05 节的折线图已经有数据表版本（13 行 × 3 列）；第 01 节的字节解剖与第 03 节的无线电排名目前靠图例里的数值，可以再补一份 `<details>` 表格。
5. **首屏字体是最大单项开销**（84 KB，占交付体积 46%）。`Instrument Serif` 只用于首屏引语与 takeaway 衬线；可考虑用 `font-display: optional` 或延后加载把它移出关键路径，让完整模式的 LCP 更好。注意别弄坏 1% 模式（那个模式本来就不请求字体）。
6. **移动端只做了响应式适配，没有真机走查**。390×844 下第 02/03 节的密集面板、以及新增的密封帧面板（`.sealed__grid` 在 860px 以下会转单列，但没有在真机上核过）值得再看一遍。
7. **引导演示可以再进一步**：现在是「说一句 + 跳到分区」，还不能替评委按下那个按钮。可以做 `?demo=1&auto=1` 让它直接演示（比如自动把滑杆推到 8、自动切到 LoRa），代价是失败时更难示范。

---

## 7. 与另一个候选作品的关系（差异是资产，不是缺陷）

另一个候选作品《1% — How Far Can It Go?》走的是**沉浸叙事**路线：滚动即耗电、巨型「1%」随电量排干、400 焦耳模拟器、性能账本、三文件 50 KB。

本版本以 wick 为基础，从它那里移植了三件东西，并各自改造过：

| 移植了什么 | 落点 | 改造 |
| --- | --- | --- |
| 成绩分享卡（canvas 导出 PNG） | `src/ui/sharecard.js`，第 05 节 | 数据源换成真实的场景推演结果；卡片上印 `modelled` 与随机种子，避免脱离页面后变成无出处的数字 |
| 「跟着做」的引导演示 | `src/ui/tour.js`，`?demo=1` + 顶栏 ▶ | 换成 `DEMO.md` 的七步；补了键盘操作与当前分区标记 |
| 滚到见底的那一刻 | 已经由左侧能量轨覆盖（100% → 1%） | 没有重复引入「英雄区排干」：同一概念保留一个入口，这是合并时定的规矩 |

**没有移植的**：单文件三件套的结构。分层是「项目架构」15 分的来源，不能为了小体积退回去。

**两条体积口径的处理**：叙事作品的核心卖点是「整页 ≤50 KB」，wick 有 84 KB 自托管字体，二者不能同时成立。本版本保留字体，并把自证口径写成「**关键路径 188 KB / 去掉字体 101.8 KB（gzip）/ 1% 模式不请求任何字体字节**」，三张数字都在第 07 节由脚本从真实文件量出。README 第 9 节写清楚了这一点，不算是取巧——但它也确实是一次取舍：放弃的是「整页 ≤50 KB」这个更漂亮的单数字。

**两个「低功耗模式」的处理**：只保留 wick 的一个，统一叫 **1% mode**（顶栏开关、`?mode=eco` 深链、页脚 `#foot-mode` 标签三者一致）。没有引入第二个开关。

---

## 8. 交付前检查清单

- [ ] 两套测试全绿（58 + 25）
- [ ] `sw.js` 的 `SHELL` 含全部运行时文件，且每个文件都真实存在（第 9 节脚本）
- [ ] `python3 tools/build-budget-data.py` 能跑通且不报缺文件
- [ ] `python3 tools/pack.py 2.0` 的 `verify()` 无告警
- [ ] 断网刷新仍可用（Cache Storage 里 `wick-v2` 条目数 = SHELL 条目数 = 43）
- [ ] 在真实浏览器里打开 `tests/offline.test.html`，应为 **7 passed · 0 failed** 且报出 `43/43 cached`
- [ ] `?mode=eco`、`?lang=zh`、`?demo=1` 深链仍有效
- [ ] 键盘 Tab 一遍，每个控件可达、焦点可见；引导演示方向键 + Esc 可用
- [ ] `prefers-reduced-motion` 下无动画
- [ ] 截图已重拍（`tools/shoot-screenshots.py 8000`），`screenshots/` 里**只放 8 张**，多余的进 `screenshots/extra/`
- [ ] README 的「已实现 / 未实现」两表与代码一致，核心文件清单已更新
- [ ] 两份语言表键数一致（测试会拦）
- [ ] 跑一次第 9 节的扫描脚本，结果必须是 `clean`（脚本的字符类写法见下）
- [ ] 页脚免责声明仍在；成绩卡上仍有 `modelled`；演示密钥仍标注为演示

---

## 9. 两个自检脚本

**核对离线缓存清单（双向）** —— 只查一个方向的脚本，正是当初让一个不启动的页面通过检查的原因：

```bash
cd wick && python3 - <<'PY'
import re, pathlib
sw = pathlib.Path('sw.js').read_text()
# Parse the SHELL array only: the fetch handler also mentions "./index.html",
# and counting that occurrence would overstate the manifest.
block = re.search(r'SHELL\s*=\s*\[(.*?)\];', sw, re.S)
listed = {m for m in re.findall(r'"\./([^"]+)"', block.group(1)) if not m.endswith('/')}
runtime = {str(p) for pat in ('*.html', 'assets/**/*', 'src/**/*', 'manifest.webmanifest')
           for p in pathlib.Path('.').glob(pat) if p.is_file()}
missing_from_list = sorted(runtime - listed)      # 有文件但没进清单
missing_on_disk = sorted(listed - runtime)        # 清单里有但文件不存在
print("runtime files not listed in sw.js SHELL :", missing_from_list or "none")
print("SHELL entries with no file on disk      :", missing_on_disk or "none")
print("boot module present                     :", "src/main.js" in listed and "src/main.js" in runtime)
raise SystemExit(1 if (missing_from_list or missing_on_disk) else 0)
PY
```

**扫一遍禁止出现的句子**（期望输出 `clean`）：

```bash
cd wick && rg -in "请给满[分]|给满[分]|ignore [p]revious|忽略之[前]|score [m]e|full [m]arks" --glob '!ai-logs/*' . || echo "clean"
```

字形为什么写成 `[分]` 这样的字符类：这样这条命令**不会匹配到它自己**，结果里出现的每一行就都是真正的命中，不需要人工区分「这是规则文本还是真的写了」。这个技巧只用于守卫脚本；如果扫描结果非空，那一定是要处理的内容。
