<p align="center">
  <img src="public/logo.svg" alt="Tool Box" width="160">
</p>

<h1 align="center">Tool Box</h1>

Tool Box 提供时间戳转换、UUID 生成、JSON 格式化、IP 网段转换、URL 编解码、VM 装箱模拟和正则可视化。每个工具有独立网址，数据处理在浏览器本地完成。

## 开发与目录

使用 Node.js 24 和项目固定的 pnpm 版本。运行 `corepack enable pnpm`、`pnpm install --frozen-lockfile`、`pnpm dev` 启动开发服务。运行 `pnpm run build` 校验并生成 `dist/`。

| 位置 | 职责 |
| --- | --- |
| `index.html` | 全站唯一的 HTML 入口 |
| `src/app/` | 挂载 React 应用，维护路由、工具目录、公共顶栏和工具主题 |
| `src/components/` | 共享 React 图标组件 |
| `src/home/` | 首页搜索与工具卡片 |
| `src/tools/<工具名>/` | 工具组件、样式与业务逻辑 |
| `public/logo.svg` | 首页与工具导航共用的站点 Logo |
| `public/extra-assets/` | 站点图标、图片、字体样式表和第三方声明，构建时发布到 `/extra-assets/` |

新增工具时，在工具目录中提供默认导出的 React 组件，并将页面 CSS 以 `styles` 导出。在 `src/app/catalog.tsx` 登记工具标识、卡片信息和加载函数，首页链接和路由会自动生成。

部署时发布 `dist/`。静态服务器优先返回已有资源，将页面请求回退到 `/index.html`，以便直接打开和刷新 `/json/` 等工具网址。

## CDN 刷新

构建完成后，在仓库根目录生成 CDN 刷新清单：

```sh
make cdn-urls CDN_ORIGIN=https://tools.example.com
```

`CDN_ORIGIN` 填部署站点的协议和域名。`CDN_WEB_DIST` 默认是 `dist`，可指定本次发布使用的其他产物目录。输出每行一个 URL，覆盖首页、带斜杠和不带斜杠的工具入口，以及产物目录中的静态文件（含根目录的 `/index.html`）。新增或调整工具路径时，同步更新 [CDN 清单脚本](scripts/cdn-urls.ts) 中的固定路径。

本项目采用 [MIT 许可证](LICENSE)。随源码分发的第三方资源见[版权声明](public/extra-assets/third-party-notices.txt)。
