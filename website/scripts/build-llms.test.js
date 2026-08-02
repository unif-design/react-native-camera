'use strict';
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const b = require('./build-llms.js');

const customPhotoFileFields = [
  'id',
  'cameraType',
  'cameraMode',
  'path',
  'uri',
  'width',
  'height',
  'mime',
  'mode',
  'isRemake',
];

function findTypeScriptSnippet(markdown, predicate) {
  const snippets = [...markdown.matchAll(/```ts\n([\s\S]*?)```/g)].map(
    (match) => match[1]
  );
  return snippets.find(predicate);
}

function assertMockSuccessSnippet(snippet) {
  assert.match(
    snippet,
    /renderHook\(\(\)\s*=>\s*useCamera\(\)\)/,
    'mock 示例必须在 renderHook 内调用 useCamera'
  );
  assert.match(
    snippet,
    /const \[api\] = result\.current/,
    'mock 示例必须从 renderHook result.current 取得 api'
  );
  for (const field of customPhotoFileFields) {
    assert.match(
      snippet,
      new RegExp(`\\b${field}\\s*:`),
      `mock 成功 fixture 缺少 CustomPhotoFile.${field}`
    );
  }
}

// 1) frontmatter description
const pf = b.parseFrontmatter('---\ntitle: T\ndescription: D 描述\n---\nbody');
assert.strictEqual(pf.description, 'D 描述', 'parseFrontmatter 解析 description');

// 2) LiveDemo → ```tsx code block, keeps usage, no placeholder
const s = b.stripMdxNoise('## 预览\n<LiveDemo>\n  <Button variant="primary" />\n</LiveDemo>\n');
assert(s.includes('```tsx'), 'LiveDemo 转 tsx 代码块');
assert(s.includes('<Button variant="primary" />'), '保留组件用法');
assert(!s.includes('网页版查看'), '不再是 placeholder');

// 3) index line with description
assert.strictEqual(
  b.formatIndexLine({ title: 'Button 按钮', mdPath: '/md/components/button.md', description: '主/次' }),
  '- [Button 按钮](md/components/button.md) — 主/次', 'formatIndexLine 带描述');
assert.strictEqual(
  b.formatIndexLine({ title: 'X', mdPath: '/md/x.md', description: null }),
  '- [X](md/x.md)', 'formatIndexLine 无描述不加破折号');

// 4) 概览 first
assert.deepStrictEqual(b.sortSections(['components', '概览', 'design']), ['概览', 'components', 'design'], '概览置顶');

// 5) TOC
assert(b.buildToc(['A', 'B']).startsWith('## 目录'), 'buildToc 头部');
assert(b.buildToc(['A', 'B']).includes('- A'), 'buildToc 列条目');

// 必须断言 builder 的真实产物，避免只测 helper 而索引仍输出站点绝对 /md/ 链接。
execFileSync(process.execPath, [path.join(__dirname, 'build-llms.js')], { stdio: 'inherit' });
const generatedIndex = fs.readFileSync(
  path.join(__dirname, '..', 'static', 'llms.txt'),
  'utf8'
);
assert(!generatedIndex.includes('](/md/'), 'llms 索引使用相对 md/... 链接');
assert(generatedIndex.includes('(llms-full.txt)'), 'llms 索引提供相对全文入口');

// testing.md 的示例是消费者可复制的 Jest 契约：只检查 fenced TypeScript 中的公开
// Hook/文件 shape，不锁定段落文案或完整代码排版。
const testingDoc = fs.readFileSync(
  path.join(__dirname, '..', 'docs', 'testing.md'),
  'utf8'
);
const overrideSnippet = findTypeScriptSnippet(
  testingDoc,
  (snippet) =>
    snippet.includes('mockResolvedValueOnce') &&
    snippet.includes("id: '1700000000000-0'")
);
assert(overrideSnippet, 'testing.md 必须有覆盖单次成功返回的 TypeScript 示例');
assertMockSuccessSnippet(overrideSnippet);

const missingFieldSnippet = overrideSnippet.replace(/\s*isRemake:\s*false,?/, '');
assert.throws(
  () => assertMockSuccessSnippet(missingFieldSnippet),
  /CustomPhotoFile\.isRemake/,
  '文档门禁必须拒绝缺少公开文件字段的成功 fixture'
);

console.log('ALL PASS');
