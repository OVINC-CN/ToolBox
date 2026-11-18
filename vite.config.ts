import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { tools } from './src/catalog.ts';

// 源 HTML 集中放在 pages/，公开地址仍位于各工具子路径。
function pageDevRoutes(): Plugin {
  const appRoutes = new Set<string>(tools.map(tool => tool.id));
  function splitRequestUrl(url: string) {
    const queryStart = url.indexOf('?');
    return queryStart === -1
      ? { pathname: url, suffix: '' }
      : { pathname: url.slice(0, queryStart), suffix: url.slice(queryStart) };
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
        else if (pathname.endsWith('/')) {
          const route = pathname.slice(1, -1);
          if (appRoutes.has(route)) {
            request.url = `/pages/${route}/index.html${suffix}`;
          }
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
    license: true,
    rollupOptions: {
      input: {
        home: resolve('pages/index.html'),
        ...Object.fromEntries(
          tools.map(tool => [tool.id, resolve(`pages/${tool.id}/index.html`)]),
        ),
      },
    },
  },
});
