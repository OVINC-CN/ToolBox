import {
  VERSIONS,
  generateUuids,
  inspectUuid,
  validateRequest,
} from './core.js';
import { registerGenerationTool } from './webmcp.js';

const $ = id => document.getElementById(id);
const state = { version: 4, uuids: [], selected: 0, inspection: null };
const copyIcon
  = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/></svg>';
let toastTimer;

function element(tag, className, text) {
  const el = document.createElement(tag);
  if (className) {
    el.className = className;
  }
  if (text !== undefined) {
    el.textContent = text;
  }
  return el;
}

function showError(message = '') {
  $('form-error').textContent = message;
  $('form-error').hidden = !message;
  $('count').setAttribute(
    'aria-invalid',
    message.includes('数量') ? 'true' : 'false',
  );
}

function toast(message) {
  clearTimeout(toastTimer);
  $('toast').textContent = message;
  $('toast').classList.add('visible');
  toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 2600);
}

async function copy(text, label) {
  if (!text) {
    return;
  }
  try {
    if (!navigator.clipboard?.writeText) {
      throw new Error('Unavailable');
    }
    await navigator.clipboard.writeText(text);
    toast(label);
  }
  catch {
    toast('无法访问剪贴板，请选中 UUID 后手动复制。');
  }
}

function highlightField(id) {
  document
    .querySelectorAll('.uuid-char')
    .forEach(el =>
      el.classList.toggle(
        'is-dimmed',
        Boolean(id) && !el.dataset.fields.split(' ').includes(id),
      ),
    );
}

function describeField(part) {
  const target = $('field-detail');
  target.replaceChildren();
  target.style.setProperty('--tone', `var(--${part.tone})`);
  target.append(
    element('strong', '', part.name),
    element('span', '', part.description),
  );
  const val
    = part.id === 'variant'
      ? '二进制 10 · 2 位'
      : `本段 ${part.width} 位 · 0x${part.hex}`;
  target.append(element('code', '', val));
}

function shortExplanation(part) {
  if (part.tone === 'random') {
    return '安全随机数';
  }
  if (part.id === 'version') {
    return `固定为 ${state.version}`;
  }
  if (part.id === 'variant') {
    return '固定为 10₂';
  }
  if (part.id === 'node') {
    return '本站随机生成';
  }
  if (part.id === 'clock') {
    return '辅助避免重复';
  }
  if (part.tone === 'sequence') {
    return '同毫秒内递增';
  }
  return state.version === 7 ? '毫秒时间的一部分' : '时间计数的一部分';
}

function renderDiagram() {
  const uuid = state.uuids[state.selected];
  const visual = $('uuid-visual');
  visual.replaceChildren();
  visual.parentElement.scrollLeft = 0;
  $('version-badge').textContent = `VERSION ${state.version}`;
  $('version-hint').textContent = VERSIONS[state.version].hint;
  $('decoded-facts').replaceChildren();
  $('field-detail').replaceChildren();
  $('copy-current').disabled = !uuid;
  if (!uuid) {
    visual.append(
      element('p', 'empty-state', '设置生成数量后，生成一个 UUID 来查看字段。'),
    );
    return;
  }
  const info = inspectUuid(uuid);
  state.inspection = info;
  visual.setAttribute('aria-label', `当前 UUID：${uuid}。下方为各字段说明。`);
  info.groups.forEach((group, groupIndex) => {
    if (groupIndex) {
      visual.append(element('span', 'uuid-separator', '-'));
    }
    const chunk = element('div', 'uuid-chunk');
    chunk.style.setProperty('--chars', group.text.length);
    const code = element('code', 'uuid-code');
    code.setAttribute('aria-hidden', 'true');
    [...group.text].forEach((character, i) => {
      const start = group.start + i * 4;
      const parts = group.parts.filter(
        f => f.start < start + 4 && f.start + f.width > start,
      );
      const span = element('span', 'uuid-char', character);
      span.dataset.fields = parts.map(p => p.id).join(' ');
      if (parts.length === 1) {
        span.style.setProperty('--tone', `var(--${parts[0].tone})`);
      }
      else {
        const at = ((parts[0].start + parts[0].width - start) / 4) * 100;
        span.classList.add('mixed');
        span.style.setProperty(
          '--mix',
          `linear-gradient(to right,var(--${parts[0].tone}) 0 ${at}%,var(--${parts[1].tone}) ${at}% 100%)`,
        );
      }
      code.append(span);
    });
    const rails = element('div', 'chunk-rails');
    rails.setAttribute('aria-hidden', 'true');
    const labels = element('div', 'chunk-labels');
    group.parts.forEach((part, partIndex) => {
      const lane
        = groupIndex === 0
          ? 0
          : groupIndex === 1
            ? 1
            : groupIndex === 2
              ? partIndex === 0
                ? 2
                : 0
              : groupIndex === 3
                ? partIndex === 0
                  ? 3
                  : 1
                : group.parts.length > 1 && partIndex === 0
                  ? 2
                  : 0;
      const rail = element('div', 'field-rail');
      rail.style.setProperty('--width', part.width);
      rail.style.setProperty('--lane', lane);
      rail.style.setProperty('--tone', `var(--${part.tone})`);
      rail.dataset.start = part.start;
      rail.dataset.width = part.width;
      rail.append(element('span', 'field-stem'));
      rails.append(rail);
      const button = element('button', 'field-label');
      button.type = 'button';
      button.style.setProperty('--tone', `var(--${part.tone})`);
      button.style.setProperty('--lane', lane);
      button.style.setProperty(
        '--center',
        `${((part.start - group.start + part.width / 2) / group.width) * 100}%`,
      );
      button.append(
        element('strong', '', part.name),
        element('span', 'field-short', shortExplanation(part)),
        element('small', '', `${part.width} bit`),
      );
      button.setAttribute(
        'aria-label',
        `${part.name}，${part.width} 位。${part.description}`,
      );
      button.addEventListener('click', () => {
        describeField(part);
        highlightField(part.id);
      });
      button.addEventListener('focus', () => {
        describeField(part);
        highlightField(part.id);
      });
      button.addEventListener('pointerenter', () => {
        describeField(part);
        highlightField(part.id);
      });
      button.addEventListener('pointerleave', () => highlightField(null));
      button.addEventListener('blur', () => highlightField(null));
      labels.append(button);
    });
    chunk.append(code, rails, labels);
    visual.append(chunk);
  });
  $('field-detail').append(
    element('span', 'detail-intro', '点击上方字段名称，查看它的含义和实际值。'),
  );
  function fact(label, value) {
    const f = element('span', 'fact');
    f.append(element('span', 'fact-label', label), element('code', '', value));
    $('decoded-facts').append(f);
  }
  if (info.timestamp) {
    const date = new Date(info.timestamp.milliseconds);
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    fact(
      '记录时间',
      new Intl.DateTimeFormat('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        fractionalSecondDigits: 3,
        hourCycle: 'h23',
      }).format(date) + ` (${zone})`,
    );
    fact('UTC', info.timestamp.iso);
  }
  if (info.node) {
    fact('随机节点', info.node);
  }
  if (info.sequence !== null) {
    fact('当前序列', String(info.sequence));
  }
}

function renderList() {
  const fragment = document.createDocumentFragment();
  state.uuids.forEach((uuid, i) => {
    const row = element(
      'div',
      'result-row' + (i === state.selected ? ' selected' : ''),
    );
    const select = element('button', 'result-select');
    select.type = 'button';
    select.dataset.select = i;
    select.setAttribute('aria-pressed', String(i === state.selected));
    select.setAttribute('aria-label', `查看第 ${i + 1} 个 UUID：${uuid}`);
    select.append(
      element('span', 'row-number', String(i + 1).padStart(2, '0')),
      element('code', '', uuid),
    );
    const button = element('button', 'row-copy');
    button.type = 'button';
    button.dataset.copy = i;
    button.innerHTML = copyIcon;
    button.setAttribute('aria-label', `复制第 ${i + 1} 个 UUID`);
    button.title = '复制';
    row.append(select, button);
    fragment.append(row);
  });
  if (!state.uuids.length) {
    fragment.append(element('div', 'empty-state', '生成结果会显示在这里。'));
  }
  $('results').replaceChildren(fragment);
  $('result-count').textContent = `${state.uuids.length} 个`;
  $('copy-all').disabled = !state.uuids.length;
}

function setVersion(version) {
  state.version = version;
  document.querySelectorAll('input[name="version"]').forEach((input) => {
    input.checked = Number(input.value) === version;
  });
  $('version-brief').textContent = VERSIONS[version].brief;
}

function generate(input) {
  const request = validateRequest(input);
  const uuids = generateUuids(request);
  setVersion(request.version);
  $('count').value = request.count;
  state.uuids = uuids;
  state.selected = 0;
  showError();
  renderDiagram();
  renderList();
  return {
    version: state.version,
    count: uuids.length,
    uuids,
    selected: state.inspection,
  };
}

$('generator-form').addEventListener('submit', (event) => {
  event.preventDefault();
  try {
    generate({ version: state.version, count: Number($('count').value) });
  }
  catch (error) {
    showError(error.message);
  }
});
document.querySelectorAll('input[name="version"]').forEach(input =>
  input.addEventListener('change', () => {
    setVersion(Number(input.value));
    try {
      generate({ version: state.version, count: Number($('count').value) });
    }
    catch (error) {
      state.uuids = [];
      state.inspection = null;
      renderDiagram();
      renderList();
      showError(error.message);
    }
  }),
);
$('results').addEventListener('click', (event) => {
  const copyButton = event.target.closest('[data-copy]');
  if (copyButton) {
    void copy(state.uuids[Number(copyButton.dataset.copy)], '已复制 UUID');
    return;
  }
  const select = event.target.closest('[data-select]');
  if (!select) {
    return;
  }
  const old = $('results').querySelector('.selected');
  old?.classList.remove('selected');
  old?.querySelector('.result-select').setAttribute('aria-pressed', 'false');
  state.selected = Number(select.dataset.select);
  select.closest('.result-row').classList.add('selected');
  select.setAttribute('aria-pressed', 'true');
  renderDiagram();
});
$('copy-current').addEventListener('click', () =>
  copy(state.uuids[state.selected], '已复制当前 UUID'),
);
$('copy-all').addEventListener('click', () =>
  copy(state.uuids.join('\n'), `已复制 ${state.uuids.length} 个 UUID`),
);

try {
  generate({ version: 4, count: 1 });
}
catch (error) {
  renderDiagram();
  renderList();
  showError(error.message);
}

const unregister = registerGenerationTool(document, generate);
window.addEventListener(
  'pagehide',
  (event) => {
    if (!event.persisted) {
      unregister();
    }
  },
  { once: true },
);

export { generate };
