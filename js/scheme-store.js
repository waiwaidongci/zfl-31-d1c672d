const SchemeStore = (function() {

  var STORAGE_KEY = StorageMigration.SCHEMES_KEY;
  var ACTIVE_KEY = StorageMigration.ACTIVE_KEY;

  var _schemes = null;
  var _activeId = null;

  function uid() {
    return "s_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }

  function defaultCells(cols, rows) {
    var firstId = ThreadStore.getFirstId();
    return Array(cols * rows).fill(firstId);
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        _schemes = JSON.parse(raw);
      } else {
        _schemes = {};
      }
    } catch (e) {
      _schemes = {};
    }
    _activeId = localStorage.getItem(ACTIVE_KEY);

    Object.keys(_schemes).forEach(function(id) {
      if (!_schemes[id].versions) {
        _schemes[id].versions = [];
      }
    });

    if (Object.keys(_schemes).length === 0) {
      create("默认方案", 18, 14);
    }
    if (!_activeId || !_schemes[_activeId]) {
      _activeId = Object.keys(_schemes)[0];
      _persistActive();
    }

    _persist();
  }

  function _persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(_schemes));
  }

  function _persistActive() {
    localStorage.setItem(ACTIVE_KEY, _activeId);
  }

  function getAll() {
    return Object.values(_schemes).sort(function(a, b) { return b.updatedAt - a.updatedAt; });
  }

  function getActive() {
    return _schemes[_activeId];
  }

  function getActiveId() {
    return _activeId;
  }

  function setActive(id) {
    if (_schemes[id]) {
      _activeId = id;
      _persistActive();
      return true;
    }
    return false;
  }

  function getById(id) {
    return _schemes[id] || null;
  }

  function update(id, patch) {
    if (!_schemes[id]) return null;
    _schemes[id] = Object.assign({}, _schemes[id], patch, { updatedAt: Date.now() });
    _persist();
    return _schemes[id];
  }

  function create(name, cols, rows) {
    var id = uid();
    var now = Date.now();
    var firstThreadId = ThreadStore.getFirstId();
    _schemes[id] = {
      id: id,
      name: name || "新方案",
      cols: cols || 18,
      rows: rows || 14,
      cells: defaultCells(cols || 18, rows || 14),
      activeColor: firstThreadId,
      activeBlock: "dot",
      undo: [],
      redo: [],
      versions: [],
      createdAt: now,
      updatedAt: now
    };
    _persist();
    return _schemes[id];
  }

  function duplicate(id) {
    var src = _schemes[id];
    if (!src) return null;
    var newId = uid();
    var now = Date.now();
    _schemes[newId] = Object.assign({}, JSON.parse(JSON.stringify(src)), {
      id: newId,
      name: src.name + " 副本",
      undo: [],
      redo: [],
      versions: [],
      createdAt: now,
      updatedAt: now
    });
    _persist();
    return _schemes[newId];
  }

  function remove(id) {
    if (!_schemes[id]) return false;
    delete _schemes[id];
    if (Object.keys(_schemes).length === 0) {
      create("默认方案", 18, 14);
    }
    if (_activeId === id) {
      _activeId = Object.keys(_schemes)[0];
      _persistActive();
    }
    _persist();
    return true;
  }

  function rename(id, name) {
    if (!_schemes[id]) return null;
    _schemes[id].name = name.trim() || "未命名方案";
    _schemes[id].updatedAt = Date.now();
    _persist();
    return _schemes[id];
  }

  function saveActive() {
    if (!_activeId) return;
    var scheme = _schemes[_activeId];
    scheme.updatedAt = Date.now();

    VersionHistory.createSnapshot(_activeId, scheme);

    _persist();
    EventBus.emit("scheme:saved", _activeId);
  }

  function nextName(base) {
    base = base || "新方案";
    var names = {};
    Object.values(_schemes).forEach(function(s) { names[s.name] = true; });
    if (!names[base]) return base;
    var i = 2;
    while (names[base + " " + i]) i++;
    return base + " " + i;
  }

  return {
    _schemes: _schemes,
    load: load,
    getAll: getAll,
    getActive: getActive,
    getActiveId: getActiveId,
    setActive: setActive,
    getById: getById,
    update: update,
    create: create,
    duplicate: duplicate,
    remove: remove,
    rename: rename,
    saveActive: saveActive,
    nextName: nextName,
    uid: uid,
    defaultCells: defaultCells,
    get _schemes() { return _schemes; }
  };
})();
