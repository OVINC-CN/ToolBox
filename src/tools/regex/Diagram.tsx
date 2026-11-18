import type { AST } from '@eslint-community/regexpp';
import type { ReactNode } from 'react';

const atomLabels: Record<string, string> = {
  '^': '起点', '$': '终点', '.': '任意字符', '\\d': '数字', '\\D': '非数字',
  '\\w': '单词字符', '\\W': '非单词字符', '\\s': '空白', '\\S': '非空白',
  '\\b': '单词边界', '\\B': '非单词边界',
};

function Atom({ code, label }: { code: string; label: string }) {
  return (
    <span className="atom">
      <code>{code}</code>
      <small>{label}</small>
    </span>
  );
}

export function Diagram({ pattern, captures }: { pattern: AST.Pattern; captures: AST.CapturingGroup[] }) {
  function element(node: AST.Element): ReactNode {
    if (node.type === 'Quantifier') {
      const times = node.min === node.max ? String(node.min) : `${node.min}–${node.max === Infinity ? '∞' : node.max}`;
      return (
        <div className="cluster repeat">
          <strong>{`重复 ${times} 次${node.greedy ? '' : ' · 懒惰'}`}</strong>
          {element(node.element)}
        </div>
      );
    }
    if ('alternatives' in node) {
      let label;
      if (node.type === 'CapturingGroup') {
        label = `捕获组 ${captures.indexOf(node) + 1}${node.name ? ` · ${node.name}` : ''}`;
      }
      else if (node.type === 'Group') {
        label = node.modifiers ? `局部标志 ${node.modifiers.raw}` : '非捕获组';
      }
      else {
        label = `${node.negate ? '负向' : '正向'}${node.kind === 'lookahead' ? '先行' : '后行'}断言`;
      }
      return (
        <div className="cluster">
          <strong>{label}</strong>
          {branches(node.alternatives)}
        </div>
      );
    }
    const label = node.type === 'Character'
      ? '字符'
      : node.type === 'Backreference'
        ? '反向引用'
        : (atomLabels[node.raw] ?? '字符集');
    return <Atom code={node.raw} label={label} />;
  }

  function branches(alternatives: AST.Alternative[]): ReactNode {
    return (
      <div className={alternatives.length > 1 ? 'branches choice' : 'branches'}>
        {alternatives.map(branch => (
          <div className="sequence" key={branch.start}>
            {branch.elements.length === 0 && <Atom code="ε" label="空分支" />}
            {branch.elements.map(node => <div className="step" key={node.start}>{element(node)}</div>)}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="diagram-scroll" role="region" aria-label="表达式结构图，可横向滚动">
      <div className="rail">
        <span className="terminal">开始</span>
        {branches(pattern.alternatives)}
        <span className="terminal">结束</span>
      </div>
    </div>
  );
}
