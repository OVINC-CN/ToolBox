(() => {
  'use strict';
  const byId = (id) => document.getElementById(id);
  const scene = byId('scene');
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const smallScreen = window.matchMedia('(max-width: 700px)');
  let running = !motionPreference.matches;
  let speed = 1;
  let time = 0;
  let previousTime = null;
  let audioContext;
  let bellTimeout;
  const nodes = Object.fromEntries(['rear-spokes','front-spokes','crank','near-leg','near-leg-highlight','far-leg','far-leg-highlight','near-foot','far-foot','rider','rider-shadow','back-scarf','basket-flowers','cloud-a','cloud-b','cloud-c','far-hills','road-scroll','meadow-scroll','foreground-scroll','butterfly','eye','eye-shine','eye-closed','breeze'].map(id => [id, byId(id)]));
  const bars = [...byId('status-bars').children];

  function fitScene() {
    scene.setAttribute('viewBox', smallScreen.matches ? '325 10 585 550' : '0 0 1200 560');
    scene.setAttribute('preserveAspectRatio', 'xMidYMid slice');
  }
  fitScene();
  smallScreen.addEventListener('change', fitScene);

  function updatePlayback() {
    byId('play-icon').setAttribute('href', running ? '#icon-pause' : '#icon-play');
    byId('play-label').textContent = running ? '暂停一下' : '继续兜风';
    byId('play-toggle').setAttribute('aria-label', running ? '暂停动画' : '继续播放动画');
    byId('play-toggle').setAttribute('aria-pressed', String(!running));
    byId('ride-status').textContent = running ? '快乐骑行中' : '休息一小会';
    byId('ride-hint').textContent = running ? '慢慢骑，也会到达。' : '等你一起，再出发。';
    if (!running) bars.forEach((bar) => { bar.style.height = '5px'; });
  }

  function togglePlayback() {
    running = !running;
    updatePlayback();
    byId('announcements').textContent = running ? '继续骑行' : '动画已暂停';
  }
  byId('play-toggle').addEventListener('click', togglePlayback);
  motionPreference.addEventListener('change', (event) => {
    if (event.matches) { running = false; updatePlayback(); }
  });

  document.querySelectorAll('.speed-option').forEach((button) => {
    button.addEventListener('click', () => {
      speed = Number(button.dataset.speed);
      document.querySelectorAll('.speed-option').forEach((option) => {
        const selected = option === button;
        option.classList.toggle('selected', selected);
        option.setAttribute('aria-pressed', String(selected));
      });
      byId('announcements').textContent = `骑行速度已调整为 ${speed} 倍`;
    });
  });

  function ringBell() {
    const bubble = byId('bell-bubble');
    clearTimeout(bellTimeout);
    bubble.classList.add('visible');
    bellTimeout = window.setTimeout(() => bubble.classList.remove('visible'), 1450);
    byId('announcements').textContent = '叮铃铃！小鹈鹕向你打招呼。';
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    try {
      audioContext ||= new AudioContextClass();
      if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
      const now = audioContext.currentTime;
      [0, .14].forEach((delay, index) => {
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(index === 0 ? 1568 : 2093, now + delay);
        gain.gain.setValueAtTime(0, now + delay);
        gain.gain.linearRampToValueAtTime(.11, now + delay + .006);
        gain.gain.exponentialRampToValueAtTime(.0001, now + delay + .8);
        oscillator.connect(gain);
        gain.connect(audioContext.destination);
        oscillator.start(now + delay);
        oscillator.stop(now + delay + .85);
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
      });
    } catch { /* The visual bell works when browser audio is unavailable. */ }
  }
  byId('bell-button').addEventListener('click', ringBell);
  document.addEventListener('keydown', (event) => {
    if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.target.closest('button,a,input,select,textarea,[contenteditable="true"]')) return;
    if (event.code === 'Space') { event.preventDefault(); togglePlayback(); }
    if (event.code === 'KeyB') ringBell();
  });

  const transform = (id, value) => nodes[id].setAttribute('transform', value);
  function draw(t) {
    const cycle = t * 2.9;
    const rotation = t * 133;
    const pedalX = 598 + Math.cos(cycle) * 23;
    const pedalY = 418 + Math.sin(cycle) * 23;
    const farX = 598 - Math.cos(cycle) * 23;
    const farY = 418 - Math.sin(cycle) * 23;
    const nearPath = `M548 334Q${550 + Math.cos(cycle) * 12} ${379 + Math.sin(cycle) * 8} ${pedalX} ${pedalY - 6}`;
    const farPath = `M572 333Q${601 - Math.cos(cycle) * 10} ${370 - Math.sin(cycle) * 9} ${farX} ${farY - 6}`;
    ['near-leg','near-leg-highlight'].forEach(id => nodes[id].setAttribute('d', nearPath));
    ['far-leg','far-leg-highlight'].forEach(id => nodes[id].setAttribute('d', farPath));
    transform('near-foot', `translate(${pedalX} ${pedalY - 5}) rotate(${Math.sin(cycle) * 9})`);
    transform('far-foot', `translate(${farX} ${farY - 5}) rotate(${-Math.sin(cycle) * 7})`);
    transform('crank', `translate(598 418) rotate(${cycle * 180 / Math.PI})`);
    transform('rear-spokes', `rotate(${rotation})`);
    transform('front-spokes', `rotate(${rotation})`);
    const bounce = Math.sin(cycle * 2) * 1.6;
    transform('rider', `translate(0 ${bounce})`);
    transform('rider-shadow', `translate(0 ${bounce * .15})`);
    transform('back-scarf', `rotate(${Math.sin(t * 4.5) * 3.4} 540 233)`);
    transform('basket-flowers', `rotate(${Math.sin(t * 3.1) * 2.3} 749 308)`);
    transform('cloud-a', `translate(${-((t * 5) % 1450)} 0)`);
    transform('cloud-b', `translate(${Math.sin(t * .14) * 30} 0)`);
    transform('cloud-c', `translate(${Math.sin(t * .1) * 25} 0)`);
    transform('far-hills', `translate(${Math.sin(t * .065) * 100} 0)`);
    transform('road-scroll', `translate(${-((t * 96) % 1200)} 0)`);
    transform('meadow-scroll', `translate(${-((t * 48) % 1200)} 0)`);
    transform('foreground-scroll', `translate(${-((t * 120) % 1200)} 0)`);
    transform('butterfly', `translate(${908 + Math.sin(t * .7) * 28} ${278 + Math.sin(t * 1.7) * 13}) rotate(${Math.sin(t * 3) * 10}) scale(${.85 + Math.sin(t * 12) * .12} 1)`);
    const blink = t % 5.4 > 5.18;
    nodes.eye.setAttribute('opacity', blink ? '0' : '1');
    nodes['eye-shine'].setAttribute('opacity', blink ? '0' : '1');
    nodes['eye-closed'].setAttribute('opacity', blink ? '1' : '0');
    nodes.breeze.setAttribute('opacity', .35 + (Math.sin(t * 2) + 1) * .18);
    if (running) bars.forEach((bar, index) => { bar.style.height = `${7 + (Math.sin(t * 4 + index * 1.1) + 1) * 4}px`; });
  }

  function animate(timestamp) {
    const delta = previousTime === null ? 0 : Math.min((timestamp - previousTime) / 1000, .05);
    previousTime = timestamp;
    if (running && !document.hidden) { time += delta * speed; draw(time); }
    window.requestAnimationFrame(animate);
  }
  document.addEventListener('visibilitychange', () => { previousTime = null; });
  updatePlayback();
  draw(0);
  window.requestAnimationFrame(animate);
})();
