const ProjectPackageDialog = (function() {

  let dialogEl = null;
  let overlayEl = null;
  let parsedPackage = null;
  let packageSummary = null;
  let onImportCallback = null;
  let fileInputEl = null;
  let importMode = "merge";
  let schemeResolutions = {};
  let threadResolutions = [];
  let blockResolutions = {};
  let importExportConfigFlag = true;
  let importRiskConfigFlag = true;
  let currentView = "picker";

  function init() {
    createDialog();
  }

  function createDialog() {
    if (dialogEl) return;

    overlayEl = document.createElement("div");
    overlayEl.className = "project-package-overlay";
    overlayEl.style.cssText = `
      position: fixed; inset: 0; background: rgba(40, 32, 24, 0.6);
      display: none; align-items: center; justify-content: center;
      z-index: 1000;
    `;

    dialogEl = document.createElement("div");
    dialogEl.className = "project-package-dialog";
    dialogEl.style.cssText = `
      background: #fffaf2; border: 1px solid #d9cdbc; border-radius: 12px;
      width: min(720px, 94vw); max-height: 88vh; overflow-y: auto;
      box-shadow: 0 10px 40px rgba(40, 32, 24, 0.3);
    `;

    overlayEl.appendChild(dialogEl);
    document.body.appendChild(overlayEl);

    overlayEl.addEventListener("click", function(e) {
      if (e.target === overlayEl) close();
    });
  }

  function open(options) {
    createDialog();
    onImportCallback = options && options.onImport ? options.onImport : null;
    parsedPackage = null;
    packageSummary = null;
    schemeResolutions = {};
    threadResolutions = [];
    blockResolutions = {};
    importExportConfigFlag = true;
    importRiskConfigFlag = true;
    importMode = "merge";
    currentView = "picker";
    renderFilePicker();
    overlayEl.style.display = "flex";
  }

  function close() {
    overlayEl.style.display = "none";
    parsedPackage = null;
    packageSummary = null;
    onImportCallback = null;
    schemeResolutions = {};
    threadResolutions = [];
    blockResolutions = {};
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function formatTime(ts) {
    if (!ts) return "未知时间";
    try {
      const d = new Date(ts);
      return d.getFullYear() + "-" +
        String(d.getMonth() + 1).padStart(2, "0") + "-" +
        String(d.getDate()).padStart(2, "0") + " " +
        String(d.getHours()).padStart(2, "0") + ":" +
        String(d.getMinutes()).padStart(2, "0");
    } catch (e) {
      return String(ts);
    }
  }

  function renderFilePicker() {
    currentView = "picker";
    dialogEl.innerHTML = `
      <div style="padding: 24px 28px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h3 style="margin: 0; font-size: 20px;">导入项目包</h3>
          <button class="ghost" id="ppCloseBtn" style="font-size: 20px; padding: 4px 12px;">✕</button>
        </div>
        <p style="color: #76695e; font-size: 14px; margin: 0 0 20px;">
          项目包包含所有方案、色线库、纹样块、导出设置和风险设置。导入前可预览内容并选择合并或替换方式。
        </p>
        <div style="border: 2px dashed #c8b99a; border-radius: 10px; padding: 40px 20px; text-align: center; background: #fff8ee; margin-bottom: 16px;">
          <div style="font-size: 48px; margin-bottom: 12px;">📦</div>
          <p style="margin: 0 0 16px; color: #76695e; font-size: 14px;">选择导出的项目包 JSON 文件</p>
          <button id="ppSelectFileBtn" style="background: #8d3e37; color: #fff; padding: 12px 28px; border-radius: 8px; font-weight: 700; font-size: 14px;">
            选择项目包文件
          </button>
          <input type="file" id="ppFileInput" accept=".json,application/json" style="display: none;">
        </div>
        <div style="background: #eef2fb; border: 1px solid #c6d4ee; border-radius: 8px; padding: 12px 16px;">
          <div style="display: flex; gap: 10px; align-items: flex-start;">
            <span style="font-size: 18px;">💡</span>
            <div style="font-size: 13px; color: #3c5482; line-height: 1.5;">
              <b>提示：</b>项目包文件通常以 <code>zfl31-project-</code> 开头，扩展名为 <code>.json</code>。
            </div>
          </div>
        </div>
      </div>
    `;

    dialogEl.querySelector("#ppCloseBtn").addEventListener("click", close);
    dialogEl.querySelector("#ppSelectFileBtn").addEventListener("click", function() {
      dialogEl.querySelector("#ppFileInput").click();
    });
    fileInputEl = dialogEl.querySelector("#ppFileInput");
    fileInputEl.addEventListener("change", handleFileSelect);
  }

  function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    parseAndValidate(file);
  }

  async function parseAndValidate(file) {
    renderLoading("正在解析项目包...");

    try {
      const text = await new Promise(function(resolve, reject) {
        const reader = new FileReader();
        reader.onload = function(e) { resolve(e.target.result); };
        reader.onerror = function() { reject(new Error("文件读取失败")); };
        reader.readAsText(file);
      });

      const raw = JSON.parse(text);
      parsedPackage = ProjectPackage.parseAndValidatePackage(raw);
      const conflicts = ProjectPackage.detectConflicts(parsedPackage);
      packageSummary = ProjectPackage.buildSummary(parsedPackage, conflicts);

      schemeResolutions = {};
      conflicts.schemes.forEach(function(c) {
        schemeResolutions[c.packageScheme.id] = { resolution: "new_copy" };
      });

      threadResolutions = conflicts.threads.map(function(c, idx) {
        return {
          fileThreadId: c.fileThread.id,
          resolution: "use_file",
          primaryMatchIndex: c.primaryMatchIndex != null ? c.primaryMatchIndex : 0
        };
      });

      blockResolutions = {};
      conflicts.blocks.forEach(function(c) {
        blockResolutions[c.packageBlock.id] = { resolution: "new_copy" };
      });

      renderSummary();
    } catch (err) {
      renderError(err.message || "解析失败");
    }
  }

  function renderLoading(msg) {
    dialogEl.innerHTML = `
      <div style="padding: 48px 28px; text-align: center;">
        <div style="font-size: 36px; margin-bottom: 16px;">⏳</div>
        <p style="margin: 0; color: #76695e; font-size: 14px;">${escapeHtml(msg)}</p>
      </div>
    `;
  }

  function renderError(msg) {
    currentView = "error";
    dialogEl.innerHTML = `
      <div style="padding: 24px 28px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <h3 style="margin: 0; font-size: 20px;">导入失败</h3>
          <button class="ghost" id="ppCloseBtn" style="font-size: 20px; padding: 4px 12px;">✕</button>
        </div>
        <div style="background: #fdf0ee; border: 1px solid #f0c4be; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
          <div style="display: flex; gap: 10px; align-items: flex-start;">
            <span style="font-size: 22px;">⚠️</span>
            <div>
              <p style="margin: 0 0 4px; font-weight: 700; color: #a03a2e;">无法导入此项目包</p>
              <p style="margin: 0; color: #76695e; font-size: 13px;">${escapeHtml(msg)}</p>
            </div>
          </div>
        </div>
        <div style="display: flex; gap: 10px;">
          <button id="ppRetryBtn" class="secondary" style="flex: 1; padding: 12px; border-radius: 8px; font-weight: 700;">
            重新选择
          </button>
          <button id="ppCancelBtn" style="flex: 1; padding: 12px; border-radius: 8px; background: #8d3e37; color: #fff; font-weight: 700;">
            取消
          </button>
        </div>
      </div>
    `;

    dialogEl.querySelector("#ppCloseBtn").addEventListener("click", close);
    dialogEl.querySelector("#ppRetryBtn").addEventListener("click", renderFilePicker);
    dialogEl.querySelector("#ppCancelBtn").addEventListener("click", close);
  }

  function renderSummary() {
    currentView = "summary";
    const info = packageSummary.packageInfo;
    const conf = packageSummary.conflictSummary;
    const cov = packageSummary.coverage;

    const hasConflicts = conf.hasAnyConflict;

    dialogEl.innerHTML = `
      <div style="padding: 24px 28px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h3 style="margin: 0; font-size: 20px;">项目包预览</h3>
          <button class="ghost" id="ppCloseBtn" style="font-size: 20px; padding: 4px 12px;">✕</button>
        </div>

        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px;">
          ${renderStatCard("方案数量", info.schemeCount, "📋", info.schemeCount > 0 ? "#eef2fb" : "#f5f0e8")}
          ${renderStatCard("色线数量", info.threadCount, "🎨", "#fdf0ee")}
          ${renderStatCard("纹样块数量", info.blockCount, "🧩", "#e8f5e9")}
          ${renderStatCard("版本快照", info.versionCount, "⏱️", "#fff8e6")}
          ${renderStatCard("导出设置", info.hasExportConfig ? "包含" : "无", info.hasExportConfig ? "⚙️" : "—", info.hasExportConfig ? "#eef2fb" : "#f5f0e8")}
          ${renderStatCard("风险设置", info.hasRiskConfig ? "包含" : "无", info.hasRiskConfig ? "⚠️" : "—", info.hasRiskConfig ? "#fff8e6" : "#f5f0e8")}
        </div>

        <div style="background: #fff; border: 1px solid #e1d5c5; border-radius: 8px; padding: 14px 16px; margin-bottom: 16px;">
          <div style="font-size: 12px; color: #a89988; margin-bottom: 6px;">导出时间</div>
          <div style="font-size: 14px; font-weight: 600;">${formatTime(info.exportedAt)}</div>
        </div>

        <div style="margin-bottom: 20px;">
          <h4 style="margin: 0 0 12px; font-size: 15px;">📊 导入覆盖预览</h4>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div style="background: #e8f5e9; border-radius: 8px; padding: 12px;">
              <div style="font-size: 12px; color: #3a7d44; margin-bottom: 4px;">将新增方案</div>
              <div style="font-size: 22px; font-weight: 700; color: #2e5d35;">${cov.schemesToAdd}</div>
            </div>
            <div style="background: #eef2fb; border-radius: 8px; padding: 12px;">
              <div style="font-size: 12px; color: #3c5482; margin-bottom: 4px;">将新增色线</div>
              <div style="font-size: 22px; font-weight: 700; color: #2e4472;">${cov.threadsToAdd}</div>
            </div>
            <div style="background: #fff8e6; border-radius: 8px; padding: 12px;">
              <div style="font-size: 12px; color: #8a6d2b; margin-bottom: 4px;">将新增纹样块</div>
              <div style="font-size: 22px; font-weight: 700; color: #6d541e;">${cov.blocksToAdd}</div>
            </div>
            <div style="background: #fdf0ee; border-radius: 8px; padding: 12px;">
              <div style="font-size: 12px; color: #a03a2e; margin-bottom: 4px;">检测到冲突</div>
              <div style="font-size: 22px; font-weight: 700; color: #7e2a22;">${hasConflicts ? (conf.schemeConflicts + conf.threadConflicts + conf.blockConflicts) : 0} 处</div>
            </div>
          </div>
        </div>

        ${hasConflicts ? renderConflictSummary() : ""}

        <div style="margin-bottom: 20px;">
          <h4 style="margin: 0 0 10px; font-size: 15px;">📥 导入方式</h4>
          <div style="display: flex; flex-direction: column; gap: 10px;">
            <label style="display: flex; align-items: flex-start; gap: 12px; padding: 14px; background: #fff; border: 2px solid ${importMode === 'merge' ? '#8d3e37' : '#d9cdbc'}; border-radius: 8px; cursor: pointer;">
              <input type="radio" name="ppImportMode" value="merge" ${importMode === 'merge' ? 'checked' : ''} style="margin-top: 3px;">
              <div style="flex: 1;">
                <div style="font-weight: 700; font-size: 15px;">合并到当前项目</div>
                <div style="font-size: 12px; color: #76695e; margin-top: 4px;">
                  将项目包内容合并到当前本地库，保留现有数据。冲突项可单独选择处理方式。
                </div>
              </div>
            </label>
            <label style="display: flex; align-items: flex-start; gap: 12px; padding: 14px; background: #fff; border: 2px solid ${importMode === 'replace' ? '#8d3e37' : '#d9cdbc'}; border-radius: 8px; cursor: pointer;">
              <input type="radio" name="ppImportMode" value="replace" ${importMode === 'replace' ? 'checked' : ''} style="margin-top: 3px;">
              <div style="flex: 1;">
                <div style="font-weight: 700; font-size: 15px;">替换当前项目</div>
                <div style="font-size: 12px; color: #76695e; margin-top: 4px;">
                  <span style="color: #a03a2e; font-weight: 600;">⚠️ 危险：</span>将清空当前所有方案、色线、纹样块，用项目包内容完全替换。此操作不可撤销。
                </div>
              </div>
            </label>
          </div>
        </div>

        <div style="margin-bottom: 20px;">
          <h4 style="margin: 0 0 10px; font-size: 15px;">⚙️ 设置导入</h4>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <label style="display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: #fff; border: 1px solid #e1d5c5; border-radius: 6px; cursor: pointer;">
              <input type="checkbox" id="ppImportExportConfig" ${importExportConfigFlag ? 'checked' : ''}>
              <div>
                <div style="font-weight: 600; font-size: 13px;">导入导出设置</div>
                <div style="font-size: 11px; color: #a89988;">${info.hasExportConfig ? '项目包包含导出设置' : '项目包不包含导出设置'}</div>
              </div>
            </label>
            <label style="display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: #fff; border: 1px solid #e1d5c5; border-radius: 6px; cursor: pointer;">
              <input type="checkbox" id="ppImportRiskConfig" ${importRiskConfigFlag ? 'checked' : ''}>
              <div>
                <div style="font-weight: 600; font-size: 13px;">导入工序风险设置</div>
                <div style="font-size: 11px; color: #a89988;">${info.hasRiskConfig ? '项目包包含风险设置' : '项目包不包含风险设置'}</div>
              </div>
            </label>
          </div>
        </div>

        ${hasConflicts && importMode === 'merge' ? `
          <div style="margin-bottom: 20px;">
            <button id="ppResolveConflictsBtn" style="width: 100%; padding: 12px; background: #fff3cd; border: 1px solid #f0dfa8; border-radius: 8px; font-weight: 700; color: #8a6d2b; font-size: 14px;">
              ⚙️ 配置冲突处理方式（${conf.schemeConflicts + conf.threadConflicts + conf.blockConflicts} 处冲突）
            </button>
          </div>
        ` : ""}

        <div style="display: flex; gap: 10px;">
          <button id="ppBackBtn" class="secondary" style="flex: 1; padding: 12px; border-radius: 8px; font-weight: 700;">
            重新选择
          </button>
          <button id="ppConfirmBtn" style="flex: 2; padding: 12px; border-radius: 8px; background: #8d3e37; color: #fff; font-weight: 700; font-size: 15px;">
            确认${importMode === 'replace' ? '替换' : '合并'}导入
          </button>
        </div>
      </div>
    `;

    bindSummaryEvents();
  }

  function renderStatCard(label, value, icon, bgColor) {
    return `
      <div style="background: ${bgColor}; border-radius: 8px; padding: 12px; text-align: center;">
        <div style="font-size: 20px; margin-bottom: 4px;">${icon}</div>
        <div style="font-size: 11px; color: #76695e; margin-bottom: 2px;">${label}</div>
        <div style="font-size: 20px; font-weight: 700; color: #3a2e20;">${value}</div>
      </div>
    `;
  }

  function renderConflictSummary() {
    const conf = packageSummary.conflictSummary;
    const items = [];
    if (conf.schemeConflicts > 0) items.push(`方案 ${conf.schemeConflicts}`);
    if (conf.threadConflicts > 0) items.push(`色线 ${conf.threadConflicts}`);
    if (conf.blockConflicts > 0) items.push(`纹样块 ${conf.blockConflicts}`);
    if (conf.versionConflicts > 0) items.push(`版本 ${conf.versionConflicts}`);

    return `
      <div style="background: #fff8e6; border: 1px solid #f0dfa8; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px;">
        <div style="display: flex; gap: 10px; align-items: flex-start;">
          <span style="font-size: 20px;">⚠️</span>
          <div style="flex: 1;">
            <div style="font-weight: 600; color: #8a6d2b; font-size: 14px; margin-bottom: 4px;">检测到数据冲突</div>
            <div style="font-size: 12px; color: #76695e;">
              冲突类型：${items.join("、")}。合并模式下可自定义每项冲突的处理方式。
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function bindSummaryEvents() {
    dialogEl.querySelector("#ppCloseBtn").addEventListener("click", close);
    dialogEl.querySelector("#ppBackBtn").addEventListener("click", renderFilePicker);

    const modeRadios = dialogEl.querySelectorAll('input[name="ppImportMode"]');
    modeRadios.forEach(function(r) {
      r.addEventListener("change", function(e) {
        importMode = e.target.value;
        renderSummary();
      });
    });

    const exportCfgCb = dialogEl.querySelector("#ppImportExportConfig");
    if (exportCfgCb) {
      exportCfgCb.addEventListener("change", function(e) {
        importExportConfigFlag = e.target.checked;
      });
    }

    const riskCfgCb = dialogEl.querySelector("#ppImportRiskConfig");
    if (riskCfgCb) {
      riskCfgCb.addEventListener("change", function(e) {
        importRiskConfigFlag = e.target.checked;
      });
    }

    const resolveBtn = dialogEl.querySelector("#ppResolveConflictsBtn");
    if (resolveBtn) {
      resolveBtn.addEventListener("click", renderConflictResolution);
    }

    dialogEl.querySelector("#ppConfirmBtn").addEventListener("click", handleConfirmImport);
  }

  function renderConflictResolution() {
    currentView = "conflicts";
    const conflicts = packageSummary.conflicts;

    let schemeHtml = "";
    if (conflicts.schemes.length > 0) {
      schemeHtml = `
        <div style="margin-bottom: 20px;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
            <h4 style="margin: 0; font-size: 15px;">📋 方案冲突 (${conflicts.schemes.length})</h4>
          </div>
          <div style="display: flex; flex-direction: column; gap: 10px;">
            ${conflicts.schemes.map(function(c, idx) {
              const res = schemeResolutions[c.packageScheme.id] || { resolution: "new_copy" };
              return renderSchemeConflictItem(c, idx, res);
            }).join("")}
          </div>
        </div>
      `;
    }

    let threadHtml = "";
    if (conflicts.threads.length > 0) {
      threadHtml = `
        <div style="margin-bottom: 20px;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
            <h4 style="margin: 0; font-size: 15px;">🎨 色线冲突 (${conflicts.threads.length})</h4>
          </div>
          <div style="display: flex; flex-direction: column; gap: 10px;">
            ${conflicts.threads.map(function(c, idx) {
              const res = threadResolutions[idx] || { resolution: "use_file" };
              return renderThreadConflictItem(c, idx, res);
            }).join("")}
          </div>
        </div>
      `;
    }

    let blockHtml = "";
    if (conflicts.blocks.length > 0) {
      blockHtml = `
        <div style="margin-bottom: 20px;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
            <h4 style="margin: 0; font-size: 15px;">🧩 纹样块冲突 (${conflicts.blocks.length})</h4>
          </div>
          <div style="display: flex; flex-direction: column; gap: 10px;">
            ${conflicts.blocks.map(function(c, idx) {
              const res = blockResolutions[c.packageBlock.id] || { resolution: "new_copy" };
              return renderBlockConflictItem(c, idx, res);
            }).join("")}
          </div>
        </div>
      `;
    }

    dialogEl.innerHTML = `
      <div style="padding: 24px 28px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h3 style="margin: 0; font-size: 20px;">冲突处理配置</h3>
          <button class="ghost" id="ppCloseBtn" style="font-size: 20px; padding: 4px 12px;">✕</button>
        </div>
        <p style="color: #76695e; font-size: 13px; margin: 0 0 20px;">
          为每项冲突选择处理方式。未处理的冲突将使用默认策略。
        </p>
        ${schemeHtml}
        ${threadHtml}
        ${blockHtml}
        <div style="display: flex; gap: 10px;">
          <button id="ppBackToSummaryBtn" class="secondary" style="flex: 1; padding: 12px; border-radius: 8px; font-weight: 700;">
            ← 返回预览
          </button>
          <button id="ppDoneConflictsBtn" style="flex: 2; padding: 12px; border-radius: 8px; background: #8d3e37; color: #fff; font-weight: 700;">
            完成配置
          </button>
        </div>
      </div>
    `;

    bindConflictEvents();
  }

  function renderSchemeConflictItem(c, idx, res) {
    const ps = c.packageScheme;
    const cs = c.currentScheme;
    const conflictBadge = c.conflictType === "id"
      ? '<span style="background:#ffe0e0;color:#a03a2e;padding:2px 8px;border-radius:4px;font-size:11px;">ID冲突</span>'
      : '<span style="background:#fff3cd;color:#8a6d2b;padding:2px 8px;border-radius:4px;font-size:11px;">名称冲突</span>';

    return `
      <div style="border: 1px solid #e1d5c5; border-radius: 8px; padding: 14px; background: #fff;">
        <div style="margin-bottom: 10px;">
          ${conflictBadge}
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
          <div style="background: #fdf0ee; border-radius: 6px; padding: 10px;">
            <div style="font-size: 11px; color: #a03a2e; font-weight: 600; margin-bottom: 4px;">项目包方案</div>
            <div style="font-size: 13px; font-weight: 700; color: #3a2e20; margin-bottom: 4px;">${escapeHtml(ps.name)}</div>
            <div style="font-size: 11px; color: #76695e;">${ps.cols}×${ps.rows} 格 · ${formatTime(ps.updatedAt)}</div>
          </div>
          <div style="background: #eef2fb; border-radius: 6px; padding: 10px;">
            <div style="font-size: 11px; color: #3c5482; font-weight: 600; margin-bottom: 4px;">当前方案</div>
            <div style="font-size: 13px; font-weight: 700; color: #3a2e20; margin-bottom: 4px;">${cs ? escapeHtml(cs.name) : "—"}</div>
            <div style="font-size: 11px; color: #76695e;">${cs ? cs.cols + "×" + cs.rows + " 格 · " + formatTime(cs.updatedAt) : "—"}</div>
          </div>
        </div>
        <div style="display: flex; flex-direction: column; gap: 6px;">
          ${renderSchemeRadio("new_copy", ps.id, "新建副本（自动重命名）", res.resolution, "将项目包方案作为新方案添加，名称后加 (导入) 后缀")}
          ${renderSchemeRadio("use_package", ps.id, "使用项目包版本", res.resolution, "覆盖当前同ID/同名方案的内容")}
          ${renderSchemeRadio("keep_current", ps.id, "保留当前版本", res.resolution, "跳过此方案，保留当前项目中的版本")}
        </div>
      </div>
    `;
  }

  function renderSchemeRadio(value, schemeId, label, currentVal, desc) {
    const checked = currentVal === value ? "checked" : "";
    const bg = currentVal === value ? "#fff5eb" : "#fff";
    const border = currentVal === value ? "#d8a356" : "#e1d5c5";
    return `
      <label style="display: flex; align-items: flex-start; gap: 8px; padding: 8px 10px; background: ${bg}; border: 1px solid ${border}; border-radius: 6px; cursor: pointer;">
        <input type="radio" name="scheme_${schemeId}" value="${value}" data-scheme-id="${schemeId}" ${checked} style="margin-top: 3px;">
        <div style="flex: 1;">
          <div style="font-size: 13px; font-weight: 600;">${label}</div>
          <div style="font-size: 11px; color: #76695e; margin-top: 2px;">${desc}</div>
        </div>
      </label>
    `;
  }

  function renderThreadConflictItem(c, idx, res) {
    const ft = c.fileThread;
    const matches = c.currentThreadMatches || [];
    const currentMatchIdx = res.primaryMatchIndex != null ? res.primaryMatchIndex : 0;

    const fileColorBadge = `<span style="display:inline-block;width:18px;height:18px;border-radius:3px;background:${ft.color || '#ccc'};vertical-align:middle;border:1px solid #d9cdbc;"></span>`;

    const matchCards = matches.map(function(m, mIdx) {
      const ct = m.thread;
      const currColorBadge = `<span style="display:inline-block;width:16px;height:16px;border-radius:3px;background:${ct.color || '#ccc'};vertical-align:middle;border:1px solid #d9cdbc;"></span>`;
      const isSelected = currentMatchIdx === mIdx;
      const typeBadges = m.conflictTypes.map(function(t) {
        if (t === "id") return '<span style="background:#ffe0e0;color:#a03a2e;padding:1px 5px;border-radius:3px;font-size:10px;">ID</span>';
        if (t === "name") return '<span style="background:#fff3cd;color:#8a6d2b;padding:1px 5px;border-radius:3px;font-size:10px;">名称</span>';
        if (t === "color") return '<span style="background:#e0e7ff;color:#3c5482;padding:1px 5px;border-radius:3px;font-size:10px;">颜色</span>';
        return "";
      }).join(" ");
      return `
        <div style="position:relative;background:${isSelected ? '#eef2fb' : '#f5f0e8'};padding:8px 8px 8px 30px;border-radius:5px;border:1.5px solid ${isSelected ? '#3c5482' : '#d9cdbc'};margin-bottom:5px;">
          <div style="position:absolute;left:8px;top:50%;transform:translateY(-50%);">
            <input type="radio" name="keep_${idx}" value="${mIdx}" data-thread-idx="${idx}" data-match-idx="${mIdx}" ${isSelected ? 'checked' : ''} style="cursor:pointer;">
          </div>
          <div style="font-size:10px;margin-bottom:2px;">${typeBadges}</div>
          <div style="font-size:12px;font-weight:600;display:flex;align-items:center;gap:5px;">${currColorBadge} ${escapeHtml(ct.name || "未命名")}</div>
          <div style="font-size:10px;color:#a89988;font-family:monospace;">${escapeHtml(ct.id || "")}</div>
        </div>
      `;
    }).join("");

    const selectedMatch = matches[currentMatchIdx] || matches[0];
    const selectedName = selectedMatch && selectedMatch.thread ? selectedMatch.thread.name : "当前色线";

    return `
      <div style="border: 1px solid #e1d5c5; border-radius: 8px; padding: 14px; background: #fff;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
          <div style="background:#f5ebe0;padding:10px;border-radius:6px;">
            <div style="font-size:11px;color:#76695e;font-weight:600;margin-bottom:5px;">项目包色线</div>
            <div style="font-size:13px;font-weight:700;display:flex;align-items:center;gap:6px;margin-bottom:3px;">${fileColorBadge} ${escapeHtml(ft.name || "未命名")}</div>
            <div style="font-size:10px;color:#a89988;font-family:monospace;">${escapeHtml(ft.id || "")}</div>
            ${ft.note ? `<div style="font-size:10px;color:#a89988;margin-top:2px;">备: ${escapeHtml(ft.note)}</div>` : ''}
          </div>
          <div style="display:flex;flex-direction:column;gap:4px;">
            <div style="font-size:11px;color:#76695e;font-weight:600;">当前匹配 (${matches.length})</div>
            ${matchCards}
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;">
          ${renderThreadRadio(idx, "keep_current", "保留当前色线", res.resolution, `文件色线映射为「${escapeHtml(selectedName)}」`)}
          ${renderThreadRadio(idx, "use_file", "使用文件色线", res.resolution, `用文件色线覆盖「${escapeHtml(selectedName)}」的属性`)}
          ${renderThreadRadio(idx, "new_mapping", "建立新色线", res.resolution, "将文件色线作为新色线添加")}
        </div>
      </div>
    `;
  }

  function renderThreadRadio(idx, value, label, currentVal, desc) {
    const checked = currentVal === value ? "checked" : "";
    const bg = currentVal === value ? "#fff5eb" : "#fff";
    const border = currentVal === value ? "#d8a356" : "#e1d5c5";
    return `
      <label style="display: flex; align-items: flex-start; gap: 8px; padding: 8px 10px; background: ${bg}; border: 1px solid ${border}; border-radius: 6px; cursor: pointer;">
        <input type="radio" name="thread_${idx}" value="${value}" data-thread-idx="${idx}" ${checked} style="margin-top: 3px;">
        <div style="flex: 1;">
          <div style="font-size: 13px; font-weight: 600;">${label}</div>
          <div style="font-size: 11px; color: #76695e; margin-top: 2px;">${desc}</div>
        </div>
      </label>
    `;
  }

  function renderBlockConflictItem(c, idx, res) {
    const pb = c.packageBlock;
    const cb = c.currentBlock;
    const conflictBadge = c.conflictType === "id"
      ? '<span style="background:#ffe0e0;color:#a03a2e;padding:2px 8px;border-radius:4px;font-size:11px;">ID冲突</span>'
      : '<span style="background:#fff3cd;color:#8a6d2b;padding:2px 8px;border-radius:4px;font-size:11px;">名称冲突</span>';

    return `
      <div style="border: 1px solid #e1d5c5; border-radius: 8px; padding: 14px; background: #fff;">
        <div style="margin-bottom: 10px;">
          ${conflictBadge}
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
          <div style="background: #fdf0ee; border-radius: 6px; padding: 10px;">
            <div style="font-size: 11px; color: #a03a2e; font-weight: 600; margin-bottom: 4px;">项目包纹样块</div>
            <div style="font-size: 13px; font-weight: 700; color: #3a2e20; margin-bottom: 2px;">${escapeHtml(pb.name)}</div>
            <div style="font-size: 11px; color: #76695e; margin-bottom: 2px;">分类: ${escapeHtml(pb.category || "未分类")}</div>
            <div style="font-size: 11px; color: #76695e;">${pb.cols}×${pb.rows} 格</div>
          </div>
          <div style="background: #eef2fb; border-radius: 6px; padding: 10px;">
            <div style="font-size: 11px; color: #3c5482; font-weight: 600; margin-bottom: 4px;">当前纹样块</div>
            <div style="font-size: 13px; font-weight: 700; color: #3a2e20; margin-bottom: 2px;">${cb ? escapeHtml(cb.name) : "—"}</div>
            <div style="font-size: 11px; color: #76695e; margin-bottom: 2px;">分类: ${cb ? escapeHtml(cb.category || "未分类") : "—"}</div>
            <div style="font-size: 11px; color: #76695e;">${cb ? cb.cols + "×" + cb.rows + " 格" : "—"}</div>
          </div>
        </div>
        <div style="display: flex; flex-direction: column; gap: 6px;">
          ${renderBlockRadio(pb.id, "new_copy", "新建副本（自动重命名）", res.resolution, "将纹样块作为新块添加，名称后加 (导入) 后缀")}
          ${renderBlockRadio(pb.id, "use_package", "使用项目包版本", res.resolution, "覆盖当前同ID/同名纹样块的内容")}
          ${renderBlockRadio(pb.id, "keep_current", "保留当前版本", res.resolution, "跳过此纹样块，保留当前项目中的版本")}
        </div>
      </div>
    `;
  }

  function renderBlockRadio(blockId, value, label, currentVal, desc) {
    const checked = currentVal === value ? "checked" : "";
    const bg = currentVal === value ? "#fff5eb" : "#fff";
    const border = currentVal === value ? "#d8a356" : "#e1d5c5";
    return `
      <label style="display: flex; align-items: flex-start; gap: 8px; padding: 8px 10px; background: ${bg}; border: 1px solid ${border}; border-radius: 6px; cursor: pointer;">
        <input type="radio" name="block_${blockId}" value="${value}" data-block-id="${blockId}" ${checked} style="margin-top: 3px;">
        <div style="flex: 1;">
          <div style="font-size: 13px; font-weight: 600;">${label}</div>
          <div style="font-size: 11px; color: #76695e; margin-top: 2px;">${desc}</div>
        </div>
      </label>
    `;
  }

  function bindConflictEvents() {
    dialogEl.querySelector("#ppCloseBtn").addEventListener("click", close);
    dialogEl.querySelector("#ppBackToSummaryBtn").addEventListener("click", renderSummary);
    dialogEl.querySelector("#ppDoneConflictsBtn").addEventListener("click", renderSummary);

    const schemeRadios = dialogEl.querySelectorAll('input[name^="scheme_"]');
    schemeRadios.forEach(function(r) {
      r.addEventListener("change", function(e) {
        const schemeId = e.target.dataset.schemeId;
        const val = e.target.value;
        schemeResolutions[schemeId] = { resolution: val };
      });
    });

    const threadRadios = dialogEl.querySelectorAll('input[name^="thread_"]');
    threadRadios.forEach(function(r) {
      r.addEventListener("change", function(e) {
        const idx = Number(e.target.dataset.threadIdx);
        const val = e.target.value;
        if (threadResolutions[idx]) {
          threadResolutions[idx].resolution = val;
        }
      });
    });

    const keepRadios = dialogEl.querySelectorAll('input[name^="keep_"]');
    keepRadios.forEach(function(r) {
      r.addEventListener("change", function(e) {
        const idx = Number(e.target.dataset.threadIdx);
        const mIdx = Number(e.target.dataset.matchIdx);
        if (threadResolutions[idx]) {
          threadResolutions[idx].primaryMatchIndex = mIdx;
          threadResolutions[idx].resolution = "keep_current";
          renderConflictResolution();
        }
      });
    });

    const blockRadios = dialogEl.querySelectorAll('input[name^="block_"]');
    blockRadios.forEach(function(r) {
      r.addEventListener("change", function(e) {
        const blockId = e.target.dataset.blockId;
        const val = e.target.value;
        blockResolutions[blockId] = { resolution: val };
      });
    });
  }

  function handleConfirmImport() {
    if (!parsedPackage) return;

    renderLoading(importMode === "replace" ? "正在替换项目..." : "正在合并导入...");

    try {
      const result = ProjectPackage.importPackage(parsedPackage, {
        mode: importMode,
        threadConflictResolutions: threadResolutions,
        schemeConflictResolutions: schemeResolutions,
        blockConflictResolutions: blockResolutions,
        importExportConfig: importExportConfigFlag,
        importRiskConfig: importRiskConfigFlag
      });

      renderSuccess(result);

      if (onImportCallback) {
        setTimeout(function() {
          onImportCallback(result);
        }, 100);
      }
    } catch (err) {
      renderError(err.message || "导入失败");
    }
  }

  function renderSuccess(result) {
    const imp = result.imported;
    const modeLabel = result.mode === "replace" ? "替换" : "合并";

    dialogEl.innerHTML = `
      <div style="padding: 32px 28px; text-align: center;">
        <div style="font-size: 56px; margin-bottom: 16px;">✅</div>
        <h3 style="margin: 0 0 8px; font-size: 22px; color: #2e5d35;">导入成功</h3>
        <p style="margin: 0 0 24px; color: #76695e; font-size: 14px;">
          已完成${modeLabel}导入
        </p>

        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 24px; text-align: left;">
          <div style="background: #eef2fb; border-radius: 8px; padding: 12px;">
            <div style="font-size: 11px; color: #3c5482; margin-bottom: 4px;">方案</div>
            <div style="font-size: 18px; font-weight: 700; color: #2e4472;">
              ${imp.schemes} 个${result.mode === 'merge' && imp.updatedSchemes > 0 ? ` (更新${imp.updatedSchemes})` : ''}
            </div>
          </div>
          <div style="background: #fdf0ee; border-radius: 8px; padding: 12px;">
            <div style="font-size: 11px; color: #a03a2e; margin-bottom: 4px;">色线</div>
            <div style="font-size: 18px; font-weight: 700; color: #7e2a22;">${imp.threads} 种</div>
          </div>
          <div style="background: #e8f5e9; border-radius: 8px; padding: 12px;">
            <div style="font-size: 11px; color: #3a7d44; margin-bottom: 4px;">纹样块</div>
            <div style="font-size: 18px; font-weight: 700; color: #2e5d35;">${imp.blocks} 个</div>
          </div>
          <div style="background: #fff8e6; border-radius: 8px; padding: 12px;">
            <div style="font-size: 11px; color: #8a6d2b; margin-bottom: 4px;">版本快照</div>
            <div style="font-size: 18px; font-weight: 700; color: #6d541e;">${imp.versions} 条</div>
          </div>
        </div>

        ${result.mode === 'merge' && result.skipped && (result.skipped.schemes > 0 || result.skipped.blocks > 0) ? `
          <div style="background: #fff8e6; border: 1px solid #f0dfa8; border-radius: 8px; padding: 12px; margin-bottom: 20px; text-align: left;">
            <div style="font-size: 12px; color: #8a6d2b;">
              已跳过：方案 ${result.skipped.schemes || 0} 个，纹样块 ${result.skipped.blocks || 0} 个
            </div>
          </div>
        ` : ""}

        <button id="ppDoneBtn" style="width: 100%; padding: 14px; background: #3a7d44; color: #fff; border-radius: 8px; font-weight: 700; font-size: 15px;">
          完成
        </button>
      </div>
    `;

    dialogEl.querySelector("#ppDoneBtn").addEventListener("click", close);
  }

  return {
    init: init,
    open: open,
    close: close
  };
})();
