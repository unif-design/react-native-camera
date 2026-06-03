#!/usr/bin/env node
/**
 * 生成 LLM 友好的文档产物(遵循 llmstxt.org 约定,放站点根):
 *   static/llms.txt        → /llms.txt:索引(H1 + 摘要 + 按目录分节的链接列表)
 *   static/llms-full.txt   → /llms-full.txt:全站全文聚合(一次性喂大 context window)
 *   static/md/<slug>.md    → 每页纯 Markdown(llms.txt 的链接指向这些)
 *
 * MDX noise (`import ...;`, `export const ... = ...;`, `<LiveDemo>...</LiveDemo>`)
 * 被清理成纯 Markdown(`<LiveDemo>...</LiveDemo>` 内层 JSX 提取为 ```tsx 源码块,组件用法,反幻觉素材),适合喂给 LLM。
 *
 * 【由 package.json 的 build/start 显式调用】(`node scripts/build-llms.js && docusaurus ...`)——
 * 不挂 prebuild/prestart 钩子,因为 yarn 4(berry)不触发 npm-style 生命周期钩子,会被跳过。
 */
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const docsDir = path.join(root, 'docs');
const staticDir = path.join(root, 'static');
// 每页 md 放 static/<MD_SUBDIR>/ —— 单一来源,写入路径(outDir)由它派生。
// llms.txt 的链接(mdPath)则从写入产物 outPath 反推(见 entries),与实际文件严格一致。
const MD_SUBDIR = 'md';
const outDir = path.join(staticDir, MD_SUBDIR);

// 站点名从 docusaurus.config 的 title 读 —— 本脚本各库共用,自动适配,不硬编码库名。
function readSiteTitle() {
  for (const ext of ['ts', 'js', 'mjs']) {
    const cfg = path.join(root, `docusaurus.config.${ext}`);
    if (fs.existsSync(cfg)) {
      const m = fs.readFileSync(cfg, 'utf8').match(/title:\s*['"]([^'"]+)['"]/);
      if (m) return m[1];
    }
  }
  return 'Documentation';
}

function walk(dir) {
  const entries = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) entries.push(...walk(full));
    else if (full.endsWith('.md') || full.endsWith('.mdx')) entries.push(full);
  }
  return entries;
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function write(file, content) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, content, 'utf8');
}

function relSlug(file) {
  // 去扩展名 + 统一成 POSIX 分隔(URL / section 用);跨平台把 Windows 反斜杠也转成 /。
  // 不在这里做安全过滤 —— 写入安全统一由 safeOutPath() 用 path.resolve + 前缀校验兜底。
  return path.relative(docsDir, file).replace(/\.(mdx?|md)$/, '').split(path.sep).join('/');
}

// 把任意 slug(含来自 frontmatter 的 slug)解析成 outDir 内的安全写入绝对路径。
// path.resolve 先吃掉 `../`、绝对路径、Windows 反斜杠等,再做严格前缀校验:
// 不落在 outDir 内的一律拒绝(返回 null),调用方跳过 —— 杜绝路径遍历写到 static/md/ 之外。
function safeOutPath(slug) {
  // 显式拒绝绝对路径 slug(slug 本应相对;绝对路径会让 path.resolve 丢掉 outDir 锚点)。
  if (path.isAbsolute(slug)) return null;
  const resolved = path.resolve(outDir, `${slug}.md`);
  const base = path.resolve(outDir) + path.sep;
  return resolved.startsWith(base) ? resolved : null;
}

/** Pull the `slug:` / `title:` values out of a frontmatter block. */
function parseFrontmatter(content) {
  if (!content.startsWith('---')) return { slug: null, title: null, description: null, body: content };
  const end = content.indexOf('\n---', 3);
  if (end === -1) return { slug: null, title: null, description: null, body: content };
  const block = content.slice(3, end);
  const body = content.slice(end + 4).replace(/^\n/, '');
  const slugM = block.match(/^\s*slug:\s*(.+)\s*$/m);
  const titleM = block.match(/^\s*title:\s*(.+)\s*$/m);
  const descM = block.match(/^\s*description:\s*(.+)\s*$/m);
  const unq = s => s && s.trim().replace(/^['"]|['"]$/g, '');
  return { slug: unq(slugM && slugM[1]), title: unq(titleM && titleM[1]), description: unq(descM && descM[1]), body };
}

/**
 * Strip MDX-specific noise from a doc body so the output is plain Markdown:
 *   - top-level `import ... from '...';` lines (single- or multi-line)
 *   - top-level `export const ... = ...;` blocks (single- or multi-line, brace-matched)
 *   - `<LiveDemo>...</LiveDemo>` blocks, replaced with a short note
 * Code fences are preserved verbatim; we never touch text inside ``` blocks.
 */
function stripMdxNoise(src) {
  const lines = src.split('\n');
  const out = [];
  let i = 0;
  let inFence = false;

  while (i < lines.length) {
    const line = lines[i];

    // Track ``` fences so we never strip from inside them.
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      out.push(line);
      i++;
      continue;
    }

    if (inFence) {
      out.push(line);
      i++;
      continue;
    }

    // Strip `import ... ;` — may span multiple lines until first `;`.
    if (/^import\b/.test(line)) {
      let chunk = line;
      while (!/;\s*$/.test(chunk) && i + 1 < lines.length) {
        i++;
        chunk = lines[i];
      }
      i++;
      continue;
    }

    // Strip `export const X = ...;` / `export const X = { ... };`
    // — brace-match until balanced and ending `;`.
    if (/^export\s+(const|let|var|function|default)\b/.test(line)) {
      let depth = 0;
      let started = false;
      let j = i;
      while (j < lines.length) {
        const l = lines[j];
        for (const ch of l) {
          if (ch === '{' || ch === '[' || ch === '(') {
            depth++;
            started = true;
          } else if (ch === '}' || ch === ']' || ch === ')') {
            depth--;
          }
        }
        if (started && depth === 0 && /[;}]\s*$/.test(l)) {
          j++;
          break;
        }
        if (!started && /;\s*$/.test(l)) {
          j++;
          break;
        }
        j++;
      }
      i = j;
      continue;
    }

    // Convert `<LiveDemo>...</LiveDemo>` into a fenced ```tsx block so the
    // component usage survives as readable source for the LLM.
    if (/^\s*<LiveDemo[\s>]/.test(line)) {
      let j = i + 1;
      const inner = [];
      while (j < lines.length && !/<\/LiveDemo>/.test(lines[j])) { inner.push(lines[j]); j++; }
      const fence = inner.some(l => /```/.test(l)) ? '````' : '```';
      out.push(fence + 'tsx');
      out.push('// web demo 源码,组件用法可参考');
      out.push(...inner);
      out.push(fence);
      i = j + 1;
      continue;
    }

    out.push(line);
    i++;
  }

  // Collapse 3+ blank lines to 2.
  return out.join('\n').replace(/\n{3,}/g, '\n\n').replace(/^\n+/, '');
}

function main() {
  const SITE_NAME = readSiteTitle();
  if (!fs.existsSync(docsDir)) {
    console.error('[build-llms] docs/ directory not found at', docsDir);
    process.exit(0);
  }

  if (fs.existsSync(outDir)) {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
  ensureDir(outDir);

  const files = walk(docsDir).sort();
  const head = [
    `# ${SITE_NAME} — 全文文档聚合`,
    '',
    '> 单文件聚合版。每段都带源路径与标题，方便整体粘贴给 LLM。',
    '',
  ];
  const bodyBlocks = [];
  const tocTitles = [];

  for (const file of files) {
    const slug = relSlug(file);
    const raw = read(file);
    const { slug: fmSlug, title, body } = parseFrontmatter(raw);
    const cleanBody = stripMdxNoise(body);
    const finalSlug = fmSlug ? fmSlug.replace(/^\/+/, '') : slug;

    // Single-page file: keep its frontmatter (title/description useful), strip MDX in body.
    const fmEnd = raw.startsWith('---') ? raw.indexOf('\n---', 3) + 4 : 0;
    const fmBlock = fmEnd ? raw.slice(0, fmEnd) + '\n' : '';
    const pageOutput = `${fmBlock}\n${cleanBody}`.replace(/\n{3,}/g, '\n\n');

    const slugPath = safeOutPath(slug);
    if (!slugPath) {
      console.warn(`[build-llms] 跳过越界 slug(疑似路径遍历):${slug}`);
      continue;
    }
    write(slugPath, pageOutput);

    // frontmatter slug 同样可能含 `../` —— 也过 safeOutPath,越界只跳过这份镜像、不影响主输出。
    if (fmSlug && finalSlug !== slug) {
      const fmPath = safeOutPath(finalSlug);
      if (fmPath) write(fmPath, pageOutput);
      else console.warn(`[build-llms] 跳过越界 frontmatter slug:${finalSlug}`);
    }

    // Aggregate block — drop the per-page frontmatter, prefer a section heading
    // (so the bundle reads as one continuous outline rather than a string of YAML).
    tocTitles.push(title || finalSlug);
    bodyBlocks.push(`## ${title || finalSlug}`);
    bodyBlocks.push('');
    bodyBlocks.push(`*Source: \`docs/${slug}${file.endsWith('.mdx') ? '.mdx' : '.md'}\` · Slug: \`/${finalSlug}\`*`);
    bodyBlocks.push('');
    bodyBlocks.push(cleanBody);
    bodyBlocks.push('');
  }

  // /llms-full.txt — 全文聚合(站点根,标准命名),顶部带目录
  const llmsFull = [...head, buildToc(tocTitles), ...bodyBlocks].join('\n').replace(/\n{3,}/g, '\n\n');
  write(path.join(staticDir, 'llms-full.txt'), llmsFull);

  // /llms.txt — 标准索引(H1 + 摘要 + 按顶层目录分节的链接列表,站点根)。
  // 链接指向每页纯 .md(供 agent 按需抓取),全文一次性喂入走 /llms-full.txt。
  const entries = files.map(f => {
    const slug = relSlug(f);
    const outPath = safeOutPath(slug);
    if (!outPath) return null; // 越界 slug 的页 md 也没写,不进索引 → 保持链接一致
    const { slug: fmSlug, title, description } = parseFrontmatter(read(f));
    const finalSlug = fmSlug ? fmSlug.replace(/^\/+/, '') : slug;
    const seg = slug.split('/');
    return {
      title: title || finalSlug,
      // mdPath 从规范化写入路径 outPath 反推,与实际 md 文件严格一致(不用可能含 ../ 的原始 slug)
      mdPath: '/' + path.relative(staticDir, outPath).split(path.sep).join('/'),
      slug: `/${finalSlug}`,
      section: seg.length > 1 ? seg[0] : '概览',
      description: description || null,
    };
  }).filter(Boolean);
  const bySection = {};
  for (const e of entries) (bySection[e.section] = bySection[e.section] || []).push(e);
  const llmsLines = [
    `# ${SITE_NAME}`,
    '',
    `> ${SITE_NAME} 文档索引。每个链接是该页的纯 Markdown 版(供 LLM 抓取);需要完整全文一次性喂入时用 /llms-full.txt。`,
    '',
  ];
  for (const section of sortSections(Object.keys(bySection))) {
    llmsLines.push(`## ${section}`, '');
    for (const e of bySection[section]) llmsLines.push(formatIndexLine(e));
    llmsLines.push('');
  }
  write(path.join(staticDir, 'llms.txt'), llmsLines.join('\n'));

  // index.json 留给站点自身用(/md/index.json)
  write(path.join(outDir, 'index.json'), JSON.stringify(entries, null, 2));

  console.log(
    `[build-llms] /llms.txt(索引 ${entries.length} 页) + /llms-full.txt(${(llmsFull.length / 1024).toFixed(1)} KB) + ${files.length} 页 /md/*.md`
  );
}

function buildToc(titles) {
  return ['## 目录', '', ...titles.map(t => `- ${t}`), ''].join('\n');
}
function formatIndexLine(e) {
  return e.description ? `- [${e.title}](${e.mdPath}) — ${e.description}` : `- [${e.title}](${e.mdPath})`;
}
function sortSections(keys) {
  return [...keys].sort((a, b) => (a === '概览' ? -1 : b === '概览' ? 1 : a.localeCompare(b)));
}

module.exports = { parseFrontmatter, stripMdxNoise, buildToc, formatIndexLine, sortSections };

if (require.main === module) main();
