import { useEffect, useRef, useState } from 'react';
import { PALETTES, palettePreview } from './palettes.js';
import { createGradientScene } from './gradient-scene.js';

export function App() {
  const canvasRef = useRef(null),
    sceneRef = useRef(null),
    paletteButtons = useRef([]),
    revealTimer = useRef(null);
  const [activeId, setActiveId] = useState(PALETTES[0].id);
  const [panelOpen, setPanelOpen] = useState(true);
  const [touchRevealed, setTouchRevealed] = useState(false);
  const [paused, setPaused] = useState(
    () => matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const [speed, setSpeed] = useState(1),
    [lines, setLines] = useState(false),
    [error, setError] = useState('');
  const activePalette = PALETTES.find(p => p.id === activeId);
  const activeIndex = PALETTES.indexOf(activePalette);

  useEffect(() => {
    const scene = createGradientScene(canvasRef.current, {
      palette: PALETTES[0].id,
      paused: matchMedia('(prefers-reduced-motion: reduce)').matches,
      speed: 1,
      lines: false,
      onError: setError,
    });
    sceneRef.current = scene;
    return () => {
      scene.destroy();
      sceneRef.current = null;
    };
  }, []);
  useEffect(() => {
    sceneRef.current?.setPalette(activeId);
  }, [activeId]);
  useEffect(() => {
    sceneRef.current?.setPaused(paused);
  }, [paused]);
  useEffect(() => {
    sceneRef.current?.setSpeed(speed);
  }, [speed]);
  useEffect(() => {
    sceneRef.current?.setLines(lines);
  }, [lines]);
  useEffect(() => () => clearTimeout(revealTimer.current), []);
  useEffect(() => {
    function keydown(event) {
      if (
        event.target.closest(
          'button, input, select, textarea, [contenteditable]',
        )
        || event.repeat
      ) {
        return;
      }
      if (event.code === 'Space') {
        event.preventDefault();
        setPaused(value => !value);
      }
      if (event.key.toLowerCase() === 'h') {
        setPanelOpen(value => !value);
      }
    }
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const onReduced = event => setPaused(event.matches);
    window.addEventListener('keydown', keydown);
    media.addEventListener('change', onReduced);
    return () => {
      window.removeEventListener('keydown', keydown);
      media.removeEventListener('change', onReduced);
    };
  }, []);
  function paletteKeydown(event, index) {
    const offsets = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 2, ArrowUp: -2 };
    if (!(event.key in offsets)) {
      return;
    }
    event.preventDefault();
    const nextIndex
      = (index + offsets[event.key] + PALETTES.length) % PALETTES.length;
    setActiveId(PALETTES[nextIndex].id);
    paletteButtons.current[nextIndex]?.focus();
  }
  function togglePanel(event) {
    clearTimeout(revealTimer.current);
    setTouchRevealed(false);
    setPanelOpen(value => !value);
    // 隐藏后移除点击焦点，避免鼠标离开时按钮仍被焦点状态显示。
    event.currentTarget.blur();
  }
  function revealOnTouch(event) {
    if (panelOpen || event.pointerType === 'mouse') {
      return;
    }
    clearTimeout(revealTimer.current);
    setTouchRevealed(true);
    revealTimer.current = setTimeout(() => setTouchRevealed(false), 3000);
  }

  return (
    <main
      className="studio"
      data-dark={activeId === 'midnight'}
      data-controls-hidden={!panelOpen}
      style={{ backgroundImage: palettePreview(PALETTES[0].colors) }}
    >
      <canvas
        ref={canvasRef}
        className="scene"
        role="img"
        aria-label={`${activePalette.name}，流动的柔光渐变${lines ? '与线条' : ''}`}
      />
      <header className="topbar">
        <div className="wordmark" hidden={!panelOpen}>
          流动彩霞
          <span>COLOR FLOW</span>
        </div>
        <div className="panel-reveal-zone" onPointerDown={revealOnTouch}>
          <button
            className="panel-toggle"
            data-touch-revealed={touchRevealed}
            aria-expanded={panelOpen}
            aria-controls="color-panel"
            onClick={togglePanel}
          >
            {panelOpen ? '隐藏面板' : '展开调色'}
          </button>
        </div>
      </header>
      <section
        id="color-panel"
        className="color-panel"
        aria-label="调色面板"
        hidden={!panelOpen}
      >
        <div className="panel-heading">
          <h1>颜色预设</h1>
          <span>10 种配色</span>
        </div>
        <div className="palette-grid" role="group" aria-label="颜色预设">
          {PALETTES.map((palette, index) => (
            <button
              key={palette.id}
              ref={(el) => {
                paletteButtons.current[index] = el;
              }}
              className={`palette-button${activeId === palette.id ? ' selected' : ''}`}
              aria-pressed={activeId === palette.id}
              onClick={() => setActiveId(palette.id)}
              onKeyDown={event => paletteKeydown(event, index)}
            >
              <span
                className="palette-swatch"
                aria-hidden="true"
                style={{ backgroundImage: palettePreview(palette.colors) }}
              />
              <span>{palette.name}</span>
              <span className="selected-dot" aria-hidden="true" />
            </button>
          ))}
        </div>
        <div className="motion-controls">
          <div className="speed-heading">
            <label htmlFor="flow-speed">流动速度</label>
            <output htmlFor="flow-speed">
              {Number(speed.toFixed(2))}
              ×
            </output>
          </div>
          <input
            id="flow-speed"
            type="range"
            min="0.25"
            max="2"
            step="0.25"
            value={speed}
            onChange={e => setSpeed(Number(e.target.value))}
            aria-valuetext={`${speed} 倍速`}
          />
          <div className="control-row">
            <label className="line-toggle">
              <input
                type="checkbox"
                checked={lines}
                onChange={e => setLines(e.target.checked)}
              />
              <span>流动线条</span>
            </label>
            <button
              className="pause-button"
              aria-label={paused ? '继续动画' : '暂停动画'}
              onClick={() => setPaused(v => !v)}
            >
              {paused ? '继续播放' : '暂停动画'}
            </button>
          </div>
        </div>
        <p className="keyboard-hint">空格键暂停 · H 键隐藏面板</p>
      </section>
      <div className="scene-caption" aria-live="polite" hidden={!panelOpen}>
        <span>
          {String(activeIndex + 1).padStart(2, '0')}
          {' '}
          / 10
        </span>
        {activePalette.name}
      </div>
      {error && panelOpen && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
    </main>
  );
}
