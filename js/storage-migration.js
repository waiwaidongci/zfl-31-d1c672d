const StorageMigration = (function() {

  var SCHEMES_KEY = "zfl31Schemes";
  var ACTIVE_KEY = "zfl31ActiveScheme";
  var LEGACY_KEY = "zfl31Pattern";
  var VERSION_KEY = "zfl31StorageVersion";
  var CURRENT_VERSION = 3;

  function migrateAll() {
    var version = 0;
    try {
      version = Number(localStorage.getItem(VERSION_KEY)) || 0;
    } catch (e) {}

    if (version < 1) {
      _migrateV0toV1();
    }
    if (version < 2) {
      _migrateV1toV2();
    }
    if (version < 3) {
      _migrateV2toV3();
    }

    try {
      localStorage.setItem(VERSION_KEY, String(CURRENT_VERSION));
    } catch (e) {}
  }

  function _migrateV0toV1() {
    var legacyRaw;
    try {
      legacyRaw = localStorage.getItem(LEGACY_KEY);
    } catch (e) { return; }

    if (!legacyRaw) return;

    var schemes = {};
    try {
      var raw = localStorage.getItem(SCHEMES_KEY);
      if (raw) schemes = JSON.parse(raw);
    } catch (e) { schemes = {}; }

    try {
      var legacy = JSON.parse(legacyRaw);
      if (!legacy || !Array.isArray(legacy.cells)) return;

      var existing = Object.values(schemes).find(function(s) {
        return s.name === "默认方案" &&
          s.cols === (legacy.cols || 18) &&
          s.rows === (legacy.rows || 14) &&
          JSON.stringify(s.cells) === JSON.stringify(legacy.cells);
      });

      if (existing) {
        if (!localStorage.getItem(ACTIVE_KEY)) {
          localStorage.setItem(ACTIVE_KEY, existing.id);
        }
        localStorage.removeItem(LEGACY_KEY);
        return;
      }

      var threads = ThreadStore.getAll();
      var migratedCells = ThreadModel.migrateIndexToId(legacy.cells, threads);
      var firstThreadId = threads.length > 0 ? threads[0].id : null;

      var id = _uid();
      var now = Date.now();
      schemes[id] = {
        id: id,
        name: "默认方案",
        cols: legacy.cols || 18,
        rows: legacy.rows || 14,
        cells: migratedCells,
        activeColor: firstThreadId,
        activeBlock: "dot",
        undo: [],
        redo: [],
        versions: [],
        createdAt: now,
        updatedAt: now
      };

      localStorage.setItem(SCHEMES_KEY, JSON.stringify(schemes));
      if (!localStorage.getItem(ACTIVE_KEY)) {
        localStorage.setItem(ACTIVE_KEY, id);
      }
      localStorage.removeItem(LEGACY_KEY);
    } catch (e) {}
  }

  function _migrateV1toV2() {
    var schemes = {};
    try {
      var raw = localStorage.getItem(SCHEMES_KEY);
      if (raw) schemes = JSON.parse(raw);
    } catch (e) { return; }

    if (!schemes || typeof schemes !== "object") return;

    var changed = false;
    Object.keys(schemes).forEach(function(id) {
      var s = schemes[id];
      if (!s.versions) {
        s.versions = [];
        changed = true;
      }
      if (!s.id) {
        s.id = id;
        changed = true;
      }
      if (typeof s.activeBlock === "undefined") {
        s.activeBlock = "dot";
        changed = true;
      }
    });

    if (changed) {
      try {
        localStorage.setItem(SCHEMES_KEY, JSON.stringify(schemes));
      } catch (e) {}
    }
  }

  function _migrateV2toV3() {
    var schemes = {};
    try {
      var raw = localStorage.getItem(SCHEMES_KEY);
      if (raw) schemes = JSON.parse(raw);
    } catch (e) { return; }

    if (!schemes || typeof schemes !== "object") return;

    var changed = false;
    var now = Date.now();

    Object.keys(schemes).forEach(function(id) {
      var s = schemes[id];
      if (!s.createdAt) {
        s.createdAt = now;
        changed = true;
      }
      if (!s.updatedAt) {
        s.updatedAt = now;
        changed = true;
      }
      if (!s.name) {
        s.name = "未命名方案";
        changed = true;
      }
      if (s.versions && Array.isArray(s.versions)) {
        s.versions.forEach(function(v) {
          if (!v.id) {
            v.id = _uidVersion();
            changed = true;
          }
          if (!v.timestamp) {
            v.timestamp = now;
            changed = true;
          }
        });
      }
    });

    if (changed) {
      try {
        localStorage.setItem(SCHEMES_KEY, JSON.stringify(schemes));
      } catch (e) {}
    }
  }

  function _uidVersion() {
    return "v_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }

  function _uid() {
    return "s_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }

  return {
    migrateAll: migrateAll,
    SCHEMES_KEY: SCHEMES_KEY,
    ACTIVE_KEY: ACTIVE_KEY,
    CURRENT_VERSION: CURRENT_VERSION
  };
})();
