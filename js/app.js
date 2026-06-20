var colors = ["#f7e7c4","#a6322d","#1f5f78","#d6a437","#355b38","#713d7b","#1e1b18","#e98c52"];
window.colors = colors;

const STORAGE_KEY = "zfl31Schemes";
const ACTIVE_KEY = "zfl31ActiveScheme";
const LEGACY_KEY = "zfl31Pattern";

function uid() {
  return "s_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
}

function defaultCells(cols, rows) {
  const firstId = ThreadStore.getFirstId();
  return Array(cols * rows).fill(firstId);
}

const SchemeStore = {
  _schemes: null,
  _activeId: null,

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this._schemes = JSON.parse(raw);
      } else {
        this._schemes = {};
      }
    } catch (e) {
      this._schemes = {};
    }
    this._activeId = localStorage.getItem(ACTIVE_KEY);
    this._migrateLegacy();
    if (Object.keys(this._schemes).length === 0) {
      this.create("默认方案", 18, 14);
    }
    if (!this._activeId || !this._schemes[this._activeId]) {
      this._activeId = Object.keys(this._schemes)[0];
      this._persistActive();
    }
  },

  _migrateLegacy() {
    const legacyRaw = localStorage.getItem(LEGACY_KEY);
    if (!legacyRaw) return;
    try {
      const legacy = JSON.parse(legacyRaw);
      if (!legacy || !Array.isArray(legacy.cells)) return;
      const existing = Object.values(this._schemes).find(s =>
        s.name === "默认方案" &&
        s.cols === (legacy.cols || 18) &&
        s.rows === (legacy.rows || 14) &&
        JSON.stringify(s.cells) === JSON.stringify(legacy.cells)
      );
      if (existing) {
        if (!this._activeId) this._activeId = existing.id;
        localStorage.removeItem(LEGACY_KEY);
        this._persistActive();
        return;
      }
      const id = uid();
      const now = Date.now();
      const threads = ThreadStore.getAll();
      const migratedCells = ThreadModel.migrateIndexToId(legacy.cells, threads);
      const firstThreadId = threads.length > 0 ? threads[0].id : null;
      this._schemes[id] = {
        id,
        name: "默认方案",
        cols: legacy.cols || 18,
        rows: legacy.rows || 14,
        cells: migratedCells,
        activeColor: firstThreadId,
        activeBlock: "dot",
        undo: [],
        redo: [],
        createdAt: now,
        updatedAt: now
      };
      if (!this._activeId) this._activeId = id;
      this._persist();
      this._persistActive();
      localStorage.removeItem(LEGACY_KEY);
    } catch (e) {}
  },

  _persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this._schemes));
  },

  _persistActive() {
    localStorage.setItem(ACTIVE_KEY, this._activeId);
  },

  getAll() {
    return Object.values(this._schemes).sort((a, b) => b.updatedAt - a.updatedAt);
  },

  getActive() {
    return this._schemes[this._activeId];
  },

  getActiveId() {
    return this._activeId;
  },

  setActive(id) {
    if (this._schemes[id]) {
      this._activeId = id;
      this._persistActive();
      return true;
    }
    return false;
  },

  update(id, patch) {
    if (!this._schemes[id]) return null;
    this._schemes[id] = { ...this._schemes[id], ...patch, updatedAt: Date.now() };
    this._persist();
    return this._schemes[id];
  },

  create(name, cols, rows) {
    const id = uid();
    const now = Date.now();
    const firstThreadId = ThreadStore.getFirstId();
    this._schemes[id] = {
      id,
      name: name || "新方案",
      cols: cols || 18,
      rows: rows || 14,
      cells: defaultCells(cols || 18, rows || 14),
      activeColor: firstThreadId,
      activeBlock: "dot",
      undo: [],
      redo: [],
      createdAt: now,
      updatedAt: now
    };
    this._persist();
    return this._schemes[id];
  },

  duplicate(id) {
    const src = this._schemes[id];
    if (!src) return null;
    const newId = uid();
    const now = Date.now();
    this._schemes[newId] = {
      ...JSON.parse(JSON.stringify(src)),
      id: newId,
      name: src.name + " 副本",
      undo: [],
      redo: [],
      createdAt: now,
      updatedAt: now
    };
    this._persist();
    return this._schemes[newId];
  },

  remove(id) {
    if (!this._schemes[id]) return false;
    delete this._schemes[id];
    if (Object.keys(this._schemes).length === 0) {
      this.create("默认方案", 18, 14);
    }
    if (this._activeId === id) {
      this._activeId = Object.keys(this._schemes)[0];
      this._persistActive();
    }
    this._persist();
    return true;
  },

  rename(id, name) {
    if (!this._schemes[id]) return null;
    this._schemes[id].name = name.trim() || "未命名方案";
    this._schemes[id].updatedAt = Date.now();
    this._persist();
    return this._schemes[id];
  },

  saveActive() {
    if (!this._activeId) return;
    this._schemes[this._activeId].updatedAt = Date.now();
    this._persist();
  },

  nextName(base = "新方案") {
    const names = new Set(Object.values(this._schemes).map(s => s.name));
    if (!names.has(base)) return base;
    let i = 2;
    while (names.has(`${base} ${i}`)) i++;
    return `${base} ${i}`;
  }
};

const AppState = {
  dragging: false,

  get cols() { return SchemeStore.getActive().cols; },
  set cols(v) { SchemeStore.update(SchemeStore.getActiveId(), { cols: v }); },

  get rows() { return SchemeStore.getActive().rows; },
  set rows(v) { SchemeStore.update(SchemeStore.getActiveId(), { rows: v }); },

  get cells() { return SchemeStore.getActive().cells; },
  set cells(v) { SchemeStore.update(SchemeStore.getActiveId(), { cells: v }); },

  get active() { return SchemeStore.getActive().activeColor; },
  set active(v) { SchemeStore.update(SchemeStore.getActiveId(), { activeColor: v }); },

  get block() { return SchemeStore.getActive().activeBlock; },
  set block(v) { SchemeStore.update(SchemeStore.getActiveId(), { activeBlock: v }); },

  get undo() { return SchemeStore.getActive().undo; },
  set undo(v) { SchemeStore.update(SchemeStore.getActiveId(), { undo: v }); },

  get redo() { return SchemeStore.getActive().redo; },
  set redo(v) { SchemeStore.update(SchemeStore.getActiveId(), { redo: v }); },

  resetHistory() {
    SchemeStore.update(SchemeStore.getActiveId(), { undo: [], redo: [] });
  }
};

let grid, stats, preview, risk, schemeListEl;

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function renderSchemeList() {
  const schemes = SchemeStore.getAll();
  const activeId = SchemeStore.getActiveId();
  if (schemes.length === 0) {
    schemeListEl.innerHTML = '<div class="empty-hint">暂无方案</div>';
    return;
  }
  schemeListEl.innerHTML = schemes.map(s => {
    const isActive = s.id === activeId;
    const filledCount = s.cells.filter(v => {
      const firstId = ThreadStore.getFirstId();
      return v !== firstId;
    }).length;
    const meta = `${s.cols}×${s.rows} · ${filledCount} 格已填`;
    return `
      <div class="scheme-item ${isActive ? 'active' : ''}" data-id="${s.id}">
        <div class="scheme-item-head">
          <span class="scheme-name" data-role="name">${escapeHtml(s.name)}</span>
          <div class="scheme-actions">
            <button class="ghost" data-action="rename" title="重命名">✎</button>
            <button class="ghost" data-action="duplicate" title="复制">⧉</button>
            <button class="danger" data-action="delete" title="删除">✕</button>
          </div>
        </div>
        <div class="scheme-meta">${meta}</div>
      </div>
    `;
  }).join("");

  schemeListEl.querySelectorAll(".scheme-item").forEach(item => {
    const id = item.dataset.id;

    item.addEventListener("click", (e) => {
      if (e.target.closest("[data-action]")) return;
      switchScheme(id);
    });

    item.querySelector('[data-action="rename"]').addEventListener("click", (e) => {
      e.stopPropagation();
      startRename(id, item);
    });

    item.querySelector('[data-action="duplicate"]').addEventListener("click", (e) => {
      e.stopPropagation();
      const newScheme = SchemeStore.duplicate(id);
      if (newScheme) {
        switchScheme(newScheme.id);
      }
    });

    item.querySelector('[data-action="delete"]').addEventListener("click", (e) => {
      e.stopPropagation();
      const sch = SchemeStore._schemes[id];
      const count = Object.keys(SchemeStore._schemes).length;
      const msg = count <= 1
        ? "只剩一个方案，删除后将自动创建新的默认方案。确定删除吗？"
        : `确定删除方案"${sch ? sch.name : ''}"吗？`;
      if (confirm(msg)) {
        SchemeStore.remove(id);
        refreshAll();
      }
    });
  });
}

function startRename(id, itemEl) {
  const nameEl = itemEl.querySelector('[data-role="name"]');
  const currentName = SchemeStore._schemes[id].name;
  const input = document.createElement("input");
  input.type = "text";
  input.className = "scheme-rename-input";
  input.value = currentName;
  nameEl.replaceWith(input);
  input.focus();
  input.select();

  const finish = (save) => {
    const val = input.value.trim();
    if (save && val) {
      SchemeStore.rename(id, val);
    }
    refreshAll();
  };

  input.addEventListener("blur", () => finish(true));
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); finish(true); }
    else if (e.key === "Escape") { e.preventDefault(); finish(false); }
  });
}

function switchScheme(id) {
  if (SchemeStore.setActive(id)) {
    document.querySelector("#cols").value = AppState.cols;
    document.querySelector("#rows").value = AppState.rows;
    if (typeof ProcessView !== "undefined" && ProcessView.isProcessView()) {
      ProcessView.switchToCanvas();
    }
    SelectionState.reset();
    GridInteraction.setGridSize(AppState.cols, AppState.rows);
    refreshAll();
  }
}

function refreshAll() {
  renderSchemeList();
  render();
  if (typeof ThreadPanel !== "undefined" && typeof ThreadPanel.refresh === 'function') {
    ThreadPanel.refresh();
  }
  if (typeof TemplateUI !== "undefined" && typeof TemplateUI.render === 'function') {
  }
}

function init(loadSaved = true) {
  grid = document.querySelector("#grid");
  stats = document.querySelector("#stats");
  preview = document.querySelector("#preview");
  risk = document.querySelector("#risk");
  schemeListEl = document.querySelector("#schemeList");

  ThreadStore.load();

  SchemeStore.load();
  document.querySelector("#cols").value = AppState.cols;
  document.querySelector("#rows").value = AppState.rows;

  GridInteraction.init({ gridEl: grid });
  GridInteraction.setGridSize(AppState.cols, AppState.rows);
  GridInteraction.bindDocumentEvents();

  grid.addEventListener('pointerdown', (e) => {
    if (SelectionState.getMode() === 'select') {
      GridInteraction.handlePointerDown(e);
    }
  });

  grid.addEventListener('click', (e) => {
    if (SelectionState.getMode() === 'select') {
      GridInteraction.handleGridClick(e);
    }
  });

  SelectionState.subscribe(() => {
    render();
    updateBatchToolbarState();
  });

  render();
  renderSchemeList();

  const threadPanelEl = document.querySelector("#threadPanel");
  if (threadPanelEl && ThreadPanel && typeof ThreadPanel.init === 'function') {
    ThreadPanel.init({
      container: threadPanelEl,
      onChange: () => {
        render();
        renderSchemeList();
        if (typeof ProcessView !== "undefined" && ProcessView.isProcessView()) {
          ProcessView.refresh();
        }
      }
    });
  }

  const templatePanel = document.querySelector("#templatePanel");
  if (templatePanel && TemplateUI && typeof TemplateUI.init === 'function') {
    TemplateUI.init(templatePanel);
  }

  if (typeof ProcessView !== "undefined") {
    ProcessView.init({ gridEl: grid });
  }
}

function render() {
  const threads = ThreadStore.getAll();
  const activeThreadId = AppState.active;
  const isSelectMode = SelectionState.getMode() === 'select';

  const renderOptions = {
    statsEl: stats,
    previewEl: preview,
    riskEl: risk,
    gridEl: grid,
    cells: AppState.cells,
    cols: AppState.cols,
    rows: AppState.rows,
    activeThreadId,
    threads,
    onThreadSelect: (threadId) => {
      AppState.active = threadId;
      render();
      renderSchemeList();
    },
    isCellSelected: (i) => SelectionState.isCellSelected(i, AppState.cols)
  };

  if (!isSelectMode) {
    renderOptions.onCellDown = (i) => { AppState.dragging = true; paint(i); };
    renderOptions.onCellEnter = (i) => { if (AppState.dragging) paint(i); };
  }

  StatsRender.renderAll(renderOptions);

  window.onpointerup = () => AppState.dragging = false;

  document.querySelectorAll("[data-block]").forEach(btn =>
    btn.classList.toggle("active", btn.dataset.block === AppState.block)
  );

  if (typeof ProcessView !== "undefined" && ProcessView.isProcessView()) {
    ProcessView.refresh();
  }

  updateBatchToolbarState();
}

function snapshot() {
  const undoArr = [...AppState.undo, [...AppState.cells]];
  if (undoArr.length > 50) undoArr.shift();
  SchemeStore.update(SchemeStore.getActiveId(), { undo: undoArr, redo: [] });
}

function paint(i) {
  snapshot();
  const targets = pattern(i);
  const newCells = [...AppState.cells];
  targets.forEach(t => { if (t >= 0 && t < newCells.length) newCells[t] = AppState.active; });
  AppState.cells = newCells;
  render();
  renderSchemeList();
}

function pattern(i) {
  const cols = AppState.cols, rows = AppState.rows;
  const x = i % cols, y = Math.floor(i / cols);
  if (AppState.block === "cross")
    return [i, idx(x-1,y), idx(x+1,y), idx(x,y-1), idx(x,y+1)].filter(v => v !== null);
  if (AppState.block === "diamond")
    return [idx(x,y-1), idx(x-1,y), i, idx(x+1,y), idx(x,y+1)].filter(v => v !== null);
  return [i];
}

function idx(x,y) {
  return x < 0 || x >= AppState.cols || y < 0 || y >= AppState.rows ? null : y * AppState.cols + x;
}

function updateBatchToolbarState() {
  const modeBtn = document.querySelector("#selectModeBtn");
  const fillBtn = document.querySelector("#fillSelBtn");
  const clearBtn = document.querySelector("#clearSelBtn");
  const flipHBtn = document.querySelector("#flipHSelBtn");
  const flipVBtn = document.querySelector("#flipVSelBtn");
  const copyBtn = document.querySelector("#copySelBtn");
  const pasteBtn = document.querySelector("#pasteSelBtn");
  const infoEl = document.querySelector("#selectionInfo");
  const sizeEl = document.querySelector("#selectionSize");

  const isSelectMode = SelectionState.getMode() === 'select';
  const hasSel = SelectionState.hasSelection();
  const hasClip = SelectionState.hasClipboard();

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
      const size = SelectionState.getSelectionSize();
      sizeEl.textContent = size.width + "×" + size.height;
      infoEl.style.display = "block";
    } else {
      infoEl.style.display = "none";
    }
  }
}

function batchFillSelection() {
  const selection = SelectionState.getSelection();
  if (!selection) return;
  snapshot();
  const newCells = BatchTransform.fillSelection(
    AppState.cells, AppState.cols, AppState.rows, selection, AppState.active
  );
  AppState.cells = newCells;
  render();
  renderSchemeList();
}

function batchClearSelection() {
  const selection = SelectionState.getSelection();
  if (!selection) return;
  const firstThreadId = ThreadStore.getFirstId();
  snapshot();
  const newCells = BatchTransform.clearSelection(
    AppState.cells, AppState.cols, AppState.rows, selection, firstThreadId
  );
  AppState.cells = newCells;
  render();
  renderSchemeList();
}

function batchFlipHorizontal() {
  const selection = SelectionState.getSelection();
  if (!selection) return;
  snapshot();
  const newCells = BatchTransform.flipHorizontal(
    AppState.cells, AppState.cols, AppState.rows, selection
  );
  AppState.cells = newCells;
  render();
  renderSchemeList();
}

function batchFlipVertical() {
  const selection = SelectionState.getSelection();
  if (!selection) return;
  snapshot();
  const newCells = BatchTransform.flipVertical(
    AppState.cells, AppState.cols, AppState.rows, selection
  );
  AppState.cells = newCells;
  render();
  renderSchemeList();
}

function batchCopySelection() {
  SelectionState.copy(AppState.cells, AppState.cols);
}

function batchPasteSelection() {
  const clipboard = SelectionState.getClipboard();
  if (!clipboard) return;
  const selection = SelectionState.getSelection();
  const targetX = selection ? selection.startX : 0;
  const targetY = selection ? selection.startY : 0;
  snapshot();
  const result = BatchTransform.pasteClipboard(
    AppState.cells, AppState.cols, AppState.rows, targetX, targetY, clipboard
  );
  AppState.cells = result.cells;
  SelectionState.setSelection(
    targetX, targetY,
    targetX + result.pasteW - 1, targetY + result.pasteH - 1,
    AppState.cols, AppState.rows
  );
  render();
  renderSchemeList();
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-block]").forEach(btn =>
    btn.onclick = () => { AppState.block = btn.dataset.block; render(); }
  );

  document.querySelector("#newBtn").onclick = () => {
    const c = Number(document.querySelector("#cols").value);
    const r = Number(document.querySelector("#rows").value);
    SchemeStore.update(SchemeStore.getActiveId(), {
      cols: c,
      rows: r,
      cells: defaultCells(c, r),
      undo: [],
      redo: []
    });
    SelectionState.reset();
    GridInteraction.setGridSize(c, r);
    render();
    renderSchemeList();
  };

  document.querySelector("#undoBtn").onclick = () => {
    const undoArr = AppState.undo;
    if (!undoArr.length) return;
    const last = undoArr.pop();
    SchemeStore.update(SchemeStore.getActiveId(), {
      undo: undoArr,
      redo: [...AppState.redo, [...AppState.cells]],
      cells: last
    });
    render();
    renderSchemeList();
  };

  document.querySelector("#redoBtn").onclick = () => {
    const redoArr = AppState.redo;
    if (!redoArr.length) return;
    const last = redoArr.pop();
    SchemeStore.update(SchemeStore.getActiveId(), {
      redo: redoArr,
      undo: [...AppState.undo, [...AppState.cells]],
      cells: last
    });
    render();
    renderSchemeList();
  };

  document.querySelector("#saveBtn").onclick = () => {
    SchemeStore.saveActive();
    renderSchemeList();
    if (typeof ThreadPanel !== "undefined" && ThreadPanel.refresh) {
      ThreadPanel.refresh();
    }
    const btn = document.querySelector("#saveBtn");
    const orig = btn.textContent;
    btn.textContent = "已保存 ✓";
    setTimeout(() => btn.textContent = orig, 1200);
  };

  document.querySelector("#exportBtn").onclick = () => {
    const active = SchemeStore.getActive();
    const threads = ThreadStore.getAll();
    const colorStats = ThreadModel.computeColorStats(active.cells, threads);
    const data = {
      name: active.name,
      cols: active.cols,
      rows: active.rows,
      cells: active.cells,
      threads: threads.map(t => ({
        id: t.id,
        name: t.name,
        color: t.color,
        note: t.note,
        order: t.order
      })),
      usage: colorStats.map(s => ({
        id: s.id,
        name: s.name,
        color: s.color,
        note: s.note,
        count: s.count
      }))
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = (active.name || "brocade-pattern") + ".json";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (typeof ImportDialog !== "undefined") {
    ImportDialog.init({});
    document.querySelector("#importBtn").onclick = () => {
      ImportDialog.open({
        onImport: (result) => {
          document.querySelector("#cols").value = AppState.cols;
          document.querySelector("#rows").value = AppState.rows;
          refreshAll();
        }
      });
    };
  }

  document.querySelector("#newSchemeBtn").onclick = () => {
    const c = Number(document.querySelector("#cols").value) || 18;
    const r = Number(document.querySelector("#rows").value) || 14;
    const newScheme = SchemeStore.create(SchemeStore.nextName(), c, r);
    SchemeStore.setActive(newScheme.id);
    document.querySelector("#cols").value = c;
    document.querySelector("#rows").value = r;
    SelectionState.reset();
    GridInteraction.setGridSize(c, r);
    refreshAll();
    const item = schemeListEl.querySelector(`[data-id="${newScheme.id}"]`);
    if (item) startRename(newScheme.id, item);
  };

  document.querySelector("#selectModeBtn").onclick = () => {
    SelectionState.toggleMode();
  };

  document.querySelector("#fillSelBtn").onclick = () => {
    batchFillSelection();
  };

  document.querySelector("#clearSelBtn").onclick = () => {
    batchClearSelection();
  };

  document.querySelector("#flipHSelBtn").onclick = () => {
    batchFlipHorizontal();
  };

  document.querySelector("#flipVSelBtn").onclick = () => {
    batchFlipVertical();
  };

  document.querySelector("#copySelBtn").onclick = () => {
    batchCopySelection();
  };

  document.querySelector("#pasteSelBtn").onclick = () => {
    batchPasteSelection();
  };

  init();

  let currentWorkspace = 'edit';

  function switchWorkspace(workspace) {
    currentWorkspace = workspace;

    const editWorkspace = document.querySelector("#editWorkspace");
    const compareWorkspace = document.querySelector("#compareWorkspace");
    const editBtn = document.querySelector("#workspaceEditBtn");
    const compareBtn = document.querySelector("#workspaceCompareBtn");
    const viewToggleBar = document.querySelector(".view-toggle-bar");

    if (workspace === 'edit') {
      editWorkspace.style.display = '';
      compareWorkspace.classList.remove('active');
      editBtn.classList.add('active');
      compareBtn.classList.remove('active');
      if (viewToggleBar) viewToggleBar.style.display = '';
    } else {
      editWorkspace.style.display = 'none';
      compareWorkspace.classList.add('active');
      editBtn.classList.remove('active');
      compareBtn.classList.add('active');
      if (viewToggleBar) viewToggleBar.style.display = 'none';

      if (typeof CompareSelector !== "undefined") {
        CompareSelector.refresh();
      }
    }
  }

  document.querySelector("#workspaceEditBtn").onclick = () => {
    switchWorkspace('edit');
  };

  document.querySelector("#workspaceCompareBtn").onclick = () => {
    switchWorkspace('compare');
  };

  if (typeof CompareSelector !== "undefined") {
    CompareSelector.init({
      container: document.querySelector("#compareSelector"),
      onStartCompare: (schemeA, schemeB) => {
        document.querySelector("#compareSelector").style.display = 'none';
        document.querySelector("#compareView").style.display = '';

        if (typeof CompareView !== "undefined") {
          CompareView.init({
            container: document.querySelector("#compareView"),
            onBack: () => {
              document.querySelector("#compareView").style.display = 'none';
              document.querySelector("#compareView").innerHTML = '';
              document.querySelector("#compareSelector").style.display = '';
              CompareSelector.refresh();
            }
          });
          CompareView.showCompare(schemeA, schemeB);
        }
      }
    });
  }
});
