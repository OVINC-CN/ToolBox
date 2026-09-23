import {
  parseTree,
  format,
  applyEdits,
  createScanner,
  SyntaxKind,
} from 'jsonc-parser';
const messages = {
  1: '无法识别的内容，请检查是否使用了双引号',
  2: '数字格式无效',
  3: '这里应是双引号包裹的属性名',
  4: '这里应有一个 JSON 值',
  5: '属性名后缺少冒号 :',
  6: '相邻项目之间缺少逗号 ,',
  7: '对象缺少右大括号 }',
  8: '数组缺少右方括号 ]',
  9: 'JSON 已结束，这里出现了多余内容',
  10: '标准 JSON 不支持注释',
  11: '注释未结束，且标准 JSON 不支持注释',
  12: '字符串缺少结束双引号',
  13: '数字不完整',
  14: 'Unicode 转义应包含 4 位十六进制数字',
  15: '无效的转义字符',
  16: '字符串包含未转义的控制字符',
};
export function inspect(text) {
  const errors = [];
  const tree = parseTree(text, errors, {
    allowTrailingComma: false,
    disallowComments: true,
    allowEmptyContent: false,
  });
  return {
    tree,
    errors: errors.map(e => ({
      ...e,
      message: messages[e.error] || 'JSON 语法错误',
    })),
  };
}
export function transform(text, mode = 'format', indent = '2') {
  const result = inspect(text);
  if (result.errors.length) {
    throw result.errors[0];
  }
  if (mode === 'minify') {
    const scanner = createScanner(text, false);
    let output = '';
    let token;
    while ((token = scanner.scan()) !== SyntaxKind.EOF) {
      if (token !== SyntaxKind.Trivia && token !== SyntaxKind.LineBreakTrivia) {
        output += text.slice(
          scanner.getTokenOffset(),
          scanner.getTokenOffset() + scanner.getTokenLength(),
        );
      }
    }
    return output;
  }
  return applyEdits(
    text,
    format(text, undefined, {
      insertSpaces: indent !== 'tab',
      tabSize: indent === '4' ? 4 : 2,
      eol: '\n',
      keepLines: false,
    }),
  ).trim();
}
