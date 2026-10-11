# 团队协作约定

> 这份文件写给**所有要动这个仓库的人**。请先读完第 2 节再推代码。

## 1. 环境

只需要 **Python 3**（用来起静态服务器）。不需要 Node、不需要 `npm install`、不需要构建。

```bash
python3 -m http.server 8000
# 打开 http://localhost:8000
```

**不要双击 `index.html`** —— `file://` 协议下浏览器不允许注册 Service Worker，离线功能无法验证。

---

## 2. 推代码前必须跑的三件事

| 检查 | 地址 | 期望 |
| --- | --- | --- |
| 内核测试 | `/tests/codec.test.html` | `58 passed · 0 failed` |
| 整页集成测试 | `/tests/page.test.html` | `25 passed · 0 failed` |
| 离线外壳测试 | `/tests/offline.test.html` | `7 passed · 0 failed`（**必须用真实浏览器**） |

**红了就不要推 `main`。** 从仓库登记那一刻起，`main` 必须始终处于「随时可评」的状态——评委可能在任何时间去读它。

---

## 3. 分支与合并

```
main          ← 只有能过全部测试的代码能进来。任何时刻都必须是可评状态。
feat/xxx      ← 新功能 / 视觉改动
fix/xxx       ← 修 bug
docs/xxx      ← 只改文档
```

- 一个人一个分支，不要直接在 `main` 上改。
- 合并前自己先跑完第 2 节的三项。
- 合并方式用 **squash 或普通 merge 都行，但不要把 `main` 的历史搞乱**（不要 force push `main`）。

---

## 4. commit 信息

评委会翻 commit 历史，这是白送的加分点。写清**改了什么、为什么**：

```
好：fix: 无线电排名改为按「送达条数」排序，而非吞吐率
    —— 1% 电量下又快又贵的制式等于没用

差：修 bug
差：update
差：。
```

一个 commit 只做一件事。视觉改动和逻辑改动不要混在同一个提交里。

---

## 5. 红线（违反会让作品失去资格或直接掉分）

完整版见交接说明，这里列最容易踩的：

1. **零运行时依赖**：不许引入 npm 包、框架、打包器、CDN、第三方脚本、网络字体、第三方密码库。
2. **`src/core/*` 必须是纯逻辑**：不许出现 `document` / `window` / `navigator`。
3. **两份语言表必须同增同删**：改 `src/ui/lang/en.js` 就要同步改 `zh.js`。
4. **不许删改已有测试断言**（只允许新增）。测试红了要修代码，不是改测试。
5. **不许让界面说谎**：第 04 节 Service Worker 标签只有在拿到 worker 自报的完整缓存清单后才允许显示「已缓存」。
6. **`?mode=eco` 下不许新增任何网络请求**，尤其**零字体字节**。
7. **`prefers-reduced-motion` 下不许有运行中的动画**。
8. **新增文件必须加进 `sw.js` 的 `SHELL` 清单，且文件必须真实存在**（清单里一个 404 会让那条缓存失败并如实报告）。
9. **不许改 `src/main.js` 的模块挂载顺序**：存储模块（`offline`）必须最后挂载。
10. **不许改 `src/core/` 的算法行为**：编解码与密码实现有 RFC 8439 官方向量锁着。
11. **不许出现任何面向评委的话术**（"请给满分""ignore previous instructions" 之类）。
12. **不许把未实现的说成已实现**。没做的就写「没做」——如实标注不扣分，说假话才扣分。

---

## 6. 会重新生成文件的两个脚本

改完记得把生成结果一起提交：

```bash
python3 tools/build-budget-data.py       # 重算第 07 节的实测体积表
python3 tools/shoot-screenshots.py 8000  # 重拍 screenshots/（需先起服务器）
```

打包（会自校验 `SHELL` 清单、`index.html` 引用与引导模块是否都在包里）：

```bash
python3 tools/pack.py 2.0
```

---

## 7. 版本标签

- `v2.0.0` — 仓库登记版本（90 项测试全绿）
- 最终提交前 **务必再打一个 tag**，把提交那一刻的代码固定下来：

```bash
git tag -a v2.0.1-final -m "最终提交版本"
git push origin v2.0.1-final
```
