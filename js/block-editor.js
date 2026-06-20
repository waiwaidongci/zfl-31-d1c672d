const BlockEditor = (function() {

  let _overlay = null;
  let _dialog = null;
  let _currentBlockId = null;
  let _editingData = null;
  let _isDrawing = false;
  let _drawValue = true;
  let _onSaveCallback = null;

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function _ensureDialog() {
    if (_overlay && _overlay.parentNode) return;

    _overlay = document.createElement("div");
    _overlay.className = "block-editor-overlay";
    _overlay.innerHTML = `
      <div class="block-editor-dialog">
        <div class="block-editor-header">
          <h3 class="block-editor-title">纹样块编辑器</h3>
          <button class="block-editor-close" data-action="close">✕</button>
        </div>
        <div class="block-editor-body">
          <div class="block-editor-form">
            <div class="form-row">
              <label>纹样块名称</label>
              <input type="text" id="blockName" placeholder="输入纹样块名称" maxlength="20">
            </div>
            <div class="form-row form-row-inline">
              <div class="form-field">
                <label>宽度（列）</label>
                <input type="number" id="blockCols" min="1" max="12" value="3">
              </div>
              <div class="form-field">
                <label>高度（行）</label>
                <input type="number" id="blockRows" min="1" max="12" value="3">
              </div>
            </div>
            <div class="form-row">
              <label>绘制纹样（点击填色，再次点击清除）</label>
              <div class="block-editor-tools">
                <button class="secondary" data-tool="fill">全部填充</button>
                <button class="secondary" data-tool="clear">全部清除</button>
                <button class="secondary" data-tool="invert">反色</button>
              </div>
              <div class="block-editor-grid" id="blockEditorGrid"></div>
            </div>
            <div class="form-row">
              <label>预览效果</label>
              <div class="block-preview-small" id="blockPreview"></div>
            </div>
          </div>
        </div>
        <div class="block-editor-footer">
          <button class="secondary" data-action="cancel">取消</button>
          <button class="primary" data-action="save">保存</button>
        </div>
      </div>
    `;

    document.body.appendChild(_overlay);

    _bindDialogEvents();
  }

  function _bindDialogEvents() {
    _overlay.addEventListener("click", (e) => {
      if (e.target === _overlay) {
        close();
      }
    });

    _overlay.querySelectorAll("[data-action]").forEach(btn => {
      btn.addEventListener("click", () => {
        const action = btn.dataset.action;
        if (action === "close" || action === "cancel") {
          close();
        } else if (action === "save") {
          _save();
        }
      });
    });

    _overlay.querySelectorAll("[data-tool]").forEach(btn => {
      btn.addEventListener("click", () => {
        const tool = btn.dataset.tool;
        if (tool === "fill") {
          _editingData.pattern = _editingData.pattern.map(() => true);
          _renderGrid();
        } else if (tool === "clear") {
          _editingData.pattern = _editingData.pattern.map(() => false);
          _renderGrid();
        } else if (tool === "invert") {
          _editingData.pattern = _editingData.pattern.map(v => !v);
          _renderGrid();
        }
      });
    });

    const colsInput = _overlay.querySelector("#blockCols");
    const rowsInput = _overlay.querySelector("#blockRows");

    const syncSize = (force = false) => {
      if (!_editingData) return;
      if (!force && (colsInput.value === "" || rowsInput.value === "")) return;
      const newCols = Math.max(1, Math.min(12, parseInt(colsInput.value) || 1));
      const newRows = Math.max(1, Math.min(12, parseInt(rowsInput.value) || 1));
      colsInput.value = newCols;
      rowsInput.value = newRows;
      if (newCols !== _editingData.cols || newRows !== _editingData.rows) {
        _resizePattern(newCols, newRows);
      }
    };

    colsInput.addEventListener("input", () => syncSize());
    rowsInput.addEventListener("input", () => syncSize());
    colsInput.addEventListener("change", () => syncSize(true));
    rowsInput.addEventListener("change", () => syncSize(true));

    const gridEl = _overlay.querySelector("#blockEditorGrid");

    gridEl.addEventListener("pointerdown", (e) => {
      const cellEl = e.target.closest(".bcell");
      if (!cellEl) return;
      e.preventDefault();
      _isDrawing = true;
      const idx = parseInt(cellEl.dataset.idx);
      _drawValue = !_editingData.pattern[idx];
      _toggleCell(idx);
    });

    gridEl.addEventListener("pointerover", (e) => {
      if (!_isDrawing) return;
      const cellEl = e.target.closest(".bcell");
      if (!cellEl) return;
      const idx = parseInt(cellEl.dataset.idx);
      _setCell(idx, _drawValue);
    });

    document.addEventListener("pointerup", () => {
      _isDrawing = false;
    });
  }

  function _resizePattern(newCols, newRows) {
    const oldCols = _editingData.cols;
    const oldRows = _editingData.rows;
    const oldPattern = _editingData.pattern;
    const newPattern = Array(newCols * newRows).fill(false);
    const minCols = Math.min(oldCols, newCols);
    const minRows = Math.min(oldRows, newRows);

    for (let y = 0; y < minRows; y++) {
      for (let x = 0; x < minCols; x++) {
        const oldIdx = y * oldCols + x;
        const newIdx = y * newCols + x;
        newPattern[newIdx] = oldPattern[oldIdx] || false;
      }
    }

    _editingData.cols = newCols;
    _editingData.rows = newRows;
    _editingData.pattern = newPattern;
    _renderGrid();
  }

  function _toggleCell(idx) {
    _editingData.pattern[idx] = !_editingData.pattern[idx];
    _renderGrid();
  }

  function _setCell(idx, value) {
    if (_editingData.pattern[idx] !== value) {
      _editingData.pattern[idx] = value;
      _renderGrid();
    }
  }

  function _renderGrid() {
    const gridEl = _overlay.querySelector("#blockEditorGrid");
    const previewEl = _overlay.querySelector("#blockPreview");
    const { cols, rows, pattern } = _editingData;

    gridEl.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    gridEl.innerHTML = pattern.map((v, i) => `
      <div class="bcell ${v ? 'filled' : ''}" data-idx="${i}"></div>
    `).join("");

    previewEl.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    previewEl.innerHTML = pattern.map((v, i) => `
      <div class="pcell ${v ? 'filled' : ''}"></div>
    `).join("");
  }

  function _save() {
    const nameInput = _overlay.querySelector("#blockName");
    const colsInput = _overlay.querySelector("#blockCols");
    const rowsInput = _overlay.querySelector("#blockRows");
    const name = nameInput.value.trim() || "未命名纹样块";
    const newCols = Math.max(1, Math.min(12, parseInt(colsInput.value) || 1));
    const newRows = Math.max(1, Math.min(12, parseInt(rowsInput.value) || 1));

    if (newCols !== _editingData.cols || newRows !== _editingData.rows) {
      _resizePattern(newCols, newRows);
    }

    if (_currentBlockId) {
      BlockStore.update(_currentBlockId, {
        name,
        cols: _editingData.cols,
        rows: _editingData.rows,
        pattern: [..._editingData.pattern]
      });
    } else {
      BlockStore.create({
        name,
        cols: _editingData.cols,
        rows: _editingData.rows,
        pattern: [..._editingData.pattern]
      });
    }

    if (typeof _onSaveCallback === "function") {
      try { _onSaveCallback(); } catch (e) {}
    }

    close();
  }

  function open(options = {}) {
    _ensureDialog();
    _currentBlockId = options.blockId || null;
    _onSaveCallback = options.onSave || null;

    const nameInput = _overlay.querySelector("#blockName");
    const colsInput = _overlay.querySelector("#blockCols");
    const rowsInput = _overlay.querySelector("#blockRows");

    if (_currentBlockId) {
      const block = BlockStore.getById(_currentBlockId);
      if (block) {
        _editingData = {
          name: block.name,
          cols: block.cols,
          rows: block.rows,
          pattern: [...block.pattern]
        };
        _overlay.querySelector(".block-editor-title").textContent = "编辑纹样块";
      }
    } else {
      const defaultCols = options.cols || 3;
      const defaultRows = options.rows || 3;
      _editingData = {
        name: BlockStore.nextName(),
        cols: defaultCols,
        rows: defaultRows,
        pattern: BlockStore.createEmptyPattern(defaultCols, defaultRows)
      };
      _overlay.querySelector(".block-editor-title").textContent = "新建纹样块";
    }

    nameInput.value = _editingData.name;
    colsInput.value = _editingData.cols;
    rowsInput.value = _editingData.rows;

    _renderGrid();
    _overlay.style.display = "flex";

    setTimeout(() => nameInput.focus(), 50);
  }

  function close() {
    if (_overlay) {
      _overlay.style.display = "none";
    }
    _currentBlockId = null;
    _editingData = null;
    _isDrawing = false;
    _onSaveCallback = null;
  }

  return {
    open,
    close
  };
})();
