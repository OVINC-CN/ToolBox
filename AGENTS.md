# ToolSites 维护约定

- 本项目是部署到 EdgeOne 或 Cloudflare Pages 的 Vite + React + TypeScript 单入口 React 工具集。
- 页面文案只写功能名称、操作说明、状态和结果。禁止添加宣传口号，工具名称由导航菜单展示。
- 首页卡片和工具菜单通过 React Router 在当前标签页内跳转到各工具子路径。
- 页面的字体由 `public/extra-assets/fonts.css` 统一声明：JetBrains Mono 用于拉丁文字，Source Han Mono SC 用于非拉丁文字；只引用 CDN 资源，不把字体文件加入仓库。
- 各页面外层内容区域的最大宽度统一为 `1600px`，居中显示并保留窄屏边距。
- 全站入口为根目录 `index.html`。React Router 使用原有子路径，首页在 `src/home/`，各工具组件与样式放在 `src/tools/<id>/`。在 `src/app/catalog.tsx` 登记工具即可生成首页卡片和路由。
- `public/` 存放直接复制到产物的静态文件。部署时启用客户端路由回退，将页面请求交给 `/index.html`。
- 全站 Logo 保留在 `public/logo.svg`。其他自定义静态资源统一放在 `public/extra-assets/`，`dist/assets/` 只存放打包后的 JS 和 CSS。各工具共用 `ToolLayout` 顶栏与主题，通过 Logo 右侧的下拉菜单切换；首页使用自己的布局。
- 构建时给没有文件名哈希的静态资源引用追加同一次构建的 `?v=` 时间戳；保留 Vite 已带哈希的资源 URL 和普通导航链接。
- 项目自有 JS/TS 源码遵循 `eslint.config.mjs`：两空格缩进、零警告，TypeScript 使用类型感知严格规则。`src/tools/uuid/vendor/` 排除在 ESLint 自动修复之外。
- 包管理器统一使用 pnpm，通过 Corepack 读取 `package.json` 的 `packageManager` 固定版本；CI 和部署安装依赖使用 `pnpm install --frozen-lockfile`；避免使用 pnpm store，没权限就申请
- 仓库不保留测试文件或测试命令。修改后运行 `pnpm run build`，由 ESLint、类型检查和 Vite 构建确认产物。
- `dist/` 和依赖目录是生成内容，不手工修改。更新依赖时保持 `package.json`、`pnpm-workspace.yaml` 与 `pnpm-lock.yaml` 一致；不保留 `package-lock.json`。
- 不得将密钥或 Sites 凭据写入代码和文档。提交信息使用英文 Conventional Commits 格式，例如 `chore(repo): update dependencies`。
