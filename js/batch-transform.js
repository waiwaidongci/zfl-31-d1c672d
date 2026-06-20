const BatchTransform = (function() {

  function _clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  function fillSelection(cells, cols, rows, selection, threadId) {
    if (!selection) return cells;
    const newCells = [...cells];
    const { startX, startY, endX, endY } = selection;
    for (let y = startY; y <= endY; y++) {
      for (let x = startX; x <= endX; x++) {
        const idx = y * cols + x;
        if (idx >= 0 && idx < newCells.length) {
          newCells[idx] = threadId;
        }
      }
    }
    return newCells;
  }

  function clearSelection(cells, cols, rows, selection, defaultThreadId) {
    return fillSelection(cells, cols, rows, selection, defaultThreadId);
  }

  function flipHorizontal(cells, cols, rows, selection) {
    if (!selection) return cells;
    const newCells = [...cells];
    const { startX, startY, endX, endY } = selection;
    const width = endX - startX + 1;
    for (let y = startY; y <= endY; y++) {
      for (let x = 0; x < Math.floor(width / 2); x++) {
        const leftIdx = y * cols + (startX + x);
        const rightIdx = y * cols + (endX - x);
        const tmp = newCells[leftIdx];
        newCells[leftIdx] = newCells[rightIdx];
        newCells[rightIdx] = tmp;
      }
    }
    return newCells;
  }

  function flipVertical(cells, cols, rows, selection) {
    if (!selection) return cells;
    const newCells = [...cells];
    const { startX, startY, endX, endY } = selection;
    const height = endY - startY + 1;
    for (let x = startX; x <= endX; x++) {
      for (let y = 0; y < Math.floor(height / 2); y++) {
        const topIdx = (startY + y) * cols + x;
        const bottomIdx = (endY - y) * cols + x;
        const tmp = newCells[topIdx];
        newCells[topIdx] = newCells[bottomIdx];
        newCells[bottomIdx] = tmp;
      }
    }
    return newCells;
  }

  function copySelection(cells, cols, selection) {
    if (!selection) return null;
    const { startX, startY, endX, endY } = selection;
    const width = endX - startX + 1;
    const height = endY - startY + 1;
    const data = [];
    for (let y = 0; y < height; y++) {
      const row = [];
      for (let x = 0; x < width; x++) {
        const idx = (startY + y) * cols + (startX + x);
        row.push(cells[idx]);
      }
      data.push(row);
    }
    return { data, width, height };
  }

  function pasteClipboard(cells, cols, rows, targetX, targetY, clipboard) {
    if (!clipboard || !clipboard.data) return cells;
    const newCells = [...cells];
    const { data, width: clipW, height: clipH } = clipboard;
    const pasteW = Math.min(clipW, cols - targetX);
    const pasteH = Math.min(clipH, rows - targetY);
    if (pasteW <= 0 || pasteH <= 0) return cells;
    for (let y = 0; y < pasteH; y++) {
      for (let x = 0; x < pasteW; x++) {
        const targetIdx = (targetY + y) * cols + (targetX + x);
        if (targetIdx >= 0 && targetIdx < newCells.length) {
          newCells[targetIdx] = data[y][x];
        }
      }
    }
    return { cells: newCells, pasteW, pasteH };
  }

  function pasteFromSelection(cells, cols, rows, selection, targetX, targetY) {
    const clipboard = copySelection(cells, cols, selection);
    if (!clipboard) return cells;
    return pasteClipboard(cells, cols, rows, targetX, targetY, clipboard);
  }

  return {
    fillSelection,
    clearSelection,
    flipHorizontal,
    flipVertical,
    copySelection,
    pasteClipboard,
    pasteFromSelection
  };
})();
