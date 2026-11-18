import Icon from '../../components/Icon';
import { useEffect, useRef, useState } from 'react';
import { createEditors } from './editors.js';
export { default as styles } from './styles.css?inline';

const initial = {
  inputBadge: '输入',
  outputBadge: '可编辑',
  inputStatus: '',
  outputStatus: '',
  inputCount: '',
  outputCount: '',
  inputCursor: '',
  outputCursor: '',
  inputKind: '',
  outputKind: '',
  keepEscapes: true,
  fold: '',
  indent: '2',
  notice: '',
};

export default function App() {
  const inputRef = useRef<HTMLDivElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const editors = useRef<ReturnType<typeof createEditors> | null>(null);
  const [ui, setUi] = useState(initial);
  useEffect(() => {
    const instance = createEditors(inputRef.current, outputRef.current, (patch: Partial<typeof initial>) => {
      setUi(previous => ({ ...previous, ...patch }));
    });
    editors.current = instance;
    return () => {
      editors.current = null;
      instance.destroy();
    };
  }, []);
  return (
    <>
      <main>
        <section className="workspace" aria-label="JSON 编辑工作台">
          <div className="toolbar">
            <div className="main-actions">
              <button
                type="button"
                id="format"
                onClick={() => {
                  editors.current?.format();
                }}
                className="primary"
              >
                <span className="symbol">{'{ }'}</span>
                格式化
                {' '}
                <kbd>⌘ ↵</kbd>
              </button>
              <button
                type="button"
                id="minify"
                onClick={() => {
                  editors.current?.minify();
                }}
              >
                <span className="symbol">↔</span>
                压缩为单行
              </button>
              <span className="toolbar-divider"></span>
              <label htmlFor="indent">缩进</label>
              <select
                id="indent"
                value={ui.indent}
                onChange={event => editors.current?.setIndent(event.target.value)}
              >
                <option value="2">2 空格</option>
                <option value="4">4 空格</option>
                <option value="tab">Tab</option>
              </select>
              <label
                className="escape-toggle"
                htmlFor="preserve-escapes"
                title="关闭后将转义显示为实际字符，结果仅供阅读"
              >
                <input
                  id="preserve-escapes"
                  type="checkbox"
                  checked={ui.keepEscapes}
                  onChange={event => editors.current?.setPreserveEscapes(event.target.checked)}
                />
                保留转义
              </label>
            </div>
            <button
              type="button"
              id="example"
              onClick={() => {
                editors.current?.loadExample();
              }}
              className="text-button"
            >
              载入示例
              <span>↗</span>
            </button>
          </div>
          <div className="editors">
            <section className="pane" id="input-pane">
              <div className="pane-header">
                <div className="pane-title">
                  <span className="file-icon"><Icon name="file" /></span>
                  <strong>原始 JSON</strong>
                  <span className="badge">{ui.inputBadge}</span>
                </div>
                <button
                  type="button"
                  id="clear"
                  onClick={() => {
                    editors.current?.clear();
                  }}
                  className="text-button"
                >
                  清空
                </button>
              </div>
              <div className="pane-tools">
                <span>粘贴或输入 JSON · 自动格式化</span>
              </div>
              <div ref={inputRef} id="input" className="editor"></div>
              <button
                type="button"
                id="input-status"
                onClick={() => {
                  editors.current?.jumpInput();
                }}
                className={`validation ${ui.inputKind}`}
                aria-live="polite"
              >
                {ui.inputStatus}
              </button>
              <div className="pane-footer">
                <span id="input-count">{ui.inputCount}</span>
                <span id="input-cursor">{ui.inputCursor}</span>
              </div>
            </section>
            <section className="pane" id="output-pane">
              <div className="pane-header">
                <div className="pane-title">
                  <span className="file-icon"><Icon name="file" /></span>
                  <strong>格式化结果</strong>
                  <span className="badge editable">{ui.outputBadge}</span>
                </div>
                <button
                  type="button"
                  id="copy"
                  onClick={() => {
                    void editors.current?.copy();
                  }}
                  className="text-button"
                >
                  {ui.keepEscapes ? '复制 JSON' : '复制结果'}
                </button>
              </div>
              <div className="pane-tools output-tools">
                <div>
                  <button
                    type="button"
                    id="expand"
                    onClick={() => {
                      editors.current?.expand();
                    }}
                    className="text-button"
                  >
                    全部展开
                  </button>
                  <span className="tiny-divider">/</span>
                  <label className="sr-only" htmlFor="fold">
                    折叠层级
                  </label>
                  <select
                    id="fold"
                    disabled={!ui.keepEscapes}
                    value={ui.fold}
                    onChange={event => editors.current?.fold(event.target.value)}
                  >
                    <option value="">折叠层级</option>
                    <option value="1">折叠第 1 层</option>
                    <option value="2">折叠第 2 层</option>
                    <option value="3">折叠第 3 层</option>
                    <option value="4">折叠第 4 层</option>
                  </select>
                </div>
                <button
                  type="button"
                  id="format-output"
                  onClick={() => {
                    editors.current?.formatOutput();
                  }}
                  className="text-button"
                >
                  重新格式化
                </button>
              </div>
              <div ref={outputRef} id="output" className="editor"></div>
              <button
                type="button"
                id="output-status"
                onClick={() => {
                  editors.current?.jumpOutput();
                }}
                className={`validation ${ui.outputKind}`}
                aria-live="polite"
              >
                {ui.outputStatus}
              </button>
              <div className="pane-footer">
                <span id="output-count">{ui.outputCount}</span>
                <span id="output-cursor">{ui.outputCursor}</span>
              </div>
            </section>
          </div>
        </section>
        <div className="below">
          <p>
            <span className="hint-icon">i</span>
            <span id="editor-hint">
              {ui.keepEscapes
                ? '点击行号旁的箭头折叠对象或数组；右侧修改会自动回写左侧。'
                : '左侧编辑会自动更新右侧阅读视图；复制结果会保留实际换行。'}
            </span>
          </p>
          <div className="legend">
            <span>
              <i className="key"></i>
              键名
            </span>
            <span>
              <i className="string"></i>
              字符串
            </span>
            <span>
              <i className="number"></i>
              数字
            </span>
            <span>
              <i className="boolean"></i>
              布尔值 / null
            </span>
          </div>
        </div>
      </main>
      <div id="toast" className={ui.notice ? 'show' : ''} role="status">
        {ui.notice}
      </div>
    </>
  );
}
