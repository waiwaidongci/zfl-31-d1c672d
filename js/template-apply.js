const TemplateApplier = (function() {
  const MODE_OVERWRITE = "overwrite";
  const MODE_SKIP = "skip";

  function getThreadIdByIndex(index) {
    const threads = ThreadStore.getAll();
    if (index === 0) {
      return threads.length > 0 ? threads[0].id : null;
    }
    const sortedThreads = ThreadModel.sortByOrder(threads);
    if (index < sortedThreads.length) {
      return sortedThreads[index].id;
    }
    return sortedThreads.length > 0 ? sortedThreads[0].id : null;
  }

  function computeAllPositions(template, cols, rows) {
    if (template.isBorder && !template.isCorner) {
      return computeBorderPositions(template, cols, rows);
    } else if (template.isCorner) {
      return computeCornerPositions(template, cols, rows);
    } else if (template.isGround || template.repeatable) {
      return computeTiledPositions(template, cols, rows);
    } else {
      return computeCenteredPositions(template, cols, rows);
    }
  }

  function getPreviewPositions(template, options = {}) {
    const mode = options.mode || MODE_OVERWRITE;
    const writesBlank = template.writesBlank === true;
    const cols = AppState.cols;
    const rows = AppState.rows;
    const cells = AppState.cells;
    const firstThreadId = getThreadIdByIndex(0);

    const allPositions = computeAllPositions(template, cols, rows);
    const preview = [];

    allPositions.forEach(({ x, y, value }) => {
      const idx = y * cols + x;
      if (idx < 0 || idx >= cells.length) return;

      const threadId = getThreadIdByIndex(value);

      if (value === 0 && !writesBlank) return;

      if (mode === MODE_SKIP && cells[idx] !== firstThreadId) {
        return;
      }

      if (threadId && cells[idx] !== threadId) {
        preview.push({
          index: idx,
          threadId: threadId,
          isOverwrite: cells[idx] !== firstThreadId
        });
      }
    });

    return preview;
  }

  function applyTemplate(template, options = {}) {
    const mode = options.mode || MODE_OVERWRITE;
    const writesBlank = template.writesBlank === true;
    const cols = AppState.cols;
    const rows = AppState.rows;
    const newCells = [...AppState.cells];
    const firstThreadId = getThreadIdByIndex(0);

    const positions = computeAllPositions(template, cols, rows);

    let changed = false;
    positions.forEach(({ x, y, value }) => {
      const idx = y * cols + x;
      if (idx < 0 || idx >= newCells.length) return;

      const threadId = getThreadIdByIndex(value);

      if (value === 0 && !writesBlank) return;

      if (mode === MODE_SKIP && newCells[idx] !== firstThreadId) {
        return;
      }

      if (threadId && newCells[idx] !== threadId) {
        newCells[idx] = threadId;
        changed = true;
      }
    });

    if (changed) {
      snapshot();
      AppState.cells = newCells;
    }

    return changed;
  }

  function computeCenteredPositions(template, cols, rows) {
    const positions = [];
    const tCols = template.cols;
    const tRows = template.rows;

    const startX = Math.floor((cols - tCols) / 2);
    const startY = Math.floor((rows - tRows) / 2);

    for (let ty = 0; ty < tRows; ty++) {
      for (let tx = 0; tx < tCols; tx++) {
        const value = template.pattern[ty][tx];
        const x = startX + tx;
        const y = startY + ty;
        if (x >= 0 && x < cols && y >= 0 && y < rows) {
          positions.push({ x, y, value });
        }
      }
    }

    return positions;
  }

  function computeBorderPositions(template, cols, rows) {
    const positions = [];
    const tCols = template.cols;
    const tRows = template.rows;

    for (let x = 0; x < cols; x++) {
      for (let ty = 0; ty < tRows; ty++) {
        const tx = x % tCols;
        const value = template.pattern[ty][tx];
        if (value !== 0) {
          positions.push({ x, y: ty, value });
        }
      }
    }

    for (let x = 0; x < cols; x++) {
      for (let ty = 0; ty < tRows; ty++) {
        const tx = x % tCols;
        const value = template.pattern[ty][tx];
        if (value !== 0) {
          positions.push({ x, y: rows - 1 - ty, value });
        }
      }
    }

    for (let y = tRows; y < rows - tRows; y++) {
      for (let tx = 0; tx < tCols; tx++) {
        const ty = y % tRows;
        const value = template.pattern[ty][tx];
        if (value !== 0) {
          positions.push({ x: tx, y, value });
        }
      }
    }

    for (let y = tRows; y < rows - tRows; y++) {
      for (let tx = 0; tx < tCols; tx++) {
        const ty = y % tRows;
        const value = template.pattern[ty][tx];
        if (value !== 0) {
          positions.push({ x: cols - 1 - tx, y, value });
        }
      }
    }

    return positions;
  }

  function computeCornerPositions(template, cols, rows) {
    const positions = [];
    const tCols = template.cols;
    const tRows = template.rows;

    for (let ty = 0; ty < tRows; ty++) {
      for (let tx = 0; tx < tCols; tx++) {
        const value = template.pattern[ty][tx];
        if (value !== 0) {
          positions.push({ x: tx, y: ty, value });
          positions.push({ x: cols - 1 - tx, y: ty, value });
          positions.push({ x: tx, y: rows - 1 - ty, value });
          positions.push({ x: cols - 1 - tx, y: rows - 1 - ty, value });
        }
      }
    }

    return positions;
  }

  function computeTiledPositions(template, cols, rows) {
    const positions = [];
    const tCols = template.cols;
    const tRows = template.rows;
    const writesBlank = template.writesBlank === true;

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const tx = x % tCols;
        const ty = y % tRows;
        const value = template.pattern[ty][tx];
        if (value !== 0 || writesBlank) {
          positions.push({ x, y, value });
        }
      }
    }

    return positions;
  }

  function snapshot() {
    const undoArr = [...AppState.undo, [...AppState.cells]];
    if (undoArr.length > 50) undoArr.shift();
    SchemeStore.update(SchemeStore.getActiveId(), { undo: undoArr, redo: [] });
  }

  return {
    applyTemplate,
    getPreviewPositions,
    MODE_OVERWRITE,
    MODE_SKIP
  };
})();
