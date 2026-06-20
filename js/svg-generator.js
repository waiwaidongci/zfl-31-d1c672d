const SvgGenerator = (function() {

  function escapeXml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  function buildLegend(threads, usedStats, cellSize, startX, startY) {
    const legendPadding = 8;
    const legendRowHeight = 22;
    const legendColorSize = 16;
    const legendFontSize = 12;
    const legendTitleSize = 14;

    const sorted = ThreadModel.sortByOrder(threads);
    const usedThreads = sorted.filter(t =>
      usedStats.some(s => s.id === t.id && s.count > 0)
    );

    const items = [];
    items.push(`<text x="${startX}" y="${startY}" font-family="Arial, sans-serif" font-size="${legendTitleSize}" font-weight="bold" fill="#282018">色线图例</text>`);

    let y = startY + legendTitleSize + legendPadding;

    usedThreads.forEach(thread => {
      const stat = usedStats.find(s => s.id === thread.id);
      const count = stat ? stat.count : 0;

      items.push(`<rect x="${startX}" y="${y}" width="${legendColorSize}" height="${legendColorSize}" fill="${thread.color}" stroke="#d9cdbc" stroke-width="1"/>`);
      const label = `${escapeXml(thread.name)} — ${count} 格${thread.note ? '（' + escapeXml(thread.note) + '）' : ''}`;
      items.push(`<text x="${startX + legendColorSize + 8}" y="${y + legendColorSize - 2}" font-family="Arial, sans-serif" font-size="${legendFontSize}" fill="#282018">${label}</text>`);

      y += legendRowHeight;
    });

    const legendW = Math.max(180, 200);
    const legendH = legendTitleSize + legendPadding + usedThreads.length * legendRowHeight + legendPadding;

    return {
      svg: items.join('\n'),
      width: legendW,
      height: legendH
    };
  }

  function generate(options) {
    const {
      cells,
      cols,
      rows,
      threads,
      schemeName,
      cellSize = 20,
      showGrid = true,
      showLegend = true,
      transparentBg = false,
      showTitle = true,
      margin = 20
    } = options;

    const gridW = cols * cellSize;
    const gridH = rows * cellSize;

    const marginLeft = margin;
    const marginTop = margin;
    const titleFontSize = 18;
    const infoFontSize = 13;
    const titleGap = 8;
    const infoGap = 6;
    const gridGap = 16;
    const gridFrame = showGrid ? 3 : 0;

    const sorted = ThreadModel.sortByOrder(threads);
    const firstColor = sorted.length > 0 ? sorted[0].color : '#cccccc';
    const colorStats = ThreadModel.computeColorStats(cells, threads);

    let contentY = marginTop;

    const parts = [];

    if (showTitle) {
      parts.push(`<text x="${marginLeft}" y="${contentY + titleFontSize}" font-family="Arial, sans-serif" font-size="${titleFontSize}" font-weight="bold" fill="#282018">${escapeXml(schemeName || '织锦纹样')}</text>`);
      contentY += titleFontSize + titleGap;

      const sizeText = `尺寸：${cols} 列 × ${rows} 行（共 ${cols * rows} 格）`;
      const usedCount = colorStats.filter(s => s.count > 0).length;
      const colorText = `用色：${usedCount} 种色线`;
      parts.push(`<text x="${marginLeft}" y="${contentY + infoFontSize}" font-family="Arial, sans-serif" font-size="${infoFontSize}" fill="#5a4e42">${escapeXml(sizeText)}　${escapeXml(colorText)}</text>`);
      contentY += infoFontSize + infoGap;

      contentY += gridGap;
    }

    const gridX = marginLeft + gridFrame;
    const gridY = contentY + gridFrame;

    if (showGrid) {
      parts.push(`<rect x="${gridX - gridFrame}" y="${gridY - gridFrame}" width="${gridW + gridFrame * 2}" height="${gridH + gridFrame * 2}" fill="#72533c"/>`);
    }

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const idx = y * cols + x;
        const threadId = cells[idx];
        const color = ThreadModel.getColorById(sorted, threadId) || firstColor;
        const px = gridX + x * cellSize;
        const py = gridY + y * cellSize;
        parts.push(`<rect x="${px}" y="${py}" width="${cellSize}" height="${cellSize}" fill="${color}"/>`);
      }
    }

    if (showGrid) {
      for (let x = 0; x <= cols; x++) {
        const px = gridX + x * cellSize;
        parts.push(`<line x1="${px}" y1="${gridY}" x2="${px}" y2="${gridY + gridH}" stroke="#72533c" stroke-width="1"/>`);
      }
      for (let y = 0; y <= rows; y++) {
        const py = gridY + y * cellSize;
        parts.push(`<line x1="${gridX}" y1="${py}" x2="${gridX + gridW}" y2="${py}" stroke="#72533c" stroke-width="1"/>`);
      }
    }

    contentY = gridY + gridH + gridFrame;

    let totalW = marginLeft + gridW + gridFrame * 2 + margin;
    let totalH = contentY + margin;

    if (showLegend) {
      contentY += gridGap;
      const legend = buildLegend(threads, colorStats, cellSize, marginLeft, contentY);
      parts.push(legend.svg);
      totalH = contentY + legend.height + margin;
      totalW = Math.max(totalW, marginLeft + legend.width + margin);
    }

    const bgRect = transparentBg ? '' : `  <rect width="100%" height="100%" fill="#fffaf2"/>`;

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${totalW}" height="${totalH}" viewBox="0 0 ${totalW} ${totalH}">
${bgRect}
${parts.map(p => '  ' + p).join('\n')}
</svg>`;

    return {
      svg,
      width: totalW,
      height: totalH
    };
  }

  function generatePreviewSvg(options) {
    return generate(options).svg;
  }

  function downloadSvg(options, filename) {
    const result = generate(options);
    const blob = new Blob([result.svg], { type: 'image/svg+xml;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename || 'brocade-pattern.svg';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 100);
    return result;
  }

  return {
    generate,
    generatePreviewSvg,
    downloadSvg
  };
})();
