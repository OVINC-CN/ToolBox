import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { tools } from './src/catalog.ts';

// 源 HTML 集中放在 pages/，公开地址仍位于各工具子路径。
// 本地 Vite 服务直接打开 public/bike/ 下的目录首页。
function pageDevRoutes(): Plugin {
  const appRoutes = new Set<string>(
    tools.filter(tool => tool.id !== 'bike').map(tool => tool.id),
  );
  function splitRequestUrl(url: string) {
    const queryStart = url.indexOf('?');
    return queryStart === -1
      ? { pathname: url, suffix: '' }
      : { pathname: url.slice(0, queryStart), suffix: url.slice(queryStart) };
  }
  function bikeIndexPath(pathname: string): string | undefined {
    if (pathname === '/bike' || pathname === '/bike/') {
      return '/bike/index.html';
    }
    const match = /^\/bike\/([a-f0-9]{64})\/?$/.exec(pathname);
    return match ? `/bike/${match[1]}/index.html` : undefined;
  }
  return {
    name: 'page-dev-routes',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (!request.url || !['GET', 'HEAD'].includes(request.method ?? '')) {
          next();
          return;
        }
        const { pathname, suffix } = splitRequestUrl(request.url);
        const appName = pathname.slice(1);
        if (appRoutes.has(appName)) {
          response.writeHead(308, { Location: `${pathname}/${suffix}` });
          response.end();
          return;
        }
        if (pathname === '/') {
          request.url = `/pages/index.html${suffix}`;
        }
        else {
          const route = pathname.slice(1, -1);
          if (appRoutes.has(route)) {
            request.url = `/pages/${route}/index.html${suffix}`;
          }
          else {
            const index = bikeIndexPath(pathname);
            if (index) {
              request.url = `${index}${suffix}`;
            }
          }
        }
        next();
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((request, _response, next) => {
        if (!request.url || !['GET', 'HEAD'].includes(request.method ?? '')) {
          next();
          return;
        }
        const { pathname, suffix } = splitRequestUrl(request.url);
        const index = bikeIndexPath(pathname);
        if (index) {
          request.url = `${index}${suffix}`;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  appType: 'mpa',
  publicDir: 'public',
  plugins: [pageDevRoutes(), react()],
  build: {
    rollupOptions: {
      input: {
        home: resolve('pages/index.html'),
        ...Object.fromEntries(
          tools
            .filter(tool => tool.id !== 'bike')
            .map(tool => [tool.id, resolve(`pages/${tool.id}/index.html`)]),
        ),
      },
    },
  },
});
