import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const version = String(Date.now());

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'version-cdn-fonts',
      apply: 'build',
      generateBundle() {
        const css = readFileSync('public/extra-assets/fonts.css', 'utf8');
        const source = css.replace(/url\('([^']+)'\)/g, (_match, href: string) => {
          const url = new URL(href);
          url.searchParams.set('v', version);
          return `url('${url.href}')`;
        });
        this.emitFile({ type: 'asset', fileName: 'extra-assets/fonts.css', source });
      },
    },
  ],
  experimental: {
    renderBuiltUrl(filename, { type }) {
      if (type === 'public') {
        return `/${filename}?v=${version}`;
      }
    },
  },
  build: { license: true },
});
