const CompareCalc = (function() {

  function compareDimensions(schemeA, schemeB) {
    return {
      a: { cols: schemeA.cols, rows: schemeA.rows },
      b: { cols: schemeB.cols, rows: schemeB.rows },
      sameSize: schemeA.cols === schemeB.cols && schemeA.rows === schemeB.rows,
      colsDiff: schemeB.cols - schemeA.cols,
      rowsDiff: schemeB.rows - schemeA.rows
    };
  }

  function countFilledCells(cells, firstThreadId) {
    return cells.filter(v => v !== firstThreadId).length;
  }

  function compareFilledCells(schemeA, schemeB, firstThreadId) {
    const filledA = countFilledCells(schemeA.cells, firstThreadId);
    const filledB = countFilledCells(schemeB.cells, firstThreadId);
    const totalA = schemeA.cols * schemeA.rows;
    const totalB = schemeB.cols * schemeB.rows;

    return {
      a: { count: filledA, total: totalA, ratio: (filledA / totalA * 100).toFixed(1) },
      b: { count: filledB, total: totalB, ratio: (filledB / totalB * 100).toFixed(1) },
      diff: filledB - filledA,
      diffRatio: ((filledB / totalB - filledA / totalA) * 100).toFixed(1)
    };
  }

  function compareColorUsage(schemeA, schemeB, threads) {
    const statsA = ThreadModel.computeColorStats(schemeA.cells, threads);
    const statsB = ThreadModel.computeColorStats(schemeB.cells, threads);

    const allThreadIds = new Set([...statsA.map(s => s.id), ...statsB.map(s => s.id)]);
    const usageDiff = [];

    allThreadIds.forEach(threadId => {
      const statA = statsA.find(s => s.id === threadId);
      const statB = statsB.find(s => s.id === threadId);
      const thread = threads.find(t => t.id === threadId);

      if (thread) {
        usageDiff.push({
          threadId,
          name: thread.name,
          color: thread.color,
          countA: statA ? statA.count : 0,
          countB: statB ? statB.count : 0,
          diff: (statB ? statB.count : 0) - (statA ? statA.count : 0)
        });
      }
    });

    usageDiff.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

    return {
      statsA,
      statsB,
      usageDiff,
      totalA: statsA.reduce((sum, s) => sum + s.count, 0),
      totalB: statsB.reduce((sum, s) => sum + s.count, 0)
    };
  }

  function getRiskRows(cells, cols, rows) {
    if (typeof ProcessCalc !== 'undefined') {
      const steps = ProcessCalc.computeAllSteps(cells, cols, rows);
      return steps.filter(s => s.riskLevel === 'high' || s.riskLevel === 'medium').map(s => s.row);
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

      if (effectiveSwitches > cols * riskConfig.highRiskThreshold ||
          effectiveSwitches > cols * riskConfig.mediumRiskThreshold) {
        riskRows.push(y + 1);
      }
    }
    return riskRows;
  }

  function getRiskRowsDetail(cells, cols, rows) {
    if (typeof ProcessCalc !== 'undefined') {
      const steps = ProcessCalc.computeAllSteps(cells, cols, rows);
      return steps.map(s => ({
        row: s.row,
        level: s.riskLevel,
        note: s.riskNote,
        switchCount: s.switchCount,
        shortSegmentCount: s.shortSegmentCount,
        effectiveSwitchCount: s.effectiveSwitchCount
      }));
    }
    return getRiskRows(cells, cols, rows).map(r => ({ row: r, level: 'high' }));
  }

  function compareRiskRows(schemeA, schemeB) {
    const riskA = getRiskRows(schemeA.cells, schemeA.cols, schemeA.rows);
    const riskB = getRiskRows(schemeB.cells, schemeB.cols, schemeB.rows);

    const setA = new Set(riskA);
    const setB = new Set(riskB);

    const common = riskA.filter(r => setB.has(r));
    const onlyA = riskA.filter(r => !setB.has(r));
    const onlyB = riskB.filter(r => !setA.has(r));

    return {
      a: riskA,
      b: riskB,
      common,
      onlyA,
      onlyB,
      diffCount: riskB.length - riskA.length
    };
  }

  function computeAlignmentOffset(schemeA, schemeB, alignment) {
    const mode = alignment && alignment.mode ? alignment.mode : 'top-left';
    let offsetX = 0;
    let offsetY = 0;

    if (mode === 'center') {
      offsetX = Math.floor((schemeA.cols - schemeB.cols) / 2);
      offsetY = Math.floor((schemeA.rows - schemeB.rows) / 2);
    } else if (mode === 'custom' && alignment) {
      offsetX = alignment.offsetX != null ? alignment.offsetX : 0;
      offsetY = alignment.offsetY != null ? alignment.offsetY : 0;
    }

    return { mode, offsetX, offsetY };
  }

  function computeCellDifferences(schemeA, schemeB, alignment) {
    const sameSize = schemeA.cols === schemeB.cols && schemeA.rows === schemeB.rows;
    const offset = computeAlignmentOffset(schemeA, schemeB, alignment);

    const differences = [];
    let changedCount = 0;
    let missingCount = 0;
    let addedCount = 0;
    let sameCount = 0;

    for (let y = 0; y < schemeA.rows; y++) {
      for (let x = 0; x < schemeA.cols; x++) {
        const idxA = y * schemeA.cols + x;
        const cellA = schemeA.cells[idxA];
        const bx = x - offset.offsetX;
        const by = y - offset.offsetY;

        if (bx >= 0 && bx < schemeB.cols && by >= 0 && by < schemeB.rows) {
          const idxB = by * schemeB.cols + bx;
          const cellB = schemeB.cells[idxB];
          if (cellA !== cellB) {
            differences.push({
              type: 'changed',
              x, y,
              idxA, idxB,
              cellA, cellB
            });
            changedCount++;
          } else {
            sameCount++;
          }
        } else {
          differences.push({
            type: 'missing',
            x, y,
            idxA,
            cellA
          });
          missingCount++;
        }
      }
    }

    for (let by = 0; by < schemeB.rows; by++) {
      for (let bx = 0; bx < schemeB.cols; bx++) {
        const ax = bx + offset.offsetX;
        const ay = by + offset.offsetY;
        if (ax < 0 || ax >= schemeA.cols || ay < 0 || ay >= schemeA.rows) {
          const idxB = by * schemeB.cols + bx;
          const cellB = schemeB.cells[idxB];
          differences.push({
            type: 'added',
            x: ax, y: ay,
            bx, by,
            idxB,
            cellB
          });
          addedCount++;
        }
      }
    }

    const diffCount = changedCount + missingCount + addedCount;
    const totalCount = schemeA.cols * schemeA.rows + addedCount;
    const overlapCount = sameCount + changedCount;

    return {
      canCompare: true,
      sameSize,
      alignment: offset,
      message: sameSize
        ? (diffCount === 0 ? '两个方案完全相同' : `共 ${changedCount} 格颜色变化`)
        : `重叠区域 ${sameCount} 格相同、${changedCount} 格颜色变化，A 独有 ${missingCount} 格，B 新增 ${addedCount} 格`,
      differences,
      changedCount,
      missingCount,
      addedCount,
      diffCount,
      sameCount,
      overlapCount,
      totalCount,
      diffRatio: overlapCount > 0 ? (changedCount / overlapCount * 100).toFixed(1) : '0.0'
    };
  }

  function compareYarnEstimate(schemeA, schemeB, threads) {
    if (typeof YarnEstimate === "undefined") {
      return { a: null, b: null, diff: null };
    }

    const estA = YarnEstimate.computePerThreadEstimate({
      cells: schemeA.cells, cols: schemeA.cols, rows: schemeA.rows,
      threads: threads, scheme: schemeA
    });
    const estB = YarnEstimate.computePerThreadEstimate({
      cells: schemeB.cells, cols: schemeB.cols, rows: schemeB.rows,
      threads: threads, scheme: schemeB
    });

    const allThreadIds = new Set([
      ...estA.estimates.map(e => e.id),
      ...estB.estimates.map(e => e.id)
    ]);
    const perThreadDiff = [];

    allThreadIds.forEach(threadId => {
      const ea = estA.estimates.find(e => e.id === threadId);
      const eb = estB.estimates.find(e => e.id === threadId);
      const thread = threads.find(t => t.id === threadId);

      if (thread) {
        perThreadDiff.push({
          threadId,
          name: thread.name,
          color: thread.color,
          recommendedA: ea ? ea.recommendedCm : 0,
          recommendedB: eb ? eb.recommendedCm : 0,
          diff: (eb ? eb.recommendedCm : 0) - (ea ? ea.recommendedCm : 0)
        });
      }
    });

    perThreadDiff.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

    return {
      a: estA,
      b: estB,
      perThreadDiff,
      totalDiffCm: estB.totals.recommendedCm - estA.totals.recommendedCm
    };
  }

  function compareAll(schemeA, schemeB, threads, alignment) {
    const firstThreadId = ThreadStore.getFirstId();

    return {
      schemeA: { id: schemeA.id, name: schemeA.name },
      schemeB: { id: schemeB.id, name: schemeB.name },
      dimensions: compareDimensions(schemeA, schemeB),
      filledCells: compareFilledCells(schemeA, schemeB, firstThreadId),
      colorUsage: compareColorUsage(schemeA, schemeB, threads),
      riskRows: compareRiskRows(schemeA, schemeB),
      cellDiff: computeCellDifferences(schemeA, schemeB, alignment),
      yarnEstimate: compareYarnEstimate(schemeA, schemeB, threads)
    };
  }

  return {
    compareDimensions,
    compareFilledCells,
    compareColorUsage,
    compareRiskRows,
    computeAlignmentOffset,
    computeCellDifferences,
    compareAll,
    compareYarnEstimate,
    getRiskRows,
    getRiskRowsDetail
  };
})();
