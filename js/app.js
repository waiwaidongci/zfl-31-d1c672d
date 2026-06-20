var colors = ["#f7e7c4","#a6322d","#1f5f78","#d6a437","#355b38","#713d7b","#1e1b18","#e98c52"];
window.colors = colors;

const STORAGE_KEY = "zfl31Schemes";
const ACTIVE_KEY = "zfl31ActiveScheme";
const LEGACY_KEY = "zfl31Pattern";

function uid() {
  return "s_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
}

function defaultCells(cols, rows) {
  return Array(cols * rows).fill(0);
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
      this._schemes[id] = {
        id,
        name: "默认方案",
        cols: legacy.cols || 18,
        rows: legacy.rows || 14,
        cells: legacy.cells,
        activeColor: 1,
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
    this._schemes[id] = {
      id,
      name: name || "新方案",
      cols: cols || 18,
      rows: rows || 14,
      cells: defaultCells(cols || 18, rows || 14),
      activeColor: 1,
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

let grid, palette, stats, preview, risk, schemeListEl;

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
    const meta = `${s.cols}×${s.rows} · ${s.cells.filter(v => v !== 0).length} 格已填`;
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
        SchemeStore.setActive(newScheme.id);
        refreshAll();
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
    refreshAll();
  }
}

function refreshAll() {
  renderSchemeList();
  render();
  if (typeof TemplateUI !== "undefined" && typeof TemplateUI.render === 'function') {
  }
}

function init(loadSaved = true) {
  grid = document.querySelector("#grid");
  palette = document.querySelector("#palette");
  stats = document.querySelector("#stats");
  preview = document.querySelector("#preview");
  risk = document.querySelector("#risk");
  schemeListEl = document.querySelector("#schemeList");

  SchemeStore.load();
  document.querySelector("#cols").value = AppState.cols;
  document.querySelector("#rows").value = AppState.rows;
  render();
  renderSchemeList();

  const templatePanel = document.querySelector("#templatePanel");
  if (templatePanel && TemplateUI && typeof TemplateUI.init === 'function') {
    TemplateUI.init(templatePanel);
  }

  if (typeof ProcessView !== "undefined") {
    ProcessView.init({ gridEl: grid });
  }
}

function render() {
  palette.innerHTML = colors.map((c, i) =>
    '<button class="swatch '+(i===AppState.active?'active':'')+'" data-color="'+i+'" style="background:'+c+'"></button>'
  ).join("");
  palette.querySelectorAll("[data-color]").forEach(el =>
    el.onclick = () => { AppState.active = Number(el.dataset.color); render(); renderSchemeList(); }
  );
  grid.style.gridTemplateColumns = "repeat("+AppState.cols+", 1fr)";
  grid.innerHTML = AppState.cells.map((v, i) =>
    '<div class="cell" data-i="'+i+'" style="background:'+colors[v]+'"></div>'
  ).join("");
  grid.querySelectorAll(".cell").forEach(el => {
    el.onpointerdown = () => { AppState.dragging = true; paint(Number(el.dataset.i)); };
    el.onpointerenter = () => { if (AppState.dragging) paint(Number(el.dataset.i)); };
  });
  window.onpointerup = () => AppState.dragging = false;
  document.querySelectorAll("[data-block]").forEach(btn =>
    btn.classList.toggle("active", btn.dataset.block === AppState.block)
  );
  renderStats();
  if (typeof ProcessView !== "undefined" && ProcessView.isProcessView()) {
    ProcessView.refresh();
  }
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

function renderStats() {
  const counts = colors.map((_, i) => AppState.cells.filter(v => v === i).length);
  stats.innerHTML = counts.map((n, i) =>
    '<div class="stat"><span><span style="display:inline-block;width:14px;height:14px;background:'+colors[i]+'"></span> 色线'+i+'</span><b>'+n+'</b></div>'
  ).join("");
  preview.innerHTML = Array.from({length: 36}, (_, i) =>
    '<div class="mini" style="background:'+colors[AppState.cells[(i % 6) + Math.floor(i / 6) * AppState.cols] || colors[0]]+'"></div>'
  ).join("");
  var riskRows = [];
  if (typeof ProcessCalc !== "undefined") {
    var steps = ProcessCalc.computeAllSteps(AppState.cells, AppState.cols, AppState.rows);
    var summary = ProcessCalc.computeSummary(steps);
    riskRows = summary.highRiskRows;
  } else {
    for (let y = 0; y < AppState.rows; y++) {
      let switches = 0;
      for (let x = 1; x < AppState.cols; x++)
        if (AppState.cells[y*AppState.cols+x] !== AppState.cells[y*AppState.cols+x-1]) switches++;
      if (switches > AppState.cols * .62) riskRows.push(y + 1);
    }
  }
  risk.innerHTML = riskRows.length
    ? '<p class="warning">第'+riskRows.join("、")+'行换色过密，可能断线。</p>'
    : '<p>暂无明显断线风险。</p>';
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
    const btn = document.querySelector("#saveBtn");
    const orig = btn.textContent;
    btn.textContent = "已保存 ✓";
    setTimeout(() => btn.textContent = orig, 1200);
  };

  document.querySelector("#exportBtn").onclick = () => {
    const active = SchemeStore.getActive();
    const data = {
      name: active.name,
      cols: active.cols,
      rows: active.rows,
      cells: active.cells,
      usage: colors.map((color, i) => ({
        color, count: active.cells.filter(v => v === i).length
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
    ImportDialog.init({ colors });
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
    refreshAll();
    const item = schemeListEl.querySelector(`[data-id="${newScheme.id}"]`);
    if (item) startRename(newScheme.id, item);
  };

  init();
});
