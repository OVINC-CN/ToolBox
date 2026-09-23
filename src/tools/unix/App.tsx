'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

const TIME_ZONES = [
  { value: 'UTC', label: 'UTC', short: 'UTC+0' },
  { value: 'Asia/Shanghai', label: '中国标准时间', short: 'UTC+8' },
  { value: 'Asia/Tokyo', label: '东京', short: 'UTC+9' },
  { value: 'America/New_York', label: '纽约', short: 'ET' },
  { value: 'Europe/London', label: '伦敦', short: 'GMT/BST' },
];

const EXAMPLES = [
  { label: 'Unix 纪元', value: '0' },
  { label: '10 位秒级', value: '1720771200' },
  { label: '13 位毫秒', value: '1720771200000' },
  { label: '2038 边界', value: '2147483647' },
];

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function localInputValue(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function displayInputValue(date: Date) {
  return localInputValue(date).replace('T', ' ');
}

function formatter(timeZone: string, withZone = false) {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    ...(withZone ? { timeZoneName: 'short' as const } : {}),
  });
}

function formatForZone(date: Date, timeZone: string) {
  return formatter(timeZone, true).format(date).replaceAll('/', '-');
}

function formatIsoForZone(date: Date, timeZone: string) {
  const parts = formatter(timeZone).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find(part => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`;
}

function zoneOffsetAt(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.map(part => [part.type, part.value]),
  );
  const asUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  );
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

function parseDateTimeParts(value: string) {
  const normalized = value
    .trim()
    .replace(/[年/.]/g, '-')
    .replace(/月/g, '-')
    .replace(/日/g, ' ')
    .replace(/时/g, ':')
    .replace(/分/g, ':')
    .replace(/秒/g, '')
    .replace(/\s+/g, ' ');
  const match
    = /^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?(?:\.(\d{1,3}))?$/.exec(
      normalized,
    );
  if (!match) {
    return null;
  }
  const [, y, m, d, h, min, sec = '0', milliseconds = '0'] = match;
  const parts = {
    year: +y,
    month: +m,
    day: +d,
    hour: +h,
    minute: +min,
    second: +sec,
    millisecond: +milliseconds.padEnd(3, '0'),
  };
  const check = new Date(
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
      parts.millisecond,
    ),
  );
  if (
    check.getUTCFullYear() !== parts.year
    || check.getUTCMonth() !== parts.month - 1
    || check.getUTCDate() !== parts.day
    || check.getUTCHours() !== parts.hour
    || check.getUTCMinutes() !== parts.minute
    || check.getUTCSeconds() !== parts.second
  ) {
    return null;
  }
  return parts;
}

function nativePickerValue(value: string) {
  const parts = parseDateTimeParts(value);
  if (!parts) {
    return '';
  }
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}`;
}

function zonedInputToDate(value: string, timeZone: string) {
  const parts = parseDateTimeParts(value);
  if (!parts) {
    return null;
  }
  const wallClock = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    parts.millisecond,
  );
  let result = wallClock;
  for (let i = 0; i < 2; i += 1) {
    result = wallClock - zoneOffsetAt(new Date(result), timeZone);
  }
  const date = new Date(result);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseTimestamp(value: string) {
  const cleaned = value.trim();
  if (!/^-?\d+(?:\.\d+)?$/.test(cleaned)) {
    return null;
  }
  const numeric = Number(cleaned);
  if (!Number.isFinite(numeric)) {
    return null;
  }
  const unit = Math.abs(numeric) >= 100_000_000_000 ? '毫秒' : '秒';
  const date = new Date(unit === '秒' ? numeric * 1000 : numeric);
  return Number.isNaN(date.getTime()) ? null : { date, unit };
}

async function copyText(value: string) {
  await navigator.clipboard.writeText(value);
}

export default function Home() {
  const [now, setNow] = useState(() => new Date());
  const [timeZone, setTimeZone] = useState('Asia/Shanghai');
  const [timestamp, setTimestamp] = useState('1720771200');
  const [dateTime, setDateTime] = useState(() => displayInputValue(new Date()));
  const [copied, setCopied] = useState('');
  const [dateResult, setDateResult] = useState<Date | null>(() =>
    zonedInputToDate(displayInputValue(new Date()), 'Asia/Shanghai'),
  );
  const datePickerRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 250);
    return () => {
      window.clearInterval(timer);
    };
  }, []);

  const parsed = useMemo(() => parseTimestamp(timestamp), [timestamp]);
  const nowSeconds = Math.floor(now.getTime() / 1000).toString();
  const nowMilliseconds = now.getTime().toString();

  const flashCopied = async (key: string, value: string) => {
    try {
      await copyText(value);
      setCopied(key);
      window.setTimeout(() => {
        setCopied('');
      }, 1400);
    }
    catch {
      setCopied('');
    }
  };

  const requestCopy = (key: string, value: string) => {
    void flashCopied(key, value);
  };

  const convertDateTime = () => {
    setDateResult(zonedInputToDate(dateTime, timeZone));
  };

  const useCurrentTime = () => {
    const current = new Date();
    setTimestamp(Math.floor(current.getTime() / 1000).toString());
    setDateTime(displayInputValue(current));
    setDateResult(current);
  };

  const openDatePicker = () => {
    const picker = datePickerRef.current;
    if (!picker) {
      return;
    }
    try {
      picker.showPicker();
    }
    catch {
      picker.focus();
      picker.click();
    }
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="时间工具箱首页">
          <span className="brand-mark">T:</span>
          <span>时间工具箱</span>
        </a>
        <div className="system-status">
          <span className="status-dot" />
          浏览器本地时间
        </div>
      </header>

      <section id="top" className="hero">
        <div>
          <p className="eyebrow">UNIX TIME CONVERTER</p>
          <h1>Unix 时间戳转换</h1>
          <p className="hero-copy">
            在时间戳与日期时间之间快速转换，支持常用时区。所有计算均在浏览器本地完成。
          </p>
        </div>
      </section>

      <section className="live-panel" aria-label="当前 Unix 时间戳">
        <div className="panel-label">
          <span>实时</span>
          {' '}
          当前 Unix 时间戳
        </div>
        <button
          className="live-value"
          onClick={() => {
            requestCopy('live', nowSeconds);
          }}
          aria-label="复制当前秒级时间戳"
        >
          {nowSeconds}
          <span>{copied === 'live' ? '已复制' : '点击复制'}</span>
        </button>
        <div className="live-footer">
          <span>
            毫秒
            <b>{nowMilliseconds}</b>
          </span>
          <span>{formatForZone(now, timeZone)}</span>
          <button onClick={useCurrentTime}>写入转换器 ↘</button>
        </div>
      </section>

      <div className="workspace-grid">
        <section className="converter-card primary-card">
          <div className="card-heading">
            <div>
              <span className="section-index">01</span>
              <h2>时间戳 → 日期时间</h2>
            </div>
            <span className="mode-badge">自动识别位数</span>
          </div>
          <label htmlFor="timestamp">输入 Unix 时间戳</label>
          <div className={`input-shell ${parsed ? 'valid' : 'invalid'}`}>
            <input
              id="timestamp"
              inputMode="decimal"
              value={timestamp}
              onChange={(event) => {
                setTimestamp(event.target.value);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  setTimestamp(event.currentTarget.value);
                }
              }}
              placeholder="例如 1720771200"
            />
            <span>{parsed ? parsed.unit : '格式错误'}</span>
          </div>
          <div className="timezone-row">
            <label htmlFor="timezone">目标时区</label>
            <select
              id="timezone"
              value={timeZone}
              onChange={(event) => {
                setTimeZone(event.target.value);
              }}
            >
              {TIME_ZONES.map(zone => (
                <option key={zone.value} value={zone.value}>
                  {zone.label}
                  {' '}
                  ·
                  {zone.short}
                </option>
              ))}
            </select>
          </div>
          <div className="result-block" aria-live="polite">
            <div>
              <span>转换结果</span>
              <em>{parsed ? parsed.unit : '—'}</em>
            </div>
            <strong>
              {parsed
                ? formatIsoForZone(parsed.date, timeZone)
                : '请输入有效的时间戳'}
            </strong>
            <p>
              {parsed
                ? formatForZone(parsed.date, timeZone)
                : '支持负数、10 位秒级和 13 位毫秒级时间戳'}
            </p>
            <button
              disabled={!parsed}
              onClick={() => {
                if (parsed) {
                  requestCopy('timestamp', formatIsoForZone(parsed.date, timeZone));
                }
              }}
            >
              {copied === 'timestamp' ? '已复制 ✓' : '复制日期时间'}
            </button>
          </div>
        </section>

        <section className="converter-card date-card">
          <div className="card-heading">
            <div>
              <span className="section-index">02</span>
              <h2>日期时间 → 时间戳</h2>
            </div>
            <button className="text-action" onClick={useCurrentTime}>
              使用当前时间
            </button>
          </div>
          <div className="date-input-grid">
            <div>
              <label htmlFor="datetime">日期与时间</label>
              <div
                className={`date-entry-shell ${parseDateTimeParts(dateTime) ? 'valid' : 'invalid'}`}
              >
                <input
                  id="datetime"
                  type="text"
                  inputMode="text"
                  autoComplete="off"
                  spellCheck={false}
                  value={dateTime}
                  onChange={(event) => {
                    setDateTime(event.target.value);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      convertDateTime();
                    }
                  }}
                  placeholder="例如 2024-07-12 16:30:00"
                  aria-describedby="datetime-hint"
                />
                <button
                  type="button"
                  className="picker-trigger"
                  onClick={openDatePicker}
                >
                  选择
                </button>
                <input
                  ref={datePickerRef}
                  className="native-date-picker"
                  type="datetime-local"
                  step="1"
                  value={nativePickerValue(dateTime)}
                  onChange={(event) => {
                    setDateTime(event.target.value.replace('T', ' '));
                  }}
                  tabIndex={-1}
                  aria-hidden="true"
                />
              </div>
              <p id="datetime-hint" className="input-hint">
                可直接粘贴，支持 YYYY-MM-DD HH:mm:ss、ISO T 格式和斜杠日期
              </p>
            </div>
            <div>
              <label htmlFor="source-zone">解析时区</label>
              <select
                id="source-zone"
                value={timeZone}
                onChange={(event) => {
                  setTimeZone(event.target.value);
                }}
              >
                {TIME_ZONES.map(zone => (
                  <option key={zone.value} value={zone.value}>
                    {zone.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              className="convert-button"
              onClick={convertDateTime}
              disabled={!parseDateTimeParts(dateTime)}
            >
              执行转换
              <span>→</span>
            </button>
          </div>
          <div className="timestamp-results" aria-live="polite">
            <button
              disabled={!dateResult}
              onClick={() => {
                if (dateResult) {
                  requestCopy('seconds', Math.floor(dateResult.getTime() / 1000).toString());
                }
              }}
            >
              <span>秒级时间戳</span>
              <strong>
                {dateResult ? Math.floor(dateResult.getTime() / 1000) : '—'}
              </strong>
              <em>{copied === 'seconds' ? '已复制' : 'COPY'}</em>
            </button>
            <button
              disabled={!dateResult}
              onClick={() => {
                if (dateResult) {
                  requestCopy('milliseconds', dateResult.getTime().toString());
                }
              }}
            >
              <span>毫秒级时间戳</span>
              <strong>{dateResult ? dateResult.getTime() : '—'}</strong>
              <em>{copied === 'milliseconds' ? '已复制' : 'COPY'}</em>
            </button>
          </div>
        </section>

        <aside className="reference-card">
          <div className="card-heading compact">
            <div>
              <span className="section-index">参考</span>
              <h2>快速示例</h2>
            </div>
            <p>点击示例，写入时间戳转换器</p>
          </div>
          <div className="example-list">
            {EXAMPLES.map(example => (
              <button
                key={example.label}
                onClick={() => {
                  setTimestamp(example.value);
                }}
              >
                <span>{example.label}</span>
                <code>{example.value}</code>
                <i>↗</i>
              </button>
            ))}
          </div>
          <p className="precision-note">
            绝对值小于
            <code>100000000000</code>
            {' '}
            时按秒解析，其余按毫秒解析。
          </p>
        </aside>
      </div>

      <section className="world-strip" aria-label="全球时区速览">
        <div>
          <span className="section-index">时区</span>
          <h2>此刻，世界各地</h2>
        </div>
        <div className="world-clocks">
          {TIME_ZONES.slice(0, 4).map(zone => (
            <article key={zone.value}>
              <span>{zone.label}</span>
              <strong>
                {new Intl.DateTimeFormat('en-GB', {
                  timeZone: zone.value,
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  hourCycle: 'h23',
                }).format(now)}
              </strong>
              <small>{zone.short}</small>
            </article>
          ))}
        </div>
      </section>

      <footer>
        <span>时间工具箱</span>
        <p>所有转换在浏览器本地完成</p>
      </footer>
    </main>
  );
}
