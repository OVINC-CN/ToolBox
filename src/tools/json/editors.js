import { Compartment, EditorState, Transaction } from '@codemirror/state';
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
import { inspect, transform, unescapeStrings } from './json.js';
const sample
  = '{"project":"JSON Studio","version":"1.0.0","description":"JSON 编辑器配置示例","settings":{"theme":"light","indent":2,"autoValidate":true},"features":["语法高亮","层级折叠","实时校验"],"team":[{"name":"Alex","role":"Developer","active":true},{"name":"Sam","role":"Designer","active":false}],"metadata":{"createdAt":"2026-09-22","license":"MIT","homepage":null}}';
const colors = HighlightStyle.define([
  { tag: tags.propertyName, color: '#507bb5' },
  { tag: tags.string, color: '#718d49' },
  { tag: tags.number, color: '#b58350' },
  { tag: [tags.bool, tags.null], color: '#a076b5' },
  { tag: tags.punctuation, color: '#778493' },
]);
export function createEditors(inputParent, outputParent, report) {
  const lifecycle = new AbortController();
  let keepEscapes = true;
  let indent = '2';
  function update(status) {
    if (!lifecycle.signal.aborted) {
      report(status);
    }
  }
  let noticeTimer,
    activeSource = 'input',
    contentSource = 'input',
    outputText = '',
    autoTimer,
    programmatic = 0;
  const outputEditing = new Compartment();
  const issues = {};

  function toast(message) {
    if (lifecycle.signal.aborted) {
      return;
    }
    update({ notice: message });
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => update({ notice: '' }), 2400);
  }
  function replace(view, text, addToHistory = true) {
    if (view.state.doc.toString() === text) {
      return;
    }
    programmatic++;
    try {
      unfoldAll(view);
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: text },
        selection: { anchor: 0 },
        annotations: Transaction.addToHistory.of(addToHistory),
      });
    }
    finally {
      programmatic--;
    }
  }
  function renderOutput(addToHistory = keepEscapes) {
    const text = keepEscapes ? outputText : unescapeStrings(outputText);
    replace(output, text, addToHistory);
  }
  function replaceOutput(text) {
    outputText = text;
    renderOutput();
  }
  function sourceText(source) {
    return source === 'output' ? outputText : input.state.doc.toString();
  }
  function resultState(staleSide = null) {
    update({
      outputBadge: staleSide === 'output' ? '上次有效结果' : keepEscapes ? '可编辑' : '阅读视图',
      inputBadge: staleSide === 'input' ? '上次有效数据' : '输入',
    });
  }
  function syncEditors(formatOutput = false) {
    clearTimeout(autoTimer);
    const text = sourceText(contentSource);
    if (!text.trim()) {
      replace(input, '');
      replaceOutput('');
      resultState();
      return;
    }
    try {
      if (contentSource === 'output') {
        replace(input, transform(text, 'minify'));
      }
      if (contentSource === 'input' || formatOutput) {
        const result = transform(text, 'format', indent);
        if (outputText !== result) {
          replaceOutput(result);
          update({ fold: '' });
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
      if (id === 'output') {
        outputText = view.state.doc.toString();
      }
      contentSource = id;
      activeSource = id;
      clearTimeout(autoTimer);
      autoTimer = setTimeout(() => syncEditors(), 120);
    }
    queueMicrotask(() => {
      if (lifecycle.signal.aborted) {
        return;
      }
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
    update({ [id + 'Cursor']: `行 ${line.number}，列 ${pos - line.from + 1}` });
  }
  function validate(view, id) {
    const text = view.state.doc.toString(),
      preview = id === 'output' && !keepEscapes,
      first = preview ? undefined : inspect(text).errors[0];
    issues[id] = first;
    let message, kind = '';
    if (!text.trim()) {
      kind = 'empty';
      message = '等待输入 JSON';
      view.dispatch(setDiagnostics(view.state, []));
    }
    else if (preview) {
      kind = 'preview';
      message = '阅读视图 · 转义已展开，结果可能不是有效 JSON';
      view.dispatch(setDiagnostics(view.state, []));
    }
    else if (first) {
      const pos = Math.min(first.offset, text.length),
        line = view.state.doc.lineAt(pos);
      kind = 'error';
      message = `⚠ 第 ${line.number} 行，第 ${pos - line.from + 1} 列：${first.message} · 点击定位`;
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
      message = '✓ JSON 格式有效';
      view.dispatch(setDiagnostics(view.state, []));
    }
    const bytes = new TextEncoder().encode(text).length;
    update({ [id + 'Count']: `${view.state.doc.lines} 行 · ${text.length.toLocaleString()} 字符 · ${bytes < 1024 ? bytes + ' B' : (bytes / 1024).toFixed(2) + ' KB'}`, [id + 'Status']: message, [id + 'Kind']: kind });
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
      parent: id === 'input' ? inputParent : outputParent,
      state: EditorState.create({
        doc,
        extensions: [
          lineNumbers(),
          foldGutter(),
          json(),
          id === 'output' ? outputEditing.of([]) : [],
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
    const text = sourceText(source);
    if (!text.trim()) {
      toast('请先输入 JSON');
      view.focus();
      return false;
    }
    try {
      const result = transform(text, mode, indent);
      replaceOutput(result);
      if (source === 'output') {
        replace(input, transform(result, 'minify'));
      }
      contentSource = source;
      activeSource = 'output';
      resultState();
      update({ fold: '' });
      toast(mode === 'minify' ? keepEscapes ? '已压缩为单行' : '已压缩并展开转义' : '格式化完成');
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
  outputText = output.state.doc.toString();
  validate(input, 'input');
  validate(output, 'output');
  function setIndent(value) {
    indent = value;
    update({ indent });
    autoFormat();
  }
  function setPreserveEscapes(value) {
    if (!value && outputText.trim() && inspect(outputText).errors.length) {
      jump(output, 'output');
      toast('请先修正结果中的语法错误');
      return;
    }
    keepEscapes = value;
    update({ keepEscapes });
    output.dispatch({
      effects: outputEditing.reconfigure(keepEscapes
        ? []
        : [EditorState.readOnly.of(true), EditorView.editable.of(false)]),
    });
    unfoldAll(output);
    update({ fold: '' });
    // 阅读视图不应作为编辑内容进入撤销历史。
    renderOutput(false);
    autoFormat();
    validate(output, 'output');
  }
  function loadExample() {
    clearTimeout(autoTimer);
    contentSource = 'input';
    activeSource = 'input';
    resultState();
    replace(input, sample);
    replaceOutput(transform(sample, 'format', indent));
    update({ fold: '' });
    toast('已载入示例');
  }
  function clear() {
    clearTimeout(autoTimer);
    contentSource = 'input';
    replace(input, '');
    autoFormat();
    input.focus();
  }
  async function copy() {
    if (!output.state.doc.length) {
      toast('暂无可复制的结果');
      return;
    }
    try {
      await navigator.clipboard.writeText(output.state.doc.toString());
      toast(keepEscapes ? '已复制 JSON' : '已复制结果');
    }
    catch {
      toast('复制失败，请在结果中全选后复制');
    }
  }
  function expand() {
    unfoldAll(output);
    update({ fold: '' });
  }
  function fold(value) {
    update({ fold: value });
    const depth = Number(value);
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
  }

  const context = document.modelContext;
  if (context?.registerTool) {
    const tools = [
      {
        name: 'transform_json',
        title: '格式化或压缩 JSON',
        description:
          '校验给定 JSON，并将原文与格式化或压缩结果显示在编辑器中。关闭保留转义时，结果以阅读视图显示。语法错误时保留现有内容。',
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
          indent = args.indent || '2';
          update({ indent });
          resultState();
          replace(input, args.text);
          replaceOutput(value);
          validate(input, 'input');
          validate(output, 'output');
          update({ fold: '' });
          const text = output.state.doc.toString();
          return { text, valid: inspect(text).errors.length === 0 };
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
            preserveEscapes: keepEscapes,
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
  }
  return {
    format: () => run(contentSource, 'format'),
    minify: () => run(activeSource, 'minify'),
    formatOutput: () => run('output', 'format'),
    jumpInput: () => jump(input, 'input'),
    jumpOutput: () => jump(output, 'output'),
    setIndent, setPreserveEscapes, loadExample, clear, copy, expand, fold,
    destroy() {
      lifecycle.abort();
      clearTimeout(noticeTimer);
      clearTimeout(autoTimer);
      input.destroy();
      output.destroy();
    },
  };
}
