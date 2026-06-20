const SelectionState = (function() {

  let _selection = null;
  let _mode = 'paint';
  let _clipboard = null;
  let _listeners = [];

  function _notify() {
    _listeners.forEach(fn => {
      try { fn({ selection: _selection, mode: _mode, clipboard: _clipboard }); } catch (e) {}
    });
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

  function getMode() {
    return _mode;
  }

  function setMode(mode) {
    if (mode !== 'paint' && mode !== 'select') return;
    _mode = mode;
    if (mode === 'paint') {
      _selection = null;
    }
    _notify();
  }

  function toggleMode() {
    setMode(_mode === 'paint' ? 'select' : 'paint');
  }

  function getSelection() {
    return _selection;
  }

  function hasSelection() {
    return _selection !== null;
  }

  function setSelection(x1, y1, x2, y2, cols, rows) {
    const startX = Math.max(0, Math.min(x1, x2));
    const startY = Math.max(0, Math.min(y1, y2));
    const endX = Math.min(cols - 1, Math.max(x1, x2));
    const endY = Math.min(rows - 1, Math.max(y1, y2));

    if (startX > endX || startY > endY) {
      clearSelection();
      return;
    }

    _selection = { startX, startY, endX, endY, cols, rows };
    _notify();
  }

  function clearSelection() {
    if (_selection !== null) {
      _selection = null;
      _notify();
    }
  }

  function getSelectedCellIndices(cols, rows) {
    if (!_selection) return [];
    const indices = [];
    for (let y = _selection.startY; y <= _selection.endY; y++) {
      for (let x = _selection.startX; x <= _selection.endX; x++) {
        indices.push(y * cols + x);
      }
    }
    return indices;
  }

  function isCellSelected(i, cols) {
    if (!_selection) return false;
    const x = i % cols;
    const y = Math.floor(i / cols);
    return x >= _selection.startX && x <= _selection.endX &&
           y >= _selection.startY && y <= _selection.endY;
  }

  function getSelectionSize() {
    if (!_selection) return { width: 0, height: 0 };
    return {
      width: _selection.endX - _selection.startX + 1,
      height: _selection.endY - _selection.startY + 1
    };
  }

  function copy(cells, cols) {
    if (!_selection) return null;
    const { width, height } = getSelectionSize();
    const data = [];
    for (let y = 0; y < height; y++) {
      const row = [];
      for (let x = 0; x < width; x++) {
        const cellIndex = (_selection.startY + y) * cols + (_selection.startX + x);
        row.push(cells[cellIndex]);
      }
      data.push(row);
    }
    _clipboard = { data, width, height };
    _notify();
    return _clipboard;
  }

  function getClipboard() {
    return _clipboard;
  }

  function hasClipboard() {
    return _clipboard !== null;
  }

  function clearClipboard() {
    _clipboard = null;
    _notify();
  }

  function reset() {
    _selection = null;
    _clipboard = null;
    _mode = 'paint';
    _notify();
  }

  return {
    subscribe,
    getMode,
    setMode,
    toggleMode,
    getSelection,
    hasSelection,
    setSelection,
    clearSelection,
    getSelectedCellIndices,
    isCellSelected,
    getSelectionSize,
    copy,
    getClipboard,
    hasClipboard,
    clearClipboard,
    reset
  };
})();
