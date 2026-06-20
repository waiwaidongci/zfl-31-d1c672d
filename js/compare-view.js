const CompareView = (function() {

  let _container = null;
  let _compareResult = null;
  let _onBack = null;
  let _showDifferences = true;
  let _schemeAId = null;
  let _schemeBId = null;
  let _schemeA = null;
  let _schemeB = null;
  let _schemeA_isVersion = false;
  let _schemeB_isVersion = false;
  let _sourceSchemeId = null;
  let _alignment = { mode: 'top-left', offsetX: 0, offsetY: 0 };
  let _areaSelectionSlot = null;
  let _areaSelection = null;
  let _areaSelStart = null;
  let _areaSelecting = false;

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function init(options = {}) {
    _container = options.container || null;
    _onBack = options.onBack || null;
  }

  function showCompare(schemeA, schemeB, options) {
    if (!_container) return;

    options = options || {};
    _sourceSchemeId = options.sourceSchemeId || null;

    if (schemeA._isVersionSnapshot) {
      _schemeA_isVersion = true;
      _schemeAId = schemeA._sourceVersionId;
      _schemeA = schemeA;
    } else {
      _schemeA_isVersion = false;
      _schemeAId = schemeA.id;
      _schemeA = schemeA;
    }

    if (schemeB._isVersionSnapshot) {
      _schemeB_isVersion = true;
      _schemeBId = schemeB._sourceVersionId;
      _schemeB = schemeB;
    } else {
      _schemeB_isVersion = false;
      _schemeBId = schemeB.id;
      _schemeB = schemeB;
    }

    _alignment = { mode: 'top-left', offsetX: 0, offsetY: 0 };
    _areaSelection = null;
    _areaSelectionSlot = null;

    _recalcAndRender();
  }

  function _getSchemeData(isVersion, id, fallback) {
    if (isVersion) {
      return fallback;
    }
    return SchemeStore.getById(id) || fallback;
  }

  function _recalcAndRender() {
    if (!_schemeA || !_schemeB) return;

    const threads = ThreadStore.getAll();
    _compareResult = CompareCalc.compareAll(_schemeA, _schemeB, threads, _alignment);
    render();
  }

  function recalculate() {
    _recalcAndRender();
  }

  function _buildDiffMap(diffResult) {
    const mapA = {};
    const mapB = {};

    diffResult.differences.forEach(d => {
      if (d.type === 'changed' || d.type === 'missing') {
        mapA[d.idxA] = d.type;
      }
      if (d.type === 'changed' || d.type === 'added') {
        mapB[d.idxB] = d.type;
      }
    });

    return { mapA, mapB };
  }

  function renderGrid(scheme, slot, diffResult) {
    const threads = ThreadStore.getAll();
    const sorted = ThreadModel.sortByOrder(threads);
    const firstColor = sorted.length > 0 ? sorted[0].color : "#cccccc";
    const { mapA, mapB } = _buildDiffMap(diffResult);
    const diffMap = slot === 'A' ? mapA : mapB;

    const isSelectingArea = _areaSelectionSlot === slot;
    const sel = _areaSelectionSlot === slot ? _areaSelection : null;

    let cellHtml = '';
    for (let i = 0; i < scheme.cells.length; i++) {
      const cellId = scheme.cells[i];
      const color = ThreadModel.getColorById(sorted, cellId) || firstColor;
      const diffType = _showDifferences && diffResult.canCompare ? diffMap[i] : null;
      const diffClass = diffType ? ` cell-diff cell-diff-${diffType}` : '';

      const x = i % scheme.cols;
      const y = Math.floor(i / scheme.cols);
      let inSelection = false;
      if (sel && x >= sel.startX && x <= sel.endX && y >= sel.startY && y <= sel.endY) {
        inSelection = true;
      }
      const selClass = inSelection ? ' compare-cell-selected' : '';

      cellHtml += `<div class="cell compare-cell${diffClass}${selClass}" data-slot="${slot}" data-i="${i}" data-x="${x}" data-y="${y}" style="background:${color}"></div>`;
    }

    const slotLower = slot.toLowerCase();
    const selectable = _sourceSchemeId ? ' compare-grid-selectable' : '';

    return `
      <div class="grid compare-grid${selectable}" data-slot="${slot}" data-cols="${scheme.cols}" data-rows="${scheme.rows}" style="grid-template-columns:repeat(${scheme.cols},1fr)">
        ${cellHtml}
      </div>
      ${_sourceSchemeId ? `
        <div class="compare-grid-toolbar">
          ${isSelectingArea ? `<span class="compare-area-hint">拖拽选择恢复区域${sel ? ' (' + (sel.endX - sel.startX + 1) + '×' + (sel.endY - sel.startY + 1) + ')' : ''}</span>` : ''}
          <button class="secondary small compare-area-btn" data-slot="${slot}" data-action="toggle-select-area">${isSelectingArea ? '取消区域选择' : '选择区域恢复'}</button>
          ${sel ? `<button class="vt-btn-restore small compare-area-btn" data-slot="${slot}" data-action="restore-area">恢复所选区域到当前方案</button>` : ''}
        </div>
      ` : ''}
    `;
  }

  function renderDimensionBadge(dim) {
    const dimA = dim.a;
    const dimB = dim.b;
    const same = dim.sameSize;

    if (same) {
      return `<span class="compare-badge">尺寸相同：${dimA.cols}×${dimA.rows}</span>`;
    }

    return `
      <span class="compare-badge badge-warning">尺寸不同：A ${dimA.cols}×${dimA.rows} vs B ${dimB.cols}×${dimB.rows}</span>
    `;
  }

  function renderAlignmentControls(cellDiff) {
    const sameSize = cellDiff.sameSize;
    if (sameSize) return '';

    const modes = [
      { key: 'top-left', label: '左上对齐' },
      { key: 'center', label: '居中对齐' },
      { key: 'custom', label: '自定义偏移' }
    ];

    const alignment = cellDiff.alignment || _alignment;
    const isCustom = alignment.mode === 'custom';
    const schemeA = _schemeA;
    const maxOffsetX = schemeA ? Math.max(schemeA.cols - 1, 20) : 20;
    const maxOffsetY = schemeA ? Math.max(schemeA.rows - 1, 20) : 20;

    return `
      <div class="alignment-controls">
        <span class="alignment-label">对齐方式</span>
        <div class="alignment-mode-group">
          ${modes.map(m => `
            <button class="alignment-mode-btn ${alignment.mode === m.key ? 'active' : ''}" data-mode="${m.key}">${m.label}</button>
          `).join('')}
        </div>
        ${isCustom ? `
          <div class="custom-offset-group">
            <label>横向偏移
              <input type="number" id="offsetXInput" value="${alignment.offsetX}" min="-${maxOffsetX}" max="${maxOffsetX}" step="1">
            </label>
            <label>纵向偏移
              <input type="number" id="offsetYInput" value="${alignment.offsetY}" min="-${maxOffsetY}" max="${maxOffsetY}" step="1">
            </label>
            <button class="secondary small" id="applyOffsetBtn">应用</button>
          </div>
        ` : ''}
      </div>
    `;
  }

  function renderFilledCellsSection(filled) {
    const diffSign = filled.diff > 0 ? '+' : '';
    const diffClass = filled.diff > 0 ? 'diff-positive' : (filled.diff < 0 ? 'diff-negative' : '');

    return `
      <div class="compare-section">
        <h4>已填格数量</h4>
        <div class="compare-stats-row">
          <div class="compare-stat-item slot-a">
            <span class="stat-label">方案 A</span>
            <span class="stat-value">${filled.a.count} / ${filled.a.total}</span>
            <span class="stat-sub">${filled.a.ratio}%</span>
          </div>
          <div class="compare-stat-diff ${diffClass}">${diffSign}${filled.diff}</div>
          <div class="compare-stat-item slot-b">
            <span class="stat-label">方案 B</span>
            <span class="stat-value">${filled.b.count} / ${filled.b.total}</span>
            <span class="stat-sub">${filled.b.ratio}%</span>
          </div>
        </div>
      </div>
    `;
  }

  function renderColorUsageSection(colorUsage) {
    const rows = colorUsage.usageDiff.map(item => {
      const diffSign = item.diff > 0 ? '+' : '';
      const diffClass = item.diff > 0 ? 'diff-positive' : (item.diff < 0 ? 'diff-negative' : 'diff-zero');

      return `
        <div class="compare-color-row">
          <span class="color-swatch" style="background:${item.color}"></span>
          <span class="color-name">${escapeHtml(item.name)}</span>
          <span class="color-count">${item.countA}</span>
          <span class="color-diff ${diffClass}">${diffSign}${item.diff}</span>
          <span class="color-count">${item.countB}</span>
        </div>
      `;
    }).join('');

    return `
      <div class="compare-section">
        <h4>色线用量对比</h4>
        <div class="compare-color-header">
          <span></span>
          <span>色线</span>
          <span class="header-a">A</span>
          <span>差异</span>
          <span class="header-b">B</span>
        </div>
        <div class="compare-color-list">
          ${rows}
        </div>
      </div>
    `;
  }

  function renderYarnEstimateSection(yarnEst) {
    if (!yarnEst || !yarnEst.a || !yarnEst.b) {
      return '';
    }

    const totalDiffSign = yarnEst.totalDiffCm > 0 ? '+' : '';
    const totalDiffClass = yarnEst.totalDiffCm > 0 ? 'diff-positive' : (yarnEst.totalDiffCm < 0 ? 'diff-negative' : 'diff-zero');

    const rows = yarnEst.perThreadDiff.map(item => {
      const diffSign = item.diff > 0 ? '+' : '';
      const diffClass = item.diff > 0 ? 'diff-positive' : (item.diff < 0 ? 'diff-negative' : 'diff-zero');
      const formatLen = (cm) => typeof YarnEstimate !== 'undefined' ? YarnEstimate.formatLength(cm) : (cm.toFixed(1) + ' cm');

      return `
        <div class="compare-color-row">
          <span class="color-swatch" style="background:${item.color}"></span>
          <span class="color-name">${escapeHtml(item.name)}</span>
          <span class="color-count">${formatLen(item.recommendedA)}</span>
          <span class="color-diff ${diffClass}">${diffSign}${formatLen(Math.abs(item.diff))}</span>
          <span class="color-count">${formatLen(item.recommendedB)}</span>
        </div>
      `;
    }).join('');

    const formatLen = (cm) => typeof YarnEstimate !== 'undefined' ? YarnEstimate.formatLength(cm) : (cm.toFixed(1) + ' cm');

    return `
      <div class="compare-section">
        <h4>色线备料长度对比（含损耗+余量）</h4>
        <div class="compare-stats-row">
          <div class="compare-stat-item slot-a">
            <span class="stat-label">方案 A 总备料</span>
            <span class="stat-value">${formatLen(yarnEst.a.totals.recommendedCm)}</span>
          </div>
          <div class="compare-stat-diff ${totalDiffClass}">${totalDiffSign}${formatLen(Math.abs(yarnEst.totalDiffCm))}</div>
          <div class="compare-stat-item slot-b">
            <span class="stat-label">方案 B 总备料</span>
            <span class="stat-value">${formatLen(yarnEst.b.totals.recommendedCm)}</span>
          </div>
        </div>
        <div class="compare-color-header">
          <span></span>
          <span>色线</span>
          <span class="header-a">A 建议备料</span>
          <span>差异</span>
          <span class="header-b">B 建议备料</span>
        </div>
        <div class="compare-color-list">
          ${rows}
        </div>
      </div>
    `;
  }

  function renderRiskRowsSection(risk) {
    const formatList = (arr) => arr.length > 0 ? arr.join('、') : '无';

    return `
      <div class="compare-section">
        <h4>断线风险行</h4>
        <div class="compare-risk-row">
          <div class="risk-col">
            <span class="risk-label">方案 A</span>
            <span class="risk-count ${risk.a.length > 0 ? 'has-risk' : ''}">${risk.a.length} 行</span>
            <div class="risk-list">${formatList(risk.a)}</div>
          </div>
          <div class="risk-col">
            <span class="risk-label">共有</span>
            <span class="risk-count">${risk.common.length} 行</span>
            <div class="risk-list">${formatList(risk.common)}</div>
          </div>
          <div class="risk-col">
            <span class="risk-label">方案 B</span>
            <span class="risk-count ${risk.b.length > 0 ? 'has-risk' : ''}">${risk.b.length} 行</span>
            <div class="risk-list">${formatList(risk.b)}</div>
          </div>
        </div>
        ${risk.onlyA.length > 0 || risk.onlyB.length > 0 ? `
          <div class="risk-diff-notes">
            ${risk.onlyA.length > 0 ? `<div class="risk-note only-a">仅 A 有风险：第${risk.onlyA.join('、')}行</div>` : ''}
            ${risk.onlyB.length > 0 ? `<div class="risk-note only-b">仅 B 有风险：第${risk.onlyB.join('、')}行</div>` : ''}
          </div>
        ` : ''}
      </div>
    `;
  }

  function renderCellDiffSection(cellDiff) {
    const sameSize = cellDiff.sameSize;

    if (sameSize) {
      return `
        <div class="compare-section">
          <h4>逐格差异</h4>
          <div class="compare-diff-summary">
            <span class="diff-badge">相同 ${cellDiff.sameCount} 格</span>
            <span class="diff-badge diff-changed">颜色变化 ${cellDiff.changedCount} 格</span>
            <span class="diff-badge">差异率 ${cellDiff.diffRatio}%</span>
          </div>
          <div class="diff-legend">
            <span class="legend-item"><span class="legend-swatch legend-changed"></span>颜色变化</span>
          </div>
        </div>
      `;
    }

    return `
      <div class="compare-section">
        <h4>逐格差异</h4>
        ${renderAlignmentControls(cellDiff)}
        <div class="compare-diff-summary">
          <span class="diff-badge">相同 ${cellDiff.sameCount} 格</span>
          <span class="diff-badge diff-changed">颜色变化 ${cellDiff.changedCount} 格</span>
          <span class="diff-badge diff-missing">A 独有 ${cellDiff.missingCount} 格</span>
          <span class="diff-badge diff-added">B 新增 ${cellDiff.addedCount} 格</span>
        </div>
        <p class="diff-message">${cellDiff.message}</p>
        <div class="diff-legend">
          <span class="legend-item"><span class="legend-swatch legend-changed"></span>颜色变化</span>
          <span class="legend-item"><span class="legend-swatch legend-missing"></span>A 独有（B 缺失）</span>
          <span class="legend-item"><span class="legend-swatch legend-added"></span>B 新增（A 缺失）</span>
        </div>
      </div>
    `;
  }

  function renderRestoreActions() {
    if (!_sourceSchemeId) return '';

    const aLabel = _schemeA_isVersion ? '历史版本 A' : '方案 A';
    const bLabel = _schemeB_isVersion ? '历史版本 B' : '方案 B';

    return `
      <div class="compare-section compare-restore-section">
        <h4>恢复操作</h4>
        <p class="compare-restore-hint">可将对比中的方案恢复。恢复到当前方案的操作均支持撤销。</p>
        <div class="compare-restore-grid">
          <div class="compare-restore-col slot-a">
            <div class="compare-restore-col-title">${aLabel}</div>
            <div class="compare-restore-btns">
              <button class="secondary small" data-action="restore-new" data-slot="A">恢复为新方案</button>
              <button class="vt-btn-restore small" data-action="restore-current" data-slot="A">整体恢复到当前</button>
            </div>
          </div>
          <div class="compare-restore-col slot-b">
            <div class="compare-restore-col-title">${bLabel}</div>
            <div class="compare-restore-btns">
              <button class="secondary small" data-action="restore-new" data-slot="B">恢复为新方案</button>
              <button class="vt-btn-restore small" data-action="restore-current" data-slot="B">整体恢复到当前</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function render() {
    if (!_container || !_compareResult || !_schemeA || !_schemeB) return;

    const { dimensions, filledCells, colorUsage, riskRows, cellDiff, yarnEstimate } = _compareResult;

    const canToggleDiff = cellDiff.canCompare && cellDiff.diffCount > 0;

    let html = `
      <div class="compare-view">
        <div class="compare-header">
          <div class="compare-header-left">
            <button class="secondary" id="compareBackBtn">← 返回选择</button>
            <h3>${_sourceSchemeId ? '历史版本对比' : '方案对比'}</h3>
          </div>
          <div class="compare-header-right">
            ${renderDimensionBadge(dimensions)}
            ${canToggleDiff ? `
              <label class="compare-toggle">
                <input type="checkbox" id="toggleDiff" ${_showDifferences ? 'checked' : ''}>
                <span>高亮差异</span>
              </label>
            ` : ''}
          </div>
        </div>

        <div class="compare-panels">
          <div class="compare-panel slot-a">
            <div class="compare-panel-header">
              <span class="compare-slot-badge slot-a">方案 A</span>
              <span class="compare-panel-title">${escapeHtml(_schemeA.name)}</span>
              <span class="compare-panel-size">${dimensions.a.cols}×${dimensions.a.rows}</span>
              ${_schemeA_isVersion ? '<span class="compare-version-tag">历史版本</span>' : ''}
            </div>
            ${renderGrid(_schemeA, 'A', cellDiff)}
          </div>

          <div class="compare-panel slot-b">
            <div class="compare-panel-header">
              <span class="compare-slot-badge slot-b">方案 B</span>
              <span class="compare-panel-title">${escapeHtml(_schemeB.name)}</span>
              <span class="compare-panel-size">${dimensions.b.cols}×${dimensions.b.rows}</span>
              ${_schemeB_isVersion ? '<span class="compare-version-tag">历史版本</span>' : ''}
            </div>
            ${renderGrid(_schemeB, 'B', cellDiff)}
          </div>
        </div>

        <div class="compare-details">
          ${renderFilledCellsSection(filledCells)}
          ${renderColorUsageSection(colorUsage)}
          ${renderYarnEstimateSection(yarnEstimate)}
          ${renderRiskRowsSection(riskRows)}
          ${renderCellDiffSection(cellDiff)}
          ${renderRestoreActions()}
        </div>
      </div>
    `;

    _container.innerHTML = html;
    bindEvents();
  }

  function bindEvents() {
    if (!_container) return;

    const backBtn = _container.querySelector('#compareBackBtn');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        if (typeof _onBack === 'function') {
          _onBack();
        }
      });
    }

    const toggleDiff = _container.querySelector('#toggleDiff');
    if (toggleDiff) {
      toggleDiff.addEventListener('change', (e) => {
        _showDifferences = e.target.checked;
        render();
      });
    }

    const alignmentBtns = _container.querySelectorAll('.alignment-mode-btn');
    alignmentBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        _alignment.mode = mode;
        if (mode !== 'custom') {
          _alignment.offsetX = 0;
          _alignment.offsetY = 0;
        }
        _recalcAndRender();
      });
    });

    const applyOffsetBtn = _container.querySelector('#applyOffsetBtn');
    if (applyOffsetBtn) {
      applyOffsetBtn.addEventListener('click', () => {
        const xInput = _container.querySelector('#offsetXInput');
        const yInput = _container.querySelector('#offsetYInput');
        if (xInput && yInput) {
          _alignment.offsetX = parseInt(xInput.value, 10) || 0;
          _alignment.offsetY = parseInt(yInput.value, 10) || 0;
          _recalcAndRender();
        }
      });
    }

    const restoreNewBtns = _container.querySelectorAll('[data-action="restore-new"]');
    restoreNewBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const slot = btn.dataset.slot;
        _handleRestoreNew(slot);
      });
    });

    const restoreCurrentBtns = _container.querySelectorAll('[data-action="restore-current"]');
    restoreCurrentBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const slot = btn.dataset.slot;
        _handleRestoreCurrent(slot);
      });
    });

    const toggleSelAreaBtns = _container.querySelectorAll('[data-action="toggle-select-area"]');
    toggleSelAreaBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const slot = btn.dataset.slot;
        if (_areaSelectionSlot === slot) {
          _areaSelectionSlot = null;
          _areaSelection = null;
        } else {
          _areaSelectionSlot = slot;
          _areaSelection = null;
        }
        render();
      });
    });

    const restoreAreaBtns = _container.querySelectorAll('[data-action="restore-area"]');
    restoreAreaBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const slot = btn.dataset.slot;
        _handleRestoreArea(slot);
      });
    });

    _bindAreaSelection();
  }

  function _bindAreaSelection() {
    if (!_container) return;
    const grids = _container.querySelectorAll('.compare-grid-selectable');
    grids.forEach(grid => {
      const slot = grid.dataset.slot;
      const cols = parseInt(grid.dataset.cols, 10);
      const rows = parseInt(grid.dataset.rows, 10);

      grid.addEventListener('pointerdown', (e) => {
        if (_areaSelectionSlot !== slot) return;
        const cell = e.target.closest('.compare-cell');
        if (!cell) return;
        e.preventDefault();
        _areaSelecting = true;
        const x = parseInt(cell.dataset.x, 10);
        const y = parseInt(cell.dataset.y, 10);
        _areaSelStart = { x, y };
        _areaSelection = { startX: x, startY: y, endX: x, endY: y, cols, rows };
        render();
      });

      grid.addEventListener('pointermove', (e) => {
        if (!_areaSelecting || _areaSelectionSlot !== slot) return;
        const cell = e.target.closest('.compare-cell');
        if (!cell) return;
        e.preventDefault();
        const x = parseInt(cell.dataset.x, 10);
        const y = parseInt(cell.dataset.y, 10);
        if (!_areaSelStart) return;
        const startX = Math.min(_areaSelStart.x, x);
        const startY = Math.min(_areaSelStart.y, y);
        const endX = Math.max(_areaSelStart.x, x);
        const endY = Math.max(_areaSelStart.y, y);
        _areaSelection = { startX, startY, endX, endY, cols, rows };
        render();
      });
    });

    document.addEventListener('pointerup', _onAreaSelEnd);
  }

  function _onAreaSelEnd() {
    _areaSelecting = false;
    _areaSelStart = null;
    document.removeEventListener('pointerup', _onAreaSelEnd);
  }

  function _handleRestoreNew(slot) {
    if (!_sourceSchemeId) return;
    const versionId = slot === 'A' ? _schemeAId : _schemeBId;
    const isVersion = slot === 'A' ? _schemeA_isVersion : _schemeB_isVersion;
    if (!isVersion || !versionId) return;

    const newScheme = VersionHistory.restoreAsNewScheme(_sourceSchemeId, versionId);
    if (newScheme) {
      EventBus.emit("scheme:switchRequested", newScheme.id);
    }
  }

  function _handleRestoreCurrent(slot) {
    if (!_sourceSchemeId) return;
    const versionId = slot === 'A' ? _schemeAId : _schemeBId;
    const isVersion = slot === 'A' ? _schemeA_isVersion : _schemeB_isVersion;
    if (!isVersion || !versionId) return;

    if (!confirm("确定将当前方案整体恢复到此历史版本吗？此操作可撤销。")) return;
    const ok = VersionHistory.restoreFullToCurrentScheme(_sourceSchemeId, versionId);
    if (ok) {
      EventBus.emit("grid:changed");
    }
  }

  function _handleRestoreArea(slot) {
    if (!_sourceSchemeId || !_areaSelection || _areaSelectionSlot !== slot) return;
    const versionId = slot === 'A' ? _schemeAId : _schemeBId;
    const isVersion = slot === 'A' ? _schemeA_isVersion : _schemeB_isVersion;
    if (!isVersion || !versionId) return;

    const rect = {
      startX: _areaSelection.startX,
      startY: _areaSelection.startY,
      endX: _areaSelection.endX,
      endY: _areaSelection.endY
    };
    const size = (rect.endX - rect.startX + 1) + "×" + (rect.endY - rect.startY + 1);
    if (!confirm("确定将选中的 " + size + " 区域从此历史版本恢复到当前方案吗？此操作可撤销。")) return;
    const ok = VersionHistory.restoreAreaToCurrentScheme(_sourceSchemeId, versionId, rect);
    if (ok) {
      EventBus.emit("grid:changed");
    }
  }

  function refresh() {
    if (_schemeA && _schemeB) {
      _recalcAndRender();
    } else {
      render();
    }
  }

  return {
    init,
    showCompare,
    refresh,
    recalculate
  };
})();
