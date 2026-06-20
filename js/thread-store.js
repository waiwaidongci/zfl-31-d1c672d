const ThreadStore = (function() {

  const STORAGE_KEY = "zfl31Threads";
  const VERSION_KEY = "zfl31ThreadsVersion";
  const CURRENT_VERSION = 1;

  let _threads = [];
  let _listeners = [];

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        _threads = JSON.parse(raw);
      }
    } catch (e) {
      _threads = [];
    }

    const version = localStorage.getItem(VERSION_KEY);
    if (!version || Number(version) < CURRENT_VERSION) {
      _migrate();
    }

    if (_threads.length === 0) {
      _threads = ThreadModel.createDefaultThreads();
      _persist();
    }

    _sortAndNormalize();
    _notify();
  }

  function _migrate() {
    const legacyColors = window.colors || ThreadModel.DEFAULT_COLORS;

    if (_threads.length === 0 && legacyColors && legacyColors.length > 0) {
      _threads = legacyColors.map((color, i) =>
        ThreadModel.createThread({
          id: "default_" + i,
          name: "色线" + i,
          color: color,
          note: i === 0 ? "底色/空白" : "",
          order: i
        })
      );
    }

    _migrateSchemeCells();

    localStorage.setItem(VERSION_KEY, String(CURRENT_VERSION));
    _persist();
  }

  function _migrateSchemeCells() {
    try {
      const schemesRaw = localStorage.getItem("zfl31Schemes");
      if (!schemesRaw) return;

      const schemes = JSON.parse(schemesRaw);
      if (!schemes || typeof schemes !== "object") return;

      let changed = false;
      const sortedThreads = ThreadModel.sortByOrder(_threads);

      Object.keys(schemes).forEach(id => {
        const scheme = schemes[id];
        if (scheme.cells && Array.isArray(scheme.cells) && scheme.cells.length > 0) {
          const firstCell = scheme.cells[0];
          if (typeof firstCell === "number") {
            scheme.cells = ThreadModel.migrateIndexToId(scheme.cells, sortedThreads);
            if (typeof scheme.activeColor === "number") {
              const idx = scheme.activeColor;
              if (idx >= 0 && idx < sortedThreads.length) {
                scheme.activeColor = sortedThreads[idx].id;
              } else {
                scheme.activeColor = sortedThreads[0] ? sortedThreads[0].id : null;
              }
            }
            changed = true;
          }
        }
      });

      if (changed) {
        localStorage.setItem("zfl31Schemes", JSON.stringify(schemes));
      }
    } catch (e) {}
  }

  function _syncLoadedSchemeStore(schemes) {
    try {
      if (typeof SchemeStore === "undefined" || !SchemeStore || !SchemeStore._schemes) {
        return;
      }
      Object.keys(schemes).forEach(id => {
        if (SchemeStore._schemes[id]) {
          SchemeStore._schemes[id] = schemes[id];
        }
      });
    } catch (e) {}
  }

  function _persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(_threads));
    _notify();
  }

  function _sortAndNormalize() {
    _threads.sort((a, b) => a.order - b.order);
    _threads.forEach((t, i) => { t.order = i; });
  }

  function _notify() {
    _listeners.forEach(fn => {
      try { fn(_threads); } catch (e) {}
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
    return ThreadModel.sortByOrder(_threads);
  }

  function getById(id) {
    return ThreadModel.getThreadById(_threads, id);
  }

  function getColorById(id) {
    return ThreadModel.getColorById(_threads, id);
  }

  function getFirstId() {
    const sorted = ThreadModel.sortByOrder(_threads);
    return sorted.length > 0 ? sorted[0].id : null;
  }

  function add(options = {}) {
    const maxOrder = _threads.length > 0
      ? Math.max(..._threads.map(t => t.order))
      : -1;

    const thread = ThreadModel.createThread({
      ...options,
      order: maxOrder + 1
    });

    _threads.push(thread);
    _persist();
    return thread;
  }

  function update(id, patch) {
    const idx = _threads.findIndex(t => t.id === id);
    if (idx === -1) return null;

    _threads[idx] = { ..._threads[idx], ...patch };
    _persist();
    return _threads[idx];
  }

  function remove(id, replaceId = null) {
    const idx = _threads.findIndex(t => t.id === id);
    if (idx === -1) return false;

    if (_threads.length <= 1) {
      return false;
    }

    const actualReplaceId = replaceId || _getDefaultReplaceId(id);

    _replaceInAllSchemes(id, actualReplaceId);

    _threads.splice(idx, 1);
    _sortAndNormalize();
    _persist();
    return true;
  }

  function _getDefaultReplaceId(excludeId) {
    const sorted = ThreadModel.sortByOrder(_threads);
    const others = sorted.filter(t => t.id !== excludeId);
    return others.length > 0 ? others[0].id : null;
  }

  function _replaceInAllSchemes(oldId, newId) {
    try {
      const schemesRaw = localStorage.getItem("zfl31Schemes");
      if (!schemesRaw) return;

      const schemes = JSON.parse(schemesRaw);
      if (!schemes || typeof schemes !== "object") return;

      let changed = false;

      Object.keys(schemes).forEach(id => {
        const scheme = schemes[id];
        if (scheme.cells && Array.isArray(scheme.cells)) {
          const newCells = ThreadModel.replaceThreadInCells(scheme.cells, oldId, newId);
          if (JSON.stringify(newCells) !== JSON.stringify(scheme.cells)) {
            scheme.cells = newCells;
            changed = true;
          }
        }
        if (scheme.activeColor === oldId) {
          scheme.activeColor = newId;
          changed = true;
        }
      });

      if (changed) {
        localStorage.setItem("zfl31Schemes", JSON.stringify(schemes));
        _syncLoadedSchemeStore(schemes);
      }
    } catch (e) {}
  }

  function reorder(fromIndex, toIndex) {
    const result = ThreadModel.reorderThreads(_threads, fromIndex, toIndex);
    _threads = result;
    _persist();
    return _threads;
  }

  function isUsedInAnyScheme(id) {
    try {
      const schemesRaw = localStorage.getItem("zfl31Schemes");
      if (!schemesRaw) return false;

      const schemes = JSON.parse(schemesRaw);
      if (!schemes || typeof schemes !== "object") return false;

      return Object.values(schemes).some(scheme =>
        scheme.cells && Array.isArray(scheme.cells) && scheme.cells.includes(id)
      );
    } catch (e) {
      return false;
    }
  }

  function getUsageInfo(id) {
    const result = { schemeCount: 0, totalCells: 0, schemes: [] };
    try {
      const schemesRaw = localStorage.getItem("zfl31Schemes");
      if (!schemesRaw) return result;

      const schemes = JSON.parse(schemesRaw);
      if (!schemes || typeof schemes !== "object") return result;

      Object.keys(schemes).forEach(schemeId => {
        const scheme = schemes[schemeId];
        if (scheme.cells && Array.isArray(scheme.cells)) {
          const count = scheme.cells.filter(v => v === id).length;
          if (count > 0) {
            result.schemeCount++;
            result.totalCells += count;
            result.schemes.push({
              id: schemeId, name: scheme.name || schemeId, count });
          }
        }
      });
    } catch (e) {}
    return result;
  }

  function getUsedCountInScheme(cells, id) {
    if (!cells || !Array.isArray(cells)) return 0;
    return cells.filter(v => v === id).length;
  }

  function importThreads(importedThreads, mode = "merge") {
    if (!Array.isArray(importedThreads)) return;

    if (mode === "replace") {
      _threads = importedThreads.map((t, i) => ({
        ...ThreadModel.createThread(t),
        order: i
      }));
    } else {
      const existingIds = new Set(_threads.map(t => t.id));
      let maxOrder = _threads.length > 0
        ? Math.max(..._threads.map(t => t.order))
        : -1;

      importedThreads.forEach(t => {
        if (!existingIds.has(t.id)) {
          maxOrder++;
          _threads.push({
            ...ThreadModel.createThread(t),
            order: maxOrder
          });
          existingIds.add(t.id);
        }
      });
    }

    _sortAndNormalize();
    _persist();
  }

  function toJSON() {
    return ThreadModel.sortByOrder(_threads);
  }

  return {
    load,
    subscribe,
    getAll,
    getById,
    getColorById,
    getFirstId,
    add,
    update,
    remove,
    reorder,
    isUsedInAnyScheme,
    getUsageInfo,
    getUsedCountInScheme,
    importThreads,
    toJSON
  };
})();
