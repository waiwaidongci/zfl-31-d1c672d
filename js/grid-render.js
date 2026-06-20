const GridRender = (function() {

  var _gridEl = null;
  var _statsEl = null;
  var _previewEl = null;
  var _riskEl = null;

  function init(options) {
    _gridEl = options.gridEl || null;
    _statsEl = options.statsEl || null;
    _previewEl = options.previewEl || null;
    _riskEl = options.riskEl || null;
  }

  function render() {
    var threads = ThreadStore.getAll();
    var activeThreadId = AppState.active;
    var isSelectMode = SelectionState.getMode() === "select";

    var renderOptions = {
      statsEl: _statsEl,
      previewEl: _previewEl,
      riskEl: _riskEl,
      gridEl: _gridEl,
      cells: AppState.cells,
      cols: AppState.cols,
      rows: AppState.rows,
      activeThreadId: activeThreadId,
      threads: threads,
      onThreadSelect: function(threadId) {
        AppState.active = threadId;
        render();
        EventBus.emit("grid:changed");
      },
      isCellSelected: function(i) {
        return SelectionState.isCellSelected(i, AppState.cols);
      },
      templatePreview: AppState.templatePreview
    };

    if (!isSelectMode) {
      renderOptions.onCellDown = function(i) { AppState.dragging = true; paint(i); };
      renderOptions.onCellEnter = function(i) { if (AppState.dragging) paint(i); };
    }

    StatsRender.renderAll(renderOptions);

    window.onpointerup = function() { AppState.dragging = false; };

    var builtinBlockBtns = document.querySelectorAll(".builtin-blocks [data-block]");
    builtinBlockBtns.forEach(function(btn) {
      btn.classList.toggle("active", btn.dataset.block === AppState.block);
    });

    if (typeof ProcessView !== "undefined" && ProcessView.isProcessView()) {
      ProcessView.refresh();
    }

    _updateBatchToolbarState();
  }

  function snapshot() {
    var undoArr = AppState.undo.slice();
    undoArr.push(AppState.cells.slice());
    if (undoArr.length > 50) undoArr.shift();
    SchemeStore.update(SchemeStore.getActiveId(), { undo: undoArr, redo: [] });
  }

  function paint(i) {
    var blockId = AppState.block;
    var tileMode = AppState.blockTileMode;
    var selection = SelectionState.getSelection();

    if (tileMode && selection && blockId && blockId.startsWith("b_")) {
      _paintTiled(selection);
      return;
    }

    if (!_canApplyBlock(i, blockId)) return;
    snapshot();
    AppState.templatePreview = null;
    if (typeof TemplateUI !== 'undefined' && typeof TemplateUI.clearPreviewState === 'function') {
      TemplateUI.clearPreviewState();
      if (typeof TemplateUI.render === 'function') {
        TemplateUI.render();
      }
    }
    var targets = _pattern(i);
    var newCells = AppState.cells.slice();
    targets.forEach(function(t) {
      if (t >= 0 && t < newCells.length) newCells[t] = AppState.active;
    });
    AppState.cells = newCells;
    render();
    EventBus.emit("grid:changed");
  }

  function _paintTiled(selection) {
    var blockId = AppState.block;
    if (!blockId || !blockId.startsWith("b_")) return;

    var transform = AppState.blockTransform;
    var bounds = BlockStore.getTransformedBlockBounds(blockId, transform);
    if (!bounds) return;

    var cols = AppState.cols;
    var rows = AppState.rows;
    var blockCols = bounds.cols;
    var blockRows = bounds.rows;

    if (blockCols <= 0 || blockRows <= 0) return;

    snapshot();
    AppState.templatePreview = null;
    if (typeof TemplateUI !== 'undefined' && typeof TemplateUI.clearPreviewState === 'function') {
      TemplateUI.clearPreviewState();
      if (typeof TemplateUI.render === 'function') {
        TemplateUI.render();
      }
    }

    var newCells = AppState.cells.slice();
    var offsets = BlockStore.getTransformedPatternOffsets(blockId, transform);
    var startX = selection.startX;
    var startY = selection.startY;
    var endX = selection.endX;
    var endY = selection.endY;

    for (var baseY = startY; baseY <= endY; baseY += blockRows) {
      for (var baseX = startX; baseX <= endX; baseX += blockCols) {
        offsets.forEach(function(o) {
          var targetX = baseX + o.dx;
          var targetY = baseY + o.dy;
          if (targetX >= startX && targetX <= endX && targetY >= startY && targetY <= endY) {
            var idx = _idx(targetX, targetY);
            if (idx !== null && idx >= 0 && idx < newCells.length) {
              newCells[idx] = AppState.active;
            }
          }
        });
      }
    }

    AppState.cells = newCells;
    render();
    EventBus.emit("grid:changed");
  }

  function _canApplyBlock(i, blockId) {
    var cols = AppState.cols, rows = AppState.rows;
    var x = i % cols, y = Math.floor(i / cols);

    if (!blockId || typeof blockId !== "string" || !blockId.startsWith("b_")) {
      return true;
    }

    var transform = AppState.blockTransform;
    var bounds = BlockStore.getTransformedBlockBounds(blockId, transform);
    if (!bounds) return true;

    var maxX = x + bounds.cols - 1;
    var maxY = y + bounds.rows - 1;

    return x >= 0 && maxX < cols && y >= 0 && maxY < rows;
  }

  function _pattern(i) {
    var cols = AppState.cols, rows = AppState.rows;
    var x = i % cols, y = Math.floor(i / cols);
    var blockId = AppState.block;

    if (blockId === "cross")
      return [i, _idx(x - 1, y), _idx(x + 1, y), _idx(x, y - 1), _idx(x, y + 1)].filter(function(v) { return v !== null; });
    if (blockId === "diamond")
      return [_idx(x, y - 1), _idx(x - 1, y), i, _idx(x + 1, y), _idx(x, y + 1)].filter(function(v) { return v !== null; });

    if (blockId && blockId.startsWith("b_")) {
      var transform = AppState.blockTransform;
      var offsets = BlockStore.getTransformedPatternOffsets(blockId, transform);
      return offsets
        .map(function(o) { return _idx(x + o.dx, y + o.dy); })
        .filter(function(v) { return v !== null; });
    }

    return [i];
  }

  function _idx(x, y) {
    return x < 0 || x >= AppState.cols || y < 0 || y >= AppState.rows ? null : y * AppState.cols + x;
  }

  function _clearTemplatePreview() {
    AppState.templatePreview = null;
    if (typeof TemplateUI !== 'undefined' && typeof TemplateUI.clearPreviewState === 'function') {
      TemplateUI.clearPreviewState();
      if (typeof TemplateUI.render === 'function') {
        TemplateUI.render();
      }
    }
  }

  function batchFillSelection() {
    var selection = SelectionState.getSelection();
    if (!selection) return;
    snapshot();
    _clearTemplatePreview();
    var newCells = BatchTransform.fillSelection(
      AppState.cells, AppState.cols, AppState.rows, selection, AppState.active
    );
    AppState.cells = newCells;
    render();
    EventBus.emit("grid:changed");
  }

  function batchClearSelection() {
    var selection = SelectionState.getSelection();
    if (!selection) return;
    var firstThreadId = ThreadStore.getFirstId();
    snapshot();
    _clearTemplatePreview();
    var newCells = BatchTransform.clearSelection(
      AppState.cells, AppState.cols, AppState.rows, selection, firstThreadId
    );
    AppState.cells = newCells;
    render();
    EventBus.emit("grid:changed");
  }

  function batchFlipHorizontal() {
    var selection = SelectionState.getSelection();
    if (!selection) return;
    snapshot();
    _clearTemplatePreview();
    var newCells = BatchTransform.flipHorizontal(
      AppState.cells, AppState.cols, AppState.rows, selection
    );
    AppState.cells = newCells;
    render();
    EventBus.emit("grid:changed");
  }

  function batchFlipVertical() {
    var selection = SelectionState.getSelection();
    if (!selection) return;
    snapshot();
    _clearTemplatePreview();
    var newCells = BatchTransform.flipVertical(
      AppState.cells, AppState.cols, AppState.rows, selection
    );
    AppState.cells = newCells;
    render();
    EventBus.emit("grid:changed");
  }

  function batchCopySelection() {
    SelectionState.copy(AppState.cells, AppState.cols);
  }

  function batchPasteSelection() {
    var clipboard = SelectionState.getClipboard();
    if (!clipboard) return;
    var selection = SelectionState.getSelection();
    var targetX = selection ? selection.startX : 0;
    var targetY = selection ? selection.startY : 0;
    snapshot();
    _clearTemplatePreview();
    var result = BatchTransform.pasteClipboard(
      AppState.cells, AppState.cols, AppState.rows, targetX, targetY, clipboard
    );
    AppState.cells = result.cells;
    SelectionState.setSelection(
      targetX, targetY,
      targetX + result.pasteW - 1, targetY + result.pasteH - 1,
      AppState.cols, AppState.rows
    );
    render();
    EventBus.emit("grid:changed");
  }

  function _updateBatchToolbarState() {
    var modeBtn = document.querySelector("#selectModeBtn");
    var fillBtn = document.querySelector("#fillSelBtn");
    var clearBtn = document.querySelector("#clearSelBtn");
    var flipHBtn = document.querySelector("#flipHSelBtn");
    var flipVBtn = document.querySelector("#flipVSelBtn");
    var copyBtn = document.querySelector("#copySelBtn");
    var pasteBtn = document.querySelector("#pasteSelBtn");
    var infoEl = document.querySelector("#selectionInfo");
    var sizeEl = document.querySelector("#selectionSize");

    var isSelectMode = SelectionState.getMode() === "select";
    var hasSel = SelectionState.hasSelection();
    var hasClip = SelectionState.hasClipboard();

    if (modeBtn) {
      modeBtn.textContent = isSelectMode ? "切换到绘画模式" : "切换到选择模式";
      modeBtn.classList.toggle("select-mode", isSelectMode);
      modeBtn.classList.toggle("paint-mode", !isSelectMode);
    }

    if (fillBtn) fillBtn.disabled = !hasSel;
    if (clearBtn) clearBtn.disabled = !hasSel;
    if (flipHBtn) flipHBtn.disabled = !hasSel;
    if (flipVBtn) flipVBtn.disabled = !hasSel;
    if (copyBtn) copyBtn.disabled = !hasSel;
    if (pasteBtn) pasteBtn.disabled = !hasClip;

    if (infoEl && sizeEl) {
      if (hasSel) {
        var size = SelectionState.getSelectionSize();
        sizeEl.textContent = size.width + "×" + size.height;
        infoEl.style.display = "block";
      } else {
        infoEl.style.display = "none";
      }
    }
  }

  return {
    init: init,
    render: render,
    snapshot: snapshot,
    paint: paint,
    batchFillSelection: batchFillSelection,
    batchClearSelection: batchClearSelection,
    batchFlipHorizontal: batchFlipHorizontal,
    batchFlipVertical: batchFlipVertical,
    batchCopySelection: batchCopySelection,
    batchPasteSelection: batchPasteSelection
  };
})();
