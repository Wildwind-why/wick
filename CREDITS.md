# 来源与致谢 · wick 2.1

## 字体

自托管拉丁子集；不从 CDN 加载。三款字体使用 SIL OFL 1.1，已附对应版权与许可文本：

| 字体 | 项目 | 随包许可 |
| --- | --- | --- |
| Space Grotesk | [Google Fonts 官方条目](https://github.com/google/fonts/tree/main/ofl/spacegrotesk) | [OFL](assets/fonts/space-grotesk-OFL.txt) |
| JetBrains Mono | [Google Fonts 官方条目](https://github.com/google/fonts/tree/main/ofl/jetbrainsmono) | [OFL](assets/fonts/jetbrains-mono-OFL.txt) |
| Instrument Serif | [Google Fonts 官方条目](https://github.com/google/fonts/tree/main/ofl/instrumentserif) | [OFL](assets/fonts/instrument-serif-OFL.txt) |

## 代码与工具

客户端为原生 ES modules，服务器使用 Node 标准库，无第三方运行时包。SVG 图标、Canvas 火焰、场景图表与成绩卡为代码绘制。Python 标准库用于体积和打包；Playwright 与 Edge/Chrome 用于开发验证，不是应用运行依赖。

## 模型与协议

能耗系数是未标定的示意估算，未逐项复现某篇论文的数据。连接、发送和待机可复算，但不代表手机硬件测量，未完整覆盖重试、扫描、分片、接收等成本。JSON 对照是自建信封，不是现有聊天软件抓包。

加密实验依据 [RFC 8439](https://www.rfc-editor.org/rfc/rfc8439.html)，测试引用其 §2.3.2、§2.4.2、§2.5.2、§2.8.2 向量。通过测试向量不等于安全审计；JavaScript 执行时间不作恒时保证。独立实验使用公开演示密钥，中继未接入加密。

## 现有系统与浏览器边界

- [Meshtastic 官方说明](https://meshtastic.org/docs/overview/)：已有离网 LoRa 通信。本项目尚未做同硬件对照。
- [MDN Service Worker](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)：离线外壳依赖安全上下文及预先缓存。
- [MDN Web Bluetooth](https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API)：不能将本页面的 BLE 模型视作浏览器已实现手机 mesh。

历史整理记录提到的赛题信息仅为团队已有资料，本次未取得主办方原始规则文件。AI 使用见 [AI_USAGE](AI_USAGE.md)。

