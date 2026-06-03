'use strict';
const assert = require('node:assert');
const b = require('./build-llms.js');

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
  '- [Button 按钮](/md/components/button.md) — 主/次', 'formatIndexLine 带描述');
assert.strictEqual(
  b.formatIndexLine({ title: 'X', mdPath: '/md/x.md', description: null }),
  '- [X](/md/x.md)', 'formatIndexLine 无描述不加破折号');

// 4) 概览 first
assert.deepStrictEqual(b.sortSections(['components', '概览', 'design']), ['概览', 'components', 'design'], '概览置顶');

// 5) TOC
assert(b.buildToc(['A', 'B']).startsWith('## 目录'), 'buildToc 头部');
assert(b.buildToc(['A', 'B']).includes('- A'), 'buildToc 列条目');

console.log('ALL PASS');
