'use client';

import { SyntheticEvent, useMemo, useState } from 'react';
import {
  formatBigInt,
  getAddressPage,
  getContainingCidrs,
  parseCidr,
  parseIp,
  type ParsedCidr,
  type ParsedIp,
} from './ip';

type Mode = 'ip' | 'cidr';

const DEFAULT_IP = '192.168.1.8';
const DEFAULT_CIDR = '192.168.1.8/24';

function messageFromError(error: unknown) {
  return error instanceof Error
    ? error.message
    : '输入内容无法解析，请检查后重试';
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="summary-item">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export default function Home() {
  const [mode, setMode] = useState<Mode>('ip');
  const [copied, setCopied] = useState('');

  const [ipInput, setIpInput] = useState(DEFAULT_IP);
  const [ipResult, setIpResult] = useState<ParsedIp>(() => parseIp(DEFAULT_IP));
  const [ipError, setIpError] = useState('');
  const [prefixMin, setPrefixMin] = useState(0);
  const [prefixMax, setPrefixMax] = useState(32);

  const [cidrInput, setCidrInput] = useState(DEFAULT_CIDR);
  const [cidrResult, setCidrResult] = useState<ParsedCidr>(() =>
    parseCidr(DEFAULT_CIDR),
  );
  const [cidrError, setCidrError] = useState('');
  const [page, setPage] = useState(1n);
  const [pageInput, setPageInput] = useState('1');
  const [pageError, setPageError] = useState('');
  const [pageSize, setPageSize] = useState(256);
  const [usableOnly, setUsableOnly] = useState(false);

  const containingCidrs = useMemo(
    () => getContainingCidrs(ipResult),
    [ipResult],
  );
  const visibleCidrs = useMemo(
    () =>
      containingCidrs.filter(
        item => item.prefix >= prefixMin && item.prefix <= prefixMax,
      ),
    [containingCidrs, prefixMax, prefixMin],
  );

  const addressPage = useMemo(
    () => getAddressPage(cidrResult, page, pageSize, usableOnly),
    [cidrResult, page, pageSize, usableOnly],
  );

  function showPage(nextPage: bigint) {
    setPage(nextPage);
    setPageInput(nextPage.toString());
  }

  async function copyText(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      window.setTimeout(() => {
        setCopied('');
      }, 1600);
    }
    catch {
      setCopied('复制失败，请手动选择内容');
      window.setTimeout(() => {
        setCopied('');
      }, 2200);
    }
  }

  function requestCopy(text: string, label: string) {
    void copyText(text, label);
  }

  function calculateIp(value: string) {
    try {
      const result = parseIp(value);
      setIpResult(result);
      setIpError('');
      setPrefixMin(0);
      setPrefixMax(result.bitLength);
    }
    catch (error) {
      setIpError(messageFromError(error));
    }
  }

  function submitIp(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    calculateIp(ipInput);
  }

  function applyIpExample(value: string) {
    setIpInput(value);
    calculateIp(value);
  }

  function calculateCidr(value: string) {
    try {
      const result = parseCidr(value);
      setCidrResult(result);
      setCidrError('');
      showPage(1n);
      setUsableOnly(false);
    }
    catch (error) {
      setCidrError(messageFromError(error));
    }
  }

  function submitCidr(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    calculateCidr(cidrInput);
  }

  function applyCidrExample(value: string) {
    setCidrInput(value);
    calculateCidr(value);
  }

  function jumpToPage(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\d+$/.test(pageInput)) {
      setPageError('请输入有效页码');
      return;
    }

    const requested = BigInt(pageInput);
    if (requested < 1n || requested > addressPage.pageCount) {
      setPageError(`页码范围为 1 到 ${addressPage.pageCount.toString()}`);
      return;
    }

    setPageError('');
    showPage(requested);
  }

  return (
    <main>
      <div className="page-grid" aria-hidden="true" />
      <header className="site-header shell">
        <a className="brand" href="#top" aria-label="网段转换器首页">
          <span className="brand-mark">IP</span>
          <span>
            <strong>网段转换器</strong>
            <small>IP · CIDR TOOLKIT</small>
          </span>
        </a>
        <div className="privacy-pill">
          <span className="privacy-dot" />
          所有计算仅在本机完成
        </div>
      </header>

      <section className="hero shell" id="top">
        <div className="hero-copy">
          <p className="eyebrow">IPv4 + IPv6 / 双向换算</p>
          <h1>
            把地址，
            <span>放回它的网段里。</span>
          </h1>
          <p className="hero-description">
            从一个 IP 找到它可能属于的全部
            CIDR，或展开任意网段中的地址。无需上传，超大网段也能即时翻页。
          </p>
        </div>
        <div className="hero-facts" aria-label="工具特点">
          <div>
            <strong>33 / 129</strong>
            <span>完整前缀层级</span>
          </div>
          <div>
            <strong>BigInt</strong>
            <span>超大网段计算</span>
          </div>
          <div>
            <strong>0 B</strong>
            <span>输入数据上传</span>
          </div>
        </div>
      </section>

      <section className="tool-shell shell" aria-label="IP 网段转换工具">
        <div className="mode-tabs" role="tablist" aria-label="转换模式">
          <button
            id="tab-ip"
            role="tab"
            aria-selected={mode === 'ip'}
            aria-controls="panel-ip"
            className={mode === 'ip' ? 'active' : ''}
            onClick={() => {
              setMode('ip');
            }}
          >
            <span>01</span>
            IP 查网段
          </button>
          <button
            id="tab-cidr"
            role="tab"
            aria-selected={mode === 'cidr'}
            aria-controls="panel-cidr"
            className={mode === 'cidr' ? 'active' : ''}
            onClick={() => {
              setMode('cidr');
            }}
          >
            <span>02</span>
            网段查 IP
          </button>
        </div>

        {mode === 'ip'
          ? (
            <div
              id="panel-ip"
              role="tabpanel"
              aria-labelledby="tab-ip"
              className="tool-panel"
            >
              <div className="input-area">
                <div className="section-heading">
                  <div>
                    <p className="section-kicker">ADDRESS → NETWORKS</p>
                    <h2>输入一个 IP 地址</h2>
                  </div>
                  <span className="format-hint">IPv4 / IPv6</span>
                </div>

                <form className="primary-form" onSubmit={submitIp} noValidate>
                  <label htmlFor="ip-input">IP 地址</label>
                  <div className={`input-combo ${ipError ? 'has-error' : ''}`}>
                    <input
                      id="ip-input"
                      value={ipInput}
                      onChange={(event) => {
                        setIpInput(event.target.value);
                      }}
                      placeholder="例如 192.168.1.8 或 2001:db8::1"
                      autoComplete="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      aria-describedby={ipError ? 'ip-error' : 'ip-help'}
                      aria-invalid={Boolean(ipError)}
                    />
                    <button type="submit">开始计算</button>
                  </div>
                  {ipError
                    ? (
                      <p className="field-message error" id="ip-error" role="alert">
                        {ipError}
                      </p>
                    )
                    : (
                      <p className="field-message" id="ip-help">
                        无需提供掩码，我们会列出这个地址在每一种前缀长度下的所属网段。
                      </p>
                    )}
                </form>

                <div className="examples" aria-label="IP 示例">
                  <span>试试示例</span>
                  <button
                    onClick={() => {
                      applyIpExample('192.168.1.8');
                    }}
                  >
                    192.168.1.8
                  </button>
                  <button
                    onClick={() => {
                      applyIpExample('2001:db8::1');
                    }}
                  >
                    2001:db8::1
                  </button>
                  <button
                    onClick={() => {
                      applyIpExample('::1');
                    }}
                  >
                    IPv6 回环
                  </button>
                </div>
              </div>

              {!ipError && (
                <div className="result-area">
                  <div className="result-header">
                    <div>
                      <p className="section-kicker">
                        RESULT /
                        {ipResult.version === 4 ? 'IPv4' : 'IPv6'}
                      </p>
                      <h2>{ipResult.canonical}</h2>
                      <div className="result-tags">
                        <span className="tag primary">
                          IPv
                          {ipResult.version}
                        </span>
                        <span className="tag">{ipResult.classification}</span>
                      </div>
                    </div>
                    <button
                      className="copy-button"
                      onClick={() => { requestCopy(ipResult.canonical, '已复制标准地址'); }}
                    >
                      复制标准地址
                    </button>
                  </div>

                  <div className="filter-bar">
                    <div>
                      <strong>所属网段</strong>
                      <span>
                        共
                        {visibleCidrs.length}
                        {' '}
                        条
                      </span>
                    </div>
                    <div className="prefix-filter">
                      <label htmlFor="prefix-min">前缀范围</label>
                      <input
                        id="prefix-min"
                        type="number"
                        min={0}
                        max={prefixMax}
                        value={prefixMin}
                        onChange={(event) => {
                          setPrefixMin(
                            Math.max(
                              0,
                              Math.min(Number(event.target.value), prefixMax),
                            ),
                          );
                        }}
                      />
                      <span>至</span>
                      <input
                        aria-label="最大前缀长度"
                        type="number"
                        min={prefixMin}
                        max={ipResult.bitLength}
                        value={prefixMax}
                        onChange={(event) => {
                          setPrefixMax(
                            Math.min(
                              ipResult.bitLength,
                              Math.max(Number(event.target.value), prefixMin),
                            ),
                          );
                        }}
                      />
                    </div>
                  </div>

                  <div className="desktop-table table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>前缀</th>
                          <th>所属 CIDR</th>
                          <th>地址范围</th>
                          <th>
                            <span className="sr-only">操作</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleCidrs.map(item => (
                          <tr key={item.prefix}>
                            <td>
                              <span className="prefix-badge">
                                /
                                {item.prefix}
                              </span>
                            </td>
                            <td className="mono strong-cell">{item.cidr}</td>
                            <td className="range-cell mono">
                              <span>{item.first}</span>
                              <i>→</i>
                              <span>{item.last}</span>
                            </td>
                            <td>
                              <button
                                className="icon-copy"
                                aria-label={`复制 ${item.cidr}`}
                                onClick={() => { requestCopy(item.cidr, `已复制 ${item.cidr}`); }}
                              >
                                复制
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mobile-cards">
                    {visibleCidrs.map(item => (
                      <article className="address-card" key={item.prefix}>
                        <div>
                          <span className="prefix-badge">
                            /
                            {item.prefix}
                          </span>
                          <button
                            onClick={() => { requestCopy(item.cidr, `已复制 ${item.cidr}`); }}
                          >
                            复制
                          </button>
                        </div>
                        <strong className="mono">{item.cidr}</strong>
                        <p className="mono">
                          {item.first}
                          <br />
                          →
                          {item.last}
                        </p>
                      </article>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
          : (
            <div
              id="panel-cidr"
              role="tabpanel"
              aria-labelledby="tab-cidr"
              className="tool-panel"
            >
              <div className="input-area">
                <div className="section-heading">
                  <div>
                    <p className="section-kicker">NETWORK → ADDRESSES</p>
                    <h2>输入一个 CIDR 网段</h2>
                  </div>
                  <span className="format-hint">按页即时计算</span>
                </div>

                <form className="primary-form" onSubmit={submitCidr} noValidate>
                  <label htmlFor="cidr-input">CIDR 网段</label>
                  <div className={`input-combo ${cidrError ? 'has-error' : ''}`}>
                    <input
                      id="cidr-input"
                      value={cidrInput}
                      onChange={(event) => {
                        setCidrInput(event.target.value);
                      }}
                      placeholder="例如 192.168.1.0/24 或 2001:db8::/64"
                      autoComplete="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      aria-describedby={cidrError ? 'cidr-error' : 'cidr-help'}
                      aria-invalid={Boolean(cidrError)}
                    />
                    <button type="submit">展开网段</button>
                  </div>
                  {cidrError
                    ? (
                      <p
                        className="field-message error"
                        id="cidr-error"
                        role="alert"
                      >
                        {cidrError}
                      </p>
                    )
                    : (
                      <p className="field-message" id="cidr-help">
                        地址列表只生成当前页，因此大网段不会占用额外内存。
                      </p>
                    )}
                </form>

                <div className="examples" aria-label="CIDR 示例">
                  <span>试试示例</span>
                  <button
                    onClick={() => {
                      applyCidrExample('192.168.1.8/24');
                    }}
                  >
                    IPv4 /24
                  </button>
                  <button
                    onClick={() => {
                      applyCidrExample('2001:db8::/120');
                    }}
                  >
                    IPv6 /120
                  </button>
                  <button
                    onClick={() => {
                      applyCidrExample('2001:db8::/64');
                    }}
                  >
                    IPv6 /64
                  </button>
                </div>
              </div>

              {!cidrError && (
                <div className="result-area">
                  <div className="result-header cidr-title">
                    <div>
                      <p className="section-kicker">
                        NORMALIZED / IPv
                        {cidrResult.version}
                      </p>
                      <h2>{cidrResult.normalized}</h2>
                      {cidrResult.hadHostBits && (
                        <p className="normalization-note">
                          已清除输入中的主机位，按标准网络地址展示。
                        </p>
                      )}
                    </div>
                    <button
                      className="copy-button"
                      onClick={() => { requestCopy(cidrResult.normalized, '已复制标准网段'); }}
                    >
                      复制标准网段
                    </button>
                  </div>

                  <dl className="summary-grid">
                    <SummaryItem
                      label="地址总数"
                      value={formatBigInt(cidrResult.total)}
                    />
                    <SummaryItem label="首个地址" value={cidrResult.first} />
                    <SummaryItem label="末尾地址" value={cidrResult.last} />
                    {cidrResult.version === 4 && (
                      <>
                        <SummaryItem
                          label="子网掩码"
                          value={cidrResult.netmask ?? '—'}
                        />
                        <SummaryItem
                          label="通配符掩码"
                          value={cidrResult.wildcard ?? '—'}
                        />
                        <SummaryItem
                          label="广播地址"
                          value={cidrResult.broadcast ?? '—'}
                        />
                        <SummaryItem
                          label="常规可用主机"
                          value={formatBigInt(cidrResult.usableTotal)}
                        />
                      </>
                    )}
                  </dl>

                  <div className="list-toolbar">
                    <div>
                      <strong>网段内地址</strong>
                      <span>
                        第
                        {' '}
                        {formatBigInt(addressPage.startIndex)}
                        –
                        {formatBigInt(addressPage.endIndex)}
                        {' '}
                        项， 共
                        {' '}
                        {formatBigInt(addressPage.itemCount)}
                        {' '}
                        项
                      </span>
                    </div>
                    <div className="list-actions">
                      {cidrResult.version === 4 && (
                        <label className="switch-label">
                          <input
                            type="checkbox"
                            checked={usableOnly}
                            onChange={(event) => {
                              setUsableOnly(event.target.checked);
                              showPage(1n);
                            }}
                          />
                          <span className="switch" aria-hidden="true" />
                          只看可用主机
                        </label>
                      )}
                      <label className="page-size">
                        每页
                        <select
                          value={pageSize}
                          onChange={(event) => {
                            setPageSize(Number(event.target.value));
                            showPage(1n);
                          }}
                        >
                          <option value={64}>64</option>
                          <option value={128}>128</option>
                          <option value={256}>256</option>
                        </select>
                      </label>
                      <button
                        className="copy-button compact"
                        onClick={() => {
                          requestCopy(
                            addressPage.rows.map(row => row.address).join('\n'),
                            `已复制当前页 ${addressPage.rows.length} 个地址`,
                          );
                        }}
                      >
                        复制本页
                      </button>
                    </div>
                  </div>

                  <div className="desktop-table table-wrap address-list-table">
                    <table>
                      <thead>
                        <tr>
                          <th>序号</th>
                          <th>IP 地址</th>
                          <th>类型</th>
                          <th>
                            <span className="sr-only">操作</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {addressPage.rows.map((row, index) => (
                          <tr key={row.address}>
                            <td className="row-number">
                              {formatBigInt(
                                addressPage.startIndex + BigInt(index),
                              )}
                            </td>
                            <td className="mono strong-cell">{row.address}</td>
                            <td>
                              <span className={`role-badge role-${row.role}`}>
                                {row.role}
                              </span>
                            </td>
                            <td>
                              <button
                                className="icon-copy"
                                aria-label={`复制 ${row.address}`}
                                onClick={() => { requestCopy(row.address, `已复制 ${row.address}`); }}
                              >
                                复制
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mobile-cards">
                    {addressPage.rows.map((row, index) => (
                      <article
                        className="address-card compact-card"
                        key={row.address}
                      >
                        <div>
                          <span>
                            #
                            {formatBigInt(addressPage.startIndex + BigInt(index))}
                          </span>
                          <button
                            onClick={() => { requestCopy(row.address, `已复制 ${row.address}`); }}
                          >
                            复制
                          </button>
                        </div>
                        <strong className="mono">{row.address}</strong>
                        <p>
                          <span className={`role-badge role-${row.role}`}>
                            {row.role}
                          </span>
                        </p>
                      </article>
                    ))}
                  </div>

                  <div className="pagination" aria-label="地址列表分页">
                    <div className="page-buttons">
                      <button
                        onClick={() => {
                          showPage(1n);
                        }}
                        disabled={addressPage.page === 1n}
                      >
                        首页
                      </button>
                      <button
                        onClick={() => {
                          showPage(addressPage.page - 1n);
                        }}
                        disabled={addressPage.page === 1n}
                      >
                        上一页
                      </button>
                      <span>
                        第
                        {' '}
                        <strong>{formatBigInt(addressPage.page)}</strong>
                        {' '}
                        /
                        {' '}
                        {formatBigInt(addressPage.pageCount)}
                        {' '}
                        页
                      </span>
                      <button
                        onClick={() => {
                          showPage(addressPage.page + 1n);
                        }}
                        disabled={addressPage.page === addressPage.pageCount}
                      >
                        下一页
                      </button>
                      <button
                        onClick={() => {
                          showPage(addressPage.pageCount);
                        }}
                        disabled={addressPage.page === addressPage.pageCount}
                      >
                        末页
                      </button>
                    </div>
                    <form className="jump-form" onSubmit={jumpToPage}>
                      <label htmlFor="page-input">跳至</label>
                      <input
                        id="page-input"
                        value={pageInput}
                        inputMode="numeric"
                        onChange={(event) => {
                          setPageInput(event.target.value);
                        }}
                        aria-invalid={Boolean(pageError)}
                      />
                      <button type="submit">前往</button>
                      {pageError && <span role="alert">{pageError}</span>}
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}
      </section>

      <section className="principles shell" aria-label="计算原则">
        <article>
          <span>01</span>
          <div>
            <h3>严格标准化</h3>
            <p>识别主机位、压缩 IPv6，并拒绝有歧义的地址格式。</p>
          </div>
        </article>
        <article>
          <span>02</span>
          <div>
            <h3>大数安全</h3>
            <p>使用 BigInt 处理最多 2¹²⁸ 个地址，不做精度妥协。</p>
          </div>
        </article>
        <article>
          <span>03</span>
          <div>
            <h3>本地优先</h3>
            <p>输入与结果始终留在浏览器，不进行网络查询或保存。</p>
          </div>
        </article>
      </section>

      <footer className="site-footer shell">
        <span>IP 网段转换器</span>
        <p>专注地址与 CIDR 计算，不提供地理位置或运营商查询。</p>
      </footer>

      <div
        className={`toast ${copied ? 'show' : ''}`}
        role="status"
        aria-live="polite"
      >
        {copied}
      </div>
    </main>
  );
}
