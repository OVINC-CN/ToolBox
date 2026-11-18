import Icon from '../components/Icon';
import { useEffect, useRef, useState } from 'react';
import logoMark from '/logo.svg?url';
import { Link } from 'react-router';
import { tools } from '../app/catalog';

function ToolGraphic({ kind }: { kind: string }) {
  if (kind === 'regex') {
    return (
      <div className="tool-graphic regex-graphic" aria-hidden="true">
        <span>.*</span>
        <i>→</i>
        <span>[a-z]</span>
      </div>
    );
  }

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

  if (kind === 'url') {
    return (
      <div className="tool-graphic url-graphic" aria-hidden="true">
        <span className="url-plain">hello world</span>
        <span className="url-arrow">↓</span>
        <span className="url-encoded">
          hello
          <span>%20</span>
          world
        </span>
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
    <main id="top">
      <nav className="topbar" aria-label="主导航">
        <a className="brand" href="#top" aria-label="返回页面顶部">
          <img className="brand-mark" src={logoMark} alt="" width="32" height="32" aria-hidden="true" />
          TOOL BOX
        </a>
      </nav>

      <section className="search-bar" role="search" aria-label="搜索工具">
        <label className="search-label" htmlFor="tool-search">快速搜索</label>
        <div className="search-field">
          <Icon name="search" size={24} />
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
          {query.trim() && `找到 ${filteredTools.length} 个工具`}
        </span>
      </section>

      <section className="tool-grid" id="tool-list" aria-label="工具列表">
        {filteredTools.map(tool => (
          <Link
            className={`tool-card tool-card-${tool.tone}`}
            to={tool.url}
            aria-label={`打开${tool.title}`}
            key={tool.url}
          >
            <div className="card-topline">
              <span className="open-icon" aria-hidden="true">
                →
              </span>
            </div>

            <ToolGraphic kind={tool.kind} />

            <div className="card-content">
              <h2>{tool.title}</h2>
              <p>{tool.description}</p>
              <span className="tool-url">{tool.url}</span>
            </div>
          </Link>
        ))}
        {filteredTools.length === 0 && (
          <div className="search-empty">
            <p>没有找到匹配的工具。</p>
            <button type="button" onClick={clearSearch}>清除搜索</button>
          </div>
        )}
      </section>

      <footer>
        <a href="#top">回到顶部 ↑</a>
      </footer>
    </main>
  );
}

export { default as styles } from './styles.css?inline';
