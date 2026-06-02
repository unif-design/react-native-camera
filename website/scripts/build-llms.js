#!/usr/bin/env node
/**
 * 生成 LLM 友好的文档产物(遵循 llmstxt.org 约定,放站点根):
 *   static/llms.txt        → /llms.txt:索引(H1 + 摘要 + 按目录分节的链接列表)
 *   static/llms-full.txt   → /llms-full.txt:全站全文聚合(一次性喂大 context window)
 *   static/md/<slug>.md    → 每页纯 Markdown(llms.txt 的链接指向这些)
 *
 * MDX noise (`import ...;`, `export const ... = ...;`, `<LiveDemo>...</LiveDemo>`)
 * 被清理成纯 Markdown(LiveDemo 换成 placeholder),适合喂给 LLM。
 *
 * 【由 package.json 的 build/start 显式调用】(`node scripts/build-llms.js && docusaurus ...`)——
 * 不挂 prebuild/prestart 钩子,因为 yarn 4(berry)不触发 npm-style 生命周期钩子,会被跳过。
 */
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const docsDir = path.join(root, 'docs');
const outDir = path.join(root, 'static', 'md');

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
const SITE_NAME = readSiteTitle();

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
  const rel = path.relative(docsDir, file).replace(/\.(mdx?|md)$/, '');
  // 防御:剔除任何 `..` 路径遍历段 + 空段,把 slug 锁死在 static/md/ 内。
  // 链接(/md/<slug>.md)与写入文件名永远用这同一个 slug —— 不混入 frontmatter slug,
  // 杜绝「llms.txt 链接指向的 md 实际没被写」的不一致。
  return rel.split(path.sep).filter(seg => seg && seg !== '..').join('/');
}

/** Pull the `slug:` / `title:` values out of a frontmatter block. */
function parseFrontmatter(content) {
  if (!content.startsWith('---')) return { slug: null, title: null, body: content };
  const end = content.indexOf('\n---', 3);
  if (end === -1) return { slug: null, title: null, body: content };
  const block = content.slice(3, end);
  const body = content.slice(end + 4).replace(/^\n/, '');
  const slugM = block.match(/^\s*slug:\s*(.+)\s*$/m);
  const titleM = block.match(/^\s*title:\s*(.+)\s*$/m);
  const unq = s => s && s.trim().replace(/^['"]|['"]$/g, '');
  return { slug: unq(slugM && slugM[1]), title: unq(titleM && titleM[1]), body };
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

    // Replace `<LiveDemo>...</LiveDemo>` with a placeholder note.
    if (/^\s*<LiveDemo[\s>]/.test(line)) {
      // Find matching </LiveDemo>; demos can have nested tags so scan literally.
      let j = i;
      while (j < lines.length && !/<\/LiveDemo>/.test(lines[j])) j++;
      out.push('> 💡 此处有交互式 demo，请在网页版查看。');
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
  if (!fs.existsSync(docsDir)) {
    console.error('[build-llms] docs/ directory not found at', docsDir);
    process.exit(0);
  }

  if (fs.existsSync(outDir)) {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
  ensureDir(outDir);

  const files = walk(docsDir).sort();
  const aggregate = [];
  aggregate.push(`# ${SITE_NAME} — 全文文档聚合`);
  aggregate.push('');
  aggregate.push('> 单文件聚合版。每段都带源路径与标题，方便整体粘贴给 LLM。');
  aggregate.push('');

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
    write(path.join(outDir, `${slug}.md`), pageOutput);

    if (fmSlug && finalSlug !== slug) {
      write(path.join(outDir, `${finalSlug}.md`), pageOutput);
    }

    // Aggregate block — drop the per-page frontmatter, prefer a section heading
    // (so the bundle reads as one continuous outline rather than a string of YAML).
    aggregate.push(`## ${title || finalSlug}`);
    aggregate.push('');
    aggregate.push(`*Source: \`docs/${slug}${file.endsWith('.mdx') ? '.mdx' : '.md'}\` · Slug: \`/${finalSlug}\`*`);
    aggregate.push('');
    aggregate.push(cleanBody);
    aggregate.push('');
  }

  const staticDir = path.join(root, 'static');

  // /llms-full.txt — 全文聚合(站点根,标准命名)
  const llmsFull = aggregate.join('\n').replace(/\n{3,}/g, '\n\n');
  write(path.join(staticDir, 'llms-full.txt'), llmsFull);

  // /llms.txt — 标准索引(H1 + 摘要 + 按顶层目录分节的链接列表,站点根)。
  // 链接指向每页纯 .md(供 agent 按需抓取),全文一次性喂入走 /llms-full.txt。
  const entries = files.map(f => {
    const slug = relSlug(f);
    const { slug: fmSlug, title } = parseFrontmatter(read(f));
    const finalSlug = fmSlug ? fmSlug.replace(/^\/+/, '') : slug;
    const seg = slug.split('/');
    return {
      title: title || finalSlug,
      mdPath: `/md/${slug}.md`,
      slug: `/${finalSlug}`,
      section: seg.length > 1 ? seg[0] : '概览',
    };
  });
  const bySection = {};
  for (const e of entries) (bySection[e.section] = bySection[e.section] || []).push(e);
  const llmsLines = [
    `# ${SITE_NAME}`,
    '',
    `> ${SITE_NAME} 文档索引。每个链接是该页的纯 Markdown 版(供 LLM 抓取);需要完整全文一次性喂入时用 /llms-full.txt。`,
    '',
  ];
  for (const section of Object.keys(bySection).sort()) {
    llmsLines.push(`## ${section}`, '');
    for (const e of bySection[section]) llmsLines.push(`- [${e.title}](${e.mdPath})`);
    llmsLines.push('');
  }
  write(path.join(staticDir, 'llms.txt'), llmsLines.join('\n'));

  // index.json 留给站点自身用(/md/index.json)
  write(path.join(outDir, 'index.json'), JSON.stringify(entries, null, 2));

  console.log(
    `[build-llms] /llms.txt(索引 ${entries.length} 页) + /llms-full.txt(${(llmsFull.length / 1024).toFixed(1)} KB) + ${files.length} 页 /md/*.md`
  );
}

main();
