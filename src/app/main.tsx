import { Suspense, useLayoutEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Route, Routes } from 'react-router';
import { lazyPage, tools } from './catalog';
import ToolLayout from './ToolLayout';
import missingStyles from './not-found.css?inline';

const Home = lazyPage(() => import('../home/App'));
const homeTitle = document.title;
const homeDescription = document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content ?? '';

function PageHead({ title, description }: { title: string; description: string }) {
  useLayoutEffect(() => {
    document.title = title;
    document.querySelector('meta[name="description"]')?.setAttribute('content', description);
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', title);
    document.querySelector('meta[property="og:description"]')?.setAttribute('content', description);
  }, [title, description]);
  return null;
}

function App() {
  const home = (
    <>
      <PageHead title={homeTitle} description={homeDescription} />
      <Home />
    </>
  );
  return (
    <BrowserRouter>
      <Suspense fallback={<p className="page-loading" role="status">正在加载…</p>}>
        <Routes>
          <Route path="/" element={home} />
          <Route path="/index.html" element={home} />
          <Route element={<ToolLayout />}>
            {tools.map(({ id, url, Page, pageTitle, pageDescription }) => {
              const page = (
                <>
                  <PageHead title={pageTitle} description={pageDescription} />
                  <Page />
                </>
              );
              return (
                <Route key={id} path={url}>
                  <Route index element={page} />
                  <Route path="index.html" element={page} />
                </Route>
              );
            })}
          </Route>
          <Route
            path="*"
            element={(
              <>
                <PageHead title="页面未找到 · Tool Box" description="这个页面不存在。" />
                <style>{missingStyles}</style>
                <main className="not-found">
                  <h1>404</h1>
                  <p>这个页面不存在。</p>
                  <Link to="/">返回 Tool Box</Link>
                </main>
              </>
            )}
          />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

const root = document.getElementById('root');
if (!root) {
  throw new Error('Missing React root');
}
createRoot(root).render(<App />);
