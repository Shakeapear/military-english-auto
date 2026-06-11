# 军事英语自动答题助手

自动作答军事英语词汇题目的 Tampermonkey 用户脚本，通过本地题库双向匹配实现英汉互译自动答题，支持四种答题模式和两种题型。

## 核心功能

- **全自动答题** —— 进入答题页面自动检测题目并作答，无需任何手动操作
- **四种答题模式** —— 支持荣耀之战、无尽挑战、定时挑战、选题练习
- **两种题型** —— 选择题自动点击匹配选项，填空题自动填入答案并提交
- **双向翻译匹配** —— 英→中、中→英双方向词库查找，覆盖约 590 个词条
- **竞态安全** —— 代数锁机制防止异步回调冲突，题目切换时旧操作自动作废
- **页面可见性感知** —— 切换标签页时自动暂停，切回时自动恢复检测
- **看门狗超时恢复** —— 4000ms 无响应自动释放锁，防止卡死
- **词边界匹配** (v4.0) —— 防止短词误匹配长单词中的子串
- **别名/缩写索引** (v4.0) —— 自动识别括号内大写缩写并建立二级索引
- **可配置参数** —— CSS 选择器、重试策略、缓存容量等均可自定义

## 安装

### 前置条件

安装浏览器扩展 **Tampermonkey**（油猴）：

- [Chrome Web Store](https://chrome.google.com/webstore/detail/dhdgffkkebhmkfjojejmpbldmpobfkfo)
- [Firefox Add-ons](https://addons.mozilla.org/firefox/addon/tampermonkey/)
- [Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/iikmkjmpaadaobahmlepeloendndfphd)

### 安装步骤

1. 打开 Tampermonkey 管理面板（工具栏图标 →「管理面板」）
2. 点击右上角「+」新建脚本
3. 将 `军事英语自动答题-HighSpeed v4.0.user.js` 的全部内容粘贴到编辑器中
4. `Ctrl+S` 保存，确保脚本开关为绿色（已启用）

### 验证安装

访问任意答题页面，打开浏览器控制台（`F12`），应看到：

```
[HS] HighSpeed v4.0 已启动
```

## 快速开始

安装并启用脚本后，直接访问答题页面即可自动运行：

| 模式 | URL |
|------|-----|
| 荣耀之战 | `https://175.178.248.67/game/battle` |
| 无尽挑战 | `https://175.178.248.67/game/endless` |
| 定时挑战 | `https://175.178.248.67/game/timed` |
| 选题练习 | `https://175.178.248.67/game/custom` |

### 配置参数

编辑脚本顶部的 `CFG` 对象可调整行为：

```javascript
var CFG = {
    MAX_RETRIES:        3,       // 选项匹配最大重试次数
    RETRY_INTERVAL:     50,      // 首重试间隔 (ms)
    RETRY_BACKOFF_MUL:  1.8,     // 指数退避倍率
    SKIP_UNKNOWN:       true,    // 未知单词自动跳过
    PROCESSING_TIMEOUT: 4000,    // 看门狗超时 (ms)
    PERF_LOG:           false,   // 开启每题耗时输出
    DEBUG_LOG:          false,   // 开启详细调试日志
};
```

### 添加词条

在脚本中 `var dict = { ... };` 区域按格式添加：

```javascript
"英文或中文": "对应翻译",                          // 单值
"英文或中文": ["翻译1", "翻译2", "翻译3"],          // 多值数组
```

词库会自动处理全角/半角、大小写、空白等规范化问题，无需手动调整格式。

## 版本选择

| 版本 | 文件 | 说明 |
|------|------|------|
| **v4.0 (推荐)** | `军事英语自动答题-HighSpeed v4.0.user.js` | 词边界匹配 + 别名索引 + DOM 指纹去重 |
| v3.0 | `军事英语自动答题-HighSpeed v3.0.user.js` | P0-P2 全量性能优化，每题 ~30ms |
| v2.0 | `军事英语自动答题-HighSpeed v2.0.user.js` | 模块化重构，竞态安全，~60ms |
| v1.0 | `军事英语自动答题 v1.0.user.js` | 基础实现，兼容性最好 |

v4.0 需要浏览器支持 `Map` 和 `Uint8Array`（Chrome 38+ / Firefox 19+ / Edge 12+，所有现代浏览器均满足）。

## 常见问题

**Q: 脚本似乎没有运行？**
确认 Tampermonkey 已启用、脚本开关绿色、URL 匹配 `https://175.178.248.67/*`。

**Q: 控制台提示「题库中未找到该题目的答案」？**
当前题目不在内置词库中。若 `SKIP_UNKNOWN = true`（默认），脚本自动跳过。可在 `dict` 中添加该词条。

**Q: 如何适配新网站或 DOM 变更？**
修改 `CFG` 中对应的 CSS 选择器即可，各选择器用途见脚本顶部注释。

**Q: 可以同时安装多个版本吗？**
可以，但注意 `@name` 不同则视为不同脚本。同时启用会导致并发竞争，不建议。

## 贡献

欢迎提交 Issue 和 Pull Request。

### 开发指引

- 添加新词条：编辑 `dict` 对象，参考 `词库.txt`（TSV 格式，按主题分组）
- 适配新网站：修改 `CFG` 中的 CSS 选择器
- 添加新题型：在 `getQuestionType()` 中增加检测逻辑，在 `processQuestion()` 中增加处理分支
- 调试：设置 `CFG.DEBUG_LOG = true` 查看详细日志，设置 `CFG.PERF_LOG = true` 输出每题耗时

代码风格约定：
- ES5 语法（`var`、`function`），兼容老旧浏览器
- 模块注释使用 ASCII 框线分隔段落
- DOM 查询统一使用 `$_q(sel)` / `$_qa(sel)` 封装

## 许可证

本项目采用 **GNU General Public License v3.0**（或更高版本）。

```
Copyright (C) 2026  Shakeapear

本程序是自由软件：你可以基于自由软件基金会发布的 GNU 通用公共许可证
（GPL）第三版（或你选择的任何更高版本）的条款重新分发或修改它。

本程序发布的目的是希望它有用，但不提供任何担保；甚至不保证适销性或
适用于特定目的。详情参见 GNU 通用公共许可证。

你应该已收到一份 GNU 通用公共许可证的副本。如果没有，请参阅
<https://www.gnu.org/licenses/>.
```

完整的许可证文本参见项目根目录下的 [`LICENSE`](./LICENSE) 文件。

### GPL 合规说明

- 所有源代码文件（`.user.js`）均在文件头部包含完整的版权声明和 GPL 许可头。
- 衍生作品（修改版本）必须以相同许可证（GPL v3.0+）发布，并在修改处标注变更。
- 本项目为纯 JavaScript 实现，运行于 Tampermonkey 用户脚本环境，无第三方代码依赖，不存在许可证兼容性问题。
- 贡献者提交代码即表示同意将其贡献以 GPL v3.0+ 许可发布。

---

## 项目文件

```
wwjb/
├── LICENSE                                           # GPL v3.0 许可证全文
├── README.md
├── 词库.txt                                          # 词库源文件 (TSV)
├── 军事英语自动答题 v1.0.user.js                     # v1.0 基础版
├── 军事英语自动答题-HighSpeed v2.0.user.js           # v2.0 高速版
├── 军事英语自动答题-HighSpeed v3.0.user.js           # v3.0 性能版
└── 军事英语自动答题-HighSpeed v4.0.user.js           # v4.0 增强版 (推荐)
```
