import { readdir } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import process, { argv, stderr, stdout } from 'node:process';

// 与 src/app/main.tsx 和 src/app/catalog.tsx 中的页面路由同步。
const toolPaths = ['/unix', '/uuid', '/json', '/cidr', '/urlencode', '/box', '/regex'];
const pagePaths = [
  '/',
  ...toolPaths.flatMap(path => [path, `${path}/`]),
];

async function listAssetPaths(dist: string) {
  const entries = await readdir(dist, { recursive: true, withFileTypes: true });
  const paths = entries
    .filter(entry => entry.isFile())
    .map(entry => relative(dist, resolve(entry.parentPath, entry.name)));
  if (!paths.includes('index.html')) {
    throw new Error('CDN_WEB_DIST 中没有 index.html，请指定前端部署产物目录');
  }
  return paths.map(path => `/${path.split(sep).map(encodeURIComponent).join('/')}`);
}

async function main() {
  const [, , originValue, dist] = argv;
  if (!originValue || !dist) {
    throw new Error('请设置 CDN_ORIGIN 和 CDN_WEB_DIST');
  }
  const origin = URL.parse(originValue);
  if (
    !origin
    || !['http:', 'https:'].includes(origin.protocol)
    || origin.href !== `${origin.origin}/`
  ) {
    throw new Error('CDN_ORIGIN 必须是前端站点的 HTTP 或 HTTPS 源地址');
  }

  const paths = [...pagePaths, ...await listAssetPaths(resolve(dist))];
  const urls = new Set(paths.map(path => new URL(path, origin).href));
  stdout.write(`${[...urls].sort().join('\n')}\n`);
}

try {
  await main();
}
catch (error) {
  stderr.write(`${error instanceof Error ? error.message : '生成 CDN 刷新清单失败'}\n`);
  process.exitCode = 1;
}
