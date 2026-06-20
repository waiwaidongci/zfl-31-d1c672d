const ThreadPanel = (function() {

  let containerEl = null;
  let listEl = null;
  let addBtn = null;
  let onThreadsChange = null;
  let _dragIndex = null;
  let _dragItemEl = null;

  function init(options = {}) {
    containerEl = options.container || null;
    onThreadsChange = options.onChange || null;

    if (!containerEl) {
      containerEl = document.querySelector("#threadPanel");
    }

    if (!containerEl) return;

    render();
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function render() {
    if (!containerEl) return;

    const threads = ThreadStore.getAll();
    const currentScheme = SchemeStore && SchemeStore.getActive ? SchemeStore.getActive() : null;
    const cells = currentScheme ? currentScheme.cells : [];
    const activeThreadId = currentScheme ? currentScheme.activeColor : null;

    const usedCounts = {};
    threads.forEach(t => {
      usedCounts[t.id] = cells.filter(v => v === t.id).length;
    });

    containerEl.innerHTML = `
      <div class="thread-panel-header">
        <h2 style="margin:0;">色线库</h2>
        <button id="threadAddBtn" class="secondary" style="padding:6px 10px;font-size:13px;">+ 新增</button>
      </div>
      <div class="thread-list" id="threadList">
        ${threads.map((t, i) => renderThreadItem(t, i, usedCounts[t.id] || 0, t.id === activeThreadId)).join("")}
      </div>
    `;

    listEl = containerEl.querySelector("#threadList");
    addBtn = containerEl.querySelector("#threadAddBtn");

    if (addBtn) {
      addBtn.addEventListener("click", handleAdd);
    }

    bindEvents();
  }

  function renderThreadItem(thread, index, usedCount, isActive) {
    return `
      <div class="thread-item ${isActive ? 'active' : ''}" data-id="${thread.id}" data-index="${index}" draggable="true">
        <div class="thread-drag-handle" title="拖动排序">⋮⋮</div>
        <div class="thread-color">
          <input type="color" class="thread-color-input" value="${thread.color}" data-action="color" title="点击修改颜色">
        </div>
        <div class="thread-info">
          <div class="thread-name" data-role="name">${escapeHtml(thread.name)}</div>
          <div class="thread-note" data-role="note">${escapeHtml(thread.note || "无备注")}</div>
        </div>
        <div class="thread-used">${usedCount} 格</div>
        <div class="thread-actions">
          <button class="ghost" data-action="edit" title="编辑">✎</button>
          <button class="ghost" data-action="moveUp" title="上移">↑</button>
          <button class="ghost" data-action="moveDown" title="下移">↓</button>
          <button class="danger" data-action="delete" title="删除">✕</button>
        </div>
      </div>
    `;
  }

  function bindEvents() {
    if (!listEl) return;

    listEl.querySelectorAll(".thread-item").forEach(item => {
      const id = item.dataset.id;
      const index = Number(item.dataset.index);

      item.addEventListener("click", (e) => {
        if (e.target.closest("[data-action]") || e.target.closest(".thread-drag-handle") || e.target.closest(".thread-color-input")) {
          return;
        }
        handleSelect(id);
      });

      item.querySelector('[data-action="color"]').addEventListener("input", (e) => {
        handleColorChange(id, e.target.value);
      });

      item.querySelector('[data-action="edit"]').addEventListener("click", (e) => {
        e.stopPropagation();
        openEditDialog(id);
      });

      item.querySelector('[data-action="moveUp"]').addEventListener("click", (e) => {
        e.stopPropagation();
        handleMoveUp(index);
      });

      item.querySelector('[data-action="moveDown"]').addEventListener("click", (e) => {
        e.stopPropagation();
        handleMoveDown(index);
      });

      item.querySelector('[data-action="delete"]').addEventListener("click", (e) => {
        e.stopPropagation();
        handleDelete(id);
      });

      item.addEventListener("dragstart", (e) => {
        _dragIndex = index;
        _dragItemEl = item;
        item.classList.add("dragging");
        e.dataTransfer.effectAllowed = "move";
      });

      item.addEventListener("dragend", () => {
        item.classList.remove("dragging");
        _dragIndex = null;
        _dragItemEl = null;
      });

      item.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      });

      item.addEventListener("dragenter", (e) => {
        e.preventDefault();
        if (_dragItemEl !== item) {
          item.classList.add("drag-over");
        }
      });

      item.addEventListener("dragleave", () => {
        item.classList.remove("drag-over");
      });

      item.addEventListener("drop", (e) => {
        e.preventDefault();
        item.classList.remove("drag-over");
        if (_dragIndex !== null && _dragIndex !== index) {
          handleReorder(_dragIndex, index);
        }
      });
    });
  }

  function handleSelect(id) {
    if (SchemeStore && SchemeStore.getActive && SchemeStore.update) {
      SchemeStore.update(SchemeStore.getActiveId(), { activeColor: id });
      render();
      triggerChange();
    }
  }

  function handleAdd() {
    const newThread = ThreadStore.add({
      name: "新色线",
      color: "#" + Math.floor(Math.random()*16777215).toString(16).padStart(6, "0"),
      note: ""
    });

    render();
    triggerChange();

    setTimeout(() => {
      const item = listEl.querySelector(`[data-id="${newThread.id}"]`);
      if (item) {
        startInlineRename(newThread.id, item);
      }
    }, 50);
  }

  function handleColorChange(id, color) {
    ThreadStore.update(id, { color });
    triggerChange();
  }

  function handleMoveUp(index) {
    if (index <= 0) return;
    ThreadStore.reorder(index, index - 1);
    render();
    triggerChange();
  }

  function handleMoveDown(index) {
    const threads = ThreadStore.getAll();
    if (index >= threads.length - 1) return;
    ThreadStore.reorder(index, index + 1);
    render();
    triggerChange();
  }

  function handleReorder(fromIndex, toIndex) {
    ThreadStore.reorder(fromIndex, toIndex);
    render();
    triggerChange();
  }

  function handleDelete(id) {
    const thread = ThreadStore.getById(id);
    if (!thread) return;

    const threads = ThreadStore.getAll();
    if (threads.length <= 1) {
      alert("至少需要保留一种色线。");
      return;
    }

    const isUsed = ThreadStore.isUsedInAnyScheme(id);
    const usedCount = getUsedCountInActiveScheme(id);

    if (isUsed && usedCount > 0) {
      showDeleteWithReplaceDialog(id, thread, usedCount);
    } else {
      if (confirm(`确定删除色线"${thread.name}"吗？`)) {
        ThreadStore.remove(id);
        render();
        triggerChange();
      }
    }
  }

  function getUsedCountInActiveScheme(id) {
    const scheme = SchemeStore && SchemeStore.getActive ? SchemeStore.getActive() : null;
    if (!scheme || !scheme.cells) return 0;
    return scheme.cells.filter(v => v === id).length;
  }

  function showDeleteWithReplaceDialog(id, thread, usedCount) {
    const otherThreads = ThreadStore.getAll().filter(t => t.id !== id);

    const overlay = document.createElement("div");
    overlay.className = "thread-dialog-overlay";
    overlay.style.cssText = `
      position: fixed; inset: 0; background: rgba(40, 32, 24, 0.5);
      display: flex; align-items: center; justify-content: center;
      z-index: 1000;
    `;

    const dialog = document.createElement("div");
    dialog.className = "thread-dialog";
    dialog.style.cssText = `
      background: #fffaf2; border: 1px solid #d9cdbc; border-radius: 12px;
      width: min(420px, 92vw);
      box-shadow: 0 10px 40px rgba(40, 32, 24, 0.25);
    `;

    dialog.innerHTML = `
      <div style="padding: 20px 24px;">
        <h3 style="margin: 0 0 12px; font-size: 18px;">删除色线</h3>
        <div style="background: #fdf0ee; border: 1px solid #f0c4be; border-radius: 8px; padding: 12px; margin-bottom: 16px;">
          <p style="margin: 0 0 4px; font-weight: 700; color: #a03a2e;">⚠️ 色线正在使用中</p>
          <p style="margin: 0; color: #76695e; font-size: 13px;">
            色线"${escapeHtml(thread.name)}"在当前方案中被使用了 <b>${usedCount}</b> 格。
            删除后这些格子将被替换为其他色线。
          </p>
        </div>
        <label style="display: block; margin-bottom: 8px; color: #76695e; font-size: 13px;">选择替换色线：</label>
        <select id="replaceThreadSelect" style="width:100%;padding:8px;border:1px solid #d9cdbc;border-radius:6px;">
          ${otherThreads.map(t => `
            <option value="${t.id}">
              <span style="display:inline-block;width:12px;height:12px;background:${t.color};"></span>
              ${escapeHtml(t.name)}
            </option>
          `).join("")}
        </select>
        <div style="display: flex; gap: 8px; margin-top: 20px;">
          <button id="cancelDeleteBtn" class="secondary" style="flex: 1; padding: 10px; border-radius: 8px; font-weight: 700;">取消</button>
          <button id="confirmDeleteBtn" style="flex: 1; padding: 10px; border-radius: 8px; background: #a03a2e; color: #fff; font-weight: 700;">确认删除</button>
        </div>
      </div>
    `;

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    overlay.querySelector("#cancelDeleteBtn").addEventListener("click", () => {
      overlay.remove();
    });

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.remove();
    });

    overlay.querySelector("#confirmDeleteBtn").addEventListener("click", () => {
      const replaceId = overlay.querySelector("#replaceThreadSelect").value;
      ThreadStore.remove(id, replaceId);
      overlay.remove();
      render();
      triggerChange();
    });
  }

  function openEditDialog(id) {
    const thread = ThreadStore.getById(id);
    if (!thread) return;

    const overlay = document.createElement("div");
    overlay.className = "thread-dialog-overlay";
    overlay.style.cssText = `
      position: fixed; inset: 0; background: rgba(40, 32, 24, 0.5);
      display: flex; align-items: center; justify-content: center;
      z-index: 1000;
    `;

    const dialog = document.createElement("div");
    dialog.className = "thread-dialog";
    dialog.style.cssText = `
      background: #fffaf2; border: 1px solid #d9cdbc; border-radius: 12px;
      width: min(420px, 92vw);
      box-shadow: 0 10px 40px rgba(40, 32, 24, 0.25);
    `;

    dialog.innerHTML = `
      <div style="padding: 20px 24px;">
        <h3 style="margin: 0 0 16px; font-size: 18px;">编辑色线</h3>
        <label style="display: block; margin-bottom: 5px; color: #76695e; font-size: 13px;">色线名称</label>
        <input type="text" id="threadNameInput" value="${escapeHtml(thread.name)}" style="width:100%;padding:8px;border:1px solid #d9cdbc;border-radius:6px;margin-bottom:12px;">
        <label style="display: block; margin-bottom: 5px; color: #76695e; font-size: 13px;">颜色</label>
        <input type="color" id="threadColorInput" value="${thread.color}" style="width:100%;height:40px;padding:0;border:1px solid #d9cdbc;border-radius:6px;margin-bottom:12px;cursor:pointer;">
        <label style="display: block; margin-bottom: 5px; color: #76695e; font-size: 13px;">线材备注</label>
        <textarea id="threadNoteInput" rows="3" style="width:100%;padding:8px;border:1px solid #d9cdbc;border-radius:6px;resize:vertical;">${escapeHtml(thread.note || "")}</textarea>
        <div style="display: flex; gap: 8px; margin-top: 20px;">
          <button id="cancelEditBtn" class="secondary" style="flex: 1; padding: 10px; border-radius: 8px; font-weight: 700;">取消</button>
          <button id="saveEditBtn" style="flex: 1; padding: 10px; border-radius: 8px; background: #8d3e37; color: #fff; font-weight: 700;">保存</button>
        </div>
      </div>
    `;

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    const nameInput = overlay.querySelector("#threadNameInput");
    nameInput.focus();
    nameInput.select();

    overlay.querySelector("#cancelEditBtn").addEventListener("click", () => {
      overlay.remove();
    });

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.remove();
    });

    function save() {
      const name = nameInput.value.trim();
      const color = overlay.querySelector("#threadColorInput").value;
      const note = overlay.querySelector("#threadNoteInput").value.trim();

      if (!name) {
        alert("色线名称不能为空");
        return;
      }

      ThreadStore.update(id, { name, color, note });
      overlay.remove();
      render();
      triggerChange();
    }

    overlay.querySelector("#saveEditBtn").addEventListener("click", save);

    nameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); save(); }
      else if (e.key === "Escape") { e.preventDefault(); overlay.remove(); }
    });
  }

  function startInlineRename(id, itemEl) {
    const nameEl = itemEl.querySelector('[data-role="name"]');
    const currentName = ThreadStore.getById(id)?.name || "";
    const input = document.createElement("input");
    input.type = "text";
    input.className = "thread-rename-input";
    input.value = currentName;
    nameEl.replaceWith(input);
    input.focus();
    input.select();

    const finish = (save) => {
      const val = input.value.trim();
      if (save && val) {
        ThreadStore.update(id, { name: val });
      }
      render();
      triggerChange();
    };

    input.addEventListener("blur", () => finish(true));
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); finish(true); }
      else if (e.key === "Escape") { e.preventDefault(); finish(false); }
    });
  }

  function triggerChange() {
    if (typeof onThreadsChange === "function") {
      onThreadsChange();
    }
  }

  function refresh() {
    render();
  }

  return {
    init,
    render,
    refresh
  };
})();
