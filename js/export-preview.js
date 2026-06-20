const ExportPreview = (function() {

  let _container = null;
  let _overlay = null;
  let _previewContainer = null;
  let _unsubscribeConfig = null;
  let _getCurrentData = null;

  function _getSvgPreviewScale(totalW, totalH) {
    const maxW = 560;
    const maxH = 440;
    const scaleX = maxW / totalW;
    const scaleY = maxH / totalH;
    return Math.min(scaleX, scaleY, 1);
  }

  function _renderPreview() {
    if (!_previewContainer || !_getCurrentData) return;

    const data = _getCurrentData();
    if (!data) return;

    const config = ExportConfig.getAll();
    const result = SvgGenerator.generate({
      cells: data.cells,
      cols: data.cols,
      rows: data.rows,
      threads: data.threads,
      schemeName: data.schemeName,
      cellSize: config.cellSize,
      showGrid: config.showGrid,
      showLegend: config.showLegend
    });

    const scale = _getSvgPreviewScale(result.width, result.height);
    const displayW = Math.round(result.width * scale);
    const displayH = Math.round(result.height * scale);

    _previewContainer.innerHTML = `
      <div class="export-preview-canvas" style="width:${displayW}px;height:${displayH}px;">
        ${result.svg}
      </div>
      <div class="export-preview-meta">
        <span>SVG 实际尺寸：${result.width} × ${result.height} px</span>
        <span>预览缩放：${Math.round(scale * 100)}%</span>
      </div>
    `;

    const svgEl = _previewContainer.querySelector('svg');
    if (svgEl) {
      svgEl.style.width = '100%';
      svgEl.style.height = '100%';
      svgEl.removeAttribute('width');
      svgEl.removeAttribute('height');
    }
  }

  function _buildHtml() {
    const config = ExportConfig.getAll();
    const sizeOptions = ExportConfig.getCellSizeOptions();

    const sizeOptionsHtml = sizeOptions.map(opt =>
      `<option value="${opt.value}" ${opt.value === config.cellSize ? 'selected' : ''}>${opt.label}</option>`
    ).join('');

    return `
      <div class="export-preview-overlay" id="exportPreviewOverlay">
        <div class="export-preview-dialog">
          <div class="export-preview-header">
            <h2>SVG 图案导出</h2>
            <button class="export-preview-close" id="exportPreviewClose" title="关闭">✕</button>
          </div>
          <div class="export-preview-body">
            <div class="export-preview-options">
              <label class="export-option">
                <input type="checkbox" id="exportShowGrid" ${config.showGrid ? 'checked' : ''}>
                <span>显示网格边框</span>
              </label>
              <label class="export-option">
                <input type="checkbox" id="exportShowLegend" ${config.showLegend ? 'checked' : ''}>
                <span>附带色线图例</span>
              </label>
              <label class="export-option">
                <span>单格像素大小</span>
                <select id="exportCellSize">
                  ${sizeOptionsHtml}
                </select>
              </label>
            </div>
            <div class="export-preview-area" id="exportPreviewArea"></div>
          </div>
          <div class="export-preview-footer">
            <button class="secondary" id="exportPreviewReset">重置设置</button>
            <button class="secondary" id="exportPreviewCancel">取消</button>
            <button id="exportPreviewDownload">下载 SVG</button>
          </div>
        </div>
      </div>
    `;
  }

  function _bindEvents() {
    if (!_overlay) return;

    const closeBtn = _overlay.querySelector('#exportPreviewClose');
    if (closeBtn) {
      closeBtn.addEventListener('click', close);
    }

    const cancelBtn = _overlay.querySelector('#exportPreviewCancel');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', close);
    }

    const showGridCb = _overlay.querySelector('#exportShowGrid');
    if (showGridCb) {
      showGridCb.addEventListener('change', (e) => {
        ExportConfig.setShowGrid(e.target.checked);
      });
    }

    const showLegendCb = _overlay.querySelector('#exportShowLegend');
    if (showLegendCb) {
      showLegendCb.addEventListener('change', (e) => {
        ExportConfig.setShowLegend(e.target.checked);
      });
    }

    const cellSizeSel = _overlay.querySelector('#exportCellSize');
    if (cellSizeSel) {
      cellSizeSel.addEventListener('change', (e) => {
        ExportConfig.setCellSize(Number(e.target.value));
      });
    }

    const resetBtn = _overlay.querySelector('#exportPreviewReset');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        ExportConfig.reset();
        const showGridCb = _overlay.querySelector('#exportShowGrid');
        const showLegendCb = _overlay.querySelector('#exportShowLegend');
        const cellSizeSel = _overlay.querySelector('#exportCellSize');
        const config = ExportConfig.getAll();
        if (showGridCb) showGridCb.checked = config.showGrid;
        if (showLegendCb) showLegendCb.checked = config.showLegend;
        if (cellSizeSel) cellSizeSel.value = String(config.cellSize);
      });
    }

    const downloadBtn = _overlay.querySelector('#exportPreviewDownload');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => {
        if (!_getCurrentData) return;
        const data = _getCurrentData();
        if (!data) return;
        const config = ExportConfig.getAll();
        const safeName = (data.schemeName || 'brocade-pattern').replace(/[\\/:*?"<>|]/g, '_');
        SvgGenerator.downloadSvg({
          cells: data.cells,
          cols: data.cols,
          rows: data.rows,
          threads: data.threads,
          schemeName: data.schemeName,
          cellSize: config.cellSize,
          showGrid: config.showGrid,
          showLegend: config.showLegend
        }, safeName + '.svg');
      });
    }

    _overlay.addEventListener('click', (e) => {
      if (e.target === _overlay) {
        close();
      }
    });

    document.addEventListener('keydown', _handleKeydown);
  }

  function _handleKeydown(e) {
    if (e.key === 'Escape' && _overlay && _overlay.parentNode) {
      e.preventDefault();
      close();
    }
  }

  function init(options) {
    if (options && typeof options.getCurrentData === 'function') {
      _getCurrentData = options.getCurrentData;
    }
  }

  function open() {
    if (!_getCurrentData) {
      console.warn('ExportPreview: getCurrentData not set');
      return;
    }

    if (_overlay && _overlay.parentNode) {
      _renderPreview();
      _overlay.style.display = '';
      return;
    }

    ExportConfig.load();

    const wrapper = document.createElement('div');
    wrapper.innerHTML = _buildHtml();
    _overlay = wrapper.firstElementChild;
    document.body.appendChild(_overlay);

    _previewContainer = _overlay.querySelector('#exportPreviewArea');

    _bindEvents();

    _unsubscribeConfig = ExportConfig.subscribe(() => {
      _renderPreview();
    });

    _renderPreview();
  }

  function close() {
    document.removeEventListener('keydown', _handleKeydown);
    if (_unsubscribeConfig) {
      _unsubscribeConfig();
      _unsubscribeConfig = null;
    }
    if (_overlay) {
      if (_overlay.parentNode) {
        _overlay.parentNode.removeChild(_overlay);
      }
      _overlay = null;
      _previewContainer = null;
    }
  }

  return {
    init,
    open,
    close
  };
})();
