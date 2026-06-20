const ExportConfig = (function() {

  const STORAGE_KEY = 'zfl31ExportConfig';

  const DEFAULTS = {
    cellSize: 20,
    showGrid: true,
    showLegend: true,
    transparentBg: false,
    showTitle: true,
    margin: 20
  };

  const CELL_SIZE_OPTIONS = [
    { label: '超小 (10px)', value: 10 },
    { label: '小 (15px)', value: 15 },
    { label: '中 (20px)', value: 20 },
    { label: '大 (30px)', value: 30 },
    { label: '超大 (40px)', value: 40 }
  ];

  const MARGIN_OPTIONS = [
    { label: '无 (0px)', value: 0 },
    { label: '小 (10px)', value: 10 },
    { label: '中 (20px)', value: 20 },
    { label: '大 (30px)', value: 30 },
    { label: '超大 (50px)', value: 50 }
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
    if (typeof _config.transparentBg !== 'boolean') {
      _config.transparentBg = DEFAULTS.transparentBg;
    }
    if (typeof _config.showTitle !== 'boolean') {
      _config.showTitle = DEFAULTS.showTitle;
    }
    if (typeof _config.margin !== 'number' || _config.margin < 0 || _config.margin > 200) {
      _config.margin = DEFAULTS.margin;
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
  function getTransparentBg() { return _config.transparentBg; }
  function getShowTitle() { return _config.showTitle; }
  function getMargin() { return _config.margin; }
  function getCellSizeOptions() { return [...CELL_SIZE_OPTIONS]; }
  function getMarginOptions() { return [...MARGIN_OPTIONS]; }

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

  function setTransparentBg(value) {
    _config.transparentBg = Boolean(value);
    _persist();
    _notify();
  }

  function setShowTitle(value) {
    _config.showTitle = Boolean(value);
    _persist();
    _notify();
  }

  function setMargin(value) {
    const v = Number(value);
    if (!isNaN(v) && v >= 0 && v <= 200) {
      _config.margin = v;
      _persist();
      _notify();
      return true;
    }
    return false;
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
    if ('transparentBg' in patch) {
      _config.transparentBg = Boolean(patch.transparentBg);
    }
    if ('showTitle' in patch) {
      _config.showTitle = Boolean(patch.showTitle);
    }
    if ('margin' in patch) {
      const v = Number(patch.margin);
      if (!isNaN(v) && v >= 0 && v <= 200) {
        _config.margin = v;
      }
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
    getTransparentBg,
    getShowTitle,
    getMargin,
    getCellSizeOptions,
    getMarginOptions,
    setCellSize,
    setShowGrid,
    setShowLegend,
    setTransparentBg,
    setShowTitle,
    setMargin,
    set,
    reset,
    subscribe
  };
})();
