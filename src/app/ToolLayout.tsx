import Icon from '../components/Icon';
import { Suspense, useEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router';
import logo from '/logo.svg?url';
import { tools } from './catalog';
import './tool-layout.css';

export default function ToolLayout() {
  const { pathname } = useLocation();
  const current = tools.find(tool => tool.id === pathname.split('/')[1].toLowerCase());
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    function outside(event: Event) {
      if (event.target instanceof Node && !menu.current?.contains(event.target)) {
        setOpen(false);
      }
    }
    function escape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        trigger.current?.focus({ preventScroll: true });
      }
    }
    function close() {
      setOpen(false);
    }
    document.addEventListener('pointerdown', outside);
    document.addEventListener('focusin', outside);
    document.addEventListener('keydown', escape);
    window.addEventListener('popstate', close);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('focusin', outside);
      document.removeEventListener('keydown', escape);
      window.removeEventListener('popstate', close);
    };
  }, [open]);

  return (
    <div className="tool-site" data-tool={current?.id}>
      <nav className="tool-nav" aria-label="工具导航">
        <div className="tool-nav-inner">
          <Link className="tool-brand" to="/" aria-label="返回 Tool Box 首页">
            <img src={logo} alt="" width="32" height="32" />
            TOOL BOX
          </Link>
          <div className="tool-switch" ref={menu}>
            <button
              ref={trigger}
              type="button"
              className="tool-trigger"
              aria-expanded={open}
              aria-controls="tool-list-menu"
              onClick={() => { setOpen(!open); }}
            >
              {current?.title}
              <Icon name="chevron" size={15} />
            </button>
            <ul id="tool-list-menu" className="tool-menu" hidden={!open}>
              {tools.map(tool => (
                <li key={tool.id}>
                  <Link
                    to={tool.url}
                    aria-current={tool === current ? 'page' : undefined}
                    onClick={() => {
                      window.scrollTo({ top: 0, behavior: 'instant' });
                      setOpen(false);
                      trigger.current?.focus({ preventScroll: true });
                    }}
                  >
                    {tool.title}
                    {tool === current && <span aria-hidden="true">✓</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </nav>
      <div className="tool-content">
        <Suspense fallback={<p className="page-loading" role="status">正在加载…</p>}><Outlet /></Suspense>
      </div>
    </div>
  );
}
