import { useCallback, useEffect, useRef, useState } from 'react';
import { ensureSpecimenFont, specimenFamily, type FontOrigin } from './font-loader';
import { categories, specimenFonts, type CategoryId, type SampleKind, type SpecimenFont } from './fonts';

const defaultSamples: Record<SampleKind, string> = {
  zh: '字里行间，自有风景。',
  en: 'The quick brown fox jumps over the lazy dog.',
  code: 'const glyph = (a, b) => a >= b;\nif (a !== b) return true;',
};

const sampleLabels: Record<SampleKind, string> = {
  zh: '中文样张',
  en: '英文样张',
  code: '代码样张',
};

type LoadState = 'idle' | 'loading' | FontOrigin;

function displaySample(value: string, kind: SampleKind) {
  return value.trim() ? value : defaultSamples[kind];
}

function SpecimenCard({
  font,
  samples,
  size,
}: {
  font: SpecimenFont;
  samples: Record<SampleKind, string>;
  size: number;
}) {
  const cardRef = useRef<HTMLElement>(null);
  const mountedRef = useRef(false);
  const [loadState, setLoadState] = useState<LoadState>('idle');

  const requestFont = useCallback(() => {
    setLoadState('loading');
    void ensureSpecimenFont(font).then((origin) => {
      if (mountedRef.current) {
        setLoadState(origin);
      }
    });
  }, [font]);

  useEffect(() => {
    mountedRef.current = true;
    const card = cardRef.current;
    if (!card) {
      return () => {
        mountedRef.current = false;
      };
    }

    if (typeof IntersectionObserver === 'undefined') {
      const timer = window.setTimeout(requestFont, 0);
      return () => {
        mountedRef.current = false;
        window.clearTimeout(timer);
      };
    }

    const observer = new IntersectionObserver((entries) => {
      if (entries.some(entry => entry.isIntersecting)) {
        observer.disconnect();
        requestFont();
      }
    }, { rootMargin: '400px 0px' });
    observer.observe(card);

    return () => {
      mountedRef.current = false;
      observer.disconnect();
    };
  }, [requestFont]);

  const loaded = loadState === 'local' || loadState === 'remote';
  const statusLabel: Record<LoadState, string> = {
    idle: '待加载',
    loading: '加载中',
    local: '本地字体',
    remote: '远程字体',
    failed: '加载失败',
  };

  function renderSample(kind: SampleKind, origin: 'local' | 'remote') {
    const sample = displaySample(samples[kind], kind);
    const unsupportedChinese = !font.supportsChinese && /\p{Script=Han}/u.test(sample);
    return (
      <div
        className="sample-line"
        key={kind}
        style={{ height: `${Math.max(88, Math.min(250, Math.round(size * 2.8)))}px` }}
      >
        <span className="sample-kind">{sampleLabels[kind]}</span>
        {kind === 'zh' && !font.supportsChinese && <p className="sample-unavailable">未收录中文字形</p>}
        {kind !== 'zh' && unsupportedChinese && <p className="sample-unavailable">输入含中文，已隐藏回退字形</p>}
        {(kind !== 'zh' || font.supportsChinese) && !unsupportedChinese && (
          <p
            className={`specimen-text specimen-${kind}`}
            style={{ fontFamily: specimenFamily(font, kind, origin), fontSize: `${size}px` }}
          >
            {sample}
          </p>
        )}
      </div>
    );
  }

  return (
    <article className="font-card" ref={cardRef} aria-labelledby={`font-${font.id}`}>
      <div className="font-card-heading">
        <div className="font-title-block">
          <div className="font-title-line">
            <h3 id={`font-${font.id}`}>{font.name}</h3>
            {loadState === 'remote'
              ? (
                <a
                  className="font-status font-status-remote"
                  href={font.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`远程字体，查看${font.name}的字体来源（新标签页）`}
                  data-tooltip="远程字体 · 点击查看来源"
                >
                  <span className="status-dot" aria-hidden="true" />
                </a>
              )
              : (
                <span
                  className={`font-status font-status-${loadState}`}
                  role="status"
                  aria-label={statusLabel[loadState]}
                  data-tooltip={statusLabel[loadState]}
                >
                  <span className="status-dot" aria-hidden="true" />
                </span>
              )}
            {font.name !== font.englishName && <span className="english-name">{font.englishName}</span>}
          </div>
          <div className="font-title-details">
            <p>{font.note}</p>
          </div>
        </div>
      </div>

      <div className="specimen-area" aria-busy={!loaded && loadState !== 'failed'}>
        {loaded && (
          <div className={`sample-stack${size > 36 ? ' sample-stack-large' : ''}`}>
            {(['zh', 'en', 'code'] as const).map(kind => renderSample(kind, loadState))}
          </div>
        )}
        {loadState === 'failed' && (
          <div className="specimen-message specimen-error">
            <span>字体加载失败，样张已隐藏。</span>
            <button type="button" onClick={requestFont}>重试加载</button>
          </div>
        )}
        {(loadState === 'idle' || loadState === 'loading') && (
          <div className="specimen-message">
            {loadState === 'idle' ? '滚动到此处后加载字体' : '正在查找本地字体或加载远程文件…'}
          </div>
        )}
      </div>

    </article>
  );
}

export default function App() {
  const [category, setCategory] = useState<CategoryId | 'all'>('all');
  const [samples, setSamples] = useState<Record<SampleKind, string>>(defaultSamples);
  const [size, setSize] = useState(16);
  const shownCategories = category === 'all'
    ? categories
    : categories.filter(item => item.id === category);

  function updateSample(kind: SampleKind, value: string) {
    setSamples(current => ({ ...current, [kind]: value }));
  }

  return (
    <div className="atlas-shell" id="top">
      <header className="site-header">
        <a className="site-brand" href="/" aria-label="返回 Tool Box 首页">
          <span className="brand-square" aria-hidden="true">T</span>
          <span>
            TOOL BOX
            <span className="brand-divider">/</span>
            {' '}
            字体展厅
          </span>
        </a>
        <span className="header-edition">TYPE ATLAS · NO. 09</span>
      </header>

      <main>
        <section className="intro" aria-labelledby="page-title">
          <div className="intro-copy">
            <span className="eyebrow">
              <span className="eyebrow-line" />
              {' '}
              THE TYPE ISSUE / 字体观察
            </span>
            <h1 id="page-title">
              字体展厅
              <span>Type Atlas</span>
            </h1>
            <p>十八款字体，五种性格。输入自己的文字，对照中文、英文与代码的字形和节奏。</p>
          </div>
          <div className="intro-index" aria-label="展厅统计">
            <div>
              <strong>18</strong>
              <span>精选字体</span>
            </div>
            <div>
              <strong>05</strong>
              <span>字体类别</span>
            </div>
            <p>
              文字的形状，也是内容的一部分。
              <span aria-hidden="true">↘</span>
            </p>
          </div>
        </section>

        <section className="control-panel" aria-labelledby="control-title">
          <div className="section-heading control-heading">
            <div>
              <span className="eyebrow">01 / 试印台</span>
              <h2 id="control-title">编辑样张</h2>
            </div>
            <p>留空将使用默认文字；未收录的字形会明确标出。</p>
          </div>

          <div className="sample-fields">
            {(['zh', 'en', 'code'] as const).map(kind => (
              <label className="sample-field" key={kind}>
                <span>{sampleLabels[kind]}</span>
                <textarea
                  value={samples[kind]}
                  onChange={(event) => { updateSample(kind, event.target.value); }}
                  rows={kind === 'code' ? 3 : 2}
                  maxLength={kind === 'code' ? 300 : 180}
                  spellCheck={kind !== 'code'}
                  aria-label={sampleLabels[kind]}
                />
              </label>
            ))}
          </div>

          <div className="size-control">
            <div className="size-labels">
              <label htmlFor="specimen-size">样张字号</label>
              <output htmlFor="specimen-size">
                {size}
                {' '}
                px
              </output>
            </div>
            <div className="size-slider-row">
              <span>12</span>
              <input
                id="specimen-size"
                type="range"
                min="12"
                max="96"
                step="1"
                value={size}
                onChange={(event) => { setSize(Number(event.target.value)); }}
              />
              <span>96 PX</span>
            </div>
          </div>
        </section>

        <section className="collection" aria-labelledby="collection-title">
          <div className="section-heading collection-heading">
            <div>
              <span className="eyebrow">02 / THE COLLECTION</span>
              <h2 id="collection-title">浏览字体</h2>
            </div>
            <p>字体文件按需加载；每张样张会标明本地或远程来源。</p>
          </div>

          <nav className="category-list" aria-label="按字体类别筛选">
            <button type="button" aria-pressed={category === 'all'} onClick={() => { setCategory('all'); }}>
              全部
              {' '}
              <span>{String(specimenFonts.length).padStart(2, '0')}</span>
            </button>
            {categories.map(item => (
              <button
                type="button"
                key={item.id}
                aria-pressed={category === item.id}
                onClick={() => { setCategory(item.id); }}
              >
                {item.label}
                {' '}
                <span>{String(specimenFonts.filter(font => font.category === item.id).length).padStart(2, '0')}</span>
              </button>
            ))}
          </nav>

          {shownCategories.map((item) => {
            const fonts = specimenFonts.filter(font => font.category === item.id);
            return (
              <section className="font-section" aria-labelledby={`category-${item.id}`} key={item.id}>
                <div className="font-section-heading">
                  <div>
                    <span className="category-english">{item.english}</span>
                    <h2 id={`category-${item.id}`}>{item.label}</h2>
                  </div>
                  <p>{item.description}</p>
                </div>
                <div className="font-grid">
                  {fonts.map(font => (
                    <SpecimenCard
                      key={font.id}
                      font={font}
                      samples={samples}
                      size={size}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </section>
      </main>

      <footer className="site-footer">
        <span>TOOL BOX / TYPE ATLAS</span>
        <span>18 FONTS · 05 CATEGORIES</span>
        <a href="#top">回到顶部 ↑</a>
      </footer>
    </div>
  );
}
