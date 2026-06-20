const RiskConfig = (function() {

  const STORAGE_KEY = 'zfl31RiskConfig';

  const DEFAULTS = {
    highRiskThreshold: 0.62,
    mediumRiskThreshold: 0.35,
    countShortSegments: false,
    shortSegmentMaxLength: 2
  };

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
    if (typeof _config.highRiskThreshold !== 'number' || _config.highRiskThreshold <= _config.mediumRiskThreshold || _config.highRiskThreshold > 1) {
      _config.highRiskThreshold = DEFAULTS.highRiskThreshold;
    }
    if (typeof _config.mediumRiskThreshold !== 'number' || _config.mediumRiskThreshold <= 0 || _config.mediumRiskThreshold >= _config.highRiskThreshold) {
      _config.mediumRiskThreshold = DEFAULTS.mediumRiskThreshold;
    }
    if (typeof _config.countShortSegments !== 'boolean') {
      _config.countShortSegments = DEFAULTS.countShortSegments;
    }
    if (typeof _config.shortSegmentMaxLength !== 'number' || _config.shortSegmentMaxLength < 1 || _config.shortSegmentMaxLength > 10) {
      _config.shortSegmentMaxLength = DEFAULTS.shortSegmentMaxLength;
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

  function getHighRiskThreshold() { return _config.highRiskThreshold; }
  function getMediumRiskThreshold() { return _config.mediumRiskThreshold; }
  function getCountShortSegments() { return _config.countShortSegments; }
  function getShortSegmentMaxLength() { return _config.shortSegmentMaxLength; }

  function setHighRiskThreshold(value) {
    const v = Number(value);
    if (!isNaN(v) && v > _config.mediumRiskThreshold && v <= 1) {
      _config.highRiskThreshold = v;
      _persist();
      _notify();
      return true;
    }
    return false;
  }

  function setMediumRiskThreshold(value) {
    const v = Number(value);
    if (!isNaN(v) && v > 0 && v < _config.highRiskThreshold) {
      _config.mediumRiskThreshold = v;
      _persist();
    _notify();
      return true;
    }
    return false;
  }

  function setCountShortSegments(value) {
    _config.countShortSegments = Boolean(value);
    _persist();
    _notify();
  }

  function setShortSegmentMaxLength(value) {
    const v = Number(value);
    if (!isNaN(v) && v >= 1 && v <= 10) {
      _config.shortSegmentMaxLength = v;
      _persist();
      _notify();
      return true;
    }
    return false;
  }

  function set(patch) {
    if (!patch || typeof patch !== 'object') return;
    if ('highRiskThreshold' in patch) {
      const v = Number(patch.highRiskThreshold);
      if (!isNaN(v) && v > _config.mediumRiskThreshold && v <= 1) {
        _config.highRiskThreshold = v;
      }
    }
    if ('mediumRiskThreshold' in patch) {
      const v = Number(patch.mediumRiskThreshold);
      if (!isNaN(v) && v > 0 && v < _config.highRiskThreshold) {
        _config.mediumRiskThreshold = v;
      }
    }
    if ('countShortSegments' in patch) {
      _config.countShortSegments = Boolean(patch.countShortSegments);
    }
    if ('shortSegmentMaxLength' in patch) {
      const v = Number(patch.shortSegmentMaxLength);
      if (!isNaN(v) && v >= 1 && v <= 10) {
        _config.shortSegmentMaxLength = v;
      }
    }
    _validate();
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
    getHighRiskThreshold,
    getMediumRiskThreshold,
    getCountShortSegments,
    getShortSegmentMaxLength,
    setHighRiskThreshold,
    setMediumRiskThreshold,
    setCountShortSegments,
    setShortSegmentMaxLength,
    set,
    reset,
    subscribe
  };
})();
