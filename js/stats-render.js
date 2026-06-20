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

  function renderGrid(gridEl, cells, cols, threads, onCellDown, onCellEnter, isCellSelected, templatePreview) {
    const sorted = ThreadModel.sortByOrder(threads);
    const firstColor = sorted.length > 0 ? sorted[0].color : "#cccccc";

    const previewMap = {};
    if (Array.isArray(templatePreview)) {
      templatePreview.forEach(p => {
        previewMap[p.index] = p;
      });
    }

    gridEl.style.gridTemplateColumns = "repeat(" + cols + ", 1fr)";
    gridEl.innerHTML = cells.map((v, i) => {
      const color = ThreadModel.getColorById(sorted, v) || firstColor;
      const selectedClass = (typeof isCellSelected === 'function' && isCellSelected(i)) ? ' selected' : '';

      let previewClass = '';
      let previewStyle = '';
      const preview = previewMap[i];
      if (preview) {
        const previewColor = ThreadModel.getColorById(sorted, preview.threadId) || firstColor;
        previewClass = preview.isOverwrite ? ' tpl-preview tpl-preview-overwrite' : ' tpl-preview tpl-preview-skip';
        previewStyle = ' --tpl-preview-color:' + previewColor + ';';
      }

      return '<div class="cell'+selectedClass+previewClass+'" data-i="'+i+'" style="background:'+color+';'+previewStyle+'"></div>';
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
    if (typeof ProcessCalc !== 'undefined') {
      const steps = ProcessCalc.computeAllSteps(cells, cols, rows);
      return steps.filter(s => s.riskLevel === 'high' || s.riskLevel === 'medium').map(s => ({
        row: s.row,
        level: s.riskLevel,
        note: s.riskNote
      }));
    }

    const riskConfig = typeof RiskConfig !== 'undefined'
      ? RiskConfig.getAll()
      : { highRiskThreshold: 0.62, mediumRiskThreshold: 0.35, countShortSegments: false, shortSegmentMaxLength: 2 };

    const riskRows = [];
    for (let y = 0; y < rows; y++) {
      const start = y * cols;
      const segments = [];
      let currentColor = cells[start];
      let currentLength = 1;

      for (let x = 1; x < cols; x++) {
        const c = cells[start + x];
        if (c === currentColor) {
          currentLength++;
        } else {
          segments.push({ threadId: currentColor, length: currentLength });
          currentColor = c;
          currentLength = 1;
        }
      }
      segments.push({ threadId: currentColor, length: currentLength });

      let switches = 0;
      for (let i = 1; i < segments.length; i++) {
        if (segments[i].threadId !== segments[i - 1].threadId) {
          switches++;
        }
      }

      let effectiveSwitches = switches;
      if (riskConfig.countShortSegments) {
        let shortCount = 0;
        for (let i = 0; i < segments.length; i++) {
          if (segments[i].length <= riskConfig.shortSegmentMaxLength) {
            shortCount++;
          }
        }
        effectiveSwitches += shortCount;
      }

      if (effectiveSwitches > cols * riskConfig.highRiskThreshold) {
        riskRows.push({ row: y + 1, level: 'high' });
      } else if (effectiveSwitches > cols * riskConfig.mediumRiskThreshold) {
        riskRows.push({ row: y + 1, level: 'medium' });
      }
    }
    return riskRows;
  }

  function renderRisk(riskEl, riskRows) {
    if (!riskRows || riskRows.length === 0) {
      riskEl.innerHTML = '<p>暂无明显断线风险。</p>';
      return;
    }

    const highRisk = riskRows.filter(r => r.level === 'high');
    const mediumRisk = riskRows.filter(r => r.level === 'medium');

    let html = '';
    if (highRisk.length > 0) {
      html += '<p class="warning">第' + highRisk.map(r => r.row).join('、') + '行换色过密，断线风险高。</p>';
    }
    if (mediumRisk.length > 0) {
      html += '<p class="warning-medium">第' + mediumRisk.map(r => r.row).join('、') + '行换色较频繁，注意张力。</p>';
    }
    riskEl.innerHTML = html;
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
      isCellSelected,
      templatePreview
    } = options;

    if (paletteEl && threads) {
      renderPalette(paletteEl, activeThreadId, threads, onThreadSelect);
    }

    if (gridEl && cells && cols && threads) {
      renderGrid(gridEl, cells, cols, threads, onCellDown, onCellEnter, isCellSelected, templatePreview);
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
