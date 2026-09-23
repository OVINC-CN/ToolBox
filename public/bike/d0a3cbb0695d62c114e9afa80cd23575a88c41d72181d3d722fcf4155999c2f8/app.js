(() => {
  'use strict';
  const byId = id => document.getElementById(id);
  const scene = byId('landscape');
  const painting = document.querySelector('.painting');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const narrow = matchMedia('(max-width: 720px)');
  let playing = !reduceMotion.matches;
  let speed = 1;
  let elapsed = 0;
  let previous = null;
  let frame = null;
  const nodes = Object.fromEntries([
    'expedition', 'emperor', 'bear-head', 'crown-beads', 'cape', 'cape-trim',
    'clouds', 'far-mountains', 'middle-mountains', 'near-ridge', 'road', 'distant-pines',
    'ground-shadow', 'dust-a', 'dust-b', 'leaf-a', 'leaf-b', 'leaf-c', 'bird-a', 'bird-b',
    'leg-back-far', 'leg-front-far', 'leg-back-near', 'leg-front-near',
    'knee-back-far', 'knee-front-far', 'knee-back-near', 'knee-front-near'
  ].map(id => [id, byId(id)]));
  const move = (id, transform) => nodes[id].setAttribute('transform', transform);
  function resize() {
    scene.setAttribute('viewBox', narrow.matches ? '390 0 940 820' : '0 0 1400 780');
  }
  narrow.addEventListener('change', resize);
  resize();
  function render(t) {
    const cycle = t * 4.8;
    const bob = Math.cos(cycle * 2) * 3.5;
    move('expedition', `translate(820 ${488 + bob})`);
    move('emperor', `translate(-17 ${-112 + Math.sin(cycle * 2 - .8) * 2}) rotate(${Math.sin(cycle) * .6} 0 0)`);
    move('bear-head', `translate(153 ${-41 + Math.sin(cycle * 2 + .7) * 2.5}) rotate(${Math.sin(cycle) * 1.1})`);
    move('crown-beads', `rotate(${Math.sin(cycle + .7) * 3} 20 -260)`);
    const stride = [
      ['back-far', Math.PI, 82], ['front-far', Math.PI / 2, 82],
      ['back-near', 0, 80], ['front-near', Math.PI * 1.5, 81]
    ];
    for (const [leg, phase, joint] of stride) {
      const angle = Math.sin(cycle + phase) * 18;
      const bend = Math.max(0, Math.cos(cycle + phase)) * 23;
      move('leg-' + leg, `rotate(${angle})`);
      move('knee-' + leg, `translate(0 ${joint}) rotate(${-bend})`);
    }
    const wind = Math.sin(t * 4) * 9;
    nodes.cape.setAttribute('d', `M-22-148C-78-157-108 ${-94 + wind}-178 ${-101 + wind}-144 ${-61 + wind}-143-26-211 ${-5 - wind}-146 ${8 - wind}-101-30-60-9L18-45Z`);
    nodes['cape-trim'].setAttribute('d', `M-35-135C-85-116-111 ${-65 + wind}-173 ${-81 + wind}M-178 ${-9 - wind}q73-2 105-53`);
    for (const [id, rate] of [['clouds', 5], ['far-mountains', 7], ['middle-mountains', 16], ['near-ridge', 29], ['road', 94], ['distant-pines', 41]]) {
      move(id, `translate(${-((t * rate) % 1400)} 0)`);
    }
    nodes['ground-shadow'].setAttribute('rx', String(218 + Math.cos(cycle * 2) * 6));
    for (const [index, id] of ['dust-a', 'dust-b'].entries()) {
      const age = (t * 1.1 + index * .5) % 1;
      move(id, `translate(${-age * 55} ${-age * 8})`);
      nodes[id].style.opacity = String((1 - age) * .7);
    }
    for (const [i, id] of ['leaf-a', 'leaf-b', 'leaf-c'].entries()) {
      const x = 1450 - ((t * (63 + i * 10) + i * 470) % 1520);
      const y = 410 + i * 55 + Math.sin(t * 1.7 + i * 2) * 37;
      move(id, `translate(${x} ${y}) rotate(${Math.sin(t * 2 + i) * 40})`);
    }
    move('bird-a', `translate(${Math.sin(t * .2) * 44} ${Math.sin(t * 2) * 3})`);
    move('bird-b', `translate(${Math.sin(t * .2 + .3) * 44} ${Math.sin(t * 2 + 1) * 3})`);
  }
  function tick(now) {
    frame = null;
    if (!playing || document.hidden) { previous = null; return; }
    if (previous !== null) elapsed += Math.min((now - previous) / 1000, .05) * speed;
    previous = now;
    render(elapsed);
    frame = requestAnimationFrame(tick);
  }
  function schedule() {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    previous = null;
    if (playing && !document.hidden) frame = requestAnimationFrame(tick);
  }
  function updatePlayback() {
    byId('play-toggle').setAttribute('aria-pressed', String(!playing));
    byId('play-toggle').setAttribute('aria-label', playing ? '暂停动画' : '播放动画');
    byId('play-label').textContent = playing ? '歇一会儿' : '继续出游';
    byId('play-icon').innerHTML = playing ? '<path d="M7 5v10M13 5v10"/>' : '<path d="m7 4 9 6-9 6Z"/>';
    byId('motion-status').textContent = playing ? '山河漫游中' : '驻足赏山河';
    painting.classList.toggle('is-paused', !playing);
    schedule();
  }
  byId('play-toggle').addEventListener('click', () => { playing = !playing; updatePlayback(); });
  byId('restart').addEventListener('click', () => { elapsed = 0; previous = null; render(0); });
  const speedButtons = Array.from(document.querySelectorAll('[data-speed]'));
  speedButtons.forEach(button => button.addEventListener('click', () => {
    speed = Number(button.dataset.speed);
    speedButtons.forEach(option => option.setAttribute('aria-pressed', String(option === button)));
  }));
  if (!document.fullscreenEnabled) byId('fullscreen').hidden = true;
  byId('fullscreen').addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (painting.requestFullscreen) await painting.requestFullscreen();
      else throw new Error('Fullscreen unavailable');
    } catch {
      byId('notice').hidden = false;
      byId('notice').textContent = '当前浏览器暂不支持全屏，可收起顶部版本栏，欣赏更大的画面。';
    }
  });
  document.addEventListener('visibilitychange', schedule);
  document.addEventListener('keydown', event => {
    if (event.code !== 'Space' || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.target.closest('button, input, select, textarea, a, [contenteditable]')) return;
    event.preventDefault(); playing = !playing; updatePlayback();
  });
  reduceMotion.addEventListener('change', event => {
    if (event.matches) { playing = false; updatePlayback(); }
  });
  render(0);
  updatePlayback();
})();
