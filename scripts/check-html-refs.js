#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const INDEX_HTML = path.join(PROJECT_ROOT, 'index.html');

function parseScriptRefs(html) {
  const refs = [];
  const scriptRegex = /<script\s+src=["']([^"']+)["']\s*>/gi;
  let match;
  while ((match = scriptRegex.exec(html)) !== null) {
    refs.push({ type: 'script', src: match[1], line: lineOf(html, match.index) });
  }
  return refs;
}

function parseLinkRefs(html) {
  const refs = [];
  const linkRegex = /<link\s+[^>]*href=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    refs.push({ type: 'css', src: match[1], line: lineOf(html, match.index) });
  }
  return refs;
}

function lineOf(html, index) {
  return html.substring(0, index).split('\n').length;
}

function resolveAbsolutePath(src) {
  if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('//')) {
    return { remote: true, path: src };
  }
  return { remote: false, path: path.join(PROJECT_ROOT, src) };
}

function main() {
  console.log('🔍 检查 index.html 中引用的文件是否存在...\n');

  if (!fs.existsSync(INDEX_HTML)) {
    console.error('❌ 未找到 index.html');
    process.exit(1);
  }

  const html = fs.readFileSync(INDEX_HTML, 'utf-8');
  const scriptRefs = parseScriptRefs(html);
  const linkRefs = parseLinkRefs(html);
  const allRefs = [...scriptRefs, ...linkRefs];

  let errors = [];
  let checked = 0;
  let remotes = 0;

  for (const ref of allRefs) {
    const resolved = resolveAbsolutePath(ref.src);
    const label = `[${ref.type === 'script' ? 'JS' : 'CSS'}] L${ref.line}`;

    if (resolved.remote) {
      console.log(`  ⏭  ${label} ${ref.src} (远程引用，跳过)`);
      remotes++;
      continue;
    }

    checked++;
    if (fs.existsSync(resolved.path)) {
      console.log(`  ✅ ${label} ${ref.src}`);
    } else {
      errors.push({ ref, resolved });
      console.log(`  ❌ ${label} ${ref.src} -> 缺失!`);
    }
  }

  console.log(`\n📊 检查结果：本地 ${checked} 个，远程 ${remotes} 个，缺失 ${errors.length} 个`);

  if (errors.length > 0) {
    console.log('\n⚠️  缺失文件清单：');
    for (const { ref, resolved } of errors) {
      console.log(`  - L${ref.line} ${ref.src} (期望位置: ${resolved.path})`);
    }
    process.exit(1);
  }

  console.log('\n🎉 所有本地引用文件均存在！');
  process.exit(0);
}

main();
