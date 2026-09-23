import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, extname, relative, resolve, sep } from 'node:path';

const output = resolve('dist');
const origin = 'https://tool-sites.invalid';
const version = String(Date.now());
let updatedReferences = 0;

function hasHashSuffix(pathname, generatedAsset) {
  const name = basename(pathname, extname(pathname));
  const hexSuffix = name.match(/(?:^|[-._])([a-f0-9]{8,64})$/i)?.[1];
  return (generatedAsset && /-[A-Za-z0-9_-]{8}$/.test(name))
    || Boolean(hexSuffix && /[a-f]/i.test(hexSuffix));
}

function hasFilenameHash(file) {
  const generatedAsset = relative(output, file)
    .split(sep)
    .slice(0, -1)
    .includes('assets');
  return hasHashSuffix(file, generatedAsset);
}

function localFile(url, referringFile) {
  if (!url || url.startsWith('#')) {
    return undefined;
  }
  const base = `${origin}/${relative(output, referringFile).split(sep).join('/')}`;
  let parsed;
  try {
    parsed = new URL(url, base);
  }
  catch {
    return undefined;
  }
  if (parsed.origin !== origin) {
    return undefined;
  }
  let pathname;
  try {
    pathname = decodeURIComponent(parsed.pathname);
  }
  catch {
    return undefined;
  }
  const target = resolve(output, `.${pathname}`);
  if (target !== output && !target.startsWith(`${output}${sep}`)) {
    return undefined;
  }
  if (!existsSync(target)) {
    return undefined;
  }
  const file = statSync(target).isDirectory()
    ? resolve(target, 'index.html')
    : target;
  return existsSync(file) && statSync(file).isFile() ? file : undefined;
}

function versionedUrl(url, referringFile, includeHtml = false, includeRemote = true) {
  const file = localFile(url, referringFile);
  if (file) {
    if ((!includeHtml && extname(file) === '.html') || hasFilenameHash(file)) {
      return url;
    }
  }
  else {
    if (!includeRemote) {
      return url;
    }
    let parsed;
    try {
      parsed = new URL(url, `${origin}/`);
    }
    catch {
      return url;
    }
    if (
      parsed.origin === origin
      || !['http:', 'https:'].includes(parsed.protocol)
      || !extname(parsed.pathname)
      || (!includeHtml && extname(parsed.pathname) === '.html')
      || hasHashSuffix(parsed.pathname, false)
    ) {
      return url;
    }
  }
  const fragmentAt = url.indexOf('#');
  const pathAndQuery = fragmentAt === -1 ? url : url.slice(0, fragmentAt);
  const fragment = fragmentAt === -1 ? '' : url.slice(fragmentAt);
  const queryAt = pathAndQuery.indexOf('?');
  const path = queryAt === -1 ? pathAndQuery : pathAndQuery.slice(0, queryAt);
  const query = new URLSearchParams(
    queryAt === -1 ? '' : pathAndQuery.slice(queryAt + 1),
  );
  query.set('v', version);
  updatedReferences++;
  return `${path}?${query}${fragment}`;
}

function versionCssUrls(content, file) {
  return content.replace(
    /url\(\s*(?:(['"])(.*?)\1|([^)]*?))\s*\)/gi,
    (match, quote, quotedUrl, plainUrl) => {
      const url = quote ? quotedUrl : plainUrl.trim();
      const updated = versionedUrl(url, file);
      return updated === url ? match : `url(${quote || ''}${updated}${quote || ''})`;
    },
  );
}

function versionHtml(content, file) {
  const updatedTags = content.replace(
    /<(a|link|script|img|image|use|iframe|source|video|audio|track|object|embed|meta)\b[^>]*>/gi,
    (tag, tagName) => tag.replace(
      /(\s)(href|src|srcset|poster|data|data-default-src|content)\s*=\s*(['"])([\s\S]*?)\3/gi,
      (attribute, space, name, quote, url) => {
        const kind = name.toLowerCase();
        const allowHtml = tagName.toLowerCase() === 'iframe'
          || kind === 'data-default-src';
        const updated = kind === 'srcset'
          ? url.replace(/(^|,)(\s*)(\S+)([^,]*)/g,
            (candidate, separator, whitespace, source, descriptor) =>
              `${separator}${whitespace}${versionedUrl(source, file, false, tagName.toLowerCase() !== 'a')}${descriptor}`)
          : versionedUrl(url, file, allowHtml, tagName.toLowerCase() !== 'a');
        return updated === url
          ? attribute
          : `${space}${name}=${quote}${updated}${quote}`;
      },
    ),
  );
  return versionCssUrls(updatedTags, file);
}

for (const entry of readdirSync(output, { recursive: true, withFileTypes: true })) {
  if (!entry.isFile()) {
    continue;
  }
  const file = resolve(entry.parentPath, entry.name);
  const extension = extname(file);
  if (extension !== '.html' && (extension !== '.css' || hasFilenameHash(file))) {
    continue;
  }
  const original = readFileSync(file, 'utf8');
  const updated = extension === '.html'
    ? versionHtml(original, file)
    : versionCssUrls(original, file);
  if (updated !== original) {
    writeFileSync(file, updated);
  }
}

console.log(`Versioned ${updatedReferences} asset references with v=${version}.`);
