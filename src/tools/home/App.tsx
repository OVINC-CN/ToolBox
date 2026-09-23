import { useEffect, useRef, useState } from 'react';
import { tools } from '../../catalog';

function ToolGraphic({ kind }: { kind: string }) {
  if (kind === 'json') {
    return (
      <div className="tool-graphic json-graphic" aria-hidden="true">
        <span>{'{ }'}</span>
      </div>
    );
  }

  if (kind === 'uuid') {
    return (
      <div className="tool-graphic uuid-graphic" aria-hidden="true">
        <span className="uuid-frame uuid-frame-back" />
        <span className="uuid-frame uuid-frame-front">
          <span className="uuid-symbol">#</span>
          <span className="uuid-label">UUID</span>
        </span>
      </div>
    );
  }

  if (kind === 'bike') {
    return (
      <div className="tool-graphic bike-graphic" aria-hidden="true">
        <span className="bike-ring bike-ring-left" />
        <span className="bike-ring bike-ring-right" />
        <span className="bike-link bike-link-left" />
        <span className="bike-link bike-link-right" />
        <span className="bike-link bike-link-top" />
        <span className="bike-hub bike-hub-left" />
        <span className="bike-hub bike-hub-right" />
      </div>
    );
  }

  if (kind === 'flow') {
    return (
      <div className="tool-graphic flow-graphic" aria-hidden="true">
        <span className="flow-line flow-line-one" />
        <span className="flow-line flow-line-two" />
        <span className="flow-line flow-line-three" />
        <span className="flow-line flow-line-four" />
        <span className="flow-node flow-node-one" />
        <span className="flow-node flow-node-two" />
      </div>
    );
  }

  if (kind === 'clock') {
    return (
      <div className="tool-graphic clock-graphic" aria-hidden="true">
        <span className="clock-dot" />
        <span className="clock-hand clock-hand-hour" />
        <span className="clock-hand clock-hand-minute" />
        <span className="clock-ring clock-ring-one" />
        <span className="clock-ring clock-ring-two" />
      </div>
    );
  }

  if (kind === 'cidr') {
    return (
      <div className="tool-graphic cidr-graphic" aria-hidden="true">
        <span className="cidr-node cidr-root">10.0/8</span>
        <span className="cidr-line cidr-line-left" />
        <span className="cidr-line cidr-line-right" />
        <span className="cidr-node cidr-leaf cidr-leaf-left">/16</span>
        <span className="cidr-node cidr-leaf cidr-leaf-right">/24</span>
      </div>
    );
  }

  return (
    <div className="tool-graphic box-graphic" aria-hidden="true">
      <span className="box-layer box-layer-one" />
      <span className="box-layer box-layer-two" />
      <span className="box-layer box-layer-three" />
      <span className="box-cube">VM</span>
    </div>
  );
}

export default function Home() {
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const terms = query.trim().toLocaleLowerCase().split(/\s+/);
  const filteredTools = tools.filter(tool =>
    terms.every(term =>
      [tool.title, tool.description, tool.url].some(value =>
        value.toLocaleLowerCase().includes(term),
      ),
    ),
  );

  useEffect(() => {
    searchRef.current?.focus({ preventScroll: true });

    function focusSearch(event: KeyboardEvent) {
      if (event.key !== '/' || event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }
      if (
        event.target instanceof HTMLElement
        && (event.target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName))
      ) {
        return;
      }
      event.preventDefault();
      searchRef.current?.focus();
    }

    window.addEventListener('keydown', focusSearch);
    return () => {
      window.removeEventListener('keydown', focusSearch);
    };
  }, []);

  function clearSearch() {
    setQuery('');
    searchRef.current?.focus();
  }

  return (
    <main>
      <nav className="topbar" aria-label="主导航">
        <a className="brand" href="#top" aria-label="返回页面顶部">
          <span className="brand-mark" aria-hidden="true" />
          TOOL BOX
        </a>
        <span className="catalog-count">
          工具集 ·
          {tools.length.toString().padStart(2, '0')}
        </span>
      </nav>

      <section className="hero" id="top">
        <div className="hero-kicker">
          <span>UTILITY COLLECTION</span>
          <span aria-hidden="true">↘</span>
        </div>
        <h1>
          小而好用的工具，
          <span>放在一起。</span>
        </h1>
        <div className="hero-meta">
          <p>一些解决具体问题的轻量工具。无需注册，打开即用。</p>
          <div className="availability">
            <span className="status-dot" aria-hidden="true" />
            ALL SYSTEMS READY
          </div>
        </div>
      </section>

      <section className="search-bar" role="search" aria-label="搜索工具">
        <label className="search-label" htmlFor="tool-search">快速搜索</label>
        <div className="search-field">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="10.5" cy="10.5" r="6.5" />
            <path d="m15.5 15.5 5 5" />
          </svg>
          <input
            id="tool-search"
            ref={searchRef}
            type="search"
            autoComplete="off"
            spellCheck={false}
            aria-controls="tool-list"
            placeholder="搜索名称、描述或路由"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                clearSearch();
              }
            }}
          />
          {query && (
            <button className="search-clear" type="button" onClick={clearSearch}>清除</button>
          )}
          {!query && (
            <kbd className="search-shortcut" aria-hidden="true">/</kbd>
          )}
        </div>
        <span className="search-count" role="status">
          匹配
          {' '}
          {filteredTools.length.toString().padStart(2, '0')}
          {' '}
          /
          {' '}
          {tools.length.toString().padStart(2, '0')}
        </span>
      </section>

      <section className="tool-grid" id="tool-list" aria-label="工具列表">
        {filteredTools.map(tool => (
          <a
            className={`tool-card tool-card-${tool.tone}`}
            href={tool.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`在新标签页打开${tool.title}`}
            key={tool.url}
          >
            <div className="card-topline">
              <span>
                {tool.index}
                {' '}
                /
                {tools.length.toString().padStart(2, '0')}
              </span>
              <span className="open-icon" aria-hidden="true">
                ↗
              </span>
            </div>

            <ToolGraphic kind={tool.kind} />

            <div className="card-content">
              <h2>{tool.title}</h2>
              <p>{tool.description}</p>
              <span className="tool-url">{tool.url}</span>
            </div>
          </a>
        ))}
        {filteredTools.length === 0 && (
          <div className="search-empty">
            <p>没有找到匹配的工具。</p>
            <button type="button" onClick={clearSearch}>清除搜索</button>
          </div>
        )}
      </section>

      <footer>
        <span>TOOL BOX INDEX</span>
        <span>BUILD SMALL · SOLVE WELL</span>
        <a href="#top">回到顶部 ↑</a>
      </footer>
    </main>
  );
}
