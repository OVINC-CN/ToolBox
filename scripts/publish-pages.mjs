import {
  existsSync,
  mkdirSync,
  renameSync,
  readdirSync,
  rmSync,
} from 'node:fs';
import { resolve } from 'node:path';

const output = resolve('dist');
const source = resolve(output, 'pages');
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

if (!existsSync(resolve(output, '404.html'))) {
  throw new Error('Missing static 404 page');
}
console.log(`Published ${routes.length} pages.`);
