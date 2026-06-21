# 手工织锦纹样排版台

直接打开`index.html`使用。支持网格绘制、色线统计、撤销重做、本地保存和导出JSON。

## 本地运行

无需构建，直接在浏览器打开 `index.html` 即可使用。

若需运行自动化质量检查，先安装 Node.js 18+，然后：

```bash
# 首次运行安装依赖
npm install
```

## 质量门禁（本地检查命令）

```bash
# 一键运行所有三级检查（HTML引用 → 模块顺序 → 单元测试）
npm run check

# 单独运行每一级
npm run check:html   # 1级：检查 index.html 中引用的 45 个本地 JS/CSS 文件是否存在
npm run check:order  # 2级：验证 39 个 IIFE 全局模块的加载顺序，硬依赖必须先加载
npm run test         # 3级：运行 63 个核心逻辑单元测试（Mocha + JSDOM）
```

**三级门禁说明：**

| 级别 | 命令 | 检查内容 | 失败原因 |
|------|------|----------|----------|
| 1 | `check:html` | 解析 `<script src>` / `<link href>` 本地路径，验证文件存在 | 改了文件名但忘记更新 index.html |
| 2 | `check:order` | 静态扫描每个 IIFE 模块的硬依赖（顶层直接访问），确认已先加载 | 调整了 script 顺序导致依赖颠倒 |
| 3 | `test` | JSDOM 加载 22 个核心逻辑模块，运行 63 个纯函数用例 | 核心计算逻辑被改坏 |

## CI 持续集成

GitHub Actions 配置在 [.github/workflows/quality-gate.yml](.github/workflows/quality-gate.yml)，push / PR 时自动触发：

```
Node 20.x
  ├─ npm ci（缓存依赖）
  ├─ npm run check:html  ✅ 45/45 引用存在
  ├─ npm run check:order ✅ 0 硬依赖错误
  └─ npm run test        ✅ 63 个用例全通过
```

## 项目结构（与质量门禁相关）

```
├── scripts/
│   ├── check-html-refs.js      # 1级：HTML 引用存在性扫描
│   └── check-module-order.js   # 2级：IIFE 模块依赖顺序分析
├── tests/
│   ├── test-setup.js           # JSDOM + VM 沙箱加载 22 个核心逻辑模块
│   └── core-logic.test.js      # 3级：63 个核心纯函数测试用例
├── .github/workflows/
│   └── quality-gate.yml        # CI 工作流
└── package.json                # 定义所有检查脚本
```

**设计原则：不引入打包改造**。所有模块仍保持原生 IIFE 模式，浏览器打开 `index.html` 直接可用；质量门禁通过 Node.js + JSDOM + VM 沙箱模拟浏览器环境运行，无需 webpack/vite 等构建工具。
