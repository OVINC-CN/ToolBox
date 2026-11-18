import { Fragment, useState } from 'react';
import type { CSSProperties } from 'react';
import { inspectUuid } from './core.js';

type Group = ReturnType<typeof inspectUuid>['groups'][number];
type Field = Group['parts'][number];
type FieldStyle = CSSProperties & Partial<Record<`--${string}`, string | number>>;

function shortExplanation(part: Field, version: number) {
  if (part.tone === 'random') {
    return '安全随机数';
  }
  if (part.id === 'version') {
    return `固定为 ${version}`;
  }
  if (part.id === 'variant') {
    return '固定为 10₂';
  }
  if (part.id === 'node') {
    return '本站随机生成';
  }
  if (part.id === 'clock') {
    return '辅助避免重复';
  }
  if (part.tone === 'sequence') {
    return '同毫秒内递增';
  }
  return version === 7 ? '毫秒时间的一部分' : '时间计数的一部分';
}

function fieldStyle(group: Group, part: Field, groupIndex: number, partIndex: number): FieldStyle {
  const lanes = [[0], [1], [2, 0], [3, 1], group.parts.length > 1 ? [2, 0] : [0]];
  return {
    '--tone': `var(--${part.tone})`,
    '--width': part.width,
    '--lane': lanes[groupIndex][partIndex] ?? 0,
    '--center': `${((part.start - group.start + part.width / 2) / group.width) * 100}%`,
  };
}

function digits(group: Group, highlighted: string) {
  return Array.from(group.text).map((char, index) => {
    const start = group.start + index * 4;
    const parts = group.parts.filter(field => field.start < start + 4 && field.start + field.width > start);
    const [first, second] = parts;
    const style: FieldStyle = { '--tone': `var(--${first.tone})` };
    if (parts.length > 1) {
      const stop = (first.start + first.width - start) * 25;
      style['--mix']
        = `linear-gradient(to right,var(--${first.tone}) 0 ${stop}%,var(--${second.tone}) ${stop}% 100%)`;
    }
    const dimmed = highlighted && !parts.some(part => part.id === highlighted);
    return (
      <span
        key={start}
        style={style}
        className={`uuid-char${parts.length > 1 ? ' mixed' : ''}${dimmed ? ' is-dimmed' : ''}`}
      >
        {char}
      </span>
    );
  });
}

export default function Anatomy({ uuid }: { uuid: string }) {
  const [detail, setDetail] = useState<Field>();
  const [highlighted, highlight] = useState('');
  function select(part: Field) {
    setDetail(part);
    highlight(part.id);
  }
  const info = inspectUuid(uuid);
  const facts: [string, string][] = [];
  if (info.timestamp) {
    const local = new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
      hourCycle: 'h23',
    });
    facts.push(
      ['记录时间', `${local.format(info.timestamp.milliseconds)} (${local.resolvedOptions().timeZone})`],
      ['UTC', info.timestamp.iso],
    );
  }
  if (info.node) {
    facts.push(['随机节点', info.node]);
  }
  if (info.sequence !== null) {
    facts.push(['当前序列', String(info.sequence)]);
  }
  return (
    <>
      <section className="anatomy-scroll" aria-label="UUID 字段图，宽度不足时可左右滑动">
        <div id="uuid-visual" className="uuid-visual" aria-label={`当前 UUID：${uuid}。下方为各字段说明。`}>
          {info.groups.map((group, groupIndex) => (
            <Fragment key={group.start}>
              {groupIndex > 0 && <span className="uuid-separator">-</span>}
              <div className="uuid-chunk" style={{ '--chars': group.text.length } as FieldStyle}>
                <code className="uuid-code" aria-hidden="true">
                  {digits(group, highlighted)}
                </code>
                <div className="chunk-rails" aria-hidden="true">
                  {group.parts.map((part, i) => (
                    <div
                      key={part.id}
                      className="field-rail"
                      data-start={part.start}
                      data-width={part.width}
                      style={fieldStyle(group, part, groupIndex, i)}
                    >
                      <span className="field-stem" />
                    </div>
                  ))}
                </div>
                <div className="chunk-labels">
                  {group.parts.map((part, i) => (
                    <button
                      key={part.id}
                      type="button"
                      className="field-label"
                      style={fieldStyle(group, part, groupIndex, i)}
                      aria-label={`${part.name}，${part.width} 位。${part.description}`}
                      onClick={() => {
                        select(part);
                      }}
                      onFocus={() => {
                        select(part);
                      }}
                      onPointerEnter={() => {
                        select(part);
                      }}
                      onPointerLeave={() => {
                        highlight('');
                      }}
                      onBlur={() => {
                        highlight('');
                      }}
                    >
                      <strong>{part.name}</strong>
                      <span className="field-short">{shortExplanation(part, info.version)}</span>
                      <small>
                        {part.width}
                        {' '}
                        bit
                      </small>
                    </button>
                  ))}
                </div>
              </div>
            </Fragment>
          ))}
        </div>
      </section>
      <div
        id="field-detail"
        className="field-detail"
        aria-live="polite"
        style={detail ? ({ '--tone': `var(--${detail.tone})` } as FieldStyle) : undefined}
      >
        {detail
          ? (
            <>
              <strong>{detail.name}</strong>
              <span>{detail.description}</span>
              <code>
                {detail.id === 'variant' ? '二进制 10 · 2 位' : `本段 ${detail.width} 位 · 0x${detail.hex}`}
              </code>
            </>
          )
          : (
            <span className="detail-intro">点击上方字段名称，查看它的含义和实际值。</span>
          )}
      </div>
      <div id="decoded-facts" className="decoded-facts">
        {facts.map(([label, value]) => (
          <span className="fact" key={label}>
            <span className="fact-label">{label}</span>
            <code>{value}</code>
          </span>
        ))}
      </div>
    </>
  );
}
