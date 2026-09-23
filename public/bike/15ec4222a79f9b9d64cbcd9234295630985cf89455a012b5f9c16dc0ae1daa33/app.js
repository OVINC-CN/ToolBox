(() => {
  'use strict';
  const byId = (id) => document.getElementById(id);
  const art = byId('coastal-ride');
  const button = byId('play-toggle');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const compact = window.matchMedia('(max-width: 700px)');
  const nodes = Object.fromEntries([
    'rear-spokes', 'front-spokes', 'crank-arms', 'leg-far', 'leg-near',
    'leg-highlight', 'foot-far', 'foot-near', 'kettle-upper', 'tea-tag',
    'clouds-near', 'clouds-far', 'sea-ripples', 'back-meadow', 'front-verge',
    'road-marks', 'kettle-eyes', 'steam-one', 'steam-two', 'wind-strokes', 'rider-shadow'
  ].map((id) => [id, byId(id)]));

  const TAU = Math.PI * 2;
  let time = 0;
  let paused = reducedMotion.matches;
  let frame = 0;
  let previous = null;
  const transform = (id, value) => nodes[id].setAttribute('transform', value);

  // A two-link leg reaches each moving pedal, so neither foot slides or floats.
  function pedalLeg(near, angle, bob) {
    const x = 590 + 29 * Math.cos(angle);
    const y = 570 + 29 * Math.sin(angle);
    const hip = { x: near ? 577 : 562, y: (near ? 424 : 428) + bob };
    const dx = x - hip.x;
    const dy = y - hip.y;
    const length = Math.hypot(dx, dy);
    const upper = 88;
    const lower = 91;
    const along = (upper * upper - lower * lower + length * length) / (2 * length);
    const bend = Math.sqrt(Math.max(0, upper * upper - along * along));
    const kneeX = hip.x + along * dx / length + bend * dy / length;
    const kneeY = hip.y + along * dy / length - bend * dx / length;
    const path = `M${hip.x} ${hip.y} Q${kneeX} ${kneeY} ${kneeX} ${kneeY} L${x} ${y - 4}`;
    nodes[near ? 'leg-near' : 'leg-far'].setAttribute('d', path);
    if (near) nodes['leg-highlight'].setAttribute('d', path);
    transform(near ? 'foot-near' : 'foot-far', `translate(${x} ${y - 10})`);
  }

  function draw() {
    const crank = time * TAU / 1.8 - Math.PI / 3;
    const degrees = crank * 180 / Math.PI;
    const wheelDegrees = time * 215 / 99 * 180 / Math.PI;
    const bob = Math.sin(crank * 2) * 1.2;
    transform('rear-spokes', `rotate(${wheelDegrees})`);
    transform('front-spokes', `rotate(${wheelDegrees})`);
    transform('crank-arms', `translate(590 570) rotate(${degrees})`);
    transform('kettle-upper', `translate(0 ${bob})`);
    pedalLeg(false, crank + Math.PI, bob);
    pedalLeg(true, crank, bob);
    transform('tea-tag', `rotate(${Math.sin(time * 5) * 9} 491 287)`);
    transform('steam-one', `translate(${Math.sin(time * 2.5) * 4} ${-((time * 12) % 32)})`);
    transform('steam-two', `translate(${Math.sin(time * 2.5 + 1.5) * 5} ${-((time * 10 + 16) % 32)})`);
    nodes['steam-one'].setAttribute('opacity', Math.sin(((time * 12) % 32) / 32 * Math.PI));
    nodes['steam-two'].setAttribute('opacity', Math.sin(((time * 10 + 16) % 32) / 32 * Math.PI));
    transform('clouds-near', `translate(${-((time * 9) % 1100)} 0)`);
    transform('clouds-far', `translate(${-((time * 4) % 1100)} 0)`);
    transform('sea-ripples', `translate(${-((time * 10) % 500)} ${Math.sin(time * 1.5) * 1.5})`);
    transform('back-meadow', `translate(${-((time * 120) % 600)} 0)`);
    transform('front-verge', `translate(${-((time * 215) % 600)} 0)`);
    nodes['road-marks'].setAttribute('stroke-dashoffset', (time * 215) % 184);
    nodes['wind-strokes'].setAttribute('opacity', 0.35 + (Math.sin(time * 2) + 1) * 0.15);
    nodes['rider-shadow'].setAttribute('rx', 259 + bob * 1.5);
    const blinkTime = time % 5.3;
    const eyeScale = blinkTime > 4.9 && blinkTime < 5.07 ? 0.08 : 1;
    transform('kettle-eyes', `translate(615 324) scale(1 ${eyeScale}) translate(-615 -324)`);
  }

  function tick(now) {
    frame = 0;
    if (paused || document.hidden) { previous = null; return; }
    if (previous !== null) time += Math.min((now - previous) / 1000, 0.05);
    previous = now;
    draw();
    frame = requestAnimationFrame(tick);
  }

  function updatePlayback() {
    cancelAnimationFrame(frame);
    frame = 0;
    previous = null;
    button.setAttribute('aria-pressed', String(paused));
    button.setAttribute('aria-label', paused ? '继续动画' : '暂停动画');
    byId('play-label').textContent = paused ? '继续兜风' : '歇一会儿';
    byId('ride-note').textContent = paused ? '停一停，也是一种风景。' : '不赶时间，只赶海风。';
    if (!paused && !document.hidden) frame = requestAnimationFrame(tick);
  }

  function resizeScene() {
    art.setAttribute('viewBox', compact.matches ? '310 70 710 650' : '0 0 1200 720');
  }

  button.addEventListener('click', () => { paused = !paused; updatePlayback(); });
  document.addEventListener('keydown', (event) => {
    if (event.code !== 'Space' || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.target;
    if (target instanceof Element && target.closest('button, a, input, textarea, select, summary, [contenteditable="true"]')) return;
    event.preventDefault();
    paused = !paused;
    updatePlayback();
  });
  document.addEventListener('visibilitychange', updatePlayback);
  reducedMotion.addEventListener('change', (event) => { if (event.matches) { paused = true; updatePlayback(); } });
  compact.addEventListener('change', resizeScene);
  resizeScene();
  draw();
  updatePlayback();
})();
