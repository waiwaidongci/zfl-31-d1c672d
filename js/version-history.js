const VersionHistory = (function() {

  var MAX_VERSIONS = 30;

  var _playback = {
    isPlaying: false,
    currentIndex: -1,
    speed: 1000,
    timerId: null,
    schemeId: null,
    direction: 'forward'
  };

  function uid() {
    return "v_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }

  function createSnapshot(schemeId, scheme) {
    if (!scheme) {
      scheme = SchemeStore.getById(schemeId);
    }
    if (!scheme) return null;

    var threads = ThreadStore.getAll();
    var colorStats = ThreadModel.computeColorStats(scheme.cells, threads);
    var riskRows = StatsRender.computeRiskRows(scheme.cells, scheme.cols, scheme.rows);

    var version = {
      id: uid(),
      timestamp: Date.now(),
      label: "",
      cells: scheme.cells.slice(),
      cols: scheme.cols,
      rows: scheme.rows,
      name: scheme.name,
      colorStats: colorStats.map(function(s) {
        return { id: s.id, name: s.name, color: s.color, note: s.note, count: s.count };
      }),
      riskRows: riskRows.slice(),
      thumbnailData: _generateThumbnailData(scheme.cells, scheme.cols, threads)
    };

    var patch = {};
    var versions = (scheme.versions || []).slice();
    versions.push(version);
    if (versions.length > MAX_VERSIONS) {
      versions = versions.slice(versions.length - MAX_VERSIONS);
    }
    patch.versions = versions;

    SchemeStore.update(schemeId, patch);
    EventBus.emit("version:created", schemeId, version);

    return version;
  }

  function _generateThumbnailData(cells, cols, threads) {
    var sorted = ThreadModel.sortByOrder(threads);
    var thumbSize = 6;
    var thumbCols = Math.min(cols, thumbSize);
    var thumbRows = Math.min(Math.ceil(cells.length / cols), thumbSize);
    var data = [];

    for (var y = 0; y < thumbRows; y++) {
      for (var x = 0; x < thumbCols; x++) {
        var srcIdx = y * cols + x;
        var cellId = srcIdx < cells.length ? cells[srcIdx] : null;
        var color = ThreadModel.getColorById(sorted, cellId) || "#cccccc";
        data.push(color);
      }
    }

    return { colors: data, cols: thumbCols, rows: thumbRows };
  }

  function getVersions(schemeId) {
    var scheme = SchemeStore.getById(schemeId);
    if (!scheme || !scheme.versions) return [];
    return scheme.versions.slice().sort(function(a, b) { return a.timestamp - b.timestamp; });
  }

  function getVersion(schemeId, versionId) {
    var versions = getVersions(schemeId);
    return versions.find(function(v) { return v.id === versionId; }) || null;
  }

  function restoreAsNewScheme(schemeId, versionId) {
    var version = getVersion(schemeId, versionId);
    if (!version) return null;

    var baseName = (version.name || "方案") + " (历史恢复)";
    var name = SchemeStore.nextName(baseName);
    var newScheme = SchemeStore.create(name, version.cols, version.rows);

    var threads = ThreadStore.getAll();
    var normalizedCells = _normalizeCells(version.cells, threads);

    SchemeStore.update(newScheme.id, {
      cells: normalizedCells,
      undo: [],
      redo: []
    });

    EventBus.emit("version:restored", newScheme.id, versionId);
    return newScheme;
  }

  function _normalizeCells(cells, threads) {
    var threadIds = {};
    threads.forEach(function(t) { threadIds[t.id] = true; });
    var firstId = threads.length > 0 ? threads[0].id : null;
    return cells.map(function(c) {
      if (typeof c === "string" && threadIds[c]) return c;
      return firstId;
    });
  }

  function deleteVersion(schemeId, versionId) {
    var scheme = SchemeStore.getById(schemeId);
    if (!scheme || !scheme.versions) return false;

    var versions = scheme.versions.filter(function(v) { return v.id !== versionId; });
    SchemeStore.update(schemeId, { versions: versions });
    EventBus.emit("version:deleted", schemeId, versionId);
    return true;
  }

  function updateLabel(schemeId, versionId, label) {
    var scheme = SchemeStore.getById(schemeId);
    if (!scheme || !scheme.versions) return false;

    var found = false;
    var versions = scheme.versions.map(function(v) {
      if (v.id === versionId) {
        found = true;
        return Object.assign({}, v, { label: label });
      }
      return v;
    });

    if (!found) return false;
    SchemeStore.update(schemeId, { versions: versions });
    return true;
  }

  function getExportData(schemeId) {
    var versions = getVersions(schemeId);
    return versions.map(function(v) {
      return {
        id: v.id,
        timestamp: v.timestamp,
        label: v.label || "",
        cols: v.cols,
        rows: v.rows,
        cells: v.cells,
        colorStats: v.colorStats,
        riskRows: v.riskRows,
        thumbnailData: v.thumbnailData
      };
    });
  }

  function importVersions(schemeId, importedVersions) {
    if (!Array.isArray(importedVersions)) return 0;
    var scheme = SchemeStore.getById(schemeId);
    if (!scheme) return 0;

    var existing = scheme.versions || [];
    var existingIds = {};
    existing.forEach(function(v) { existingIds[v.id] = true; });

    var added = 0;
    importedVersions.forEach(function(v) {
      if (v && v.id && !existingIds[v.id]) {
        existing.push(v);
        existingIds[v.id] = true;
        added++;
      }
    });

    existing.sort(function(a, b) { return a.timestamp - b.timestamp; });
    if (existing.length > MAX_VERSIONS) {
      existing = existing.slice(existing.length - MAX_VERSIONS);
    }

    SchemeStore.update(schemeId, { versions: existing });
    return added;
  }

  function getPlaybackState() {
    return {
      isPlaying: _playback.isPlaying,
      currentIndex: _playback.currentIndex,
      speed: _playback.speed,
      schemeId: _playback.schemeId,
      direction: _playback.direction
    };
  }

  function setPlaybackSpeed(ms) {
    _playback.speed = Math.max(100, Math.min(5000, Number(ms) || 1000));
    if (_playback.isPlaying) {
      _stopTimer();
      _startTimer();
    }
    EventBus.emit("playback:speedChanged", _playback.speed);
  }

  function startPlayback(schemeId, fromIndex) {
    var versions = getVersions(schemeId);
    if (versions.length === 0) return false;

    _playback.schemeId = schemeId;
    _playback.isPlaying = true;
    _playback.direction = 'forward';

    if (typeof fromIndex === 'number' && fromIndex >= 0 && fromIndex < versions.length) {
      _playback.currentIndex = fromIndex;
    } else {
      _playback.currentIndex = 0;
    }

    _startTimer();
    _emitPlaybackChange();
    return true;
  }

  function pausePlayback() {
    if (!_playback.isPlaying) return;
    _playback.isPlaying = false;
    _stopTimer();
    _emitPlaybackChange();
  }

  function resumePlayback() {
    if (_playback.isPlaying) return;
    if (!_playback.schemeId) return;
    var versions = getVersions(_playback.schemeId);
    if (versions.length === 0) return;

    _playback.isPlaying = true;
    _startTimer();
    _emitPlaybackChange();
  }

  function stopPlayback() {
    _playback.isPlaying = false;
    _playback.currentIndex = -1;
    _playback.schemeId = null;
    _stopTimer();
    _emitPlaybackChange();
  }

  function nextVersion(schemeId) {
    var sid = schemeId || _playback.schemeId;
    if (!sid) return null;
    var versions = getVersions(sid);
    if (versions.length === 0) return null;

    var nextIdx;
    if (_playback.currentIndex < 0) {
      nextIdx = 0;
    } else if (_playback.currentIndex >= versions.length - 1) {
      nextIdx = 0;
    } else {
      nextIdx = _playback.currentIndex + 1;
    }
    _playback.currentIndex = nextIdx;
    _playback.schemeId = sid;
    _emitPlaybackChange();
    return versions[nextIdx];
  }

  function prevVersion(schemeId) {
    var sid = schemeId || _playback.schemeId;
    if (!sid) return null;
    var versions = getVersions(sid);
    if (versions.length === 0) return null;

    var prevIdx;
    if (_playback.currentIndex <= 0) {
      prevIdx = versions.length - 1;
    } else {
      prevIdx = _playback.currentIndex - 1;
    }
    _playback.currentIndex = prevIdx;
    _playback.schemeId = sid;
    _emitPlaybackChange();
    return versions[prevIdx];
  }

  function goToVersion(schemeId, index) {
    var sid = schemeId || _playback.schemeId;
    if (!sid) return null;
    var versions = getVersions(sid);
    if (versions.length === 0) return null;

    var idx = Math.max(0, Math.min(versions.length - 1, Number(index) || 0));
    _playback.currentIndex = idx;
    _playback.schemeId = sid;
    _emitPlaybackChange();
    return versions[idx];
  }

  function getCurrentPlaybackVersion() {
    if (!_playback.schemeId || _playback.currentIndex < 0) return null;
    var versions = getVersions(_playback.schemeId);
    return versions[_playback.currentIndex] || null;
  }

  function _startTimer() {
    _stopTimer();
    _playback.timerId = setInterval(function() {
      var versions = getVersions(_playback.schemeId);
      if (!versions || versions.length === 0) {
        stopPlayback();
        return;
      }

      if (_playback.direction === 'forward') {
        if (_playback.currentIndex >= versions.length - 1) {
          pausePlayback();
          return;
        }
        _playback.currentIndex++;
      } else {
        if (_playback.currentIndex <= 0) {
          pausePlayback();
          return;
        }
        _playback.currentIndex--;
      }
      _emitPlaybackChange();
    }, _playback.speed);
  }

  function _stopTimer() {
    if (_playback.timerId) {
      clearInterval(_playback.timerId);
      _playback.timerId = null;
    }
  }

  function _emitPlaybackChange() {
    var version = getCurrentPlaybackVersion();
    EventBus.emit("playback:changed", {
      isPlaying: _playback.isPlaying,
      currentIndex: _playback.currentIndex,
      speed: _playback.speed,
      schemeId: _playback.schemeId,
      direction: _playback.direction,
      version: version
    });
  }

  function setPlaybackDirection(dir) {
    _playback.direction = dir === 'backward' ? 'backward' : 'forward';
    if (_playback.isPlaying) {
      _stopTimer();
      _startTimer();
    }
    EventBus.emit("playback:directionChanged", _playback.direction);
  }

  return {
    createSnapshot: createSnapshot,
    getVersions: getVersions,
    getVersion: getVersion,
    restoreAsNewScheme: restoreAsNewScheme,
    deleteVersion: deleteVersion,
    updateLabel: updateLabel,
    getExportData: getExportData,
    importVersions: importVersions,
    MAX_VERSIONS: MAX_VERSIONS,
    getPlaybackState: getPlaybackState,
    setPlaybackSpeed: setPlaybackSpeed,
    startPlayback: startPlayback,
    pausePlayback: pausePlayback,
    resumePlayback: resumePlayback,
    stopPlayback: stopPlayback,
    nextVersion: nextVersion,
    prevVersion: prevVersion,
    goToVersion: goToVersion,
    getCurrentPlaybackVersion: getCurrentPlaybackVersion,
    setPlaybackDirection: setPlaybackDirection
  };
})();
