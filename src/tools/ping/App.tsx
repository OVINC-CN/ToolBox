import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import logoMark from '../../assets/logo-mark.svg';
import LatencyMap, { type MapViewRequest } from './LatencyMap';
import { buildRoutes, countCombinations, estimateLatency, latencyBand, routeId } from './model';
import {
  COUNTRIES,
  DEFAULT_REGIONS,
  REGIONS,
  regionName,
  selectedRegions,
  type RegionCode,
} from './regions';

function CountryCheckbox({ checked, partial, label, onChange }: {
  checked: boolean;
  partial: boolean;
  label: string;
  onChange: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = partial;
    }
  }, [partial]);
  return <input ref={inputRef} type="checkbox" checked={checked} aria-label={label} onChange={onChange} />;
}

function RegionSelector({ codes, query, onQueryChange, onChange }: {
  codes: ReadonlySet<RegionCode>;
  query: string;
  onQueryChange: (query: string) => void;
  onChange: (codes: Set<RegionCode>) => void;
}) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleCountries = COUNTRIES.map(country => ({
    ...country,
    visibleRegions: country.regions.filter(region => regionName(region).toLocaleLowerCase().includes(normalizedQuery)),
  })).filter(country => country.visibleRegions.length > 0);

  function toggleRegions(regionCodes: readonly RegionCode[]) {
    const next = new Set(codes);
    const remove = regionCodes.every(code => next.has(code));
    for (const code of regionCodes) {
      if (remove) {
        next.delete(code);
      }
      else {
        next.add(code);
      }
    }
    onChange(next);
  }

  return (
    <fieldset className="region-selector">
      <legend>
        <span className="selection-dot" />
        地区选择
        <span className="selector-count">
          {codes.size}
          {' '}
          /
          {' '}
          {REGIONS.length}
        </span>
      </legend>
      <p className="selection-hint">所选地区同时作为源和目标</p>
      <label className="region-search">
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <circle cx="8" cy="8" r="5" />
          <path d="m12 12 5 5" />
        </svg>
        <input
          type="search"
          aria-label="搜索地区"
          placeholder="搜索代码、国家或地区"
          value={query}
          onChange={(event) => { onQueryChange(event.target.value); }}
        />
      </label>
      <div className="selection-actions">
        <span>按国家选择 / 任意多选</span>
        <button type="button" onClick={() => { onChange(new Set(REGIONS.map(region => region.code))); }}>全选</button>
        <button type="button" onClick={() => { onChange(new Set()); }}>清空</button>
      </div>
      <div className="region-list">
        {visibleCountries.map((country) => {
          const countryCodes = country.regions.map(region => region.code);
          const selectedCount = countryCodes.filter(code => codes.has(code)).length;
          return (
            <div className="country-group" key={country.code}>
              <label className="country-option">
                <CountryCheckbox
                  checked={selectedCount === countryCodes.length}
                  partial={selectedCount > 0 && selectedCount < countryCodes.length}
                  label={`选择地区：${country.name}全部地区`}
                  onChange={() => { toggleRegions(countryCodes); }}
                />
                <span>{country.name}</span>
                <small>
                  {selectedCount}
                  /
                  {countryCodes.length}
                </small>
              </label>
              {country.visibleRegions.map(region => (
                <label className={`region-option${codes.has(region.code) ? ' is-selected' : ''}`} key={region.code}>
                  <input type="checkbox" checked={codes.has(region.code)} onChange={() => { toggleRegions([region.code]); }} />
                  <span>{regionName(region)}</span>
                </label>
              ))}
            </div>
          );
        })}
        {visibleCountries.length === 0 && <p className="search-empty">没有匹配的地区</p>}
      </div>
      <p className="selection-summary">
        {codes.size > 0 ? selectedRegions(codes).map(region => region.code).join(' · ') : '尚未选择地区'}
      </p>
    </fieldset>
  );
}

export default function App() {
  const [query, setQuery] = useState('');
  const [regionCodes, setRegionCodes] = useState<Set<RegionCode>>(() => new Set(DEFAULT_REGIONS));
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [viewRequest, setViewRequest] = useState<MapViewRequest>({ kind: 'world' });
  const regions = useMemo(() => selectedRegions(regionCodes), [regionCodes]);
  const routes = useMemo(() => buildRoutes(regions, regions), [regions]);
  const combinations = countCombinations(regions, regions);
  const focusedRoute = routes.find(route => route.id === focusedId);
  const focusRoute = useCallback((id: string) => {
    setFocusedId(current => current === id ? null : id);
  }, []);
  const lowestRtt = routes.length ? Math.min(...routes.map(route => route.estimate.minRttMs)) : null;
  const highestRtt = routes.length ? Math.max(...routes.map(route => route.estimate.minRttMs)) : null;

  function changeSelection(codes: Set<RegionCode>) {
    setRegionCodes(codes);
    setFocusedId(null);
  }

  function resetSelection() {
    changeSelection(new Set(DEFAULT_REGIONS));
    setQuery('');
  }

  return (
    <main className="ping-shell">
      <header className="ping-topbar">
        <a href="/" className="ping-brand">
          <img src={logoMark} alt="" />
          <span>
            TOOL BOX
            <span className="brand-divider">/</span>
            PING
          </span>
        </a>
        <span className="topbar-note">
          <span />
          GEOGRAPHIC ESTIMATE
        </span>
      </header>

      <section className="ping-heading" aria-labelledby="page-title">
        <div>
          <p className="eyebrow">GLOBAL LATENCY ATLAS</p>
          <h1 id="page-title">
            全球网络延迟
            <span className="heading-dot">.</span>
          </h1>
          <p className="heading-description">选择地区，在世界地图上对比所选地区之间的预估最小往返延迟。</p>
        </div>
        <div className="heading-meta">
          <strong>{REGIONS.length}</strong>
          <span>
            地区节点
            <br />
            {COUNTRIES.length}
            {' '}
            个国家
          </span>
          <span className="model-badge">地理模型估算</span>
        </div>
      </section>

      <div className="ping-workspace">
        <aside className="ping-controls" aria-label="地区选择">
          <RegionSelector codes={regionCodes} query={query} onQueryChange={setQuery} onChange={changeSelection} />
          <button className="reset-selection" type="button" onClick={resetSelection}>
            恢复默认选择
            <span aria-hidden="true">↺</span>
          </button>
        </aside>

        <div className="ping-results">
          <section className="map-card" aria-label="世界延迟地图">
            <div className="map-toolbar">
              <div>
                <span className="map-status" />
                <h2>世界网络路径</h2>
                <span className="route-count" role="status">
                  {routes.length}
                  {' '}
                  条连线
                </span>
              </div>
              <button type="button" onClick={() => { setViewRequest({ kind: 'routes', regions }); }}>
                <span aria-hidden="true">⤢</span>
                适配线路
              </button>
            </div>
            <LatencyMap
              regions={regions}
              routes={routes}
              focusedId={focusedRoute?.id ?? null}
              onFocus={focusRoute}
              viewRequest={viewRequest}
            />
            <div className="map-bottom-bar">
              <div className="map-selection-legend">
                <span>
                  <i className="selected-dot" />
                  已选地区
                </span>
              </div>
              <span>拖动平移 · 滚轮 / 双指缩放</span>
            </div>
          </section>

          <div className="route-readout" role="status">
            <div>
              <span>地区组合</span>
              <strong>
                {combinations}
                <small>组</small>
              </strong>
            </div>
            <div>
              <span>所选线路最低值</span>
              <strong>
                {lowestRtt ?? '—'}
                <small>ms</small>
              </strong>
            </div>
            <div>
              <span>所选线路最高值</span>
              <strong>
                {highestRtt ?? '—'}
                <small>ms</small>
              </strong>
            </div>
          </div>

          <section className={`route-detail${focusedRoute ? ' has-focus' : ''}`} aria-label="线路详情">
            {focusedRoute
              ? (
                <>
                  <div className="detail-heading">
                    <span>当前聚焦线路</span>
                    <button type="button" onClick={() => { setFocusedId(null); }}>取消聚焦 ×</button>
                  </div>
                  <h3>
                    {regionName(focusedRoute.source)}
                    <span aria-hidden="true">{focusedRoute.bidirectional ? '↔' : '→'}</span>
                    {regionName(focusedRoute.target)}
                  </h3>
                  <dl>
                    <div>
                      <dt>预估最小往返延迟</dt>
                      <dd>
                        ≈
                        {focusedRoute.estimate.minRttMs}
                        <small>ms</small>
                      </dd>
                    </div>
                    <div>
                      <dt>模型区间</dt>
                      <dd>
                        {focusedRoute.estimate.minRttMs}
                        –
                        {focusedRoute.estimate.maxRttMs}
                        <small>ms</small>
                      </dd>
                    </div>
                    <div>
                      <dt>大圆距离</dt>
                      <dd>
                        {Math.round(focusedRoute.estimate.distanceKm).toLocaleString('zh-CN')}
                        <small>km</small>
                      </dd>
                    </div>
                  </dl>
                </>
              )
              : <p>{routes.length ? '点击地图连线、延迟标注或矩阵单元格，查看线路详情。' : regions.length === 1 ? '已选择 1 个地区，请再选择至少一个地区以生成连线。' : '请选择至少两个地区以生成连线。'}</p>}
          </section>

          <section className="matrix-card" aria-labelledby="matrix-title">
            <div className="matrix-heading">
              <div>
                <p className="eyebrow">REGION × REGION</p>
                <h2 id="matrix-title">延迟矩阵</h2>
              </div>
              <span>预估最小 RTT · ms</span>
            </div>
            {regions.length > 0
              ? (
                <div className="matrix-scroll" role="region" aria-label="可滚动的延迟矩阵">
                  <table>
                    <caption className="sr-only">所选地区之间的预估最小 RTT（模型区间下限）和模型区间，单位毫秒。行和列使用相同的地区，相同地区不生成连线。</caption>
                    <thead>
                      <tr>
                        <th scope="col" className="matrix-corner">地区 ↓ / 地区 →</th>
                        {regions.map(target => <th scope="col" key={target.code}>{regionName(target)}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {regions.map(source => (
                        <tr key={source.code}>
                          <th scope="row">{regionName(source)}</th>
                          {regions.map((target) => {
                            if (source.code === target.code) {
                              return (
                                <td className="same-region" key={target.code}>
                                  <span aria-label="相同地区，不生成连线">—</span>
                                  <small>同一地区</small>
                                </td>
                              );
                            }
                            const estimate = estimateLatency(source, target);
                            const id = routeId(source, target);
                            return (
                              <td key={target.code}>
                                <button
                                  type="button"
                                  className={`matrix-value latency-${latencyBand(estimate.minRttMs)}`}
                                  aria-pressed={focusedId === id}
                                  aria-label={`${regionName(source)}到${regionName(target)}，预估最小 RTT ${estimate.minRttMs} 毫秒，模型区间 ${estimate.minRttMs} 至 ${estimate.maxRttMs} 毫秒`}
                                  onClick={() => { focusRoute(id); }}
                                >
                                  <strong>{estimate.minRttMs}</strong>
                                  <small>
                                    {estimate.minRttMs}
                                    –
                                    {estimate.maxRttMs}
                                    {' '}
                                    ms
                                  </small>
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
              : <p className="matrix-empty">选择地区后，所选地区之间的延迟会显示在这里。</p>}
            <div className="matrix-footer">
              <span>
                <i className="latency-low-dot" />
                &lt; 50 ms
              </span>
              <span>
                <i className="latency-medium-dot" />
                50–149 ms
              </span>
              <span>
                <i className="latency-high-dot" />
                ≥ 150 ms
              </span>
              <span>反向 RTT 相同 · 点击数值聚焦线路</span>
            </div>
          </section>
        </div>
      </div>

      <section className="estimate-notice" aria-label="估算说明">
        <span aria-hidden="true">i</span>
        <p>地图和矩阵主数值展示地理模型区间下限，即预估最小 RTT。实际延迟会受到运营商互联、跨境路由、拥堵和回程差异影响；模型区间不代表统计置信区间。</p>
      </section>
      <details className="model-notes">
        <summary>
          估算方法与数据来源
          <span>RTT / ms</span>
        </summary>
        <div className="model-notes-content">
          <div>
            <h3>距离 → 往返延迟</h3>
            <p>以城市中心坐标和半径 6,371 km 的地球计算 Haversine 大圆距离 d。光纤传播速度取 200,000 km/s，理想往返传播时间为 d / 100 ms。</p>
            <code>最小 RTT = round(1.3 × d / 100 + 2)</code>
            <p>展示值取模型区间下限。中心估算为 round(2.1 × d / 100 + 5) ms，模型区间为 round(1.3 × d / 100 + 2) 至 round(3 × d / 100 + 15) ms。绕行系数参考光纤网络研究，固定开销和区间参数属于通用工程假设。</p>
          </div>
          <div>
            <h3>节点与参考资料</h3>
            <p>硅谷使用圣何塞，弗吉尼亚使用阿什本的城市中心坐标。节点用于地区对比，不对应某个云厂商机房或实际探测端点。</p>
            <p>连线表示两地间的最短大圆路径，跨洲线路可能向极地弯曲；不代表实际海底光缆或运营商路由。</p>
            <a href="https://blog.cloudflare.com/making-home-internet-faster/" target="_blank" rel="noopener noreferrer">Cloudflare · 光纤传播速度 ↗</a>
            <a href="https://arxiv.org/abs/1811.10737" target="_blank" rel="noopener noreferrer">Dissecting Latency in the Internet’s Fiber Infrastructure ↗</a>
            <a href="https://github.com/nvkelso/natural-earth-vector/tree/v5.1.2" target="_blank" rel="noopener noreferrer">Natural Earth v5.1.2 · 公有领域地理数据 ↗</a>
          </div>
        </div>
      </details>
      <footer className="ping-footer">
        <span>TOOL BOX / PING</span>
        <span>模型计算与地图资源由本站提供</span>
        <a href="#page-title">回到顶部 ↑</a>
      </footer>
    </main>
  );
}
