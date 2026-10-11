# 合并与加固记录 · 2026-10-11（第二段）

整理过的对话记录。范围与诚实声明见本目录 `README.md`。

**这一段的任务不是从零构建，而是「实证比对两个候选作品 → 判定以哪个为基础 → 在这个基础上继续改」。** 因此这一段的绝大多数内容是**量出来的东西**，而不是想出来的东西。中间出现的最重要的两个发现，都不是靠读代码看出来的，是靠把作品真跑起来。

---

## 第 1 轮　指令：先实证，再判断

**人（参赛队）的指令**

> 「你是资深前端/产品工程师，同时担任这次比赛的评委与主程。你要做三件事，按顺序、不许跳步：**实证比对两个候选作品 → 判定以哪个为基础 → 在这个基础上继续改到最终版**。」
>
> 补充要求（逐字要点）：
> - 不要凭印象、不要只看 README。**能运行就必须运行**，每个判断都要能指向证据（`文件:行号`、实测数字、或截图文件名）。证据不足就写「未能验证」，不要编。
> - 两个作品都用本地静态服务器跑起来；把 A 的两套测试**真跑一遍**并报告实际数字（预期 44 + 17）。
> - 实际动手操作 B 的核心交互（滚到耗电告警、跑一次 400 焦耳模拟器、切换 LOW PWR、导出成绩卡），并确认它是否真的零外部请求。
> - 跑 A 的自检脚本；逐条核对提交合规性（截图数量、模拟声明、相似产品、有没有面向评审的话术）。
> - 六个维度各自打分，**每个评语后面必须跟证据**。
> - 明确选谁做基础；逐条列出移植什么、放到哪里、改哪些文件、加分维度与代价。
> - 正面回答两个合并冲突：**体积口径冲突**（B 的「整页 ≤50 KB」与 A 的 84 KB 字体不能同时成立）与**重复概念**（两个作品都有低功耗模式，合并后只保留一个并统一命名为 1% mode）。
> - 不可破坏：保持 A 的分层架构（`src/core/*` 不得出现 `document`/`window`）、两套测试保持全绿、零运行时依赖、1% 模式与离线继续有效、不得写面向评审的话术、不得把模拟写成实测、页脚免责声明不能删。
> - 建议优先处理的欠账：从 B 移植成绩分享卡与引导演示；补强 A 自身的加密缺失、无障碍数据表、中文术语对照。

**AI 的回应（实质内容）**

先不动代码。建立证据基线：解压两个作品 → 各起一个本地静态服务器 → 用无头 Chrome 把能跑的测试都跑一遍 → 把每一处「声称」和「实测」并排放。

**遇到的第一个障碍是工具，不是作品**：无头 Chrome 在 `--dump-dom` 之后不会自己退出，直接调用会把整个调用挂住；程序化 `scrollTo()` 也不产生 scroll 事件，导致「滚动耗电」看起来是坏的。这两件事各花了一轮才排除，方法写进了 `HANDOFF.md` 第 2 节，省得下一个人再踩。

---

## 第 2 轮　实测发现：作品 A 交付物有一个致命缺陷

**AI 执行**

```bash
unzip -l wick-1.0.zip | grep main          # 没有 src/main.js
curl -o /dev/null -w "%{http_code}" http://127.0.0.1:8000/src/main.js   # 404
grep -n "main.js" index.html sw.js         # index.html:775 与 sw.js:26 都在引用它
```

**跑 A 的两套测试，实测数字**：

| 测试 | README/HANDOFF 声称 | 实测 |
| --- | --- | --- |
| `tests/codec.test.html` | 44 项全通过 | **44 passed · 0 failed** ✅ |
| `tests/page.test.html` | 17 项全通过 | **6 passed · 11 failed** ❌ |

失败的 11 项是：首屏 Canvas 未绘制、字节解剖两条柱为空、实验台没有产出帧、往返校验徽章状态未定义、无线电排名 0 行、图表没有 SVG、离线队列空、情境卡片 0 张、第 07 节 0 层、1% 模式开关无效、语言切换没有重绘文案。

**截图取证**：截下 `index.html` 首屏——顶栏与导航渲染正常（那是静态 HTML），**首屏主体是一整片黑**。整个交互层一行都没执行。

**根因定位**：`tools/pack.py:21-31` 的资源白名单列的是

```python
DIRS = ["assets/css", "assets/fonts", "src/core", "src/ui", "src/workers", ...]
```

而 `src/main.js` 位于 `src/` **根下**，三个子目录的白名单永远收不到它。也就是说：**这个缺陷跟 `main.js` 写得好不好无关，它压根没进压缩包**。

**旁证**：README 第 9 节的体积表里有一行「入口 2 342 B / 990 B」。这一行只可能来自当时的 `src/main.js`——所以文件在作者的树里是存在的，是打包脚本把它漏掉了。这一条把「作者没写引导模块」排除掉了。

---

## 第 3 轮　实测发现：A 的离线预缓存是空的

**AI 执行**：在页面里注册 Service Worker，然后直接读 `caches.keys()` 与条目数。

实测输出：

```
register() resolved
serviceWorker.ready = ready
reg.active = true reg.waiting = false reg.installing = false
caches = ["wick-v1"]
  wick-v1 → 0 entries
registrations = 1
```

**「离线优先」这个最核心的主张，在交付物里不成立**：SW 显示 active，缓存里一条记录都没有。

**根因定位**：`sw.js` 用 `cache.addAll(SHELL)`——**它是原子的**。SHELL 里有两条路径在磁盘上不存在（`./src/main.js`、`./assets/icon.svg`），于是一次 404 让整批 reject，缓存保持空白；而紧接着的 `.catch(() => self.skipWaiting())` 把这个 reject 吞掉了，安装事件照样成功。

**反向自检**：跑 `HANDOFF.md` 第 9 节的自检脚本，输出是 `missing from sw.js SHELL: none`——**全绿**。因为它只算了「运行时文件是否都在清单里」，没有算「清单里的文件是否真的存在」。**一个只检查一个方向的校验脚本，正是这两个缺陷能通过检查的原因。**

**作品 B 的实测（同一轮）**：

| 检查项 | 结果 |
| --- | --- |
| 零外部请求 | `RESOURCE_COUNT=2`，两条都是同源本地文件（`css/style.css`、`js/app.js`），外部 0 条 |
| 三文件体积 | `14 539 + 17 787 + 17 857 = 50 183 B`（49.0 KiB） |
| 400 焦耳模拟器 | 点满 133 次 → `poolLeft=1`，结算屏出现，`OUT OF ENERGY` → `0 J LEFT. NOTHING WASTED.` |
| 典型手机场景 | 切场景后自动扣 240 J，`poolLeft=160`，账本逐条列出 sync / push / 信号搜索的浪费 |
| LOW PWR | `body.low=true`、`aria-pressed=true`、`localStorage.lp=1`、ticker `animation-name: none`、FPS 显示 `PAUSED` |
| 成绩卡导出 | 触发下载 `1percent-score.png`，`data:image/png`，约 63 KB |
| 滚动耗电 | 合成 scroll 事件下 `scrollY=6000` → HUD `4%`、`--bat=0.040`（机制正常；程序化滚动不出事件是测试台问题） |
| 合规 | 截图 7 张（在 3–8 内）、列了 2 个相似产品并说清差异、模拟声明在位、话术扫描 clean |

---

## 第 4 轮　结论与方案（一句话版）

以 **A（wick）为基础**，从 B 移植三件东西。理由不是「A 更好看」，而是**修好 A 的收益上限更高**：A 的分层架构（`src/core` 纯逻辑 + `src/ui` 渲染 + workers）是「项目架构 15 分」的来源，B 要拿到它只能重写；反过来，B 的叙事与展示层是可以移植的，而 B 的「整页 ≤50 KB」是一个**硬上限**，装不进 A 的 72 KB JavaScript 与 84 KB 字体。

按缺陷严重度排序执行的修复清单：

| 优先级 | 做什么 | 为什么 |
| --- | --- | --- |
| P0-1 | 重建 `src/main.js` | 不重建它，其余一切都不用谈 |
| P0-2 | 修 `tools/pack.py`：白名单改整目录递归 + 加 `verify()` 双向校验 | 让同一个缺陷不可能再发生一次 |
| P0-3 | 修 `sw.js`：逐条 `put` 代替原子 `addAll`，记录失败条目，不再吞异常 | 离线是这个作品的主张，不能是空缓存 |
| P0-4 | 补 `assets/icon.svg`（manifest 与 SHELL 都在引用） | 消除第二条僵尸引用 |
| P0-5 | 修 `HANDOFF.md` 第 9 节的自检脚本为双向，并加非零退出码 | 校验脚本本身要能被信任 |
| P1 | 补加密（A 自认的最大短板） | 实用性 / 创新性 / 代码实现三项都能受益 |
| P1 | 移植成绩卡、引导演示 | 展示效果；评委上手成本直接下降 |
| P2 | 图表数据表、中文术语对照 | 无障碍与本地化，成本低 |

---

## 第 5 轮　重建 `src/main.js`

**AI 执行**：读全部 15 个 `src/ui/*.js` 的导出接口（`grep -nE "^export|^import"`），确认挂载契约（`initSettings` / `initReveal` / `initTelemetry` / `initHero` / `initCost` / `initBench` / `initLab` / `initField` / `initOffline` / `initImpact` / `initCraft`，以及模块间通过 `wick:mode` / `wick:lang` / `wick:ready` 三个自定义事件通信）。然后写引导模块：每个模块单独 `try/catch`，失败记进 `window.__wick.failures` 而不抛给访客。

**第一次跑整页测试：6 → 15 passed**，还红 2 项（情境卡片、第 07 节）。

**AI 判断（错了一次）**：先把这两个分区直接排到引导序列最后、排在依赖 IndexedDB 的离线模块之后。诊断结果说明不是「没渲染」而是「渲染得太晚」：

```
--- after ~1000ms ---  __wick=undefined      cards=0 layers=0
--- after ~3000ms ---  __wick=undefined      cards=0 layers=0
--- after ~6000ms ---  __wick={"version":"2.0","failures":[],"ok":true}  cards=6 layers=4 budgetRows=10 files=13
```

约 4–6 秒才挂载完，而测试在 2.5 秒左右就下断言了。**修法不是把测试放宽，而是把引导顺序改对**：与存储无关的模块并行挂载（`Promise.all`），把唯一碰存储的离线模块放到最后并加 8 秒上限。这既是性能修复，也正好符合模块自己写着的那条设计原则——「被阻塞的 IndexedDB 不应该扣住界面」。

**结果：17 passed · 0 failed**（恢复到文档声称的基线，也就是把「声称」变成了「事实」）。

**紧接着修复取证**：

```
src/main.js 200 · src/core/cipher.js 200 · src/core/secure.js 200 · src/ui/seal.js 200
SHELL entries checked: 44 → unreachable: none
```

（44 条全部可达，说明逐条预缓存不可能再因为 404 而整批失败。）

---

## 第 6 轮　补加密：先写向量，再写实现

**AI 的取舍判断**：手写密码实现通常是坏主意，但在这里有两个理由站得住：① 作品的全部主张是「零运行时依赖、无供应链」，引入第三方密码库会推翻它；② 只要能对上 RFC 8439 公布的测试向量，实现就是**可被外部核对**的，而不是「信我」。

**AI 执行顺序**：先写 `src/core/cipher.js`（ChaCha20 分组函数、密钥流、Poly1305、AEAD 构造），再**立刻**用 Node 跑 RFC 官方向量：

```
ok   §2.3.2 block function
ok   §2.4.2 chacha20 keystream
ok   §2.5.2 poly1305 tag
ok   §2.8.2 ciphertext prefix
ok   §2.8.2 auth tag
ok   §2.8.2 round-trip
ok   tampered ciphertext rejected
ok   tampered aad rejected

8 passed · 0 failed
```

再写 `src/core/secure.js`（9 字节帧头 + 密文 + 16 字节标签；帧头作为关联数据；单调计数器防重放），同样先在 Node 里跑行为测试：

```
ok   开销 25 B   ok 算法标识 0x01   ok 计数器自增
ok   逐字节还原  ok 错误密钥拒绝     ok 错误会话标签拒绝
ok   重放被拒绝  ok 相同明文两次密文不同
12 passed · 0 failed
```

**移植到浏览器测试时错了一次**（记录在案）：手工转录 §2.3.2 的期望值时少抄了两个字符 `c7`，断言立刻失败并打印出完整的不匹配串。**这正是把标准数字写进断言的价值：它不容忍「差不多」。**

**加密面板的叙事故意做成「收据」而不是「开关」**：面板逐项列出 1 + 8 + 16 字节，6 字节的报到帧密封后 31 字节，占原始内容的四倍多。同时把「改动一个比特被拒绝」「重放被拒绝」做成两个按钮——**让评委亲手试一次伪造，比声明一百次「我们加密了」有用**。

---

## 第 7 轮　移植与补强

| 移植/新增 | 落点 | 改造点 |
| --- | --- | --- |
| 成绩分享卡 | `src/ui/sharecard.js` | 数据源换成真实场景推演结果；卡片上印 `modelled over {hours}h with seed {seed}`，避免脱离页面后变成无出处的数字 |
| 引导演示 | `src/ui/tour.js` + `?demo=1` + 顶栏 ▶ | 换成 `DEMO.md` 的七步；补方向键 / Esc；切换时用左侧 ember 竖线标出当前分区 |
| 滚到见底的那一刻 | 已由 A 的左侧能量轨覆盖（100% → 1%） | **没有**重复引入 B 的「英雄区排干」：同一概念只保留一个入口 |
| 图表数据表 | `src/ui/field.js` 的 `paint()` + `.datatable` 样式 | 13 行 × 3 列真实序列，屏幕阅读器逐格可读 |
| 中文术语对照 | `src/ui/lang/zh.js` | CRC-8 / BLE / Service Worker 首次出现处加中文解释 |
| 补断言 | 两套测试 | 内核 44 → 58；整页 17 → 25。**只加不删。** |

**移植过程中又抓出一个 bug（记录在案）**：整页测试里新加的「导出成绩卡」断言返回 **0 次下载**。原因是第 05 节在引导阶段就渲染完并广播了结果，而成绩卡模块在同一批里挂载得更晚，**错过了唯一一次事件**，按钮永远是死的。修法是让第 05 节把最近一次结果留在模块里可读（`currentFieldResult()`），点击时兜底取用。这个 bug 靠肉眼读代码几乎看不出来——它在「先渲染后订阅」这种顺序里才存在。

**决策记录（体积口径冲突怎么解）**：B 的核心卖点是「整页 ≤50 KB」，A 有 84 KB 自托管字体，二者不能同时成立。**选择保留字体**，并把自证口径改成三个数字并列：关键路径 183 KB / 去掉字体 97 KB（gzip）/ 1% 模式不请求任何字体字节。理由是：字体只占完整模式的一次性成本，而 1% 模式（也就是这个故事真正在意的那个模式）本来就是零字体字节；用一个更漂亮的单数字（≤50 KB）去换掉视觉资产，会在「展示效果」上直接失分，而口径本身在 README 第 9 节写清楚就不构成夸大。

---

## 第 8 轮　自检与交付

逐项跑完并记录数字：

| 检查项 | 结果 |
| --- | --- |
| 内核测试 | **58 passed · 0 failed** |
| 整页测试 | **25 passed · 0 failed** |
| 合计 | **83 项全绿** |
| 离线外壳双向核对 | `runtime not listed: none` / `SHELL entries with no file: none` / `boot module present: True` / 47 条 |
| 体积表重跑 | 关键路径 183 358 B；字体 84 383 B；去掉字体 98 975 B；JS 72 893 B；第三方依赖 0 |
| 语言表 | en 271 键 / zh 271 键，差集为空 |
| 打包校验 | `tools/pack.py 2.0` 的 `verify()` 无告警 |

**结论段（可直接放进 README 开头的那段）**：这一版不是两个作品的折中，而是**把叙事型作品的开场手法接到一个可复算的工程原型上**：A 提供编解码、加密、预算引擎与 83 项断言，B 提供「让人愿意读下去」的那一层——成绩卡、引导演示与节奏。合并时唯一放弃的是「整页 ≤50 KB」这个更漂亮的单数字，换来的是自托管的显示字体与完整的分层架构。

---

## 第 9 轮　交付之后：打开成果时发现的第三个同类缺陷

**触发**：任务做完之后，用户要求「打开最后的结果看一下成果」。起服务器、让他打开——服务器日志里出现了 `sw.js`、`manifest.webmanifest`、`assets/icon.svg` 的请求，看起来一切正常。但有一个细节不对：**没有任何路径被请求两次**。

这条线索指向一个我此前只在报告里写了「未能验证」的地方。顺着它查下去：

```bash
grep -rn "serviceWorker\|register(" --include="*.js" . | grep -v ai-logs
# 只有 offline.js:73 与 offline.js:76 —— 没有任何地方调用 register()
```

**整个站点从来没有注册过 Service Worker。** `src/ui/offline.js` 只是在**读**状态：

```js
if ("serviceWorker" in navigator) {
  refs.sw.textContent = t("c4.sw.active");   // ← 先把标签写成「已激活 · 外壳已缓存」
  navigator.serviceWorker.ready.then(...).catch(...);
}
```

两处错叠加成一句假话：① `ready` 在「什么都没注册」时**不是 reject，而是永不 settle**，所以 `.catch()` 永远不会触发；② 标签在 `ready` 之前就被乐观地写好了。于是页面显示「service worker / active · shell cached」，而 worker 从未存在、缓存从未填充。

**它跟我自己造成的伤口是同一个**：注册那一行本来就在丢失的 `src/main.js` 里（原始压缩包里除了 `main.js` 之外没有任何一处提到 `serviceWorker`），而我重建引导模块时没有把它补回来。**这是我自己的缺陷，不是原作者的。**

**修法（三层，缺一层都不算修好）**

| 层 | 改动 |
| --- | --- |
| 真的注册 | `src/main.js` 新增 `registerOfflineShell()`：`navigator.serviceWorker.register("sw.js", { scope: "./" })`，失败记入 `shellError` 而不阻塞页面 |
| 不许谎报 | `src/ui/offline.js` 新增 `reportWorkerState()`：只有拿到 worker **自报的完整清单**才返回 `active`；拿到但不完整 → `none`（并列出缺哪个）；拿不到清单 → 新增状态 `registered · cache unconfirmed`；环境不支持 → `none` |
| 让主张可测 | 新增 `tests/offline.test.html`，用**有真实 URL 的同源 iframe** 装载应用（`document.write` 的文档无法注册 worker），等 worker 激活后直接问它的缓存 |

**顺带又抓出第四个问题：外壳劫持整个 origin。**
第一版的导航策略是「任何 `navigate` 请求都返回缓存的 `index.html`」。单页应用看不出来——直到同一 origin 下还有别的东西。我在服务端日志里看到 `/tests/assets/app.css`、`/tests/src/main.js` 这种请求：请求 `/tests/offline.test.html` 拿到的是应用外壳，外壳里的相对路径于是被解析到 `/tests/` 下面全部 404。改成只对清单里真实存在的导航条目（`./`、`./index.html`）生效。**一个对外壳之外 URL 也作答的外壳，不是离线支持，是劫持。**

**从服务端那一侧看到的最终证据**（同一次真实浏览器会话）：

```
/sw.js                                  1 次   ← 注册
另一个 44 个路径                         各 2 次 ← 页面加载 + precache（cache:"reload"）
/tests/ 下的资源被劫持                    none  ← 导航回退修复生效
```

**离线测试页自己的结论**（7 项断言）：

```
OK   the boot module finished and reports what it did about the shell → registering
OK   a service worker is registered for this origin → scope /
OK   the worker reaches active → activated · active
OK   the worker answers the shell query → vwick-v2
OK   every file in the shell manifest is cached → 48/48 cached
OK   the cached shell is not empty → 48 entries
OK   section 04 reports a truthful worker state → active · shell cached · 48/48
7 passed · 0 failed
```

**写在最后的一件小事**：写这个测试页时我自己踩了三个坑，都记在 `AI_USAGE.md` 第 16 条里——没等引导模块就断言、把一次性的 `getRegistration()` 结果当活值用、把 `frame.contentDocument` 当稳定引用（它是快照，`contentWindow` 才是跨导航稳定的）。它们和上面那几个缺陷属于同一类错误：**信了一个此刻为真、下一刻不一定为真的假设**。定位方法很简单——给测试页加分步回传，让每一步都说话。

**这一轮的方法论收获**：服务端访问日志是一等公民的测试工具。它不需要打开 DevTools、不需要读浏览器的内部状态，就能回答「预缓存到底有没有发出那 48 个请求」。上面四个问题里，有三个是从日志里看出来的。
