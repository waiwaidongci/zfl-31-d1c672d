const ExportConfig = (function() {

  const STORAGE_KEY = 'zfl31ExportConfig';

  const DEFAULTS = {
    cellSize: 20,
    showGrid: true,
    showLegend: true
  };

  const CELL_SIZE_OPTIONS = [
    { label: '超小 (10px)', value: 10 },
    { label: '小 (15px)', value: 15 },
    { label: '中 (20px)', value: 20 },
    { label: '大 (30px)', value: 30 },
    { label: '超大 (40px)', value: 40 }
  ];

  let _config = { ...DEFAULTS };
  let _listeners = [];

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        _config = { ...DEFAULTS, ...saved };
      }
    } catch (e) {
      _config = { ...DEFAULTS };
    }
    _validate();
  }

  function _validate() {
    if (typeof _config.cellSize !== 'number' || _config.cellSize < 4 || _config.cellSize > 100) {
      _config.cellSize = DEFAULTS.cellSize;
    }
    if (typeof _config.showGrid !== 'boolean') {
      _config.showGrid = DEFAULTS.showGrid;
    }
    if (typeof _config.showLegend !== 'boolean') {
      _config.showLegend = DEFAULTS.showLegend;
    }
  }

  function _persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(_config));
    } catch (e) {}
  }

  function _notify() {
    _listeners.forEach(fn => {
      try { fn({ ..._config }); } catch (e) {}
    });
  }

  function getAll() {
    return { ..._config };
  }

  function getCellSize() { return _config.cellSize; }
  function getShowGrid() { return _config.showGrid; }
  function getShowLegend() { return _config.showLegend; }
  function getCellSizeOptions() { return [...CELL_SIZE_OPTIONS]; }

  function setCellSize(value) {
    const v = Number(value);
    if (!isNaN(v) && v >= 4 && v <= 100) {
      _config.cellSize = v;
      _persist();
      _notify();
      return true;
    }
    return false;
  }

  function setShowGrid(value) {
    _config.showGrid = Boolean(value);
    _persist();
    _notify();
  }

  function setShowLegend(value) {
    _config.showLegend = Boolean(value);
    _persist();
    _notify();
  }

  function set(patch) {
    if (!patch || typeof patch !== 'object') return;
    if ('cellSize' in patch) {
      const v = Number(patch.cellSize);
      if (!isNaN(v) && v >= 4 && v <= 100) {
        _config.cellSize = v;
      }
    }
    if ('showGrid' in patch) {
      _config.showGrid = Boolean(patch.showGrid);
    }
    if ('showLegend' in patch) {
      _config.showLegend = Boolean(patch.showLegend);
    }
    _persist();
    _notify();
  }

  function reset() {
    _config = { ...DEFAULTS };
    _persist();
    _notify();
  }

  function subscribe(fn) {
    if (typeof fn === 'function' && _listeners.indexOf(fn) === -1) {
      _listeners.push(fn);
    }
    return () => {
      const idx = _listeners.indexOf(fn);
      if (idx !== -1) _listeners.splice(idx, 1);
    };
  }

  return {
    load,
    getAll,
    getCellSize,
    getShowGrid,
    getShowLegend,
    getCellSizeOptions,
    setCellSize,
    setShowGrid,
    setShowLegend,
    set,
    reset,
    subscribe
  };
})();
