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

    let migrated = false;
    Object.keys(_blocks).forEach(id => {
      const block = _blocks[id];
      if (!block.category) {
        block.category = "未分类";
        migrated = true;
      }
      if (typeof block.notes === "undefined") {
        block.notes = "";
        migrated = true;
      }
    });
    if (migrated) {
      _persist();
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
      category: options.category || "未分类",
      notes: options.notes || "",
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
      category: src.category || "未分类",
      notes: src.notes || "",
      createdAt: now,
      updatedAt: now
    };
    _persist();
    return _blocks[newId];
  }

  function setCategory(id, category) {
    if (!_blocks[id]) return null;
    _blocks[id].category = category.trim() || "未分类";
    _blocks[id].updatedAt = Date.now();
    _persist();
    return _blocks[id];
  }

  function setNotes(id, notes) {
    if (!_blocks[id]) return null;
    _blocks[id].notes = notes || "";
    _blocks[id].updatedAt = Date.now();
    _persist();
    return _blocks[id];
  }

  function getAllCategories() {
    const categories = new Set();
    Object.values(_blocks).forEach(b => {
      categories.add(b.category || "未分类");
    });
    return Array.from(categories).sort();
  }

  function filterByCategory(category) {
    const blocks = Object.values(_blocks);
    if (!category || category === "all") return blocks.sort((a, b) => b.updatedAt - a.updatedAt);
    return blocks
      .filter(b => (b.category || "未分类") === category)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  function searchByName(keyword) {
    const blocks = Object.values(_blocks);
    if (!keyword) return blocks.sort((a, b) => b.updatedAt - a.updatedAt);
    const lower = keyword.toLowerCase();
    return blocks
      .filter(b => b.name.toLowerCase().includes(lower))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  function getFiltered(options = {}) {
    let blocks = Object.values(_blocks);
    if (options.category && options.category !== "all") {
      blocks = blocks.filter(b => (b.category || "未分类") === options.category);
    }
    if (options.search) {
      const lower = options.search.toLowerCase();
      blocks = blocks.filter(b => b.name.toLowerCase().includes(lower));
    }
    return blocks.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  function rotatePattern90(pattern, cols, rows) {
    const newPattern = Array(cols * rows).fill(false);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const oldIdx = y * cols + x;
        const newX = rows - 1 - y;
        const newY = x;
        const newIdx = newY * rows + newX;
        newPattern[newIdx] = pattern[oldIdx] || false;
      }
    }
    return { pattern: newPattern, cols: rows, rows: cols };
  }

  function flipPatternHorizontal(pattern, cols, rows) {
    const newPattern = Array(cols * rows).fill(false);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const oldIdx = y * cols + x;
        const newX = cols - 1 - x;
        const newIdx = y * cols + newX;
        newPattern[newIdx] = pattern[oldIdx] || false;
      }
    }
    return { pattern: newPattern, cols, rows };
  }

  function flipPatternVertical(pattern, cols, rows) {
    const newPattern = Array(cols * rows).fill(false);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const oldIdx = y * cols + x;
        const newY = rows - 1 - y;
        const newIdx = newY * cols + x;
        newPattern[newIdx] = pattern[oldIdx] || false;
      }
    }
    return { pattern: newPattern, cols, rows };
  }

  function getTransformedPattern(blockId, transform = {}) {
    const block = _blocks[blockId];
    if (!block) return null;

    let result = {
      pattern: [...block.pattern],
      cols: block.cols,
      rows: block.rows
    };

    if (transform.rotate90) {
      result = rotatePattern90(result.pattern, result.cols, result.rows);
    }
    if (transform.flipH) {
      result = flipPatternHorizontal(result.pattern, result.cols, result.rows);
    }
    if (transform.flipV) {
      result = flipPatternVertical(result.pattern, result.cols, result.rows);
    }

    return result;
  }

  function getTransformedPatternOffsets(blockId, transform = {}) {
    const transformed = getTransformedPattern(blockId, transform);
    if (!transformed) return [];

    const offsets = [];
    const { cols, rows, pattern } = transformed;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const idx = y * cols + x;
        if (pattern[idx]) {
          offsets.push({ dx: x, dy: y });
        }
      }
    }
    return offsets;
  }

  function getTransformedBlockBounds(blockId, transform = {}) {
    const block = _blocks[blockId];
    if (!block) return { cols: 1, rows: 1 };

    let cols = block.cols;
    let rows = block.rows;

    if (transform.rotate90) {
      const temp = cols;
      cols = rows;
      rows = temp;
    }

    return { cols, rows };
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
    setCategory,
    setNotes,
    nextName,
    getPatternOffsets,
    getBlockBounds,
    createEmptyPattern,
    getAllCategories,
    filterByCategory,
    searchByName,
    getFiltered,
    rotatePattern90,
    flipPatternHorizontal,
    flipPatternVertical,
    getTransformedPattern,
    getTransformedPatternOffsets,
    getTransformedBlockBounds
  };
})();
