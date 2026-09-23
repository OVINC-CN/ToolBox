import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { relative, resolve } from 'node:path';

const output = resolve('dist');
const source = resolve(output, 'pages');
const originals = resolve('public/bike');
const originalFiles = readdirSync(originals, {
  recursive: true,
  withFileTypes: true,
})
  .filter(entry => entry.isFile())
  .map(entry => relative(originals, resolve(entry.parentPath, entry.name)));
const routes = [
  '',
  ...readdirSync('pages', { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name),
];

for (const route of routes) {
  const from = resolve(source, route, 'index.html');
  const to = resolve(output, route, 'index.html');
  if (!existsSync(from) || existsSync(to)) {
    throw new Error(`Cannot publish page: ${route || '/'}`);
  }
  mkdirSync(resolve(output, route), { recursive: true });
  renameSync(from, to);
}
if (
  readdirSync(source, { recursive: true }).some(name =>
    name.endsWith('.html'),
  )
) {
  throw new Error('Unregistered HTML page remains under dist/pages');
}
rmSync(source, { recursive: true, force: true });

// 原始选择页使用根绝对路径，Pages 将这些请求映射到 /bike/ 下的唯一副本。
const { versions } = JSON.parse(
  readFileSync(resolve(originals, 'versions.json'), 'utf8'),
);
const rules = [
  '/version-switcher.js /bike/version-switcher.js 200',
  '/version-switcher.css /bike/version-switcher.css 200',
];
for (const { id } of versions) {
  if (!/^[a-f0-9]{64}$/.test(id)) {
    throw new Error('Invalid original version ID');
  }
  rules.push(`/${id} /${id}/ 308`);
  rules.push(`/${id}/ /bike/${id}/ 200`);
  for (const file of originalFiles.filter(file =>
    file.startsWith(`${id}/`),
  )) {
    rules.push(`/${file} /bike/${file} 200`);
  }
}
if (rules.length > 2000) {
  throw new Error('Too many Pages static mappings');
}
writeFileSync(resolve(output, '_redirects'), rules.join('\n') + '\n');
if (
  readdirSync(output, { withFileTypes: true }).some(
    entry => entry.isDirectory() && /^[a-f0-9]{64}$/.test(entry.name),
  )
) {
  throw new Error('Duplicate Pelican version directory at output root');
}
if (!existsSync(resolve(output, '404.html'))) {
  throw new Error('Missing static 404 page');
}
console.log(
  `Published ${routes.length} pages and ${versions.length} original Pelican versions.`,
);
