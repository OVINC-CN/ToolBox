# ToolSites 维护约定

- 本项目是部署到 EdgeOne 或 Cloudflare Pages 的 Vite + React + TypeScript 多页面工具集。
- 首页卡片链接到各工具子路径，并在新标签页打开。
- 非鹈鹕页面的字体由 `public/fonts.css` 统一声明：JetBrains Mono 用于拉丁文字，Source Han Mono SC 用于非拉丁文字；只引用 CDN 资源，不把字体文件加入仓库。
- 页面入口放在 `pages/`，工具目录及首页信息集中在 `src/catalog.ts`，业务代码放在 `src/tools/`。新增工具时同步更新目录、页面入口和构建入口。
- `public/` 存放直接复制到产物的静态文件；`scripts/publish-pages.mjs` 将 Vite 生成的页面入口移到公开路径。
- 鹈鹕页面的链接和资源使用 `/bike/` 下的绝对路径，直接访问 `dist/bike/` 中的单份文件，不在 `dist` 根目录复制版本 ID 目录或生成跳转规则。
- 项目自有 JS/TS 源码遵循 `eslint.config.mjs`：两空格缩进、零警告，TypeScript 使用类型感知严格规则。`public/bike/` 和 `src/tools/uuid/vendor/` 排除在 ESLint 自动修复之外。
- 仓库不保留测试文件或测试命令。修改后运行 `npm run build`，由 ESLint、类型检查和 Vite 构建确认产物；不要为鹈鹕原作品添加单元、端到端或浏览器测试。
- `dist/` 和依赖目录是生成内容，不手工修改。更新依赖时保持 `package.json` 与 `package-lock.json` 一致。
- 不得将密钥或 Sites 凭据写入代码和文档。提交信息使用英文 Conventional Commits 格式，例如 `chore(repo): update dependencies`。
