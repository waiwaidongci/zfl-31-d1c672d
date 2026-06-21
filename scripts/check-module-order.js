#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const INDEX_HTML = path.join(PROJECT_ROOT, 'index.html');
const JS_DIR = path.join(PROJECT_ROOT, 'js');

const KNOWN_WEB_GLOBALS = new Set([
  'document', 'window', 'navigator', 'localStorage', 'sessionStorage',
  'FileReader', 'Blob', 'File', 'FormData', 'JSON', 'Math', 'Date',
  'Promise', 'Object', 'Array', 'String', 'Number', 'Boolean', 'Map',
  'Set', 'console', 'location', 'history', 'setTimeout', 'setInterval',
  'clearTimeout', 'clearInterval', 'parseInt', 'parseFloat', 'isNaN',
  'Error', 'Event', 'CustomEvent', 'DOMParser', 'XMLSerializer',
  'undefined', 'null', 'true', 'false', 'this', 'typeof', 'instanceof',
  'ArrayBuffer', 'Uint8Array', 'atob', 'btoa', 'URL', 'URLSearchParams',
  'RegExp', 'Symbol', 'BigInt', 'Infinity', 'NaN',
  'event', 'e', 'evt', 'err', 'error', 'cb', 'fn', 'i', 'j', 'k', 'x', 'y',
  'v', 't', 's', 'n', 'a', 'b', 'c', 'd', 'id', 'idx', 'len', 'el', 'key',
  'val', 'ret', 'res', 'data', 'cfg', 'opt', 'args', 'arg', 'list', 'map',
  'obj', 'arr', 'tmp', 'old', 'new', 'min', 'max', 'sum', 'avg', 'count',
  'index', 'keys', 'values', 'entries', 'self', 'root', 'proto', 'name',
  'code', 'msg', 'raw', 'uid', 'col', 'row', 'col', 'start', 'end',
  'cell', 'cells', 'cols', 'rows', 'size', 'width', 'height', 'left',
  'right', 'top', 'bottom', 'first', 'last', 'mode', 'type', 'base',
  'sort', 'find', 'filter', 'reduce', 'map', 'forEach', 'length',
  'push', 'pop', 'shift', 'unshift', 'slice', 'splice', 'concat',
  'split', 'join', 'trim', 'toLowerCase', 'toUpperCase', 'includes',
  'startsWith', 'endsWith', 'charAt', 'charCodeAt', 'substring',
  'indexOf', 'lastIndexOf', 'search', 'match', 'replace', 'test',
  'exec', 'from', 'of', 'assign', 'keys', 'values', 'entries',
  'isArray', 'freeze', 'seal', 'preventExtensions',
  'prototype', 'constructor', 'toString', 'valueOf', 'toFixed',
  'toJSON', 'parse', 'stringify', 'abs', 'ceil', 'floor', 'round',
  'random', 'pow', 'sqrt', 'max', 'min', 'PI', 'E', 'LN2', 'LN10',
  'now', 'UTC', 'parse', 'stringify', 'log', 'warn', 'error', 'info',
  'debug', 'dir', 'table', 'trace', 'group', 'groupEnd', 'time',
  'timeEnd', 'assert', 'clear', 'count', 'countReset',
  'preventDefault', 'stopPropagation', 'stopImmediatePropagation',
  'target', 'currentTarget', 'bubbles', 'cancelable', 'defaultPrevented',
  'timeStamp', 'composedPath', 'initEvent', 'detail',
  'getElementById', 'querySelector', 'querySelectorAll',
  'getElementsByClassName', 'getElementsByTagName', 'getElementsByName',
  'createElement', 'createTextNode', 'createDocumentFragment',
  'appendChild', 'removeChild', 'replaceChild', 'insertBefore',
  'remove', 'classList', 'addEventListener', 'removeEventListener',
  'dispatchEvent', 'innerHTML', 'outerHTML', 'textContent', 'innerText',
  'style', 'dataset', 'getAttribute', 'setAttribute', 'removeAttribute',
  'hasAttribute', 'parentNode', 'parentElement', 'children', 'childNodes',
  'firstChild', 'lastChild', 'nextSibling', 'previousSibling',
  'nextElementSibling', 'previousElementSibling',
  'offsetWidth', 'offsetHeight', 'offsetLeft', 'offsetTop',
  'clientWidth', 'clientHeight', 'clientLeft', 'clientTop',
  'scrollWidth', 'scrollHeight', 'scrollLeft', 'scrollTop',
  'getBoundingClientRect', 'getClientRects',
  'scroll', 'scrollTo', 'scrollBy', 'scrollIntoView',
  'focus', 'blur', 'click', 'submit', 'reset',
  'value', 'checked', 'disabled', 'selected', 'readonly',
  'placeholder', 'maxlength', 'minlength', 'pattern', 'required',
  'files', 'accept', 'multiple', 'type', 'src', 'href', 'rel',
  'action', 'method', 'enctype', 'target', 'download',
  'width', 'height', 'alt', 'title', 'id', 'className', 'class',
  'tagName', 'nodeName', 'nodeType', 'ownerDocument',
  'namespaceURI', 'prefix', 'localName', 'attributes',
  'compareDocumentPosition', 'contains', 'isSameNode', 'isEqualNode',
  'cloneNode', 'normalize', 'hasChildNodes',
  'defaultView', 'documentElement', 'body', 'head', 'forms',
  'images', 'links', 'scripts', 'styleSheets',
  'fullscreenElement', 'fullscreenEnabled',
  'exitFullscreen', 'requestFullscreen',
  'getSelection', 'execCommand', 'open', 'close', 'write', 'writeln',
  'readyState', 'compatMode', 'designMode', 'hidden', 'visibilityState',
  'hasFocus', 'activeElement', 'cookie', 'domain', 'URL', 'documentURI',
  'characterSet', 'contentType', 'doctype', 'implementation',
  'timers', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame',
  'queueMicrotask', 'structuredClone',
  'decodeURI', 'decodeURIComponent', 'encodeURI', 'encodeURIComponent',
  'escape', 'unescape', 'eval', 'isFinite', 'Function', 'Generator',
  'AsyncFunction', 'AsyncGenerator', 'Promise', 'Proxy', 'Reflect',
  'WeakMap', 'WeakSet', 'WeakRef', 'FinalizationRegistry',
  'Intl', 'Collator', 'DateTimeFormat', 'NumberFormat',
  'TextEncoder', 'TextDecoder', 'TextEncoderStream', 'TextDecoderStream',
  'SharedArrayBuffer', 'Atomics', 'DataView',
  'Int8Array', 'Uint8ClampedArray', 'Int16Array', 'Uint16Array',
  'Int32Array', 'Uint32Array', 'Float32Array', 'Float64Array',
  'BigInt64Array', 'BigUint64Array',
  'AbortController', 'AbortSignal', 'Blob', 'BroadcastChannel',
  'ByteLengthQueuingStrategy', 'CompressionStream',
  'CountQueuingStrategy', 'Crypto', 'CryptoKey', 'CustomEvent',
  'DecompressionStream', 'DOMException', 'DOMMatrix', 'DOMMatrixReadOnly',
  'DOMPoint', 'DOMPointReadOnly', 'DOMQuad', 'DOMRect', 'DOMRectReadOnly',
  'DOMStringList', 'DOMStringMap', 'DOMTokenList', 'ErrorEvent',
  'Event', 'EventSource', 'EventTarget', 'File', 'FileList', 'FileReader',
  'FormData', 'Headers', 'ImageData', 'MessageChannel', 'MessageEvent',
  'MessagePort', 'MimeType', 'MimeTypeArray', 'Navigator',
  'Plugin', 'PluginArray', 'ProgressEvent', 'PromiseRejectionEvent',
  'ReadableByteStreamController', 'ReadableStream',
  'ReadableStreamBYOBReader', 'ReadableStreamBYOBRequest',
  'ReadableStreamDefaultController', 'ReadableStreamDefaultReader',
  'Request', 'Response', 'SecurityPolicyViolationEvent', 'Storage',
  'StorageEvent', 'SubtleCrypto', 'TextDecoderStream', 'TextEncoderStream',
  'TextMetrics', 'TrackEvent', 'TransformStream',
  'TransformStreamDefaultController', 'UIEvent', 'URL', 'URLSearchParams',
  'WebAssembly', 'WebSocket', 'WheelEvent', 'Window', 'Worker',
  'WritableStream', 'WritableStreamDefaultController',
  'WritableStreamDefaultWriter', 'XMLDocument', 'XMLHttpRequest',
  'XMLHttpRequestEventTarget', 'XMLHttpRequestUpload', 'XPathEvaluator',
  'XPathExpression', 'XPathResult', 'XSLTProcessor',
  'getComputedStyle', 'matchMedia', 'scrollX', 'scrollY',
  'pageXOffset', 'pageYOffset', 'screenX', 'screenY', 'screenLeft',
  'screenTop', 'devicePixelRatio', 'innerWidth', 'innerHeight',
  'outerWidth', 'outerHeight', 'screen', 'frames', 'parent', 'opener',
  'top', 'length', 'closed', 'status', 'name', 'locationbar', 'menubar',
  'personalbar', 'scrollbars', 'statusbar', 'toolbar', 'visualViewport',
  'speechSynthesis', 'caches', 'cookieStore', 'scheduler',
  'trustedTypes', 'navigation', 'origin', 'isSecureContext',
  'crossOriginIsolated', 'originAgentCluster', 'scheduler',
  'alert', 'confirm', 'prompt', 'print', 'find', 'showModalDialog',
  'blur', 'focus', 'close', 'stop', 'open', 'postMessage',
  'captureEvents', 'releaseEvents', 'routeEvent', 'enableExternalCapture',
  'disableExternalCapture', 'captureExternalEvents', 'releaseExternalEvents',
  'getDefaultComputedStyle', 'dump', 'updateCommands', 'btoa', 'atob',
  'setResizable', 'moveTo', 'moveBy', 'resizeTo', 'resizeBy',
  'requestAnimationFrame', 'cancelAnimationFrame',
  'requestIdleCallback', 'cancelIdleCallback',
  'chrome', 'browser', 'safari', 'netscape',
  'colors'
]);

function parseScriptOrder(html) {
  const order = [];
  const regex = /<script\s+src=["']([^"']+)["']\s*>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    if (!match[1].startsWith('http://') && !match[1].startsWith('https://') && !match[1].startsWith('//')) {
      order.push({
        src: match[1],
        absolute: path.join(PROJECT_ROOT, match[1]),
        line: html.substring(0, match.index).split('\n').length
      });
    }
  }
  return order;
}

function extractExports(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const exports = [];
  const regex = /^(?:const|let|var|window\.|globalThis\.)\s*([A-Za-z_$][\w$]*)\s*=\s*\(function\s*\(/gm;
  let match;
  while ((match = regex.exec(content)) !== null) {
    exports.push(match[1]);
  }
  return exports;
}

function extractProtectedDependencies(fileContent) {
  const protectedDeps = new Set();
  const patterns = [
    /typeof\s+([A-Za-z_$][\w$]*)\s*!==\s*['"]undefined['"]/g,
    /typeof\s+([A-Za-z_$][\w$]*)\s*===\s*['"]undefined['"]/g,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(fileContent)) !== null) {
      const name = match[1];
      if (!KNOWN_WEB_GLOBALS.has(name) && !name.match(/^[a-z]/)) {
        protectedDeps.add(name);
      }
    }
  }
  return protectedDeps;
}

function extractUnprotectedGlobalRefs(fileContent) {
  const unprotected = new Set();
  const pattern = /\b([A-Z][A-Za-z0-9_$]+)\s*\./g;
  let match;
  while ((match = pattern.exec(fileContent)) !== null) {
    const name = match[1];
    if (!KNOWN_WEB_GLOBALS.has(name)) {
      unprotected.add(name);
    }
  }
  return unprotected;
}

function detectTopLevelUnprotectedRefs(fileContent, exportedName) {
  const hardDeps = new Set();
  const iifeStart = fileContent.indexOf('(function()');
  const returnMatch = fileContent.match(/\n\s*return\s*\{/);
  if (iifeStart === -1 || !returnMatch) return [];

  const returnIdx = returnMatch.index;
  const topLevelCode = fileContent.slice(iifeStart, returnIdx);

  const functionRanges = [];
  const funcRegex = /\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g;
  let fm;
  while ((fm = funcRegex.exec(topLevelCode)) !== null) {
    const funcStart = fm.index;
    const funcName = fm[1];
    let open = 0, started = false, funcEnd = funcStart;
    for (let i = funcStart; i < topLevelCode.length; i++) {
      const ch = topLevelCode[i];
      if (ch === '{') { open++; started = true; }
      else if (ch === '}') {
        open--;
        if (started && open === 0) { funcEnd = i + 1; break; }
      }
    }
    functionRanges.push([funcStart, funcEnd]);
  }

  const arrowRanges = [];
  let ai = 0;
  while (ai < topLevelCode.length) {
    const arrowIdx = topLevelCode.indexOf('=>', ai);
    if (arrowIdx === -1) break;
    let braceStart = topLevelCode.indexOf('{', arrowIdx);
    if (braceStart !== -1 && braceStart - arrowIdx < 5) {
      let open = 0, started = false, end = braceStart;
      for (let j = braceStart; j < topLevelCode.length; j++) {
        const ch = topLevelCode[j];
        if (ch === '{') { open++; started = true; }
        else if (ch === '}') {
          open--;
          if (started && open === 0) { end = j + 1; break; }
        }
      }
      arrowRanges.push([braceStart, end]);
      ai = end;
    } else {
      ai = arrowIdx + 2;
    }
  }

  const allRanges = [...functionRanges, ...arrowRanges].sort((a, b) => a[0] - b[0]);

  function isInRange(idx) {
    for (const [s, e] of allRanges) {
      if (idx >= s && idx < e) return true;
    }
    return false;
  }

  const refPattern = /\b([A-Z][A-Za-z0-9_$]+)\s*\./g;
  let rm;
  while ((rm = refPattern.exec(topLevelCode)) !== null) {
    const name = rm[1];
    if (KNOWN_WEB_GLOBALS.has(name)) continue;
    if (name === exportedName) continue;
    if (!isInRange(rm.index)) {
      hardDeps.add(name);
    }
  }

  return Array.from(hardDeps);
}

function analyzeFileDeps(filePath, exportedName) {
  const content = fs.readFileSync(filePath, 'utf-8');

  const protectedDeps = extractProtectedDependencies(content);
  const unprotected = extractUnprotectedGlobalRefs(content);
  const topLevelHard = new Set(detectTopLevelUnprotectedRefs(content, exportedName));

  for (const dep of protectedDeps) { unprotected.delete(dep); }
  unprotected.delete(exportedName);
  for (const dep of topLevelHard) { unprotected.delete(dep); }
  for (const dep of protectedDeps) { topLevelHard.delete(dep); }

  return {
    hard: Array.from(topLevelHard),
    protected: Array.from(protectedDeps),
    delayed: Array.from(unprotected).filter(d => !KNOWN_WEB_GLOBALS.has(d))
  };
}

function main() {
  console.log('🔗 检查全局模块加载顺序是否满足依赖...\n');

  if (!fs.existsSync(INDEX_HTML)) {
    console.error('❌ 未找到 index.html');
    process.exit(1);
  }

  const html = fs.readFileSync(INDEX_HTML, 'utf-8');
  const loadOrder = parseScriptOrder(html);

  console.log(`📜 从 index.html 读取到 ${loadOrder.length} 个本地脚本引用：\n`);

  const moduleInfo = [];
  const exportToFile = {};

  for (let i = 0; i < loadOrder.length; i++) {
    const script = loadOrder[i];
    const exists = fs.existsSync(script.absolute);
    let exports = [];
    let hardDeps = [], protectedDeps = [], delayedDeps = [];

    if (exists) {
      exports = extractExports(script.absolute);
      for (const exp of exports) {
        exportToFile[exp] = { file: script.src, index: i };
        const analyzed = analyzeFileDeps(script.absolute, exp);
        hardDeps.push(...analyzed.hard);
        protectedDeps.push(...analyzed.protected);
        delayedDeps.push(...analyzed.delayed);
      }
    }

    hardDeps = Array.from(new Set(hardDeps));
    protectedDeps = Array.from(new Set(protectedDeps));
    delayedDeps = Array.from(new Set(delayedDeps)).filter(d => !hardDeps.includes(d) && !protectedDeps.includes(d));

    moduleInfo.push({ ...script, exists, exports, hardDeps, protectedDeps, delayedDeps, loadIndex: i });

    const statusIcon = exists ? '📦' : '❌';
    const exportList = exports.length > 0 ? exports.join(', ') : '(无导出)';
    console.log(`  ${String(i + 1).padStart(2, ' ')}. ${statusIcon} L${script.line} ${script.src}`);
    console.log(`       导出: ${exportList}`);
    if (hardDeps.length) console.log(`       🔴 硬依赖: ${hardDeps.join(', ')}`);
    if (protectedDeps.length) console.log(`       🟡 可选依赖 (typeof 保护): ${protectedDeps.join(', ')}`);
    if (delayedDeps.length) console.log(`       🟢 函数内延迟引用: ${delayedDeps.join(', ')}`);
  }

  console.log('\n🧩 检查每个模块的硬依赖是否已在之前加载...\n');

  const errors = [];
  const warnings = [];
  const seenExports = new Set();

  for (const mod of moduleInfo) {
    if (!mod.exists) {
      errors.push({ level: 'fatal', message: `文件不存在: ${mod.src}` });
      continue;
    }

    for (const dep of mod.hardDeps) {
      if (KNOWN_WEB_GLOBALS.has(dep) || dep === 'EventBus' || dep === 'AppState') continue;
      if (!seenExports.has(dep)) {
        if (exportToFile[dep]) {
          errors.push({
            level: 'error',
            message: `${mod.src} (L${mod.line}) 硬依赖 ${dep}，但 ${dep} 在之后才会加载 (${exportToFile[dep].file} L${loadOrder[exportToFile[dep].index].line})`
          });
        } else {
          const matches = findModuleByNameInJsDir(dep);
          if (matches) {
            errors.push({
              level: 'error',
              message: `${mod.src} (L${mod.line}) 硬依赖 ${dep}，但 index.html 未加载该模块 (在 ${matches} 中找到但未在 script 列表)`
            });
          } else {
            warnings.push({
              level: 'warn',
              message: `${mod.src} (L${mod.line}) 硬依赖 ${dep}，但未找到该模块定义 (可能是误报或内联全局)`
            });
          }
        }
      }
    }

    for (const dep of [...mod.protectedDeps, ...mod.delayedDeps]) {
      if (KNOWN_WEB_GLOBALS.has(dep) || dep === 'EventBus' || dep === 'AppState') continue;
      if (!seenExports.has(dep) && exportToFile[dep]) {
        warnings.push({
          level: 'info',
          message: `${mod.src} (L${mod.line}) 软依赖 ${dep}，虽有 typeof 保护/延迟调用，但加载顺序颠倒；${dep} 在之后才加载 (${exportToFile[dep].file})`
        });
      }
    }

    for (const exp of mod.exports) {
      seenExports.add(exp);
    }
  }

  console.log('📊 检查结果：\n');

  const fatalErrors = errors.filter(e => e.level === 'fatal');
  const depErrors = errors.filter(e => e.level === 'error');
  const warns = warnings.filter(w => w.level === 'warn');
  const infos = warnings.filter(w => w.level === 'info');

  if (fatalErrors.length > 0) {
    console.log('❌ 致命错误（文件缺失）：');
    for (const e of fatalErrors) console.log(`   - ${e.message}`);
  }
  if (depErrors.length > 0) {
    console.log('❌ 硬依赖顺序错误（会导致 ReferenceError）：');
    for (const e of depErrors) console.log(`   - ${e.message}`);
  }
  if (warns.length > 0) {
    console.log('⚠️  警告（未找到硬依赖的定义）：');
    for (const w of warns) console.log(`   - ${w.message}`);
  }
  if (infos.length > 0) {
    console.log('💡 提示（软依赖/延迟引用，运行时才访问，通常不影响）：');
    for (const info of infos) console.log(`   - ${info.message}`);
  }

  console.log();

  if (fatalErrors.length > 0 || depErrors.length > 0) {
    console.log(`❌ 检查失败：${fatalErrors.length} 致命 + ${depErrors.length} 顺序错误 + ${warns.length} 警告 + ${infos.length} 提示`);
    console.log('   请调整 index.html 中 <script> 的加载顺序或修复缺失文件。');
    process.exit(1);
  } else {
    console.log(`✅ 硬依赖顺序正确！(警告 ${warns.length}，软依赖提示 ${infos.length})`);
  }

  console.log('\n🎉 模块加载顺序检查通过！');
  process.exit(0);
}

function findModuleByNameInJsDir(name) {
  if (!fs.existsSync(JS_DIR)) return null;
  const files = fs.readdirSync(JS_DIR).filter(f => f.endsWith('.js'));
  for (const file of files) {
    const filePath = path.join(JS_DIR, file);
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      if (content.includes(`const ${name} = (function()`) ||
          content.includes(`window.${name} = (function()`) ||
          content.includes(`var ${name} = (function()`)) {
        return `js/${file}`;
      }
    } catch (e) {}
  }
  return null;
}

main();
