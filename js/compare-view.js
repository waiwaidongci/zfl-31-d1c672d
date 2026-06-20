const CompareView = (function() {

  let _container = null;
  let _compareResult = null;
  let _onBack = null;
  let _showDifferences = true;
  let _schemeAId = null;
  let _schemeBId = null;
  let _alignment = { mode: 'top-left', offsetX: 0, offsetY: 0 };

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function init(options = {}) {
    _container = options.container || null;
    _onBack = options.onBack || null;
  }

  function showCompare(schemeA, schemeB) {
    if (!_container) return;

    _schemeAId = schemeA.id;
    _schemeBId = schemeB.id;
    _alignment = { mode: 'top-left', offsetX: 0, offsetY: 0 };

    _recalcAndRender();
  }

  function _recalcAndRender() {
    if (!_schemeAId || !_schemeBId) return;

    const schemeA = SchemeStore.getById(_schemeAId);
    const schemeB = SchemeStore.getById(_schemeBId);
    if (!schemeA || !schemeB) return;

    const threads = ThreadStore.getAll();
    _compareResult = CompareCalc.compareAll(schemeA, schemeB, threads, _alignment);
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

    let cellHtml = '';
    for (let i = 0; i < scheme.cells.length; i++) {
      const cellId = scheme.cells[i];
      const color = ThreadModel.getColorById(sorted, cellId) || firstColor;
      const diffType = _showDifferences && diffResult.canCompare ? diffMap[i] : null;
      const diffClass = diffType ? ` cell-diff cell-diff-${diffType}` : '';

      cellHtml += `<div class="cell compare-cell${diffClass}" data-i="${i}" style="background:${color}"></div>`;
    }

    return `
      <div class="grid compare-grid" style="grid-template-columns:repeat(${scheme.cols},1fr)">
        ${cellHtml}
      </div>
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
    const schemeA = SchemeStore.getById(_schemeAId);
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

  function render() {
    if (!_container || !_compareResult) return;

    const { schemeA, schemeB, dimensions, filledCells, colorUsage, riskRows, cellDiff } = _compareResult;
    const fullSchemeA = SchemeStore._schemes[schemeA.id];
    const fullSchemeB = SchemeStore._schemes[schemeB.id];

    if (!fullSchemeA || !fullSchemeB) return;

    const canToggleDiff = cellDiff.canCompare && cellDiff.diffCount > 0;

    let html = `
      <div class="compare-view">
        <div class="compare-header">
          <div class="compare-header-left">
            <button class="secondary" id="compareBackBtn">← 返回选择</button>
            <h3>方案对比</h3>
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
              <span class="compare-panel-title">${escapeHtml(schemeA.name)}</span>
              <span class="compare-panel-size">${dimensions.a.cols}×${dimensions.a.rows}</span>
            </div>
            ${renderGrid(fullSchemeA, 'A', cellDiff)}
          </div>

          <div class="compare-panel slot-b">
            <div class="compare-panel-header">
              <span class="compare-slot-badge slot-b">方案 B</span>
              <span class="compare-panel-title">${escapeHtml(schemeB.name)}</span>
              <span class="compare-panel-size">${dimensions.b.cols}×${dimensions.b.rows}</span>
            </div>
            ${renderGrid(fullSchemeB, 'B', cellDiff)}
          </div>
        </div>

        <div class="compare-details">
          ${renderFilledCellsSection(filledCells)}
          ${renderColorUsageSection(colorUsage)}
          ${renderRiskRowsSection(riskRows)}
          ${renderCellDiffSection(cellDiff)}
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
  }

  function refresh() {
    if (_schemeAId && _schemeBId) {
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
