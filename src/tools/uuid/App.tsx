import Icon from '../../components/Icon';
import { useCallback, useEffect, useState } from 'react';
import Anatomy from './Anatomy';
import { generateUuids, VERSIONS } from './core.js';
import { registerGenerationTool } from './webmcp.js';

export { default as styles } from './styles.css?inline';

type Version = keyof typeof VERSIONS;
const versions: Version[] = [1, 4, 6, 7];

function firstBatch() {
  try {
    return { uuids: generateUuids({ version: 4, count: 1 }), error: '' };
  }
  catch (error) {
    return { uuids: [], error: error instanceof Error ? error.message : '生成失败' };
  }
}

export default function App() {
  const [batch, setBatch] = useState(firstBatch);
  const { uuids, error } = batch;
  const [version, setVersion] = useState<Version>(4);
  const [count, setCount] = useState('1');
  const [selected, setSelected] = useState(0);
  const [notice, setNotice] = useState<{ text: string }>();
  const current = uuids[selected];
  useEffect(() => {
    if (notice) {
      const timer = window.setTimeout(() => {
        setNotice(undefined);
      }, 2600);
      return () => {
        window.clearTimeout(timer);
      };
    }
  }, [notice]);
  const generate = useCallback((request: { version: Version; count: number }) => {
    const result = generateUuids(request);
    setVersion(request.version);
    setCount(String(request.count));
    setSelected(0);
    setBatch({ uuids: result, error: '' });
    return { version: request.version, count: result.length, uuids: result };
  }, []);
  useEffect(() => registerGenerationTool(document, generate), [generate]);
  function submit(nextVersion: Version) {
    try {
      generate({ version: nextVersion, count: Number(count) });
    }
    catch (reason) {
      setBatch({
        uuids: nextVersion === version ? uuids : [],
        error: reason instanceof Error ? reason.message : '生成失败',
      });
      setVersion(nextVersion);
    }
  }
  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice({ text: label });
    }
    catch {
      setNotice({ text: '无法访问剪贴板，请选中 UUID 后手动复制。' });
    }
  }
  return (
    <>
      <main>
        <section className="workspace" aria-label="UUID 生成与解读">
          <form
            id="generator-form"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              submit(version);
            }}
          >
            <fieldset className="version-field">
              <legend>选择版本</legend>
              <div className="version-options">
                {versions.map(item => (
                  <label className="version-option" key={item}>
                    <input
                      type="radio"
                      name="version"
                      value={item}
                      checked={version === item}
                      onChange={() => {
                        submit(item);
                      }}
                    />
                    <span className="version-content">
                      <strong>
                        v
                        {item}
                      </strong>
                      <span>{VERSIONS[item].title}</span>
                      {item === 4 && <span className="recommended">常用</span>}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="control-row">
              <p id="version-brief">{VERSIONS[version].brief}</p>
              <div className="generation-controls">
                <label className="count-control" htmlFor="count">
                  数量
                  <input
                    id="count"
                    name="count"
                    type="number"
                    min="1"
                    max="1000"
                    step="1"
                    value={count}
                    onChange={(event) => {
                      setCount(event.target.value);
                    }}
                    aria-invalid={error.includes('数量')}
                    required
                    inputMode="numeric"
                    aria-describedby="count-note form-error"
                  />
                </label>
                <button className="primary-button" type="submit">
                  <Icon name="refresh" />
                  生成 UUID
                </button>
              </div>
            </div>
            <span id="count-note" className="sr-only">
              一次可生成 1 至 1000 个 UUID。
            </span>
            <p id="form-error" className="error-message" role="alert" hidden={!error}>
              {error}
            </p>
          </form>
          <section className="anatomy" aria-labelledby="anatomy-heading">
            <div className="section-toolbar">
              <div className="section-caption">
                <h2 id="anatomy-heading">UUID 字段</h2>
                <span id="version-badge" className="badge">
                  VERSION
                  {version}
                </span>
              </div>
              <button
                id="copy-current"
                disabled={!current}
                onClick={() => {
                  void copy(current, '已复制当前 UUID');
                }}
                className="text-button"
                type="button"
              >
                <Icon name="copy" />
                复制当前
              </button>
            </div>
            {current
              ? (
                <Anatomy key={current} uuid={current} />
              )
              : (
                <p className="empty-state">设置生成数量后，生成一个 UUID 来查看字段。</p>
              )}
            <p id="version-hint" className="version-hint">
              {VERSIONS[version].hint}
            </p>
          </section>
        </section>
        <section className="results-section" aria-labelledby="results-heading">
          <div className="section-toolbar">
            <div className="section-caption">
              <h2 id="results-heading">本次结果</h2>
              <span id="result-count" className="count-badge">
                {uuids.length}
                {' '}
                个
              </span>
            </div>
            <button
              id="copy-all"
              disabled={!uuids.length}
              onClick={() => {
                void copy(uuids.join('\n'), `已复制 ${uuids.length} 个 UUID`);
              }}
              className="secondary-button"
              type="button"
            >
              <Icon name="copy" />
              全部复制
            </button>
          </div>
          <p className="results-instruction">选择一条结果，查看它的字段说明。</p>
          <div id="results" className="results-list" aria-label="生成的 UUID 列表">
            {uuids.map((uuid, index) => (
              <div className={`result-row${index === selected ? ' selected' : ''}`} key={uuid}>
                <button
                  className="result-select"
                  type="button"
                  aria-pressed={index === selected}
                  aria-label={`查看第 ${index + 1} 个 UUID：${uuid}`}
                  onClick={() => {
                    setSelected(index);
                  }}
                >
                  <span className="row-number">{String(index + 1).padStart(2, '0')}</span>
                  <code>{uuid}</code>
                </button>
                <button
                  className="row-copy"
                  type="button"
                  aria-label={`复制第 ${index + 1} 个 UUID`}
                  title="复制"
                  onClick={() => {
                    void copy(uuid, '已复制 UUID');
                  }}
                >
                  <Icon name="copy" />
                </button>
              </div>
            ))}
            {uuids.length === 0 && <div className="empty-state">生成结果会显示在这里。</div>}
          </div>
        </section>
        <footer>
          <a href="https://www.rfc-editor.org/rfc/rfc9562.html" target="_blank" rel="noopener noreferrer">
            RFC 9562 标准
            <span aria-hidden="true">↗</span>
          </a>
        </footer>
      </main>
      <div id="toast" className={`toast${notice ? ' visible' : ''}`} role="status" aria-live="polite">
        {notice?.text}
      </div>
    </>
  );
}
