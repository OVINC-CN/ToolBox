import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { tools } from './src/catalog.ts';

// 源 HTML 集中放在 pages/，公开地址仍位于各工具子路径。
// 本地 Vite 服务映射鹈鹕原页面的绝对路径；生产环境使用平台路由配置。
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
  const { versions } = JSON.parse(
    readFileSync(resolve('public/bike/versions.json'), 'utf8'),
  ) as { versions: { id: string }[] };
  const versionIds = new Set(versions.map(version => version.id));
  function pelicanAlias(pathname: string): string | undefined {
    if (
      pathname === '/version-switcher.js'
      || pathname === '/version-switcher.css'
    ) {
      return `/bike${pathname}`;
    }
    const match = /^\/([a-f0-9]{64})(\/(.*))?$/.exec(pathname);
    if (!match || !versionIds.has(match[1])) {
      return undefined;
    }
    return `/bike/${match[1]}/${match[3] || 'index.html'}`;
  }
  function canonicalPelicanPath(pathname: string): boolean {
    if (pathname === '/bike') {
      return true;
    }
    const match = /^\/(?:bike\/)?([a-f0-9]{64})$/.exec(pathname);
    return Boolean(match && versionIds.has(match[1]));
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
        const needsSlash
          = appRoutes.has(appName) || canonicalPelicanPath(pathname);
        if (needsSlash) {
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
          else if (
            pathname === '/bike/'
            || /^\/bike\/[a-f0-9]{64}\/$/.test(pathname)
          ) {
            request.url = `${pathname}index.html${suffix}`;
          }
          else {
            const alias = pelicanAlias(pathname);
            if (alias) {
              request.url = `${alias}${suffix}`;
            }
          }
        }
        next();
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((request, response, next) => {
        if (!request.url || !['GET', 'HEAD'].includes(request.method ?? '')) {
          next();
          return;
        }
        const { pathname, suffix } = splitRequestUrl(request.url);
        if (canonicalPelicanPath(pathname)) {
          response.writeHead(308, { Location: `${pathname}/${suffix}` });
          response.end();
          return;
        }
        const alias = pelicanAlias(pathname);
        if (alias) {
          request.url = `${alias}${suffix}`;
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
