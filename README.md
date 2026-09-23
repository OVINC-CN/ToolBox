# Tool Box

Tool Box 是一个开箱即用的浏览器工具集合。首页汇集七个独立页面，涵盖时间转换、网络地址处理、数据格式化和交互演示。项目使用 Vite、React 和 TypeScript 构建。

## 功能特点

- 无需注册，打开即可使用。
- 各工具通过独立路径访问，首页卡片会在新标签页打开工具。
- 数据处理在浏览器本地完成。

## 工具一览

| 工具 | 路径 | 功能 |
| --- | --- | --- |
| Unix 时间戳 | `/unix/` | 在日期时间与 Unix 时间戳之间转换 |
| VM 装箱模拟 | `/box/` | 交互查看 VM 装箱过程 |
| IP 网段转换 | `/cidr/` | 转换 CIDR 网段、IP 范围与地址列表 |
| 骑行互动演示 | `/bike/` | 浏览骑行主题的交互页面 |
| 色彩流动 | `/flow/` | 体验动态色彩效果 |
| UUID 生成 | `/uuid/` | 生成并解读 UUID |
| JSON 格式化 | `/json/` | 格式化、编辑和校验 JSON |

## 快速开始

使用 Node.js 24（见 `.nvmrc`）和 npm：

```sh
npm ci
npm run dev
```

开发服务器启动后，打开终端显示的本地地址。

## 开发命令

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动本地开发服务器 |
| `npm run build` | 运行 ESLint、类型检查并生成静态页面 |
| `npm run preview` | 预览构建产物，需先运行 `npm run build` |
| `npm run lint` | 检查项目源码 |
| `npm run typecheck` | 检查 TypeScript 类型 |

## 项目结构

```text
pages/                    各工具的 HTML 入口
src/catalog.ts            首页工具清单
src/tools/                工具界面与业务逻辑
src/shared/               共享的 React 挂载代码
public/                   静态资源与公共样式
scripts/publish-pages.mjs 构建后整理页面路径
```

## 参与贡献

欢迎通过 Issue 反馈问题或提交 Pull Request。新增工具时，请在 `pages/` 添加页面入口，在 `src/tools/` 添加实现，并同步更新 `src/catalog.ts`；构建入口会从该清单生成。提交前运行 `npm run build`。

## 许可证

本项目采用 [MIT License](LICENSE)。
