import { RegExpParser, visitRegExpAST } from '@eslint-community/regexpp';
import type { AST } from '@eslint-community/regexpp';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { Diagram } from './Diagram';
import type { Hit, MatchRequest, MatchResult } from './match.worker';

const examples = [
  { name: '工单编号', pattern: '(?<team>UI|API)-(?<id>\\d{2,4})', flags: 'gi', text: 'UI-42 已完成\nAPI-108 待处理\nui-07 已归档' },
  { name: '日期', pattern: '(?<year>\\d{4})-(?<month>\\d{2})-(?<day>\\d{2})', flags: 'g', text: '计划日期 2026-05-12\n完成日期 2026-05-18' },
  { name: '单词边界', pattern: '\\bcat\\b', flags: 'gi', text: 'Cat, catalog, and a sleepy cat.' },
];

function parse(pattern: string, flags: string) {
  try {
    const parser = new RegExpParser();
    const options = parser.parseFlags(flags);
    const tree = parser.parsePattern(pattern, 0, pattern.length, options);
    const captures: AST.CapturingGroup[] = [];
    visitRegExpAST(tree, {
      onCapturingGroupEnter(node) {
        captures.push(node);
      },
    });
    return { tree, captures };
  }
  catch (error) {
    return { error: error instanceof Error ? error.message : '无法解析表达式' };
  }
}

function Highlight({ text, hits }: { text: string; hits: Hit[] }) {
  return (
    <pre className="highlight">
      {hits.map((hit, index) => {
        const before = text.slice(hits[index - 1]?.end ?? 0, hit.start);
        return (
          <Fragment key={hit.start}>
            {before}
            <mark>{hit.start === hit.end ? <span title="零宽匹配" aria-label="零宽匹配">▏</span> : text.slice(hit.start, hit.end)}</mark>
          </Fragment>
        );
      })}
      {text.slice(hits.at(-1)?.end ?? 0)}
    </pre>
  );
}

export default function App() {
  const [request, setRequest] = useState<MatchRequest>(examples[0]);
  const [completed, setCompleted] = useState<{ request: MatchRequest; result: MatchResult }>();
  const [selected, setSelected] = useState(0);
  const { pattern, flags, text } = request;
  const parsed = useMemo(() => parse(pattern, flags), [pattern, flags]);
  useEffect(() => {
    if (!parsed.tree) {
      return;
    }
    const worker = new Worker(new URL('./match.worker.ts', import.meta.url), { type: 'module' });
    function finish(result: MatchResult) {
      clearTimeout(timeout);
      worker.terminate();
      setCompleted({ request, result });
    }
    const timeout = window.setTimeout(() => {
      finish({ error: '匹配超时，请缩短测试文本或简化重复分组。' });
    }, 1500);
    worker.onmessage = ({ data }: MessageEvent<MatchResult>) => {
      finish(data);
    };
    worker.onerror = () => {
      finish({ error: '无法运行匹配，请重试。' });
    };
    worker.postMessage(request);
    return () => {
      clearTimeout(timeout);
      worker.terminate();
    };
  }, [request, parsed]);
  const result = completed?.request === request ? completed.result : undefined;
  const matches = result && 'hits' in result ? result : undefined;
  const hit = matches?.hits[selected];
  const error = parsed.error ?? (result && 'error' in result ? result.error : undefined);

  function update(next: MatchRequest) {
    setSelected(0);
    setRequest(next);
  }

  return (
    <main>
      <header>
        <a href="/">
          <img src="/logo.svg" alt="" width="32" height="32" />
          Tool Box
        </a>
        <span>浏览器本地运行</span>
      </header>
      <div className="intro">
        <h1>正则可视化</h1>
        <p>从左向右阅读表达式结构，再用文本验证匹配与捕获组。</p>
      </div>
      <section className="panel expression" aria-label="表达式编辑器">
        <div className="heading">
          <label htmlFor="pattern">正则表达式</label>
          <label className="example">
            载入示例
            <select
              value=""
              onChange={(event) => {
                const example = examples.find(item => item.name === event.target.value);
                if (example) {
                  update(example);
                }
              }}
            >
              <option value="" disabled>选择示例</option>
              {examples.map(item => <option key={item.name}>{item.name}</option>)}
            </select>
          </label>
        </div>
        <div className="pattern-row">
          <span aria-hidden="true">/</span>
          <input id="pattern" aria-describedby="pattern-hint" maxLength={1000} spellCheck={false} value={pattern} onChange={(event) => { update({ ...request, pattern: event.target.value }); }} />
          <span aria-hidden="true">/</span>
          <input className="flags" aria-label="匹配标志" spellCheck={false} maxLength={8} value={flags} onChange={(event) => { update({ ...request, flags: event.target.value }); }} />
        </div>
        <p className="hint" id="pattern-hint">使用 JavaScript 语法。右侧可输入标志，如 g 全局匹配、i 忽略大小写、m 多行模式。</p>
      </section>
      <section className="panel diagram">
        <div className="heading">
          <h2>结构图</h2>
          <span>从左到右 →</span>
        </div>
        {parsed.tree ? <Diagram pattern={parsed.tree} captures={parsed.captures} /> : <p className="empty">修正表达式后即可查看结构图。</p>}
      </section>
      <div className="columns">
        <section className="panel">
          <div className="heading">
            <label htmlFor="sample">测试文本</label>
            <span>
              {text.length}
              {' '}
              / 16000
            </span>
          </div>
          <textarea id="sample" maxLength={16000} spellCheck={false} value={text} onChange={(event) => { update({ ...request, text: event.target.value }); }} />
        </section>
        <section className="panel output">
          <div className="heading">
            <h2>匹配结果</h2>
            <span role="status">{matches ? `${matches.limited ? '前 ' : ''}${matches.hits.length} 个匹配` : error ? '无法匹配' : '匹配中…'}</span>
          </div>
          {error && <p className="error" role="alert">{error}</p>}
          {matches && <Highlight text={text} hits={matches.hits} />}
          {hit && (
            <div className="details">
              <label>
                查看匹配
                <select value={selected} onChange={(event) => { setSelected(Number(event.target.value)); }}>
                  {matches.hits.map((item, index) => <option value={index} key={item.start}>{`#${index + 1} · [${item.start}, ${item.end})`}</option>)}
                </select>
              </label>
              {hit.groups.length > 0 && (
                <dl>
                  {parsed.captures?.map((group, index) => (
                    <div key={group.start}>
                      <dt>
                        {`$${index + 1}`}
                        {group.name && ` · ${group.name}`}
                      </dt>
                      <dd>
                        {hit.groups[index] ?? '未参与匹配'}
                        {hit.groups[index] === '' && '空字符串'}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
