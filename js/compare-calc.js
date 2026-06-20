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

  function computeCellDifferences(schemeA, schemeB) {
    if (schemeA.cols !== schemeB.cols || schemeA.rows !== schemeB.rows) {
      return {
        canCompare: false,
        message: `尺寸不一致（${schemeA.cols}×${schemeA.rows} vs ${schemeB.cols}×${schemeB.rows}），无法直接逐格比较。`,
        differences: [],
        diffCount: 0,
        sameCount: 0
      };
    }

    const cols = schemeA.cols;
    const rows = schemeA.rows;
    const differences = [];
    let diffCount = 0;
    let sameCount = 0;

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const idx = y * cols + x;
        const cellA = schemeA.cells[idx];
        const cellB = schemeB.cells[idx];

        if (cellA !== cellB) {
          differences.push({
            x, y, idx,
            cellA,
            cellB
          });
          diffCount++;
        } else {
          sameCount++;
        }
      }
    }

    return {
      canCompare: true,
      message: diffCount === 0 ? '两个方案完全相同' : `共 ${diffCount} 格存在差异`,
      differences,
      diffCount,
      sameCount,
      totalCount: cols * rows,
      diffRatio: (diffCount / (cols * rows) * 100).toFixed(1)
    };
  }

  function compareAll(schemeA, schemeB, threads) {
    const firstThreadId = ThreadStore.getFirstId();

    return {
      schemeA: { id: schemeA.id, name: schemeA.name },
      schemeB: { id: schemeB.id, name: schemeB.name },
      dimensions: compareDimensions(schemeA, schemeB),
      filledCells: compareFilledCells(schemeA, schemeB, firstThreadId),
      colorUsage: compareColorUsage(schemeA, schemeB, threads),
      riskRows: compareRiskRows(schemeA, schemeB),
      cellDiff: computeCellDifferences(schemeA, schemeB)
    };
  }

  return {
    compareDimensions,
    compareFilledCells,
    compareColorUsage,
    compareRiskRows,
    computeCellDifferences,
    compareAll,
    getRiskRows,
    getRiskRowsDetail
  };
})();
