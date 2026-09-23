(() => {
  'use strict';
  const scene = document.getElementById('ride-scene');
  const button = document.getElementById('motion-toggle');
  if (!scene || !button) return;
  const icon = button.querySelector('.toggle-icon');
  const label = button.querySelector('.toggle-label');
  let paused = false;

  function setPaused(next) {
    paused = next;
    scene.classList.toggle('is-paused', paused);
    button.setAttribute('aria-pressed', String(paused));
    icon.textContent = paused ? '▶' : 'Ⅱ';
    label.textContent = paused ? '继续动画' : '暂停动画';
    if (paused && typeof scene.pauseAnimations === 'function') scene.pauseAnimations();
    if (!paused && typeof scene.unpauseAnimations === 'function') scene.unpauseAnimations();
  }

  button.addEventListener('click', () => setPaused(!paused));
  document.addEventListener('keydown', (event) => {
    if (event.code === 'Space' && !/^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(document.activeElement.tagName)) {
      event.preventDefault();
      setPaused(!paused);
    }
  });
})();
