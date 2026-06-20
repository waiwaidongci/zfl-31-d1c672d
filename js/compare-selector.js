const CompareSelector = (function() {

  let _selectedA = null;
  let _selectedB = null;
  let _container = null;
  let _onSelectionChange = null;
  let _onStartCompare = null;

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function init(options = {}) {
    _container = options.container || null;
    _onSelectionChange = options.onSelectionChange || null;
    _onStartCompare = options.onStartCompare || null;

    if (!_container) return;
    render();
  }

  function getSchemeCard(scheme, slot, isSelected) {
    const firstId = ThreadStore.getFirstId();
    const filledCount = scheme.cells.filter(v => v !== firstId).length;
    const meta = `${scheme.cols}×${scheme.rows} · ${filledCount} 格已填`;
    const slotLabel = slot === 'A' ? '方案 A' : '方案 B';
    const slotClass = slot === 'A' ? 'slot-a' : 'slot-b';

    return `
      <div class="compare-scheme-card ${isSelected ? 'selected ' + slotClass : ''}" data-id="${scheme.id}">
        ${isSelected ? `<div class="compare-slot-badge ${slotClass}">${slotLabel}</div>` : ''}
        <div class="compare-scheme-name">${escapeHtml(scheme.name)}</div>
        <div class="compare-scheme-meta">${meta}</div>
        <div class="compare-scheme-preview">
          ${renderMiniPreview(scheme)}
        </div>
      </div>
    `;
  }

  function renderMiniPreview(scheme) {
    const threads = ThreadStore.getAll();
    const sorted = ThreadModel.sortByOrder(threads);
    const firstColor = sorted.length > 0 ? sorted[0].color : "#cccccc";
    const previewCols = Math.min(scheme.cols, 12);
    const previewRows = Math.min(scheme.rows, 12);

    let html = '';
    for (let y = 0; y < previewRows; y++) {
      for (let x = 0; x < previewCols; x++) {
        const idx = y * scheme.cols + x;
        const cellId = scheme.cells[idx];
        const color = ThreadModel.getColorById(sorted, cellId) || firstColor;
        html += `<div class="compare-mini-cell" style="background:${color}"></div>`;
      }
    }

    return `<div class="compare-mini-grid" style="grid-template-columns:repeat(${previewCols},1fr)">${html}</div>`;
  }

  function render() {
    if (!_container) return;

    const schemes = SchemeStore.getAll();
    const activeId = SchemeStore.getActiveId();

    if (!_selectedA && schemes.length > 0) {
      _selectedA = activeId;
    }
    if (!_selectedB && schemes.length > 1) {
      _selectedB = schemes.find(s => s.id !== _selectedA)?.id || null;
    }

    const canCompare = _selectedA && _selectedB && _selectedA !== _selectedB;

    let html = `
      <div class="compare-selector-header">
        <h3>选择对比方案</h3>
        <p class="compare-hint">点击选择两个方案进行并排对比</p>
      </div>

      <div class="compare-selected-info">
        <div class="compare-selected-item ${_selectedA ? 'has-selection' : ''}">
          <span class="compare-slot-label slot-a">A</span>
          <span class="compare-selected-name">${_selectedA ? escapeHtml(SchemeStore._schemes[_selectedA]?.name || '未选择') : '请选择方案 A'}</span>
        </div>
        <div class="compare-vs">VS</div>
        <div class="compare-selected-item ${_selectedB ? 'has-selection' : ''}">
          <span class="compare-slot-label slot-b">B</span>
          <span class="compare-selected-name">${_selectedB ? escapeHtml(SchemeStore._schemes[_selectedB]?.name || '未选择') : '请选择方案 B'}</span>
        </div>
      </div>

      <div class="compare-scheme-grid">
        ${schemes.map(scheme => {
          const isA = scheme.id === _selectedA;
          const isB = scheme.id === _selectedB;
          const isSelected = isA || isB;
          const slot = isA ? 'A' : (isB ? 'B' : null);
          return getSchemeCard(scheme, slot, isSelected);
        }).join('')}
      </div>

      <div class="compare-actions">
        <button class="secondary" id="compareSwapBtn" ${!canCompare ? 'disabled' : ''}>⇄ 交换 A/B</button>
        <button id="compareStartBtn" ${!canCompare ? 'disabled' : ''}>开始对比</button>
      </div>
    `;

    _container.innerHTML = html;
    bindEvents();
  }

  function bindEvents() {
    if (!_container) return;

    _container.querySelectorAll('.compare-scheme-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.id;
        handleSchemeClick(id);
      });
    });

    const swapBtn = _container.querySelector('#compareSwapBtn');
    if (swapBtn) {
      swapBtn.addEventListener('click', handleSwap);
    }

    const startBtn = _container.querySelector('#compareStartBtn');
    if (startBtn) {
      startBtn.addEventListener('click', handleStartCompare);
    }
  }

  function handleSchemeClick(id) {
    if (id === _selectedA) {
      _selectedA = null;
    } else if (id === _selectedB) {
      _selectedB = null;
    } else if (!_selectedA) {
      _selectedA = id;
    } else if (!_selectedB) {
      _selectedB = id;
    } else {
      _selectedA = _selectedB;
      _selectedB = id;
    }

    if (typeof _onSelectionChange === 'function') {
      _onSelectionChange({ selectedA: _selectedA, selectedB: _selectedB });
    }

    render();
  }

  function handleSwap() {
    const temp = _selectedA;
    _selectedA = _selectedB;
    _selectedB = temp;

    if (typeof _onSelectionChange === 'function') {
      _onSelectionChange({ selectedA: _selectedA, selectedB: _selectedB });
    }

    render();
  }

  function handleStartCompare() {
    if (!_selectedA || !_selectedB || _selectedA === _selectedB) return;

    const schemeA = SchemeStore._schemes[_selectedA];
    const schemeB = SchemeStore._schemes[_selectedB];

    if (schemeA && schemeB && typeof _onStartCompare === 'function') {
      _onStartCompare(schemeA, schemeB);
    }
  }

  function setSelection(idA, idB) {
    _selectedA = idA;
    _selectedB = idB;
    render();
  }

  function getSelection() {
    return {
      selectedA: _selectedA,
      selectedB: _selectedB
    };
  }

  function refresh() {
    render();
  }

  return {
    init,
    render,
    setSelection,
    getSelection,
    refresh
  };
})();
