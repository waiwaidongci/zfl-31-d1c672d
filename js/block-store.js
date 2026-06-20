const BlockStore = (function() {

  const STORAGE_KEY = "zfl31CustomBlocks";

  let _blocks = {};
  let _listeners = [];

  function uid() {
    return "b_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        _blocks = JSON.parse(raw);
      } else {
        _blocks = {};
      }
    } catch (e) {
      _blocks = {};
    }
    _notify();
  }

  function _persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(_blocks));
    _notify();
  }

  function _notify() {
    _listeners.forEach(fn => {
      try { fn(getAll()); } catch (e) {}
    });
  }

  function subscribe(fn) {
    if (typeof fn === "function" && _listeners.indexOf(fn) === -1) {
      _listeners.push(fn);
    }
    return () => {
      const idx = _listeners.indexOf(fn);
      if (idx !== -1) _listeners.splice(idx, 1);
    };
  }

  function getAll() {
    return Object.values(_blocks).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  function getById(id) {
    return _blocks[id] || null;
  }

  function create(options) {
    const id = uid();
    const now = Date.now();
    const block = {
      id,
      name: options.name || "新纹样块",
      cols: Math.max(1, Math.min(12, options.cols || 3)),
      rows: Math.max(1, Math.min(12, options.rows || 3)),
      pattern: options.pattern || createEmptyPattern(options.cols || 3, options.rows || 3),
      createdAt: now,
      updatedAt: now
    };
    _blocks[id] = block;
    _persist();
    return block;
  }

  function createEmptyPattern(cols, rows) {
    return Array(cols * rows).fill(false);
  }

  function update(id, patch) {
    if (!_blocks[id]) return null;

    const oldCols = _blocks[id].cols;
    const oldRows = _blocks[id].rows;
    const newCols = patch.cols != null ? patch.cols : oldCols;
    const newRows = patch.rows != null ? patch.rows : oldRows;
    const sizeChanged = newCols !== oldCols || newRows !== oldRows;

    _blocks[id] = {
      ..._blocks[id],
      ...patch,
      updatedAt: Date.now()
    };

    if (sizeChanged && patch.pattern == null) {
      _blocks[id].pattern = resizePattern(_blocks[id].pattern, oldCols, oldRows, newCols, newRows);
    }

    _blocks[id].cols = newCols;
    _blocks[id].rows = newRows;

    _persist();
    return _blocks[id];
  }

  function resizePattern(oldPattern, oldCols, oldRows, newCols, newRows) {
    const newPattern = Array(newCols * newRows).fill(false);
    const minCols = Math.min(oldCols, newCols);
    const minRows = Math.min(oldRows, newRows);
    for (let y = 0; y < minRows; y++) {
      for (let x = 0; x < minCols; x++) {
        const oldIdx = y * oldCols + x;
        const newIdx = y * newCols + x;
        newPattern[newIdx] = oldPattern[oldIdx] || false;
      }
    }
    return newPattern;
  }

  function duplicate(id) {
    const src = _blocks[id];
    if (!src) return null;
    const newId = uid();
    const now = Date.now();
    _blocks[newId] = {
      ...JSON.parse(JSON.stringify(src)),
      id: newId,
      name: src.name + " 副本",
      createdAt: now,
      updatedAt: now
    };
    _persist();
    return _blocks[newId];
  }

  function remove(id) {
    if (!_blocks[id]) return false;
    delete _blocks[id];
    _persist();
    return true;
  }

  function rename(id, name) {
    if (!_blocks[id]) return null;
    _blocks[id].name = name.trim() || "未命名纹样块";
    _blocks[id].updatedAt = Date.now();
    _persist();
    return _blocks[id];
  }

  function nextName(base = "新纹样块") {
    const names = new Set(Object.values(_blocks).map(b => b.name));
    if (!names.has(base)) return base;
    let i = 2;
    while (names.has(`${base} ${i}`)) i++;
    return `${base} ${i}`;
  }

  function getPatternOffsets(blockId) {
    const block = _blocks[blockId];
    if (!block) return [];
    const offsets = [];
    for (let y = 0; y < block.rows; y++) {
      for (let x = 0; x < block.cols; x++) {
        const idx = y * block.cols + x;
        if (block.pattern[idx]) {
          offsets.push({ dx: x, dy: y });
        }
      }
    }
    return offsets;
  }

  function getBlockBounds(blockId) {
    const block = _blocks[blockId];
    if (!block) return { cols: 1, rows: 1 };
    return { cols: block.cols, rows: block.rows };
  }

  return {
    load,
    subscribe,
    getAll,
    getById,
    create,
    update,
    duplicate,
    remove,
    rename,
    nextName,
    getPatternOffsets,
    getBlockBounds,
    createEmptyPattern
  };
})();
