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

// 仓库事实与 website CI 同属文档可信度门禁：源码演进后不能继续发布相反的
// AGENTS 说明，也不能让 website / llms.txt 变更绕过共享 CI。
const repositoryRoot = path.resolve(__dirname, '..', '..');
const agentsDoc = fs.readFileSync(
  path.join(repositoryRoot, 'AGENTS.md'),
  'utf8'
);
const staleAgentFacts = [
  '`processPhoto()` 与 `createFileRegistry()` 当前没有生产调用点',
  '取消 bridge 未由真实 Container 注册',
  '统一 reducer 与 configuration generation 是内部纯逻辑契约',
  'Container 已接线路径没有 per-session registry',
  '该 registry 当前没有 session owner 或生产调用点',
  '不要声称库已经在取消 / 删除时回收文件',
];
for (const staleFact of staleAgentFacts) {
  assert(
    !agentsDoc.includes(staleFact),
    `AGENTS.md 仍包含已失效事实:${staleFact}`
  );
}

const currentAgentFacts = [
  'Container 已注册 session controller 与 container presence bridge',
  '`useCameraSessionController` 已用 reducer 驱动',
  '`usePhotoCaptureTransaction` 已接入 `processPhoto()`',
  '每个 session 都由 `useCamera()` 创建独立 `FileRegistry`',
  '成功 `code: 200` 前只 `transfer()` 返回文件',
];
for (const currentFact of currentAgentFacts) {
  assert(
    agentsDoc.includes(currentFact),
    `AGENTS.md 缺少当前实现事实:${currentFact}`
  );
}

const ciWorkflow = fs.readFileSync(
  path.join(repositoryRoot, '.github', 'workflows', 'ci.yml'),
  'utf8'
);

function extractWorkflowJob(workflow, jobId) {
  const header = `\n  ${jobId}:\n`;
  const jobStart = workflow.indexOf(header);
  assert(jobStart >= 0, `CI 缺少 ${jobId} job`);
  const jobBodyStart = jobStart + header.length;
  const nextJobMatch = workflow
    .slice(jobBodyStart)
    .match(/\n  [a-z][a-z0-9_-]*:\n/);
  const jobEnd =
    nextJobMatch == null
      ? workflow.length
      : jobBodyStart + nextJobMatch.index;
  return workflow.slice(jobStart, jobEnd);
}

const changesJob = extractWorkflowJob(ciWorkflow, 'changes');
for (const permission of ['contents: read', 'pull-requests: read']) {
  assert(
    changesJob.includes(permission),
    `CI changes job 缺少权限:${permission}`
  );
}

assert(
  ciWorkflow.includes('website: ${{ steps.filter.outputs.website }}'),
  'CI changes job 缺少 website output'
);

const websiteFilterMatch = ciWorkflow.match(
  /\n            website:\n((?:              - .*\n)+)/
);
assert(websiteFilterMatch, 'CI changes filters 缺少 website filter');
const websiteFilter = websiteFilterMatch[1];
for (const requiredPath of [
  'AGENTS.md',
  'website/**',
  'src/**',
  'package.json',
  'yarn.lock',
  'tsconfig*.json',
  '.nvmrc',
  '.github/actions/**',
  '.github/workflows/ci.yml',
]) {
  assert(
    websiteFilter.includes(`- '${requiredPath}'`),
    `CI website filter 缺少 ${requiredPath}`
  );
}

const websiteJob = extractWorkflowJob(ciWorkflow, 'website');
const websiteCommands = [
  'node website/scripts/build-llms.test.js',
  'yarn workspace "$WEBSITE_WORKSPACE" typecheck',
  'yarn workspace "$WEBSITE_WORKSPACE" build',
];
for (const contract of [
  "if: needs.changes.outputs.website == 'true'",
  "node -p \"require('./website/package.json').name\"",
  'id: website',
  'printf \'name=%s\\n\' "$WEBSITE_WORKSPACE" >> "$GITHUB_OUTPUT"',
  'WEBSITE_WORKSPACE: ${{ steps.website.outputs.name }}',
  ...websiteCommands,
]) {
  assert(websiteJob.includes(contract), `CI website job 缺少契约:${contract}`);
}
assert.strictEqual(
  websiteJob.split(
    'WEBSITE_WORKSPACE: ${{ steps.website.outputs.name }}'
  ).length - 1,
  2,
  'CI website typecheck / build 必须分别注入 workspace env'
);
assert(
  !websiteJob.includes(
    'run: yarn workspace "${{ steps.website.outputs.name }}"'
  ),
  'CI website workspace output 不得直接插值进 run shell'
);
const websiteCommandPositions = websiteCommands.map((command) =>
  websiteJob.indexOf(command)
);
for (let index = 1; index < websiteCommandPositions.length; index += 1) {
  assert(
    websiteCommandPositions[index - 1] < websiteCommandPositions[index],
    'CI website job 必须依次运行 llms 测试、typecheck、build'
  );
}

console.log('ALL PASS');
