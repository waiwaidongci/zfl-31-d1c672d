const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const INDEX_HTML_PATH = path.join(PROJECT_ROOT, 'index.html');

const CORE_LOGIC_MODULES = [
  'js/thread-model.js',
  'js/thread-store.js',
  'js/yarn-estimate.js',
  'js/selection-state.js',
  'js/batch-transform.js',
  'js/block-store.js',
  'js/block-editor.js',
  'js/template-data.js',
  'js/risk-config.js',
  'js/process-calc.js',
  'js/import-parser.js',
  'js/import-validator.js',
  'js/import-writer.js',
  'js/compare-calc.js',
  'js/svg-generator.js',
  'js/export-config.js',
  'js/storage-migration.js',
  'js/scheme-store.js',
  'js/state.js',
  'js/version-history.js',
  'js/import-export.js',
  'js/project-package.js',
];

function setupBrowserEnv() {
  const indexHtml = fs.existsSync(INDEX_HTML_PATH)
    ? fs.readFileSync(INDEX_HTML_PATH, 'utf-8')
    : '<!doctype html><html><body></body></html>';

  const dom = new JSDOM(indexHtml, {
    url: 'http://localhost',
    pretendToBeVisual: true,
    runScripts: 'outside-only',
  });

  global.window = dom.window;
  global.document = dom.window.document;
  global.navigator = dom.window.navigator;
  global.localStorage = dom.window.localStorage;
  global.sessionStorage = dom.window.sessionStorage;
  global.FileReader = dom.window.FileReader;
  global.Blob = dom.window.Blob;
  global.File = dom.window.File;
  global.FormData = dom.window.FormData;
  global.DOMParser = dom.window.DOMParser;
  global.XMLSerializer = dom.window.XMLSerializer;
  global.URL = dom.window.URL;
  global.URLSearchParams = dom.window.URLSearchParams;
  global.CustomEvent = dom.window.CustomEvent;
  global.Event = dom.window.Event;
  global.HTMLElement = dom.window.HTMLElement;
  global.NodeList = dom.window.NodeList;
  global.HTMLCollection = dom.window.HTMLCollection;
  global.window.colors = null;

  return dom;
}

function transformModuleCode(rawCode) {
  let code = rawCode;
  const constPattern = /^(\s*)(const\s+)([A-Za-z_$][\w$]*\s*=\s*\()/gm;
  code = code.replace(constPattern, (match, indent, _constKw, rest) => {
    return indent + 'var ' + rest;
  });
  const letPattern = /^(\s*)(let\s+)([A-Za-z_$][\w$]*\s*=\s*\()/gm;
  code = code.replace(letPattern, (match, indent, _letKw, rest) => {
    return indent + 'var ' + rest;
  });
  return code;
}

function loadModulesInOrder() {
  const ctx = {
    window: global.window,
    document: global.document,
    localStorage: global.localStorage,
    sessionStorage: global.sessionStorage,
    console: console,
    Math: Math,
    Date: Date,
    JSON: JSON,
    Promise: Promise,
    Object: Object,
    Array: Array,
    String: String,
    Number: Number,
    Boolean: Boolean,
    Map: Map,
    Set: Set,
    RegExp: RegExp,
    Error: Error,
    parseInt: parseInt,
    parseFloat: parseFloat,
    isNaN: isNaN,
    isFinite: isFinite,
    setTimeout: setTimeout,
    setInterval: setInterval,
    clearTimeout: clearTimeout,
    clearInterval: clearInterval,
    WeakMap: WeakMap,
    WeakSet: WeakSet,
    Proxy: Proxy,
    Reflect: Reflect,
    Symbol: Symbol,
  };

  for (const relPath of CORE_LOGIC_MODULES) {
    const absPath = path.join(PROJECT_ROOT, relPath);
    if (!fs.existsSync(absPath)) {
      console.warn(`[test-setup] WARN: ${relPath} not found, skipping`);
      continue;
    }
    const rawCode = fs.readFileSync(absPath, 'utf-8');
    const transformedCode = transformModuleCode(rawCode);
    try {
      vm.runInNewContext(transformedCode, ctx, {
        filename: relPath,
        displayErrors: true,
      });
    } catch (e) {
      console.error(`[test-setup] ERROR loading ${relPath}: ${e.message}`);
      throw e;
    }
    for (const key of Object.keys(ctx)) {
      if (typeof ctx[key] !== 'undefined') {
        if (!(key in global)) {
          global[key] = ctx[key];
        }
        if (global.window && !(key in global.window)) {
          global.window[key] = ctx[key];
        }
      }
    }
  }
}

function setupTestData() {
  try { global.localStorage.clear(); } catch (e) {}
  if (typeof global.ThreadStore !== 'undefined' && global.ThreadStore.load) {
    global.ThreadStore.load();
  }
  if (typeof global.RiskConfig !== 'undefined' && global.RiskConfig.reset) {
    global.RiskConfig.reset();
  }
  if (typeof global.SchemeStore !== 'undefined' && global.SchemeStore.load) {
    global.SchemeStore.load();
  }
}

setupBrowserEnv();
loadModulesInOrder();
setupTestData();

exports.mochaHooks = {
  afterEach() {
    try { global.localStorage && global.localStorage.clear(); } catch (e) {}
    if (typeof global.RiskConfig !== 'undefined' && global.RiskConfig.reset) {
      global.RiskConfig.reset();
    }
    if (typeof global.SelectionState !== 'undefined' && global.SelectionState.reset) {
      global.SelectionState.reset();
    }
  }
};
