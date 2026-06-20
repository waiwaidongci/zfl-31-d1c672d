const GridInteraction = (function() {

  let _gridEl = null;
  let _cols = 0;
  let _rows = 0;
  let _isDragging = false;
  let _dragStartX = -1;
  let _dragStartY = -1;
  let _marqueeEl = null;
  let _onSelectionChange = null;

  function init(options = {}) {
    _gridEl = options.gridEl || null;
    _onSelectionChange = options.onSelectionChange || null;

    if (!_gridEl) return;

    _ensureMarquee();
  }

  function setGridSize(cols, rows) {
    _cols = cols;
    _rows = rows;
  }

  function _ensureMarquee() {
    if (!_gridEl) return;
    if (_marqueeEl && _marqueeEl.parentNode === _gridEl) return;

    _marqueeEl = document.createElement('div');
    _marqueeEl.className = 'selection-marquee';
    _marqueeEl.style.cssText = `
      position: absolute;
      border: 2px dashed #8d3e37;
      background: rgba(141, 62, 55, 0.12);
      pointer-events: none;
      z-index: 10;
      display: none;
      box-sizing: border-box;
    `;
    _gridEl.style.position = 'relative';
    _gridEl.appendChild(_marqueeEl);
  }

  function _getCellFromPoint(clientX, clientY) {
    if (!_gridEl || _cols <= 0 || _rows <= 0) return null;

    const cells = _gridEl.querySelectorAll('.cell');
    if (cells.length === 0) return null;

    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      const rect = cell.getBoundingClientRect();
      if (clientX >= rect.left && clientX <= rect.right &&
          clientY >= rect.top && clientY <= rect.bottom) {
        return { x: i % _cols, y: Math.floor(i / _cols), index: i };
      }
    }
    return null;
  }

  function _updateMarquee(startCell, endCell) {
    if (!_gridEl) return;
    _ensureMarquee();
    if (!_marqueeEl) return;

    const cells = _gridEl.querySelectorAll('.cell');
    if (cells.length === 0) return;

    const startIdx = startCell.y * _cols + startCell.x;
    const endIdx = endCell.y * _cols + endCell.x;

    const firstIdx = Math.min(startIdx, endIdx);
    const lastIdx = Math.max(startIdx, endIdx);

    const firstCell = cells[firstIdx];
    const lastCell = cells[lastIdx];
    if (!firstCell || !lastCell) return;

    const gridRect = _gridEl.getBoundingClientRect();
    const firstRect = firstCell.getBoundingClientRect();
    const lastRect = lastCell.getBoundingClientRect();

    const left = firstRect.left - gridRect.left;
    const top = firstRect.top - gridRect.top;
    const width = lastRect.right - firstRect.left;
    const height = lastRect.bottom - firstRect.top;

    _marqueeEl.style.left = left + 'px';
    _marqueeEl.style.top = top + 'px';
    _marqueeEl.style.width = width + 'px';
    _marqueeEl.style.height = height + 'px';
    _marqueeEl.style.display = 'block';
  }

  function _hideMarquee() {
    if (_marqueeEl) {
      _marqueeEl.style.display = 'none';
    }
  }

  function handlePointerDown(e) {
    if (SelectionState.getMode() !== 'select') return false;
    if (!_gridEl) return false;

    const cell = _getCellFromPoint(e.clientX, e.clientY);
    if (!cell) return false;

    _isDragging = true;
    _dragStartX = cell.x;
    _dragStartY = cell.y;

    SelectionState.setSelection(cell.x, cell.y, cell.x, cell.y, _cols, _rows);
    _updateMarquee({ x: cell.x, y: cell.y }, { x: cell.x, y: cell.y });

    e.preventDefault();
    return true;
  }

  function handlePointerMove(e) {
    if (!_isDragging || SelectionState.getMode() !== 'select') return false;
    if (!_gridEl) return false;

    const cell = _getCellFromPoint(e.clientX, e.clientY);
    if (!cell) return false;

    SelectionState.setSelection(_dragStartX, _dragStartY, cell.x, cell.y, _cols, _rows);
    _updateMarquee({ x: _dragStartX, y: _dragStartY }, { x: cell.x, y: cell.y });

    return true;
  }

  function handlePointerUp(e) {
    if (!_isDragging) return false;
    _isDragging = false;
    _hideMarquee();
    return true;
  }

  function handleGridClick(e) {
    if (SelectionState.getMode() !== 'select') return false;
    if (!_gridEl) return false;

    const cell = _getCellFromPoint(e.clientX, e.clientY);
    if (!cell) {
      SelectionState.clearSelection();
      return true;
    }
    return true;
  }

  function bindGridEvents(options = {}) {
    const { gridEl, cols, rows, onSelectionChange } = options;

    if (gridEl) _gridEl = gridEl;
    if (cols != null) _cols = cols;
    if (rows != null) _rows = rows;
    if (onSelectionChange) _onSelectionChange = onSelectionChange;

    if (!_gridEl) return;

    _ensureMarquee();

    _gridEl.addEventListener('pointerdown', _onGridPointerDown);
    _gridEl.addEventListener('click', _onGridClick);
  }

  function _onGridPointerDown(e) {
    handlePointerDown(e);
  }

  function _onGridClick(e) {
    handleGridClick(e);
  }

  function bindDocumentEvents() {
    document.addEventListener('pointermove', _onDocPointerMove);
    document.addEventListener('pointerup', _onDocPointerUp);
  }

  function _onDocPointerMove(e) {
    handlePointerMove(e);
  }

  function _onDocPointerUp(e) {
    handlePointerUp(e);
  }

  function unbindAll() {
    if (_gridEl) {
      _gridEl.removeEventListener('pointerdown', _onGridPointerDown);
      _gridEl.removeEventListener('click', _onGridClick);
    }
    document.removeEventListener('pointermove', _onDocPointerMove);
    document.removeEventListener('pointerup', _onDocPointerUp);
    if (_marqueeEl && _marqueeEl.parentNode) {
      _marqueeEl.parentNode.removeChild(_marqueeEl);
      _marqueeEl = null;
    }
  }

  function refreshSelectionHighlight() {
    if (!_gridEl) return;

    const cells = _gridEl.querySelectorAll('.cell');
    const selection = SelectionState.getSelection();

    cells.forEach((cell, i) => {
      const x = i % _cols;
      const y = Math.floor(i / _cols);
      const isSelected = selection &&
        x >= selection.startX && x <= selection.endX &&
        y >= selection.startY && y <= selection.endY;
      cell.classList.toggle('selected', isSelected);
    });
  }

  return {
    init,
    setGridSize,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleGridClick,
    bindGridEvents,
    bindDocumentEvents,
    unbindAll,
    refreshSelectionHighlight
  };
})();
