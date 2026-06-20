const ImportDialog = (function() {

  let dialogEl = null;
  let overlayEl = null;
  let parsedData = null;
  let validationResult = null;
  let onImportCallback = null;
  let fileInputEl = null;
  let conflictResolutions = null;
  let currentThreadsSnapshot = null;

  function init(options = {}) {
    createDialog();
  }

  function createDialog() {
    if (dialogEl) return;

    overlayEl = document.createElement("div");
    overlayEl.className = "import-overlay";
    overlayEl.style.cssText = `
      position: fixed; inset: 0; background: rgba(40, 32, 24, 0.5);
      display: none; align-items: center; justify-content: center;
      z-index: 1000;
    `;

    dialogEl = document.createElement("div");
    dialogEl.className = "import-dialog";
    dialogEl.style.cssText = `
      background: #fffaf2; border: 1px solid #d9cdbc; border-radius: 12px;
      width: min(520px, 92vw); max-height: 86vh; overflow-y: auto;
      box-shadow: 0 10px 40px rgba(40, 32, 24, 0.25);
    `;

    overlayEl.appendChild(dialogEl);
    document.body.appendChild(overlayEl);

    overlayEl.addEventListener("click", (e) => {
      if (e.target === overlayEl) close();
    });
  }

  function open(options = {}) {
    createDialog();
    onImportCallback = options.onImport || null;
    parsedData = null;
    validationResult = null;
    renderFilePicker();
    overlayEl.style.display = "flex";
  }

  function close() {
    overlayEl.style.display = "none";
    parsedData = null;
    validationResult = null;
    onImportCallback = null;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function renderFilePicker() {
    dialogEl.innerHTML = `
      <div style="padding: 20px 24px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <h3 style="margin: 0; font-size: 18px;">导入纹样方案</h3>
          <button class="ghost" id="importCloseBtn" style="font-size: 18px; padding: 4px 10px;">✕</button>
        </div>
        <p style="color: #76695e; font-size: 13px; margin: 0 0 16px;">
          选择之前导出的 .json 纹样文件，可预览方案详情后决定导入方式。
        </p>
        <div style="border: 2px dashed #d9cdbc; border-radius: 8px; padding: 32px 16px; text-align: center; background: #fff;">
          <div style="font-size: 36px; margin-bottom: 8px;">📄</div>
          <p style="margin: 0 0 12px; color: #76695e;">点击下方按钮选择 JSON 文件</p>
          <button id="importSelectBtn" style="background: #8d3e37; color: #fff; padding: 10px 24px; border-radius: 8px; font-weight: 700;">
            选择文件
          </button>
          <input type="file" id="importFileInput" accept=".json,application/json" style="display: none;">
        </div>
      </div>
    `;

    dialogEl.querySelector("#importCloseBtn").addEventListener("click", close);
    dialogEl.querySelector("#importSelectBtn").addEventListener("click", () => {
      dialogEl.querySelector("#importFileInput").click();
    });

    fileInputEl = dialogEl.querySelector("#importFileInput");
    fileInputEl.addEventListener("change", handleFileSelect);
  }

  function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    parseAndValidate(file);
  }

  async function parseAndValidate(file) {
    renderLoading();

    try {
      parsedData = await ImportParser.parseFile(file);

      const currentScheme = typeof SchemeStore !== "undefined" && SchemeStore.getActive
        ? SchemeStore.getActive()
        : null;

      currentThreadsSnapshot = ThreadStore && ThreadStore.getAll ? ThreadStore.getAll() : [];

      const threads = parsedData.threads && parsedData.threads.length > 0
        ? parsedData.threads
        : currentThreadsSnapshot;

      validationResult = ImportValidator.validate(parsedData, {
        currentScheme,
        threads,
        schemeStore: typeof SchemeStore !== "undefined" ? SchemeStore : null,
        currentThreads: currentThreadsSnapshot
      });

      if (validationResult.threadConflicts && validationResult.threadConflicts.length > 0) {
        conflictResolutions = validationResult.threadConflicts.map((c, idx) => ({
          fileThreadId: c.fileThread.id,
          resolution: "use_file",
          primaryMatchIndex: c.primaryMatchIndex != null ? c.primaryMatchIndex : 0,
          customNewId: null
        }));
      } else {
        conflictResolutions = null;
      }

      renderPreview();
    } catch (err) {
      renderError(err);
    }
  }

  function renderLoading() {
    dialogEl.innerHTML = `
      <div style="padding: 40px 24px; text-align: center;">
        <div style="font-size: 32px; margin-bottom: 12px;">⏳</div>
        <p style="margin: 0; color: #76695e;">正在解析文件...</p>
      </div>
    `;
  }

  function renderError(err) {
    const message = err && err.message ? err.message : "导入失败";
    dialogEl.innerHTML = `
      <div style="padding: 20px 24px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <h3 style="margin: 0; font-size: 18px;">导入失败</h3>
          <button class="ghost" id="importCloseBtn" style="font-size: 18px; padding: 4px 10px;">✕</button>
        </div>
        <div style="background: #fdf0ee; border: 1px solid #f0c4be; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
          <div style="display: flex; gap: 10px; align-items: flex-start;">
            <span style="font-size: 20px;">⚠️</span>
            <div>
              <p style="margin: 0 0 4px; font-weight: 700; color: #a03a2e;">无法导入此文件</p>
              <p style="margin: 0; color: #76695e; font-size: 13px;">${escapeHtml(message)}</p>
            </div>
          </div>
        </div>
        <div style="display: flex; gap: 8px;">
          <button id="importRetryBtn" class="secondary" style="flex: 1; padding: 10px; border-radius: 8px; font-weight: 700;">
            重新选择
          </button>
          <button id="importCancelBtn" style="flex: 1; padding: 10px; border-radius: 8px; background: #8d3e37; color: #fff; font-weight: 700;">
            取消
          </button>
        </div>
      </div>
    `;

    dialogEl.querySelector("#importCloseBtn").addEventListener("click", close);
    dialogEl.querySelector("#importRetryBtn").addEventListener("click", renderFilePicker);
    dialogEl.querySelector("#importCancelBtn").addEventListener("click", close);
  }

  function renderPreview() {
    const { name, cols, rows, cells, threads } = parsedData;

    const threadList = threads && threads.length > 0
      ? threads
      : (ThreadStore && ThreadStore.getAll ? ThreadStore.getAll() : []);

    const normalizedCells = normalizePreviewCells(cells, threadList);
    const colorStats = ImportParser.computeColorStats(normalizedCells, threadList);
    const firstThreadId = threadList.length > 0 ? threadList[0].id : null;
    const filledCount = normalizedCells ? normalizedCells.filter(v => v !== firstThreadId).length : 0;
    const totalCells = cols && rows ? cols * rows : 0;

    const previewHtml = renderPreviewGrid(normalizedCells, cols, rows, threadList);

    const infosHtml = renderValidationMessages(
      validationResult.infos,
      "info",
      "ℹ️"
    );

    const warningsHtml = renderValidationMessages(
      validationResult.warnings,
      "warning",
      "⚠️"
    );

    const errorsHtml = renderValidationMessages(
      validationResult.errors,
      "error",
      "❌"
    );

    const canImport = validationResult.canImport;
    const canOverwrite = validationResult.canOverwrite;

    const hasSizeMismatch = validationResult.warnings.some(w => w.code === "size_differs_from_current");
    const hasThreadsData = threads && threads.length > 0;
    const hasThreadConflicts = validationResult.hasThreadConflicts && validationResult.threadConflicts.length > 0;

    const threadConflictsHtml = hasThreadConflicts
      ? renderThreadConflicts(validationResult.threadConflicts, threadList)
      : "";

    dialogEl.innerHTML = `
      <div style="padding: 20px 24px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <h3 style="margin: 0; font-size: 18px;">导入预览</h3>
          <button class="ghost" id="importCloseBtn" style="font-size: 18px; padding: 4px 10px;">✕</button>
        </div>

        ${errorsHtml}
        ${infosHtml}
        ${warningsHtml}

        <div style="display: grid; grid-template-columns: 120px 1fr; gap: 16px; margin-bottom: 16px;">
          <div style="background: #e8dfd0; border-radius: 8px; padding: 8px; aspect-ratio: 1;">
            ${previewHtml}
          </div>
          <div>
            <h4 style="margin: 0 0 8px; font-size: 16px;">${escapeHtml(name)}</h4>
            <div style="color: #76695e; font-size: 13px; margin-bottom: 8px;">
              <span>尺寸：${cols}×${rows} 格</span>
            </div>
            <div style="color: #76695e; font-size: 13px; margin-bottom: 8px;">
              <span>已填：${filledCount} / ${totalCells} 格</span>
            </div>
            <div style="color: #76695e; font-size: 13px;">
              <span>用色：${colorStats.filter(s => s.count > 0).length} 种颜色</span>
            </div>
            ${hasThreadsData ? '<div style="color: #3c5482; font-size: 12px; margin-top: 8px;">📎 包含色线元数据</div>' : ''}
            ${hasThreadConflicts ? `<div style="color: #a03a2e; font-size: 12px; margin-top: 6px;">⚠️ 检测到 ${validationResult.threadConflicts.length} 处色线冲突</div>` : ''}
          </div>
        </div>

        <div style="margin-bottom: 16px;">
          <h4 style="margin: 0 0 8px; font-size: 14px;">用色统计</h4>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px;">
            ${colorStats.filter(s => s.count > 0).map(s => `
              <div style="display: flex; align-items: center; gap: 6px; padding: 4px 6px; background: #fff; border: 1px solid #e1d5c5; border-radius: 4px; font-size: 12px;">
                <span style="width: 14px; height: 14px; border-radius: 2px; background: ${s.color}; flex-shrink: 0;"></span>
                <span style="color: #76695e; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(s.name)}</span>
                <b style="margin-left: auto;">${s.count}</b>
              </div>
            `).join("")}
          </div>
        </div>

        ${threadConflictsHtml}

        <div style="margin-bottom: 16px;">
          <h4 style="margin: 0 0 8px; font-size: 14px;">导入方式</h4>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <label style="display: flex; align-items: flex-start; gap: 10px; padding: 12px; background: #fff; border: 2px solid #d9cdbc; border-radius: 8px; cursor: pointer;">
              <input type="radio" name="importMode" value="new" ${canImport ? '' : 'disabled'} checked style="margin-top: 2px;">
              <div style="flex: 1;">
                <div style="font-weight: 700; font-size: 14px;">新建为独立方案</div>
                <div style="font-size: 12px; color: #76695e; margin-top: 2px;">
                  在方案库中创建新方案，不影响当前方案
                  ${hasSizeMismatch ? '<br><span style="color: #a03a2e;">注：尺寸与当前方案不同</span>' : ''}
                  ${hasThreadsData ? '<br><span style="color: #3c5482;">将合并色线到色线库</span>' : ''}
                </div>
              </div>
            </label>
            <label style="display: flex; align-items: flex-start; gap: 10px; padding: 12px; background: #fff; border: 2px solid #d9cdbc; border-radius: 8px; cursor: pointer;">
              <input type="radio" name="importMode" value="overwrite" ${canOverwrite ? '' : 'disabled'} style="margin-top: 2px;">
              <div style="flex: 1;">
                <div style="font-weight: 700; font-size: 14px;">覆盖当前方案</div>
                <div style="font-size: 12px; color: #76695e; margin-top: 2px;">
                  用导入的方案替换当前编辑的方案
                  ${hasSizeMismatch ? '<br><span style="color: #a03a2e;">⚠️ 尺寸不同，当前画布将被替换</span>' : ''}
                  ${hasThreadsData ? '<br><span style="color: #3c5482;">将合并色线到色线库</span>' : ''}
                </div>
              </div>
            </label>
          </div>
        </div>

        <div style="display: flex; gap: 8px;">
          <button id="importBackBtn" class="secondary" style="flex: 1; padding: 10px; border-radius: 8px; font-weight: 700;">
            重新选择
          </button>
          <button id="importConfirmBtn" style="flex: 2; padding: 10px; border-radius: 8px; background: #8d3e37; color: #fff; font-weight: 700;" ${canImport ? '' : 'disabled'}>
            ${canImport ? '确认导入' : '数据不完整'}
          </button>
        </div>
      </div>
    `;

    dialogEl.querySelector("#importCloseBtn").addEventListener("click", close);
    dialogEl.querySelector("#importBackBtn").addEventListener("click", renderFilePicker);
    dialogEl.querySelector("#importConfirmBtn").addEventListener("click", handleConfirm);

    if (hasThreadConflicts) {
      bindConflictResolutionEvents();
    }
  }

  function renderPreviewGrid(cells, cols, rows, threads) {
    if (!cells || !cols || !rows || !threads) {
      return '<div style="text-align:center;color:#a89988;padding:20px;">无预览</div>';
    }

    const cellSize = Math.min(100 / cols, 100 / rows, 8);

    let html = `<div style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:1px;width:100%;height:100%;">`;

    const threadMap = {};
    threads.forEach(t => { threadMap[t.id] = t.color; });
    const firstColor = threads.length > 0 ? threads[0].color : "transparent";

    for (let i = 0; i < cells.length && i < cols * rows; i++) {
      const v = cells[i];
      const color = threadMap[v] || firstColor;
      const bg = v === threads[0]?.id ? "transparent" : color;
      html += `<div style="background:${bg};border-radius:1px;"></div>`;
    }

    html += "</div>";
    return html;
  }

  function renderValidationMessages(messages, type, icon) {
    if (!messages || messages.length === 0) return "";

    let bgColor, borderColor, textColor;
    if (type === "error") {
      bgColor = "#fdf0ee"; borderColor = "#f0c4be"; textColor = "#a03a2e";
    } else if (type === "warning") {
      bgColor = "#fff8e6"; borderColor = "#f0dfa8"; textColor = "#8a6d2b";
    } else {
      bgColor = "#eef2fb"; borderColor = "#c6d4ee"; textColor = "#3c5482";
    }

    const items = messages.map(m => `
      <div style="display: flex; gap: 8px; align-items: flex-start;">
        <span style="flex-shrink: 0;">${icon}</span>
        <span style="font-size: 13px;">${escapeHtml(m.message)}</span>
      </div>
    `).join("");

    return `
      <div style="background: ${bgColor}; border: 1px solid ${borderColor}; border-radius: 8px; padding: 12px; margin-bottom: 12px; color: ${textColor};">
        ${items}
      </div>
    `;
  }

  function handleConfirm() {
    if (!parsedData || !validationResult || !validationResult.canImport) {
      return;
    }

    const modeInput = dialogEl.querySelector('input[name="importMode"]:checked');
    const mode = modeInput ? modeInput.value : "new";

    try {
      let result;

      const importOptions = {
        rename: true,
        threadConflicts: validationResult.threadConflicts || [],
        conflictResolutions: conflictResolutions || [],
        currentThreadsSnapshot: currentThreadsSnapshot
      };

      if (mode === "overwrite") {
        result = ImportWriter.importAsOverwrite(parsedData, SchemeStore, importOptions);
      } else {
        result = ImportWriter.importAsNew(parsedData, SchemeStore, {
          setActive: false,
          ...importOptions
        });
      }

      if (onImportCallback) {
        onImportCallback(result);
      }

      close();

      showSuccessToast(mode, result.scheme.name);
    } catch (err) {
      renderError(err);
    }
  }

  function showSuccessToast(mode, name) {
    const toast = document.createElement("div");
    toast.style.cssText = `
      position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
      background: #3a7d44; color: #fff; padding: 12px 24px; border-radius: 8px;
      font-weight: 700; z-index: 2000; box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      font-size: 14px;
    `;
    toast.textContent = mode === "overwrite"
      ? `已覆盖当前方案：${name}`
      : `已新建方案：${name}`;

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.transition = "opacity 0.3s";
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 300);
    }, 1800);
  }

  function renderThreadConflicts(conflicts, threadList) {
    const items = conflicts.map((conflict, idx) => {
      const ft = conflict.fileThread;
      const matches = conflict.currentThreadMatches || [];
      const res = conflictResolutions[idx];
      const currentRes = res ? res.resolution : "use_file";
      const currentMatchIdx = res && res.primaryMatchIndex != null ? res.primaryMatchIndex : 0;

      const typeBadgeForType = (t) => {
        if (t === "id") return '<span style="background:#ffe0e0;color:#a03a2e;padding:2px 6px;border-radius:4px;font-size:11px;">ID冲突</span>';
        if (t === "name") return '<span style="background:#fff3cd;color:#8a6d2b;padding:2px 6px;border-radius:4px;font-size:11px;">名称冲突</span>';
        if (t === "color") return '<span style="background:#e0e7ff;color:#3c5482;padding:2px 6px;border-radius:4px;font-size:11px;">颜色冲突</span>';
        return "";
      };

      const fileColorBadge = `<span style="display:inline-block;width:18px;height:18px;border-radius:3px;background:${ft.color || '#ccc'};vertical-align:middle;border:1px solid #d9cdbc;"></span>`;

      const matchCardsHtml = matches.map((match, mIdx) => {
        const ct = match.thread;
        const matchTypeBadges = match.conflictTypes.map(typeBadgeForType).join(" ");
        const currColorBadge = `<span style="display:inline-block;width:16px;height:16px;border-radius:3px;background:${ct.color || '#ccc'};vertical-align:middle;border:1px solid #d9cdbc;"></span>`;
        const isSelected = currentRes === "keep_current" && currentMatchIdx === mIdx;
        const highlightBorder = isSelected ? 'border-color:#3c5482;box-shadow:0 0 0 2px rgba(60,84,130,0.15);' : '';

        return `
          <div style="position:relative;background:#eef2fb;padding:8px 8px 8px 32px;border-radius:6px;border:2px solid ${isSelected ? '#3c5482' : '#c6d4ee'};margin-bottom:6px;${highlightBorder}">
            <div style="position:absolute;left:8px;top:50%;transform:translateY(-50%);">
              <input type="radio" name="keep_${idx}" value="${mIdx}" ${isSelected ? 'checked' : ''} data-idx="${idx}" data-match-idx="${mIdx}" data-action="select_keep" style="cursor:pointer;">
            </div>
            <div style="font-size:10px;color:#76695e;margin-bottom:2px;">${matchTypeBadges}</div>
            <div style="font-size:12px;font-weight:600;display:flex;align-items:center;gap:6px;">${currColorBadge} ${escapeHtml(ct.name || "未命名")}</div>
            <div style="font-size:10px;color:#a89988;margin-top:1px;font-family:monospace;">ID: ${escapeHtml(ct.id || "")}</div>
            <div style="font-size:10px;color:#a89988;font-family:monospace;">色: ${escapeHtml(ct.color || "")}</div>
          </div>
        `;
      }).join("");

      const allTypeBadges = Array.from(new Set(matches.flatMap(m => m.conflictTypes))).map(typeBadgeForType).join(" ");

      return `
        <div style="border:1px solid #f0c4be;border-radius:8px;padding:12px;margin-bottom:10px;background:#fffaf2;">
          <div style="margin-bottom:8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            ${allTypeBadges}
            <span style="font-size:11px;color:#a03a2e;font-weight:600;">命中 ${matches.length} 条当前色线</span>
          </div>

          <div style="display:grid;grid-template-columns:1fr;gap:10px;margin-bottom:10px;">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;align-items:stretch;">
              <div style="background:#f5ebe0;padding:10px;border-radius:6px;">
                <div style="font-size:11px;color:#76695e;margin-bottom:6px;font-weight:600;">� 文件色线</div>
                <div style="font-size:13px;font-weight:600;display:flex;align-items:center;gap:6px;margin-bottom:4px;">${fileColorBadge} ${escapeHtml(ft.name || "未命名")}</div>
                <div style="font-size:11px;color:#a89988;font-family:monospace;">ID: ${escapeHtml(ft.id || "")}</div>
                <div style="font-size:11px;color:#a89988;font-family:monospace;">色: ${escapeHtml(ft.color || "")}</div>
                ${ft.note ? `<div style="font-size:10px;color:#a89988;margin-top:2px;">备: ${escapeHtml(ft.note)}</div>` : ''}
              </div>
              <div style="display:flex;flex-direction:column;gap:4px;">
                <div style="font-size:11px;color:#76695e;font-weight:600;">💾 命中的当前色线（单选选择保留目标）</div>
                ${matchCardsHtml}
              </div>
            </div>
          </div>

          <div style="display:flex;flex-direction:column;gap:6px;">
            <label style="display:flex;align-items:flex-start;gap:8px;padding:8px;background:${currentRes === 'keep_current' ? '#eef2fb' : '#fff'};border:2px solid ${currentRes === 'keep_current' ? '#3c5482' : '#d9cdbc'};border-radius:6px;cursor:pointer;">
              <input type="radio" name="conflict_${idx}" value="keep_current" ${currentRes === 'keep_current' ? 'checked' : ''} data-idx="${idx}" data-res="keep_current" style="margin-top:2px;">
              <div style="flex:1;">
                <div style="font-weight:600;font-size:13px;">保留当前色线</div>
                <div style="font-size:11px;color:#76695e;margin-top:2px;">保持当前色线库不变，文件中该色线对应格子将替换为右上方选中的当前色线</div>
              </div>
            </label>
            <label style="display:flex;align-items:flex-start;gap:8px;padding:8px;background:${currentRes === 'use_file' ? '#fdf0ee' : '#fff'};border:2px solid ${currentRes === 'use_file' ? '#a03a2e' : '#d9cdbc'};border-radius:6px;cursor:pointer;">
              <input type="radio" name="conflict_${idx}" value="use_file" ${currentRes === 'use_file' ? 'checked' : ''} data-idx="${idx}" data-res="use_file" style="margin-top:2px;">
              <div style="flex:1;">
                <div style="font-weight:600;font-size:13px;">使用文件色线</div>
                <div style="font-size:11px;color:#76695e;margin-top:2px;">用文件色线属性覆盖 ${matches[0] ? `「${escapeHtml(matches[0].thread.name)}」` : '当前色线'} 的属性（名称/颜色），原有方案中该色线将同步变化</div>
              </div>
            </label>
            <label style="display:flex;align-items:flex-start;gap:8px;padding:8px;background:${currentRes === 'new_mapping' ? '#e8f5e9' : '#fff'};border:2px solid ${currentRes === 'new_mapping' ? '#3a7d44' : '#d9cdbc'};border-radius:6px;cursor:pointer;">
              <input type="radio" name="conflict_${idx}" value="new_mapping" ${currentRes === 'new_mapping' ? 'checked' : ''} data-idx="${idx}" data-res="new_mapping" style="margin-top:2px;">
              <div style="flex:1;">
                <div style="font-weight:600;font-size:13px;">建立新色线</div>
                <div style="font-size:11px;color:#76695e;margin-top:2px;">将文件色线作为新色线添加到色线库，保留所有当前色线不变</div>
              </div>
            </label>
          </div>
        </div>
      `;
    }).join("");

    return `
      <div style="margin-bottom:16px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
          <h4 style="margin:0;font-size:14px;">色线冲突处理</h4>
          <span style="background:#fdf0ee;color:#a03a2e;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;">${conflicts.length} 处冲突</span>
        </div>
        <p style="margin:0 0 10px;color:#76695e;font-size:12px;">文件中的色线与当前色线库存在冲突，请为每处冲突选择处理方式：</p>
        ${items}
      </div>
    `;
  }

  function bindConflictResolutionEvents() {
    const conflictRadios = dialogEl.querySelectorAll('input[name^="conflict_"]');
    conflictRadios.forEach(radio => {
      radio.addEventListener("change", (e) => {
        const idx = Number(e.target.dataset.idx);
        const res = e.target.dataset.res;
        if (conflictResolutions && conflictResolutions[idx]) {
          conflictResolutions[idx].resolution = res;
        }
        renderPreview();
      });
    });

    const keepRadios = dialogEl.querySelectorAll('input[name^="keep_"]');
    keepRadios.forEach(radio => {
      radio.addEventListener("change", (e) => {
        const idx = Number(e.target.dataset.idx);
        const matchIdx = Number(e.target.dataset.matchIdx);
        if (conflictResolutions && conflictResolutions[idx]) {
          conflictResolutions[idx].primaryMatchIndex = matchIdx;
          conflictResolutions[idx].resolution = "keep_current";
        }
        renderPreview();
      });
    });
  }

  function normalizePreviewCells(cells, threads) {
    if (!Array.isArray(cells) || !threads || !threads.length) return [];
    const firstThreadId = threads[0].id;
    const hasLegacyFormat = cells.some(v => typeof v === "number");

    if (hasLegacyFormat) {
      return cells.map(v => {
        if (typeof v === "number" && Number.isInteger(v) && v >= 0 && v < threads.length) {
          return threads[v].id;
        }
        return firstThreadId;
      });
    }

    const threadIds = new Set(threads.map(t => t.id));
    return cells.map(v => {
      if (typeof v === "string" && threadIds.has(v)) {
        return v;
      }
      return firstThreadId;
    });
  }

  return {
    init,
    open,
    close
  };
})();
