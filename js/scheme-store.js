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
      if (typeof _schemes[id].favorite !== "boolean") {
        _schemes[id].favorite = false;
      }
      if (!Array.isArray(_schemes[id].tags)) {
        _schemes[id].tags = [];
      }
      if (!_schemes[id].estimateConfig || typeof _schemes[id].estimateConfig !== "object") {
        _schemes[id].estimateConfig = YarnEstimate ? YarnEstimate.getDefaults() : {
          cellSizeMm: 2.0,
          warpDensity: 5.0,
          weftDensity: 5.0,
          defaultLossFactor: 1.15,
          defaultSafetyMargin: 10
        };
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
    var defaultEstimate = YarnEstimate ? YarnEstimate.getDefaults() : {
      cellSizeMm: 2.0,
      warpDensity: 5.0,
      weftDensity: 5.0,
      defaultLossFactor: 1.15,
      defaultSafetyMargin: 10
    };
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
      favorite: false,
      tags: [],
      estimateConfig: defaultEstimate,
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

  function toggleFavorite(id) {
    if (!_schemes[id]) return false;
    _schemes[id].favorite = !_schemes[id].favorite;
    _schemes[id].updatedAt = Date.now();
    _persist();
    return _schemes[id].favorite;
  }

  function addTag(id, tag) {
    if (!_schemes[id]) return false;
    tag = tag.trim();
    if (!tag) return false;
    if (_schemes[id].tags.indexOf(tag) === -1) {
      _schemes[id].tags.push(tag);
      _schemes[id].updatedAt = Date.now();
      _persist();
    }
    return true;
  }

  function removeTag(id, tag) {
    if (!_schemes[id]) return false;
    var idx = _schemes[id].tags.indexOf(tag);
    if (idx > -1) {
      _schemes[id].tags.splice(idx, 1);
      _schemes[id].updatedAt = Date.now();
      _persist();
    }
    return true;
  }

  function setTags(id, tags) {
    if (!_schemes[id]) return false;
    _schemes[id].tags = (tags || []).map(function(t) { return t.trim(); }).filter(function(t) { return t; });
    _schemes[id].updatedAt = Date.now();
    _persist();
    return true;
  }

  function getAllTags() {
    var tagSet = {};
    Object.values(_schemes).forEach(function(s) {
      (s.tags || []).forEach(function(t) {
        tagSet[t] = true;
      });
    });
    return Object.keys(tagSet).sort();
  }

  function getFiltered(options) {
    options = options || {};
    var list = Object.values(_schemes);

    if (options.tag) {
      list = list.filter(function(s) {
        return (s.tags || []).indexOf(options.tag) > -1;
      });
    }

    if (options.favoriteFirst) {
      list.sort(function(a, b) {
        if (a.favorite && !b.favorite) return -1;
        if (!a.favorite && b.favorite) return 1;
        return b.updatedAt - a.updatedAt;
      });
    } else {
      list.sort(function(a, b) { return b.updatedAt - a.updatedAt; });
    }

    return list;
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
    toggleFavorite: toggleFavorite,
    addTag: addTag,
    removeTag: removeTag,
    setTags: setTags,
    getAllTags: getAllTags,
    getFiltered: getFiltered,
    uid: uid,
    defaultCells: defaultCells,
    get _schemes() { return _schemes; }
  };
})();
