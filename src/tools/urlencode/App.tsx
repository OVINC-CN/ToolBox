import { Link } from 'react-router';
import { useState } from 'react';

type Mode = 'encode' | 'decode';

function convert(value: string, mode: Mode) {
  if (!value) {
    return { output: '', error: '' };
  }

  try {
    return {
      output: mode === 'encode'
        ? encodeURIComponent(value)
        : decodeURIComponent(value),
      error: '',
    };
  }
  catch {
    return {
      output: '',
      error: mode === 'encode'
        ? '输入包含无法编码的 Unicode 字符，请检查是否有不完整的字符。'
        : '无法解码，请检查 % 转义序列或 UTF-8 字节是否完整。',
    };
  }
}

export default function App() {
  const [mode, setMode] = useState<Mode>('encode');
  const [input, setInput] = useState('');
  const [feedback, setFeedback] = useState('');
  const { output, error } = convert(input, mode);
  const hasResult = output.length > 0 && !error;

  function chooseMode(nextMode: Mode) {
    setMode(nextMode);
    setFeedback('');
  }

  function reverse() {
    if (!hasResult) {
      return;
    }
    setInput(output);
    setMode(mode === 'encode' ? 'decode' : 'encode');
    setFeedback('');
  }

  async function copyResult() {
    if (!hasResult) {
      return;
    }
    try {
      await navigator.clipboard.writeText(output);
      setFeedback('结果已复制到剪贴板');
    }
    catch {
      setFeedback('复制失败，请手动选择结果');
    }
  }

  return (
    <main>

      <section className="workspace shell" aria-label="URL 编解码工具">
        <div className="workspace-header">
          <div className="mode-switch" role="group" aria-label="转换方向">
            <button
              type="button"
              className={mode === 'encode' ? 'active' : ''}
              aria-pressed={mode === 'encode'}
              onClick={() => { chooseMode('encode'); }}
            >
              编码
            </button>
            <button
              type="button"
              className={mode === 'decode' ? 'active' : ''}
              aria-pressed={mode === 'decode'}
              onClick={() => { chooseMode('decode'); }}
            >
              解码
            </button>
          </div>
        </div>

        <div className="editors">
          <div className="editor-panel">
            <div className="panel-heading">
              <div>
                <label htmlFor="source-text">
                  {mode === 'encode' ? '原始文本' : '已编码文本'}
                </label>
              </div>
              <button
                type="button"
                className="text-action"
                disabled={input.length === 0}
                onClick={() => {
                  setInput('');
                  setFeedback('');
                }}
              >
                清空
              </button>
            </div>
            <textarea
              id="source-text"
              value={input}
              placeholder={mode === 'encode'
                ? '在这里输入需要编码的文本，例如：你好 world /?&=+'
                : '在这里输入需要解码的内容，例如：%E4%BD%A0%E5%A5%BD%20world'}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'conversion-error' : 'input-help'}
              autoCapitalize="off"
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => {
                setInput(event.target.value);
                setFeedback('');
              }}
            />
            <p className="panel-footnote" id="input-help">
              保留输入中的空格、换行和其他字符
            </p>
          </div>

          <div className="editor-panel output-panel">
            <div className="panel-heading">
              <div>
                <label htmlFor="result-text">
                  {mode === 'encode' ? '编码结果' : '解码结果'}
                </label>
              </div>
              <span className="output-status">{error ? '需要修正输入' : '实时结果'}</span>
            </div>
            <textarea
              id="result-text"
              value={output}
              placeholder={error ? '修正输入后会显示结果' : '转换结果将显示在这里'}
              readOnly
              spellCheck={false}
            />
            <p className="panel-footnote">转换由浏览器完成，不会上传输入内容</p>
          </div>
        </div>

        <div className="workspace-footer">
          <div className="status-area">
            {error
              ? <p className="error-message" id="conversion-error" role="alert">{error}</p>
              : <p className="helper-message">空格编码为 %20；解码时 + 保持为加号。</p>}
            <p className="feedback" role="status" aria-live="polite">{feedback}</p>
          </div>
          <div className="actions">
            <button type="button" className="secondary-button" disabled={!hasResult} onClick={reverse}>
              将结果反向转换
              <span aria-hidden="true">↔</span>
            </button>
            <button
              type="button"
              className="primary-button"
              disabled={!hasResult}
              onClick={() => { void copyResult(); }}
            >
              复制结果
              <span aria-hidden="true">↗</span>
            </button>
          </div>
        </div>
      </section>

      <footer className="site-footer shell">
        <Link to="/">返回 Tool Box 首页 ↑</Link>
      </footer>
    </main>
  );
}

export { default as styles } from './styles.css?inline';
