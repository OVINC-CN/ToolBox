import { PALETTES } from './palettes.js';
import referenceUrl from './assets/dreamy-gradient.png';

const SIZE = 384;
const rgb = hex =>
  [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
function surface(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** Canvas 动画独立于界面：纹理颜色映射、镜像边界、连续变形及平滑切换。 */
export function createGradientScene(canvas, options) {
  const ctx = canvas.getContext('2d', { alpha: false });
  const image = new Image();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const textures = new Map();
  let ready = false,
    disposed = false,
    frame = 0,
    lastTime = 0,
    lastPaint = 0,
    time = 0;
  let paused = options.paused,
    speed = options.speed,
    lines = options.lines;
  let selected = options.palette,
    weights,
    current,
    next = null,
    mix = 1;
  const pointer = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5, strength: 0, target: 0 };

  function mirror(texture) {
    const extended = surface(SIZE * 3, SIZE);
    const c = extended.getContext('2d');
    c.drawImage(texture, SIZE, 0);
    for (const x of [SIZE, SIZE * 3]) {
      c.save();
      c.translate(x, 0);
      c.scale(-1, 1);
      c.drawImage(texture, 0, 0);
      c.restore();
    }
    return extended;
  }

  function prepareBase() {
    const base = surface(SIZE, SIZE);
    const c = base.getContext('2d', { willReadFrequently: true });
    c.drawImage(image, 0, 0, SIZE, SIZE);
    const pixels = c.getImageData(0, 0, SIZE, SIZE).data;
    weights = new Float32Array(SIZE * SIZE * 5);
    const anchors = PALETTES[0].colors.map(rgb);
    for (let pixel = 0; pixel < SIZE * SIZE; pixel++) {
      let sum = 0;
      for (let j = 0; j < 5; j++) {
        let distance = 0;
        for (let channel = 0; channel < 3; channel++) {
          distance
            += (pixels[pixel * 4 + channel] / 255 - anchors[j][channel]) ** 2;
        }
        const weight = Math.exp(-distance / 0.055);
        weights[pixel * 5 + j] = weight;
        sum += weight;
      }
      for (let j = 0; j < 5; j++) {
        weights[pixel * 5 + j] /= sum || 1;
      }
    }
    textures.set(PALETTES[0].id, mirror(base));
  }

  function getTexture(id) {
    if (textures.has(id)) {
      return textures.get(id);
    }
    const palette = PALETTES.find(p => p.id === id) || PALETTES[0];
    const colors = palette.colors.map(rgb);
    const texture = surface(SIZE, SIZE),
      c = texture.getContext('2d');
    const output = c.createImageData(SIZE, SIZE);
    for (let pixel = 0; pixel < SIZE * SIZE; pixel++) {
      for (let channel = 0; channel < 3; channel++) {
        let value = 0;
        for (let j = 0; j < 5; j++) {
          value += weights[pixel * 5 + j] * colors[j][channel];
        }
        output.data[pixel * 4 + channel] = Math.round(value * 255);
      }
      output.data[pixel * 4 + 3] = 255;
    }
    c.putImageData(output, 0, 0);
    const extended = mirror(texture);
    textures.set(id, extended);
    return extended;
  }

  function paintTexture(texture, alpha) {
    ctx.globalAlpha = alpha;
    const w = canvas.width,
      h = canvas.height,
      strips = Math.ceil(h / 3);
    const sway = Math.sin(time * 0.38) * 0.035;
    const warpY = y =>
      y
      + 0.035
      * Math.sin(y * Math.PI)
      * (Math.sin(y * 5 + time * 0.3) - Math.sin(y * 5));
    for (let i = 0; i < strips; i++) {
      const y = i / strips;
      const interact
        = (pointer.x - 0.5)
          * 0.025
          * pointer.strength
          * Math.exp(-((y - pointer.y) ** 2) * 5);
      const shift
        = (Math.sin(y * 5.8 + time * 0.48) - Math.sin(y * 5.8)) * 0.1
          + sway
          + interact;
      const top = warpY(y),
        bottom = warpY((i + 1) / strips);
      ctx.drawImage(
        texture,
        SIZE * (1 - shift),
        top * SIZE,
        SIZE,
        Math.max(0.1, (bottom - top) * SIZE),
        0,
        (i * h) / strips,
        w,
        h / strips + 1,
      );
    }
  }

  function render() {
    if (!ready || disposed) {
      return;
    }
    paintTexture(current, 1);
    if (next) {
      paintTexture(next, mix * mix * (3 - 2 * mix));
    }
    ctx.globalAlpha = 1;
    if (!lines) {
      return;
    }
    const w = canvas.width,
      h = canvas.height;
    ctx.strokeStyle = 'rgba(255,247,252,.11)';
    ctx.lineWidth = Math.max(2, h * 0.0055);
    ctx.lineCap = 'round';
    for (let k = -2; k < 8; k++) {
      ctx.beginPath();
      for (let x = 0; x <= w + 6; x += 6) {
        const u = x / w;
        const y
          = (k / 4
            + 0.2 * Math.sin(u * 5.3 - time * 0.18)
            + 0.055 * Math.sin(u * 10 + time * 0.25)
            + ((time * 0.012) % 0.25))
          * h;
        if (!x) {
          ctx.moveTo(x, y);
        }
        else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    }
  }

  function tick(now) {
    frame = 0;
    if (disposed || document.hidden || !ready) {
      return;
    }
    const dt = lastTime ? Math.min((now - lastTime) / 1000, 0.08) : 0;
    lastTime = now;
    if (!paused) {
      time += dt * speed;
      const ease = 1 - Math.exp(-dt * 3);
      pointer.x += (pointer.tx - pointer.x) * ease;
      pointer.y += (pointer.ty - pointer.y) * ease;
      pointer.strength += (pointer.target - pointer.strength) * ease;
    }
    if (next) {
      mix = Math.min(1, mix + dt / 0.8);
      if (mix >= 1) {
        current = next;
        next = null;
      }
    }
    if (now - lastPaint >= 25 || (paused && !next)) {
      render();
      lastPaint = now;
    }
    if (!paused || next) {
      frame = requestAnimationFrame(tick);
    }
  }
  function schedule() {
    if (!frame && ready && !disposed && !document.hidden) {
      lastTime = 0;
      frame = requestAnimationFrame(tick);
    }
  }
  function resize() {
    const box = canvas.getBoundingClientRect();
    const dpr = Math.min(
      devicePixelRatio || 1,
      1.25,
      Math.sqrt(1300000 / (box.width * box.height)),
    );
    canvas.width = Math.max(1, Math.round(box.width * dpr));
    canvas.height = Math.max(1, Math.round(box.height * dpr));
    render();
  }
  function setPalette(id) {
    selected = id;
    if (!ready) {
      return;
    }
    const target = getTexture(id);
    if (next === target || (!next && current === target)) {
      return;
    }
    if (next) {
      const blended = surface(SIZE * 3, SIZE),
        c = blended.getContext('2d');
      c.drawImage(current, 0, 0);
      c.globalAlpha = mix * mix * (3 - 2 * mix);
      c.drawImage(next, 0, 0);
      current = blended;
    }
    if (reduced.matches) {
      current = target;
      next = null;
      mix = 1;
      render();
    }
    else {
      next = target;
      mix = 0;
      schedule();
    }
    canvas.dataset.palette = id;
  }
  function onPointer(e) {
    if (e.pointerType !== 'touch') {
      pointer.tx = e.clientX / innerWidth;
      pointer.ty = e.clientY / innerHeight;
      pointer.target = 1;
    }
  }
  function onLeave() {
    pointer.target = 0;
  }
  function onVisibility() {
    if (document.hidden) {
      cancelAnimationFrame(frame);
      frame = 0;
      lastTime = 0;
    }
    else {
      schedule();
    }
  }
  image.onload = () => {
    if (disposed) {
      return;
    }
    prepareBase();
    current = getTexture(selected);
    ready = true;
    canvas.dataset.ready = 'true';
    canvas.dataset.palette = selected;
    resize();
    schedule();
  };
  image.onerror = () => options.onError?.('画面加载失败，请刷新页面重试。');
  image.src = referenceUrl;
  window.addEventListener('resize', resize);
  window.addEventListener('pointermove', onPointer, { passive: true });
  document.documentElement.addEventListener('pointerleave', onLeave);
  document.addEventListener('visibilitychange', onVisibility);
  resize();
  return {
    setPalette,
    setSpeed(value) {
      speed = value;
    },
    setPaused(value) {
      paused = value;
      canvas.dataset.paused = String(value);
      schedule();
    },
    setLines(value) {
      lines = value;
      render();
    },
    destroy() {
      disposed = true;
      cancelAnimationFrame(frame);
      image.onload = null;
      image.onerror = null;
      textures.clear();
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onPointer);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      document.removeEventListener('visibilitychange', onVisibility);
    },
  };
}
