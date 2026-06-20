const StatsRender = (function() {

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function renderStats(statsEl, cells, threads) {
    const colorStats = ThreadModel.computeColorStats(cells, threads);
    statsEl.innerHTML = colorStats.map(s =>
      '<div class="stat"><span><span style="display:inline-block;width:14px;height:14px;background:' + s.color + '"></span> ' + escapeHtml(s.name) + '</span><b>' + s.count + '</b></div>'
    ).join("");
  }

  function renderPreview(previewEl, cells, cols, threads) {
    const firstThreadId = threads.length > 0 ? threads[0].id : null;
    previewEl.innerHTML = Array.from({length: 36}, (_, i) => {
      const cellId = cells[(i % 6) + Math.floor(i / 6) * cols] || firstThreadId;
      const color = ThreadStore.getColorById(cellId) || "#cccccc";
      return '<div class="mini" style="background:' + color + '"></div>';
    }).join("");
  }

  function renderPalette(paletteEl, activeThreadId, threads, onSelect) {
    const sorted = ThreadModel.sortByOrder(threads);
    paletteEl.innerHTML = sorted.map(t =>
      '<button class="swatch '+(t.id===activeThreadId?"active":"")+'" data-thread="'+t.id+'" style="background:'+t.color+'" title="'+escapeHtml(t.name)+'"></button>'
    ).join("");

    paletteEl.querySelectorAll("[data-thread]").forEach(el => {
      el.onclick = () => {
        const threadId = el.dataset.thread;
        if (typeof onSelect === "function") {
          onSelect(threadId);
        }
      };
    });
  }

  function renderGrid(gridEl, cells, cols, threads, onCellDown, onCellEnter, isCellSelected) {
    const sorted = ThreadModel.sortByOrder(threads);
    const firstColor = sorted.length > 0 ? sorted[0].color : "#cccccc";

    gridEl.style.gridTemplateColumns = "repeat(" + cols + ", 1fr)";
    gridEl.innerHTML = cells.map((v, i) => {
      const color = ThreadModel.getColorById(sorted, v) || firstColor;
      const selectedClass = (typeof isCellSelected === 'function' && isCellSelected(i)) ? ' selected' : '';
      return '<div class="cell'+selectedClass+'" data-i="'+i+'" style="background:'+color+'"></div>';
    }).join("");

    gridEl.querySelectorAll(".cell").forEach(el => {
      if (typeof onCellDown === "function") {
        el.onpointerdown = (e) => {
          e.stopPropagation();
          onCellDown(Number(el.dataset.i));
        };
      }
      if (typeof onCellEnter === "function") {
        el.onpointerenter = () => onCellEnter(Number(el.dataset.i));
      }
    });
  }

  function computeRiskRows(cells, cols, rows) {
    const riskRows = [];
    for (let y = 0; y < rows; y++) {
      let switches = 0;
      for (let x = 1; x < cols; x++) {
        if (cells[y*cols+x] !== cells[y*cols+x-1]) switches++;
      }
      if (switches > cols * .62) riskRows.push(y + 1);
    }
    return riskRows;
  }

  function renderRisk(riskEl, riskRows) {
    riskEl.innerHTML = riskRows.length
      ? '<p class="warning">第'+riskRows.join("、")+'行换色过密，可能断线。</p>'
      : '<p>暂无明显断线风险。</p>';
  }

  function renderAll(options) {
    const {
      paletteEl,
      gridEl,
      statsEl,
      previewEl,
      riskEl,
      cells,
      cols,
      rows,
      activeThreadId,
      threads,
      onThreadSelect,
      onCellDown,
      onCellEnter,
      isCellSelected
    } = options;

    if (paletteEl && threads) {
      renderPalette(paletteEl, activeThreadId, threads, onThreadSelect);
    }

    if (gridEl && cells && cols && threads) {
      renderGrid(gridEl, cells, cols, threads, onCellDown, onCellEnter, isCellSelected);
    }

    if (statsEl && cells && threads) {
      renderStats(statsEl, cells, threads);
    }

    if (previewEl && cells && cols && threads) {
      renderPreview(previewEl, cells, cols, threads);
    }

    if (riskEl && cells && cols && rows) {
      const riskRows = computeRiskRows(cells, cols, rows);
      renderRisk(riskEl, riskRows);
    }
  }

  return {
    renderStats,
    renderPreview,
    renderPalette,
    renderGrid,
    computeRiskRows,
    renderRisk,
    renderAll
  };
})();
