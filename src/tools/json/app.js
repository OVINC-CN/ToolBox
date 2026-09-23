import { EditorState } from '@codemirror/state';
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  drawSelection,
} from '@codemirror/view';
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from '@codemirror/commands';
import { json } from '@codemirror/lang-json';
import {
  foldGutter,
  foldKeymap,
  unfoldAll,
  foldEffect,
  syntaxHighlighting,
  HighlightStyle,
  bracketMatching,
} from '@codemirror/language';
import { setDiagnostics } from '@codemirror/lint';
import { tags } from '@lezer/highlight';
import { inspect, transform } from './json.js';
const $ = id => document.getElementById(id);
const sample
  = '{"project":"JSON Studio","version":"1.0.0","description":"让每一份 JSON 清晰可读","settings":{"theme":"light","indent":2,"autoValidate":true},"features":["语法高亮","层级折叠","实时校验"],"team":[{"name":"Alex","role":"Developer","active":true},{"name":"Sam","role":"Designer","active":false}],"metadata":{"createdAt":"2026-09-22","license":"MIT","homepage":null}}';
const colors = HighlightStyle.define([
  { tag: tags.propertyName, color: '#507bb5' },
  { tag: tags.string, color: '#718d49' },
  { tag: tags.number, color: '#b58350' },
  { tag: [tags.bool, tags.null], color: '#a076b5' },
  { tag: tags.punctuation, color: '#778493' },
]);
let noticeTimer,
  activeSource = 'input',
  contentSource = 'input',
  autoTimer,
  programmatic = 0;
const issues = {};
function toast(message) {
  $('toast').textContent = message;
  $('toast').classList.add('show');
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => $('toast').classList.remove('show'), 2400);
}
function replace(view, text) {
  if (view.state.doc.toString() === text) {
    return;
  }
  programmatic++;
  try {
    unfoldAll(view);
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: text },
      selection: { anchor: 0 },
    });
  }
  finally {
    programmatic--;
  }
}
function resultState(staleSide = null) {
  document.querySelector('#output-pane .badge').textContent
    = staleSide === 'output' ? '上次有效结果' : '可编辑';
  document.querySelector('#input-pane .badge').textContent
    = staleSide === 'input' ? '上次有效数据' : '输入';
}
function syncEditors(formatOutput = false) {
  clearTimeout(autoTimer);
  const view = contentSource === 'input' ? input : output,
    text = view.state.doc.toString();
  if (!text.trim()) {
    replace(input, '');
    replace(output, '');
    resultState();
    return;
  }
  try {
    if (contentSource === 'output') {
      replace(input, transform(text, 'minify'));
    }
    if (contentSource === 'input' || formatOutput) {
      const result = transform(text, 'format', $('indent').value);
      if (output.state.doc.toString() !== result) {
        replace(output, result);
        $('fold').value = '';
      }
    }
    resultState();
  }
  catch {
    resultState(contentSource === 'input' ? 'output' : 'input');
  }
}
function autoFormat() {
  syncEditors(true);
}
function onEdit(view, id, userEdit) {
  if (userEdit) {
    contentSource = id;
    activeSource = id;
    clearTimeout(autoTimer);
    autoTimer = setTimeout(() => syncEditors(), 120);
  }
  queueMicrotask(() => {
    validate(view, id);
    if (
      contentSource === id
      && view.state.doc.toString().trim()
      && issues[id]
    ) {
      resultState(id === 'input' ? 'output' : 'input');
    }
  });
}
function cursor(view, id) {
  const pos = view.state.selection.main.head,
    line = view.state.doc.lineAt(pos);
  $(id + '-cursor').textContent
    = `行 ${line.number}，列 ${pos - line.from + 1}`;
}
function validate(view, id) {
  const text = view.state.doc.toString(),
    result = inspect(text),
    first = result.errors[0];
  issues[id] = first;
  const status = $(id + '-status');
  status.className = 'validation';
  if (!text.trim()) {
    status.classList.add('empty');
    status.textContent = '等待输入 JSON';
    view.dispatch(setDiagnostics(view.state, []));
  }
  else if (first) {
    const pos = Math.min(first.offset, text.length),
      line = view.state.doc.lineAt(pos);
    status.classList.add('error');
    status.textContent = `⚠ 第 ${line.number} 行，第 ${pos - line.from + 1} 列：${first.message} · 点击定位`;
    view.dispatch(
      setDiagnostics(view.state, [
        {
          from: pos,
          to: Math.min(text.length, pos + Math.max(first.length, 1)),
          severity: 'error',
          message: first.message,
        },
      ]),
    );
  }
  else {
    status.textContent = '✓ JSON 格式有效';
    view.dispatch(setDiagnostics(view.state, []));
  }
  const bytes = new TextEncoder().encode(text).length;
  $(id + '-count').textContent
    = `${view.state.doc.lines} 行 · ${text.length.toLocaleString()} 字符 · ${bytes < 1024 ? bytes + ' B' : (bytes / 1024).toFixed(2) + ' KB'}`;
  cursor(view, id);
}
function jump(view, id) {
  const e = issues[id];
  if (!e) {
    return;
  }
  unfoldAll(view);
  const pos = Math.min(e.offset, view.state.doc.length);
  view.dispatch({
    selection: { anchor: pos },
    effects: EditorView.scrollIntoView(pos, { y: 'center' }),
  });
  view.focus();
}
function makeEditor(id, doc) {
  return new EditorView({
    parent: $(id),
    state: EditorState.create({
      doc,
      extensions: [
        lineNumbers(),
        foldGutter(),
        json(),
        history(),
        drawSelection(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        bracketMatching(),
        syntaxHighlighting(colors),
        EditorView.contentAttributes.of({
          'aria-label':
            id === 'input' ? '原始 JSON 编辑器' : '格式化结果编辑器',
          'spellcheck': 'false',
        }),
        keymap.of([
          {
            key: 'Mod-Enter',
            run: () => {
              run(id === 'output' ? 'output' : 'input', 'format');
              return true;
            },
          },
          indentWithTab,
          ...defaultKeymap,
          ...historyKeymap,
          ...foldKeymap,
        ]),
        EditorView.updateListener.of((update) => {
          if (update.focusChanged && update.view.hasFocus) {
            activeSource = id;
          }
          if (update.docChanged) {
            onEdit(update.view, id, !programmatic);
          }
          if (update.selectionSet) {
            cursor(update.view, id);
          }
        }),
      ],
    }),
  });
}
function run(source, mode) {
  clearTimeout(autoTimer);
  const view = source === 'input' ? input : output;
  const text = view.state.doc.toString();
  if (!text.trim()) {
    toast('请先输入 JSON');
    view.focus();
    return false;
  }
  try {
    const result = transform(text, mode, $('indent').value);
    replace(output, result);
    if (source === 'output') {
      replace(input, transform(result, 'minify'));
    }
    contentSource = source;
    activeSource = 'output';
    resultState();
    $('fold').value = '';
    toast(mode === 'minify' ? '已压缩为单行' : '格式化完成');
    return true;
  }
  catch {
    validate(view, source);
    jump(view, source);
    toast('请先修正标记位置的语法错误');
    return false;
  }
}
const input = makeEditor('input', sample);
const output = makeEditor('output', transform(sample));
validate(input, 'input');
validate(output, 'output');
$('indent').onchange = autoFormat;
$('format').onclick = () => run(contentSource, 'format');
$('minify').onclick = () => run(activeSource, 'minify');
$('format-output').onclick = () => run('output', 'format');
$('example').onclick = () => {
  clearTimeout(autoTimer);
  contentSource = 'input';
  activeSource = 'input';
  resultState();
  replace(input, sample);
  replace(output, transform(sample, 'format', $('indent').value));
  $('fold').value = '';
  toast('已载入示例');
};
$('clear').onclick = () => {
  clearTimeout(autoTimer);
  contentSource = 'input';
  replace(input, '');
  autoFormat();
  input.focus();
};
$('input-status').onclick = () => jump(input, 'input');
$('output-status').onclick = () => jump(output, 'output');
$('copy').onclick = async () => {
  if (!output.state.doc.length) {
    toast('暂无可复制的结果');
    return;
  }
  try {
    await navigator.clipboard.writeText(output.state.doc.toString());
    toast('已复制 JSON');
  }
  catch {
    toast('复制失败，请在结果中全选后复制');
  }
};
$('expand').onclick = () => {
  unfoldAll(output);
  $('fold').value = '';
};
$('fold').onchange = () => {
  const depth = Number($('fold').value);
  unfoldAll(output);
  if (!depth) {
    return;
  }
  const { tree, errors } = inspect(output.state.doc.toString());
  if (errors.length) {
    jump(output, 'output');
    toast('请先修正结果中的语法错误');
    return;
  }
  const effects = [];
  function visit(node, level) {
    if (!node) {
      return;
    }
    if (node.type === 'object' || node.type === 'array') {
      if (level === depth && node.length > 2) {
        effects.push(
          foldEffect.of({
            from: node.offset + 1,
            to: node.offset + node.length - 1,
          }),
        );
        return;
      }
      for (const child of node.children || []) {
        visit(child, level + 1);
      }
    }
    else if (node.type === 'property') {
      visit(node.children?.[1], level);
    }
  }
  visit(tree, 1);
  if (effects.length) {
    output.dispatch({ effects });
  }
  else {
    toast('此层没有可折叠的对象或数组');
  }
};

const context = document.modelContext;
if (context?.registerTool) {
  const lifecycle = new AbortController();
  const tools = [
    {
      name: 'transform_json',
      title: '格式化或压缩 JSON',
      description:
        '校验给定 JSON，并将原文与格式化或压缩结果显示在编辑器中。语法错误时保留现有内容。',
      inputSchema: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          mode: { type: 'string', enum: ['format', 'minify'] },
          indent: { type: 'string', enum: ['2', '4', 'tab'] },
        },
        required: ['text', 'mode'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute(args) {
        if (
          !args
          || typeof args.text !== 'string'
          || !['format', 'minify'].includes(args.mode)
          || (args.indent !== undefined
            && !['2', '4', 'tab'].includes(args.indent))
        ) {
          throw new Error('参数无效');
        }
        const value = transform(args.text, args.mode, args.indent || '2');
        clearTimeout(autoTimer);
        contentSource = 'input';
        activeSource = 'output';
        $('indent').value = args.indent || '2';
        resultState();
        replace(input, args.text);
        replace(output, value);
        validate(input, 'input');
        validate(output, 'output');
        $('fold').value = '';
        return { text: value, valid: true };
      },
    },
    {
      name: 'read_json_state',
      title: '读取当前 JSON',
      description: '读取两侧编辑器中的 JSON 内容与校验状态。',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute() {
        return {
          input: input.state.doc.toString(),
          output: output.state.doc.toString(),
          inputErrors: inspect(input.state.doc.toString()).errors,
          outputErrors: inspect(output.state.doc.toString()).errors,
        };
      },
    },
  ];
  for (const tool of tools) {
    try {
      Promise.resolve(
        context.registerTool(tool, { signal: lifecycle.signal }),
      ).catch(() => undefined);
    }
    catch {
      // 某些浏览器暂不支持注册工具，页面本身仍可正常使用。
    }
  }
  window.addEventListener('pagehide', () => lifecycle.abort(), { once: true });
}
